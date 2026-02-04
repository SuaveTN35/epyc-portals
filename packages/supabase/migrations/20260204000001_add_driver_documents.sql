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
-- Note: Run this in Supabase Dashboard > Storage or via API:
-- 1. Create bucket named "driver-documents"
-- 2. Set to public (for displaying images)
-- 3. Add RLS policy for authenticated users to upload their own documents

-- Storage RLS policies (run in SQL Editor after bucket creation):
/*
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'driver-documents'
  );

-- Allow public read access for verified documents
CREATE POLICY "Public read access for driver documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'driver-documents');

-- Allow users to update their own documents
CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'driver-documents'
  );

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'driver-documents'
  );
*/
