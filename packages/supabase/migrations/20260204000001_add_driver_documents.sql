-- ============================================
-- ADD DRIVER DOCUMENT URL COLUMNS
-- ============================================

-- Add document URL columns to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_front_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_back_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS insurance_card_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS registration_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_photo_front_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_photo_back_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_photo_side_url TEXT;

-- Add index for faster lookups on background check status
CREATE INDEX IF NOT EXISTS idx_drivers_background_check ON drivers(background_check_status);

-- ============================================
-- STORAGE BUCKET FOR DRIVER DOCUMENTS
-- ============================================
-- Document uploads (license, insurance, registration, vehicle photos) are
-- written by the service-role /api/upload route, which bypasses RLS. These
-- statements create the public bucket and a permissive read/insert policy so
-- the bucket exists and uploaded documents are publicly viewable. Idempotent.

-- Create the public bucket if it does not already exist.
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access (documents are displayed via public URLs).
DROP POLICY IF EXISTS "Public read access for driver documents" ON storage.objects;
CREATE POLICY "Public read access for driver documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'driver-documents');

-- Allow authenticated users to upload directly (fallback for any future
-- client-side upload path; the service role already bypasses RLS).
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'driver-documents'
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'driver-documents'
  );
