-- ====================================================================
-- 100% No-Code SaaS Platform DDL Schema Migration for Supabase
-- ====================================================================

-- 1. Ensure services table columns
ALTER TABLE services
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS automation_mapping JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Ensure custom_fields table columns
ALTER TABLE custom_fields
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 3. Create workflow_rules table (No-Code "Gatilho ➔ Ação" Engine)
CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'on_card_created', 'on_status_change', 'on_time_offset', 'on_rpa_success'
  trigger_config JSONB DEFAULT '{}'::jsonb, -- e.g. { from_status: 'created', to_status: 'in_progress', offset_minutes: 60 }
  action_type TEXT NOT NULL, -- 'send_whatsapp', 'run_rpa', 'move_card_status', 'request_attachment'
  action_config JSONB DEFAULT '{}'::jsonb, -- e.g. { template_body: '...', target_status: 'completed' }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create scheduled_messages_queue table (Anti-Duplication Queue)
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

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_workflow_rules_service ON workflow_rules(service_id, is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_queue_pending ON scheduled_messages_queue(status, send_at);

-- RLS Policies
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'Allow all access to workflow_rules') THEN
    CREATE POLICY "Allow all access to workflow_rules" ON workflow_rules FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scheduled_messages_queue' AND policyname = 'Allow all access to scheduled_messages_queue') THEN
    CREATE POLICY "Allow all access to scheduled_messages_queue" ON scheduled_messages_queue FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
