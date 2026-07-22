-- ====================================================================
-- Onboarding Schema Migration for Supabase
-- ====================================================================

-- Add onboarding tracking columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '{"whatsapp": false, "service": false, "rule": false, "card": false}'::jsonb;
