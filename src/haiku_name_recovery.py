#!/usr/bin/env python3
"""Haiku vision pass: recover homeowner names from Anonymous/NULL features.

Sends ALL page images to Haiku with a narrow name-focused prompt.
Much cheaper than re-running Opus (~$0.014 per feature vs $0.15).

Usage:
    python3 src/haiku_name_recovery.py --dry-run
    python3 src/haiku_name_recovery.py
    python3 src/haiku_name_recovery.py --limit 20
"""

import argparse
import base64
import json
import os
import re
import time

import requests
from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

PROMPT = """Look at ALL of these pages from an Architectural Digest article about a featured home.

Your ONLY task: find the homeowner's name. Look carefully at:
- Article headlines and subheadlines (e.g., "At Home with John Smith", "The Smith Residence")
- Bylines and credits (e.g., "Text by Jane Doe / The home of John Smith")
- Opening paragraphs (often name the homeowner in the first 1-3 sentences)
- Photo captions (may credit "the home of..." or "John Smith's living room")
- Pull quotes attributed to the homeowner
- Any text that identifies who lives in this home

Read ALL visible text on every page — names often appear in small caption text or deep in the article body, not just the headline.

Respond with ONLY valid JSON:
{{"homeowner_name": "Full Name" or null, "confidence": "high" or "medium" or "low", "source": "where you found the name (e.g., headline, caption, paragraph)"}}

If you genuinely cannot find any homeowner name on any page, return null for homeowner_name."""


def fetch_candidates():
    """Get all features with Anonymous or NULL homeowner_name."""
    all_feats = []
    offset = 0
    while True:
        # Anonymous features
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, issue_id"
        ).eq("homeowner_name", "Anonymous").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    offset = 0
    while True:
        # NULL homeowner_name features
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, issue_id"
        ).is_("homeowner_name", "null").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    return all_feats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    print("=" * 60)
    print("HAIKU NAME RECOVERY — Anonymous/NULL features")
    print("=" * 60)

    candidates = fetch_candidates()
    print(f"Candidates: {len(candidates)}")

    if args.limit:
        candidates = candidates[:args.limit]
        print(f"Limited to {len(candidates)}")

    if args.dry_run:
        # Check image counts for cost estimate
        total_images = 0
        for f in candidates[:50]:
            imgs = sb.from_("feature_images").select(
                "id", count="exact", head=True
            ).eq("feature_id", f["id"]).execute()
            total_images += imgs.count or 0

        avg_imgs = total_images / min(len(candidates), 50)
        est_input = len(candidates) * avg_imgs * 1500  # ~1500 tokens per image
        est_output = len(candidates) * 100
        est_cost = (est_input * 1.0 + est_output * 5.0) / 1_000_000
        print(f"\nAvg images per feature: {avg_imgs:.1f}")
        print(f"Estimated input tokens: {est_input:,.0f}")
        print(f"Estimated cost: ${est_cost:.2f}")
        return

    found = 0
    errors = 0
    skipped = 0
    total_in = 0
    total_out = 0
    results = []  # Save all results for analysis

    for i, feat in enumerate(candidates):
        fid = feat["id"]

        # Get ALL images
        imgs = sb.from_("feature_images").select(
            "public_url, page_number"
        ).eq("feature_id", fid).order("page_number").execute()

        if not imgs.data:
            skipped += 1
            continue

        content = []
        img_count = 0
        for img_row in imgs.data:
            try:
                resp = requests.get(img_row["public_url"], timeout=10)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    b64 = base64.b64encode(resp.content).decode()
                    content.append({
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
                    })
                    img_count += 1
            except requests.RequestException:
                pass

        if not content:
            skipped += 1
            continue

        content.append({"type": "text", "text": PROMPT})

        try:
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=200,
                messages=[{"role": "user", "content": content}],
            )
            total_in += msg.usage.input_tokens
            total_out += msg.usage.output_tokens

            text = msg.content[0].text.strip()
            json_match = re.search(r"\{[^}]+\}", text)
            if json_match:
                parsed = json.loads(json_match.group())
                name = parsed.get("homeowner_name")
                confidence = parsed.get("confidence", "unknown")
                source = parsed.get("source", "unknown")

                result = {
                    "feature_id": fid,
                    "old_name": feat.get("homeowner_name"),
                    "new_name": name,
                    "confidence": confidence,
                    "source": source,
                    "images": img_count,
                }
                results.append(result)

                if name and name.lower() not in ("null", "none", "anonymous", "unknown", ""):
                    sb.from_("features").update(
                        {"homeowner_name": name}
                    ).eq("id", fid).execute()
                    found += 1
                    print(f"  [{i+1}/{len(candidates)}] #{fid} → {name} ({confidence}, {source})")

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error on #{fid}: {e}")

        if (i + 1) % 50 == 0:
            cost = (total_in * 1.0 + total_out * 5.0) / 1_000_000
            print(f"  Progress: {i+1}/{len(candidates)}, {found} found, {skipped} skipped, ${cost:.2f}")
            time.sleep(0.5)

    cost = (total_in * 1.0 + total_out * 5.0) / 1_000_000
    print(f"\n{'=' * 60}")
    print(f"DONE: {len(candidates)} candidates processed")
    print(f"Names found: {found}")
    print(f"Skipped (no images): {skipped}")
    print(f"Errors: {errors}")
    print(f"Cost: ${cost:.2f} ({total_in:,} in / {total_out:,} out)")

    # Save results
    results_path = os.path.join(os.path.dirname(__file__), "..", "data", "name_recovery_results.json")
    os.makedirs(os.path.dirname(results_path), exist_ok=True)
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results saved to {results_path}")


if __name__ == "__main__":
    main()
