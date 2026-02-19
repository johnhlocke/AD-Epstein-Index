#!/usr/bin/env python3
"""Opus Vision pass: recover homeowner names from Anonymous/NULL features.

Sends ALL page images to Opus with a carefully directed prompt that
distinguishes homeowners from designers/architects.

Usage:
    python3 src/opus_name_recovery.py --dry-run
    python3 src/opus_name_recovery.py --limit 10
    python3 src/opus_name_recovery.py
"""

import argparse
import base64
import json
import os
import random
import re
import time

import requests
from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

PROMPT = """You are reading pages from an Architectural Digest article about a featured home.

Your ONLY task: identify the HOMEOWNER — the person or people who LIVE in this home.

CRITICAL DISTINCTION:
- The HOMEOWNER is who LIVES in the house. They are the client. The article is about THEIR home.
- The DESIGNER/ARCHITECT is who DESIGNED or DECORATED the house. They are hired professionals.
- These are usually DIFFERENT people. Do NOT return the designer's name as the homeowner.
- ONLY return the designer as the homeowner if the article EXPLICITLY states it is the designer's OWN home
  (e.g., "architect John Smith's personal residence" or "at home with designer Jane Doe").

Where to look:
- Headlines: "At Home with [Name]" or "The [Name] Residence"
- Subheadlines: "Designer X creates a haven for [homeowner name]"
- Opening paragraphs: usually name the homeowner in the first few sentences
- Photo captions: "the home of [Name]" or "[Name]'s living room"
- Pull quotes: attributed to the homeowner discussing their home
- Credit blocks: sometimes list "Home of [Name]"

Common patterns in anonymous articles:
- "a tech executive" / "a young family" / "a philanthropic couple" = genuinely anonymous, return null
- "the clients" with no name ever given = genuinely anonymous, return null
- The designer is named but the homeowner is only described generically = genuinely anonymous

Respond with ONLY valid JSON:
{
  "homeowner_name": "Full Name" or null,
  "designer_name": "Designer/Architect Name if mentioned" or null,
  "is_designers_own_home": true or false,
  "confidence": "high" or "medium" or "low",
  "evidence": "Quote or describe exactly where you found the homeowner name",
  "why_anonymous": "If null, explain why — e.g., 'Article only refers to owners as a young couple'"
}"""


def fetch_candidates(seed=42):
    """Get all features with Anonymous or NULL homeowner_name."""
    all_feats = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, designer_name, issue_id"
        ).eq("homeowner_name", "Anonymous").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, designer_name, issue_id"
        ).is_("homeowner_name", "null").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Get issue years for context
    issue_ids = list(set(f["issue_id"] for f in all_feats))
    issues = {}
    for iid in issue_ids:
        result = sb.from_("issues").select("id, year, month").eq("id", iid).execute()
        if result.data:
            issues[iid] = result.data[0]

    for f in all_feats:
        iss = issues.get(f["issue_id"], {})
        f["_year"] = iss.get("year")
        f["_month"] = iss.get("month")

    return all_feats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--no-write", action="store_true", help="Don't write to DB, just report")
    args = parser.parse_args()

    print("=" * 60)
    print("OPUS NAME RECOVERY — Anonymous/NULL features")
    print("=" * 60)

    candidates = fetch_candidates()
    print(f"Total candidates: {len(candidates)}")

    if args.limit:
        # Random sample for testing
        rng = random.Random(42)
        candidates = rng.sample(candidates, min(args.limit, len(candidates)))
        print(f"Sampled {len(candidates)} for testing")

    if args.dry_run:
        total_images = 0
        for f in candidates[:50]:
            imgs = sb.from_("feature_images").select(
                "id", count="exact", head=True
            ).eq("feature_id", f["id"]).execute()
            total_images += imgs.count or 0

        avg_imgs = total_images / min(len(candidates), 50)
        est_input = len(candidates) * avg_imgs * 1500
        est_output = len(candidates) * 300
        est_cost = (est_input * 15.0 + est_output * 75.0) / 1_000_000
        print(f"\nAvg images per feature: {avg_imgs:.1f}")
        print(f"Estimated cost: ${est_cost:.2f}")
        return

    found = 0
    genuinely_anonymous = 0
    designers_own = 0
    errors = 0
    skipped = 0
    total_in = 0
    total_out = 0
    results = []

    for i, feat in enumerate(candidates):
        fid = feat["id"]
        year = feat.get("_year", "?")
        month = feat.get("_month", "?")

        # Get ALL images
        imgs = sb.from_("feature_images").select(
            "public_url, page_number"
        ).eq("feature_id", fid).order("page_number").execute()

        if not imgs.data:
            skipped += 1
            continue

        content = []
        for img_row in imgs.data:
            try:
                resp = requests.get(img_row["public_url"], timeout=10)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    b64 = base64.b64encode(resp.content).decode()
                    content.append({
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
                    })
            except requests.RequestException:
                pass

        if not content:
            skipped += 1
            continue

        content.append({"type": "text", "text": PROMPT})

        try:
            msg = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": content}],
            )
            total_in += msg.usage.input_tokens
            total_out += msg.usage.output_tokens

            text = msg.content[0].text.strip()
            json_match = re.search(r"\{[\s\S]*\}", text)
            if json_match:
                parsed = json.loads(json_match.group())
                name = parsed.get("homeowner_name")
                designer = parsed.get("designer_name")
                own_home = parsed.get("is_designers_own_home", False)
                confidence = parsed.get("confidence", "unknown")
                evidence = parsed.get("evidence", "")
                why_anon = parsed.get("why_anonymous", "")

                result = {
                    "feature_id": fid,
                    "article_title": feat.get("article_title"),
                    "existing_designer": feat.get("designer_name"),
                    "year": year,
                    "homeowner_name": name,
                    "designer_name": designer,
                    "is_designers_own_home": own_home,
                    "confidence": confidence,
                    "evidence": evidence,
                    "why_anonymous": why_anon,
                    "images": len(content) - 1,
                }
                results.append(result)

                if name and name.lower() not in ("null", "none", "anonymous", "unknown", ""):
                    found += 1
                    own_str = " [DESIGNER'S OWN HOME]" if own_home else ""
                    print(f"  [{i+1}/{len(candidates)}] #{fid} ({year}-{month:02d}) → {name} ({confidence}){own_str}")
                    print(f"    Evidence: {evidence[:120]}")

                    if own_home:
                        designers_own += 1

                    if not args.no_write:
                        sb.from_("features").update(
                            {"homeowner_name": name}
                        ).eq("id", fid).execute()
                else:
                    genuinely_anonymous += 1
                    if why_anon:
                        print(f"  [{i+1}/{len(candidates)}] #{fid} ({year}-{month:02d}) ANON: {why_anon[:120]}")

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error on #{fid}: {e}")

        if (i + 1) % 10 == 0:
            cost = (total_in * 15.0 + total_out * 75.0) / 1_000_000
            print(f"  Progress: {i+1}/{len(candidates)}, {found} found, {genuinely_anonymous} anon, ${cost:.2f}")
            time.sleep(0.5)

    cost = (total_in * 15.0 + total_out * 75.0) / 1_000_000
    print(f"\n{'=' * 60}")
    print(f"DONE: {len(candidates)} candidates processed")
    print(f"Names found: {found} ({designers_own} are designer's own home)")
    print(f"Genuinely anonymous: {genuinely_anonymous}")
    print(f"Skipped (no images): {skipped}")
    print(f"Errors: {errors}")
    print(f"Cost: ${cost:.2f} ({total_in:,} in / {total_out:,} out)")
    if args.no_write:
        print("(--no-write mode: no DB updates)")

    # Save results
    results_path = os.path.join(os.path.dirname(__file__), "..", "data", "name_recovery_opus_results.json")
    os.makedirs(os.path.dirname(results_path), exist_ok=True)
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results saved to {results_path}")


if __name__ == "__main__":
    main()
