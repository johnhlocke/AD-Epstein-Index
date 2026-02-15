#!/usr/bin/env python3
"""Download and store AD article page images for ALL features.

Fetches page images from Azure Blob Storage (public, free) for every feature,
uploads them to Supabase Storage (feature-images bucket), and records URLs
in the feature_images table.

Usage:
    python3 src/backfill_feature_images.py                    # All features
    python3 src/backfill_feature_images.py --limit 10         # First 10 only
    python3 src/backfill_feature_images.py --id 42            # Single feature
    python3 src/backfill_feature_images.py --skip-done        # Skip already-done
    python3 src/backfill_feature_images.py --dry-run          # Preview only
    python3 src/backfill_feature_images.py --unscored         # Only features without scores

Cost: $0 (Azure Blob images are public). ~3.4 GB storage on Supabase Pro.
Time: ~2-3 hours for all 1,600 features at ~5s each.
"""

import argparse
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


def get_supabase():
    """Get Supabase client using service key for storage uploads."""
    url = os.environ["SUPABASE_URL"]
    # Prefer service key for storage operations (bypasses RLS)
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def fetch_all_features(sb, feature_id=None, unscored_only=False):
    """Fetch features with their issue data."""
    query = sb.table("features").select("id, issue_id, homeowner_name, article_title, page_number")

    if feature_id:
        query = query.eq("id", feature_id)

    if unscored_only:
        query = query.is_("score_grandeur", "null")

    # Paginate
    all_features = []
    offset = 0
    while True:
        batch = query.range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Fetch issue data for all unique issue IDs
    issue_ids = list(set(f["issue_id"] for f in all_features))
    issues = {}
    for i in range(0, len(issue_ids), 50):
        batch_ids = issue_ids[i:i+50]
        for iid in batch_ids:
            result = sb.table("issues").select("id, year, month, source_url").eq("id", iid).execute()
            if result.data:
                issues[iid] = result.data[0]

    # Merge
    results = []
    for f in all_features:
        iss = issues.get(f["issue_id"])
        if iss:
            results.append({
                "feature_id": f["id"],
                "homeowner_name": f.get("homeowner_name") or "Unknown",
                "article_title": f.get("article_title") or "",
                "page_number": f.get("page_number"),
                "year": iss.get("year"),
                "month": iss.get("month"),
                "source_url": iss.get("source_url"),
            })
    return results


def get_existing_feature_images(sb):
    """Get set of feature IDs that already have images."""
    done = set()
    offset = 0
    while True:
        batch = sb.table("feature_images").select("feature_id").range(offset, offset + 999).execute()
        for row in batch.data:
            done.add(row["feature_id"])
        if len(batch.data) < 1000:
            break
        offset += 1000
    return done


def _decode_jwt_featured(source_url):
    """Fetch and decode JWT tocConfig from AD archive. Returns featured list or None."""
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


def _extract_pages(art):
    """Extract page numbers from an article's PageRange field."""
    page_range = art.get("PageRange", "")
    return [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]


def fetch_article_page_range(source_url, name, article_title=None, page_number=None):
    """Find article's page range using 3 strategies: name, title, page number.

    Strategy 1: Match homeowner name in Title/Teaser/Creator
    Strategy 2: Match article_title against Title field
    Strategy 3: Match page_number within an article's PageRange
    """
    featured = _decode_jwt_featured(source_url)
    if not featured:
        return None, None

    # Strategy 1: Name matching (original approach)
    clean = name.split(" (")[0].replace("Mrs. ", "")
    search_terms = []
    for part in re.split(r"\s+(?:and|&)\s+", clean):
        last = part.strip().split()[-1]
        if len(last) >= 4:
            search_terms.append(last.upper())

    for art in featured:
        title = (art.get("Title") or "").upper()
        teaser = re.sub(r"<[^>]+>", "", art.get("Teaser") or "").upper()
        creator = (art.get("CreatorString") or "").upper()

        for term in search_terms:
            if term in title or term in teaser or term in creator:
                return _extract_pages(art), art

    # Strategy 2: Match by article title
    if article_title and len(article_title) >= 4:
        title_upper = article_title.upper().strip()
        for art in featured:
            jwt_title = (art.get("Title") or "").upper().strip()
            if title_upper in jwt_title or jwt_title in title_upper:
                return _extract_pages(art), art
            title_words = [w for w in re.split(r'\W+', title_upper) if len(w) >= 4]
            if title_words and all(w in jwt_title for w in title_words):
                return _extract_pages(art), art

    # Strategy 3: Match by page number (feature's page falls within article's range)
    if page_number:
        for art in featured:
            pages = _extract_pages(art)
            if pages and page_number in pages:
                return pages, art
            if pages and min(pages) <= page_number <= max(pages):
                return pages, art

    return None, None


def download_and_upload_pages(sb, feature_id, pages, year, month):
    """Download page images from Azure Blob and upload to Supabase Storage."""
    date_str = f"{year}{month:02d}01"
    uploaded = []

    for page_num in pages:
        img_url = AD_ARCHIVE_BLOB.format(date=date_str, page=page_num)
        try:
            resp = requests.get(img_url, headers=HEADERS, timeout=15)
            if resp.status_code != 200 or len(resp.content) < 1000:
                continue

            # Upload to Supabase Storage
            storage_path = f"{feature_id}/page_{page_num:03d}.jpg"
            try:
                sb.storage.from_(BUCKET).upload(
                    storage_path,
                    resp.content,
                    {"content-type": "image/jpeg"},
                )
            except Exception as e:
                if "Duplicate" in str(e) or "already exists" in str(e):
                    pass  # Already uploaded
                else:
                    print(f"      Upload error page {page_num}: {e}")
                    continue

            # Build public URL
            base_url = os.environ["SUPABASE_URL"]
            public_url = f"{base_url}/storage/v1/object/public/{BUCKET}/{storage_path}"

            # Insert record
            try:
                sb.table("feature_images").insert({
                    "feature_id": feature_id,
                    "page_number": page_num,
                    "storage_path": storage_path,
                    "public_url": public_url,
                }).execute()
            except Exception as e:
                if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                    pass  # Already recorded
                else:
                    print(f"      DB insert error page {page_num}: {e}")
                    continue

            uploaded.append(page_num)

        except requests.RequestException as e:
            print(f"      Download error page {page_num}: {e}")

    return uploaded


def main():
    parser = argparse.ArgumentParser(description="Download & store AD article page images")
    parser.add_argument("--dry-run", action="store_true", help="Preview without downloading")
    parser.add_argument("--limit", type=int, help="Max features to process")
    parser.add_argument("--id", type=int, help="Process single feature ID")
    parser.add_argument("--skip-done", action="store_true", help="Skip features with existing images")
    parser.add_argument("--unscored", action="store_true", help="Only features without scores")
    args = parser.parse_args()

    print("=" * 60)
    print("BACKFILL FEATURE IMAGES — Azure Blob → Supabase Storage")
    print("=" * 60)

    sb = get_supabase()

    # Fetch features
    features = fetch_all_features(sb, feature_id=args.id, unscored_only=args.unscored)
    print(f"\nFound {len(features)} features to process")

    # Get already-done features
    done = set()
    if args.skip_done:
        done = get_existing_feature_images(sb)
        print(f"Already done: {len(done)} features")

    if args.limit:
        features = features[:args.limit]
        print(f"Limited to {len(features)} features")

    # Process
    total_images = 0
    processed = 0
    skipped = 0
    errors = 0

    for i, feat in enumerate(features):
        fid = feat["feature_id"]
        name = feat["homeowner_name"]
        year = feat["year"]
        month = feat["month"]
        source_url = feat["source_url"]

        print(f"\n[{i+1}/{len(features)}] Feature {fid}: {name} (AD {year}-{month:02d})")

        # Skip if done
        if fid in done:
            print("  SKIP: Already has images")
            skipped += 1
            continue

        # Skip if no AD Archive URL
        if not source_url or "architecturaldigest.com" not in source_url:
            print("  SKIP: No AD Archive URL")
            skipped += 1
            continue

        # Get page range from JWT
        try:
            pages, article_meta = fetch_article_page_range(
                source_url, name,
                article_title=feat.get("article_title"),
                page_number=feat.get("page_number"),
            )
        except Exception as e:
            print(f"  ERROR fetching TOC: {e}")
            errors += 1
            continue

        if not pages:
            print("  SKIP: Article not found in TOC")
            skipped += 1
            continue

        title = (article_meta.get("Title", "?") if article_meta else "?")[:60]
        print(f"  Article: \"{title}\" | {len(pages)} pages: {','.join(str(p) for p in pages)}")

        if args.dry_run:
            total_images += len(pages)
            processed += 1
            continue

        # Download and upload
        uploaded = download_and_upload_pages(sb, fid, pages, year, month)
        if uploaded:
            print(f"  Uploaded {len(uploaded)}/{len(pages)} pages")
            total_images += len(uploaded)
            processed += 1
        else:
            print("  SKIP: No pages downloaded")
            skipped += 1

        # Rate limit to avoid hammering Azure Blob
        time.sleep(0.5)

    print(f"\n{'=' * 60}")
    print(f"DONE: {processed} features processed, {total_images} images uploaded")
    print(f"      {skipped} skipped, {errors} errors")
    if args.dry_run:
        print("(DRY RUN — no changes made)")
        est_gb = total_images * 400 / 1024 / 1024
        print(f"Estimated storage: {total_images} images × ~400KB = ~{est_gb:.1f} GB")


if __name__ == "__main__":
    main()
