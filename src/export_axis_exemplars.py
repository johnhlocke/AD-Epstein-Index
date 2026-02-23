#!/usr/bin/env python3
"""
Export axis exemplar images for the Aesthetic Methodology Section.

For each of the 9 scoring axes, selects the best score-1 and score-5
example (preferring named homeowners with images), and outputs a JSON
file used by the website component.

Output: web/src/components/landing/axis-exemplars.json
"""

import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# 9 axes: (display_name, db_column, json_rationale_key)
AXES = [
    ("Grandeur",        "score_grandeur",        "grandeur"),
    ("Material Warmth", "score_material_warmth",  "material_warmth"),
    ("Maximalism",      "score_maximalism",       "maximalism"),
    ("Historicism",     "score_historicism",       "historicism"),
    ("Provenance",      "score_provenance",        "provenance"),
    ("Hospitality",     "score_hospitality",       "hospitality"),
    ("Formality",       "score_formality",         "formality"),
    ("Curation",        "score_curation",          "curation"),
    ("Theatricality",   "score_theatricality",     "theatricality"),
]

OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "web", "src", "components", "landing", "axis-exemplars.json"
)


used_feature_ids = set()


def find_exemplar(axis_col, score_value, rationale_key):
    """Find the best exemplar for a given axis and score value.

    Prefers named homeowners (not Anonymous) with images.
    Avoids reusing features already selected for other axes.
    Returns dict with feature data + image URL + caption.
    """
    # Query features with this exact score, preferring named homeowners
    resp = (
        sb.from_("features")
        .select(
            "id, homeowner_name, article_title, issue_id, "
            "aesthetic_profile, scoring_rationale, "
            f"{axis_col}"
        )
        .eq(axis_col, score_value)
        .not_.is_("homeowner_name", "null")
        .neq("homeowner_name", "Anonymous")
        .not_.is_("aesthetic_profile", "null")
        .order("id")
        .limit(100)
        .execute()
    )

    candidates = resp.data or []

    # Fallback: allow Anonymous if no named homeowners found
    if not candidates:
        resp = (
            sb.from_("features")
            .select(
                "id, homeowner_name, article_title, issue_id, "
                "aesthetic_profile, scoring_rationale, "
                f"{axis_col}"
            )
            .eq(axis_col, score_value)
            .not_.is_("aesthetic_profile", "null")
            .order("id")
            .limit(100)
            .execute()
        )
        candidates = resp.data or []

    if not candidates:
        return None

    # Enrich candidates with image counts and year for sorting
    enriched = []
    for feature in candidates:
        fid = feature["id"]
        if fid in used_feature_ids:
            continue

        # Get all images for this feature
        img_resp = (
            sb.from_("feature_images")
            .select("public_url, page_number")
            .eq("feature_id", fid)
            .order("page_number")
            .limit(10)
            .execute()
        )
        images = img_resp.data or []

        # Require at least 3 images — ensures we have actual spread coverage
        if len(images) < 3:
            continue

        # Get issue year
        issue_resp = (
            sb.from_("issues")
            .select("year, month")
            .eq("id", feature["issue_id"])
            .limit(1)
            .execute()
        )
        year = issue_resp.data[0]["year"] if issue_resp.data else 1988

        enriched.append((feature, images, year))

    if not enriched:
        return None

    # Sort: prefer newer features (cleaner digital images), then more images
    enriched.sort(key=lambda x: (-x[2], -len(x[1])))

    # Pick the best candidate
    for feature, images, year in enriched:
        fid = feature["id"]

        # Pick the 3rd page (index 2) — deep enough to be a full interior photo spread,
        # not the title page (index 0) or text-heavy intro (index 1).
        # For features with many images, pick index 2 or 3 (the heart of the spread).
        if len(images) >= 5:
            best_img = images[3]   # page 4 — usually a clean full-page interior
        elif len(images) >= 3:
            best_img = images[2]   # page 3
        else:
            best_img = images[1]

        # Check if feature has a dossier
        dossier_resp = (
            sb.from_("dossiers")
            .select("id")
            .eq("feature_id", fid)
            .limit(1)
            .execute()
        )
        dossier_id = dossier_resp.data[0]["id"] if dossier_resp.data else None

        # Extract rationale for this specific axis
        rationale = feature.get("scoring_rationale") or {}
        axis_rationale = rationale.get(rationale_key, "")

        used_feature_ids.add(fid)
        return {
            "featureId": fid,
            "homeowner": feature["homeowner_name"] or "Anonymous",
            "articleTitle": feature["article_title"] or "",
            "year": year,
            "score": score_value,
            "imageUrl": best_img["public_url"],
            "caption": axis_rationale or feature.get("aesthetic_profile", ""),
            "dossierId": dossier_id,
        }

    return None


def main():
    exemplars = {}

    for display_name, db_col, rationale_key in AXES:
        print(f"\n--- {display_name} ({db_col}) ---")

        # Find score=1 exemplar
        low = find_exemplar(db_col, 1, rationale_key)
        if low:
            print(f"  Score 1: {low['homeowner']} ({low['year']}) — feature {low['featureId']}")
        else:
            print(f"  Score 1: NOT FOUND")

        # Find score=5 exemplar
        high = find_exemplar(db_col, 5, rationale_key)
        if high:
            print(f"  Score 5: {high['homeowner']} ({high['year']}) — feature {high['featureId']}")
        else:
            print(f"  Score 5: NOT FOUND")

        exemplars[rationale_key] = {
            "axis": display_name,
            "low": low,
            "high": high,
        }

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(exemplars, f, indent=2)

    total = sum(
        (1 if e["low"] else 0) + (1 if e["high"] else 0)
        for e in exemplars.values()
    )
    print(f"\n✓ Wrote {total} exemplars to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
