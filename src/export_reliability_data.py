#!/usr/bin/env python3
"""
Export enriched reliability data for the /reliability appendix page.

Reads test_retest_results.json, queries Supabase for feature images and article
titles, generates per-feature insight text, and outputs web/src/app/reliability/data.json.
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
RESULTS_PATH = ROOT / "data" / "test_retest_results.json"
OUTPUT_PATH = ROOT / "web" / "src" / "app" / "reliability" / "data.json"

AXES = [
    "grandeur",
    "material_warmth",
    "maximalism",
    "historicism",
    "provenance",
    "hospitality",
    "formality",
    "curation",
    "theatricality",
]
AXIS_LABELS = [
    "Grandeur",
    "Material Warmth",
    "Maximalism",
    "Historicism",
    "Provenance",
    "Hospitality",
    "Formality",
    "Curation",
    "Theatricality",
]
AXIS_GROUPS = [
    "SPACE", "SPACE", "SPACE",
    "STORY", "STORY", "STORY",
    "STAGE", "STAGE", "STAGE",
]
GROUP_NAMES = {"SPACE": "Space", "STORY": "Story", "STAGE": "Stage"}


def load_results():
    with open(RESULTS_PATH) as f:
        return json.load(f)


def query_images(sb, feature_ids: list[int]) -> dict[int, list[dict]]:
    """Fetch all images for the given feature IDs, grouped by feature."""
    images_by_feature: dict[int, list[dict]] = defaultdict(list)

    # Supabase .in_() can handle 100 IDs fine
    resp = (
        sb.from_("feature_images")
        .select("feature_id, page_number, public_url")
        .in_("feature_id", feature_ids)
        .order("feature_id")
        .order("page_number")
        .execute()
    )

    for row in resp.data:
        images_by_feature[row["feature_id"]].append(
            {"page": row["page_number"], "url": row["public_url"]}
        )

    return images_by_feature


def query_article_titles(sb, feature_ids: list[int]) -> dict[int, str]:
    """Fetch article_title for the given feature IDs."""
    resp = (
        sb.from_("features")
        .select("id, article_title")
        .in_("id", feature_ids)
        .execute()
    )
    return {row["id"]: row["article_title"] for row in resp.data if row.get("article_title")}


def generate_insight(result: dict, orig_scores: list[int], run_a_scores: list[int], run_b_scores: list[int]) -> str:
    """Generate a pattern-based insight string for a feature."""
    exact = sum(1 for o, a, b in zip(orig_scores, run_a_scores, run_b_scores) if o == a == b)

    # Find disagreeing axes with details
    disagree_axes = []
    for i, (o, a, b) in enumerate(zip(orig_scores, run_a_scores, run_b_scores)):
        if not (o == a == b):
            # Determine pattern
            scores = [o, a, b]
            spread = max(scores) - min(scores)
            two_agree = (a == b and a != o) or (o == a and o != b) or (o == b and o != a)
            disagree_axes.append({
                "axis": AXIS_LABELS[i],
                "group": AXIS_GROUPS[i],
                "orig": o, "a": a, "b": b,
                "spread": spread,
                "two_agree": two_agree,
            })

    # Group-level disagreement
    group_disagree = defaultdict(list)
    for d in disagree_axes:
        group_disagree[d["group"]].append(d["axis"])

    # Extract short phrases from summaries for contrast
    orig_summary = result.get("original_aesthetic_profile", "") or ""
    run_a_summary = result.get("run_a", {}).get("aesthetic_summary", "") or ""
    run_b_summary = result.get("run_b", {}).get("aesthetic_summary", "") or ""

    # Build insight
    parts = []

    if exact == 9:
        parts.append("Perfect convergence across all nine axes.")
        # Find the most interesting aspect from summaries
        if orig_summary and run_a_summary:
            parts.append(
                "Three independent readings arrive at identical scores despite different prose — "
                "the visual evidence leaves no room for interpretive drift."
            )
    elif exact >= 8:
        ax = disagree_axes[0]
        if ax["two_agree"]:
            if ax["a"] == ax["b"]:
                parts.append(
                    f"Near-perfect agreement with a single split on {ax['axis']} "
                    f"({ax['orig']}→{ax['a']}). Two retests converge on the revised score, "
                    f"suggesting the original may have been the outlier."
                )
            else:
                parts.append(
                    f"Only {ax['axis']} breaks consensus — the original ({ax['orig']}) holds "
                    f"while retests split ({ax['a']}/{ax['b']}), a classic boundary case."
                )
        else:
            parts.append(
                f"One axis of disagreement: {ax['axis']} drifts across a {ax['spread']}-point "
                f"range ({ax['orig']}/{ax['a']}/{ax['b']}). The other eight are locked."
            )
    elif exact >= 7:
        axis_names = [d["axis"] for d in disagree_axes]
        groups_hit = set(d["group"] for d in disagree_axes)
        if len(groups_hit) == 1:
            g = list(groups_hit)[0]
            parts.append(
                f"Disagreement clusters entirely within {GROUP_NAMES[g]} "
                f"({', '.join(axis_names)}), while the other groups hold firm."
            )
        else:
            parts.append(
                f"Splits on {' and '.join(axis_names)} — "
                f"spanning {'/'.join(GROUP_NAMES[g] for g in sorted(groups_hit))} groups."
            )

        # Check for directional drift
        upward = [d for d in disagree_axes if d["a"] > d["orig"] or d["b"] > d["orig"]]
        if len(upward) == len(disagree_axes) and upward:
            parts.append("Both retests push scores upward, hinting the original was conservative.")
        downward = [d for d in disagree_axes if d["a"] < d["orig"] or d["b"] < d["orig"]]
        if len(downward) == len(disagree_axes) and downward:
            parts.append("Retests trend downward — initial impression may have been generous.")

    elif exact >= 5:
        axis_names = [d["axis"] for d in disagree_axes]
        groups_hit = set(d["group"] for d in disagree_axes)

        # Check for wide spreads
        wide = [d for d in disagree_axes if d["spread"] >= 2]
        if wide:
            wide_names = [f"{d['axis']} ({d['orig']}/{d['a']}/{d['b']})" for d in wide]
            parts.append(
                f"Significant disagreement on {', '.join(wide_names)} — "
                f"a {max(d['spread'] for d in wide)}-point spread reveals genuine ambiguity."
            )
        else:
            parts.append(
                f"Disagreement across {len(disagree_axes)} axes "
                f"({', '.join(axis_names)}), all within ±1 point."
            )

        if len(groups_hit) >= 2:
            parts.append(
                f"The uncertainty spans {'/'.join(GROUP_NAMES[g] for g in sorted(groups_hit))} — "
                f"this home resists easy categorization."
            )
    else:
        # ≤4/9 — real outlier
        axis_names = [d["axis"] for d in disagree_axes]
        wide = [d for d in disagree_axes if d["spread"] >= 2]
        parts.append(
            f"Only {exact}/9 axes agree — a genuine outlier. "
            f"Disagreement on {', '.join(axis_names[:4])}{'...' if len(axis_names) > 4 else ''}."
        )
        if wide:
            parts.append(
                f"Wide spreads on {', '.join(d['axis'] for d in wide)} "
                f"suggest the images genuinely support multiple readings."
            )

    return " ".join(parts)


def build_feature(result: dict, images: list[dict], article_title: str | None) -> dict:
    """Build a single feature entry for data.json."""
    orig = [result["original"][a] for a in AXES]
    run_a = [result["run_a"][a] for a in AXES] if result.get("run_a") else None
    run_b = [result["run_b"][a] for a in AXES] if result.get("run_b") else None

    exact = 0
    if run_a and run_b:
        exact = sum(1 for o, a, b in zip(orig, run_a, run_b) if o == a == b)
    elif run_a:
        exact = sum(1 for o, a in zip(orig, run_a) if o == a)
    elif run_b:
        exact = sum(1 for o, b in zip(orig, run_b) if o == b)

    orig_summary = result.get("original_aesthetic_profile", "")
    run_a_summary = result.get("run_a", {}).get("aesthetic_summary", "")
    run_b_summary = result.get("run_b", {}).get("aesthetic_summary", "")

    insight = generate_insight(result, orig, run_a or orig, run_b or orig)

    name = result.get("homeowner_name") or "Unknown"

    return {
        "id": result["feature_id"],
        "name": name,
        "year": result.get("year"),
        "month": result.get("month"),
        "title": article_title,
        "orig": orig,
        "origSummary": orig_summary,
        "runA": run_a,
        "runASummary": run_a_summary,
        "runB": run_b,
        "runBSummary": run_b_summary,
        "exact": exact,
        "images": images,
        "insight": insight,
    }


def main():
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    print("Loading test_retest_results.json...")
    data = load_results()
    results = data["results"]
    feature_ids = [r["feature_id"] for r in results]
    print(f"  {len(results)} features")

    print("Querying feature images...")
    images_map = query_images(sb, feature_ids)
    total_imgs = sum(len(v) for v in images_map.values())
    print(f"  {total_imgs} images across {len(images_map)} features")

    print("Querying article titles...")
    titles_map = query_article_titles(sb, feature_ids)
    print(f"  {len(titles_map)} titles found")

    print("Building enriched features...")
    features = []
    for result in results:
        fid = result["feature_id"]
        feature = build_feature(
            result,
            images=images_map.get(fid, []),
            article_title=titles_map.get(fid),
        )
        features.append(feature)

    # Sort by exact matches (fewest first, then by ID)
    features.sort(key=lambda f: (f["exact"], f["id"]))

    output = {
        "axes": AXIS_LABELS,
        "n": len(features),
        "features": features,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Summary stats
    perfect = sum(1 for f in features if f["exact"] == 9)
    near = sum(1 for f in features if f["exact"] >= 7)
    with_images = sum(1 for f in features if f["images"])
    with_insight = sum(1 for f in features if f["insight"])

    print(f"\nOutput: {OUTPUT_PATH}")
    print(f"  {len(features)} features")
    print(f"  {perfect} perfect (9/9)")
    print(f"  {near} near-perfect (≥7/9)")
    print(f"  {with_images} with images")
    print(f"  {with_insight} with insights")
    print("Done.")


if __name__ == "__main__":
    main()
