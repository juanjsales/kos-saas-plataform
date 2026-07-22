-- ====================================================================
-- Dynamic Service Confirmation & Attachment Schema Migration for Supabase
-- ====================================================================

-- 1. Add confirmation_template column to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS confirmation_template TEXT;

-- 2. Add confirmation and attachment columns to cards table
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Storage Bucket for Card Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-attachments', 'card-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Allow public read access to card-attachments'
  ) THEN
    CREATE POLICY "Allow public read access to card-attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'card-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Allow insert to card-attachments'
  ) THEN
    CREATE POLICY "Allow insert to card-attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'card-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Allow update/delete to card-attachments'
  ) THEN
    CREATE POLICY "Allow update/delete to card-attachments"
    ON storage.objects FOR ALL
    USING (bucket_id = 'card-attachments');
  END IF;
END $$;
