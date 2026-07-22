-- ====================================================================
-- 3-Tier Hierarchy & Cascading Whitelabel Theme Engine DDL Migration
-- ====================================================================

-- 1. Ensure tenants table columns
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active', -- 'active', 'suspended', 'trial'
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{"primary": "#6366f1", "sidebar": "#0f172a"}'::jsonb;

-- 2. Ensure users table columns & roles
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'tenant_operator', -- 'super_admin', 'tenant_admin', 'tenant_operator'
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Create user_preferences table for Operator Custom Themes
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  theme_mode TEXT DEFAULT 'dark', -- 'light', 'dark', 'system'
  accent_color TEXT DEFAULT '#6366f1',
  kanban_density TEXT DEFAULT 'comfortable', -- 'compact', 'comfortable'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Allow all access to user_preferences') THEN
    CREATE POLICY "Allow all access to user_preferences" ON user_preferences FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
