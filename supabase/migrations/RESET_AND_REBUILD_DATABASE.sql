-- ====================================================================
-- SCRIPT PARA APAGAR TUDO E RECRIAR O BANCO DO ZERO (RESET TOTAL)
-- ATENÇÃO: Este script apaga todas as tabelas e dados existentes!
-- Copie todo o conteúdo abaixo e execute no SQL Editor do Supabase.
-- ====================================================================

-- 1. APAGAR TODAS AS TABELAS EXISTENTES (DROP CASCADE)
DROP TABLE IF EXISTS scheduled_messages_queue CASCADE;
DROP TABLE IF EXISTS workflow_rules CASCADE;
DROP TABLE IF EXISTS notification_rules CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS custom_fields CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- 2. HABILITAR EXTENSÃO UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. RECRIAR TABELA TENANTS
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  status TEXT DEFAULT 'active',
  max_users INTEGER DEFAULT 5,
  brand_colors JSONB DEFAULT '{"primary": "#6366f1", "sidebar": "#0f172a"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Tenant Padrão
INSERT INTO tenants (id, name, status, max_users)
VALUES ('00000000-0000-0000-0000-000000000001', 'Minha Empresa SaaS', 'active', 10);

-- 4. RECRIAR TABELA USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'tenant_operator',
  full_name TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  checklist_progress JSONB DEFAULT '{"whatsapp": false, "service": false, "rule": false, "card": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RECRIAR TABELA USER_PREFERENCES
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  theme_mode TEXT DEFAULT 'dark',
  accent_color TEXT DEFAULT '#6366f1',
  kanban_density TEXT DEFAULT 'comfortable',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RECRIAR TABELA SERVICES
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completion_type TEXT DEFAULT 'identity',
  confirmation_template TEXT,
  confirmation_schema JSONB DEFAULT '{}'::jsonb,
  external_url TEXT,
  automation_mapping JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RECRIAR TABELA CUSTOM_FIELDS
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RECRIAR TABELA CONTACTS
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_tenant_phone UNIQUE(tenant_id, phone)
);

-- 9. RECRIAR TABELA CARDS
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created',
  collected_data JSONB DEFAULT '{}'::jsonb,
  attachment_url TEXT,
  attachment_metadata JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  automation_status TEXT DEFAULT 'idle',
  automation_result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. RECRIAR TABELAS CHATS & MESSAGES
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_name TEXT,
  unread_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 11. RECRIAR TABELA WORKFLOW_RULES
CREATE TABLE workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. RECRIAR TABELA SCHEDULED_MESSAGES_QUEUE
CREATE TABLE scheduled_messages_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES workflow_rules(id) ON DELETE SET NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_card_rule UNIQUE(card_id, rule_id)
);

-- 13. RECRIAR TABELA NOTIFICATION_RULES
CREATE TABLE notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,
  template_body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. BUCKET DE ARMAZENAMENTO
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-attachments', 'card-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 15. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to user_preferences" ON user_preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to services" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to custom_fields" ON custom_fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to cards" ON cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to chats" ON chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to workflow_rules" ON workflow_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to scheduled_messages_queue" ON scheduled_messages_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to notification_rules" ON notification_rules FOR ALL USING (true) WITH CHECK (true);

-- 16. CONFIGURAR REALTIME
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cards') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cards;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chats;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 17. RECARREGAR CACHE
NOTIFY pgrst, 'reload schema';
