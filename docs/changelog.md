# Changelog

All notable changes to this project will be documented in this file. This changelog should be automatically updated with each commit or major milestone.

Format: entries are grouped by date, with the most recent at the top.

---

## 2026-02-09 (Session 8)

### Changed — Hub-and-Spoke Architecture: Editor as Central Coordinator
- **Major architectural redesign**: Editor is now the central coordinator using asyncio.Queue task system
- **New file `src/agents/tasks.py`**: `Task`, `TaskResult` dataclasses + `EditorLedger` for centralized failure tracking
- **Base class (`src/agents/base.py`)**: Added `inbox`/`outbox` asyncio.Queue per agent, `execute(task)` method, watchdog timer (warns if inbox empty >120s)
- **Editor rewrite (`src/agents/editor.py`)**: Coordinator loop with 3 timing tiers:
  - Every 5s: collect results from all outboxes, validate, commit to Supabase
  - Every 30s: plan and assign tasks (rule-based gap analysis, not LLM)
  - Every 5min: strategic LLM assessment + human message processing
- **Quality gating moved to Editor**: Reader no longer decides load/hold — Editor applies quality gate on extraction results
- **EditorLedger (`data/editor_ledger.json`)**: Centralized failure tracking replaces scattered per-agent escalation files

### Changed — Scout Agent
- Added `execute()` for `discover_issues` and `fix_dates` task types
- **Built-in archive.org API search** (direct HTTP `requests.get()`) — no LLM needed for basic discovery
- Three-tier search strategy: archive.org API → Claude CLI → report not_found
- Fix_dates priority set to LOW (3) — no longer blocks discovery (was the main pipeline bottleneck)
- Legacy `work()` still available as fallback when no task assigned

### Changed — Courier Agent
- Added `execute()` for `download_pdf` task type
- Builds issue dict from task params, delegates to existing download logic
- Returns structured result with `pdf_path` and `pages` on success

### Changed — Reader Agent
- Added `execute()` for `extract_features` and `reextract_features` task types
- Returns features + quality_metrics to Editor for quality gating
- Editor decides whether to load into Supabase (not Reader)

### Changed — Detective + Researcher Agents
- Both get `execute()` for targeted tasks from Editor (`cross_reference` / `investigate_lead`)
- Legacy `work()` still runs when no task assigned — these agents are largely self-managing

### Changed — Orchestrator + Status
- `src/orchestrator.py`: Added Editor task board to `status.json` output
- `src/agent_status.py`: Updated TOTAL_EXPECTED_ISSUES from 444 to 456 (1988-2025)

### Architecture
- **What vs How separation**: Editor decides WHAT needs doing (gap analysis, priority), agents decide HOW to do it (search strategies, retry logic)
- **Only Editor writes pipeline state to Supabase** — agents can still READ for context
- **Agent watchdog**: if inbox empty >120s, agent logs warning and continues with `work()` fallback
- **No breaking changes**: All agents still have `work()` loop, so the system degrades gracefully if Editor stops assigning tasks

---

## 2026-02-09 (Session 7)

### Changed — Pipeline Source of Truth: Manifest → Supabase
- **Migrated all agents from `archive_manifest.json` to Supabase `issues` table as single source of truth**
- Created `src/db.py` — shared DB module with singleton Supabase client and all issue/feature CRUD functions
- Added 14 pipeline tracking columns to `issues` table: `identifier`, `status`, `pdf_path`, `source`, `verified_month`, `verified_year`, `date_confidence`, `needs_review`, etc.
- Created `src/migrate_manifest_to_supabase.py` — one-time migration script (92 issues migrated, 72 pre-1988 removed)
- Updated all 7 agents (Scout, Courier, Reader, Editor, Detective, Researcher, Designer) to use `db.py` instead of manifest
- Updated `src/agent_status.py` — all stats now come from Supabase
- Updated `src/pipeline.py` — `status` command reads from Supabase
- Updated `src/extract_features.py` and `src/load_features.py` — use `db.py` imports
- Removed `read_manifest()` and `update_manifest_locked()` from `src/agents/base.py`
- Scout now covers all issues through December 2025 (456 expected total) plus monitors for new monthly issues
- Updated `docs/schema.sql` with full issues table definition including pipeline columns

---

## 2026-02-09 (Session 6)

### Fixed — Researcher Agent (3 bugs)
- **NoneType crash**: `black_book_matches` was `null` in results.json, causing `'NoneType' object is not iterable` when iterating. Fixed with `match.get("black_book_matches") or []`
- **Supabase key**: Was using `SUPABASE_KEY` (doesn't exist) instead of `SUPABASE_ANON_KEY` in both `_find_ad_context()` and `_fetch_features_batch()`
- **JSON parsing**: Increased `max_tokens` from 2048 to 4096, added brace-counting JSON extraction fallback for truncated Haiku responses

### Fixed — Reader Agent (2 bugs)
- **413 infinite loop**: Re-extraction crashes (413 Request Too Large) were uncaught, leaving queue items as "pending" forever. Added try/except in `_run_reextraction()` that marks items as failed on crash
- **Pre-1988 crash loop**: Hardened `pdf_to_images()` and Reader's `work()` with try/except around subprocess/extraction calls

### Fixed — Editor Agent (3 issues)
- **Unauthorized verdict overrides**: Editor was dismissing detective leads (7 names including a BB match) before Researcher could investigate. Added explicit prompt restriction: only override verdicts when human instructs or Researcher rates COINCIDENCE
- **Over-frequent Haiku calls**: Added minimum cooldowns — 30s for escalations, 90s for milestones, instant for human messages
- **Quality report wrong path**: `_build_quality_report()` was looking in wrong directory. Fixed to read correct extraction path AND check Supabase for NULL homeowners

### Changed — Dashboard Stats (Supabase-backed)
- "Downloaded" → "Downloaded Issues" (now includes both `downloaded` + `extracted` manifest statuses = all issues with PDFs)
- "Extracted" → "Extracted Issues" (pulls distinct issue count from Supabase, not local JSON)
- "Features" now pulls total count from Supabase (source of truth)
- Added "Confirmed" stat showing HIGH + MEDIUM connection strength dossier count
- Right-click context menu on "Confirmed" stat shows names, strength, and rationale

### Changed — Dashboard Editor Behavior
- Editor sprite no longer walks to each agent saying "Report?" on every assessment (looked like soliciting)
- Instead: Editor stays at desk during routine assessments, shows "thinking" pose
- Event-driven visits: dashboard detects agent state changes (new task, error, status change) and queues editor visits to specific agents
- `editorGatherReports()` now includes collab-glow on both editor and visited agent, with 90s cooldown
- Behavior timer shortens (5-10s) when agents need attention, lengthens (35-55s) when idle

### Changed — Notable Finds
- Filters out names checked as `no_match` by Detective
- Shows xref verdict status (likely_match, confirmed_match, etc.) with colored badges
- Shows research status: "queued", "investigating", "dossier_complete" with animated indicators
- Orchestrator overlays Researcher's live task for real-time "investigating" status

### Progress
- **Researcher operational**: First-ever dossier built (Yves Vidal → COINCIDENCE). 6 total dossiers built
- **2 confirmed associates**: William Randolph Hearst (MEDIUM), Henri Samuel (MEDIUM — Black Book match)
- **4 false positives dismissed**: Yves Vidal, Fernando Botero, Jiří Mucha, Botero (all COINCIDENCE)
- **Pipeline stats**: 164 discovered → 80 downloaded → 15 extracted → 87 features in Supabase

---

## 2026-02-08 (Session 5)

### Added — Multi-Agent System
- Built full autonomous agent framework with 7 specialized agents:
  - **Scout** (`src/agents/scout.py`) — Discovers AD issues on archive.org
  - **Courier** (`src/agents/courier.py`) — Downloads PDFs
  - **Reader** (`src/agents/reader.py`) — Extracts homeowner data via Claude Sonnet
  - **Detective** (`src/agents/detective.py`) — Cross-references names against Epstein records (BB + DOJ two-pass)
  - **Researcher** (`src/agents/researcher.py`) — Builds dossiers on Epstein-linked leads using Claude Haiku
  - **Editor** (`src/agents/editor.py`) — Monitors pipeline health, processes human messages, escalations
  - **Designer** (`src/agents/designer.py`) — Learns design patterns from training sources
- **Agent base class** (`src/agents/base.py`) — Async work loop, pause/resume, progress tracking, skills loading, dashboard status reporting
- **Orchestrator** (`src/orchestrator.py`) — Launches all agents, merges live status into `status.json`, processes pause/resume commands
- **Dashboard server** (`src/dashboard_server.py`) — HTTP server for Agent Office (inbox API, agent commands, skills editing)
- **DOJ search module** (`src/doj_search.py`) — Playwright-based DOJ Epstein Library search with WAF bypass, bot check handling, age gate
- **Agent skills** (`src/agents/skills/*.md`) — Per-agent personality, methodology, and behavior documentation

### Added — Researcher Home Analysis
- Enhanced Researcher Haiku prompt with home-as-evidence analysis: design style, cost/size, designer choice, location, and temporal relevance to Epstein's active period (1990-2008)
- New `home_analysis` section in dossier JSON schema with 4 fields: `wealth_indicators`, `social_circle_clues`, `style_significance`, `temporal_relevance`
- Updated `src/agents/skills/researcher.md` with Home Analysis methodology section
- Added home-based pattern upgrade factors to connection strength guide (Epstein enclaves, shared designers, UHNW signals)

### Added — Researcher Per-Name Failure Tracking
- `MAX_INVESTIGATION_FAILURES = 3` — names that fail investigation 3 times are skipped, preventing infinite API quota burn
- Failure counts tracked in `researcher_log.json` (was already written, now enforced in `_find_uninvestigated_leads()`)

### Added — Article Author Extraction
- `article_author` field added to `EXTRACT_PROMPT` in `src/extract_features.py` — extracts journalist byline
- `article_author` added to `FEATURE_FIELDS` in `src/load_features.py`
- `article_author TEXT` column added to `docs/schema.sql` and live Supabase `features` table

### Fixed — Agent Office Dashboard Real-Time Gaps
- **Speech bubbles now show live tasks**: Changed to prefer `liveTask` (real-time agent action from orchestrator) over `message` (stale disk summary) — e.g., "Downloading: AD Nov 2013" instead of "18 PDFs ready"
- **Cycle counts + progress in nametags**: Agent desk labels now show runtime stats like `12 cycles · 164/444` in a smaller sub-line
- **Error tooltip on hover**: Hovering the `!` error badge now shows the `last_error` message in a red tooltip (was badge-only, no details)
- **Error details propagated**: `data-error` attribute set from `last_error` field for tooltip content

### Changed
- Detective verdict system: `confirmed_match` / `likely_match` / `possible_match` / `no_match` / `needs_review` with confidence scores
- Researcher pattern analysis: cross-lead correlations (shared designers, location clusters, style trends, temporal patterns)

---

## 2026-02-08 (Session 4)

### Added — Agent Office Horizontal Dashboard Redesign
- Restructured `tools/agent-office/agent-office.html` from vertical layout to 3-column CSS Grid dashboard (left panel, center office scene, right panel)
- **Left panel:** Pipeline funnel visualization, queue depth indicators, "Now Processing" per-agent status
- **Right panel:** Activity log with agent filter buttons, Notable Finds (celebrities + Epstein matches), Data Quality progress bars
- **Top bar:** Horizontal stats strip (Discovered, Downloaded, Extracted, Features, Matches)
- Fixed 1920x1080 design with JS `transform: scale()` for uniform viewport scaling
- New rendering functions: `renderPipeline()`, `renderQueueDepths()`, `renderNowProcessing()`, `renderLogWithFilters()`, `renderNotableFinds()`, `renderQuality()`, `renderTopStats()`
- Extended `DEMO_DATA` with all new dashboard fields

### Added — Agent Status Adapter Expansion (`src/agent_status.py`)
- 5 new builder functions: `build_pipeline()`, `build_queue_depths()`, `build_now_processing()`, `build_notable_finds()`, `build_quality()`
- `read_extractions()` now returns `feature_list` with full homeowner details for Notable Finds
- `CELEBRITY_NAMES` list for tagging celebrity homeowners in extraction data

### Added — Pixel Art Visual Depth System
- 7-layer z-index system for isometric depth: back desks → back agents → front desks → front agents → collab lines → UI
- CSS `::after` pseudo-element shadows under each agent (radial gradient ellipse)
- Reader and Detective agents render above all other layers for front-row depth
- Swapped office background to `bg-office-clear-new.png` for brighter palette
- Adjusted Scout/Courier positions down 5% to avoid wall overlap

### Changed
- Font sizes increased across all dashboard panels (5-7px → 7-9px) for readability
- Panel padding increased from 12px to 16px
- Grid proportions: `1.2fr 2fr 1.3fr` for wider side panels

---

## 2026-02-07 (Session 3)

### Changed — Extraction Engine: Gemini → Claude Sonnet
- Migrated `src/extract_features.py` from Gemini 2.0 Flash to Claude Sonnet (`claude-sonnet-4-5-20250929`) for significantly better extraction quality
- Replaced `google.genai` SDK with `anthropic` SDK (v0.79.0)
- New image encoding: base64 content blocks instead of `types.Part.from_bytes()`
- New API call function: `call_claude_with_retry()` with exponential backoff for rate limits and overloaded errors
- Updated all callers: `verify_date()`, `find_articles_from_toc()`, `detect_page_offset()`, `_call_extraction()`

### Added — Extraction Quality Improvements
- **Auto page offset detection** (`detect_page_offset()`): Samples interior pages (20, 30, 50) to auto-detect the offset between PDF page numbers and printed magazine page numbers
- **Expanded TOC scanning**: Now reads pages 1-20 (was 1-12) to catch TOCs deeper in the magazine
- **Nearby-page retry**: When homeowner_name comes back NULL, retries with expanded range (±3 pages around target)
- **3 pages per article** (was 2) for better context
- **Minimum features threshold**: `MIN_FEATURES_PER_ISSUE = 3` — if fewer features found from TOC, supplements with page scanning (every 8 pages)
- **`--reextract` CLI flag**: Re-processes issues with NULL homeowners or too few features
- **`find_issues_needing_reextraction()`**: Replaces `find_issues_with_nulls()`, catches both NULLs and under-extracted issues
- **TOC prompt improvements**: More inclusive (includes "AD Visits"), notes typical issue has 4-8 features
- **String "null" cleanup**: Converts "null"/"None" strings to actual None in extracted data

### Added — Cross-Reference Engine (`src/cross_reference.py`)
- Built automated cross-reference engine for batch processing all extracted names
- Word-boundary matching (`re.search(r'\b' + re.escape(term) + r'\b', ...)`) prevents false positives (Bush≠Bushnell, Sultana≠Sultanate)
- Minimum 5-char last name for `last_name_only` matches
- Strips "and others", "et al" from compound names
- Individual word checking against SKIP_NAMES list
- Searches both DOJ Epstein Library (Playwright) and Little Black Book (text grep)

### Fixed
- NULL extraction results reduced from 9 to 5 across all issues (via expanded TOC, auto offset, nearby-page retry)
- Cross-reference false positives eliminated: Bush/Bushnell, Sultana/Sultanate, "brothers"/"others", "Kevin and Nicole" (no last name)
- Under-extracted issues (Oct 2019, Nov 2019, Jul/Aug 2020 had only 1 feature each) — addressed with MIN_FEATURES and supplemental scanning

### Progress
- 32 PDFs downloaded from archive.org (16 post-1988 usable, 16 pre-1925 skipped)
- 15 issues extracted with homeowner data
- Cross-reference results: Miranda Brooks is the only real Black Book match so far

---

## 2026-02-07 (Session 2)

### Added — PDF Ingestion Pipeline
- Built complete 4-step pipeline for processing AD issues from Internet Archive:
  - `src/archive_discovery.py` — Queries archive.org API, finds 163 AD items, parses month/year from titles and identifiers
  - `src/archive_download.py` — Downloads PDFs with rate limiting, resume support, newest-first sorting
  - `src/extract_features.py` — Converts PDF pages to images via pdftoppm, sends to Gemini 2.0 Flash Vision API for structured data extraction (TOC analysis + article-level extraction)
  - `src/load_features.py` — Loads extracted JSON into Supabase with duplicate detection
- Built `src/pipeline.py` orchestrator with CLI commands: `discover`, `download`, `extract`, `load`, `run`, `status`
- Generated `data/archive_manifest.json` with 163 discovered issues (141 with month/year parsed)

### Added — Custom Agents (Slash Commands)
- `/epstein-search <name>` — Searches DOJ Epstein Library via Playwright MCP with confidence scoring (HIGH/MEDIUM/LOW/NONE)
- `/black-book-search <name>` — Searches Epstein's Little Black Book text file (extracted from PDF via pdftotext)
- `/update-docs-and-commit` — Updates project docs before committing

### Changed
- Migrated Gemini SDK from deprecated `google.generativeai` to new `google.genai` package
- Extraction uses inline image passing (`types.Part.from_bytes()`) instead of file uploads to avoid quota issues
- Added exponential backoff retry logic for Gemini API rate limits (5 retries, 15s → 240s)
- Enabled Gemini API billing for higher quotas

### Database
- Updated `matches` table schema: replaced `confidence_score NUMERIC` with `confidence TEXT` (high/medium/low), added `confidence_rationale`, `needs_manual_review`, `manually_confirmed`, `total_doj_results`
- Added `black_book_matches` table design (commented out, Phase 2)

### Tested
- Pipeline end-to-end: Downloaded AD Jul/Aug 2020 (41MB), extracted 3 featured homes via Gemini Vision, loaded into Supabase
- Batch tested May 2013 homeowner names against DOJ Epstein Library — only false positives found (Peter Rogers = contractor invoices)
- Tested Black Book search — no May 2013 homeowners found; verified search works (e.g., Trump entries present)
- Extracted `data/black_book.txt` from Little Black Book PDF (19,547 lines)

---

## 2026-02-07 (Session 1)

### Added
- Project initialized with folder structure (`src/`, `docs/`, `tests/`, `data/`)
- Created CLAUDE.md with project overview, data model, phases, repository etiquette, design style guide, constraints & policies, documentation references, and personal learning goals (MCP servers, multi-agent AI, beginner-friendly teaching)
- Created `.env` with Supabase credentials and placeholder API keys
- Created `.gitignore` (excludes `.env`, `data/`, Python cache, IDE files)
- Connected local repo to GitHub (`johnhlocke/AD-Epstein-Index`)
- Created documentation files: `project_spec.md`, `docs/architecture.md`, `docs/changelog.md`, `docs/project_status.md`, `docs/schema.sql`, `docs/schema_feature_images.sql`
- Installed poppler for PDF rendering, Node.js, Playwright browser

### Database
- Set up Supabase project (PostgreSQL)
- Created `issues`, `features`, and `feature_images` tables
- Created Supabase Storage bucket `feature-images` (public, for matched homeowner images only)
- Seeded May 2013 data: 1 issue + 8 features via `src/seed_may_2013.py`

### Proof of Concept
- Extracted 8 featured homes from AD May 2013 via PDF-to-image pipeline (pdftoppm → visual reading)
- Confirmed feasibility: can accurately read homeowner names, designers, locations from scanned magazine PDFs

### Epstein Data Source Evaluation
- Downloaded LMSBAND/epstein-files-db (835MB SQLite) to `data/epstein_db/`
- Tested accuracy: "Larry Summers" returned 17 files in LMSBAND vs. 5,635 results on justice.gov
- Conclusion: LMSBAND database is incomplete — cannot be primary cross-reference source
- Configured Playwright MCP server in `.claude.json` to enable direct browser searching of justice.gov (requires Claude Code restart to activate)
