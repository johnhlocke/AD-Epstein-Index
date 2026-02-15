#!/usr/bin/env python3
"""Classify AD homeowner names into profession categories using Haiku.

Classifies names on the `features` table first (full baseline), then copies
to the `dossiers` table via feature_id linkage.

Categories: Associate, Politician, Legal, Royalty, Celebrity, Business, Designer, Socialite, Other

Usage:
    python3 src/classify_dossier_subjects.py              # classify all untagged
    python3 src/classify_dossier_subjects.py --all         # reclassify everything
    python3 src/classify_dossier_subjects.py --dry-run     # preview without saving
"""

import argparse
import json
import os
import sys

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

VALID_CATEGORIES = [
    "Associate",
    "Politician",
    "Legal",
    "Royalty",
    "Celebrity",
    "Business",
    "Designer",
    "Socialite",
    "Other",
]

PROMPT = """You are classifying people who appeared in Architectural Digest magazine into profession categories based on what they are primarily known for.

Categories:
- **Associate**: Inner circle of Jeffrey Epstein (e.g., Ghislaine Maxwell, Jean-Luc Brunel, Sarah Kellen)
- **Politician**: Elected officials, government figures (e.g., Bill Clinton, Donald Trump)
- **Legal**: Lawyers, judges (e.g., Alan Dershowitz)
- **Royalty**: Royal family members, titled nobility (e.g., Prince Andrew, Noemie de Rothschild)
- **Celebrity**: Actors, musicians, entertainers, athletes, models, media personalities (e.g., Woody Allen, Kevin Spacey, Nacho Figueras)
- **Business**: Business executives, financiers, investors, real estate developers (e.g., Leon Black, Les Wexner, Mort Zuckerman)
- **Designer**: Architects, interior designers, decorators (e.g., Mark Hampton, Mario Buatta, Peter Marino)
- **Socialite**: Society figures, philanthropists, prominent social figures known primarily for social status rather than a specific profession (e.g., Ivana Trump, Nan Kempner)
- **Other**: Does not fit any of the above, or name is unrecognizable

Rules:
- Choose the SINGLE most prominent category for each person
- If someone is famous for multiple things, pick what they're BEST known for
- Fashion designers and brand founders are "Business" unless they're primarily celebrities
- "Designer" is ONLY for architects and interior/home designers (the AD context)
- If you don't recognize the name, use context clues from the name itself, or "Other"
- "Anonymous" should be classified as "Other"
- Couples like "John and Jane Smith" — classify based on the more prominent person

For each person below, respond with a JSON object mapping the name exactly as given to their category.

People to classify:
{names}

Respond with ONLY valid JSON. Example: {{"John Smith": "Business", "Jane Doe": "Celebrity"}}"""


def classify_batch(client, names: list[str]) -> dict[str, str]:
    """Classify a batch of names using Haiku."""
    names_text = "\n".join(f"- {n}" for n in names)

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        messages=[
            {"role": "user", "content": PROMPT.format(names=names_text)},
        ],
    )

    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]

    result = json.loads(text)

    # Validate categories
    for name, cat in result.items():
        if cat not in VALID_CATEGORIES:
            print(f"  WARNING: '{cat}' not valid for {name}, setting to Other")
            result[name] = "Other"

    return result


def paginated_select(sb, table, columns):
    """Fetch all rows from a table, paginating past the 1000-row limit."""
    all_rows = []
    offset = 0
    while True:
        batch = sb.table(table).select(columns).range(offset, offset + 999).execute()
        all_rows.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
    return all_rows


def main():
    parser = argparse.ArgumentParser(description="Classify AD homeowner names by profession")
    parser.add_argument("--all", action="store_true", help="Reclassify everything")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    args = parser.parse_args()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    client = anthropic.Anthropic()

    # ── Step 1: Fetch all features with homeowner names ──────────────────
    print("Fetching features...")
    all_features = paginated_select(sb, "features", "id, homeowner_name, subject_category")
    named_features = [f for f in all_features if f.get("homeowner_name")]
    print(f"Total features: {len(all_features)}, Named: {len(named_features)}")

    if not args.all:
        named_features = [f for f in named_features if not f.get("subject_category")]
        print(f"Untagged: {len(named_features)}")

    if not named_features:
        print("Nothing to classify.")
        return

    # ── Step 2: Deduplicate names ────────────────────────────────────────
    name_to_feature_ids = {}
    for f in named_features:
        name = f["homeowner_name"].strip()
        if not name:
            continue
        key = name.lower()
        if key not in name_to_feature_ids:
            name_to_feature_ids[key] = {"display_name": name, "feature_ids": []}
        name_to_feature_ids[key]["feature_ids"].append(f["id"])

    unique_names = [v["display_name"] for v in name_to_feature_ids.values()]
    print(f"Unique names to classify: {len(unique_names)}")

    # ── Step 3: Classify in batches ──────────────────────────────────────
    BATCH_SIZE = 80
    all_classifications = {}

    for i in range(0, len(unique_names), BATCH_SIZE):
        batch = unique_names[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(unique_names) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\nBatch {batch_num}/{total_batches} ({len(batch)} names)...")
        try:
            result = classify_batch(client, batch)
            all_classifications.update(result)
            print(f"  Classified {len(result)} names")
        except Exception as e:
            print(f"  ERROR: {e}")
            # Mark failed names as Other
            for name in batch:
                if name not in all_classifications:
                    all_classifications[name] = "Other"

    # ── Step 4: Build lookup (case-insensitive) ──────────────────────────
    classification_lookup = {}
    for name, cat in all_classifications.items():
        classification_lookup[name.lower().strip()] = cat

    # ── Step 5: Show results ─────────────────────────────────────────────
    by_cat = {}
    for name, cat in sorted(all_classifications.items(), key=lambda x: (x[1], x[0])):
        by_cat.setdefault(cat, []).append(name)

    print(f"\n{'=' * 60}")
    print("CLASSIFICATION RESULTS")
    print(f"{'=' * 60}")
    for cat in VALID_CATEGORIES:
        names = by_cat.get(cat, [])
        if names:
            print(f"\n{cat} ({len(names)}):")
            for n in sorted(names):
                print(f"  - {n}")

    if args.dry_run:
        print("\n(DRY RUN — no changes saved)")
        return

    # ── Step 6: Update features table ────────────────────────────────────
    print(f"\nUpdating {len(named_features)} feature rows...")
    updated_features = 0
    for f in named_features:
        name = f["homeowner_name"].strip()
        cat = classification_lookup.get(name.lower(), "Other")
        sb.table("features").update({"subject_category": cat}).eq("id", f["id"]).execute()
        updated_features += 1
        if updated_features % 100 == 0:
            print(f"  {updated_features}/{len(named_features)} features updated...")

    print(f"  Done: {updated_features} features updated")

    # ── Step 7: Copy to dossiers table via feature_id ────────────────────
    print("\nUpdating dossiers...")
    dossiers = paginated_select(sb, "dossiers", "id, feature_id, subject_name")
    updated_dossiers = 0
    for d in dossiers:
        name = (d.get("subject_name") or "").strip()
        cat = classification_lookup.get(name.lower(), "Other")
        sb.table("dossiers").update({"subject_category": cat}).eq("id", d["id"]).execute()
        updated_dossiers += 1

    print(f"  Done: {updated_dossiers} dossiers updated")

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {updated_features} features + {updated_dossiers} dossiers classified")
    print(f"Categories: {', '.join(f'{cat}: {len(by_cat.get(cat, []))}' for cat in VALID_CATEGORIES if by_cat.get(cat))}")


if __name__ == "__main__":
    main()
