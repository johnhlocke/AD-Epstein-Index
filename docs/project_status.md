# Project Status

This file should be automatically updated when necessary to answer three key questions:
1. What are the project milestones?
2. What's been accomplished?
3. What's next?

---

## 1. Project Milestones

| Milestone | Phase | Status |
|-----------|-------|--------|
| Project setup & CLAUDE.md | Phase 1 | Done |
| Proof of concept (extract data from 1 issue) | Phase 1 | Done |
| Set up Supabase database & schema | Phase 1 | Done |
| Evaluate Epstein data sources | Phase 2 (early) | Done |
| Set up Playwright MCP server | Phase 2 | Done |
| Build custom agents (epstein-search, black-book-search) | Phase 2 | Done |
| Choose vision API for extraction (Gemini → Claude Sonnet) | Phase 1 | Done |
| Build PDF ingestion pipeline (archive.org) | Phase 1 | Done |
| Test pipeline end-to-end | Phase 1 | Done |
| Fix extraction quality (NULL results, under-extraction) | Phase 1 | Done |
| Migrate extraction from Gemini to Claude Sonnet | Phase 1 | Done |
| Batch process all archive.org issues (~50 PDFs) | Phase 1 | In Progress |
| Source additional AD issues (beyond archive.org) | Phase 1 | Not Started |
| Build cross-reference engine | Phase 2 | Done |
| Batch cross-reference all extracted names | Phase 2 | In Progress |
| Build interactive website | Phase 3 | Not Started |
| Deploy website publicly | Phase 3 | Not Started |

## 2. What's Been Accomplished

### Project Setup
- Initialized git repo and connected to GitHub (`johnhlocke/AD-Epstein-Index`)
- Created project structure (`src/`, `docs/`, `tests/`, `data/`)
- Set up CLAUDE.md with project overview, data model, phases, repo etiquette, design guide, constraints, documentation, and personal learning goals
- Created all documentation files (architecture, changelog, project status, project spec, schema)

### Phase 1: AD Database

**Proof of concept:**
- Extracted 8 featured homes from AD May 2013 by converting PDF pages (pdftoppm) to images and reading them visually
- Confirmed feasibility: can accurately read homeowner names, designers, locations from scanned magazine PDFs

**Supabase database:**
- Connected to project at `znbjqoehvgmkolxewluv.supabase.co`
- Schema created: `issues`, `features`, `feature_images` tables
- Seeded May 2013 data: 1 issue + 8 features via `src/seed_may_2013.py`

**PDF Ingestion Pipeline (Internet Archive):**
- Built complete 4-step pipeline: `discover` → `download` → `extract` → `load`
- `src/archive_discovery.py` — Found 163 AD items on archive.org, parsed month/year for 141
- `src/archive_download.py` — Downloads PDFs with rate limiting, resume support, newest-first sorting
- `src/extract_features.py` — Claude Sonnet Vision API extracts TOC articles then homeowner data from each article page (migrated from Gemini 2.0 Flash for better quality)
- `src/load_features.py` — Loads extracted JSON into Supabase with duplicate detection
- `src/pipeline.py` — CLI orchestrator (`discover`, `download`, `extract`, `load`, `run`, `status`)
- Pipeline tested end-to-end on 15+ issues
- Extraction quality improvements: auto page offset detection, expanded TOC scanning (1-20 pages), nearby-page retry for NULLs, minimum 3 features per issue threshold, supplemental page scanning
- 32 PDFs downloaded from archive.org (16 post-1988 usable issues)

### Phase 2: Epstein Cross-Reference (early exploration)

**DOJ Epstein Library:**
- Downloaded LMSBAND/epstein-files-db (835MB SQLite) — tested and found incomplete vs. justice.gov
- Built `/epstein-search` agent: Playwright-based browser search of justice.gov/epstein with confidence scoring (HIGH/MEDIUM/LOW/NONE)
- Batch tested May 2013 homeowner names — only false positives found (Peter Rogers = contractor invoices)

**Epstein's Little Black Book:**
- Extracted text from PDF to `data/black_book.txt` (19,547 lines, 2004-2005 contact directory)
- Built `/black-book-search` agent: Grep-based search with multiple name variations
- Tested against May 2013 homeowners — no matches found

**Cross-Reference Engine (`src/cross_reference.py`):**
- Automated batch cross-referencing of all extracted homeowner names against DOJ Epstein Library and Little Black Book
- Word-boundary matching prevents false positives (e.g., Bush≠Bushnell)
- Miranda Brooks is the only confirmed Black Book match so far

**Database schema updates:**
- `matches` table: confidence scoring (high/medium/low) with rationale and manual review flags
- `black_book_matches` table designed (commented out, for Phase 2 activation)

## 3. What's Next

**Immediate — Batch Processing with Claude:**
- Re-extract all existing issues using Claude Sonnet (replacing Gemini results) for better accuracy
- Download remaining archive.org PDFs (~35 more post-1988 issues)
- Run extraction + load + cross-reference pipeline on all issues

**Phase 1 — Complete the AD Database:**
- Source additional AD issues beyond archive.org (eBay scans, library digitizations, other archives)
- Quality review: validate extracted data, fill in missing fields
- Build data cleanup/deduplication tools

**Phase 2 — Cross-Reference at Scale:**
- Run cross-reference engine across all extracted homeowner names
- Store match results in Supabase with confidence scores
- Manual review of any flagged matches

**Phase 3 — Interactive Website:**
- Design and build public-facing visualization website
- Searchable index, interactive timelines, trend analysis
