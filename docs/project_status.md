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
| Build multi-agent autonomous system (7 agents + orchestrator) | Tooling | Done |
| Build Agent Office dashboard (pixel art + data panels) | Tooling | Done |
| Add article author (byline) extraction | Phase 1 | Done |
| Researcher: home analysis + failure tracking | Phase 2 | Done |
| Agent Office real-time status fixes | Tooling | Done |
| Researcher: dossier building + false positive detection | Phase 2 | Done |
| Dashboard: Supabase-backed stats + confirmed associates | Tooling | Done |
| Editor: event-driven behavior + verdict restrictions | Tooling | Done |
| Migrate pipeline source of truth: manifest → Supabase | Tooling | Done |
| Hub-and-spoke architecture: Editor as central coordinator | Tooling | Done |
| Dashboard: Editor's Board, coverage map, ledger visibility | Tooling | Done |
| Editor: event-driven architecture (replaces polling loop) | Tooling | Done |
| Editor as gatekeeper for Researcher dossiers | Phase 2 | Done |
| Editor-directed Detective & Researcher flow | Tooling | Done |
| LLM-powered problem solving for all agents | Tooling | Done |
| Agent personalities: names and idle chatter | Tooling | Done |
| Episodic memory (ONNX embeddings + vector recall) | Tooling | Done |
| Reflection loops (periodic self-assessment) | Tooling | Done |
| Batch process all archive.org issues (~50 PDFs) | Phase 1 | In Progress |
| Source additional AD issues (beyond archive.org) | Phase 1 | Not Started |
| Build cross-reference engine | Phase 2 | Done |
| Batch cross-reference all extracted names | Phase 2 | In Progress |
| Build dossiers on Epstein-linked leads | Phase 2 | In Progress |
| Build interactive website | Phase 3 | Done |
| Deploy website publicly | Phase 3 | Ready to Deploy |
| Designer agent → spec generator | Tooling | Done |

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
- `article_author` column added to `features` table for journalist byline extraction
- Seeded May 2013 data: 1 issue + 8 features via `src/seed_may_2013.py`

**PDF Ingestion Pipeline (Internet Archive):**
- Built complete 4-step pipeline: `discover` → `download` → `extract` → `load`
- `src/archive_discovery.py` — Found 163 AD items on archive.org, parsed month/year for 141
- `src/archive_download.py` — Downloads PDFs with rate limiting, resume support, newest-first sorting
- `src/extract_features.py` — Claude Sonnet Vision API extracts TOC articles then homeowner data from each article page (migrated from Gemini 2.0 Flash for better quality). Now also extracts `article_author` (byline).
- `src/load_features.py` — Loads extracted JSON into Supabase with duplicate detection
- `src/pipeline.py` — CLI orchestrator (`discover`, `download`, `extract`, `load`, `run`, `status`)
- Pipeline tested end-to-end on 15+ issues
- Extraction quality improvements: auto page offset detection, expanded TOC scanning (1-20 pages), nearby-page retry for NULLs, minimum 3 features per issue threshold, supplemental page scanning
- 80 PDFs downloaded from archive.org (15 extracted into Supabase, 61 skipped pre-1988)

### Phase 2: Epstein Cross-Reference

**DOJ Epstein Library:**
- Downloaded LMSBAND/epstein-files-db (835MB SQLite) — tested and found incomplete vs. justice.gov
- Built `/epstein-search` agent: Playwright-based browser search of justice.gov/epstein with confidence scoring (HIGH/MEDIUM/LOW/NONE)
- `src/doj_search.py` — Standalone DOJ search module with WAF bypass (headless=false, off-screen window), bot check handling, age gate
- Batch tested May 2013 homeowner names — only false positives found (Peter Rogers = contractor invoices)

**Epstein's Little Black Book:**
- Extracted text from PDF to `data/black_book.txt` (19,547 lines, 2004-2005 contact directory)
- Built `/black-book-search` agent: Grep-based search with multiple name variations
- Tested against May 2013 homeowners — no matches found

**Cross-Reference Engine (`src/cross_reference.py`):**
- Automated batch cross-referencing of all extracted homeowner names against DOJ Epstein Library and Little Black Book
- Word-boundary matching prevents false positives (e.g., Bush≠Bushnell)
- Detective two-pass system: BB (instant, local) → DOJ (batched, browser) with combined verdicts
- Verdict system: `confirmed_match` / `likely_match` / `possible_match` / `no_match` / `needs_review`
- Miranda Brooks and Henri Samuel are Black Book matches
- Researcher dossiers: 6 built, 2 confirmed associates (Hearst, Samuel), 4 false positives dismissed (Vidal, Botero, Mucha)

**Researcher Dossier System:**
- Researcher agent builds thorough dossiers on all flagged leads using Claude Haiku
- Pattern analysis across all Epstein-associated names: shared designers, location clusters, style correlations, temporal patterns
- Home analysis: cost, location, designer choice, and design style as evidence of social circles and wealth level
- Connection strength rating: HIGH / MEDIUM / LOW / COINCIDENCE with explicit rationale
- Per-name failure tracking (`MAX_INVESTIGATION_FAILURES = 3`) prevents infinite API quota burn on consistently failing names
- Escalation system: HIGH findings and notable patterns escalated to Editor
- **Editor gatekeeper**: Every dossier goes through Editor review before becoming final. COINCIDENCE auto-rejected (free), HIGH/MEDIUM/LOW reviewed by Sonnet (~$0.005/review). Dossiers saved as PENDING_REVIEW until Editor confirms or rejects.

**Database schema updates:**
- `matches` table: confidence scoring (high/medium/low) with rationale and manual review flags
- `black_book_matches` table designed (commented out, for Phase 2 activation)

### Multi-Agent Autonomous System

Built a 7-agent autonomous pipeline that runs continuously:

| Agent | Role | Key Capabilities |
|-------|------|------------------|
| **Scout** | Discovers AD issues on archive.org | Multi-strategy discovery, date fixing, retry logic |
| **Courier** | Downloads PDFs | Rate limiting, resume support, priority sorting |
| **Reader** | Extracts homeowner data | Claude Sonnet Vision, TOC analysis, retry for NULLs |
| **Detective** | Cross-references names | BB search + DOJ browser search, combined verdicts |
| **Researcher** | Builds dossiers | Claude Haiku analysis, pattern detection, home analysis |
| **Editor** | Pipeline oversight | Health monitoring, human message processing, escalations |
| **Designer** | Learns design patterns | Training from design sources, pattern cataloging |

**Infrastructure (Hub-and-Spoke):**
- `src/agents/tasks.py` — Task/TaskResult dataclasses, EditorLedger for centralized failure tracking
- `src/agents/base.py` — Async work loop with inbox/outbox asyncio.Queue, execute() for task-driven work, watchdog timer
- `src/agents/editor.py` — Central coordinator with event-driven architecture: blocks on unified event queue instead of polling. 4 producer tasks (outbox forwarder, message watcher, planning/strategic heartbeats) feed events. Human messages detected in <2s (was 300s), agent results in <0.5s (was 5s).
- `src/db.py` — Shared DB module (singleton Supabase client, issue/feature CRUD). All agents import from here — Supabase `issues` table is the single source of truth
- `src/orchestrator.py` — Launches all agents, wires Editor with worker references, merges live status + task board into `status.json`
- `src/dashboard_server.py` — HTTP server: inbox API, agent pause/resume, skills editing
- `src/agents/skills/*.md` — Per-agent personality, methodology, and behavior documentation

**Agent Intelligence:**
- **LLM-powered problem solving** — Every agent has `problem_solve()` that uses Haiku to diagnose errors and choose recovery strategies (not hardcoded retry). 14 locations across all 7 agents.
- **Editor-directed Detective flow** — Editor routes features through Detective (YES/NO verdict) and Researcher (dossier), replacing self-managing queries. Binary verdicts stored on `features` table.
- **Agent personalities** — Each agent has a character name (Arthur, Casey, Elias, Silas, Elena, Miranda) chosen via Gemini Vision analysis of their pixel sprites
- **Idle chatter** — Agents generate personality-driven idle thoughts via Haiku when waiting for work (replaces static "Waiting for assignment...")

### Phase 3: Interactive Website

Built a Next.js visualization website (`web/`) with real-time Supabase data:

**Tech stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Shadcn UI, Recharts

**Pages & Routes:**
- Landing page with 10 sections: Hero, Key Findings, Coverage Heatmap, Features Timeline, Style Distribution, Geographic Treemap, Verdict Breakdown, Searchable Index, Methodology
- Dossier detail pages (`/dossier/[id]`) with evidence sections, verdict badges, article images
- API routes: `/api/stats`, `/api/features` (paginated + filterable), `/api/dossiers`, `/api/dossiers/[id]`

**Design:**
- Editorial/investigative journalism aesthetic (ProPublica-inspired)
- Playfair Display (headlines), Inter (body), JetBrains Mono (data)
- Warm copper accent (#B87333), off-white background (#FAFAFA)
- Verdict colors: green (confirmed), muted red (rejected), amber (pending)

**Data:**
- Server-side only Supabase access (no client-exposed keys)
- Coverage heatmap: year x month grid (1988-2025) color-coded by pipeline status
- Searchable index: debounced text search, year/style/location filters, URL-based state
- Charts: Recharts for bar/pie/treemap, custom CSS Grid for heatmap

**Designer Agent Evolution:**
- `src/agents/designer.py` rewritten: `_creation_cycle()` now generates JSON design specs
- New task type: `generate_design_spec` with spec_type param (tokens, landing-page, dossier-detail, search-index)
- Specs written to `web/design-specs/*.json`, TaskResult pushed to Editor
- Auto-regeneration of stale specs (>24h old)

### Tooling: Agent Office Dashboard
- Built pixel-art Agent Office visualization (`tools/agent-office/agent-office.html`) showing all 7 pipeline agents working at their desks
- Redesigned to 3-column horizontal layout: left panel (pipeline funnel, queues, now processing), center (pixel-art office scene), right panel (activity log, notable finds, data quality)
- `src/agent_status.py` generates `status.json` from live pipeline data (manifest, extractions, cross-references)
- Fixed 1920x1080 design with JS scaling for any viewport
- 7-layer depth system with agent shadows for isometric visual depth
- Real-time status: speech bubbles show live agent tasks, nametags show cycle counts + progress numbers
- Error tooltips: hovering error badge shows `last_error` message
- Activity log with per-agent filter buttons
- Notable Finds highlights celebrities and Epstein matches
- Data Quality bars show field completion rates across all extractions
- Throughput metrics, API cost tracking, collaboration animations
- Editor's Board chalkboard: shows EditorLedger failures (stuck items retrying, exhausted items gave up) instead of all agent tasks
- Discovery Coverage Map: 38yr x 12mo grid showing pipeline status per issue (discovered/downloaded/extracted/missing)
- EditorLedger visibility: `read_editor_ledger()` surfaces failure counts, stuck items, and exhausted retries
- Agent waiting sprites: front-facing idle poses for all workers when no task assigned
- Editor sprite variants: clipboard (reviewing), failure (concerned), studying (reading)

## 3. What's Next

**Immediate — Agent Intelligence Upgrades:**
- ~~Implement episodic memory~~ **Done** (ONNX all-MiniLM-L6-v2, 384-dim, JSON-backed)
- ~~Add reflection loops~~ **Done** (10-min periodic self-assessment via Haiku)
- Implement self-improvement (agents propose changes to their skills files)
- Implement planning/lookahead (Editor models task difficulty and optimizes scheduling)
- Implement curiosity (agents explore patterns when idle)
- Fix Courier `work()` bug (`'NoneType' object has no attribute 'get'`)

**Ongoing — Scale the Pipeline:**
- Run the multi-agent orchestrator to batch-process remaining archive.org issues
- Review Researcher dossiers and manually confirm/reject matches
- Download remaining archive.org PDFs (~35 more post-1988 issues)

**Phase 1 — Complete the AD Database:**
- Source additional AD issues beyond archive.org (eBay scans, library digitizations, other archives)
- Quality review: validate extracted data, fill in missing fields
- Re-extract older issues to populate `article_author` field

**Phase 2 — Cross-Reference at Scale:**
- Complete dossier building for all flagged leads
- Manual review of HIGH and MEDIUM connection strength dossiers
- Store final match results in Supabase

**Phase 3 — Interactive Website:**
- ~~Design and build public-facing visualization website~~ **Done**
- ~~Searchable index, interactive timelines, trend analysis~~ **Done**
- ~~Dossier viewer for Epstein-linked leads~~ **Done**
- Deploy to Vercel (`cd web && vercel --prod`)
- Get service role key from Supabase dashboard and set in Vercel env vars
