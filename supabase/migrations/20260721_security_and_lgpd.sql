-- ====================================================================
-- Cybersecurity, Data Protection & LGPD Schema Migration for Supabase
-- ====================================================================

-- 1. Add LGPD Consent & Opt-Out columns to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS opt_in BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- Index for Opt-In filtering
CREATE INDEX IF NOT EXISTS idx_contacts_opt_in ON contacts(opt_in);
