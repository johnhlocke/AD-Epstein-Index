-- Migration 002: Feature images table + aesthetic scoring columns
-- Run in Supabase Dashboard > SQL Editor > New Query

-- ============================================================
-- 1. Add v2 aesthetic score columns to features table
-- ============================================================

ALTER TABLE features ADD COLUMN IF NOT EXISTS score_grandeur SMALLINT CHECK (score_grandeur BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_material_warmth SMALLINT CHECK (score_material_warmth BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_maximalism SMALLINT CHECK (score_maximalism BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_historicism SMALLINT CHECK (score_historicism BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_provenance SMALLINT CHECK (score_provenance BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_hospitality SMALLINT CHECK (score_hospitality BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_formality SMALLINT CHECK (score_formality BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_curation SMALLINT CHECK (score_curation BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS score_theatricality SMALLINT CHECK (score_theatricality BETWEEN 1 AND 5);
ALTER TABLE features ADD COLUMN IF NOT EXISTS scoring_version TEXT;
ALTER TABLE features ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

-- ============================================================
-- 2. Create feature_images table
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (feature_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_feature_images_feature_id ON feature_images(feature_id);

-- ============================================================
-- 3. Create storage bucket (must also be done via Dashboard > Storage)
-- ============================================================
-- NOTE: Create a PUBLIC bucket named "feature-images" in the Supabase Dashboard.
-- Then add this RLS policy:

-- Allow public reads (bucket is public)
-- Allow authenticated uploads via service key (no RLS needed for service key)

-- ============================================================
-- 4. Storage RLS policy for anon uploads (if using anon key)
-- ============================================================

CREATE POLICY "Allow anon uploads to feature-images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'feature-images');

CREATE POLICY "Allow public reads from feature-images"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'feature-images');
