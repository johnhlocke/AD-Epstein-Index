#!/usr/bin/env python3
"""Backfill missing images + clear pre-update scores so scorer can redo them.

Step 1: Download Azure Blob page images for 73 features missing them
Step 2: Clear scores for ~1,008 features scored before subject_category was added
Step 3: Print summary — then run score_features.py to score everything

Usage:
    python3 src/backfill_and_rescore.py --images     # Step 1: download images only
    python3 src/backfill_and_rescore.py --clear       # Step 2: clear pre-update scores
    python3 src/backfill_and_rescore.py --all         # Both steps
    python3 src/backfill_and_rescore.py --dry-run     # Preview only
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

SCORE_COLUMNS = [
    "score_grandeur", "score_material_warmth", "score_maximalism",
    "score_historicism", "score_provenance", "score_hospitality",
    "score_formality", "score_curation", "score_theatricality",
]


def get_sb():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def _decode_jwt_featured(source_url):
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


def _extract_pages(art):
    page_range = art.get("PageRange", "")
    return [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]


def find_article_pages(source_url, article_title, page_number):
    """Find article's page range from JWT catalog."""
    featured = _decode_jwt_featured(source_url)
    if not featured:
        return None

    # Strategy 1: Match by article title
    if article_title and len(article_title) >= 4:
        title_upper = article_title.upper().strip()
        for art in featured:
            jwt_title = (art.get("Title") or "").upper().strip()
            if title_upper in jwt_title or jwt_title in title_upper:
                return _extract_pages(art)
            title_words = [w for w in re.split(r'\W+', title_upper) if len(w) >= 4]
            if title_words and all(w in jwt_title for w in title_words):
                return _extract_pages(art)

    # Strategy 2: Match by page number
    if page_number:
        for art in featured:
            pages = _extract_pages(art)
            if pages and page_number in pages:
                return pages
            if pages and min(pages) <= page_number <= max(pages):
                return pages

    # Strategy 3: Use page_number + 5 consecutive pages
    if page_number:
        return list(range(page_number, page_number + 6))

    return None


def download_and_upload_images(sb, feature_id, pages, year, month, max_images=6):
    """Download page images from Azure blob and upload to Supabase Storage."""
    date_str = f"{year}{month:02d}01"
    uploaded = 0

    for page_num in pages[:max_images]:
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
                    uploaded += 1
                else:
                    print(f"      DB insert error page {page_num}: {e}")

        except requests.RequestException:
            pass

    return uploaded


def backfill_images(sb, dry_run=False):
    """Download images for features that have none."""
    print("=" * 60)
    print("STEP 1: Backfill missing images")
    print("=" * 60)

    # Get all unscored features
    unscored = sb.from_("features").select(
        "id, article_title, issue_id, page_number"
    ).is_("score_grandeur", "null").order("id").execute()

    # Find ones with no images
    no_img = []
    for f in unscored.data:
        imgs = sb.from_("feature_images").select("id", count="exact").eq("feature_id", f["id"]).execute()
        if imgs.count == 0:
            no_img.append(f)

    print(f"Features needing images: {len(no_img)}")

    if dry_run:
        for f in no_img[:10]:
            print(f"  Would download: Feature #{f['id']} ({f['article_title']})")
        if len(no_img) > 10:
            print(f"  ... and {len(no_img) - 10} more")
        return

    # Get issue data for all
    issue_ids = list(set(f["issue_id"] for f in no_img))
    issues = {}
    for iid in issue_ids:
        result = sb.table("issues").select("id, year, month, source_url").eq("id", iid).execute()
        if result.data:
            issues[iid] = result.data[0]

    downloaded = 0
    failed = 0

    for i, f in enumerate(no_img):
        iss = issues.get(f["issue_id"])
        if not iss or not iss.get("source_url"):
            print(f"  [{i+1}/{len(no_img)}] Feature #{f['id']}: No source URL, skipping")
            failed += 1
            continue

        pages = find_article_pages(
            iss["source_url"], f.get("article_title"), f.get("page_number"))

        if not pages:
            print(f"  [{i+1}/{len(no_img)}] Feature #{f['id']}: No pages found, skipping")
            failed += 1
            continue

        count = download_and_upload_images(
            sb, f["id"], pages, iss["year"], iss["month"])

        status = f"{count} images" if count > 0 else "FAILED"
        print(f"  [{i+1}/{len(no_img)}] Feature #{f['id']}: {status} (pages {pages[:6]})")

        if count > 0:
            downloaded += 1
        else:
            failed += 1

        time.sleep(0.5)  # Be nice to Azure

    print(f"\nDone: {downloaded} features got images, {failed} failed")
    return downloaded


def clear_pre_update_scores(sb, dry_run=False):
    """Clear scores for features scored before subject_category was added to prompt."""
    print("\n" + "=" * 60)
    print("STEP 2: Clear pre-update scores (missing subject_category)")
    print("=" * 60)

    # Find scored features without subject_category
    # These were scored before the prompt update
    all_ids = []
    offset = 0
    while True:
        batch = sb.from_("features").select("id").not_.is_(
            "score_grandeur", "null"
        ).is_("subject_category", "null").range(offset, offset + 999).execute()
        all_ids.extend([r["id"] for r in batch.data])
        if len(batch.data) < 1000:
            break
        offset += 1000

    print(f"Features scored without subject_category: {len(all_ids)}")

    if dry_run:
        print(f"  Would clear scores for {len(all_ids)} features")
        print(f"  First 10 IDs: {all_ids[:10]}")
        return

    # Clear score columns + scoring metadata so scorer picks them up again
    clear_update = {}
    for col in SCORE_COLUMNS:
        clear_update[col] = None
    clear_update["scored_at"] = None
    clear_update["scoring_version"] = None
    clear_update["scoring_rationale"] = None
    clear_update["aesthetic_profile"] = None

    cleared = 0
    for i in range(0, len(all_ids), 100):
        batch = all_ids[i:i+100]
        sb.from_("features").update(clear_update).in_("id", batch).execute()
        cleared += len(batch)
        print(f"  Cleared {cleared}/{len(all_ids)}...")

    print(f"\nDone: {cleared} features cleared for rescoring")
    return cleared


def main():
    parser = argparse.ArgumentParser(description="Backfill images + clear pre-update scores")
    parser.add_argument("--images", action="store_true", help="Download missing images")
    parser.add_argument("--clear", action="store_true", help="Clear pre-update scores")
    parser.add_argument("--all", action="store_true", help="Both steps")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    args = parser.parse_args()

    if not any([args.images, args.clear, args.all]):
        parser.print_help()
        sys.exit(1)

    sb = get_sb()

    if args.images or args.all:
        backfill_images(sb, dry_run=args.dry_run)

    if args.clear or args.all:
        clear_pre_update_scores(sb, dry_run=args.dry_run)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    total_unscored = sb.from_("features").select("id", count="exact").is_("score_grandeur", "null").execute()
    print(f"Total features needing scoring: {total_unscored.count}")
    print(f"\nNext step: python3 src/score_features.py > /tmp/scorer.log 2>&1 &")


if __name__ == "__main__":
    main()
