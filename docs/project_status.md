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
| Self-improvement proposals (agent methodology feedback) | Tooling | Done |
| Planning/Lookahead (memory-informed task priority) | Tooling | Done |
| Curiosity (cross-agent pattern exploration) | Tooling | Done |
| World model (structured pipeline state awareness) | Tooling | Done |
| Inter-agent communication (bulletin board) | Tooling | Done |
| Memory feedback loop (briefing + learning + reflection rules) | Tooling | Done |
| Cross-references → Supabase (full xref data, not just binary) | Tooling | Done |
| AD Archive direct HTTP scraper (JWT + Anthropic API) | Phase 1 | Done |
| AD Archive issue discovery (100% coverage: 456/456) | Phase 1 | Done |
| Data reset + pipeline rebuild from scratch | Tooling | Done (Run 4) |
| Researcher jumping sprite (confirmed match celebration) | Tooling | Done |
| Scout three-tier discovery (AD Archive → archive.org → CLI) | Phase 1 | Done |
| Editor Sonnet/Opus model split (cost optimization) | Tooling | Done |
| Bug fixes: db retry, xref atomicity, cost tracking, cascade | Tooling | Done |
| Fix verdict pipeline (4 bugs: precedence, scope, prompt, DOJ retry) | Tooling | Done |
| Fix Miranda inbox (human messages not visible) | Tooling | Done |
| Miranda cost optimization (Opus gate tightened) | Tooling | Done |
| Batch process all archive.org issues (~57 PDFs extracted) | Phase 1 | Done |
| Batch scrape AD Archive issues | Phase 1 | Done |
| Investigation policy: BB=confirmed, no fame dismissal | Phase 2 | Done |
| Fix Detective BB match verdict bug | Tooling | Done |
| Build cross-reference engine | Phase 2 | Done |
| Batch cross-reference all extracted names | Phase 2 | Done |
| Build dossiers on Epstein-linked leads | Phase 2 | Done |
| Full pipeline audit (all gaps resolved) | Phase 2 | Done |
| Build interactive website | Phase 3 | Done |
| Neo4j knowledge graph (graph_db + sync_graph) | Phase 3.5 | Done |
| Connection Explorer web page (force-graph viz) | Phase 3.5 | Done |
| Graph analytics (NetworkX: communities, centrality) | Phase 3.5 | Done |
| Researcher graph integration (Elena uses analytics) | Phase 3.5 | Done |
| Elena dynamic Cypher query generation | Phase 3.5 | Done |
| Agent Office embedded knowledge graph | Tooling | Done |
| Courier deep scraping (Azure Blob page images) | Phase 1 | Done |
| Miranda speech system overhaul (LLM-driven sprite speech) | Tooling | Done |
| Deploy website publicly | Phase 3 | Done |
| Designer agent → spec generator | Tooling | Done |
| Watercooler conversations (agent-to-agent dialogue) | Tooling | Done |
| Newsroom Chatter panel (bulletin board + watercooler) | Tooling | Done |
| Agent-colored speech bubbles | Tooling | Done |
| Fix Miranda inbox reply threading | Tooling | Done |
| Emotionally reactive agent speech (LLM-driven) | Tooling | Done |
| Miranda sprite state expansion (6 states) | Tooling | Done |
| Miranda vocal management (barking orders + encouragement) | Tooling | Done |
| Graph export optimization (lead-only subgraph) | Tooling | Done |
| Sonnet re-extraction of Anonymous features | Phase 1 | Done |
| Episodic memory cap increase (2K → 10K) | Tooling | Done |
| Fix KeyError 'successes' in Editor tracker | Tooling | Done |
| Fix Supabase 1000-row pagination | Tooling | Done |
| Agent done sprite state (extended idle detection) | Tooling | Done |
| Skills modal fallback (no dashboard server) | Tooling | Done |
| Non-home feature cleanup (457 + 164 = 621 deleted) | Phase 1 | Done |
| Sync graph pagination fix | Tooling | Done |
| Speech bubble persistence fix | Tooling | Done |
| Agent work cycle error fixes (Casey, Arthur) | Tooling | Done |
| Traceback logging in agent error handler | Tooling | Done |
| Cost control toggles (IDLE_LLM_ENABLED, NARRATE_EVENTS) | Tooling | Done |
| Future-date scraping fix (year/month cap) | Tooling | Done |
| Activity log parser traceback filtering | Tooling | Done |
| Website design polish (Sable session) | Phase 3 | Done |
| Hero section redesign (Futura PT, epigraph, stats grid) | Phase 3 | Done |
| Figma design system sync (hero, header, grid alignment) | Phase 3 | Done |
| Logo exploration (They Live Wayfarer concept) | Phase 3 | In Progress |
| 6-dimension aesthetic taxonomy (all features tagged) | Phase 2 | Done (v1 — superseded by v2) |
| Aesthetic comparison: Epstein orbit vs general AD | Phase 2 | Done (v1 — superseded by v2) |
| Deep extract confirmed names (Vision + taxonomy) | Phase 2 | Done |
| 9-axis aesthetic scoring instrument v2 (design) | Phase 2 | Done |
| Feature image backfill (Azure Blob → Supabase Storage) | Phase 2 | Done |
| Spread data ground truth (authoritative page ranges) | Phase 2 | Done |
| Image cross-contamination cleanup (907 wrong images) | Phase 2 | Done |
| Missing page downloads (2,861 pages for 1,032 features) | Phase 2 | Done |
| Opus Vision scoring pipeline (score_features.py) | Phase 2 | Done |
| Run Opus Vision on all ~1,600 features (v2 scoring) | Phase 2 | Done (1,590 scored) |
| Full archive re-extraction (spread data, 2,305 new features) | Phase 1 | Done |
| Opus Vision scoring batch 2 (new features + rescore pre-update) | Phase 2 | Done (3,772/3,772) |
| Subject category extraction for all features | Phase 2 | Done (3,769/3,769) |
| Image backfill for features with 0 images | Phase 2 | Done (73 features) |
| CLAUDE.md modernization (reflect current state) | Docs | Done |
| Methodology section content overhaul (9 sections, citations) | Phase 3 | Done |
| Validation: test-retest reliability (3 runs, N=100) | Phase 2 | Done |
| Validation: human calibration set | Phase 2 | Not Started |
| Aesthetic Methodology section (warm dark-cream, 9-axis radar) | Phase 3 | Done |
| Methodology split (Agent AI + Aesthetic Metric) | Phase 3 | Done |
| Simplified page layout (remove 5 charts, reorder) | Phase 3 | Done |
| Key Finding editorial section | Phase 3 | Done |
| Confirmed Timeline visualization | Phase 3 | Done |
| Methodology section overhaul (dark investigative theme) | Phase 3 | Done |
| Searchable Index: confirmed default, 8 rows, full width | Phase 3 | Done |
| Figma ↔ localhost bidirectional sync | Phase 3 | Done |
| Grid-aligned filter bar (6-col CSS Grid) | Phase 3 | Done |
| Phase 01 Architecture diagram (Figma → SVG) | Phase 3 | Done |
| Aesthetic Radar chart (real data, 6 axes) | Phase 3 | Done |
| Agent idle responsiveness fix (inbox checking) | Tooling | Done |
| Live radar chart in Epstein Aesthetic section | Phase 3 | Done |
| "Full Dossier Created" filter in Searchable Index | Phase 3 | Done |
| Body text solid color + heading size consistency | Phase 3 | Done |
| "What's Next" section + contact email | Phase 3 | Done |
| Subject category classification (profession tags) | Phase 2 | Done |
| Fix Supabase 1000-row pagination in db.py | Tooling | Done |
| Detective subprocess DOJ search (event loop isolation) | Tooling | Done |
| Sankey diagram visual polish (Anonymous rename, padding, on-system colors) | Phase 3 | Done |
| Methodology vertical flow on-system color update | Phase 3 | Done |
| Fix website Supabase 1000-row count (exact count) | Phase 3 | Done |
| Sankey 6-stage funnel + agent attribution labels | Phase 3 | Done |
| Methodology subhead sizing + figure captions | Phase 3 | Done |
| Methodology SVG connectors + Miranda sprite video | Phase 3 | Done |
| Dossier aesthetic radar chart component | Phase 3 | Done |
| Editor inconclusive verdict handling (retry instead of premature NO) | Tooling | Done |
| Deferred graph analytics (unblock Playwright DOJ) | Tooling | Done |
| Event loop threading (graph sync + watercooler) | Tooling | Done |
| Scoring v2.2 — per-axis rationale + scoring clarifications | Phase 2 | Done |
| Fix PostgREST 1000-row year sort data loss | Phase 3 | Done |
| Page jump input for index pagination | Phase 3 | Done |
| Copper dossier tags for confirmed connections | Phase 3 | Done |
| Homepage default sort (year desc) | Phase 3 | Done |
| Designer extraction false positive cleanup (202 features) | Phase 2 | Done |
| Haiku vision designer pass (98 designers found, $0.84) | Phase 2 | Done |
| Category restructuring (Designer→Design, new Art/Media) | Phase 2 | Done |
| Full index page (/fullindex) | Phase 3 | Done |
| Radar chart visual overhaul (colored sectors, group arcs) | Phase 3 | Done |
| Report card redesign (connection status, combined fields) | Phase 3 | Done |
| Confirmed badge copper color | Phase 3 | Done |
| Haiku Vision feature classifier (148 uncertain → 89 keep, 59 delete) | Phase 1 | Done |
| Unmatched feature audit (297 resolved: 164 deleted, 133 kept) | Phase 1 | Done |
| Phase 02 Architecture diagram | Phase 3 | Not Started |
| Phase 03 Architecture diagram | Phase 3 | Not Started |
| Agent Office demo (public deployment) | Tooling | Done |
| Scoring v2.3 (aesthetic_summary, structural overwrite) | Phase 2 | Done |
| Methodology section content expansion (14 paragraphs + sidenotes) | Phase 3 | Done |
| Full-screen Knowledge Graph page (/fullgraph) | Phase 3 | Done |
| Baseline statistical methodology document | Phase 2 | Done |
| Architecture SVG diagrams (hub-spoke, monolithic, decentralized, pipeline) | Phase 3 | Done |
| Scorer mismatch flagging (never auto-overwrite/blank) | Tooling | Done |
| Multi-feature Opus audit (homeowner vs designer verification) | Phase 2 | Done |
| Multi-feature dossier linking (28 orphans → confirmed) | Phase 2 | Done |
| Opus Vision scoring complete (3,772/3,772 at v2.3) | Phase 2 | Done |
| Reliability appendix enrichment (images, insights, headers) | Phase 3 | Done |
| Non-home feature cleanup in test-retest sample (5 swapped) | Phase 2 | Done |
| Test-retest ICC recomputation (100% within ±1) | Phase 2 | Done |
| Inter-model reliability study (Sonnet + Haiku, N=100, ICC analysis) | Phase 2 | Done |
| Construct validation moved to methodology (PCA as Section 5) | Phase 3 | Done |
| `intermodel_scores` Supabase table | Database | Done |
| Case study pipeline traces (state-machine tag chains) | Phase 3 | Done |
| Methodology text: human review distinction, rejection taxonomy, policy rules | Phase 3 | Done |
| Introduction section with Tufte sidenotes (12 notes, source links, diagrams) | Phase 3 | Done |
| Scrolling hero mosaic (192 tiles, CSS animation, copper glow on confirmed) | Phase 3 | Done |
| NASA-style Table of Contents with dot leaders | Phase 3 | Done |
| Abstract redesign (drop cap, 3-column Lora serif, methodology overview) | Phase 3 | Done |
| Textured SVG Venn diagram (halftone + hatching, dynamic data) | Phase 3 | Done |
| Stats grid removed (conveyed through prose instead) | Phase 3 | Done |
| NULL name resolution (862 features → Anonymous) | Phase 1 | Done |
| Wealth origin classification pipeline (research_classify.py) | Phase 2 | In Progress |
| Multi-model Gemini research (3 Flash, 2.5 Pro, 2.5 Flash) | Phase 2 | In Progress |
| Wealth classification methodology doc | Phase 2 | Done |
| Googleable Parent Rule (Forbes score cap) | Phase 2 | Done |
| Pipeline FK error loop fix (orphan features) | Tooling | Done |
| Detective/Editor Anonymous exclusion | Tooling | Done |
| Researcher queue pagination fix (1000-row cap) | Tooling | Done |
| Anonymous features → detective_verdict NO (657) | Database | Done |
| Dossier false negative audit (Couturier, Walters, Bensley, Redford, Askari) | Phase 2 | Done |
| Pipeline audit: all gaps resolved (14 dossiers, 0 unresolved items) | Phase 2 | Done |
| Supabase pagination fix in bulk_crossref + db.py | Tooling | Done |
| Neo4j dossier_id on Person nodes | Phase 3.5 | Done |
| Graph preview: clickable dossier links + source node labels | Phase 3 | Done |

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
| **Scout** | Discovers AD issues | Three-tier: AD Archive HTTP → archive.org API → Claude CLI |
| **Courier** | Downloads PDFs + scrapes AD Archive | Rate limiting, JWT scraping, Anthropic API extraction |
| **Reader** | Extracts homeowner data | Claude Sonnet Vision, TOC analysis, retry for NULLs |
| **Detective** | Cross-references names | BB search + DOJ browser search, combined verdicts |
| **Researcher** | Builds dossiers | Claude Haiku analysis, pattern detection, home analysis |
| **Editor** | Central coordinator | Sonnet (routine) / Opus (human+quality), validates, commits to Supabase |
| **Designer** | Learns design patterns | Training from design sources, pattern cataloging |

**Infrastructure (Hub-and-Spoke):**
- `src/agents/tasks.py` — Task/TaskResult dataclasses, EditorLedger for centralized failure tracking
- `src/agents/base.py` — Async work loop with inbox/outbox asyncio.Queue, execute() for task-driven work, watchdog timer
- `src/agents/editor.py` — Central coordinator with event-driven architecture: blocks on unified event queue instead of polling. 4 producer tasks (outbox forwarder, message watcher, planning/strategic heartbeats) feed events. Human messages detected in <2s (was 300s), agent results in <0.5s (was 5s). Uses Sonnet for routine assessments, Opus for human interaction and quality reviews.
- `src/db.py` — Shared DB module (singleton Supabase client, issue/feature CRUD, retry decorator with exponential backoff). All agents import from here — Supabase `issues` table is the single source of truth
- `src/orchestrator.py` — Launches all agents, wires Editor with worker references, merges live status + task board into `status.json`
- `src/dashboard_server.py` — HTTP server: inbox API, agent pause/resume, skills editing
- `src/agents/skills/*.md` — Per-agent personality, methodology, and behavior documentation

**Agent Intelligence:**
- **LLM-powered problem solving** — Every agent has `problem_solve()` that uses Haiku to diagnose errors and choose recovery strategies (not hardcoded retry). 14 locations across all 7 agents.
- **Editor-directed Detective flow** — Editor routes features through Detective (YES/NO verdict) and Researcher (dossier), replacing self-managing queries. Binary verdicts stored on `features` table.
- **Agent personalities** — Each agent has a character name (Arthur, Casey, Elias, Silas, Elena, Miranda) chosen via Gemini Vision analysis of their pixel sprites
- **Idle chatter** — Agents generate personality-driven idle thoughts via Haiku when waiting for work (replaces static "Waiting for assignment...")
- **Memory feedback loop** — Agents now read before they act: `_get_task_briefing()` queries episodic memory + bulletin board before every task (~5ms, no LLM). `_post_task_learning()` shares lessons after tasks. `reflect()` extracts behavioral rules and posts them for all agents to pick up. Dead recall blocks removed from Detective and Researcher.

### Phase 3: Interactive Website

Built a Next.js visualization website (`web/`) with real-time Supabase data:

**Tech stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Shadcn UI, Recharts

**Pages & Routes:**
- Landing page with streamlined sections: Hero (scrolling mosaic + Thoreau epigraph), Abstract (3-column drop-cap), NASA-style Contents, Introduction (9 paragraphs + 12 Tufte sidenotes + textured Venn diagram), Key Finding, Searchable Index, Confirmed Timeline, Knowledge Graph, Dossier Example, Aesthetic Pivot, Epstein Aesthetic (radar), Aesthetic Analysis, Testing Aesthetic, Conclusion, What's Next, Agent Methodology (cool purple-blue), Aesthetic Methodology (warm dark-cream)
- Dossier detail pages (`/dossier/[id]`) with evidence sections, verdict badges, article images
- API routes: `/api/stats`, `/api/features` (paginated + filterable + confirmed-only), `/api/dossiers`, `/api/dossiers/[id]`

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

### Phase 3.5: Knowledge Graph & Analytics

Built a Neo4j knowledge graph with hybrid NetworkX analytics:

- **Neo4j Aura Free** — graph database mapping people, designers, locations, styles, issues, authors, and Epstein connections
- **`src/graph_db.py`** — Python singleton driver, **`src/sync_graph.py`** — Supabase → Neo4j sync with `--export` for agent office
- **`src/graph_analytics.py`** — NetworkX-powered: Louvain community detection, PageRank, betweenness centrality, Jaccard similarity, Epstein proximity. Writes results back to Neo4j node properties.
- **Connection Explorer** — Interactive force-directed graph page at `/explorer` with 7 query presets (ego network, shortest path, shared designers, hubs, Epstein subgraph, full graph, search)
- **Elena integration** — Researcher calls `get_person_analytics()` during investigations, adding community membership, centrality metrics, and Epstein proximity to dossiers
- **Elena dynamic queries** — After preset graph queries, Elena generates 0-3 ad-hoc Cypher queries via Haiku to follow hunches. Write-guarded via `safe_read_query()`, results fed into synthesis, queries saved in dossier for audit.
- **Agent Office graph** — Embedded force-graph (vanilla JS CDN) polls `graph.json` every 6s, collapsible panel under CURRENT LEADS

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

**Run 4 — Complete (Database Built):**
- All Supabase tables, Neo4j graph, local data wiped (Feb 12). Pipeline rebuilt from scratch.
- **Final stats**: 1,396 issues, **3,472 features**, 2,877+ cross-references (1,277 YES), 1,408 dossiers, **225 confirmed connections**
- Scoring v2.3: aesthetic_summary field, structural overwrite on rescore, expanded subject_category (Art/Media/Design), --offset flag, checkpoint refresh
- Full archive re-extraction: `src/reextract_features.py` reads spread data from all 470 issues, classified 3,506 home features via Haiku ($0.57), inserted 2,305 new features with images
- Opus Vision v2.2 scoring: 3,783 features scored across 2 runs ($145 + $172 so far). 1,008 pre-update features cleared for rescoring (missing subject_category). 73 features backfilled with images.
- Manual DOJ evidence review: Diane von Furstenberg + Sharon Stone overridden to CONFIRMED
- Non-home feature cleanup: 621 features deleted total (458 original + 164 unmatched audit: department columns, travel guides, firm profiles, misattributed celebrities)
- Subject category classification: All features tagged. Categories restructured: Designer→Design, new Art (285), Media (16) split from Other
- Designer extraction cleanup: 202 false positives cleared (homeowner name copied to designer), 98 real designers recovered via Haiku vision pass ($0.84)
- Key demographic finding: Socialites 3.5x overrepresented in Epstein orbit vs general AD baseline
- CLAUDE.md rewritten to reflect actual project state (multi-agent system, deployment, current stats)

**In Progress — Wealth Origin Study & Final Pipeline:**
- **NULL name resolution COMPLETE**: 862 NULL features processed by Opus Vision → all genuinely anonymous. Applied to Supabase. Zero NULL homeowner names remain.
- **Wealth origin classification**: ~850/1,246 names backfilled with Perplexity third pass. Full pipeline: Gemini Search Grounding (2 passes) + Perplexity (1 pass) + Opus synthesis. ~1,859 names still need initial classification.
  - Key finding: MIXED wealth (inherited platform + self-amplified) ~2x overrepresented in Epstein orbit (25.9% vs 13.3% baseline)
  - **Googleable Parent Rule** formalized: parents with web presence → Forbes 7 max; same-industry → Forbes 6 max; Wikipedia-level parent → MIXED
  - Formal methodology: `docs/wealth-classification-methodology.md`
- **Dossier false negative audit COMPLETE**: Deep audit of all 1,209 rejected dossiers found 5 false negatives — Robert Couturier (#350, #1240), Barbara Walters (#1345), Bill Bensley (#731), Robert Redford (#986), Emma Roig Askari (#684). All confirmed. Pipeline timing bug identified (triage before DOJ results) and documented.
- **Pipeline audit COMPLETE (Feb 28)**: All gaps resolved. 225 confirmed dossiers, 1,408 total. 0 unresolved needs_review, 0 DOJ pending, 0 named features without xrefs, 0 YES features without dossiers. 14 new dossiers created (1590–1603). Evan Yurman confirmed (Peggy Siegal guest list + Guggenheim cochair). Supabase pagination bug discovered and fixed.
- **Pipeline health**: Editor FK error loop fixed (was starving Elena of work). Detective correctly shows done.
- Opus Vision scoring: COMPLETE (3,772/3,772 at v2.3)
- Test-retest validation COMPLETE: 3 runs × 100 features, 91.1% exact agreement, 100% within ±1, ICC 0.949–0.991 ("Excellent"), $34.89
- Inter-model reliability COMPLETE: 100 features × Sonnet + Haiku, Opus-Sonnet ICC 0.805, 96.8% within ±1, $4.35
- Validate with human calibration set (25-30 features)

**Phase 1 — AD Database: COMPLETE**
- ~~Source additional AD issues beyond archive.org~~ **Done** (AD Archive covers all 456+ issues)
- ~~Re-extract Anonymous features with Sonnet~~ **Done** (237 names recovered, 497 non-homes classified)
- ~~Full archive re-extraction from spread data~~ **Done** (2,305 new features, 4,081 total)
- Quality review: validate extracted data, fill in missing fields

**Phase 2 — Cross-Reference at Scale:**
- ~~Store cross-reference data in Supabase~~ **Done** (`cross_references` table)
- ~~6-dimension aesthetic taxonomy for all features~~ **Done** (v1 superseded by v2)
- ~~9-axis aesthetic scoring instrument v2~~ **Done** (v2.2 with per-axis rationale)
- ~~Opus Vision scoring on original 1,600 features~~ **Done** ($145, 1,590 scored)
- ~~Feature image backfill~~ **Done** (11,340 images across 1,590 features + 13,000+ from re-extraction + 73 backfilled + 2,861 missing pages downloaded)
- ~~Image cleanup~~ **Done** — Spread data ground truth established for 3,642 features. 907 wrong images deleted (backfill Strategy 3 cross-contamination). 26 poisoned Opus name recoveries reverted. 164 non-home features deleted (unmatched audit complete).
- Opus Vision scoring all 4,080 features — **In Progress** (2,774 done, 1,306 remaining, ~$130 projected)
- Subject category tagging — **Done** (all features tagged, categories restructured: Art/Media/Design taxonomy)
- Cross-reference new names → Detective → Researcher → Editor pipeline
- Complete dossier building for all flagged leads
- Manual review of HIGH and MEDIUM connection strength dossiers

**Phase 3 — Interactive Website:**
- ~~Design and build public-facing visualization website~~ **Done**
- ~~Searchable index, interactive timelines, trend analysis~~ **Done**
- ~~Dossier viewer for Epstein-linked leads~~ **Done**
- ~~Knowledge graph + Connection Explorer~~ **Done** (Neo4j + react-force-graph-2d)
- ~~Graph analytics (community detection, centrality)~~ **Done** (NetworkX hybrid)
- Deploy to Vercel (`cd web && vercel --prod`)
- Get service role key from Supabase dashboard and set in Vercel env vars
