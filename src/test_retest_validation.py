#!/usr/bin/env python3
"""Test-retest validation for the v2.2 aesthetic scoring instrument.

Selects 100 features stratified by decade (25 per decade), re-scores them
with the identical Opus Vision v2.2 prompt, and computes reliability metrics.

Usage:
    python3 src/test_retest_validation.py --dry-run     # Preview sample + cost
    python3 src/test_retest_validation.py               # Run full validation
    python3 src/test_retest_validation.py --limit 10    # Quick test

Output: data/validation_retest.json with per-feature score comparisons.
"""

import argparse
import json
import os
import random
import time

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Import scoring functions from score_features.py
from score_features import (
    get_supabase,
    get_images_for_feature,
    score_with_vision,
    parse_scores,
    parse_rationale,
    SCORE_KEY_MAP,
    SCORE_COLUMNS,
    DEFAULT_MODEL,
    MODEL_PRICING,
)

DECADES = [
    ("1988-1997", 1988, 1997),
    ("1998-2007", 1998, 2007),
    ("2008-2017", 2008, 2017),
    ("2018-2025", 2018, 2025),
]
SAMPLE_PER_DECADE = 25
SEED = 42  # Reproducible sampling


def fetch_scored_features_by_decade(sb):
    """Fetch all scored features grouped by decade."""
    decade_pools = {label: [] for label, _, _ in DECADES}

    all_feats = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, issue_id, page_number, "
            "score_grandeur, score_material_warmth, score_maximalism, "
            "score_historicism, score_provenance, score_hospitality, "
            "score_formality, score_curation, score_theatricality"
        ).not_.is_("score_grandeur", "null").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Get issue years
    issue_ids = list(set(f["issue_id"] for f in all_feats))
    issues = {}
    for i in range(0, len(issue_ids), 50):
        chunk = issue_ids[i:i+50]
        for iid in chunk:
            result = sb.from_("issues").select("id, year, month, source_url").eq("id", iid).execute()
            if result.data:
                issues[iid] = result.data[0]

    # Bin by decade
    for f in all_feats:
        iss = issues.get(f["issue_id"])
        if not iss:
            continue
        year = iss["year"]
        f["_year"] = year
        f["_month"] = iss.get("month") or 1
        f["_source_url"] = iss.get("source_url")

        for label, start, end in DECADES:
            if start <= year <= end:
                decade_pools[label].append(f)
                break

    return decade_pools


def select_stratified_sample(decade_pools, per_decade=SAMPLE_PER_DECADE, seed=SEED):
    """Select stratified random sample, per_decade features from each decade."""
    rng = random.Random(seed)
    sample = []
    for label, start, end in DECADES:
        pool = decade_pools[label]
        n = min(per_decade, len(pool))
        selected = rng.sample(pool, n)
        sample.extend(selected)
        print(f"  {label}: {n} sampled from {len(pool)} available")
    return sample


def main():
    parser = argparse.ArgumentParser(description="Test-retest validation for aesthetic scoring")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, help="Limit total features to process")
    parser.add_argument("--run", type=int, default=2, help="Run number (2=first retest, 3=second retest, etc.)")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args()

    model = args.model
    pricing = MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])

    print("=" * 60)
    print("TEST-RETEST VALIDATION — v2.2 Aesthetic Scoring")
    print(f"Model: {model} (${pricing['input']}/{pricing['output']} per M tokens)")
    print(f"Sample: {SAMPLE_PER_DECADE} per decade × {len(DECADES)} decades = {SAMPLE_PER_DECADE * len(DECADES)} features")
    print("=" * 60)

    sb = get_supabase()

    print("\nFetching scored features by decade...")
    decade_pools = fetch_scored_features_by_decade(sb)

    print("\nSelecting stratified sample...")
    sample = select_stratified_sample(decade_pools)

    if args.limit:
        sample = sample[:args.limit]
        print(f"Limited to {len(sample)} features")

    if args.dry_run:
        est_cost = len(sample) * 0.15  # ~$0.15 per Opus Vision call
        print(f"\nSample size: {len(sample)}")
        print(f"Estimated cost: ${est_cost:.2f}")
        print(f"\nSample features:")
        for f in sample[:10]:
            orig_scores = [f.get(c) for c in SCORE_COLUMNS]
            print(f"  #{f['id']} {f.get('homeowner_name', '?')} ({f['_year']}) scores: {orig_scores}")
        return

    # Re-score each feature
    results = []
    total_cost = 0.0
    total_in = 0
    total_out = 0
    scored = 0
    errors = 0

    for i, feat in enumerate(sample):
        fid = feat["id"]
        name = feat.get("homeowner_name") or "Unknown"
        title = feat.get("article_title") or ""
        year = feat["_year"]
        month = feat["_month"]
        source_url = feat["_source_url"]

        print(f"\n[{i+1}/{len(sample)}] Feature {fid}: {name} ({year})")

        # Get original scores
        original = {}
        for json_key, db_col in SCORE_KEY_MAP.items():
            original[json_key] = feat.get(db_col)

        # Get images
        images, source = get_images_for_feature(
            sb, fid, name, year, month, source_url,
            article_title=title,
            page_number=feat.get("page_number"),
        )

        if not images:
            print("  SKIP: No images")
            errors += 1
            continue

        print(f"  {len(images)} pages from {source}")

        # Re-score
        parsed, inp, out, cost = score_with_vision(images, name, title, year, month, model)
        total_in += inp
        total_out += out
        total_cost += cost

        if not parsed:
            print("  ERROR: No parseable response")
            errors += 1
            continue

        retest = {}
        for json_key in SCORE_KEY_MAP:
            val = parsed.get(json_key)
            if val is not None:
                try:
                    retest[json_key] = max(1, min(5, int(val)))
                except (ValueError, TypeError):
                    pass

        if len(retest) < 9:
            print(f"  WARNING: Only {len(retest)}/9 retest scores")
            if len(retest) < 5:
                errors += 1
                continue

        # Compute differences
        diffs = {}
        for key in SCORE_KEY_MAP:
            if key in original and original[key] is not None and key in retest:
                diffs[key] = retest[key] - original[key]

        # Get retest rationale
        retest_rationale = parse_rationale(parsed)

        result = {
            "feature_id": fid,
            "homeowner_name": name,
            "year": year,
            "decade": None,
            "original": original,
            "retest": retest,
            "diffs": diffs,
            "retest_rationale": retest_rationale,
            "cost": cost,
        }

        for label, start, end in DECADES:
            if start <= year <= end:
                result["decade"] = label
                break

        results.append(result)
        scored += 1

        # Print comparison
        diff_str = " ".join(f"{k}:{diffs.get(k, '?'):+d}" if isinstance(diffs.get(k), int) else f"{k}:?" for k in SCORE_KEY_MAP)
        print(f"  DIFFS: {diff_str}")
        print(f"  COST: ${cost:.4f}")

        # Rate limit
        time.sleep(0.5)

    # ═══ Compute reliability metrics ═══
    print(f"\n{'=' * 60}")
    print(f"RESULTS: {scored} scored, {errors} errors")
    print(f"COST: ${total_cost:.2f} ({total_in:,} in / {total_out:,} out)")

    if results:
        print(f"\n{'=' * 60}")
        print("PER-AXIS RELIABILITY")
        print(f"{'Axis':<20} {'MAD':>5} {'% Exact':>8} {'% ±1':>7} {'Mean Δ':>7} {'N':>4}")
        print("-" * 55)

        axis_stats = {}
        for key in SCORE_KEY_MAP:
            diffs_list = [r["diffs"][key] for r in results if key in r["diffs"]]
            if not diffs_list:
                continue

            n = len(diffs_list)
            mad = sum(abs(d) for d in diffs_list) / n
            exact = sum(1 for d in diffs_list if d == 0) / n * 100
            within1 = sum(1 for d in diffs_list if abs(d) <= 1) / n * 100
            mean_diff = sum(diffs_list) / n

            axis_stats[key] = {
                "n": n,
                "mad": round(mad, 3),
                "exact_match_pct": round(exact, 1),
                "within_1_pct": round(within1, 1),
                "mean_diff": round(mean_diff, 3),
                "diffs": diffs_list,
            }

            print(f"  {key:<18} {mad:>5.2f} {exact:>7.1f}% {within1:>6.1f}% {mean_diff:>+6.2f} {n:>4}")

        # Overall
        all_diffs = []
        for r in results:
            all_diffs.extend(r["diffs"].values())

        if all_diffs:
            overall_mad = sum(abs(d) for d in all_diffs) / len(all_diffs)
            overall_exact = sum(1 for d in all_diffs if d == 0) / len(all_diffs) * 100
            overall_within1 = sum(1 for d in all_diffs if abs(d) <= 1) / len(all_diffs) * 100
            print("-" * 55)
            print(f"  {'OVERALL':<18} {overall_mad:>5.2f} {overall_exact:>7.1f}% {overall_within1:>6.1f}%")

        # Features with large swings (>1 on any axis)
        big_swings = [r for r in results if any(abs(d) > 1 for d in r["diffs"].values())]
        if big_swings:
            print(f"\nFEATURES WITH LARGE SWINGS (|diff| > 1):")
            for r in big_swings:
                big = {k: v for k, v in r["diffs"].items() if abs(v) > 1}
                print(f"  #{r['feature_id']} {r['homeowner_name']} ({r['year']}): {big}")

        # Save full results
        output = {
            "metadata": {
                "model": model,
                "sample_size": len(results),
                "per_decade": SAMPLE_PER_DECADE,
                "seed": SEED,
                "total_cost": round(total_cost, 2),
                "scored": scored,
                "errors": errors,
            },
            "axis_stats": axis_stats,
            "overall": {
                "mad": round(overall_mad, 3) if all_diffs else None,
                "exact_match_pct": round(overall_exact, 1) if all_diffs else None,
                "within_1_pct": round(overall_within1, 1) if all_diffs else None,
            },
            "features": results,
        }

        suffix = f"_run{args.run}" if args.run != 2 else ""
        results_path = os.path.join(os.path.dirname(__file__), "..", "data", f"validation_retest{suffix}.json")
        os.makedirs(os.path.dirname(results_path), exist_ok=True)
        with open(results_path, "w") as fp:
            json.dump(output, fp, indent=2)
        print(f"\nFull results saved to {results_path}")


if __name__ == "__main__":
    main()
