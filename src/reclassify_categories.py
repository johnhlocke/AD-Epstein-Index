#!/usr/bin/env python3
"""Reclassify subject_category: Designer→Design, split Other into Art/Media/Design."""

import json
import os
import re
from collections import Counter

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def main():
    # Step 1: Rename all "Designer" → "Design"
    result = sb.from_("features").update({"subject_category": "Design"}).eq("subject_category", "Designer").execute()
    print(f'Step 1: Renamed "Designer" → "Design": {len(result.data)} features')

    # Step 2: Reclassify "Other" features
    all_other = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, notes, scoring_rationale"
        ).eq("subject_category", "Other").range(offset, offset + 999).execute()
        all_other.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    print(f'\nStep 2: Processing {len(all_other)} "Other" features...')

    # Classification rules (first match wins)
    rules = [
        # Art: artists, photographers, filmmakers/directors
        (r"\bartist\b|\bpainter\b|\bsculptor\b|\bprintmaker\b|\binstallation\b|\bcanvas\b|\bmural\b", "Art"),
        (r"\bphotograph", "Art"),
        (r"\bfilm\b|\bdirect(?:or|ed)\b|\bproduc(?:er|tion)\b|\bcinema|\bscreenplay|\bmovie", "Art"),
        # Media: writers, journalists, editors, publishers
        (r"\bwriter\b|\bauthor\b|\bnovelist\b|\bpoet\b|\bjournalist\b|\bplaywright\b|\bscreenwriter\b|\bcritic\b|\bcolumnist\b", "Media"),
        (r"\beditor\b|\bpublish|\bmagazine\b|\bnewspaper|\bcorrespondent", "Media"),
        # Design: architects, fashion
        (r"\barchitect\b", "Design"),
        (r"\bfashion\b|\bcoutur|\bdesigner\b", "Design"),
    ]

    reclassified = Counter()
    updates = {}

    for f in all_other:
        notes_text = ""
        if f.get("notes"):
            n = f["notes"]
            if isinstance(n, str):
                try:
                    n = json.loads(n)
                except (json.JSONDecodeError, ValueError):
                    pass
            if isinstance(n, dict):
                notes_text = " ".join(str(v) for v in n.values())
            else:
                notes_text = str(n)

        rationale_text = ""
        if f.get("scoring_rationale"):
            r = f["scoring_rationale"]
            if isinstance(r, str):
                try:
                    r = json.loads(r)
                except (json.JSONDecodeError, ValueError):
                    pass
            if isinstance(r, dict):
                rationale_text = " ".join(str(v) for v in r.values())
            else:
                rationale_text = str(r)

        combined = (notes_text + " " + rationale_text + " " + (f.get("article_title") or "")).lower()

        for pattern, new_cat in rules:
            if re.search(pattern, combined):
                updates[f["id"]] = new_cat
                reclassified[new_cat] += 1
                break

    # Apply updates in batches
    for new_cat in ["Art", "Media", "Design"]:
        ids = [fid for fid, cat in updates.items() if cat == new_cat]
        if not ids:
            continue
        for i in range(0, len(ids), 50):
            chunk = ids[i : i + 50]
            sb.from_("features").update({"subject_category": new_cat}).in_("id", chunk).execute()
        print(f"  → {new_cat}: {len(ids)} features reclassified")

    remaining = len(all_other) - sum(reclassified.values())
    print(f"  → Other (remaining): {remaining}")

    # Step 3: Final category counts
    print("\n=== Final Category Distribution ===")
    for cat in ["Business", "Celebrity", "Design", "Socialite", "Royalty", "Politician", "Private", "Art", "Media", "Other"]:
        result = sb.from_("features").select("id", count="exact", head=True).eq("subject_category", cat).execute()
        count = result.count or 0
        if count > 0:
            print(f"  {cat:<12} {count:>5}")

    result = sb.from_("features").select("id", count="exact", head=True).is_("subject_category", "null").execute()
    null_count = result.count or 0
    if null_count:
        print(f'  {"(none)":<12} {null_count:>5}')


if __name__ == "__main__":
    main()
