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
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(url, key)

# Fields that map directly from extraction JSON to the features table
FEATURE_FIELDS = [
    "article_title", "article_author", "homeowner_name", "designer_name", "architecture_firm",
    "year_built", "square_footage", "cost", "location_city",
    "location_state", "location_country", "design_style", "page_number", "notes",
]


def get_or_create_issue(month, year, cover_description=None):
    """Get existing issue or create a new one. Returns the issue ID."""
    # Check if issue already exists
    existing = (
        supabase.table("issues")
        .select("id")
        .eq("month", month)
        .eq("year", year)
        .execute()
    )

    if existing.data:
        return existing.data[0]["id"]

    # Create new issue
    issue_data = {"month": month, "year": year}
    if cover_description:
        issue_data["cover_description"] = cover_description

    result = supabase.table("issues").insert(issue_data).execute()
    return result.data[0]["id"]


def feature_exists(issue_id, page_number):
    """Check if a feature already exists for this issue + page."""
    existing = (
        supabase.table("features")
        .select("id")
        .eq("issue_id", issue_id)
        .eq("page_number", page_number)
        .execute()
    )
    return len(existing.data) > 0


def load_extraction(extraction_path):
    """Load a single extraction JSON file into Supabase."""
    with open(extraction_path) as f:
        data = json.load(f)

    month = data.get("month")
    year = data.get("year")

    if not month or not year:
        print(f"  Skipping {data.get('identifier')} — missing month/year")
        return 0

    # Get or create the issue
    issue_id = get_or_create_issue(month, year)
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
        row = {"issue_id": issue_id}
        for field in FEATURE_FIELDS:
            value = feature.get(field)
            if value is not None:
                row[field] = value

        supabase.table("features").insert(row).execute()
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
