-- ====================================================================
-- Privacy & LGPD Hardening: Restrict Super Admin Operational Data Access
-- Ensures Super Admin cannot view third-party customer messages, contacts, or cards
-- ====================================================================

-- 1. Ensure RLS is active on operational tables
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages_queue ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy open policies if present
DROP POLICY IF EXISTS "Allow all access to cards" ON cards;
DROP POLICY IF EXISTS "Allow all access to contacts" ON contacts;
DROP POLICY IF EXISTS "Allow all access to chats" ON chats;
DROP POLICY IF EXISTS "Allow all access to messages" ON messages;
DROP POLICY IF EXISTS "Allow all access to workflow_rules" ON workflow_rules;
DROP POLICY IF EXISTS "Allow all access to scheduled_messages_queue" ON scheduled_messages_queue;

-- 3. Strict Tenant Isolation Policies (No Super Admin bypass on operational data)
CREATE POLICY "Strict Tenant Isolation on Cards" ON cards
  FOR ALL USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001'))::uuid);

CREATE POLICY "Strict Tenant Isolation on Contacts" ON contacts
  FOR ALL USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001'))::uuid);

CREATE POLICY "Strict Tenant Isolation on Chats" ON chats
  FOR ALL USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001'))::uuid);

CREATE POLICY "Strict Tenant Isolation on Messages" ON messages
  FOR ALL USING (
    chat_id IN (
      SELECT id FROM chats WHERE tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001'))::uuid
    )
  );

CREATE POLICY "Strict Tenant Isolation on Workflow Rules" ON workflow_rules
  FOR ALL USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001'))::uuid);

CREATE POLICY "Strict Tenant Isolation on Scheduled Queue" ON scheduled_messages_queue
  FOR ALL USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001'))::uuid);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
