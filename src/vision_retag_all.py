#!/usr/bin/env python3
"""Vision re-tag: replace text-only aesthetic profiles with full Vision extraction.

Processes all features that were tagged by the batch text-only tagger,
runs them through Claude Vision (same pipeline as confirmed names),
and updates Supabase with:
  - Real aesthetic profiles (source: deep_extract)
  - Backfilled NULL structural fields (designer, location, sqft, etc.)
  - Newly discovered homeowner names (logged for review)

Batches by issue to avoid redundant TOC fetches.

Cost: ~$8.80 for ~1,614 features
Time: ~3 hours

Usage:
    python3 -u src/vision_retag_all.py                    # Full run
    python3 -u src/vision_retag_all.py --limit 20         # Test on 20
    python3 -u src/vision_retag_all.py --dry-run           # Preview
    python3 -u src/vision_retag_all.py --issue-limit 5     # Process 5 issues
"""

import argparse
import base64
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

import anthropic
import requests
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(__file__))
from aesthetic_taxonomy import (
    build_vision_prompt,
    extract_structural_and_social,
    parse_aesthetic_response,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
AD_ARCHIVE_BLOB_BASE = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
MODEL = "claude-haiku-4-5-20251001"
MAX_IMAGES_PER_CALL = 6
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def get_features_by_issue():
    """Get all batch_tag features grouped by issue, with issue metadata."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_ANON_KEY"]
    sb = create_client(url, key)

    # Fetch all features with aesthetic_profile
    all_features = []
    offset = 0
    while True:
        batch = (
            sb.table("features")
            .select(
                "id, article_title, homeowner_name, designer_name, "
                "architecture_firm, location_city, location_state, location_country, "
                "design_style, square_footage, cost, year_built, "
                "aesthetic_profile, detective_verdict, issue_id, notes"
            )
            .not_.is_("aesthetic_profile", "null")
            .range(offset, offset + 999)
            .execute()
        )
        all_features.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000

    # Filter to batch_tag source only
    batch_tagged = []
    for f in all_features:
        profile = f.get("aesthetic_profile")
        if isinstance(profile, str):
            try:
                profile = json.loads(profile)
            except json.JSONDecodeError:
                continue
        if isinstance(profile, dict) and profile.get("source") == "batch_tag":
            batch_tagged.append(f)

    # Get issue metadata
    issue_ids = list({f["issue_id"] for f in batch_tagged if f.get("issue_id")})
    issue_map = {}
    for chunk_start in range(0, len(issue_ids), 50):
        chunk = issue_ids[chunk_start : chunk_start + 50]
        for iid in chunk:
            issue = sb.table("issues").select("id, year, month, source_url").eq("id", iid).execute()
            if issue.data:
                issue_map[iid] = issue.data[0]

    # Group by issue
    by_issue = defaultdict(list)
    skipped_no_url = 0
    for f in batch_tagged:
        issue = issue_map.get(f["issue_id"])
        if not issue or not issue.get("source_url") or "architecturaldigest.com" not in (issue.get("source_url") or ""):
            skipped_no_url += 1
            continue
        f["_issue"] = issue
        by_issue[f["issue_id"]].append(f)

    return by_issue, sb, skipped_no_url


def fetch_toc(source_url):
    """Fetch and parse JWT tocConfig from an AD archive issue page."""
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


def match_article_in_toc(featured, title, homeowner):
    """Find an article in the TOC by title keywords and/or homeowner name."""
    search_terms = []

    # Title keywords
    if title:
        skip_words = {"the", "a", "an", "of", "in", "at", "on", "to", "for", "and", "or", "with", "by", "from", "is", "are", "ad", "visits"}
        for word in title.split():
            clean = re.sub(r"[^a-zA-Z]", "", word)
            if len(clean) >= 4 and clean.lower() not in skip_words:
                search_terms.append(clean.upper())

    # Homeowner last name
    if homeowner and homeowner.lower() not in ("anonymous", "?", "null", "none"):
        for part in re.split(r"\s+(?:and|&)\s+", homeowner.split(" (")[0].replace("Mrs. ", "")):
            parts = part.strip().split()
            if parts:
                last = parts[-1]
                if len(last) >= 4:
                    search_terms.append(last.upper())

    if not search_terms:
        return None, None

    for art in featured:
        art_title = (art.get("Title") or "").upper()
        teaser = re.sub(r"<[^>]+>", "", art.get("Teaser") or "").upper()
        creator = (art.get("CreatorString") or "").upper()
        searchable = f"{art_title} {teaser} {creator}"

        matches = sum(1 for term in search_terms if term in searchable)

        if matches >= 2 or (matches >= 1 and len(search_terms) <= 2):
            page_range = art.get("PageRange", "")
            pages = [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]
            return pages, art

    return None, None


def fetch_page_images(pages, year, month, max_pages=6):
    """Download page images from Azure Blob Storage. Capped at max_pages."""
    date_str = f"{year}{month:02d}01"
    pages = pages[:max_pages]
    fetched = []

    for page_num in pages:
        url = AD_ARCHIVE_BLOB_BASE.format(date=date_str, page=page_num)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 1000:
                fetched.append((page_num, resp.content))
        except Exception:
            pass

    return fetched


def extract_with_vision(client, article_meta, page_images, year, month, name):
    """Send page images to Claude Vision for taxonomy + structural extraction."""
    content = []
    for page_num, img_bytes in page_images:
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
        })

    prompt = build_vision_prompt(name or "the homeowner", article_meta or {}, year, month)
    content.append({"type": "text", "text": prompt})

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": content}],
        )
        result_text = message.content[0].text
        inp = message.usage.input_tokens
        out = message.usage.output_tokens
        cost = (inp / 1_000_000) * 1.0 + (out / 1_000_000) * 5.0

        json_match = re.search(r"\{[\s\S]*\}", result_text)
        if json_match:
            parsed = json.loads(json_match.group())
            return parsed, cost
    except Exception as e:
        print(f"      Vision API error: {e}")

    return None, 0


def is_anonymous(name):
    """Check if a homeowner name is effectively anonymous."""
    if not name:
        return True
    return name.strip().lower() in ("anonymous", "?", "null", "none", "n/a", "unknown")


def update_feature(sb, feature_id, extracted, current_feature):
    """Update Supabase feature with Vision results. Only fills NULLs for structural fields."""
    update = {}

    # Parse aesthetic profile — always overwrite (replacing batch_tag with deep_extract)
    profile = parse_aesthetic_response(json.dumps(extracted), source="deep_extract")
    if profile:
        update["aesthetic_profile"] = json.dumps(profile)

    # Structural fields — only fill NULLs
    enriched, social = extract_structural_and_social(extracted)

    def maybe_set(db_col, value):
        if current_feature.get(db_col) is not None:
            return
        if value and str(value).lower() not in ("null", "none", "n/a", "unknown"):
            update[db_col] = value

    maybe_set("location_city", enriched.get("location_city"))
    maybe_set("location_state", enriched.get("location_state"))
    maybe_set("location_country", enriched.get("location_country"))
    maybe_set("design_style", enriched.get("design_style"))
    maybe_set("designer_name", enriched.get("designer_name"))
    maybe_set("architecture_firm", enriched.get("architecture_firm"))
    maybe_set("year_built", enriched.get("year_built"))

    # Square footage
    sqft = enriched.get("square_footage")
    if sqft and current_feature.get("square_footage") is None:
        if isinstance(sqft, (int, float)):
            update["square_footage"] = int(sqft)
        else:
            nums = re.findall(r"[\d,]+", str(sqft))
            if nums:
                update["square_footage"] = int(nums[0].replace(",", ""))

    # Cost
    cost_val = enriched.get("cost")
    if cost_val and current_feature.get("cost") is None:
        update["cost"] = str(cost_val)

    # Homeowner name — only if currently anonymous
    newly_named = None
    vision_name = extracted.get("homeowner_name")
    if vision_name and str(vision_name).lower() not in ("null", "none", "n/a", "unknown", "anonymous"):
        if is_anonymous(current_feature.get("homeowner_name")):
            update["homeowner_name"] = vision_name
            newly_named = vision_name

    # Social data in notes
    if social:
        existing_notes = current_feature.get("notes")
        try:
            if existing_notes and isinstance(existing_notes, str):
                notes_dict = json.loads(existing_notes)
            elif isinstance(existing_notes, dict):
                notes_dict = existing_notes
            else:
                notes_dict = {}
        except (json.JSONDecodeError, TypeError):
            notes_dict = {}

        notes_dict["deep_extract"] = social
        notes_dict["source"] = "vision_retag"
        update["notes"] = json.dumps(notes_dict)

    if not update:
        return False, newly_named

    try:
        sb.table("features").update(update).eq("id", feature_id).execute()
        return True, newly_named
    except Exception as e:
        print(f"      DB error: {e}")
        return False, newly_named


def main():
    parser = argparse.ArgumentParser(description="Vision re-tag all batch_tag features")
    parser.add_argument("--dry-run", action="store_true", help="Preview without Vision calls")
    parser.add_argument("--limit", type=int, default=0, help="Max features to process (0=all)")
    parser.add_argument("--issue-limit", type=int, default=0, help="Max issues to process (0=all)")
    args = parser.parse_args()

    print("=" * 70)
    print("VISION RE-TAG: Full population aesthetic extraction")
    print("Replaces text-only batch_tag profiles with Vision-extracted profiles")
    print("Also backfills NULL structural fields and discovers anonymous names")
    print("=" * 70)

    by_issue, sb, skipped_no_url = get_features_by_issue()
    total_features = sum(len(feats) for feats in by_issue.values())
    print(f"\n  Issues with valid URLs: {len(by_issue)}")
    print(f"  Features to process: {total_features}")
    print(f"  Skipped (no archive URL): {skipped_no_url}")

    # Sort issues by ID for deterministic order
    issue_ids = sorted(by_issue.keys())
    if args.issue_limit:
        issue_ids = issue_ids[: args.issue_limit]
        print(f"  Limited to {len(issue_ids)} issues")

    if args.dry_run:
        count = 0
        for iid in issue_ids[:10]:
            feats = by_issue[iid]
            issue = feats[0]["_issue"]
            print(f"\n  Issue AD {issue['year']}-{issue['month']:02d} ({len(feats)} features):")
            for f in feats:
                name = f.get("homeowner_name") or "?"
                title = (f.get("article_title") or "?")[:40]
                anon = " [ANONYMOUS]" if is_anonymous(name) else ""
                print(f"    {name[:25]:25s} | {title}{anon}")
                count += 1
        if len(issue_ids) > 10:
            print(f"\n  ... and {len(issue_ids) - 10} more issues")
        print(f"\n(DRY RUN — no Vision calls. Would process {total_features} features)")
        return

    # Initialize
    client = anthropic.Anthropic()
    total_cost = 0.0
    updated = 0
    skipped = 0
    failed = 0
    feature_num = 0
    newly_named_log = []
    fields_filled = defaultdict(int)

    feature_limit = args.limit if args.limit else float("inf")

    for issue_idx, iid in enumerate(issue_ids):
        feats = by_issue[iid]
        issue = feats[0]["_issue"]
        year = issue["year"]
        month = issue["month"]
        source_url = issue["source_url"]

        print(f"\n{'─' * 70}")
        print(f"ISSUE [{issue_idx+1}/{len(issue_ids)}] AD {year}-{month:02d} — {len(feats)} features")
        print(f"  {source_url}")

        # Fetch TOC once per issue
        try:
            featured = fetch_toc(source_url)
        except Exception as e:
            print(f"  TOC ERROR: {e} — skipping entire issue")
            skipped += len(feats)
            continue

        if not featured:
            print(f"  NO TOC — skipping entire issue")
            skipped += len(feats)
            continue

        print(f"  TOC: {len(featured)} articles found")

        for f in feats:
            if feature_num >= feature_limit:
                break

            feature_num += 1
            fid = f["id"]
            name = f.get("homeowner_name") or "Anonymous"
            title = f.get("article_title") or "?"
            anon_flag = " [ANON]" if is_anonymous(name) else ""

            print(f"\n  [{feature_num}] {name[:30]}{anon_flag} — \"{title[:45]}\"")

            # Match article in TOC
            pages, article_meta = match_article_in_toc(featured, title, name)
            if not pages:
                print(f"    SKIP: not found in TOC")
                skipped += 1
                continue

            art_title = (article_meta.get("Title") or "?")[:40]
            print(f"    Matched: \"{art_title}\" — {len(pages)} pages")

            # Fetch page images
            page_images = fetch_page_images(pages, year, month, max_pages=MAX_IMAGES_PER_CALL)
            if not page_images:
                print(f"    SKIP: no page images")
                skipped += 1
                continue

            # Vision extraction
            extracted, cost = extract_with_vision(client, article_meta, page_images, year, month, name)
            total_cost += cost

            if not extracted:
                print(f"    FAILED: Vision returned nothing (${cost:.4f})")
                failed += 1
                continue

            # Print key extractions
            env = extracted.get("envelope", "?")
            atm = extracted.get("atmosphere", "?")
            vis_name = extracted.get("homeowner_name", "?")
            print(f"    Vision: {env} / {atm} (${cost:.4f})")

            if is_anonymous(name) and vis_name and str(vis_name).lower() not in ("null", "none", "anonymous", "unknown", "n/a"):
                print(f"    ** NEW NAME: {vis_name}")

            # Update Supabase
            success, newly_named = update_feature(sb, fid, extracted, f)
            if success:
                updated += 1

                # Track what fields got filled
                profile = parse_aesthetic_response(json.dumps(extracted), source="deep_extract")
                if profile:
                    fields_filled["aesthetic_profile"] += 1

                enriched, _ = extract_structural_and_social(extracted)
                for field in ["location_city", "location_state", "location_country",
                              "designer_name", "architecture_firm", "year_built",
                              "square_footage", "cost", "design_style"]:
                    if enriched.get(field) and f.get(field) is None:
                        val = enriched[field]
                        if str(val).lower() not in ("null", "none", "n/a", "unknown"):
                            fields_filled[field] += 1

                if newly_named:
                    newly_named_log.append({
                        "feature_id": fid,
                        "old_name": name,
                        "new_name": newly_named,
                        "article_title": title,
                        "issue": f"AD {year}-{month:02d}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    fields_filled["homeowner_name"] += 1
            else:
                print(f"    No changes to write")

            # Rate limit — gentle pause between Vision calls
            time.sleep(0.3)

        if feature_num >= feature_limit:
            print(f"\n  Reached feature limit ({args.limit})")
            break

        # Progress summary every 5 issues
        if (issue_idx + 1) % 5 == 0:
            elapsed_features = updated + skipped + failed
            print(f"\n  ═══ Progress: {issue_idx+1}/{len(issue_ids)} issues | "
                  f"{updated} updated | {skipped} skipped | {failed} failed | "
                  f"${total_cost:.2f} ═══")

    # ═══════════════════════════════════════════════════════════
    # Final summary
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'=' * 70}")
    print(f"VISION RE-TAG COMPLETE")
    print(f"{'=' * 70}")
    print(f"\n  Updated:  {updated}")
    print(f"  Skipped:  {skipped}")
    print(f"  Failed:   {failed}")
    print(f"  Total cost: ${total_cost:.2f}")

    if fields_filled:
        print(f"\n  Fields filled:")
        for field, count in sorted(fields_filled.items(), key=lambda x: -x[1]):
            print(f"    {field:25s} {count}")

    if newly_named_log:
        print(f"\n  Newly named homeowners: {len(newly_named_log)}")
        for entry in newly_named_log:
            print(f"    {entry['old_name']:15s} → {entry['new_name']:30s} ({entry['issue']})")

        # Save to file for review before cross-referencing
        os.makedirs(DATA_DIR, exist_ok=True)
        log_path = os.path.join(DATA_DIR, "newly_named_homeowners.json")
        with open(log_path, "w") as fp:
            json.dump(newly_named_log, fp, indent=2)
        print(f"\n  Saved to: {log_path}")
        print(f"  >> Review these before queuing for cross-reference! <<")


if __name__ == "__main__":
    main()
