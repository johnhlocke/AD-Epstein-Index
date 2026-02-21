#!/usr/bin/env python3
"""Backfill missing pages for features capped at 6 images.

For each feature with exactly 6 images:
1. Look up the JWT page range from the issue's archive URL
2. If the article has more pages than we have images, download the missing ones
3. Also handle features with 0 images

No max_images cap — downloads the full article page range.

Usage:
    python3 src/backfill_full_pages.py
    python3 src/backfill_full_pages.py --dry-run
"""

import base64
import json
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
AD_ARCHIVE_BLOB = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
BUCKET = "feature-images"


def get_sb():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def decode_jwt_featured(source_url):
    """Decode JWT tocConfig from AD archive."""
    resp = requests.get(source_url, headers=HEADERS, timeout=30)
    match = re.search(r"tocConfig\s*=\s*'([^']+)'", resp.text)
    if not match:
        return None
    jwt_token = match.group(1)
    parts = jwt_token.split(".")
    if len(parts) < 2:
        return None
    payload = parts[1]
    payload += "=" * (4 - len(payload) % 4)
    decoded = base64.urlsafe_b64decode(payload).decode("utf-8")
    data = json.loads(decoded)
    if isinstance(data, str):
        data = json.loads(data)
    return data.get("featured", [])


def find_full_page_range(featured, article_title, page_number):
    """Find article's full page range from JWT catalog."""
    if not featured:
        return None

    # Strategy 1: Match by page number (most reliable)
    if page_number:
        for art in featured:
            page_range = art.get("PageRange", "")
            pages = [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]
            if pages and page_number in pages:
                return pages
            # Also check if page_number falls within the range
            if pages and min(pages) <= page_number <= max(pages):
                return pages

    # Strategy 2: Match by article title
    if article_title and len(article_title) >= 4:
        title_upper = article_title.upper().strip()
        for art in featured:
            jwt_title = (art.get("Title") or "").upper().strip()
            if title_upper in jwt_title or jwt_title in title_upper:
                page_range = art.get("PageRange", "")
                return [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]
            title_words = [w for w in re.split(r'\W+', title_upper) if len(w) >= 4]
            if title_words and all(w in jwt_title for w in title_words):
                page_range = art.get("PageRange", "")
                return [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]

    return None


def download_missing_pages(sb, feature_id, all_pages, existing_pages, year, month):
    """Download pages we don't already have."""
    date_str = f"{year}{month:02d}01"
    uploaded = 0
    existing_set = set(existing_pages)

    for page_num in all_pages:
        if page_num in existing_set:
            continue

        url = AD_ARCHIVE_BLOB.format(date=date_str, page=page_num)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200 or len(resp.content) < 1000:
                continue

            storage_path = f"{feature_id}/page_{page_num:03d}.jpg"
            try:
                sb.storage.from_(BUCKET).upload(
                    storage_path, resp.content, {"content-type": "image/jpeg"})
            except Exception as e:
                if "Duplicate" in str(e) or "already exists" in str(e):
                    pass
                else:
                    continue

            base_url = os.environ["SUPABASE_URL"]
            public_url = f"{base_url}/storage/v1/object/public/{BUCKET}/{storage_path}"

            try:
                sb.table("feature_images").insert({
                    "feature_id": feature_id,
                    "page_number": page_num,
                    "storage_path": storage_path,
                    "public_url": public_url,
                }).execute()
                uploaded += 1
            except Exception as e:
                if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                    pass
                else:
                    print(f"      DB error page {page_num}: {e}")

        except requests.RequestException:
            pass

    return uploaded


def main():
    dry_run = "--dry-run" in sys.argv
    sb = get_sb()

    # Get all features
    print("Loading features...")
    all_features = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, article_title, page_number, issue_id"
        ).range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Count existing images per feature
    print("Counting existing images...")
    img_counts = {}
    img_pages = {}  # feature_id -> set of page numbers
    offset = 0
    while True:
        batch = sb.from_("feature_images").select(
            "feature_id, page_number"
        ).range(offset, offset + 999).execute()
        for row in batch.data:
            fid = row["feature_id"]
            img_counts[fid] = img_counts.get(fid, 0) + 1
            if fid not in img_pages:
                img_pages[fid] = set()
            if row["page_number"]:
                img_pages[fid].add(row["page_number"])
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Find features that might need more pages (exactly 6 or 0 images)
    candidates = [f for f in all_features if img_counts.get(f["id"], 0) in (0, 6)]
    print(f"\nTotal features: {len(all_features)}")
    print(f"Candidates (0 or 6 images): {len(candidates)}")

    # Group by issue for efficient JWT fetching
    by_issue = {}
    for f in candidates:
        iid = f["issue_id"]
        if iid not in by_issue:
            by_issue[iid] = []
        by_issue[iid].append(f)

    # Load issue data
    print(f"Loading {len(by_issue)} issues...")
    issues = {}
    for iid in by_issue:
        for attempt in range(3):
            try:
                r = sb.from_("issues").select("id, year, month, source_url").eq("id", iid).execute()
                if r.data:
                    issues[iid] = r.data[0]
                break
            except Exception:
                time.sleep(1)

    # Process each issue's JWT once
    total_expanded = 0
    total_pages_added = 0
    total_no_jwt = 0
    total_already_full = 0
    issue_count = 0

    for iid, feats in by_issue.items():
        issue_count += 1
        iss = issues.get(iid)
        if not iss or not iss.get("source_url"):
            total_no_jwt += len(feats)
            continue

        # Fetch JWT once per issue
        try:
            featured = decode_jwt_featured(iss["source_url"])
        except Exception:
            featured = None
            total_no_jwt += len(feats)
            continue

        if not featured:
            total_no_jwt += len(feats)
            continue

        for f in feats:
            full_pages = find_full_page_range(
                featured, f.get("article_title"), f.get("page_number"))

            if not full_pages:
                total_no_jwt += 1
                continue

            existing = img_pages.get(f["id"], set())
            missing = [p for p in full_pages if p not in existing]

            if not missing:
                total_already_full += 1
                continue

            if dry_run:
                print(f"  #{f['id']} \"{f['article_title']}\": has {len(existing)}, JWT says {len(full_pages)}, would add {len(missing)}")
                total_expanded += 1
                total_pages_added += len(missing)
            else:
                added = download_missing_pages(
                    sb, f["id"], full_pages, list(existing),
                    iss["year"], iss["month"])
                if added > 0:
                    total_expanded += 1
                    total_pages_added += added
                    if total_expanded % 50 == 0:
                        print(f"  Progress: {total_expanded} features expanded, {total_pages_added} pages added ({issue_count}/{len(by_issue)} issues)")

        # Be nice to AD archive
        time.sleep(0.3)

        if issue_count % 50 == 0:
            print(f"[{issue_count}/{len(by_issue)} issues processed]")
            sys.stdout.flush()

    print(f"\n{'=' * 60}")
    print(f"DONE")
    print(f"{'=' * 60}")
    print(f"Issues processed: {issue_count}")
    print(f"Features expanded: {total_expanded}")
    print(f"Pages added: {total_pages_added}")
    print(f"Already full: {total_already_full}")
    print(f"No JWT match: {total_no_jwt}")


if __name__ == "__main__":
    main()
