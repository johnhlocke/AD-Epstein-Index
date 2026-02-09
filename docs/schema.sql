-- AD-Epstein-Index Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================================
-- Phase 1 Tables
-- ============================================================

-- Issues: one row per magazine issue (also serves as pipeline tracker)
-- This is the single source of truth for issue status, replacing archive_manifest.json.
CREATE TABLE issues (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  year INTEGER CHECK (year BETWEEN 1920 AND 2100),
  cover_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Pipeline tracking columns (added in Supabase migration)
  identifier TEXT UNIQUE,                       -- archive.org identifier (e.g. "sim_architectural-digest_1992-03")
  title TEXT,                                   -- human-readable title
  status TEXT DEFAULT 'discovered'              -- pipeline state machine
    CHECK (status IN ('discovered','downloading','downloaded','extracted',
                      'skipped_pre1988','error','no_pdf','extraction_error')),
  pdf_path TEXT,                                -- local path to downloaded PDF
  source TEXT DEFAULT 'archive.org',            -- where this issue came from
  source_url TEXT,                              -- original URL
  date_confidence TEXT DEFAULT 'medium',        -- how sure we are about the date
  date_source TEXT,                             -- where the date came from
  verified_month INTEGER,                       -- month confirmed from cover/TOC
  verified_year INTEGER,                        -- year confirmed from cover/TOC
  needs_review BOOLEAN DEFAULT FALSE,           -- flagged for human review
  archive_date TEXT,                            -- raw date string from archive.org
  ad_archive_progress JSONB,                    -- progress tracking for AD Archive source
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (month, year)
);

-- Features: one row per featured home/article
CREATE TABLE features (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  article_title TEXT,
  article_author TEXT,
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
--   confidence_score NUMERIC(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
