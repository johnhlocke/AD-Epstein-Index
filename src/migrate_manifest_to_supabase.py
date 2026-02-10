"""
One-time migration: archive_manifest.json → Supabase issues table.

Reads the local manifest (164 issues) and reconciles with existing Supabase
issues (26 rows that have month/year but no identifier). Backfills pipeline
tracking columns and inserts new rows for issues not yet in Supabase.

Usage:
    python3 src/migrate_manifest_to_supabase.py              # Dry run (preview)
    python3 src/migrate_manifest_to_supabase.py --apply       # Apply changes

The local manifest file is NOT deleted — it stays as a frozen backup.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from db import get_supabase

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MANIFEST_PATH = os.path.join(DATA_DIR, "archive_manifest.json")


def load_manifest():
    """Load the local archive_manifest.json."""
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    return manifest.get("issues", [])


def load_supabase_issues():
    """Load all existing issues from Supabase."""
    sb = get_supabase()
    result = sb.table("issues").select("*").execute()
    return result.data


def reconcile(manifest_issues, supabase_issues, dry_run=True):
    """Match manifest entries to existing Supabase rows, then insert the rest.

    Matching strategy:
    1. Try (month, year) match — existing Supabase rows only have month/year
    2. Try (verified_month, verified_year) match — load_features.py used verified dates
    3. If no match, insert as new row
    """
    sb = get_supabase()

    # Build lookup: (month, year) → list of Supabase rows
    sb_by_month_year = {}
    for row in supabase_issues:
        key = (row.get("month"), row.get("year"))
        sb_by_month_year.setdefault(key, []).append(row)

    # Also build identifier lookup for already-migrated rows (re-run safety)
    sb_by_identifier = {}
    for row in supabase_issues:
        if row.get("identifier"):
            sb_by_identifier[row["identifier"]] = row

    # Track which Supabase rows we've matched
    matched_sb_ids = set()
    updates = []  # (supabase_id, update_data)
    inserts = []  # new row dicts
    skipped = []  # already migrated

    skipped_pre1988 = 0

    for item in manifest_issues:
        identifier = item["identifier"]
        month = item.get("month")
        year = item.get("year")
        v_month = item.get("verified_month")
        v_year = item.get("verified_year")

        # Skip pre-1988 entries entirely — they're not useful for the project
        eff_year = v_year or year
        status = item.get("status", "discovered")
        if status == "skipped_pre1988" or (eff_year and eff_year < 1988):
            skipped_pre1988 += 1
            continue

        # Build the update payload from manifest fields
        update_data = {
            "identifier": identifier,
            "title": item.get("title"),
            "status": item.get("status", "discovered"),
            "pdf_path": item.get("pdf_path"),
            "source": "archive.org",
            "source_url": item.get("source_url"),
            "date_confidence": item.get("date_confidence", "medium"),
            "date_source": item.get("date_source"),
            "verified_month": v_month,
            "verified_year": v_year,
            "needs_review": item.get("needs_review", False),
            "archive_date": item.get("date"),
        }

        # Also update month/year if manifest has verified values
        if v_month:
            update_data["month"] = v_month
        if v_year:
            update_data["year"] = v_year

        # Check if already migrated (re-run safety)
        if identifier in sb_by_identifier:
            existing = sb_by_identifier[identifier]
            matched_sb_ids.add(existing["id"])
            skipped.append(identifier)
            continue

        # Try to find a matching Supabase row (without identifier yet)
        # Strategy 1: match by original (month, year)
        match = None
        key = (month, year)
        candidates = sb_by_month_year.get(key, [])
        unmatched = [c for c in candidates if c["id"] not in matched_sb_ids and not c.get("identifier")]
        if unmatched:
            match = unmatched[0]

        # Strategy 2: match by verified date (load_features used this when creating rows)
        if not match and (v_month or v_year):
            v_key = (v_month or month, v_year or year)
            if v_key != key:
                candidates2 = sb_by_month_year.get(v_key, [])
                unmatched2 = [c for c in candidates2 if c["id"] not in matched_sb_ids and not c.get("identifier")]
                if unmatched2:
                    match = unmatched2[0]

        if match:
            matched_sb_ids.add(match["id"])
            updates.append((match["id"], update_data))
        else:
            # No existing row — insert new
            insert_row = {
                "month": v_month or month,
                "year": v_year or year,
            }
            insert_row.update(update_data)
            inserts.append(insert_row)

    # Report unmatched Supabase rows (exist in DB but not in manifest)
    unmatched_sb = [row for row in supabase_issues if row["id"] not in matched_sb_ids]

    # Print summary
    print(f"\n{'=' * 60}")
    print(f"Migration Summary {'(DRY RUN)' if dry_run else '(APPLYING)'}")
    print(f"{'=' * 60}")
    print(f"Manifest issues:        {len(manifest_issues)}")
    print(f"Supabase issues:        {len(supabase_issues)}")
    print(f"Matched (update):       {len(updates)}")
    print(f"New (insert):           {len(inserts)}")
    print(f"Already migrated:       {len(skipped)}")
    print(f"Skipped (pre-1988):     {skipped_pre1988}")
    print(f"Unmatched Supabase:     {len(unmatched_sb)}")

    if unmatched_sb:
        print(f"\nUnmatched Supabase rows (not in manifest — will be left as-is):")
        for row in unmatched_sb:
            print(f"  id={row['id']} {row['year']}-{row.get('month', '?')}")

    # Status breakdown of what we're migrating
    from collections import Counter
    status_counts = Counter()
    for _, data in updates:
        status_counts[data.get("status", "discovered")] += 1
    for row in inserts:
        status_counts[row.get("status", "discovered")] += 1
    print(f"\nStatus breakdown after migration:")
    for status, count in sorted(status_counts.items()):
        print(f"  {status}: {count}")

    if dry_run:
        print(f"\nRun with --apply to execute the migration.")
        return

    # Apply updates
    print(f"\nApplying {len(updates)} updates...")
    for sb_id, data in updates:
        sb.table("issues").update(data).eq("id", sb_id).execute()

    # Apply inserts
    print(f"Inserting {len(inserts)} new rows...")
    if inserts:
        # Insert in batches of 50
        for i in range(0, len(inserts), 50):
            batch = inserts[i:i+50]
            sb.table("issues").insert(batch).execute()

    # Verify
    print(f"\nVerifying...")
    final = sb.table("issues").select("id,identifier,status").execute()
    final_counts = Counter(row.get("status", "discovered") for row in final.data)
    print(f"Final Supabase issues: {len(final.data)}")
    print(f"Final status breakdown:")
    for status, count in sorted(final_counts.items()):
        print(f"  {status}: {count}")

    # Count how many have identifiers
    with_id = sum(1 for row in final.data if row.get("identifier"))
    print(f"With identifier: {with_id}/{len(final.data)}")

    print(f"\nMigration complete!")


def main():
    apply = "--apply" in sys.argv

    print("Loading manifest...")
    manifest_issues = load_manifest()

    print("Loading Supabase issues...")
    supabase_issues = load_supabase_issues()

    reconcile(manifest_issues, supabase_issues, dry_run=not apply)


if __name__ == "__main__":
    main()
