#!/usr/bin/env python3
"""Inter-model reliability study for the v2.3 aesthetic scoring instrument.

Scores 100 stratified features with Sonnet AND Haiku using the exact same
prompt, rubric, and images that Opus used. Computes ICC statistics to prove
the rubric drives scoring, not model-specific quirks.

Usage:
    python3 src/intermodel_reliability.py --dry-run     # Preview sample + cost
    python3 src/intermodel_reliability.py                # Full run (~10 min, ~$2.50)
    python3 src/intermodel_reliability.py --analyze      # Compute ICC statistics
    python3 src/intermodel_reliability.py --limit 5      # Test with 5 features

Cost estimates:
    Sonnet: ~$0.02/feature × 100 = ~$2.00
    Haiku:  ~$0.005/feature × 100 = ~$0.50
    Total:  ~$2.50
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

# Reuse scoring functions from score_features.py
from score_features import (
    SCORE_COLUMNS,
    SCORE_KEY_MAP,
    MODEL_PRICING,
    get_images_for_feature,
    build_scoring_prompt,
    score_with_vision,
    parse_scores,
    parse_rationale,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_PATH = os.path.join(DATA_DIR, "intermodel_reliability.json")

MODELS = [
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
]

SAMPLE_SIZE = 100
SEED = 42


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


# ═══════════════════════════════════════════════════════════
# Sample Selection — stratified by decade + STAGE composite
# ═══════════════════════════════════════════════════════════

def select_stratified_sample(sb):
    """Select 100 features stratified by decade and STAGE composite range.

    Images are fetched on the fly from Azure Blob via source_url, so we only
    need features whose issues have AD Archive source_urls.

    Returns list of feature dicts with all needed metadata.
    """
    print("Fetching scored features from AD Archive issues...")

    # Get all issues with AD Archive source URLs (images available via Azure Blob)
    all_issues = []
    offset = 0
    while True:
        batch = sb.table("issues").select(
            "id, year, month, source_url"
        ).not_.is_("source_url", "null").range(offset, offset + 999).execute()
        all_issues.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Filter to issues with AD Archive URLs (Azure Blob images available)
    ad_issues = {
        i["id"]: i for i in all_issues
        if i.get("source_url") and "architecturaldigest.com" in i["source_url"]
    }
    print(f"  {len(ad_issues)} issues with AD Archive source URLs")

    # Get all scored features from those issues
    all_features = []
    offset = 0
    while True:
        batch = sb.table("features").select(
            "id, issue_id, homeowner_name, article_title, page_number, "
            "score_grandeur, score_formality, score_curation, score_theatricality, "
            "composite_stage"
        ).not_.is_("score_grandeur", "null").range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000
    print(f"  {len(all_features)} scored features total")

    # Filter to features in AD Archive issues (images fetchable from Azure Blob)
    features_with_images = [f for f in all_features if f["issue_id"] in ad_issues]
    print(f"  {len(features_with_images)} scored features in AD Archive issues")

    # Enrich with year and source_url from issue data
    enriched = []
    for f in features_with_images:
        iss = ad_issues.get(f["issue_id"])
        if not iss or not iss.get("year"):
            continue
        f["year"] = iss["year"]
        f["month"] = iss.get("month") or 1
        f["source_url"] = iss.get("source_url") or ""
        enriched.append(f)

    print(f"  {len(enriched)} features with year data")

    # Assign decades
    def decade(year):
        if year < 2000:
            return "1988-1999"
        elif year < 2010:
            return "2000-2009"
        elif year < 2020:
            return "2010-2019"
        else:
            return "2020-2025"

    # Bin by decade
    by_decade = {}
    for f in enriched:
        d = decade(f["year"])
        by_decade.setdefault(d, []).append(f)

    print(f"\n  Decade distribution:")
    for d in sorted(by_decade):
        print(f"    {d}: {len(by_decade[d])} features")

    # Stratified sampling: 25 per decade, spread across STAGE composite range
    random.seed(SEED)
    per_decade = SAMPLE_SIZE // len(by_decade)  # 25
    remainder = SAMPLE_SIZE % len(by_decade)

    sample = []
    for i, (dec, feats) in enumerate(sorted(by_decade.items())):
        n = per_decade + (1 if i < remainder else 0)

        # Sort by composite_stage for stratification within decade
        feats_sorted = sorted(feats, key=lambda f: f.get("composite_stage") or 0)

        # Divide into thirds (low/mid/high STAGE) and sample from each
        third = len(feats_sorted) // 3
        low = feats_sorted[:third]
        mid = feats_sorted[third:2*third]
        high = feats_sorted[2*third:]

        per_bin = n // 3
        extra = n % 3

        bins = [low, mid, high]
        for j, b in enumerate(bins):
            count = per_bin + (1 if j < extra else 0)
            if len(b) >= count:
                sample.extend(random.sample(b, count))
            else:
                sample.extend(b)

    print(f"\n  Selected {len(sample)} features for inter-model study")

    # Verify STAGE range coverage
    stages = [f.get("composite_stage") or 0 for f in sample]
    if stages:
        print(f"  STAGE range: {min(stages):.2f} - {max(stages):.2f}")

    return sample


# ═══════════════════════════════════════════════════════════
# Scoring
# ═══════════════════════════════════════════════════════════

def score_feature_with_model(sb, feature, model):
    """Score a single feature with a given model. Returns result dict or None."""
    fid = feature["id"]
    name = feature.get("homeowner_name") or "Unknown"
    title = feature.get("article_title") or ""
    year = feature["year"]
    month = feature["month"]
    source_url = feature.get("source_url") or ""

    # Get images
    images, source = get_images_for_feature(
        sb, fid, name, year, month, source_url,
        article_title=title,
        page_number=feature.get("page_number"),
    )

    if not images:
        return None

    # Score with vision
    parsed, inp, out, cost = score_with_vision(images, name, title, year, month, model)

    if not parsed:
        return None

    # Parse scores
    scores = parse_scores(parsed)
    if len(scores) < 5:
        return None

    # Parse rationale
    rationale = parse_rationale(parsed)

    # Extract aesthetic summary
    summary = parsed.get("aesthetic_summary")
    if summary and str(summary).lower() in ("null", "none", ""):
        summary = None

    return {
        "feature_id": fid,
        "model": model,
        "scores": scores,
        "aesthetic_summary": summary,
        "scoring_rationale": rationale,
        "input_tokens": inp,
        "output_tokens": out,
        "cost_usd": cost,
    }


def write_to_supabase(sb, result):
    """Write a scoring result to the intermodel_scores table."""
    row = {
        "feature_id": result["feature_id"],
        "model": result["model"],
        "aesthetic_summary": result.get("aesthetic_summary"),
        "scoring_rationale": result.get("scoring_rationale"),
        "input_tokens": result["input_tokens"],
        "output_tokens": result["output_tokens"],
        "cost_usd": float(result["cost_usd"]),
        "scored_at": datetime.now(timezone.utc).isoformat(),
    }

    # Add score columns
    for db_col in SCORE_COLUMNS:
        row[db_col] = result["scores"].get(db_col)

    try:
        sb.table("intermodel_scores").upsert(
            row, on_conflict="feature_id,model"
        ).execute()
        return True
    except Exception as e:
        print(f"    DB write error: {e}")
        return False


def check_existing(sb, model):
    """Check which features already have scores for a given model."""
    result = sb.table("intermodel_scores").select("feature_id").eq("model", model).execute()
    return {r["feature_id"] for r in result.data}


# ═══════════════════════════════════════════════════════════
# ICC Analysis
# ═══════════════════════════════════════════════════════════

def compute_icc(ratings_matrix):
    """Compute ICC(2,1) — two-way random, single measures, absolute agreement.

    ratings_matrix: numpy array of shape (n_subjects, n_raters)
    Returns ICC value.
    """
    import numpy as np

    n, k = ratings_matrix.shape
    if n < 2 or k < 2:
        return float("nan")

    # Mean of each subject (row mean)
    row_means = ratings_matrix.mean(axis=1)
    # Mean of each rater (column mean)
    col_means = ratings_matrix.mean(axis=0)
    # Grand mean
    grand_mean = ratings_matrix.mean()

    # Sum of squares
    SS_rows = k * np.sum((row_means - grand_mean) ** 2)
    SS_cols = n * np.sum((col_means - grand_mean) ** 2)
    SS_total = np.sum((ratings_matrix - grand_mean) ** 2)
    SS_error = SS_total - SS_rows - SS_cols

    # Mean squares
    MS_rows = SS_rows / (n - 1) if n > 1 else 0
    MS_cols = SS_cols / (k - 1) if k > 1 else 0
    MS_error = SS_error / ((n - 1) * (k - 1)) if (n - 1) * (k - 1) > 0 else 0

    # ICC(2,1) — two-way random, single measures, absolute agreement
    numerator = MS_rows - MS_error
    denominator = MS_rows + (k - 1) * MS_error + (k / n) * (MS_cols - MS_error)

    if denominator == 0:
        return float("nan")

    return numerator / denominator


def run_analysis(sb):
    """Compute ICC statistics from scored data."""
    import numpy as np

    print("=" * 60)
    print("INTER-MODEL RELIABILITY — ICC ANALYSIS")
    print("=" * 60)

    # Load Opus scores from features table
    print("\nLoading Opus scores from features table...")
    intermodel = sb.table("intermodel_scores").select("*").execute()
    if not intermodel.data:
        print("ERROR: No intermodel scores found. Run scoring first.")
        return None

    # Group intermodel scores by feature_id
    by_feature = {}
    for row in intermodel.data:
        fid = row["feature_id"]
        by_feature.setdefault(fid, {})[row["model"]] = row

    feature_ids = list(by_feature.keys())
    print(f"  {len(feature_ids)} features with intermodel scores")

    # Check which models we have
    models_found = set()
    for fid_data in by_feature.values():
        models_found.update(fid_data.keys())
    print(f"  Models: {', '.join(sorted(models_found))}")

    # Load Opus scores for these features
    opus_scores = {}
    for fid in feature_ids:
        result = sb.table("features").select(
            "id, " + ", ".join(SCORE_COLUMNS)
        ).eq("id", fid).execute()
        if result.data:
            opus_scores[fid] = result.data[0]

    print(f"  {len(opus_scores)} Opus scores loaded")

    # Find features with all three models
    complete = []
    for fid in feature_ids:
        if fid in opus_scores and all(m in by_feature.get(fid, {}) for m in MODELS):
            complete.append(fid)

    print(f"  {len(complete)} features have all three models scored")
    if len(complete) < 10:
        print("WARNING: Too few complete features for reliable ICC")

    # Build score matrices for each axis
    axes = list(SCORE_KEY_MAP.values())  # DB column names
    axis_names = list(SCORE_KEY_MAP.keys())  # Human-readable names

    model_labels = ["opus", "sonnet", "haiku"]
    model_ids = ["opus", MODELS[0], MODELS[1]]

    analysis = {
        "n_features": len(complete),
        "models": ["claude-opus-4-6"] + MODELS,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }

    # Per-pair ICC
    pairs = [
        ("opus", "sonnet", "claude-opus-4-6", MODELS[0]),
        ("opus", "haiku", "claude-opus-4-6", MODELS[1]),
        ("sonnet", "haiku", MODELS[0], MODELS[1]),
    ]

    for pair_label_a, pair_label_b, model_a, model_b in pairs:
        pair_key = f"icc_{pair_label_a}_{pair_label_b}"
        per_axis = {}
        all_diffs = []
        exact_matches = 0
        within_1_matches = 0
        total_comparisons = 0

        for axis_name, db_col in zip(axis_names, axes):
            scores_a = []
            scores_b = []
            axis_exact = 0
            axis_within_1 = 0
            axis_diffs = []

            for fid in complete:
                # Get score from model A
                if model_a == "claude-opus-4-6":
                    sa = opus_scores[fid].get(db_col)
                else:
                    sa = by_feature[fid].get(model_a, {}).get(db_col)

                # Get score from model B
                if model_b == "claude-opus-4-6":
                    s_b = opus_scores[fid].get(db_col)
                else:
                    s_b = by_feature[fid].get(model_b, {}).get(db_col)

                if sa is not None and s_b is not None:
                    scores_a.append(sa)
                    scores_b.append(s_b)
                    diff = abs(sa - s_b)
                    axis_diffs.append(diff)
                    all_diffs.append(diff)
                    if diff == 0:
                        axis_exact += 1
                        exact_matches += 1
                    if diff <= 1:
                        axis_within_1 += 1
                        within_1_matches += 1
                    total_comparisons += 1

            # Compute ICC for this axis
            if len(scores_a) >= 2:
                matrix = np.array([scores_a, scores_b]).T  # (n, 2)
                icc_val = compute_icc(matrix)
            else:
                icc_val = float("nan")

            n_axis = len(scores_a)
            per_axis[axis_name] = {
                "icc": round(icc_val, 3) if not np.isnan(icc_val) else None,
                "exact_pct": round(axis_exact / n_axis * 100, 1) if n_axis else 0,
                "within_1_pct": round(axis_within_1 / n_axis * 100, 1) if n_axis else 0,
                "mean_abs_diff": round(np.mean(axis_diffs), 3) if axis_diffs else 0,
                "n": n_axis,
            }

        # Overall ICC across all axes combined
        all_a = []
        all_b = []
        for axis_name, db_col in zip(axis_names, axes):
            for fid in complete:
                if model_a == "claude-opus-4-6":
                    sa = opus_scores[fid].get(db_col)
                else:
                    sa = by_feature[fid].get(model_a, {}).get(db_col)
                if model_b == "claude-opus-4-6":
                    s_b = opus_scores[fid].get(db_col)
                else:
                    s_b = by_feature[fid].get(model_b, {}).get(db_col)
                if sa is not None and s_b is not None:
                    all_a.append(sa)
                    all_b.append(s_b)

        if len(all_a) >= 2:
            overall_matrix = np.array([all_a, all_b]).T
            overall_icc = compute_icc(overall_matrix)
        else:
            overall_icc = float("nan")

        analysis[pair_key] = {
            "overall_icc": round(overall_icc, 3) if not np.isnan(overall_icc) else None,
            "per_axis": per_axis,
            "exact_agreement_pct": round(exact_matches / total_comparisons * 100, 1) if total_comparisons else 0,
            "within_1_agreement_pct": round(within_1_matches / total_comparisons * 100, 1) if total_comparisons else 0,
            "mean_abs_diff": round(np.mean(all_diffs), 3) if all_diffs else 0,
            "n_comparisons": total_comparisons,
        }

        print(f"\n  {pair_label_a.upper()} vs {pair_label_b.upper()}:")
        print(f"    Overall ICC: {analysis[pair_key]['overall_icc']}")
        print(f"    Exact agreement: {analysis[pair_key]['exact_agreement_pct']}%")
        print(f"    Within ±1: {analysis[pair_key]['within_1_agreement_pct']}%")
        print(f"    Mean abs diff: {analysis[pair_key]['mean_abs_diff']}")

        # Per-axis breakdown
        for axis_name in axis_names:
            a = per_axis[axis_name]
            print(f"      {axis_name:20s} ICC={a['icc']}  exact={a['exact_pct']}%  ±1={a['within_1_pct']}%  MAD={a['mean_abs_diff']}")

    # Three-way ICC (all 3 models)
    print(f"\n  THREE-WAY ICC (all 3 models):")
    three_way_per_axis = {}
    for axis_name, db_col in zip(axis_names, axes):
        scores_opus = []
        scores_sonnet = []
        scores_haiku = []

        for fid in complete:
            so = opus_scores[fid].get(db_col)
            ss = by_feature[fid].get(MODELS[0], {}).get(db_col)
            sh = by_feature[fid].get(MODELS[1], {}).get(db_col)
            if so is not None and ss is not None and sh is not None:
                scores_opus.append(so)
                scores_sonnet.append(ss)
                scores_haiku.append(sh)

        if len(scores_opus) >= 2:
            matrix = np.array([scores_opus, scores_sonnet, scores_haiku]).T  # (n, 3)
            icc_val = compute_icc(matrix)
        else:
            icc_val = float("nan")

        three_way_per_axis[axis_name] = round(icc_val, 3) if not np.isnan(icc_val) else None
        print(f"    {axis_name:20s} ICC={three_way_per_axis[axis_name]}")

    analysis["three_way_icc"] = three_way_per_axis

    # Collect example aesthetic summaries (3 features, 3 models each)
    examples = []
    for fid in complete[:3]:
        feat = opus_scores[fid]
        name_result = sb.table("features").select("homeowner_name, article_title").eq("id", fid).execute()
        meta = name_result.data[0] if name_result.data else {}

        example = {
            "feature_id": fid,
            "homeowner": meta.get("homeowner_name", "Unknown"),
            "article_title": meta.get("article_title", ""),
            "summaries": {
                "opus": feat.get("aesthetic_profile") if hasattr(feat, "get") else None,
            },
        }

        # Get Opus aesthetic_profile from features table
        profile_result = sb.table("features").select("aesthetic_profile").eq("id", fid).execute()
        if profile_result.data:
            ap = profile_result.data[0].get("aesthetic_profile")
            if isinstance(ap, str):
                example["summaries"]["opus"] = ap
            elif isinstance(ap, dict):
                example["summaries"]["opus"] = json.dumps(ap)

        for model in MODELS:
            model_data = by_feature[fid].get(model, {})
            label = "sonnet" if "sonnet" in model else "haiku"
            example["summaries"][label] = model_data.get("aesthetic_summary")

        examples.append(example)

    analysis["example_summaries"] = examples

    return analysis


# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Inter-model reliability study")
    parser.add_argument("--dry-run", action="store_true", help="Preview sample + cost estimate")
    parser.add_argument("--limit", type=int, help="Limit number of features to score")
    parser.add_argument("--analyze", action="store_true", help="Compute ICC statistics from scored data")
    parser.add_argument("--model", help="Score with only one model (for testing)")
    args = parser.parse_args()

    sb = get_supabase()

    if args.analyze:
        analysis = run_analysis(sb)
        if analysis:
            # Load existing data and append analysis
            existing = {}
            if os.path.exists(OUTPUT_PATH):
                with open(OUTPUT_PATH) as f:
                    existing = json.load(f)

            existing["analysis"] = analysis

            os.makedirs(DATA_DIR, exist_ok=True)
            with open(OUTPUT_PATH, "w") as f:
                json.dump(existing, f, indent=2, default=str)

            print(f"\nAnalysis saved to {OUTPUT_PATH}")
        return

    # Sample selection
    sample = select_stratified_sample(sb)

    if args.limit:
        sample = sample[:args.limit]
        print(f"Limited to {len(sample)} features")

    models = [args.model] if args.model else MODELS

    # Dry run: estimate cost
    if args.dry_run:
        print(f"\n{'='*60}")
        print(f"DRY RUN — {len(sample)} features × {len(models)} models")
        print(f"{'='*60}")

        total_cost = 0
        for model in models:
            pricing = MODEL_PRICING.get(model, MODEL_PRICING["claude-sonnet-4-5-20250929"])
            # Estimate: ~6 images avg × 550 tokens/img + 2500 prompt + 900 output
            est_in = 6 * 550 + 2500
            est_out = 900
            per_feat = (est_in / 1_000_000) * pricing["input"] + (est_out / 1_000_000) * pricing["output"]
            model_cost = per_feat * len(sample)
            total_cost += model_cost
            print(f"\n  {model}:")
            print(f"    ${pricing['input']}/{pricing['output']} per M tokens")
            print(f"    ~${per_feat:.4f}/feature × {len(sample)} = ~${model_cost:.2f}")

        print(f"\n  TOTAL ESTIMATED COST: ~${total_cost:.2f}")

        # Show sample details
        print(f"\n  Sample features ({len(sample)}):")
        for i, f in enumerate(sample[:10]):
            stage = f.get("composite_stage") or 0
            print(f"    {i+1:3d}. Feature {f['id']:5d} | {f.get('homeowner_name','?'):30s} | {f['year']} | STAGE={stage:.2f}")
        if len(sample) > 10:
            print(f"    ... and {len(sample) - 10} more")

        return

    # Full scoring run
    print(f"\n{'='*60}")
    print(f"INTER-MODEL RELIABILITY STUDY")
    print(f"{len(sample)} features × {len(models)} models")
    print(f"{'='*60}")

    # Load existing results for resume support
    all_results = {}
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH) as f:
            all_results = json.load(f)

    if "scores" not in all_results:
        all_results["scores"] = {}
    if "meta" not in all_results:
        all_results["meta"] = {
            "sample_size": len(sample),
            "seed": SEED,
            "feature_ids": [f["id"] for f in sample],
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

    for model in models:
        pricing = MODEL_PRICING.get(model, MODEL_PRICING["claude-sonnet-4-5-20250929"])
        model_label = "sonnet" if "sonnet" in model else "haiku"

        print(f"\n{'─'*60}")
        print(f"MODEL: {model} (${pricing['input']}/{pricing['output']} per M tokens)")
        print(f"{'─'*60}")

        # Check what's already scored
        existing = check_existing(sb, model)
        print(f"  Already scored: {len(existing)} features")

        total_cost = 0.0
        scored = 0
        skipped = 0
        errors = 0

        for i, feat in enumerate(sample):
            fid = feat["id"]
            name = feat.get("homeowner_name") or "Unknown"

            if fid in existing:
                skipped += 1
                continue

            print(f"\n  [{i+1}/{len(sample)}] Feature {fid}: {name} ({feat['year']})")

            result = score_feature_with_model(sb, feat, model)

            if not result:
                print("    SKIP: No images or parse error")
                errors += 1
                continue

            # Write to Supabase
            if write_to_supabase(sb, result):
                scored += 1
                total_cost += result["cost_usd"]

                score_str = " ".join(
                    f"{k.replace('score_','')}={v}"
                    for k, v in sorted(result["scores"].items())
                )
                print(f"    SCORES: {score_str}")
                print(f"    ${result['cost_usd']:.4f} ({result['input_tokens']} in / {result['output_tokens']} out)")

                if result.get("aesthetic_summary"):
                    s = result["aesthetic_summary"]
                    print(f"    SUMMARY: {s[:80]}..." if len(s) > 80 else f"    SUMMARY: {s}")

                # Save to local JSON
                fid_key = str(fid)
                if fid_key not in all_results["scores"]:
                    all_results["scores"][fid_key] = {}
                all_results["scores"][fid_key][model_label] = {
                    "scores": {k.replace("score_", ""): v for k, v in result["scores"].items()},
                    "aesthetic_summary": result.get("aesthetic_summary"),
                    "cost_usd": result["cost_usd"],
                    "input_tokens": result["input_tokens"],
                    "output_tokens": result["output_tokens"],
                }
            else:
                errors += 1

            # Rate limit
            time.sleep(1.0)

            # Save checkpoint every 25 features
            if (scored + skipped) % 25 == 0 and scored > 0:
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(OUTPUT_PATH, "w") as f:
                    json.dump(all_results, f, indent=2, default=str)
                print(f"\n    --- CHECKPOINT: {scored} scored, ${total_cost:.2f} ---\n")

        print(f"\n  {model_label.upper()} DONE: {scored} scored, {skipped} skipped, {errors} errors, ${total_cost:.2f}")

    # Save final results
    all_results["meta"]["completed_at"] = datetime.now(timezone.utc).isoformat()
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(all_results, f, indent=2, default=str)

    print(f"\nResults saved to {OUTPUT_PATH}")
    print(f"Run --analyze to compute ICC statistics")


if __name__ == "__main__":
    main()
