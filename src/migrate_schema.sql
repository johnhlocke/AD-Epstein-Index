-- Migration: Add pipeline tracking columns to issues table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- This makes the issues table the single source of truth for the pipeline,
-- replacing the local archive_manifest.json.

-- Step 1: Add new columns
ALTER TABLE issues ADD COLUMN IF NOT EXISTS identifier TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'discovered';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pdf_path TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'archive.org';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS date_confidence TEXT DEFAULT 'medium';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS date_source TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS verified_month INTEGER;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS verified_year INTEGER;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS archive_date TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS ad_archive_progress JSONB;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Add check constraint on status
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('discovered','downloading','downloaded','extracted','skipped_pre1988','error','no_pdf','extraction_error'));

-- Step 3: Add unique constraint on identifier (allows NULL — only enforces uniqueness on non-null values)
ALTER TABLE issues ADD CONSTRAINT issues_identifier_unique UNIQUE (identifier);

-- Step 4: Drop NOT NULL on month (some issues may not have a confirmed month yet)
ALTER TABLE issues ALTER COLUMN month DROP NOT NULL;

-- Step 5: Drop the old UNIQUE(month, year) constraint
-- (we now use identifier as the unique key; multiple issues can share month/year during discovery)
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_month_year_key;

-- Verify: check the new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'issues'
ORDER BY ordinal_position;
