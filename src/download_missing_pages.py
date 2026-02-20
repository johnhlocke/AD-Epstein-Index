#!/usr/bin/env python3
"""Download missing page images identified by the spread data gap analysis.

Reads data/spread_gap_report.json and downloads missing pages from Azure Blob
into the correct Supabase Storage bucket for each feature.

Usage:
    python3 src/download_missing_pages.py              # Full run
    python3 src/download_missing_pages.py --limit 50   # Test on 50 features
    python3 src/download_missing_pages.py --dry-run     # Report only
"""

import argparse
import json
import os
import sys
import time

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
AD_BLOB = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
SUPABASE_URL = os.environ["SUPABASE_URL"]


def get_issue_dates():
    """Fetch all issues and return {issue_id: 'YYYYMMDD'} mapping."""
    issues = {}
    offset = 0
    while True:
        batch = sb.from_("issues").select("id, year, month").range(offset, offset + 999).execute()
        for row in batch.data:
            y = row["year"]
            m = row["month"]
            if y and m:
                issues[row["id"]] = f"{y}{m:02d}01"
        if len(batch.data) < 1000:
            break
        offset += 1000
    return issues


def get_feature_buckets_bulk():
    """Determine which bucket each feature uses by scanning all images once."""
    buckets = {}
    offset = 0
    while True:
        batch = sb.from_("feature_images").select(
            "feature_id, public_url"
        ).range(offset, offset + 999).execute()
        for row in batch.data:
            fid = row["feature_id"]
            if fid not in buckets:
                url = row["public_url"]
                buckets[fid] = "dossier-images" if "dossier-images" in url else "feature-images"
        if len(batch.data) < 1000:
            break
        offset += 1000
    return buckets


def get_feature_issue_map_bulk():
    """Map all feature_id -> issue_id in bulk."""
    mapping = {}
    offset = 0
    while True:
        batch = sb.from_("features").select("id, issue_id").range(offset, offset + 999).execute()
        for row in batch.data:
            mapping[row["id"]] = row["issue_id"]
        if len(batch.data) < 1000:
            break
        offset += 1000
    return mapping


def get_existing_pages_bulk():
    """Fetch all existing (feature_id, page_number) pairs from feature_images."""
    existing = set()
    offset = 0
    while True:
        batch = sb.from_("feature_images").select(
            "feature_id, page_number"
        ).range(offset, offset + 999).execute()
        for row in batch.data:
            existing.add((row["feature_id"], row["page_number"]))
        if len(batch.data) < 1000:
            break
        offset += 1000
    return existing


def download_and_upload(feature_id, page_num, issue_date, bucket):
    """Download a page from Azure Blob and upload to Supabase Storage."""
    # Download from Azure
    url = AD_BLOB.format(date=issue_date, page=page_num)
    resp = requests.get(url, headers=HEADERS, timeout=15)
    if resp.status_code != 200 or len(resp.content) < 1000:
        return None

    # Upload to Supabase Storage (upsert: remove then upload if exists)
    storage_path = f"{feature_id}/page_{page_num:03d}.jpg"
    try:
        sb.storage.from_(bucket).upload(
            storage_path,
            resp.content,
            {"content-type": "image/jpeg"},
        )
    except Exception as e:
        err = str(e)
        if "Duplicate" in err or "already exists" in err:
            # Already in storage, just build the URL
            pass
        else:
            raise

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"
    return {
        "feature_id": feature_id,
        "page_number": page_num,
        "storage_path": storage_path,
        "public_url": public_url,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="Limit features to process")
    parser.add_argument("--dry-run", action="store_true", help="Report only")
    args = parser.parse_args()

    report_path = os.path.join(os.path.dirname(__file__), "..", "data", "spread_gap_report.json")
    with open(report_path) as f:
        gaps = json.load(f)

    print("=" * 60)
    print("DOWNLOAD MISSING PAGES")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'DOWNLOAD'}")
    print(f"Features needing pages: {len(gaps)}")
    print(f"Total missing pages: {sum(g['missing_count'] for g in gaps)}")
    print("=" * 60)

    if args.limit:
        gaps = gaps[:args.limit]
        print(f"Limited to {len(gaps)} features")

    if args.dry_run:
        return

    # Pre-fetch issue dates and feature->issue mapping
    print("Fetching issue dates...")
    issue_dates = get_issue_dates()

    feature_ids = [g["feature_id"] for g in gaps]

    print("Mapping features to issues...")
    feat_issues = get_feature_issue_map_bulk()

    print("Detecting buckets...")
    feat_buckets = get_feature_buckets_bulk()

    print("Loading existing image records...")
    existing_pages = get_existing_pages_bulk()
    print(f"  {len(existing_pages)} existing image records")

    # Filter out pages that already exist in DB
    total_to_download = 0
    for gap in gaps:
        gap["missing"] = [p for p in gap["missing"] if (gap["feature_id"], p) not in existing_pages]
        total_to_download += len(gap["missing"])
    gaps = [g for g in gaps if g["missing"]]  # Remove fully-done features
    print(f"  After filtering existing: {len(gaps)} features, {total_to_download} pages to download")

    pages_downloaded = 0
    pages_failed = 0
    features_fixed = 0
    errors = 0

    for i, gap in enumerate(gaps):
        fid = gap["feature_id"]
        missing = gap["missing"]
        issue_id = feat_issues.get(fid)
        if not issue_id:
            continue

        issue_date = issue_dates.get(issue_id)
        if not issue_date:
            continue

        bucket = feat_buckets.get(fid, "dossier-images")
        feature_pages_ok = 0

        for page_num in missing:
            try:
                result = download_and_upload(fid, page_num, issue_date, bucket)
                if result:
                    # Insert into feature_images table
                    try:
                        sb.from_("feature_images").insert(result).execute()
                    except Exception as insert_err:
                        if "duplicate" in str(insert_err).lower():
                            pass  # Already in DB
                        else:
                            raise
                    pages_downloaded += 1
                    feature_pages_ok += 1
                else:
                    pages_failed += 1
            except Exception as e:
                errors += 1
                if errors <= 10:
                    print(f"  ERROR #{fid} page {page_num}: {e}")

        if feature_pages_ok > 0:
            features_fixed += 1

        if (i + 1) % 25 == 0:
            print(f"  Progress: {i+1}/{len(gaps)}, {features_fixed} fixed, {pages_downloaded} pages downloaded, {pages_failed} failed")

        # Rate limit
        if (i + 1) % 50 == 0:
            time.sleep(1)

    print(f"\n{'=' * 60}")
    print("DONE")
    print(f"Features fixed: {features_fixed}/{len(gaps)}")
    print(f"Pages downloaded: {pages_downloaded}")
    print(f"Pages failed (404/small): {pages_failed}")
    print(f"Errors: {errors}")


if __name__ == "__main__":
    main()
