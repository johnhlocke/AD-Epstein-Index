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
│  ├── cross_references           ├── cross_references/results.json   │
│  ├── dossiers                   ├── dossiers/*.json                 │
│  └── dossier_images            └── detective_verdicts.json         │
├─────────────────────────────────────────────────────────────────────┤
│  Neo4j Aura (Graph DB)          NetworkX (Analytics)                │
│  ├── Person, Designer, Location ├── Louvain communities             │
│  ├── Style, Issue, Author       ├── PageRank, betweenness           │
│  ├── EpsteinSource              ├── Jaccard similarity              │
│  └── 6 relationship types       └── Epstein proximity (paths)       │
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
 "Find Jan-Mar 2015 issues"    →    Scout checks AD Archive first (HTTP),
                                     then archive.org API, then Claude CLI
 "Scrape AD Archive 2025-01"   →    Courier decodes JWT tocConfig,
                                     extracts features via Anthropic API
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
| Scout | 60s | None (API calls) | Three-tier discovery: AD Archive HTTP → archive.org API → Claude CLI |
| Courier | 5s | Haiku (scraping) | Downloads PDFs + scrapes AD Archive via HTTP/JWT + Anthropic API |
| Reader | 30s | Claude Sonnet | Extracts homeowner data via Vision API, TOC + article pages |
| Detective | 180s | None (search) | Two-pass: BB grep (instant) → DOJ Playwright (batched) |
| Researcher | 120s | Claude Haiku | Builds dossiers with pattern analysis + home analysis |
| Editor | event-driven | Sonnet (routine) / Opus (human+quality) | Central coordinator: event queue, plans tasks, validates results, commits to Supabase |
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
- **Model selection:** Uses Sonnet for routine status checks (task routing, progress). Switches to Opus only when human messages are present (quality cleanup runs on Sonnet).

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
    briefing: str      # Pre-execution context from memory + bulletin board (set by run() loop)

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
4. **3-step pipeline with graph intelligence**:
   - Step 1: Triage (Haiku ~$0.001) — filter obvious false positives
   - Step 2: Deep Analysis (Sonnet + article images ~$0.03)
   - Graph Investigation: 7 preset queries (shared designers, flagged neighbors, timeline, etc.)
   - Graph Followups: Elena generates 0-3 ad-hoc Cypher queries via Haiku (~$0.001) based on preset results. Write-guarded via `safe_read_query()`.
   - Step 3: Synthesis (Sonnet ~$0.02) — receives cached analytics + preset results + followup results
5. Robust JSON parsing with brace-counting fallback for truncated responses
6. Proposes connection strength: HIGH / MEDIUM / LOW / COINCIDENCE
7. Saves dossier to Supabase with `editor_verdict = PENDING_REVIEW` + disk backup. Graph followup queries stored in dossier for audit trail.
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
- **Storage:** JSON file (`data/agent_memory/episodes.json`), capped at 10,000 episodes
- **Recall:** Cosine similarity on pre-computed embeddings + metadata filters (agent, task_type, outcome)
- **Integration:** `problem_solve()` queries memory before deciding; `run()` commits after every task; `reflect()` generates compound insights every 10 min
- **Cost:** Embeddings are free (local). Reflections ~$0.001/call (Haiku, every 10 min per agent)

### Idle Intelligence Pipeline

When agents have no work, they use idle time intelligently (each with independent cooldowns):

| Method | Interval | What it does | Cost |
|--------|----------|-------------|------|
| `reflect()` | 10 min | Reviews own episodes, identifies patterns | ~$0.001 |
| `curious_explore()` | 15 min | Explores ALL agents' episodes for cross-cutting patterns | ~$0.001 |
| `propose_improvement()` | 30 min | Proposes methodology changes (WHAT/WHY/HOW format) | ~$0.002 |
| `idle_chatter()` | 2 min | Personality-driven banter | ~$0.0005 |

**Data flow:**
```
reflect() ──→ reflection episodes ──→ recalled by future problem_solve()
         └──→ RULE: extraction ──→ bulletin board ("learned") ──→ read by all agents
curious_explore() ──→ curiosity episodes ──→ cross-agent knowledge
propose_improvement() ──→ proposal episodes ──→ Editor reads during assessment
idle_chatter() ──→ speech bubble on dashboard
```

### Memory Feedback Loop (Pre-Execution Briefing + Post-Execution Learning)

Closes the read/write gap in the intelligence system. Before this, agents committed episodes but never read them before the next task. Now:

```
                     ┌─── recall similar episodes (own memory, ~5ms)
                     │
task arrives ────────┤
                     │
                     └─── read bulletin board (warnings + learned rules)
                                │
                                ▼
                         task.briefing (formatted context string)
                                │
                                ▼
                     agent.execute(task)  ← briefing injected into LLM prompts
                                │
                                ▼
                     _post_task_learning()  → bulletin board ("learned" tag)
                                │
                                ▼
                     other agents read this on their next task
```

- **`_get_task_briefing(task)`** — queries episodic memory for past episodes matching task type, reads bulletin for warnings + learned rules. No LLM call (~5ms).
- **`_post_task_learning(task_type, lesson)`** — posts non-trivial lessons to bulletin board tagged "learned". Only fires for meaningful insights (>10 chars).
- **`reflect()` → rules** — reflection prompt now requests `RULE:` prefixed actionable rules. Extracted rules posted to bulletin as "learned" entries, picked up by all agents at next task start.

### Memory-Informed Planning (Editor)

`_memory_informed_priority()` adjusts task priority before assignment:
- Queries episodic memory for past attempts at similar tasks
- 3+ failures → deprioritize (don't repeat doomed tasks)
- 3+ successes → boost priority (lean into what works)
- Called by `_assign_task()` before pushing to agent inbox

`_get_improvement_proposals()` surfaces agent proposals during strategic assessment:
- Queries episodic memory for 'proposal' outcome episodes
- Included in situation report for the Editor's strategic LLM

### World Model

`get_world_state()` gives any agent a structured snapshot of the pipeline:
```python
{
    "pipeline": {"discovered": 85, "downloaded": 42, "extracted": 15, "target": 456, "coverage_pct": 18.6},
    "intelligence": {"memory_episodes": 127, "bulletin_notes": 14},
    "bottleneck": "extraction"  # Where the pipeline is stuck
}
```
Cached for 30 seconds. Agents can use this to make context-aware decisions.

### Inter-Agent Communication (`src/agents/bulletin.py`)

Shared bulletin board for peer-to-peer tips and warnings:
```
Scout posts: "archive.org rate limiting — slow down" (tag: warning)
    → Courier reads warning before attempting downloads
    → Detective reads warning before DOJ search
```

- `post_bulletin()` / `read_bulletin()` on base Agent class
- `problem_solve()` checks bulletin for relevant notes before deciding
- Agents auto-post warnings when escalating to Editor
- JSON-backed persistence, capped at 200 notes

### Orchestrator (`src/orchestrator.py`)
- Launches all 7 agents as async tasks
- Wires Editor with worker references (Editor.workers = all other agents)
- Writes `status.json` every 2 seconds (merges live agent data with disk-based stats)
- Includes Editor's task board (in_flight/completed/failed) in status.json
- Overlays `editor_state` for dashboard sprite animation
- Processes pause/resume commands from `data/agent_commands.json`
- Graceful shutdown on SIGINT

### Shared DB Module (`src/db.py`)
- Singleton Supabase client (`get_supabase()`) — all agents import from here
- Issue CRUD: `get_issue_by_identifier()`, `upsert_issue()`, `update_issue()`, `list_issues()`, `count_issues_by_status()`
- Feature CRUD: `feature_exists()`, `insert_feature()`, `delete_features_for_issue()`
- Dossier CRUD: `upsert_dossier()`, `get_dossier()`, `list_dossiers(strength, editor_verdict)`, `update_editor_verdict()`
- Cross-reference CRUD: `upsert_cross_reference()`, `get_cross_reference()`, `list_cross_references()`, `get_xref_leads()`, `update_xref_editor_override()`, `get_features_without_xref()`, `delete_cross_references()`, `reset_xref_doj()`
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
3. **Combined verdict** — 5-tier internally (`confirmed_match` → `needs_review`), mapped to binary YES/NO at Supabase boundary via `verdict_to_binary()`. Strong verdicts (`confirmed_match`, `likely_match`) always map to YES — immune to glance override.
4. **Contextual glance** — For ambiguous tiers only (`possible_match`, `needs_review`): Haiku reads DOJ snippets to determine if same person. Strong verdicts and clear `no_match` skip the LLM call entirely.
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

### Path A: archive.org (PDF pipeline)
1. **Discover** — Scout checks AD Archive first (Tier 1), then archive.org API (Tier 2), then Claude CLI (Tier 3)
2. **Editor commits** — Upserts issue to Supabase, cascades `download_pdf` to Courier
3. **Download** — Courier fetches PDF from archive.org with rate limiting and resume support
4. **Editor commits** — Marks issue `downloaded`, cascades `extract_features` to Reader
5. **Extract** — Reader converts PDF pages to PNG (pdftoppm 150 DPI), sends to Claude Sonnet
6. **Editor commits** — Quality gate, loads features to Supabase, cascades to Detective

### Path B: AD Archive (direct HTTP scraper)
1. **Discover** — Scout checks AD Archive URL (Tier 1 HTTP check, instant)
2. **Editor commits** — Upserts issue with `source=ad_archive`, cascades `scrape_features` to Courier
3. **Scrape+Extract** — Courier decodes JWT `tocConfig` → Anthropic API (Haiku) batch-extracts features (~4s total)
4. **Editor commits** — Quality gate, loads features to Supabase, cascades to Detective
5. **Note:** Reader is NOT involved — Courier extracts directly from JWT metadata

### Shared (both paths)
5. **Cross-reference** — Match AD homeowner names against DOJ Epstein Library (Playwright) and Little Black Book (text search)
6. **Investigate** — Build dossiers on flagged leads with pattern analysis and home-as-evidence analysis
7. **Serve** — Agent Office dashboard shows real-time status; Phase 3 website serves public visualizations

## Components

| Component | Purpose | Tech |
|-----------|---------|------|
| Orchestrator | Launches & coordinates all agents | Python, asyncio (`src/orchestrator.py`) |
| Agent Base | Shared agent behavior (work loop, pause, progress) | Python (`src/agents/base.py`) |
| Shared DB | Singleton Supabase client, issue/feature CRUD | Python (`src/db.py`) |
| Scout Agent | Discover AD issues (AD Archive + archive.org + CLI) | Python, requests (`src/agents/scout.py`) |
| Courier Agent | Download PDFs + deep scrape AD Archive | Python, requests, Claude Vision (`src/agents/courier.py`) |
| Reader Agent | Extract homeowner data from PDFs | Python, Claude Sonnet, pdftoppm (`src/agents/reader.py`) |
| Detective Agent | Cross-reference names against Epstein records | Python, Playwright (`src/agents/detective.py`) |
| Researcher Agent | Build dossiers on flagged leads | Python, Claude Haiku (`src/agents/researcher.py`) |
| Editor Agent | Central coordinator, validates, commits to Supabase | Python, Claude Sonnet/Opus (`src/agents/editor.py`) |
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
| Graph DB Client | Neo4j singleton driver + constraints | Python (`src/graph_db.py`) |
| Graph Sync | Supabase → Neo4j sync + JSON export | Python (`src/sync_graph.py`) |
| Graph Analytics | Community, centrality, similarity, proximity | Python, NetworkX (`src/graph_analytics.py`) |
| Graph Queries | 12 preset + safe LLM-generated ad-hoc queries | Python, Neo4j (`src/graph_queries.py`) |
| Website | Public-facing visualizations + Connection Explorer | Next.js, Tailwind, Shadcn UI, react-force-graph-2d (Phase 3) |

## Database Schema

See [schema.sql](schema.sql) for full SQL definitions.

| Table | Phase | Purpose |
|-------|-------|---------|
| `issues` | 1 | One row per magazine issue — also pipeline tracker (identifier, status, pdf_path, verified dates) |
| `features` | 1 | One row per featured home (homeowner, designer, location, article_author, etc.) |
| `epstein_persons` | 2 | Unique individuals from Epstein files |
| `epstein_references` | 2 | Each mention of a person (document, context, URL) |
| `cross_references` | 2 | One row per feature — full detective work (BB matches, DOJ results, combined verdict, editor overrides) |
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

### Phase 3.5: Knowledge Graph

```
Supabase (source of truth)
    ↓
sync_graph.py (--full / --incremental)
    ↓                    ↓
Neo4j Aura           graph.json (export)
    ↓                    ↓
graph_analytics.py   agent-office.html (force-graph CDN, polls 6s)
    ↓
Neo4j node properties (community_id, pagerank, betweenness)
    ↓
web/src/lib/neo4j.ts → graph-queries.ts → /api/graph → ConnectionExplorer
    ↓
researcher.py → get_person_analytics() → dossier synthesis
```

**Graph schema:** 7 node types (Person, Designer, Location, Style, Issue, Author, EpsteinSource) + 6 relationship types (FEATURED_IN, HIRED, LIVES_IN, HAS_STYLE, PROFILED_BY, APPEARS_IN)

**Hybrid analytics:** Neo4j Aura Free lacks GDS/APOC libraries, so analytics run via NetworkX in Python:
- Louvain community detection, PageRank, betweenness centrality, Jaccard similarity
- Results written back to Neo4j node properties for web frontend consumption
- Elena (Researcher) queries analytics during investigations for structural evidence

**Connection Explorer** (`/explorer`): react-force-graph-2d with 7 query presets, custom ring-style nodes with glow, dark celestial palette

**Agent Office graph**: force-graph vanilla JS from CDN, collapsible panel, polls `graph.json` every 6s for real-time pipeline visualization

### Pending
- ~~Additional PDF sources beyond archive.org~~ **Done** (AD Archive covers all 456 issues via JWT scraping)
- ~~Phase 2 Supabase tables~~ **Done** (`cross_references` table added; dossiers already in Supabase)
- Vercel production deployment
