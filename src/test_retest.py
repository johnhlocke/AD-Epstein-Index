#!/usr/bin/env python3
"""Test-retest reliability study for the v2.3 aesthetic scoring instrument.

Randomly samples 100 scored features and re-scores each one TWICE using
the exact same prompt, model, and images. Saves all three scoring runs
(original + run A + run B) for ICC computation.

Does NOT modify Supabase. All results saved to data/test_retest_results.json.

Usage:
    python3 src/test_retest.py                  # Run full study (100 features, 2 passes)
    python3 src/test_retest.py --limit 5        # Quick test (5 features)
    python3 src/test_retest.py --dry-run        # Preview sample + cost estimate
    python3 src/test_retest.py --resume         # Resume from saved progress

Cost estimate: ~$0.10/feature × 100 features × 2 runs = ~$20
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Reuse scoring infrastructure
from score_features import (
    get_supabase,
    get_images_for_feature,
    score_with_vision,
    parse_scores,
    SCORE_KEY_MAP,
    DEFAULT_MODEL,
    MODEL_PRICING,
)

RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "test_retest_results.json")
SAMPLE_SIZE = 100
RANDOM_SEED = 42  # Reproducible sample


def fetch_scored_features(sb):
    """Fetch all features with complete v2.3 scores + issue data."""
    all_features = []
    offset = 0
    while True:
        batch = sb.table("features").select(
            "id, issue_id, homeowner_name, article_title, page_number, "
            "score_grandeur, score_material_warmth, score_maximalism, "
            "score_historicism, score_provenance, score_hospitality, "
            "score_formality, score_curation, score_theatricality, "
            "aesthetic_profile"
        ).not_.is_("score_grandeur", "null").range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Fetch issue data for source_url + year/month
    issue_ids = list(set(f["issue_id"] for f in all_features))
    issues = {}
    for i in range(0, len(issue_ids), 50):
        batch_ids = issue_ids[i:i+50]
        for iid in batch_ids:
            result = sb.table("issues").select("id, year, month, source_url").eq("id", iid).execute()
            if result.data:
                issues[iid] = result.data[0]

    enriched = []
    for f in all_features:
        iss = issues.get(f["issue_id"])
        if not iss or not iss.get("source_url"):
            continue
        enriched.append({
            "feature_id": f["id"],
            "homeowner_name": f.get("homeowner_name") or "Unknown",
            "article_title": f.get("article_title") or "",
            "page_number": f.get("page_number"),
            "year": iss["year"],
            "month": iss["month"],
            "source_url": iss["source_url"],
            "original_scores": {
                k: f[v] for k, v in SCORE_KEY_MAP.items() if f.get(v) is not None
            },
            "original_aesthetic_profile": f.get("aesthetic_profile"),
        })
    return enriched


def load_progress():
    """Load any existing progress from a previous run."""
    if os.path.exists(RESULTS_PATH):
        with open(RESULTS_PATH) as f:
            return json.load(f)
    return None


def save_results(results):
    """Save results to disk."""
    os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Test-retest reliability study")
    parser.add_argument("--limit", type=int, help="Limit sample size (default: 100)")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--resume", action="store_true", help="Resume from saved progress")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model to use")
    args = parser.parse_args()

    model = args.model
    pricing = MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])
    sample_size = args.limit or SAMPLE_SIZE

    print("=" * 60)
    print("TEST-RETEST RELIABILITY STUDY")
    print(f"Model: {model}")
    print(f"Sample: {sample_size} features × 2 independent scoring runs")
    print(f"Output: {RESULTS_PATH}")
    print("=" * 60)

    sb = get_supabase()

    # Check for resume
    existing = load_progress() if args.resume else None
    if existing and args.resume:
        sample = existing["sample"]
        results = existing["results"]
        completed_a = sum(1 for r in results if r.get("run_a"))
        completed_b = sum(1 for r in results if r.get("run_b"))
        print(f"\nResuming: {completed_a} run_a, {completed_b} run_b completed")
    else:
        # Draw random sample
        print("\nFetching all scored features...")
        all_features = fetch_scored_features(sb)
        print(f"Found {len(all_features)} features with scores + images")

        random.seed(RANDOM_SEED)
        sample = random.sample(all_features, min(sample_size, len(all_features)))
        print(f"Sampled {len(sample)} features (seed={RANDOM_SEED})")

        results = [
            {
                "feature_id": feat["feature_id"],
                "homeowner_name": feat["homeowner_name"],
                "year": feat["year"],
                "month": feat["month"],
                "original": feat["original_scores"],
                "original_aesthetic_profile": feat.get("original_aesthetic_profile"),
                "run_a": None,
                "run_b": None,
            }
            for feat in sample
        ]

    if args.dry_run:
        est_cost = sample_size * 2 * 0.10  # ~$0.10/score with Opus
        print(f"\nDRY RUN: Would score {sample_size} features × 2 runs")
        print(f"Estimated cost: ~${est_cost:.0f}")
        print(f"\nSample features:")
        for feat in sample[:10]:
            print(f"  ID {feat['feature_id']}: {feat['homeowner_name']} (AD {feat['year']}-{feat['month']:02d})")
        return

    total_cost = 0.0
    total_scored = 0
    total_skipped = 0
    total_errors = 0

    # Run A then Run B
    for run_key in ["run_a", "run_b"]:
        run_label = "RUN A" if run_key == "run_a" else "RUN B"
        print(f"\n{'=' * 60}")
        print(f"  {run_label}")
        print(f"{'=' * 60}")

        for i, result in enumerate(results):
            if result.get(run_key):
                continue  # Already done (resume)

            fid = result["feature_id"]
            feat = next((s for s in sample if s["feature_id"] == fid), None)
            if not feat:
                continue

            name = feat["homeowner_name"]
            year = feat["year"]
            month = feat["month"]
            source_url = feat["source_url"]
            title = feat.get("article_title", "")

            print(f"\n[{run_label} {i+1}/{len(results)}] Feature {fid}: {name}")

            # Fetch images (same images each time)
            images, source = get_images_for_feature(
                sb, fid, name, year, month, source_url,
                article_title=title,
                page_number=feat.get("page_number"),
            )

            if not images:
                print("  SKIP: No images")
                total_skipped += 1
                result[run_key] = {"error": "no_images"}
                continue

            print(f"  {len(images)} pages from {source}")

            # Score
            parsed, inp, out, cost = score_with_vision(
                images, name, title, year, month, model
            )
            total_cost += cost

            if not parsed:
                print(f"  ERROR: No parseable response")
                total_errors += 1
                result[run_key] = {"error": "parse_failed"}
                continue

            scores = parse_scores(parsed)
            if len(scores) < 9:
                print(f"  WARNING: Only {len(scores)}/9 scores")
                if len(scores) < 5:
                    total_errors += 1
                    result[run_key] = {"error": "too_few_scores"}
                    continue

            # Store scores (using short key names to match original)
            run_scores = {}
            for json_key, db_col in SCORE_KEY_MAP.items():
                if db_col in scores:
                    run_scores[json_key] = scores[db_col]

            # Capture aesthetic summary
            summary = parsed.get("aesthetic_summary")
            if summary and str(summary).lower() not in ("null", "none", ""):
                run_scores["aesthetic_summary"] = str(summary)

            result[run_key] = run_scores
            total_scored += 1

            # Show comparison
            orig = result["original"]
            diffs = []
            for ax in SCORE_KEY_MAP:
                o = orig.get(ax, "?")
                n = run_scores.get(ax, "?")
                marker = " " if o == n else "*"
                diffs.append(f"{ax[:4]}={o}→{n}{marker}")
            print(f"  {' '.join(diffs)}")
            print(f"  ${cost:.4f}")

            # Rate limit
            time.sleep(0.5)

            # Save checkpoint every 10 features
            if (i + 1) % 10 == 0:
                save_results({
                    "metadata": {
                        "model": model,
                        "sample_size": len(sample),
                        "seed": RANDOM_SEED,
                        "started": existing["metadata"]["started"] if existing else datetime.now(timezone.utc).isoformat(),
                        "last_checkpoint": datetime.now(timezone.utc).isoformat(),
                    },
                    "sample": sample,
                    "results": results,
                })
                print(f"  --- CHECKPOINT: {total_scored} scored, ${total_cost:.2f} ---")

        # Refresh client between runs
        sb = get_supabase()

    # Final save
    save_results({
        "metadata": {
            "model": model,
            "sample_size": len(sample),
            "seed": RANDOM_SEED,
            "started": existing["metadata"]["started"] if existing else datetime.now(timezone.utc).isoformat(),
            "completed": datetime.now(timezone.utc).isoformat(),
            "total_cost": round(total_cost, 2),
            "total_scored": total_scored,
            "total_skipped": total_skipped,
            "total_errors": total_errors,
        },
        "sample": sample,
        "results": results,
    })

    # Summary stats
    print(f"\n{'=' * 60}")
    print(f"COMPLETE")
    print(f"Scored: {total_scored} ({total_skipped} skipped, {total_errors} errors)")
    print(f"Cost: ${total_cost:.2f}")
    print(f"Results: {RESULTS_PATH}")

    # Quick agreement preview
    exact_match = 0
    within_one = 0
    total_comparisons = 0
    for r in results:
        if not r.get("run_a") or not r.get("run_b"):
            continue
        if isinstance(r["run_a"], dict) and "error" in r["run_a"]:
            continue
        if isinstance(r["run_b"], dict) and "error" in r["run_b"]:
            continue
        for ax in SCORE_KEY_MAP:
            o = r["original"].get(ax)
            a = r["run_a"].get(ax)
            b = r["run_b"].get(ax)
            if o is not None and a is not None and b is not None:
                total_comparisons += 1
                if o == a == b:
                    exact_match += 1
                elif max(o, a, b) - min(o, a, b) <= 1:
                    within_one += 1

    if total_comparisons:
        print(f"\nQuick preview ({total_comparisons} axis-comparisons across 3 runs):")
        print(f"  Exact match (all 3 identical): {exact_match}/{total_comparisons} ({exact_match/total_comparisons*100:.1f}%)")
        print(f"  Within ±1 (all 3 within 1 point): {(exact_match+within_one)}/{total_comparisons} ({(exact_match+within_one)/total_comparisons*100:.1f}%)")
    print("=" * 60)


if __name__ == "__main__":
    main()
