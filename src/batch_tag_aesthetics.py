#!/usr/bin/env python3
"""Batch-tag all features with the 6-dimension aesthetic taxonomy.

Uses text-only Haiku (~$0.001/feature) to classify features based on existing
metadata (title, homeowner, designer, location, design_style). No images needed.

Cost: ~$1.70 for 1,700 features.

Usage:
    python3 src/batch_tag_aesthetics.py                # Tag all untagged features
    python3 src/batch_tag_aesthetics.py --limit 10     # Tag first 10 untagged
    python3 src/batch_tag_aesthetics.py --dry-run      # Show what would be done
    python3 src/batch_tag_aesthetics.py --confirmed-only  # Only tag confirmed names
    python3 src/batch_tag_aesthetics.py --skip-done    # Skip features that already have profiles
"""

import argparse
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from aesthetic_taxonomy import build_text_prompt, parse_aesthetic_response

MODEL = "claude-haiku-4-5-20251001"


def get_features(confirmed_only=False, skip_done=True):
    """Fetch features from Supabase that need aesthetic tagging."""
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_ANON_KEY"]
    sb = create_client(url, key)

    # Fetch all features (paginated)
    features = []
    offset = 0
    while True:
        query = sb.table("features").select(
            "id, article_title, homeowner_name, designer_name, "
            "location_city, location_state, location_country, "
            "design_style, aesthetic_profile, detective_verdict, issue_id"
        )

        if confirmed_only:
            query = query.eq("detective_verdict", "YES")

        batch = query.range(offset, offset + 999).execute()
        features.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000

    # Filter to untagged features
    if skip_done:
        features = [f for f in features if not f.get("aesthetic_profile")]

    return features, sb


def build_location_string(feature):
    """Build a location string from city/state/country."""
    parts = []
    for key in ["location_city", "location_state", "location_country"]:
        val = feature.get(key)
        if val and str(val).lower() not in ("null", "none", "n/a"):
            parts.append(val)
    return ", ".join(parts) if parts else None


def tag_feature(client, feature):
    """Tag a single feature with aesthetic taxonomy using text-only Haiku.

    Returns (profile_dict, cost) or (None, 0).
    """
    title = feature.get("article_title")
    homeowner = feature.get("homeowner_name")
    designer = feature.get("designer_name")
    location = build_location_string(feature)
    style = feature.get("design_style")

    prompt = build_text_prompt(title, homeowner, designer, location, style)

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        )
        result_text = message.content[0].text

        inp = message.usage.input_tokens
        out = message.usage.output_tokens
        cost = (inp / 1_000_000) * 1.0 + (out / 1_000_000) * 5.0

        profile = parse_aesthetic_response(result_text, source="batch_tag")
        return profile, cost

    except Exception as e:
        print(f"    API error: {e}")
        return None, 0


def main():
    parser = argparse.ArgumentParser(description="Batch-tag features with aesthetic taxonomy")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--limit", type=int, default=0, help="Max features to process (0=all)")
    parser.add_argument("--skip-done", action="store_true", default=True, help="Skip already-tagged features")
    parser.add_argument("--confirmed-only", action="store_true", help="Only tag confirmed names")
    args = parser.parse_args()

    print("=" * 60)
    print("BATCH AESTHETIC TAXONOMY TAGGER")
    print("=" * 60)

    features, sb = get_features(
        confirmed_only=args.confirmed_only,
        skip_done=args.skip_done,
    )
    print(f"\nFound {len(features)} features to tag")

    if args.limit:
        features = features[:args.limit]
        print(f"Limited to {len(features)} features")

    if args.dry_run:
        for i, f in enumerate(features[:20]):
            print(f"  [{i+1}] {f.get('homeowner_name', '?')} — {f.get('design_style', '?')} — {f.get('article_title', '?')[:50]}")
        if len(features) > 20:
            print(f"  ... and {len(features) - 20} more")
        print("\n(DRY RUN — no changes made)")
        return

    import anthropic
    client = anthropic.Anthropic()

    tagged = 0
    failed = 0
    total_cost = 0.0

    for i, feature in enumerate(features):
        fid = feature["id"]
        name = feature.get("homeowner_name") or "?"
        style = feature.get("design_style") or "?"

        profile, cost = tag_feature(client, feature)
        total_cost += cost

        if profile:
            # Write to Supabase
            try:
                sb.table("features").update({
                    "aesthetic_profile": json.dumps(profile),
                }).eq("id", fid).execute()
                tagged += 1
                env = profile.get("envelope", "?")
                atm = profile.get("atmosphere", "?")
                print(f"  [{i+1}/{len(features)}] {name[:30]:30s} → {env} / {atm}  (${cost:.4f})")
            except Exception as e:
                print(f"  [{i+1}/{len(features)}] {name[:30]:30s} → DB error: {e}")
                failed += 1
        else:
            print(f"  [{i+1}/{len(features)}] {name[:30]:30s} → FAILED (${cost:.4f})")
            failed += 1

        # Rate limit: ~2 req/sec for Haiku
        if (i + 1) % 50 == 0:
            print(f"\n  Progress: {i+1}/{len(features)} | Tagged: {tagged} | Failed: {failed} | Cost: ${total_cost:.4f}\n")
            time.sleep(1)

    print(f"\n{'=' * 60}")
    print(f"DONE: {tagged} tagged, {failed} failed out of {len(features)} features")
    print(f"Total API cost: ${total_cost:.4f}")


if __name__ == "__main__":
    main()
