"""
AD Magazine PDF Ingestion Pipeline — Orchestrator

Runs the full pipeline or individual steps for processing AD magazine issues
from the Internet Archive into the Supabase database.

Usage:
    python3 src/pipeline.py discover    # Step 1: Find issues on archive.org
    python3 src/pipeline.py download    # Step 2: Download PDFs
    python3 src/pipeline.py extract     # Step 3: Extract data with Gemini Vision
    python3 src/pipeline.py load        # Step 4: Load into Supabase
    python3 src/pipeline.py run         # All steps in sequence
    python3 src/pipeline.py status      # Show progress summary

Options:
    --limit N                           # Limit to N items (for download/extract)
    --issue <identifier>                # Process one specific issue (for extract/load)
    --reextract                         # Re-extract issues with NULL homeowner names
"""

import os
import sys


def show_status():
    """Show pipeline progress summary from Supabase."""
    from dotenv import load_dotenv
    load_dotenv()

    print("=" * 60)
    print("AD Magazine Pipeline — Status")
    print("=" * 60)

    try:
        from db import count_issues_by_status, get_supabase
        counts = count_issues_by_status()
    except Exception as e:
        print(f"\nError connecting to Supabase: {e}")
        print("Make sure SUPABASE_URL and SUPABASE_KEY are set in .env")
        return

    total = sum(counts.values())
    discovered = counts.get("discovered", 0)
    downloaded = counts.get("downloaded", 0)
    extracted = counts.get("extracted", 0)
    skipped = counts.get("skipped_pre1988", 0)
    no_pdf = counts.get("no_pdf", 0)
    errors = counts.get("error", 0) + counts.get("extraction_error", 0)

    print(f"\nStep 1 (Discover): {total} issues in database")
    print(f"  {discovered} awaiting download")

    print(f"\nStep 2 (Download): {downloaded + extracted} PDFs downloaded")
    if no_pdf:
        print(f"  {no_pdf} items had no PDF available")
    if errors:
        print(f"  {errors} errors")

    print(f"\nStep 3 (Extract): {extracted} issues extracted, {skipped} skipped (pre-1988)")

    # Feature count from Supabase
    try:
        sb = get_supabase()
        result = sb.table("features").select("id", count="exact").execute()
        feature_count = result.count if result.count is not None else len(result.data)
        print(f"  {feature_count} total features in database")
    except Exception:
        pass

    print(f"\nStep 4 (Load): Supabase connected")
    print("=" * 60)


def run_discover():
    """Step 1: Discover issues on archive.org."""
    print("\n--- Step 1: Discovering issues on archive.org ---\n")
    from archive_discovery import discover
    discover()


def run_download(limit=None):
    """Step 2: Download PDFs."""
    print("\n--- Step 2: Downloading PDFs ---\n")
    from archive_download import download_issues
    download_issues(limit=limit)


def run_extract(limit=None, identifier=None, reextract=False):
    """Step 3: Extract features with Gemini Vision."""
    print("\n--- Step 3: Extracting features with Gemini Vision ---\n")
    from extract_features import extract_all
    extract_all(limit=limit, identifier=identifier, reextract=reextract)


def run_load(identifier=None):
    """Step 4: Load into Supabase."""
    print("\n--- Step 4: Loading into Supabase ---\n")
    from load_features import load_all
    load_all(identifier=identifier)


def run_xref():
    """Step 5: Cross-reference names against Epstein sources."""
    print("\n--- Step 5: Cross-referencing against Epstein sources ---\n")
    from cross_reference import cross_reference_all
    cross_reference_all()


def run_all(limit=None):
    """Run all steps in sequence."""
    run_discover()
    run_download(limit=limit)
    run_extract(limit=limit)
    run_load()
    run_xref()
    show_status()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1]

    # Parse optional flags
    limit = None
    identifier = None
    reextract = "--reextract" in sys.argv
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        limit = int(sys.argv[idx + 1])
    if "--issue" in sys.argv:
        idx = sys.argv.index("--issue")
        identifier = sys.argv[idx + 1]

    if command == "discover":
        run_discover()
    elif command == "download":
        run_download(limit=limit)
    elif command == "extract":
        run_extract(limit=limit, identifier=identifier, reextract=reextract)
    elif command == "load":
        run_load(identifier=identifier)
    elif command == "xref":
        run_xref()
    elif command == "run":
        run_all(limit=limit)
    elif command == "status":
        show_status()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
