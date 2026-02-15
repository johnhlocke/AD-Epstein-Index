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
  detective_verdict TEXT DEFAULT NULL
    CHECK (detective_verdict IN ('YES', 'NO')),
  detective_checked_at TIMESTAMPTZ DEFAULT NULL,
  -- 6-dimension aesthetic taxonomy (JSONB)
  -- Structure: {
  --   "envelope": "Classical/Neoclassical",       -- Architectural Envelope (single-select)
  --   "atmosphere": "Formal/Antiquarian",          -- Interior Atmosphere (single-select)
  --   "materiality": "Stone & Marble",             -- Dominant Texture (single-select)
  --   "power_status": "Institutional/Monumental",  -- Power & Status Signal (single-select)
  --   "cultural_orientation": "Euro-Centric/Old World",  -- Cultural Orientation (single-select)
  --   "art_collection": ["Old Masters", "Sculpture"],    -- Art & Collection (multi-select)
  --   "named_artists": ["Caravaggio", "Brancusi"],       -- Specific artists mentioned (free-text)
  --   "source": "deep_extract" | "batch_tag",            -- How it was classified
  --   "extracted_at": "2026-02-13T..."                    -- When classified
  -- }
  aesthetic_profile JSONB DEFAULT NULL,
  subject_category TEXT DEFAULT NULL
    CHECK (subject_category IN ('Associate', 'Politician', 'Legal', 'Royalty',
                                 'Celebrity', 'Business', 'Designer', 'Socialite',
                                 'Private', 'Other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_features_detective_verdict ON features(detective_verdict);

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

-- ============================================================
-- Dossier Tables (Researcher agent output)
-- ============================================================

-- Dossiers: one row per investigated lead (one dossier per feature)
CREATE TABLE dossiers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE UNIQUE,
  subject_name TEXT NOT NULL,

  -- Verdict fields
  combined_verdict TEXT,
  confidence_score NUMERIC(3,2),
  connection_strength TEXT CHECK (connection_strength IN ('HIGH', 'MEDIUM', 'LOW', 'COINCIDENCE')),
  strength_rationale TEXT,

  -- Triage fields
  triage_result TEXT CHECK (triage_result IN ('investigate', 'coincidence')),
  triage_reasoning TEXT,

  -- Analysis JSONB columns
  ad_appearance JSONB,
  home_analysis JSONB,
  visual_analysis JSONB,
  epstein_connections JSONB,
  pattern_analysis JSONB,
  key_findings JSONB,

  -- Review fields
  investigation_depth TEXT DEFAULT 'standard',
  needs_manual_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,

  -- Subject classification
  subject_category TEXT DEFAULT NULL
    CHECK (subject_category IN ('Associate', 'Politician', 'Legal', 'Royalty',
                                 'Celebrity', 'Business', 'Designer', 'Socialite',
                                 'Private', 'Other')),

  -- Editor gatekeeper fields
  editor_verdict TEXT DEFAULT 'PENDING_REVIEW'
    CHECK (editor_verdict IN ('CONFIRMED', 'REJECTED', 'PENDING_REVIEW')),
  editor_reasoning TEXT,
  editor_reviewed_at TIMESTAMPTZ,

  -- Timestamps
  investigated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dossiers_connection_strength ON dossiers(connection_strength);
CREATE INDEX idx_dossiers_feature_id ON dossiers(feature_id);
CREATE INDEX idx_dossiers_editor_verdict ON dossiers(editor_verdict);

-- Dossier images: article page images linked to dossiers
CREATE TABLE dossier_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  page_number INTEGER,
  storage_path TEXT,
  public_url TEXT,
  image_type TEXT DEFAULT 'article_page',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dossier_images_dossier_id ON dossier_images(dossier_id);

-- NOTE: Also create Supabase Storage bucket "dossier-images" (public) in Dashboard.

-- ============================================================
-- Cross-Reference Tables (Detective agent output)
-- ============================================================

-- Cross-references: full detective work per feature (one row per feature)
-- Replaces local results.json + detective_verdicts.json
CREATE TABLE cross_references (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE UNIQUE,
  homeowner_name TEXT NOT NULL,

  -- Black Book results
  black_book_status TEXT DEFAULT 'pending'
    CHECK (black_book_status IN ('match', 'no_match', 'pending')),
  black_book_matches JSONB,

  -- DOJ search results
  doj_status TEXT DEFAULT 'pending'
    CHECK (doj_status IN ('searched', 'pending', 'error', 'skipped')),
  doj_results JSONB,

  -- Combined verdict (from assess_combined_verdict)
  combined_verdict TEXT DEFAULT 'pending'
    CHECK (combined_verdict IN ('confirmed_match', 'likely_match', 'possible_match',
                                 'needs_review', 'no_match', 'pending')),
  confidence_score NUMERIC(3,2) DEFAULT 0.0,
  verdict_rationale TEXT,
  false_positive_indicators JSONB,

  -- Binary verdict for features table compat
  binary_verdict TEXT CHECK (binary_verdict IN ('YES', 'NO')),

  -- Editor overrides (preserve original verdict alongside override)
  editor_override_verdict TEXT,
  editor_override_reason TEXT,
  editor_override_at TIMESTAMPTZ,

  -- Individuals actually searched (from name analysis)
  individuals_searched JSONB,

  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_xref_combined_verdict ON cross_references(combined_verdict);
CREATE INDEX idx_xref_homeowner_name ON cross_references(homeowner_name);
