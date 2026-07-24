-- ====================================================================
-- ServiceFlow SaaS - SCRIPT CONSOLIDADO COMPLETO (EXECUTAR NO SUPABASE)
-- Copie todo este conteúdo, cole no SQL Editor do Supabase e clique em RUN
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA TENANTS
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'suspended', 'trial'
  max_users INTEGER DEFAULT 5,
  brand_colors JSONB DEFAULT '{"primary": "#6366f1", "sidebar": "#0f172a"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Tenant padrão
INSERT INTO tenants (id, name, status, max_users)
VALUES ('00000000-0000-0000-0000-000000000001', 'Minha Empresa SaaS', 'active', 10)
ON CONFLICT (id) DO NOTHING;

-- 2. TABELA USERS / PROFILES
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'tenant_operator', -- 'super_admin', 'tenant_admin', 'tenant_operator'
  full_name TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  checklist_progress JSONB DEFAULT '{"whatsapp": false, "service": false, "rule": false, "card": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA USER_PREFERENCES (Preferências visuais dos operadores)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  theme_mode TEXT DEFAULT 'dark', -- 'light', 'dark', 'system'
  accent_color TEXT DEFAULT '#6366f1',
  kanban_density TEXT DEFAULT 'comfortable',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA SERVICES (Serviços No-Code e RPA)
CREATE TABLE IF NOT EXISTS services (
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

-- 5. TABELA CUSTOM_FIELDS (Perguntas dinâmicas do serviço)
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'text', 'number', 'date', 'datetime', 'select', 'file', 'boolean'
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA CONTACTS (Clientes)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_tenant_phone UNIQUE(tenant_id, phone)
);

-- 7. TABELA CARDS (Atendimentos e Cartões Kanban)
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created', -- 'created', 'in_progress', 'completed', 'cancelled'
  collected_data JSONB DEFAULT '{}'::jsonb,
  attachment_url TEXT,
  attachment_metadata JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  automation_status TEXT DEFAULT 'idle', -- 'idle', 'running', 'success', 'failed'
  automation_result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELAS CHATS & MESSAGES (WhatsApp Central)
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_name TEXT,
  unread_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABELA WORKFLOW_RULES (Motor No-Code de Réguas "Gatilho ➔ Ação")
CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'on_card_created', 'on_status_change', 'on_time_offset', 'on_rpa_success'
  trigger_config JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL, -- 'send_whatsapp', 'run_rpa', 'move_card_status'
  action_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABELA SCHEDULED_MESSAGES_QUEUE (Fila de Envio Temporal Idempotente)
CREATE TABLE IF NOT EXISTS scheduled_messages_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES workflow_rules(id) ON DELETE SET NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_card_rule UNIQUE(card_id, rule_id)
);

-- 11. TABELA LEGACY NOTIFICATION_RULES
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,
  template_body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. STORAGE BUCKET PARA COMPROVANTES
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-attachments', 'card-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 13. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
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

DO $$
BEGIN
  -- Strict RLS Policies for Tenant Isolation
  CREATE POLICY "Tenant isolation for services" ON services FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR auth.jwt() IS NULL);
  CREATE POLICY "Tenant isolation for contacts" ON contacts FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR auth.jwt() IS NULL);
  CREATE POLICY "Tenant isolation for cards" ON cards FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR auth.jwt() IS NULL);
  CREATE POLICY "Tenant isolation for chats" ON chats FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR auth.jwt() IS NULL);
  CREATE POLICY "Tenant isolation for workflow_rules" ON workflow_rules FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR auth.jwt() IS NULL);
  CREATE POLICY "Tenant isolation for scheduled_messages_queue" ON scheduled_messages_queue FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR auth.jwt() IS NULL);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 14. REALTIME PUBLICATION SETUP
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

-- 15. RECARREGAR CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
