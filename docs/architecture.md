# Architecture

High-level system architecture, data flow, and component relationships.

## System Overview — Hub-and-Spoke Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│               Hub-and-Spoke Multi-Agent System                       │
│                                                                     │
│                    ┌──────────────────────┐                         │
│                    │       Editor         │                         │
│                    │  scan → plan → assign │                        │
│                    │  collect → validate   │                        │
│                    │  commit to Supabase   │                        │
│                    └──────────┬───────────┘                         │
│                               │                                     │
│              ┌────────┬───────┼───────┬──────────┐                 │
│              │        │       │       │          │                 │
│          inbox↓   inbox↓  inbox↓  inbox↓     inbox↓               │
│         ┌────────┐┌───────┐┌──────┐┌─────────┐┌──────────┐       │
│         │ Scout  ││Courier││Reader││Detective││Researcher│       │
│         │ finds  ││ downs ││ extr ││  xrefs  ││ dossiers │       │
│         └────────┘└───────┘└──────┘└─────────┘└──────────┘       │
│          outbox↑   outbox↑  outbox↑  outbox↑     outbox↑         │
│              │        │       │       │          │                 │
│              └────────┴───────┼───────┴──────────┘                 │
│                               │                                     │
│                    ┌──────────┴───────────┐                         │
│                    │    Editor collects    │  ┌──────────┐          │
│                    │    validates + commits│  │ Designer │          │
│                    └──────────────────────┘  │ (indep.) │          │
│                                              └──────────┘          │
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
│  ├── issues (source of truth)  ├── issues/*.pdf                    │
│  ├── features                   ├── extractions/*.json              │
│  └── (phase 2 tables)          ├── cross_references/results.json   │
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

## Multi-Agent Pipeline (Hub-and-Spoke)

The system runs as 7 autonomous agents coordinated by the Editor via asyncio.Queue task queues:

```
       Editor decides WHAT                   Agent decides HOW
 ─────────────────────────────       ─────────────────────────────────
 "Find Jan-Mar 2015 issues"    →    Scout searches archive.org API,
                                     then web, then eBay
 "Download sim_ad_1995-03"     →    Courier downloads with retry,
                                     resume support, rate limiting
 "Extract features from PDF"   →    Reader does TOC analysis, page
                                     scanning, offset detection
 "Cross-reference these names" →    Detective greps BB first, then
                                     DOJ browser search
```

### Agent Details

| Agent | Interval | AI Model | Key Behavior |
|-------|----------|----------|-------------|
| Scout | 60s | None (API calls) | Built-in archive.org HTTP search + Claude CLI for creative strategies |
| Courier | 5s | None (downloads) | Downloads PDFs with rate limiting, priority sorting |
| Reader | 30s | Claude Sonnet | Extracts homeowner data via Vision API, TOC + article pages |
| Detective | 180s | None (search) | Two-pass: BB grep (instant) → DOJ Playwright (batched) |
| Researcher | 120s | Claude Haiku | Builds dossiers with pattern analysis + home analysis |
| Editor | event-driven | Claude Opus | Central coordinator: event queue replaces polling, plans tasks, validates results, commits to Supabase |
| Designer | 600s | Claude Haiku | Learns design patterns from training sources |

### Editor Coordinator Model (Event-Driven Hub-and-Spoke)

The Editor is the central coordinator — the ONLY agent that writes pipeline state to Supabase.

**Event-driven architecture** (replaces the old 5-second polling loop):

The Editor blocks on a single `asyncio.Queue` that receives events from 4 background producer tasks:

```
  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
  │ Outbox Forwarder │   │ Message Watcher  │   │ Timer Heartbeats│
  │ (checks 0.5s)   │   │ (checks 1s mtime)│   │ (30s / 300s)    │
  └────────┬────────┘   └────────┬─────────┘   └────────┬────────┘
           │                     │                       │
           ▼                     ▼                       ▼
      ┌─────────────────────────────────────────────────────┐
      │              Editor Event Queue                      │
      │   await queue.get()  ← blocks until event arrives   │
      └──────────────────────────┬──────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   _handle_event()      │
                    │                        │
                    │  agent_result → commit  │
                    │  human_message → chat   │
                    │  timer_plan → assign    │
                    │  timer_strategic → LLM  │
                    └────────────────────────┘
```

| Event | Source | Latency |
|---|---|---|
| `agent_result` | Outbox forwarder (0.5s poll) | < 1 second |
| `human_message` | File mtime watcher (1s poll) | < 2 seconds |
| `timer_plan` | asyncio.sleep(30) | Every 30s |
| `timer_strategic` | asyncio.sleep(300) | Every 5 min |

**Planning (every 30s via `timer_plan` event):**
- `_plan_and_assign()` — scan Supabase, create tasks, push to agent inboxes:
   - Missing issues? → assign Scout
   - Discovered but not downloaded? → assign Courier
   - Downloaded but not extracted? → assign Reader
   - Features need cross-referencing? → assign Detective (via work())
   - Leads need investigation? → assign Researcher (via work())

**Strategic assessment (every 5 min via `timer_strategic` event, OR immediately on `human_message` event):**
- `_strategic_assessment()` — call Claude for complex decisions, handle human messages

**Event batching:**
- `_drain_pending_events()` — after handling one event, drains any that accumulated during processing (e.g., multiple agent results arriving during a long LLM call). Batches `agent_result` events into a single `_process_results()` call for efficiency.

### Task Infrastructure (`src/agents/tasks.py`)

```python
@dataclass
class Task:
    type: str          # "discover_issues", "download_pdf", "extract_features", etc.
    goal: str          # Human-readable: "Find AD issues for Jan-Mar 2015"
    params: dict       # Everything the agent needs
    priority: int      # 0=critical, 1=high, 2=normal, 3=low
    id: str            # Short UUID

@dataclass
class TaskResult:
    task_id: str
    task_type: str
    status: str        # "success" or "failure"
    result: dict       # Agent-specific structured data
    error: str | None  # Why it failed
    agent: str         # Which agent produced this
```

### Editor Ledger (`data/editor_ledger.json`)
Centralized log of every task attempt — replaces scattered per-agent escalation files:
- Records all success/failure attempts keyed by identifier/name
- Failure counts determine retry eligibility (max 3 failures per key)
- Provides context to agents about previous failures

### Researcher Investigation Pipeline
1. Picks up non-`no_match` leads from `results.json` that haven't been investigated
2. Gathers AD feature context from Supabase (all 14 fields)
3. Builds investigation context: BB matches, DOJ snippets, AD appearance details
4. **3-step pipeline**: Triage (Haiku) → Deep Analysis (Sonnet + images) → Synthesis (Sonnet)
5. Robust JSON parsing with brace-counting fallback for truncated responses
6. Proposes connection strength: HIGH / MEDIUM / LOW / COINCIDENCE
7. Saves dossier to Supabase with `editor_verdict = PENDING_REVIEW` + disk backup
8. Pushes `TaskResult` to outbox → Editor receives for gatekeeper review

### Editor Gatekeeper (Dossier Review)
Every Researcher dossier passes through the Editor before becoming final:
- **COINCIDENCE** → auto-REJECTED (no LLM call needed, free)
- **HIGH** → Sonnet review with "default CONFIRMED" stance (~$0.005)
- **MEDIUM** → Sonnet review with balanced stance (~$0.005)
- **LOW** → Sonnet review with "default REJECTED" stance (~$0.005)
- Editor calls `update_editor_verdict(feature_id, verdict, reasoning)` to finalize
- On review failure → safe default to PENDING_REVIEW
- Dashboard shows only CONFIRMED connections

### Agent Base Class (`src/agents/base.py`)
- Async work loop with configurable interval
- **Hub-and-spoke**: `inbox` (asyncio.Queue) receives tasks from Editor, `outbox` sends results back
- `execute(task)` — task-driven entry point; falls back to `work()` when inbox is empty
- Watchdog timer: logs warning if inbox empty for >120s
- Pause/resume support via asyncio.Event
- Progress tracking (`get_progress()` returns `{current, total}`)
- Skills loading from `src/agents/skills/<agent>.md`
- Dashboard status reporting (`get_dashboard_status()`)
- Error tracking with per-agent failure counts
- **`problem_solve(error, context, strategies)`** — LLM-powered error diagnosis via Haiku (~$0.001/call). Returns `{diagnosis, strategy, reasoning}`. All agents use this instead of hardcoded retry logic.
- **`idle_chatter()`** — Generates personality-driven idle thoughts via Haiku when agent has no work. 120s cooldown.
- **`_load_agent_name()`** — Extracts agent's character name from skills file `## Name` section

### Agent Names
Each agent has a character name (chosen by analyzing their pixel sprite via Gemini Vision):
- **Arthur** (Scout), **Casey** (Courier), **Elias** (Reader), **Silas** (Detective), **Elena** (Researcher), **Miranda** (Editor)

### Episodic Memory (`src/agents/memory.py`)

Agents learn from experience via a lightweight vector store:

```
problem_solve() ─── recall similar past errors ──→ LLM gets PAST EXPERIENCE context
         │                                              │
         └── commit decision episode ──→ JSON store ←── recall
                                              ↑
run() loop ── commit success/failure ─────────┘
                                              ↑
reflect() ─── periodic self-assessment ───────┘
```

- **Embeddings:** all-MiniLM-L6-v2 via ONNX (22M params, 384-dim, local, no API calls)
- **Storage:** JSON file (`data/agent_memory/episodes.json`), capped at 2,000 episodes
- **Recall:** Cosine similarity on pre-computed embeddings + metadata filters (agent, task_type, outcome)
- **Integration:** `problem_solve()` queries memory before deciding; `run()` commits after every task; `reflect()` generates compound insights every 10 min
- **Cost:** Embeddings are free (local). Reflections ~$0.001/call (Haiku, every 10 min per agent)

### Reflection

Agents periodically review their recent episodes (every 10 min when idle):
1. Recall last 10 episodes for this agent
2. Ask Haiku to identify patterns and suggest improvements
3. Commit the insight back to memory as a 'reflection' episode
4. Future problem_solve() calls can recall these reflection insights

### Orchestrator (`src/orchestrator.py`)
- Launches all 7 agents as async tasks
- Wires Editor with worker references (Editor.workers = all other agents)
- Writes `status.json` every 5 seconds (merges live agent data with disk-based stats)
- Includes Editor's task board (in_flight/completed/failed) in status.json
- Overlays `editor_state` for dashboard sprite animation
- Processes pause/resume commands from `data/agent_commands.json`
- Graceful shutdown on SIGINT

### Shared DB Module (`src/db.py`)
- Singleton Supabase client (`get_supabase()`) — all agents import from here
- Issue CRUD: `get_issue_by_identifier()`, `upsert_issue()`, `update_issue()`, `list_issues()`, `count_issues_by_status()`
- Feature CRUD: `feature_exists()`, `insert_feature()`, `delete_features_for_issue()`
- Dossier CRUD: `upsert_dossier()`, `get_dossier()`, `list_dossiers(strength, editor_verdict)`, `update_editor_verdict()`
- Replaces the local `archive_manifest.json` — Supabase `issues` table is the single source of truth

### Agent Status (`src/agent_status.py`)
- Reads pipeline state from Supabase issues table, extractions, cross-references, dossiers
- All issue counts come from `db.count_issues_by_status()` (no more manifest reads)
- Generates `status.json` for the Agent Office dashboard
- Notable finds: filters out no_match names, shows xref verdict + research status
- Confirmed associates: HIGH and MEDIUM dossier connections with names and rationale
- `build_coverage_map()`: 38yr x 12mo grid of issue pipeline status from Supabase
- `read_editor_ledger()`: Reads `data/editor_ledger.json`, computes stuck/exhausted/recent failures for dashboard

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

## Cross-Reference & Investigation Pipeline (Editor-Directed)

```
Reader extracts features
    ↓
Editor._commit_extraction()
    ├── loads features to Supabase
    └── queries features.detective_verdict IS NULL
        └── creates cross_reference Task → Detective inbox
                ↓
Detective.execute(cross_reference)
    ├── BB search (instant, local)
    ├── DOJ search (Playwright browser)
    ├── contextual_glance() for ambiguous cases (Haiku ~$0.001)
    └── returns binary_verdict YES/NO per name → outbox
                ↓
Editor._commit_cross_reference()
    ├── writes detective_verdict YES/NO to features table
    └── queues YES names → Researcher inbox
                ↓
Researcher.execute(investigate_lead)
    ├── 3-step pipeline (triage → deep analysis → synthesis)
    └── saves dossier with editor_verdict=PENDING_REVIEW → outbox
                ↓
Editor._commit_investigation()
    └── Sonnet review → CONFIRMED or REJECTED
```

1. **Detective BB pass** — Grep search of `data/black_book.txt` with word-boundary matching, min 5-char last names
2. **Detective DOJ pass** — Playwright browser search of justice.gov/epstein with WAF bypass, bot check handling
3. **Combined verdict** — 5-tier internally (`confirmed_match` → `needs_review`), mapped to binary YES/NO at Supabase boundary via `verdict_to_binary()`
4. **Contextual glance** — For ambiguous cases only (~10-20%): Haiku reads DOJ snippets to determine if same person. Clear YES/NO cases skip LLM call.
5. **Editor writes verdict** — `detective_verdict` (YES/NO) and `detective_checked_at` on features table
6. **Researcher investigation** — 3-step pipeline (Triage → Deep Analysis → Synthesis) builds dossier for each YES lead:
   - Full AD feature context (all 14 fields from Supabase)
   - Article page images for visual analysis (Sonnet)
   - Pattern analysis across all associated names (shared designers, locations, styles, decades)
   - Home analysis (wealth indicators, social circles, style significance, temporal relevance)
   - Proposes connection strength: HIGH / MEDIUM / LOW / COINCIDENCE
   - Saves to Supabase as PENDING_REVIEW, pushes to Editor outbox
7. **Editor gatekeeper** — Reviews each dossier: COINCIDENCE auto-rejected, others reviewed by Sonnet → CONFIRMED or REJECTED
8. **Escalation** — CONFIRMED HIGH/MEDIUM findings remembered as milestones
9. **Planning fallbacks** — `_plan_detective_tasks()` catches pre-refactor features; `_plan_researcher_tasks()` catches unprocessed YES verdicts

## Data Flow

1. **Discover** — Query archive.org API for AD magazine text items, parse month/year, upsert to Supabase issues table
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
| Shared DB | Singleton Supabase client, issue/feature CRUD | Python (`src/db.py`) |
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
| `issues` | 1 | One row per magazine issue — also pipeline tracker (identifier, status, pdf_path, verified dates) |
| `features` | 1 | One row per featured home (homeowner, designer, location, article_author, etc.) |
| `epstein_persons` | 2 | Unique individuals from Epstein files |
| `epstein_references` | 2 | Each mention of a person (document, context, URL) |
| `dossiers` | 2 | One row per investigated lead — Researcher's analysis + Editor's final verdict (CONFIRMED/REJECTED/PENDING_REVIEW) |
| `dossier_images` | 2 | Article page images linked to dossiers (stored in Supabase Storage) |
| `matches` | 2 | Links AD features to Epstein persons with confidence scoring |
| `black_book_matches` | 2 | Links AD features to Epstein's Little Black Book entries |
| `feature_images` | 2 | Article page images for matched homeowners (stored in Supabase Storage) |

## Key Decisions

### Resolved
- **Single source of truth:** Supabase `issues` table — all agents read/write pipeline status via `src/db.py` (replaced local `archive_manifest.json`)
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

## Phase 3: Visualization Website

```
Designer Agent (Python)
  → reads knowledge_base.json (patterns)
  → reads Supabase data shapes
  → generates JSON design specs → web/design-specs/

Next.js App (web/)
  → reads design specs for styling decisions
  → queries Supabase server-side (service key, never client-exposed)
  → renders landing page with charts + searchable index
  → deployed to Vercel
```

**Architecture:**
- `web/src/lib/supabase.ts` — server-side only client (service role key)
- `web/src/lib/queries.ts` — getStats(), getFeatures(), getDossiers(), getDossier()
- `web/src/app/api/` — REST routes wrapping query functions
- `web/src/app/page.tsx` — server component, fetches all stats at build time (ISR 5min)
- `web/src/app/dossier/[id]/page.tsx` — dynamic server component
- `web/src/components/charts/` — Recharts wrappers (client components)
- `web/src/components/landing/` — SearchableIndex (client), Hero/KeyFindings/Methodology (server)

**Data flow:** Supabase → Next.js server → HTML (static/ISR) or JSON (API routes) → Browser

### Pending
- Additional PDF sources beyond archive.org
- Phase 2 Supabase tables (currently using disk-based JSON for cross-reference results and dossiers)
- Vercel production deployment
