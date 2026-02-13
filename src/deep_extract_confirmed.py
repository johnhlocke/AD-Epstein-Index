#!/usr/bin/env python3
"""Deep re-extraction for confirmed Epstein connections.

Fetches ALL page images for confirmed names' AD features (not just first 3),
sends them through Claude Vision for richer extraction, and updates Supabase
with enriched data (location, sqft, cost, style, social mentions).

Cost: ~$0.02 per article × 25 articles = ~$0.50 total (Haiku Vision).
"""

import argparse
import base64
import json
import os
import re
import sys
import time

import anthropic
import requests
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(__file__))
from aesthetic_taxonomy import (
    build_vision_prompt, parse_aesthetic_response, extract_structural_and_social,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
AD_ARCHIVE_BLOB_BASE = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
MODEL = "claude-haiku-4-5-20251001"
MAX_IMAGES_PER_CALL = 6  # Stay within token limits


def get_confirmed_features():
    """Get all confirmed names and their feature/issue details from Supabase."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_ANON_KEY"]
    sb = create_client(url, key)

    dossiers = sb.table("dossiers").select("subject_name, confidence_score").eq("editor_verdict", "CONFIRMED").execute()
    names = list({d["subject_name"] for d in dossiers.data})

    results = []
    for name in sorted(names):
        features = sb.table("features").select("*").ilike("homeowner_name", f"%{name}%").execute()
        for f in features.data:
            issue = sb.table("issues").select("id, year, month, source_url").eq("id", f["issue_id"]).execute()
            if issue.data:
                i = issue.data[0]
                results.append({
                    "name": name,
                    "feature_id": f["id"],
                    "issue_id": i["id"],
                    "year": i.get("year"),
                    "month": i.get("month"),
                    "source_url": i.get("source_url"),
                    "current": {
                        "location_city": f.get("location_city"),
                        "location_state": f.get("location_state"),
                        "location_country": f.get("location_country"),
                        "square_footage": f.get("square_footage"),
                        "cost": f.get("cost"),
                        "design_style": f.get("design_style"),
                        "designer_name": f.get("designer_name"),
                        "architecture_firm": f.get("architecture_firm"),
                        "year_built": f.get("year_built"),
                        "notes": f.get("notes"),
                        "aesthetic_profile": f.get("aesthetic_profile"),
                    },
                })
    return results, sb


def fetch_article_page_range(source_url, name):
    """Fetch JWT tocConfig from AD archive and find the article's full page range."""
    resp = requests.get(source_url, headers=HEADERS, timeout=30)
    match = re.search(r"tocConfig\s*=\s*'([^']+)'", resp.text)
    if not match:
        return None, None

    jwt_token = match.group(1)
    parts = jwt_token.split(".")
    if len(parts) < 2:
        return None, None

    payload = parts[1]
    payload += "=" * (4 - len(payload) % 4)
    decoded = base64.urlsafe_b64decode(payload).decode("utf-8")
    data = json.loads(decoded)
    if isinstance(data, str):
        data = json.loads(data)

    featured = data.get("featured", [])

    # Search by last name parts
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
                page_range = art.get("PageRange", "")
                pages = [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]
                return pages, art

    return None, None


def fetch_page_images(pages, year, month):
    """Download page images from Azure Blob Storage."""
    date_str = f"{year}{month:02d}01"
    fetched = []

    for page_num in pages:
        url = AD_ARCHIVE_BLOB_BASE.format(date=date_str, page=page_num)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 1000:
                fetched.append((page_num, resp.content))
            else:
                print(f"    Page {page_num}: {resp.status_code} ({len(resp.content)}b)")
        except Exception as e:
            print(f"    Page {page_num}: {e}")

    return fetched


def extract_with_vision(article_meta, page_images, year, month, name):
    """Send ALL page images to Claude Vision for rich extraction."""
    client = anthropic.Anthropic()
    month_str = f"{month:02d}" if isinstance(month, int) else str(month)

    title = article_meta.get("Title", "Unknown") if article_meta else "Unknown"
    section = article_meta.get("Section", "") if article_meta else ""
    author = article_meta.get("CreatorString", "") if article_meta else ""
    teaser = re.sub(r"<[^>]+>", "", (article_meta.get("Teaser") or "") if article_meta else "")

    # If too many images, process in batches and merge
    all_results = []

    for batch_start in range(0, len(page_images), MAX_IMAGES_PER_CALL):
        batch = page_images[batch_start:batch_start + MAX_IMAGES_PER_CALL]
        batch_num = batch_start // MAX_IMAGES_PER_CALL + 1
        total_batches = (len(page_images) + MAX_IMAGES_PER_CALL - 1) // MAX_IMAGES_PER_CALL

        content = []
        for page_num, img_bytes in batch:
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
            })

        batch_context = ""
        if total_batches > 1:
            batch_context = f"\nThis is batch {batch_num}/{total_batches} of the article. "
            if batch_start > 0:
                batch_context += "Earlier pages showed the article opening. These are continuation pages."

        article_meta_dict = {
            "Title": title,
            "Section": section,
            "CreatorString": author,
            "Teaser": teaser,
        }
        prompt = build_vision_prompt(name, article_meta_dict, year, month)
        if batch_context:
            prompt = batch_context + "\n" + prompt

        content.append({"type": "text", "text": prompt})

        try:
            message = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": content}],
            )

            result_text = message.content[0].text
            # Track tokens
            inp = message.usage.input_tokens
            out = message.usage.output_tokens
            cost = (inp / 1_000_000) * 1.0 + (out / 1_000_000) * 5.0
            print(f"    Batch {batch_num}/{total_batches}: {inp} in / {out} out / ${cost:.4f}")

            # Parse JSON
            json_match = re.search(r"\{[\s\S]*\}", result_text)
            if json_match:
                parsed = json.loads(json_match.group())
                all_results.append(parsed)
        except Exception as e:
            print(f"    Vision API error (batch {batch_num}): {e}")

    # Merge batch results (keep first non-null value for each field)
    if not all_results:
        return None

    merged = all_results[0]
    for result in all_results[1:]:
        for key, val in result.items():
            if key in merged:
                existing = merged[key]
                if existing is None and val is not None:
                    merged[key] = val
                elif isinstance(existing, list) and isinstance(val, list):
                    # Merge lists, dedup
                    merged[key] = list(set(existing + val))
                elif isinstance(existing, str) and isinstance(val, str) and val not in existing:
                    # Concatenate string descriptions
                    merged[key] = f"{existing}; {val}"
            else:
                merged[key] = val

    return merged


def update_feature(sb, feature_id, extracted, current):
    """Update Supabase feature with enriched data. Only fill NULLs, don't overwrite."""
    update = {}

    def maybe_set(db_col, value):
        """Set column only if it's currently NULL and new value is valid."""
        if current.get(db_col) is not None:
            return  # Don't overwrite existing data
        if value and str(value).lower() not in ("null", "none", "n/a", "unknown"):
            update[db_col] = value

    # Extract structural and social data using taxonomy helper
    enriched, social = extract_structural_and_social(extracted)

    # Direct field mappings from enriched data
    maybe_set("location_city", enriched.get("location_city"))
    maybe_set("location_state", enriched.get("location_state"))
    maybe_set("location_country", enriched.get("location_country"))
    maybe_set("design_style", enriched.get("design_style"))
    maybe_set("designer_name", enriched.get("designer_name"))
    maybe_set("architecture_firm", enriched.get("architecture_firm"))
    maybe_set("year_built", enriched.get("year_built"))

    # Square footage — extract numeric value
    sqft = enriched.get("square_footage")
    if sqft and current.get("square_footage") is None:
        if isinstance(sqft, (int, float)):
            update["square_footage"] = int(sqft)
        else:
            nums = re.findall(r"[\d,]+", str(sqft))
            if nums:
                update["square_footage"] = int(nums[0].replace(",", ""))

    # Cost — store as string
    cost = enriched.get("cost")
    if cost and current.get("cost") is None:
        update["cost"] = str(cost)

    # Parse and store aesthetic profile
    profile = parse_aesthetic_response(json.dumps(extracted), source="deep_extract")
    if profile and not current.get("aesthetic_profile"):
        update["aesthetic_profile"] = json.dumps(profile)

    # Store social/network data in notes field as JSON
    if social:
        update["notes"] = json.dumps({"deep_extract": social, "source": "deep_extract_confirmed"})

    if not update:
        return False

    try:
        sb.table("features").update(update).eq("id", feature_id).execute()
        return True
    except Exception as e:
        print(f"    Update error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Deep re-extraction for confirmed names")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without executing")
    parser.add_argument("--name", type=str, help="Process only this name (partial match)")
    parser.add_argument("--skip-update", action="store_true", help="Extract but don't update Supabase")
    parser.add_argument("--skip-done", action="store_true", help="Skip features already deep-extracted")
    args = parser.parse_args()

    print("=" * 60)
    print("DEEP RE-EXTRACTION FOR CONFIRMED CONNECTIONS")
    print("=" * 60)

    features, sb = get_confirmed_features()
    print(f"\nFound {len(features)} features for confirmed names")

    if args.name:
        features = [f for f in features if args.name.lower() in f["name"].lower()]
        print(f"Filtered to {len(features)} features matching '{args.name}'")

    total_cost = 0.0
    updated = 0
    skipped = 0

    for i, feat in enumerate(features):
        name = feat["name"]
        source_url = feat["source_url"]
        year = feat["year"]
        month = feat["month"]
        fid = feat["feature_id"]

        print(f"\n[{i+1}/{len(features)}] {name} (feature {fid})")
        print(f"  Issue: AD {year}-{month:02d} | {source_url}")
        cur = feat["current"]
        print(f"  Current: city={cur['location_city']}, style={cur['design_style']}, sqft={cur['square_footage']}")

        # Skip already-processed features
        if args.skip_done:
            if cur.get("aesthetic_profile"):
                print("  SKIP: Already has aesthetic_profile")
                skipped += 1
                continue
            if cur.get("notes"):
                try:
                    notes = json.loads(cur["notes"]) if isinstance(cur["notes"], str) else cur["notes"]
                    if isinstance(notes, dict) and "deep_extract" in notes:
                        print("  SKIP: Already deep-extracted")
                        skipped += 1
                        continue
                except (json.JSONDecodeError, TypeError):
                    pass

        if not source_url or "architecturaldigest.com" not in source_url:
            print("  SKIP: No AD archive URL")
            skipped += 1
            continue

        # Step 1: Get full page range from JWT
        try:
            pages, article_meta = fetch_article_page_range(source_url, name)
        except Exception as e:
            print(f"  ERROR fetching TOC: {e}")
            skipped += 1
            continue

        if not pages:
            print("  SKIP: Article not found in TOC")
            skipped += 1
            continue

        title = article_meta.get("Title", "?") if article_meta else "?"
        print(f"  Article: \"{title}\" | {len(pages)} pages: {','.join(str(p) for p in pages)}")

        if args.dry_run:
            continue

        # Step 2: Download ALL page images
        page_images = fetch_page_images(pages, year, month)
        if not page_images:
            print("  SKIP: No page images available")
            skipped += 1
            continue

        print(f"  Downloaded {len(page_images)}/{len(pages)} pages")

        # Step 3: Send to Vision
        extracted = extract_with_vision(article_meta, page_images, year, month, name)
        if not extracted:
            print("  SKIP: Vision extraction returned nothing")
            skipped += 1
            continue

        # Print extracted data
        print(f"  EXTRACTED:")
        for key in ["homeowner_name", "designer_name", "location_city", "location_state",
                     "location_country", "design_style", "year_built", "square_footage", "cost"]:
            val = extracted.get(key)
            if val and str(val).lower() not in ("null", "none"):
                print(f"    {key}: {val}")

        # Print aesthetic taxonomy
        for key in ["envelope", "atmosphere", "materiality", "power_status", "cultural_orientation"]:
            val = extracted.get(key)
            if val and str(val).lower() not in ("null", "none"):
                print(f"    {key}: {val}")
        art = extracted.get("art_collection", [])
        if art and art != ["None Mentioned"]:
            print(f"    art_collection: {art}")
        artists = extracted.get("named_artists", [])
        if artists:
            print(f"    named_artists: {artists}")

        for key in ["notable_guests", "art_collection_details", "social_circle", "previous_owners", "neighborhood_context"]:
            val = extracted.get(key)
            if val and val != [] and str(val).lower() not in ("null", "none", "[]"):
                print(f"    {key}: {val}")

        # Step 4: Update Supabase
        if not args.skip_update:
            if update_feature(sb, fid, extracted, cur):
                print(f"  UPDATED feature {fid}")
                updated += 1
            else:
                print(f"  No new data to update")

        # Rate limiting
        time.sleep(1)

    print(f"\n{'=' * 60}")
    print(f"DONE: {updated} updated, {skipped} skipped out of {len(features)} features")
    if args.dry_run:
        print("(DRY RUN — no changes made)")


if __name__ == "__main__":
    main()
