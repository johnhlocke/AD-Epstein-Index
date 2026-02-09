# AD-Epstein-Index

A research project that builds a comprehensive database of homeowners featured in Architectural Digest magazine and cross-references them against the DOJ's Epstein records. Powered by a 7-agent autonomous AI system.

## What This Project Does

**Phase 1: Build the AD Database**
Extract and catalog every homeowner/client featured in Architectural Digest, along with their home's designer, architect, location, style, article author, and other metrics.

**Phase 2: Cross-Reference with Epstein Records**
Match AD-featured names against the [DOJ Epstein Library](https://www.justice.gov/epstein) and Epstein's Little Black Book. Build investigative dossiers on flagged leads with pattern analysis.

**Phase 3: Interactive Visualization Website**
A public-facing site with searchable index, interactive timelines, dossier viewer, and correlation visualizations.

## Current Status

Phases 1 and 2 are in progress. A multi-agent system autonomously discovers, downloads, extracts, cross-references, and investigates AD issues. See [Project Status](docs/project_status.md) for details.

## How It Works

### Multi-Agent Pipeline

Seven specialized AI agents run autonomously, coordinated by an orchestrator:

```
Scout → Courier → Reader → Detective → Researcher
  │         │         │         │            │
  │         │         │         │            └── Builds dossiers (Claude Haiku)
  │         │         │         └── Cross-refs BB + DOJ (Playwright)
  │         │         └── Extracts features (Claude Sonnet Vision)
  │         └── Downloads PDFs
  └── Discovers issues on archive.org

Editor — monitors pipeline health, processes human messages
Designer — learns design patterns from training sources
```

| Agent | What It Does |
|-------|-------------|
| **Scout** | Discovers AD issues on archive.org |
| **Courier** | Downloads PDFs with rate limiting |
| **Reader** | Extracts homeowner data using Claude Sonnet Vision |
| **Detective** | Cross-references names against Epstein's Black Book + DOJ Library |
| **Researcher** | Builds investigative dossiers with pattern analysis + home-as-evidence |
| **Editor** | Monitors pipeline health, handles escalations |
| **Designer** | Learns design patterns from training sources |

### Agent Office Dashboard

A pixel-art real-time visualization shows all agents working at their desks with live status updates, activity logs, and pipeline metrics.

![Agent Office](tools/agent-office/bg-office-clear.png)

### Running the System

```bash
# Start the full multi-agent system
python3 src/orchestrator.py

# Start the dashboard server (serves Agent Office UI)
python3 src/dashboard_server.py

# Open the Agent Office in a browser
open tools/agent-office/agent-office.html
```

Or use the legacy single-step pipeline CLI:

```bash
python3 src/pipeline.py discover    # Find AD issues on archive.org
python3 src/pipeline.py download    # Download PDFs
python3 src/pipeline.py extract     # Extract homeowner data with Claude Sonnet Vision
python3 src/pipeline.py load        # Load into Supabase
python3 src/pipeline.py xref        # Cross-reference against Epstein records
python3 src/pipeline.py status      # Show progress
```

## Data Model

Each featured home entry captures:

| Field | Description |
|-------|-------------|
| Homeowner/Client | Name of the person(s) featured |
| Article Author | Journalist who wrote the article |
| Issue | Magazine issue (month/year) |
| Designer / Architect | Interior designer or architecture firm |
| Year Built | Construction or renovation year |
| Square Footage | Size of the home |
| Cost | Cost of the home or renovation |
| Location | City, state, country |
| Design Style | e.g., Mid-Century Modern, Art Deco, Mediterranean |

## Setup

1. Clone the repo
2. Create a Python virtual environment and install dependencies:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install supabase python-dotenv requests anthropic
   ```
3. Install [poppler](https://poppler.freedesktop.org/) for PDF processing (`brew install poppler` on macOS)
4. Create a `.env` file with:
   ```
   ANTHROPIC_API_KEY=your_key_here
   SUPABASE_URL=your_url_here
   SUPABASE_ANON_KEY=your_key_here
   ```
5. Set up the database using [docs/schema.sql](docs/schema.sql)

## Project Structure

```
src/
  orchestrator.py            # Multi-agent orchestrator (launches all 7 agents)
  dashboard_server.py        # HTTP server for Agent Office UI + API
  agent_status.py            # Generates status.json from live pipeline data
  doj_search.py              # Playwright-based DOJ Epstein Library search
  pipeline.py                # Legacy CLI orchestrator
  extract_features.py        # Claude Sonnet Vision extraction
  load_features.py           # Load into Supabase
  cross_reference.py         # Batch cross-reference engine
  archive_discovery.py       # Step 1: Search archive.org
  archive_download.py        # Step 2: Download PDFs
  agents/
    base.py                  # Agent base class (async loop, pause, progress)
    scout.py                 # Discovers AD issues
    courier.py               # Downloads PDFs
    reader.py                # Extracts features via Claude Vision
    detective.py             # Cross-references against Epstein records
    researcher.py            # Builds dossiers on flagged leads
    editor.py                # Pipeline oversight + human messages
    designer.py              # Learns design patterns
    skills/                  # Per-agent behavior docs (*.md)
tools/
  agent-office/
    agent-office.html        # Real-time pixel-art dashboard
    status.json              # Live status data (written by orchestrator)
    *.png                    # Agent sprites and office background
docs/
  architecture.md            # System design and data flow
  changelog.md               # Version history
  project_status.md          # Current progress
  schema.sql                 # Database schema
```

## Documentation

- [Architecture](docs/architecture.md) — System design, agent pipeline, component details
- [Changelog](docs/changelog.md) — Version history
- [Project Status](docs/project_status.md) — Milestones and current progress
- [Schema](docs/schema.sql) — Database table definitions

## License

This is a research project for educational and journalistic purposes.
