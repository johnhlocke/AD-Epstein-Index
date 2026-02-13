"""
Step 4: Load extracted feature data into Supabase.

Reads JSON extraction files and inserts issues + features into the database.
Skips duplicates (checks by month/year for issues, issue_id + page_number for features).

Usage:
    python3 src/load_features.py                          # Load all extractions
    python3 src/load_features.py --issue <identifier>     # Load one specific issue
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))

from db import get_supabase, get_or_create_issue, feature_exists, insert_feature

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")

# Fields that map directly from extraction JSON to the features table
FEATURE_FIELDS = [
    "article_title", "article_author", "homeowner_name", "designer_name", "architecture_firm",
    "year_built", "square_footage", "cost", "location_city",
    "location_state", "location_country", "design_style", "page_number", "notes",
    "aesthetic_profile",
]

# Fields that should be stored as JSONB (not strings)
JSONB_FIELDS = {"aesthetic_profile"}

# Fields that must be integers in Supabase (Claude sometimes returns "35,000" or "3500 sq ft")
INTEGER_FIELDS = {"year_built", "square_footage", "page_number"}


def _sanitize_integer(value):
    """Convert a value to int, stripping commas and non-numeric suffixes.

    Returns int or None if not parseable.
    """
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        # Strip commas, whitespace, and common suffixes
        cleaned = value.replace(",", "").strip()
        # Extract leading digits only (handles "3500 sq ft", "2005-2006", etc.)
        match = re.match(r"(\d+)", cleaned)
        if match:
            return int(match.group(1))
    return None


def load_extraction(extraction_path):
    """Load a single extraction JSON file into Supabase."""
    with open(extraction_path) as f:
        data = json.load(f)

    month = data.get("month")
    year = data.get("year")

    if not month or not year:
        print(f"  Skipping {data.get('identifier')} — missing month/year")
        return 0

    identifier = data.get("identifier")

    # Get or create the issue (now uses db.py shared module)
    issue_id = get_or_create_issue(month, year, identifier=identifier)
    print(f"  Issue: {year}-{month:02d} (id={issue_id})")

    # Insert features
    inserted = 0
    for feature in data.get("features", []):
        page = feature.get("page_number")

        # Skip if no page number or already exists
        if not page:
            continue
        if feature_exists(issue_id, page):
            print(f"    Skipping page {page} (already exists)")
            continue

        # Build the row from known fields
        row = {}
        for field in FEATURE_FIELDS:
            value = feature.get(field)
            if value is not None:
                if field in INTEGER_FIELDS:
                    value = _sanitize_integer(value)
                    if value is None:
                        continue
                if field in JSONB_FIELDS and isinstance(value, dict):
                    value = json.dumps(value)
                row[field] = value

        insert_feature(issue_id, row)
        homeowner = row.get("homeowner_name", "Unknown")
        print(f"    Inserted: {homeowner} (page {page})")
        inserted += 1

    return inserted


def load_all(identifier=None):
    """Load all extraction files or a specific one."""
    if not os.path.exists(EXTRACTIONS_DIR):
        print("No extractions directory found. Run extract_features.py first.")
        return

    if identifier:
        path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
        if not os.path.exists(path):
            print(f"Extraction file not found: {path}")
            return
        files = [path]
    else:
        files = sorted([
            os.path.join(EXTRACTIONS_DIR, f)
            for f in os.listdir(EXTRACTIONS_DIR)
            if f.endswith(".json")
        ])

    if not files:
        print("No extraction files found.")
        return

    print(f"Loading {len(files)} extraction files into Supabase...\n")

    total_inserted = 0
    for filepath in files:
        filename = os.path.basename(filepath)
        print(f"Processing: {filename}")
        inserted = load_extraction(filepath)
        total_inserted += inserted

    print(f"\nDone! Inserted {total_inserted} features total.")


if __name__ == "__main__":
    identifier = None
    if "--issue" in sys.argv:
        idx = sys.argv.index("--issue")
        identifier = sys.argv[idx + 1]
    load_all(identifier=identifier)
