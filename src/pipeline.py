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

import json
import os
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MANIFEST_PATH = os.path.join(DATA_DIR, "archive_manifest.json")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
ISSUES_DIR = os.path.join(DATA_DIR, "issues")


def show_status():
    """Show pipeline progress summary."""
    print("=" * 60)
    print("AD Magazine Pipeline — Status")
    print("=" * 60)

    # Manifest
    if not os.path.exists(MANIFEST_PATH):
        print("\nStep 1 (Discover): Not run yet")
        return

    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    issues = manifest.get("issues", [])
    skipped = manifest.get("skipped", [])
    with_month = sum(1 for i in issues if i.get("month"))
    needs_review = sum(1 for i in issues if i.get("needs_review"))

    print(f"\nStep 1 (Discover): {len(issues)} issues found")
    print(f"  {with_month} with month/year parsed")
    print(f"  {needs_review} need manual review")
    print(f"  {len(skipped)} items skipped")

    # Downloads
    downloaded = sum(1 for i in issues if i.get("status") == "downloaded")
    no_pdf = sum(1 for i in issues if i.get("status") == "no_pdf")
    errors = sum(1 for i in issues if i.get("status") == "error")

    print(f"\nStep 2 (Download): {downloaded} PDFs downloaded")
    if no_pdf:
        print(f"  {no_pdf} items had no PDF available")
    if errors:
        print(f"  {errors} download errors")

    # Extractions
    if os.path.exists(EXTRACTIONS_DIR):
        extractions = [f for f in os.listdir(EXTRACTIONS_DIR) if f.endswith(".json")]
        total_features = 0
        skipped_pre1988 = 0
        processed = 0
        for ext_file in extractions:
            with open(os.path.join(EXTRACTIONS_DIR, ext_file)) as f:
                ext_data = json.load(f)
                if ext_data.get("skipped"):
                    skipped_pre1988 += 1
                else:
                    processed += 1
                    total_features += len(ext_data.get("features", []))
        print(f"\nStep 3 (Extract): {processed} issues extracted, {skipped_pre1988} skipped (pre-1988)")
        print(f"  {total_features} total features found")
    else:
        print(f"\nStep 3 (Extract): Not run yet")

    # Database (just check if Supabase is configured)
    from dotenv import load_dotenv
    load_dotenv()
    has_supabase = bool(os.getenv("SUPABASE_URL"))
    print(f"\nStep 4 (Load): Supabase {'configured' if has_supabase else 'NOT configured'}")

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
