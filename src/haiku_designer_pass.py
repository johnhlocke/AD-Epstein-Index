#!/usr/bin/env python3
"""Haiku vision pass: find real designers for features where scorer falsely copied homeowner name.

Sends first 3 page images to Haiku with a narrow prompt asking ONLY for designer/architect.
Much cheaper than full Opus re-score (~$0.003 per feature vs $0.15).

Usage:
    python3 src/haiku_designer_pass.py
    python3 src/haiku_designer_pass.py --dry-run
"""

import base64
import json
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv
from supabase import create_client
from anthropic import Anthropic

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

DRY_RUN = "--dry-run" in sys.argv

PROMPT = """Look at these pages from an Architectural Digest article about the home of {homeowner}.

Is there a DISTINCT interior designer, decorator, or architect credited in this article who is NOT {homeowner}?

Look for:
- Bylines like "designed by..." or "decorated by..."
- Credit lines mentioning a designer or architect
- Captions crediting a design firm or individual

Respond with ONLY valid JSON:
{{"designer_name": "Name of designer" or null, "architecture_firm": "Firm name" or null}}

If no distinct designer/architect is credited (the homeowner did it themselves, or none mentioned), return null for both."""


def main():
    # Find candidates: scored features with homeowner but no designer, not Designer category
    print("Finding candidate features...")
    all_feats = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, subject_category, issue_id, score_grandeur"
        ).is_("designer_name", "null").not_.is_("homeowner_name", "null").not_.is_(
            "score_grandeur", "null"
        ).neq("subject_category", "Designer").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    candidates = [f for f in all_feats if f["homeowner_name"] and f["homeowner_name"] != "Anonymous"]
    print(f"Candidates: {len(candidates)}")

    if DRY_RUN:
        est_cost = len(candidates) * 0.003
        print(f"Estimated cost: ${est_cost:.2f}")
        for f in candidates[:10]:
            print(f"  #{f['id']} {f['homeowner_name']} [{f.get('subject_category')}]")
        return

    found = 0
    errors = 0
    total_in = 0
    total_out = 0

    for i, feat in enumerate(candidates):
        # Get images (max 3)
        imgs = sb.from_("feature_images").select(
            "public_url, page_number"
        ).eq("feature_id", feat["id"]).order("page_number").limit(3).execute()
        if not imgs.data:
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
            continue

        content.append({"type": "text", "text": PROMPT.format(homeowner=feat["homeowner_name"])})

        try:
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=150,
                messages=[{"role": "user", "content": content}],
            )
            total_in += msg.usage.input_tokens
            total_out += msg.usage.output_tokens

            text = msg.content[0].text.strip()
            json_match = re.search(r"\{[^}]+\}", text)
            if json_match:
                parsed = json.loads(json_match.group())
                designer = parsed.get("designer_name")
                firm = parsed.get("architecture_firm")

                homeowner_lower = feat["homeowner_name"].lower().strip()

                if designer and designer.lower().strip() != homeowner_lower:
                    update = {"designer_name": designer}
                    if firm and firm.lower().strip() != homeowner_lower:
                        update["architecture_firm"] = firm
                    sb.from_("features").update(update).eq("id", feat["id"]).execute()
                    found += 1
                    firm_str = f" ({firm})" if firm else ""
                    print(f"  [{i+1}/{len(candidates)}] #{feat['id']} {feat['homeowner_name']} → {designer}{firm_str}")
                elif firm and firm.lower().strip() != homeowner_lower:
                    sb.from_("features").update({"architecture_firm": firm}).eq("id", feat["id"]).execute()
                    found += 1
                    print(f"  [{i+1}/{len(candidates)}] #{feat['id']} {feat['homeowner_name']} → firm: {firm}")

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error on #{feat['id']}: {e}")

        if (i + 1) % 50 == 0:
            cost = (total_in * 1.0 + total_out * 5.0) / 1_000_000
            print(f"  Progress: {i+1}/{len(candidates)}, {found} found, ${cost:.2f}")
            time.sleep(0.5)

    cost = (total_in * 1.0 + total_out * 5.0) / 1_000_000
    print(f"\n{'=' * 60}")
    print(f"DONE: {len(candidates)} features processed")
    print(f"Designers found: {found}")
    print(f"Errors: {errors}")
    print(f"Cost: ${cost:.2f} ({total_in:,} in / {total_out:,} out)")


if __name__ == "__main__":
    main()
