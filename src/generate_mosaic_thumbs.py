#!/usr/bin/env python3
"""Generate small mosaic thumbnails for the hero section.

Downloads page images from Azure Blob (463x600), resizes to 123x164 (3:4 ratio),
compresses to JPEG Q60, and uploads to Supabase Storage `mosaic-thumbnails` bucket.

The website mosaic displays images at ~48x64px — these 123x164 thumbnails provide
crisp 2x coverage while being ~100x smaller than the current 463x600 originals.

Usage:
    python3 src/generate_mosaic_thumbs.py              # All features
    python3 src/generate_mosaic_thumbs.py --limit 50   # First 50 only
    python3 src/generate_mosaic_thumbs.py --dry-run    # Preview only
"""

import argparse
import asyncio
import io
import os
import sys
import time

import httpx
from dotenv import load_dotenv
from PIL import Image
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

THUMB_WIDTH = 123
THUMB_HEIGHT = 164
JPEG_QUALITY = 60
CONCURRENT = 20
BUCKET = "mosaic-thumbnails"
AZURE_URL = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def fetch_features(sb):
    """Fetch all features with page_number + issue year/month."""
    all_features = []
    offset = 0
    while True:
        batch = (
            sb.table("features")
            .select("id, page_number, issue_id")
            .not_.is_("page_number", "null")
            .range(offset, offset + 999)
            .execute()
        )
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Fetch issue year/month for all unique issue IDs
    issue_ids = list(set(f["issue_id"] for f in all_features if f["issue_id"]))
    issues = {}
    for i in range(0, len(issue_ids), 100):
        batch_ids = issue_ids[i:i+100]
        for iid in batch_ids:
            result = sb.table("issues").select("id, year, month").eq("id", iid).execute()
            if result.data:
                issues[iid] = result.data[0]

    # Merge issue data onto features
    results = []
    for f in all_features:
        iss = issues.get(f["issue_id"])
        if not iss or not iss.get("year"):
            continue
        f["year"] = iss["year"]
        f["month"] = iss.get("month")
        results.append(f)

    return results


def get_existing_thumbnails(sb):
    """List all files already in the mosaic-thumbnails bucket."""
    existing = set()
    try:
        files = sb.storage.from_(BUCKET).list()
        for f in files:
            name = f.get("name", "")
            if name.endswith(".jpg"):
                existing.add(name)
    except Exception:
        pass
    return existing


def build_azure_url(year, month, page):
    mm = str(month or 1).zfill(2)
    date = f"{year}{mm}01"
    return AZURE_URL.format(date=date, page=page)


def make_thumbnail(image_bytes):
    """Resize image to 123x164 and compress as JPEG Q60."""
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    img = img.resize((THUMB_WIDTH, THUMB_HEIGHT), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


async def process_feature(client, sb, feature, semaphore, dry_run=False):
    """Download, resize, and upload a single feature's thumbnail."""
    fid = feature["id"]
    url = build_azure_url(feature["year"], feature["month"], feature["page_number"])
    filename = f"{fid}.jpg"

    async with semaphore:
        try:
            resp = await client.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                return {"id": fid, "status": "download_failed", "code": resp.status_code}

            thumb_bytes = make_thumbnail(resp.content)

            if dry_run:
                return {"id": fid, "status": "dry_run", "size": len(thumb_bytes)}

            # Upload to Supabase Storage
            sb.storage.from_(BUCKET).upload(
                filename,
                thumb_bytes,
                {"content-type": "image/jpeg"},
            )
            return {"id": fid, "status": "ok", "size": len(thumb_bytes)}

        except Exception as e:
            return {"id": fid, "status": "error", "error": str(e)}


async def main():
    parser = argparse.ArgumentParser(description="Generate mosaic thumbnails")
    parser.add_argument("--limit", type=int, help="Process only first N features")
    parser.add_argument("--dry-run", action="store_true", help="Download and resize but don't upload")
    args = parser.parse_args()

    sb = get_supabase()

    # Ensure bucket exists (create if needed)
    try:
        sb.storage.create_bucket(BUCKET, options={"public": True})
        print(f"Created bucket '{BUCKET}'")
    except Exception as e:
        if "already exists" in str(e).lower() or "Duplicate" in str(e):
            print(f"Bucket '{BUCKET}' already exists")
        else:
            print(f"Bucket check: {e}")

    print("Fetching features...")
    features = fetch_features(sb)
    print(f"Found {len(features)} features with page images")

    # Skip features that already have thumbnails
    existing = get_existing_thumbnails(sb)
    todo = [f for f in features if f"{f['id']}.jpg" not in existing]
    print(f"Already uploaded: {len(existing)}, remaining: {len(todo)}")

    if args.limit:
        todo = todo[:args.limit]
        print(f"Limited to {len(todo)} features")

    if not todo:
        print("Nothing to do!")
        return

    semaphore = asyncio.Semaphore(CONCURRENT)
    ok = 0
    failed = 0
    total_bytes = 0
    start = time.time()

    async with httpx.AsyncClient() as client:
        tasks = [process_feature(client, sb, f, semaphore, args.dry_run) for f in todo]
        for i, coro in enumerate(asyncio.as_completed(tasks)):
            result = await coro
            if result["status"] == "ok" or result["status"] == "dry_run":
                ok += 1
                total_bytes += result.get("size", 0)
            else:
                failed += 1
                print(f"  FAIL id={result['id']}: {result.get('error') or result.get('code')}")

            if (ok + failed) % 100 == 0:
                elapsed = time.time() - start
                rate = (ok + failed) / elapsed if elapsed > 0 else 0
                print(f"  Progress: {ok + failed}/{len(todo)} ({rate:.1f}/s) — {ok} ok, {failed} failed")

    elapsed = time.time() - start
    avg_kb = (total_bytes / ok / 1024) if ok else 0
    print(f"\nDone in {elapsed:.1f}s — {ok} uploaded, {failed} failed")
    print(f"Average thumbnail: {avg_kb:.1f} KB")
    print(f"Total: {total_bytes / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    asyncio.run(main())
