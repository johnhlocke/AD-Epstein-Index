#!/usr/bin/env python3
"""Validation: compare text-only aesthetic tags against Vision extraction.

Picks N random features that were tagged by the batch text-only tagger,
runs them through full Vision extraction (same pipeline as confirmed names),
and reports per-dimension agreement rates.

This tells us how reliable the baseline population tags are.

Usage:
    python3 src/validate_taxonomy.py              # 50 random features
    python3 src/validate_taxonomy.py --limit 20   # 20 random features
    python3 src/validate_taxonomy.py --dry-run     # Show what would be sampled
"""

import argparse
import base64
import json
import os
import random
import re
import sys
import time

import anthropic
import requests
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(__file__))
from aesthetic_taxonomy import (
    SINGLE_SELECT_DIMS,
    TAXONOMY,
    build_vision_prompt,
    parse_aesthetic_response,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
AD_ARCHIVE_BLOB_BASE = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
MODEL = "claude-haiku-4-5-20251001"
MAX_IMAGES_PER_CALL = 6


def get_random_features(limit=50):
    """Get random features with text-only aesthetic profiles + valid issue URLs."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_ANON_KEY"]
    sb = create_client(url, key)

    # Get all features that have aesthetic_profile
    features = []
    offset = 0
    while True:
        batch = (
            sb.table("features")
            .select(
                "id, article_title, homeowner_name, designer_name, "
                "location_city, location_state, location_country, "
                "design_style, aesthetic_profile, detective_verdict, issue_id"
            )
            .not_.is_("aesthetic_profile", "null")
            .range(offset, offset + 999)
            .execute()
        )
        features.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000

    # Filter: must have batch_tag source (not deep_extract)
    tagged = []
    for f in features:
        profile = f.get("aesthetic_profile")
        if isinstance(profile, str):
            try:
                profile = json.loads(profile)
            except json.JSONDecodeError:
                continue
        if isinstance(profile, dict) and profile.get("source") == "batch_tag":
            f["_parsed_profile"] = profile
            tagged.append(f)

    # Exclude confirmed names — they already have Vision profiles
    tagged = [f for f in tagged if f.get("detective_verdict") != "YES"]

    # Get issue data for each feature
    issue_ids = list({f["issue_id"] for f in tagged if f.get("issue_id")})
    issue_map = {}
    for chunk_start in range(0, len(issue_ids), 50):
        chunk = issue_ids[chunk_start : chunk_start + 50]
        for iid in chunk:
            issue = sb.table("issues").select("id, year, month, source_url").eq("id", iid).execute()
            if issue.data:
                issue_map[iid] = issue.data[0]

    # Filter to features with valid archive URLs
    valid = []
    for f in tagged:
        issue = issue_map.get(f["issue_id"])
        if issue and issue.get("source_url") and "architecturaldigest.com" in (issue.get("source_url") or ""):
            f["_issue"] = issue
            valid.append(f)

    print(f"  Total with batch_tag profile: {len(tagged)}")
    print(f"  With valid archive URL: {len(valid)}")

    # Random sample
    random.shuffle(valid)
    sample = valid[:limit]

    return sample, sb


def fetch_article_page_range(source_url, title, homeowner):
    """Find article in JWT TOC by title or homeowner name."""
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

    # Build search terms from title and homeowner
    search_terms = []
    if title:
        # Use significant words from title (skip common words)
        skip = {"the", "a", "an", "of", "in", "at", "on", "to", "for", "and", "or", "with", "by", "from", "is", "are"}
        for word in title.split():
            clean = re.sub(r"[^a-zA-Z]", "", word)
            if len(clean) >= 4 and clean.lower() not in skip:
                search_terms.append(clean.upper())

    if homeowner and homeowner.lower() not in ("anonymous", "?", "null", "none"):
        for part in re.split(r"\s+(?:and|&)\s+", homeowner):
            last = part.strip().split()[-1]
            if len(last) >= 4:
                search_terms.append(last.upper())

    if not search_terms:
        return None, None

    for art in featured:
        art_title = (art.get("Title") or "").upper()
        teaser = re.sub(r"<[^>]+>", "", art.get("Teaser") or "").upper()
        creator = (art.get("CreatorString") or "").upper()

        # Need at least 2 matching terms, or 1 if it's a long distinctive term
        matches = 0
        for term in search_terms:
            if term in art_title or term in teaser or term in creator:
                matches += 1

        if matches >= 2 or (matches >= 1 and len(search_terms) <= 2):
            page_range = art.get("PageRange", "")
            pages = [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]
            return pages, art

    return None, None


def fetch_page_images(pages, year, month, max_pages=6):
    """Download page images. Limit to max_pages to control cost."""
    date_str = f"{year}{month:02d}01"
    pages = pages[:max_pages]  # Cap for cost control
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


def extract_with_vision(article_meta, page_images, year, month, name):
    """Send page images to Claude Vision for taxonomy extraction."""
    client = anthropic.Anthropic()
    month_str = f"{month:02d}" if isinstance(month, int) else str(month)

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
        print(f"    Vision API error: {e}")

    return None, 0


def compare_profiles(text_profile, vision_profile):
    """Compare text-only vs vision profiles. Returns per-dimension results."""
    results = {}

    for dim in SINGLE_SELECT_DIMS:
        text_val = text_profile.get(dim)
        vision_val = vision_profile.get(dim)
        results[dim] = {
            "text": text_val,
            "vision": vision_val,
            "match": text_val == vision_val if (text_val and vision_val) else None,
        }

    # Art collection comparison (set overlap)
    text_art = set(text_profile.get("art_collection", []))
    vision_art = set(vision_profile.get("art_collection", []))
    if text_art and vision_art:
        # Jaccard similarity
        intersection = text_art & vision_art
        union = text_art | vision_art
        jaccard = len(intersection) / len(union) if union else 0
        results["art_collection"] = {
            "text": sorted(text_art),
            "vision": sorted(vision_art),
            "match": jaccard >= 0.5,  # >50% overlap = "match"
            "jaccard": jaccard,
        }
    else:
        results["art_collection"] = {
            "text": sorted(text_art),
            "vision": sorted(vision_art),
            "match": None,
        }

    return results


def main():
    parser = argparse.ArgumentParser(description="Validate text-only taxonomy against Vision extraction")
    parser.add_argument("--limit", type=int, default=50, help="Number of features to validate (default 50)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be sampled")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    random.seed(args.seed)

    print("=" * 70)
    print("AESTHETIC TAXONOMY VALIDATION")
    print("Text-only (batch_tag) vs Vision extraction comparison")
    print("=" * 70)

    sample, sb = get_random_features(limit=args.limit)
    print(f"\nSampled {len(sample)} features for validation\n")

    if args.dry_run:
        for i, f in enumerate(sample[:20]):
            name = f.get("homeowner_name") or "?"
            title = (f.get("article_title") or "?")[:40]
            issue = f["_issue"]
            profile = f["_parsed_profile"]
            print(f"  [{i+1}] {name[:25]:25s} | {title:40s} | {profile.get('envelope', '?')}")
        if len(sample) > 20:
            print(f"  ... and {len(sample) - 20} more")
        print("\n(DRY RUN — no Vision calls made)")
        return

    # Run validation
    all_comparisons = []
    total_cost = 0.0
    skipped = 0

    for i, f in enumerate(sample):
        name = f.get("homeowner_name") or "Anonymous"
        title = f.get("article_title") or "?"
        issue = f["_issue"]
        text_profile = f["_parsed_profile"]

        print(f"[{i+1}/{len(sample)}] {name[:30]} — \"{title[:40]}\"")
        print(f"  Text-only: {text_profile.get('envelope', '?')} / {text_profile.get('atmosphere', '?')}")

        # Find article in TOC
        try:
            pages, article_meta = fetch_article_page_range(
                issue["source_url"], title, name
            )
        except Exception as e:
            print(f"  SKIP: TOC error: {e}")
            skipped += 1
            continue

        if not pages:
            print(f"  SKIP: Article not found in TOC")
            skipped += 1
            continue

        # Fetch page images (cap at 6 for cost)
        page_images = fetch_page_images(pages, issue["year"], issue["month"], max_pages=6)
        if not page_images:
            print(f"  SKIP: No page images")
            skipped += 1
            continue

        print(f"  Pages: {len(page_images)} images from {','.join(str(p) for p, _ in page_images)}")

        # Vision extraction
        extracted, cost = extract_with_vision(article_meta, page_images, issue["year"], issue["month"], name)
        total_cost += cost

        if not extracted:
            print(f"  SKIP: Vision returned nothing (${cost:.4f})")
            skipped += 1
            continue

        # Parse vision result into profile
        vision_profile = parse_aesthetic_response(json.dumps(extracted), source="validation")
        if not vision_profile:
            print(f"  SKIP: Vision profile unparseable (${cost:.4f})")
            skipped += 1
            continue

        # Compare
        comparison = compare_profiles(text_profile, vision_profile)
        comparison["_name"] = name
        comparison["_title"] = title
        comparison["_cost"] = cost
        all_comparisons.append(comparison)

        # Print per-feature comparison
        for dim in SINGLE_SELECT_DIMS:
            r = comparison[dim]
            icon = "=" if r["match"] else "X" if r["match"] is False else "?"
            print(f"  {icon} {dim:25s} text={r['text']:30s} vision={r['vision'] or '?'}")

        art_r = comparison.get("art_collection", {})
        if art_r.get("jaccard") is not None:
            icon = "=" if art_r["match"] else "X"
            print(f"  {icon} {'art_collection':25s} jaccard={art_r['jaccard']:.2f}  text={art_r['text']}  vision={art_r['vision']}")

        print(f"  Cost: ${cost:.4f}")

        # Rate limit
        time.sleep(0.5)

        if (i + 1) % 10 == 0:
            print(f"\n  --- Progress: {i+1}/{len(sample)} | Compared: {len(all_comparisons)} | Skipped: {skipped} | Cost: ${total_cost:.4f} ---\n")

    # ═══════════════════════════════════════════════════════════
    # Summary statistics
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'=' * 70}")
    print(f"VALIDATION RESULTS")
    print(f"{'=' * 70}")
    print(f"\nSampled: {len(sample)} | Compared: {len(all_comparisons)} | Skipped: {skipped}")
    print(f"Total Vision cost: ${total_cost:.4f}\n")

    if not all_comparisons:
        print("No valid comparisons to analyze.")
        return

    # Per-dimension agreement rates
    print(f"{'DIMENSION':30s} {'AGREE':>6s} {'DISAGREE':>9s} {'N/A':>5s} {'RATE':>8s}")
    print("-" * 62)

    dim_stats = {}
    for dim in SINGLE_SELECT_DIMS + ["art_collection"]:
        agree = sum(1 for c in all_comparisons if c.get(dim, {}).get("match") is True)
        disagree = sum(1 for c in all_comparisons if c.get(dim, {}).get("match") is False)
        na = sum(1 for c in all_comparisons if c.get(dim, {}).get("match") is None)
        total = agree + disagree
        rate = agree / total if total > 0 else 0
        dim_stats[dim] = {"agree": agree, "disagree": disagree, "na": na, "rate": rate}
        print(f"{dim:30s} {agree:6d} {disagree:9d} {na:5d} {rate:7.0%}")

    # Overall agreement
    all_agree = sum(s["agree"] for s in dim_stats.values())
    all_total = sum(s["agree"] + s["disagree"] for s in dim_stats.values())
    overall = all_agree / all_total if all_total > 0 else 0
    print(f"\n{'OVERALL':30s} {all_agree:6d} {all_total - all_agree:9d} {'':>5s} {overall:7.0%}")

    # Disagreement details — what are the most common mismatches?
    print(f"\n{'=' * 70}")
    print(f"COMMON DISAGREEMENTS (text → vision)")
    print(f"{'=' * 70}")

    for dim in SINGLE_SELECT_DIMS:
        mismatches = {}
        for c in all_comparisons:
            r = c.get(dim, {})
            if r.get("match") is False:
                key = f"{r['text']} → {r['vision']}"
                mismatches[key] = mismatches.get(key, 0) + 1

        if mismatches:
            print(f"\n  {dim}:")
            for pair, count in sorted(mismatches.items(), key=lambda x: -x[1]):
                print(f"    {count}x  {pair}")

    # Save results to JSON for later analysis
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "validation_results.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump({
            "sample_size": len(sample),
            "compared": len(all_comparisons),
            "skipped": skipped,
            "total_cost": total_cost,
            "dim_stats": dim_stats,
            "overall_agreement": overall,
            "comparisons": [
                {
                    "name": c["_name"],
                    "title": c["_title"],
                    "cost": c["_cost"],
                    **{dim: c[dim] for dim in SINGLE_SELECT_DIMS + ["art_collection"]},
                }
                for c in all_comparisons
            ],
        }, f, indent=2, default=str)
    print(f"\nDetailed results saved to: {output_path}")


if __name__ == "__main__":
    main()
