-- ====================================================================
-- Service-Specific Custom Confirmation Schema Migration
-- ====================================================================

ALTER TABLE services
ADD COLUMN IF NOT EXISTS completion_type TEXT DEFAULT 'identity', -- 'identity', 'financial', 'custom_fields', 'simple'
ADD COLUMN IF NOT EXISTS confirmation_schema JSONB DEFAULT '{}'::jsonb;
