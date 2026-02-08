-- AD-Epstein-Index Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================================
-- Phase 1 Tables
-- ============================================================

-- Issues: one row per magazine issue
CREATE TABLE issues (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 1920 AND 2100),
  cover_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, year)
);

-- Features: one row per featured home/article
CREATE TABLE features (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  year INTEGER CHECK (year BETWEEN 1920 AND 2100),
  article_title TEXT,
  homeowner_name TEXT,
  designer_name TEXT,
  architecture_firm TEXT,
  year_built INTEGER,
  square_footage INTEGER,
  cost TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  design_style TEXT,
  page_number INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Phase 2 Tables (create later)
-- ============================================================

-- Epstein persons: unique individuals found in Epstein files
-- CREATE TABLE epstein_persons (
--   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   name TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Epstein references: each specific mention of a person
-- CREATE TABLE epstein_references (
--   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   person_id BIGINT NOT NULL REFERENCES epstein_persons(id) ON DELETE CASCADE,
--   source_document TEXT,
--   document_url TEXT,
--   page_number INTEGER,
--   context TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Matches: links AD features to Epstein persons
-- CREATE TABLE matches (
--   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
--   epstein_person_id BIGINT NOT NULL REFERENCES epstein_persons(id) ON DELETE CASCADE,
--   match_type TEXT CHECK (match_type IN ('exact', 'fuzzy', 'manual')),
--   confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
--   confidence_rationale TEXT,
--   needs_manual_review BOOLEAN DEFAULT TRUE,
--   manually_confirmed BOOLEAN DEFAULT FALSE,
--   total_doj_results INTEGER DEFAULT 0,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- ============================================================
-- Black Book Matches (Phase 2)
-- ============================================================

-- Links AD features to entries in Epstein's Little Black Book (2004-2005)
-- CREATE TABLE black_book_matches (
--   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
--   black_book_name TEXT NOT NULL,
--   contact_details TEXT,
--   match_status TEXT NOT NULL CHECK (match_status IN ('match', 'partial', 'no_match')),
--   assessment TEXT,
--   manually_confirmed BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- ============================================================
-- Feature Images (only for Epstein-matched homeowners)
-- ============================================================

-- Stores article page images uploaded to Supabase Storage
-- Only populated when a homeowner matches an Epstein record
CREATE TABLE feature_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  page_number INTEGER,
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage: images stored in Supabase Storage bucket "feature-images" (public)
