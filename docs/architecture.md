# Architecture

High-level system architecture, data flow, and component relationships.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Autonomous System                     │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Scout   │  │ Courier  │  │  Reader  │  │Detective │           │
│  │ discover │──│ download │──│ extract  │──│  xref    │           │
│  │ issues   │  │  PDFs    │  │ features │  │ BB + DOJ │           │
│  └──────────┘  └──────────┘  └──────────┘  └────┬─────┘           │
│                                                  │                  │
│                               ┌──────────┐  ┌────▼─────┐          │
│                               │ Designer │  │Researcher│          │
│                               │  learn   │  │ dossiers │          │
│                               │ patterns │  │ + home   │          │
│                               └──────────┘  │ analysis │          │
│                                             └──────────┘          │
│                    ┌──────────────────────┐                        │
│                    │       Editor         │                        │
│                    │  monitor + escalate  │                        │
│                    └──────────────────────┘                        │
│                                                                     │
│  Orchestrator (src/orchestrator.py) manages all agents              │
│  Dashboard Server (src/dashboard_server.py) serves UI + API         │
│  Agent Office (tools/agent-office/) real-time visualization         │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Storage                                  │
│                                                                     │
│  Supabase (PostgreSQL)          Disk (data/)                        │
│  ├── issues                     ├── archive_manifest.json           │
│  ├── features                   ├── issues/*.pdf                    │
│  └── (phase 2 tables)          ├── extractions/*.json               │
│                                 ├── cross_references/results.json   │
│                                 ├── dossiers/*.json                 │
│                                 └── detective_verdicts.json         │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│            Phase 3: Visualization Website (planned)                  │
│                                                                     │
│  Next.js (App Router) + Tailwind + Shadcn UI                        │
│                                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐            │
│  │ Searchable│  │ Interactive  │  │ Dossier Viewer   │            │
│  │ Index     │  │ Timelines    │  │ & Trend Analysis │            │
│  └───────────┘  └──────────────┘  └──────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

## Multi-Agent Pipeline

The system runs as 7 autonomous agents coordinated by an orchestrator:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Scout   │───►│ Courier  │───►│  Reader  │───►│Detective │───►│Researcher│
│          │    │          │    │          │    │          │    │          │
│ archive  │    │ download │    │ Claude   │    │ BB grep  │    │ Claude   │
│ .org API │    │ PDFs     │    │ Sonnet   │    │ + DOJ    │    │ Haiku    │
│          │    │          │    │ Vision   │    │ Playwright│    │ dossiers │
│ Output:  │    │ Output:  │    │ Output:  │    │ Output:  │    │ Output:  │
│ manifest │    │ PDFs     │    │ JSON     │    │ verdicts │    │ dossiers │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                      │
                              ┌──────────┐                            │
                              │  Editor  │◄───── escalations ─────────┘
                              │ monitor  │
                              │ + human  │
                              │ messages │
                              └──────────┘
```

### Agent Details

| Agent | Interval | AI Model | Key Behavior |
|-------|----------|----------|-------------|
| Scout | 60s | None (API calls) | Discovers issues on archive.org, fixes dates, multi-strategy |
| Courier | 5s | None (downloads) | Downloads PDFs with rate limiting, priority sorting |
| Reader | 30s | Claude Sonnet | Extracts homeowner data via Vision API, TOC + article pages |
| Detective | 180s | None (search) | Two-pass: BB grep (instant) → DOJ Playwright (batched) |
| Researcher | 120s | Claude Haiku | Builds dossiers with pattern analysis + home analysis |
| Editor | 5s | Claude Haiku | Event-driven pipeline health, human messages, escalation handling |
| Designer | 600s | Claude Haiku | Learns design patterns from training sources |

### Editor Event-Driven Model
The Editor does NOT poll agents for status. Instead:
1. **Event detection** — Monitors the shared activity log for milestone keywords (`loaded`, `match`, `dossier complete`, etc.)
2. **Escalation handling** — Reads agent-written escalation files (e.g., `reader_escalations.json`)
3. **Human messages** — Processes messages from the dashboard inbox immediately
4. **Health checks** — Periodic full assessment every 300s
5. **Cooldowns** — Minimum 30s between escalation responses, 90s between milestone responses
6. **Verdict restrictions** — Editor ONLY overrides detective verdicts when explicitly instructed by a human. Leads are the Researcher's responsibility.

### Researcher Investigation Pipeline
1. Picks up non-`no_match` leads from `results.json` that haven't been investigated
2. Gathers AD feature context from Supabase (all 14 fields)
3. Builds investigation context: BB matches, DOJ snippets, AD appearance details
4. Calls Claude Haiku with structured dossier prompt → JSON output
5. Robust JSON parsing with brace-counting fallback for truncated responses
6. Rates connection strength: HIGH / MEDIUM / LOW / COINCIDENCE
7. COINCIDENCE results auto-dismissed via verdict override
8. Saves dossier to `data/dossiers/{Name}.json` and master `all_dossiers.json`

### Agent Base Class (`src/agents/base.py`)
- Async work loop with configurable interval
- Pause/resume support via command queue
- Progress tracking (`get_progress()` returns `{current, total}`)
- Skills loading from `src/agents/skills/<agent>.md`
- Dashboard status reporting (`get_dashboard_status()`)
- Error tracking with per-agent failure counts

### Orchestrator (`src/orchestrator.py`)
- Launches all 7 agents as async tasks
- Writes `status.json` every 5 seconds (merges live agent data with disk-based stats)
- Overlays `editor_state` for dashboard sprite animation
- Injects Researcher's live task into notable_finds for "investigating" status
- Processes pause/resume commands from `data/agent_commands.json`
- Graceful shutdown on SIGINT

### Agent Status (`src/agent_status.py`)
- Reads pipeline state from manifest, extractions, cross-references, dossiers
- Pulls real-time feature counts from **Supabase** (source of truth, not local JSON)
- Generates `status.json` for the Agent Office dashboard
- Notable finds: filters out no_match names, shows xref verdict + research status
- Confirmed associates: HIGH and MEDIUM dossier connections with names and rationale

### Dashboard Server (`src/dashboard_server.py`)
- HTTP server for Agent Office frontend
- `POST /api/inbox` — Human messages to Editor
- `GET/POST /api/skills/{agent}` — Read/edit agent skills
- `POST /api/agent/{id}/pause|resume` — Agent control

## Extraction Strategy

1. Verify publication date from cover page (2 pages)
2. Convert first 20 PDF pages to images (covers + table of contents)
3. Send TOC pages to Claude Vision → identifies featured home articles with page numbers + calculates page offset
4. Auto-detect page offset if TOC doesn't provide it (samples pages 20, 30, 50)
5. For each article: convert opening 3 pages to images
6. Send article pages to Claude Vision → extracts structured data (homeowner, designer, location, style, article_author, etc.)
7. If homeowner_name is NULL, retry with expanded page range (±3 pages)
8. If fewer than 3 features found, supplement with page scanning (every 8 pages)
9. Save results as JSON, then load into Supabase

## Cross-Reference & Investigation Pipeline

1. **Detective BB pass** — Grep search of `data/black_book.txt` with word-boundary matching, min 5-char last names
2. **Detective DOJ pass** — Playwright browser search of justice.gov/epstein with WAF bypass, bot check handling
3. **Combined verdict** — `confirmed_match` / `likely_match` / `possible_match` / `no_match` / `needs_review`
4. **Researcher investigation** — Claude Haiku builds dossier for each non-`no_match` lead:
   - Full AD feature context (all 14 fields from Supabase)
   - Pattern analysis across all associated names (shared designers, locations, styles, decades)
   - Home analysis (wealth indicators, social circles, style significance, temporal relevance)
   - Connection strength: HIGH / MEDIUM / LOW / COINCIDENCE
5. **Escalation** — HIGH findings and notable patterns escalated to Editor

## Data Flow

1. **Discover** — Query archive.org API for AD magazine text items, parse month/year, save manifest
2. **Download** — Fetch PDFs from archive.org with rate limiting and resume support
3. **Extract** — Convert PDF pages to PNG (pdftoppm at 150 DPI), send to Claude Sonnet for structured data extraction
4. **Load** — Insert issues and features into Supabase with duplicate detection
5. **Cross-reference** — Match AD homeowner names against DOJ Epstein Library (Playwright) and Little Black Book (text search)
6. **Investigate** — Build dossiers on flagged leads with pattern analysis and home-as-evidence analysis
7. **Serve** — Agent Office dashboard shows real-time status; Phase 3 website will serve public visualizations

## Components

| Component | Purpose | Tech |
|-----------|---------|------|
| Orchestrator | Launches & coordinates all agents | Python, asyncio (`src/orchestrator.py`) |
| Agent Base | Shared agent behavior (work loop, pause, progress) | Python (`src/agents/base.py`) |
| Scout Agent | Discover AD issues on archive.org | Python, requests (`src/agents/scout.py`) |
| Courier Agent | Download PDFs | Python, requests (`src/agents/courier.py`) |
| Reader Agent | Extract homeowner data from PDFs | Python, Claude Sonnet, pdftoppm (`src/agents/reader.py`) |
| Detective Agent | Cross-reference names against Epstein records | Python, Playwright (`src/agents/detective.py`) |
| Researcher Agent | Build dossiers on flagged leads | Python, Claude Haiku (`src/agents/researcher.py`) |
| Editor Agent | Monitor pipeline, process messages, escalate | Python, Claude Haiku (`src/agents/editor.py`) |
| Designer Agent | Learn design patterns | Python, Claude Haiku (`src/agents/designer.py`) |
| Dashboard Server | HTTP API for Agent Office | Python, http.server (`src/dashboard_server.py`) |
| Agent Status | Generate status.json from pipeline data | Python (`src/agent_status.py`) |
| DOJ Search | Playwright-based DOJ Epstein Library search | Python, Playwright (`src/doj_search.py`) |
| Feature Extraction | Extract homeowner data from PDF pages | Python, Claude Sonnet, pdftoppm (`src/extract_features.py`) |
| Cross-Reference Engine | Batch name matching | Python, Playwright, grep (`src/cross_reference.py`) |
| Database Loader | Load JSON into Supabase | Python, supabase-py (`src/load_features.py`) |
| Pipeline CLI | Legacy CLI orchestrator | Python (`src/pipeline.py`) |
| Agent Office | Real-time pixel-art dashboard | HTML/CSS/JS (`tools/agent-office/agent-office.html`) |
| Agent Skills | Per-agent behavior docs | Markdown (`src/agents/skills/*.md`) |
| Database | Structured home/person data | Supabase (PostgreSQL) |
| Image Storage | Article images for matched homeowners | Supabase Storage (bucket: feature-images) |
| Website | Public-facing visualizations | Next.js, Tailwind, Shadcn UI (Phase 3) |

## Database Schema

See [schema.sql](schema.sql) for full SQL definitions.

| Table | Phase | Purpose |
|-------|-------|---------|
| `issues` | 1 | One row per magazine issue (month, year, cover) |
| `features` | 1 | One row per featured home (homeowner, designer, location, article_author, etc.) |
| `epstein_persons` | 2 | Unique individuals from Epstein files |
| `epstein_references` | 2 | Each mention of a person (document, context, URL) |
| `matches` | 2 | Links AD features to Epstein persons with confidence scoring |
| `black_book_matches` | 2 | Links AD features to Epstein's Little Black Book entries |
| `feature_images` | 2 | Article page images for matched homeowners (stored in Supabase Storage) |

## Key Decisions

### Resolved
- **Database:** Supabase (PostgreSQL) — shared across all phases
- **Image storage:** Supabase Storage — only for Epstein-matched homeowners
- **Vision API:** Claude Sonnet (`claude-sonnet-4-5-20250929`) via Anthropic SDK — migrated from Gemini 2.0 Flash for significantly better extraction quality
- **Investigation AI:** Claude Haiku (`claude-haiku-4-5-20251001`) for Researcher dossier analysis — fast and cost-effective for structured analysis
- **PDF source (primary):** Internet Archive (~50 issues available)
- **PDF processing:** pdftoppm at 150 DPI for page-to-image conversion
- **Epstein search (primary):** Playwright browser automation on justice.gov/epstein
- **Epstein search (secondary):** Text search of Little Black Book (extracted via pdftotext)
- **Verdict system:** 5-level (`confirmed_match` → `needs_review`) with combined BB+DOJ evidence
- **Agent architecture:** 7 specialized agents with async work loops, shared base class, skills system
- **Frontend:** Next.js (App Router), Tailwind CSS, Shadcn UI (Phase 3)

### Pending
- Additional PDF sources beyond archive.org
- Hosting platform for the website
- Phase 2 Supabase tables (currently using disk-based JSON for cross-reference results and dossiers)
