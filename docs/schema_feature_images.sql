-- Feature Images: stores article page images ONLY for Epstein-matched homeowners
-- Run this in the Supabase SQL Editor

CREATE TABLE feature_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  page_number INTEGER,
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
