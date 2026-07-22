-- ====================================================================
-- RPA External Form Filling Automation Schema Migration for Supabase
-- ====================================================================

-- 1. Add RPA configuration columns to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS automation_mapping JSONB DEFAULT '[]'::jsonb;

-- 2. Add RPA execution status & result columns to cards table
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'idle', -- 'idle', 'running', 'success', 'failed'
ADD COLUMN IF NOT EXISTS automation_result JSONB DEFAULT '{}'::jsonb;

-- Index for querying automation statuses
CREATE INDEX IF NOT EXISTS idx_cards_automation_status ON cards(automation_status);
