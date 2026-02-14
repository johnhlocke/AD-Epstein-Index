#!/usr/bin/env python3
"""Download AD article page images and upload to Supabase Storage for dossier detail pages.

For each dossier:
1. Fetch the JWT tocConfig from the AD archive issue page
2. Find the article by name match → get PageRange
3. Download page images from Azure Blob Storage
4. Upload to Supabase Storage bucket 'dossier-images'
5. Insert records into dossier_images table

Prereq: Create a public 'dossier-images' bucket in Supabase Dashboard.

Usage:
    python3 src/backfill_dossier_images.py --confirmed          # confirmed dossiers only
    python3 src/backfill_dossier_images.py --id 283             # single dossier
    python3 src/backfill_dossier_images.py --dry-run             # preview without changes
    python3 src/backfill_dossier_images.py --limit 10            # first N dossiers
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

sys.path.insert(0, os.path.dirname(__file__))
from deep_extract_confirmed import fetch_article_page_range, fetch_page_images

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BUCKET = "dossier-images"


def get_supabase():
    # Use service role key to bypass RLS for storage uploads
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(os.environ["SUPABASE_URL"], key)


def fetch_page_range_by_title(source_url, article_title):
    """Fallback: match article by title when name match fails."""
    if not article_title:
        return None, None
    try:
        resp = requests.get(source_url, headers=HEADERS, timeout=30)
        match = re.search(r"tocConfig\s*=\s*'([^']+)'", resp.text)
        if not match:
            return None, None
        jwt_token = match.group(1)
        parts = jwt_token.split(".")
        if len(parts) < 2:
            return None, None
        payload = parts[1] + "=" * (4 - len(parts[1]) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        if isinstance(data, str):
            data = json.loads(data)

        title_upper = article_title.upper().strip()
        for art in data.get("featured", []):
            jwt_title = (art.get("Title") or "").upper().strip()
            # Exact or substring match on article title
            if title_upper == jwt_title or title_upper in jwt_title or jwt_title in title_upper:
                page_range = art.get("PageRange", "")
                pages = [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]
                if pages:
                    return pages, art
    except Exception:
        pass
    return None, None


def get_dossiers(sb, confirmed_only=False, dossier_id=None):
    """Fetch dossiers with their feature and issue data."""
    query = sb.table("dossiers").select(
        "id, subject_name, feature_id, editor_verdict, "
        "features(id, homeowner_name, article_title, issue_id, issues(id, year, month, source_url))"
    )
    if dossier_id:
        query = query.eq("id", dossier_id)
    if confirmed_only:
        query = query.eq("editor_verdict", "CONFIRMED")

    result = query.execute()
    return result.data


def already_has_images(sb, dossier_id):
    """Check if this dossier already has images stored."""
    result = (
        sb.table("dossier_images")
        .select("id", count="exact")
        .eq("dossier_id", dossier_id)
        .execute()
    )
    return result.count and result.count > 0


def upload_and_record(sb, dossier_id, feature_id, page_num, image_bytes):
    """Upload image to storage and insert a dossier_images record."""
    storage_path = f"{feature_id}/page_{page_num}.jpg"

    # Upload to Supabase Storage
    sb.storage.from_(BUCKET).upload(
        storage_path,
        image_bytes,
        {"content-type": "image/jpeg"},
    )

    # Build public URL
    base_url = os.getenv("SUPABASE_URL", "")
    public_url = f"{base_url}/storage/v1/object/public/{BUCKET}/{storage_path}"

    # Insert record
    sb.table("dossier_images").insert({
        "dossier_id": dossier_id,
        "feature_id": feature_id,
        "page_number": page_num,
        "storage_path": f"{BUCKET}/{storage_path}",
        "public_url": public_url,
        "image_type": "article_page",
    }).execute()

    return public_url


def main():
    parser = argparse.ArgumentParser(description="Backfill dossier article page images")
    parser.add_argument("--confirmed", action="store_true", help="Only confirmed dossiers")
    parser.add_argument("--id", type=int, help="Single dossier ID")
    parser.add_argument("--limit", type=int, help="Max dossiers to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without uploading")
    args = parser.parse_args()

    sb = get_supabase()

    print("=" * 60)
    print("BACKFILL DOSSIER ARTICLE PAGE IMAGES")
    print("=" * 60)

    dossiers = get_dossiers(sb, confirmed_only=args.confirmed, dossier_id=args.id)
    print(f"Found {len(dossiers)} dossiers")

    if args.limit:
        dossiers = dossiers[: args.limit]
        print(f"Limited to {len(dossiers)}")

    stats = {"uploaded": 0, "skipped": 0, "errors": 0, "images": 0}

    for i, d in enumerate(dossiers):
        did = d["id"]
        name = d["subject_name"]
        feature = d.get("features")
        if not feature:
            print(f"\n[{i+1}/{len(dossiers)}] #{did} {name} — SKIP: no linked feature")
            stats["skipped"] += 1
            continue

        fid = feature["id"]
        issue = feature.get("issues")
        if not issue:
            print(f"\n[{i+1}/{len(dossiers)}] #{did} {name} — SKIP: no linked issue")
            stats["skipped"] += 1
            continue

        source_url = issue.get("source_url")
        year = issue.get("year")
        month = issue.get("month")

        if not source_url or "architecturaldigest.com" not in (source_url or ""):
            print(f"\n[{i+1}/{len(dossiers)}] #{did} {name} — SKIP: no AD archive URL")
            stats["skipped"] += 1
            continue

        if not year or not month:
            print(f"\n[{i+1}/{len(dossiers)}] #{did} {name} — SKIP: missing year/month")
            stats["skipped"] += 1
            continue

        # Idempotent: skip if already has images
        if not args.dry_run and already_has_images(sb, did):
            print(f"\n[{i+1}/{len(dossiers)}] #{did} {name} — SKIP: already has images")
            stats["skipped"] += 1
            continue

        print(f"\n[{i+1}/{len(dossiers)}] #{did} {name} (feature {fid})")
        print(f"  Issue: AD {year}-{month:02d} | {source_url}")

        # Get page range from JWT tocConfig — try name match, then title fallback
        try:
            pages, article_meta = fetch_article_page_range(source_url, name)
        except Exception as e:
            print(f"  ERROR fetching TOC: {e}")
            stats["errors"] += 1
            continue

        if not pages:
            # Fallback: match by article title from features table
            art_title = feature.get("article_title")
            if art_title:
                try:
                    pages, article_meta = fetch_page_range_by_title(source_url, art_title)
                    if pages:
                        print(f"  (matched by title fallback: \"{art_title}\")")
                except Exception:
                    pass

        if not pages:
            print("  SKIP: article not found in TOC")
            stats["skipped"] += 1
            continue

        title = article_meta.get("Title", "?") if article_meta else "?"
        print(f"  Article: \"{title}\" | {len(pages)} pages: {','.join(str(p) for p in pages)}")

        if args.dry_run:
            stats["uploaded"] += 1
            stats["images"] += len(pages)
            continue

        # Download page images from Azure Blob
        page_images = fetch_page_images(pages, year, month)
        if not page_images:
            print("  SKIP: no page images downloaded")
            stats["errors"] += 1
            continue

        print(f"  Downloaded {len(page_images)}/{len(pages)} pages")

        # Upload each page to Supabase Storage
        uploaded_count = 0
        for page_num, img_bytes in page_images:
            try:
                url = upload_and_record(sb, did, fid, page_num, img_bytes)
                uploaded_count += 1
            except Exception as e:
                err_msg = str(e)
                if "Duplicate" in err_msg or "already exists" in err_msg:
                    print(f"    Page {page_num}: already exists, skipping")
                else:
                    print(f"    Page {page_num}: upload error — {e}")
                    stats["errors"] += 1

        print(f"  Uploaded {uploaded_count} images")
        stats["uploaded"] += 1
        stats["images"] += uploaded_count

        # Brief pause to be kind to servers
        time.sleep(0.5)

    print(f"\n{'=' * 60}")
    print(f"DONE: {stats['uploaded']} dossiers processed, {stats['images']} images uploaded")
    print(f"  Skipped: {stats['skipped']} | Errors: {stats['errors']}")
    if args.dry_run:
        print("(DRY RUN — no uploads made)")


if __name__ == "__main__":
    main()
