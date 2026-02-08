# AD-Epstein-Index

A research project that builds a comprehensive database of homeowners featured in Architectural Digest magazine and cross-references them against the DOJ's Epstein records.

## What This Project Does

**Phase 1: Build the AD Database**
Extract and catalog every homeowner/client featured in Architectural Digest, along with their home's designer, architect, location, style, and other metrics.

**Phase 2: Cross-Reference with Epstein Records**
Match AD-featured names against the [DOJ Epstein Library](https://www.justice.gov/epstein) and Epstein's Little Black Book to identify any overlaps.

**Phase 3: Interactive Visualization Website**
A public-facing site with searchable index, interactive timelines, trend analysis, and correlation visualizations.

## Current Status

Phase 1 is in progress. The automated pipeline downloads AD magazine PDFs from the Internet Archive, extracts featured home data using Gemini Vision AI, and loads it into a Supabase database. See [Project Status](docs/project_status.md) for details.

## How It Works

```
archive.org API → Download PDFs → pdftoppm (images) → Gemini 2.0 Flash Vision → Supabase
```

The pipeline has four steps, run via a single CLI:

```bash
python3 src/pipeline.py discover    # Find AD issues on archive.org
python3 src/pipeline.py download    # Download PDFs
python3 src/pipeline.py extract     # Extract homeowner data with Gemini Vision
python3 src/pipeline.py load        # Load into Supabase
python3 src/pipeline.py status      # Show progress
```

## Data Model

Each featured home entry captures:

| Field | Description |
|-------|-------------|
| Homeowner/Client | Name of the person(s) featured |
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
   pip install supabase python-dotenv requests google-genai
   ```
3. Install [poppler](https://poppler.freedesktop.org/) for PDF processing (`brew install poppler` on macOS)
4. Create a `.env` file with:
   ```
   GEMINI_API_KEY=your_key_here
   SUPABASE_URL=your_url_here
   SUPABASE_ANON_KEY=your_key_here
   ```
5. Set up the database using [docs/schema.sql](docs/schema.sql)

## Project Structure

```
src/
  pipeline.py              # CLI orchestrator
  archive_discovery.py     # Step 1: Search archive.org for AD issues
  archive_download.py      # Step 2: Download PDFs
  extract_features.py      # Step 3: Gemini Vision extraction
  load_features.py         # Step 4: Load into Supabase
  seed_may_2013.py         # Proof-of-concept seed data
docs/
  architecture.md          # System design and data flow
  changelog.md             # Version history
  project_status.md        # Current progress
  schema.sql               # Database schema
```

## Documentation

- [Architecture](docs/architecture.md) — System design, pipeline flow, component details
- [Changelog](docs/changelog.md) — Version history
- [Project Status](docs/project_status.md) — Milestones and current progress
- [Schema](docs/schema.sql) — Database table definitions

## License

This is a research project for educational and journalistic purposes.
