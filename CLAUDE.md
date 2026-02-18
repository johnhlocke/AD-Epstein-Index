# AD-Epstein-Index

## Project Overview
A research project that cross-references every homeowner featured in Architectural Digest magazine (1988–2025) against the DOJ's Full Epstein Library. The finding: Epstein's documented social network overlaps significantly with the world AD celebrates.

**Live site:** https://www.wheretheylive.world

**Current stats:** 4,081 features, 1,396 issues, 75 confirmed Epstein connections, 420 dossiers

## Project Phases

### Phase 1: Build the AD Database — COMPLETE
Comprehensive database of all homeowners/clients featured in every issue of Architectural Digest (1988–2025), extracted from the AD Archive's JWT-embedded article metadata and archive.org PDFs.

### Phase 2: Cross-Reference with Epstein Records — In Progress
Cross-reference every name against the DOJ's Full Epstein Library (https://www.justice.gov/epstein) and Epstein's Little Black Book. Aesthetic scoring (9-axis Opus Vision) captures the design signature of confirmed homes.

### Phase 3: Interactive Visualization Website — Deployed
Public website at wheretheylive.world with searchable index, interactive charts, knowledge graph explorer, dossier detail pages, and methodology sections.

## Structure
- `src/orchestrator.py` — Main entry point (launches all 7 agents as async tasks)
- `src/agents/` — Agent implementations (scout, courier, reader, detective, researcher, editor, designer)
- `src/agents/skills/` — Agent persona/behavior markdown files
- `src/db.py` — Shared Supabase client and all CRUD operations
- `src/reextract_features.py` — Standalone full-archive re-extraction pipeline
- `src/score_features.py` — Opus Vision v2.2 aesthetic scoring pipeline
- `src/bulk_crossref.py` — Batch cross-reference runner
- `src/graph_db.py` / `src/sync_graph.py` — Neo4j graph sync
- `src/graph_analytics.py` / `src/graph_queries.py` — NetworkX analytics + Cypher queries
- `web/` — Next.js 16 website (App Router, Tailwind v4, Shadcn UI)
- `tools/agent-office/` — Real-time pixel-art agent dashboard
- `docs/` — Architecture, changelog, project status, schema, aesthetic scoring instrument
- `data/` — Local pipeline state (ledger, verdicts, memories, costs)

## Setup
- **Python 3.14** — pipeline and agents
- **Node.js** — Next.js website in `web/`
- Environment variables in `.env` (not tracked): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- Use `python-dotenv` to load env vars
- **To run pipeline:** `cd AD-EPSTEIN-INDEX && python3 src/orchestrator.py --daemon`
- **To run website:** `cd web && npm run dev` (localhost:3000)
- **To deploy website:** `cd web && vercel deploy --prod --yes`

## Multi-Agent System

7 autonomous agents coordinated by Miranda (Editor) via asyncio.Queue:

| Agent | Name | Role |
|-------|------|------|
| Scout | Arthur | Discovers AD issues (AD Archive HTTP + archive.org API) |
| Courier | Casey | Downloads PDFs + scrapes AD Archive via JWT/Anthropic API |
| Reader | Elias | Extracts homeowner data from PDFs via Claude Vision |
| Detective | Silas | Cross-references names against BB + DOJ (Playwright) |
| Researcher | Elena | Builds dossiers with graph intelligence + pattern analysis |
| Editor | Miranda | Central coordinator — only agent that writes to Supabase |
| Designer | Sable | Learns design patterns from training sources |

**Slash commands:** `/talk-to-editor`, `/talk-to-reader`, `/talk-to-researcher`, `/talk-to-detective`, `/talk-to-scout`, `/talk-to-courier`, `/epstein-search <name>`, `/black-book-search <name>`, `/design-agent`, `/update-docs-and-commit`

## Git Workflow

**Commits:**
- Commit directly to `main` for iterative work (this is a solo research project)
- Use feature branches for large structural changes if needed
- Write clear commit messages describing the change
- Use `/update-docs-and-commit` for commits — ensures docs stay in sync
- NEVER force push to `main`

**Before pushing website changes:**
1. `cd web && npm run lint`
2. `cd web && npm run build` to catch type errors

## Website Tech Stack

**Stack:** Next.js 16 (App Router), Tailwind CSS v4, Shadcn UI, Recharts 3.7, react-force-graph-2d

**Deployment:** Vercel (`ad-epstein-index` project, `prj_umuAg0tLzdHUFH0cqOD1Bj3tzQaI`)

**Key patterns:**
- Server-side Supabase only (service key never exposed to client)
- `export const dynamic = "force-dynamic"` on homepage (avoids ISR build timeout)
- Recharts components need `useMounted()` guard for SSR
- NEVER use `style` as a data field name in Recharts (crashes React 19)
- CSS `calc()` does NOT work on `<col>` elements — use plain percentages

## Constraints & Policies

**Security — MUST follow:**
- NEVER expose `SUPABASE_SERVICE_KEY` or `ANTHROPIC_API_KEY` to the client
- ALWAYS use environment variables for secrets
- NEVER commit `.env` or `.env.local` or any file with API keys
- Validate and sanitize all user input

**Code quality:**
- TypeScript strict mode for web/
- Run `npm run lint` before committing web changes
- No `any` types without justification
- Prefer Shadcn components over adding new UI libraries

**Investigation policy:**
- "Confirmed" means documented proximity to Epstein, NOT guilt
- BB full name match + context = confirmed. BB last_name_only = weak signal (investigate but expect false positives)
- Fame is NEVER a dismissal factor
- Always clarify policy implications and ask before changing investigation logic

## Documentation

**Files:**
- [Project Spec](project_spec.md) — Full requirements, API specs, tech details
- [Architecture](docs/architecture.md) — System design and data flow
- [Changelog](docs/changelog.md) — Version history
- [Project Status](docs/project_status.md) — Current progress
- [Schema](docs/schema.sql) — Database schema definitions
- [Aesthetic Scoring Instrument](docs/aesthetic-scoring-instrument.md) — 9-axis v2 rubric

**Auto-update rules — MUST follow:**
- ALWAYS update `docs/project_status.md` when a milestone is completed, started, or priorities change
- ALWAYS update `docs/changelog.md` when making code changes (new features, bug fixes, config changes)
- Update `docs/architecture.md` when adding new components, services, tables, or changing data flow
- Update `docs/schema.sql` when the database schema changes
- Use the `/update-docs-and-commit` slash command when making git commits
- When in doubt, update the docs. Stale docs are worse than no docs.

## Personal Learning Goals

The project owner is learning AI-based development. Claude should keep this in mind:

**1. Teach as we build:**
- Explain key concepts when they come up naturally
- When introducing a new tool, pattern, or technique, briefly explain *what* it is and *why* we're using it
- When there's a choice to make, explain the trade-offs so the user builds intuition

**2. MCP servers & multi-agent AI:**
- Look for opportunities to incorporate MCP servers where they add value
- Suggest multi-agent patterns when tasks could benefit from parallelism or specialization
- Proactively recommend when an MCP approach would be useful vs. overkill

## Conventions
- Keep secrets out of version control
- Write tests in `tests/`
- Supabase is the single source of truth for pipeline state
- Only Editor writes pipeline state to Supabase — other agents report via outbox
