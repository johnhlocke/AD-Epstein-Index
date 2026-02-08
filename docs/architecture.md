# Architecture

High-level system architecture, data flow, and component relationships.

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Phase 1: Data Ingestion               │
│                                                         │
│  archive.org API ──► Download PDFs ──► pdftoppm (PNG)   │
│                                        ──► Gemini Vision ──► JSON ──► Supabase │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Phase 2: Cross-Reference                  │
│                                                         │
│  ┌──────────────┐                                       │
│  │ DOJ Epstein  │──► Playwright ──┐                     │
│  │ Library      │   (browser)     │                     │
│  └──────────────┘                 ├──► Match Results DB  │
│  ┌──────────────┐                 │                     │
│  │ Little Black │──► Grep search ─┘                     │
│  │ Book (text)  │                                       │
│  └──────────────┘                                       │
│                                                         │
│  AD Database ──► Name Matching Engine ──► Confidence     │
│                                          Scoring        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│            Phase 3: Visualization Website               │
│                                                         │
│  Next.js (App Router) + Tailwind + Shadcn UI            │
│                                                         │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Searchable│  │ Interactive  │  │ Trend Analysis   │ │
│  │ Index     │  │ Timelines    │  │ & Correlations   │ │
│  └───────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Phase 1 Pipeline Detail

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Discover   │───►│   Download   │───►│   Extract    │───►│     Load     │
│              │    │              │    │              │    │              │
│ archive.org  │    │ PDFs from    │    │ Gemini 2.0   │    │ JSON → Supa- │
│ search API   │    │ archive.org  │    │ Flash Vision │    │ base tables  │
│              │    │              │    │              │    │              │
│ Output:      │    │ Output:      │    │ Output:      │    │ Output:      │
│ manifest.json│    │ data/issues/ │    │ data/extrac- │    │ issues +     │
│ (163 items)  │    │ (.pdf files) │    │ tions/*.json │    │ features     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Orchestrator:** `python3 src/pipeline.py [discover|download|extract|load|run|status]`

### Extraction Strategy
1. Convert first 12 PDF pages to images (covers + table of contents)
2. Send TOC pages to Gemini Vision → identifies featured home articles with page numbers
3. For each article: convert opening 2 pages to images
4. Send article pages to Gemini Vision → extracts structured data (homeowner, designer, location, etc.)
5. Save results as JSON, then load into Supabase

## Data Flow

1. **Discover** — Query archive.org API for AD magazine text items, parse month/year, save manifest
2. **Download** — Fetch PDFs from archive.org with rate limiting and resume support
3. **Extract** — Convert PDF pages to PNG (pdftoppm at 150 DPI), send to Gemini 2.0 Flash for structured data extraction
4. **Load** — Insert issues and features into Supabase with duplicate detection
5. **Cross-reference** — Match AD homeowner names against DOJ Epstein Library (Playwright) and Little Black Book (text search)
6. **Serve** — A Next.js website queries the database and renders interactive visualizations

## Components

| Component | Purpose | Tech |
|-----------|---------|------|
| Pipeline Orchestrator | CLI entry point for all pipeline steps | Python (`src/pipeline.py`) |
| Archive Discovery | Find AD issues on archive.org | Python, requests (`src/archive_discovery.py`) |
| Archive Download | Download PDFs with rate limiting | Python, requests (`src/archive_download.py`) |
| Feature Extraction | Extract homeowner data from PDF pages | Python, Gemini 2.0 Flash, pdftoppm (`src/extract_features.py`) |
| Database Loader | Load JSON extractions into Supabase | Python, supabase-py (`src/load_features.py`) |
| Epstein Search Agent | Search DOJ Epstein Library | Playwright MCP (`.claude/commands/epstein-search.md`) |
| Black Book Search Agent | Search Epstein's Little Black Book | Grep (`.claude/commands/black-book-search.md`) |
| Database | Store structured home/person data | Supabase (PostgreSQL) |
| Image Storage | Article images for matched homeowners only | Supabase Storage (bucket: feature-images) |
| Website | Public-facing visualizations | Next.js, Tailwind, Shadcn UI (Phase 3) |

## Database Schema

See [schema.sql](schema.sql) for full SQL definitions.

| Table | Phase | Purpose |
|-------|-------|---------|
| `issues` | 1 | One row per magazine issue (month, year, cover) |
| `features` | 1 | One row per featured home (homeowner, designer, location, etc.) |
| `epstein_persons` | 2 | Unique individuals from Epstein files |
| `epstein_references` | 2 | Each mention of a person (document, context, URL) |
| `matches` | 2 | Links AD features to Epstein persons with confidence scoring (high/medium/low) |
| `black_book_matches` | 2 | Links AD features to Epstein's Little Black Book entries |
| `feature_images` | 2 | Article page images for matched homeowners (stored in Supabase Storage) |

## Key Decisions

### Resolved
- **Database:** Supabase (PostgreSQL) — shared across all phases
- **Image storage:** Supabase Storage — only for Epstein-matched homeowners
- **Vision API:** Gemini 2.0 Flash — cheapest option with strong vision capabilities, billing enabled
- **PDF source (primary):** Internet Archive (~50 issues available)
- **PDF processing:** pdftoppm at 150 DPI for page-to-image conversion
- **Epstein search (primary):** Playwright browser automation on justice.gov/epstein
- **Epstein search (secondary):** Text search of Little Black Book (extracted via pdftotext)
- **Confidence scoring:** Simple HIGH/MEDIUM/LOW system with manual review for non-HIGH matches
- **Frontend:** Next.js (App Router), Tailwind CSS, Shadcn UI

### Pending
- Additional PDF sources beyond archive.org
- Hosting platform for the website
- Page number offset handling (magazine page numbers vs. PDF page numbers)
