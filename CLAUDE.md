# AD-Epstein-Index

## Project Overview
A research and data project that builds a comprehensive database of all issues of Architectural Digest magazine. The goal is to extract and catalog the homeowners/clients featured in each issue, along with key metrics about their homes.

## Data Model
Each featured home entry should capture:
- **Homeowner/Client** — Name of the person(s) featured
- **Issue** — Magazine issue (month/year)
- **Interior Designer / Architecture Firm** — Who designed or built the home
- **Year Built** — Construction or renovation year
- **Square Footage** — Size of the home
- **Cost** — Cost of the home or renovation
- **Location** — City, state, or country
- **Design Style** — Architectural or interior design style (e.g., Mid-Century Modern, Art Deco)

## Project Phases

### Phase 1: Build the AD Database
Create a comprehensive database of all homeowners/clients featured in every issue of Architectural Digest, along with associated home metrics.

### Phase 2: Cross-Reference with Epstein Records
Cross-reference every name from the AD database against the DOJ's Full Epstein Library (https://www.justice.gov/epstein) to identify any matches between AD-featured individuals and names appearing in the Epstein documents.

### Phase 3: Interactive Visualization Website
Build a public-facing website with compelling interactive visualizations, including:
- Frequency of Epstein-linked names in AD over time
- Trend analysis across different eras of the magazine
- Correlations between matched names and design styles, locations, or interior designers
- Highlighted timeframes of interest
- Searchable index of all collected data

## Structure
- `main.py` — Entry point
- `src/` — Source code
- `docs/` — Documentation
- `tests/` — Test files

## Setup
- Python project
- Environment variables stored in `.env` (not tracked by git)
- Use `python-dotenv` to load env vars

## Repository Etiquette

**Branching:**/
- ALWAYS create a feature branch before starting major changes
- NEVER commit directly to `main`
- Branch naming: `feature/description` or `fix/description`

**Git workflow for major changes:**
1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Develop and commit on the feature branch
3. Test locally before pushing:
   - `npm run dev` — start dev server at localhost:3000
   - `npm run lint` — check for linting errors
   - `npm run build` — production build to catch type errors
4. Push the branch: `git push -u origin feature/your-feature-name`
5. Create a PR to merge into `main`
6. Use the `/update-docs-and-commit` slash command for commits — this ensures docs are updated alongside code changes

**Commits:**
- Write clear commit messages describing the change
- Keep commits focused on single changes

**Pull Requests:**
- Create PRs for all changes to `main`
- NEVER force push to `main`
- Include description of what changed and why

**Before pushing:**
1. Run `npm run lint`
2. Run `npm run build` to catch type errors

## Design Style Guide

**Tech stack:** Next.js (App Router), Tailwind CSS, Shadcn UI

**Visual style:**
- Clean, minimal interface — the thumbnail is the star
- Use Shadcn components for consistency
- Responsive design (mobile-first)
- No dark mode for MVP

**Component patterns:**
- Shadcn UI for all interactive elements (buttons, inputs, cards)
- Tailwind for layout and spacing
- Keep components focused and small

## Product & UX Guidelines

**Core UX principles:**
- Speed over perfection — get thumbnails fast, iterate quickly
- Show the enhanced prompt — it's educational for the user
- One-click regenerate — easy to try again
- Instant download — no extra steps

**Copy tone:**
- Casual, friendly, creator-focused
- Brief labels and instructions
- Helpful error messages that suggest next steps

## Constraints & Policies

**Security — MUST follow:**
- NEVER expose `GEMINI_API_KEY` to the client — server-side only
- ALWAYS use environment variables for secrets
- NEVER commit `.env.local` or any file with API keys
- Validate and sanitize all user input

**Code quality:**
- TypeScript strict mode
- Run `npm run lint` before committing
- No `any` types without justification

**Dependencies:**
- Prefer Shadcn components over adding new UI libraries
- Minimize external dependencies for MVP

## Documentation

**Files:**
- [Project Spec](project_spec.md) — Full requirements, API specs, tech details
- [Architecture](docs/architecture.md) — System design and data flow
- [Changelog](docs/changelog.md) — Version history
- [Project Status](docs/project_status.md) — Current progress
- [Schema](docs/schema.sql) — Database schema definitions

**Auto-update rules — MUST follow:**
- ALWAYS update `docs/project_status.md` when a milestone is completed, started, or priorities change
- ALWAYS update `docs/changelog.md` when making code changes (new features, bug fixes, config changes)
- Update `docs/architecture.md` when adding new components, services, tables, or changing data flow
- Update `docs/schema.sql` when the database schema changes
- Update `project_spec.md` when requirements or tech decisions are finalized
- Use the `/update-docs-and-commit` slash command when making git commits — this ensures docs and code stay in sync
- When in doubt, update the docs. Stale docs are worse than no docs.

## Personal Learning Goals

The project owner is learning AI-based development. Claude should keep this in mind:

**1. Teach as we build:**
- Treat the user as a beginner — explain key concepts when they come up naturally
- When introducing a new tool, pattern, or technique, briefly explain *what* it is and *why* we're using it
- Don't assume familiarity with terms like "embeddings," "RAG," "tokens," etc. — define them on first use
- When there's a choice to make, explain the trade-offs so the user builds intuition

**2. MCP servers & multi-agent AI:**
- Look for opportunities to incorporate MCP (Model Context Protocol) servers into the project where they add value
- Suggest multi-agent patterns when tasks could benefit from parallelism or specialization (e.g., one agent extracts names, another validates against the Epstein library)
- Explain what MCP servers are and how they work when the time comes to set them up
- Proactively recommend when an MCP server or multi-agent approach would be useful vs. overkill

## Conventions
- Keep secrets out of version control
- Write tests in `tests/`