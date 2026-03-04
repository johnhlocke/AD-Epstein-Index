#!/usr/bin/env python3
"""Generate one-sentence radar chart summaries for AD features.

Each feature has 9 aesthetic scores grouped into SPACE / STORY / STAGE.
This script uses Haiku to generate a concise, analytical sentence describing
what the group-level score pattern reveals about the home's character.

The summary complements the existing aesthetic_profile (a broader 2-3 sentence
Opus summary) and appears below the "Radial Graph" header on dossier/report pages.

Usage:
    python3 src/generate_radar_summaries.py --dry-run       # Count + cost estimate
    python3 src/generate_radar_summaries.py                  # Run all (resumes by default)
    python3 src/generate_radar_summaries.py --limit 10       # Test with 10
    python3 src/generate_radar_summaries.py --apply-db       # Push JSONL to Supabase

Cost: ~$1.70 for all ~3,400 features (Haiku, text-only, ~340 tokens per call)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── Configuration ────────────────────────────────────────────

MODEL = "claude-haiku-4-5-20251001"
MAX_RETRIES = 3
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "radar_summaries")

# Haiku pricing (per 1M tokens)
INPUT_COST_PER_M = 1.0
OUTPUT_COST_PER_M = 5.0

# Aesthetic axis groupings
SPACE_AXES = ["score_grandeur", "score_material_warmth", "score_maximalism"]
STORY_AXES = ["score_historicism", "score_provenance", "score_hospitality"]
STAGE_AXES = ["score_formality", "score_curation", "score_theatricality"]
ALL_AXES = SPACE_AXES + STORY_AXES + STAGE_AXES

AXIS_LABELS = {
    "score_grandeur": "Grandeur",
    "score_material_warmth": "Material Warmth",
    "score_maximalism": "Maximalism",
    "score_historicism": "Historicism",
    "score_provenance": "Provenance",
    "score_hospitality": "Hospitality",
    "score_formality": "Formality",
    "score_curation": "Curation",
    "score_theatricality": "Theatricality",
}

SYSTEM_PROMPT = """You are a scoring instrument explaining aesthetic score patterns. Write ONE neutral, analytical sentence explaining why this home scored the way it did across the three groups. Be factual and machine-like — describe the pattern, not the feeling.

Rules:
- Exactly one sentence. No preamble, no quotes, no period-then-more-text.
- Reference group names (Space, Story, Stage) and their averages.
- Name the specific axes that drive divergence (e.g. "driven by high Theatricality and Curation").
- Use comparative language: "dominates", "suppressed", "balanced", "diverges".
- Do NOT describe the home itself — describe the SCORE PATTERN."""


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def get_client():
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


# ── Data Fetching ────────────────────────────────────────────

def fetch_scored_features(sb, limit=None):
    """Fetch features that have all 9 aesthetic scores."""
    select_cols = (
        "id, homeowner_name, aesthetic_profile, radar_summary, "
        + ", ".join(ALL_AXES)
    )

    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        query = (
            sb.table("features")
            .select(select_cols)
            .not_.is_("score_grandeur", "null")
            .order("id")
            .range(offset, offset + page_size - 1)
        )
        page = query.execute()
        if not page.data:
            break
        all_rows.extend(page.data)
        if len(page.data) < page_size:
            break
        offset += page_size

    # Filter to features with all 9 scores present
    complete = []
    for row in all_rows:
        if all(row.get(axis) is not None for axis in ALL_AXES):
            complete.append(row)

    if limit:
        complete = complete[:limit]

    return complete


# ── Resume Logic ─────────────────────────────────────────────

def load_existing_results():
    """Load all existing JSONL files from data/radar_summaries/."""
    results = {}
    if not os.path.exists(OUTPUT_DIR):
        return results
    import glob as globmod
    files = sorted(globmod.glob(os.path.join(OUTPUT_DIR, "radar_*.jsonl")))
    for fpath in files:
        with open(fpath) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                fid = rec.get("feature_id")
                if fid:
                    results[fid] = rec
    return results


# ── Summary Generation ───────────────────────────────────────

def compute_group_avgs(feature):
    """Compute SPACE/STORY/STAGE averages from 9 scores."""
    def avg(axes):
        vals = [feature[a] for a in axes if feature.get(a) is not None]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    return {
        "space": avg(SPACE_AXES),
        "story": avg(STORY_AXES),
        "stage": avg(STAGE_AXES),
    }


def format_user_prompt(feature, avgs):
    """Build the user prompt for a single feature."""
    name = feature.get("homeowner_name") or "Unknown"

    lines = [f"Home: {name}"]
    lines.append("")

    # SPACE group
    lines.append(f"SPACE (avg {avgs['space']}):")
    for axis in SPACE_AXES:
        lines.append(f"  {AXIS_LABELS[axis]}: {feature[axis]}")

    # STORY group
    lines.append(f"STORY (avg {avgs['story']}):")
    for axis in STORY_AXES:
        lines.append(f"  {AXIS_LABELS[axis]}: {feature[axis]}")

    # STAGE group
    lines.append(f"STAGE (avg {avgs['stage']}):")
    for axis in STAGE_AXES:
        lines.append(f"  {AXIS_LABELS[axis]}: {feature[axis]}")

    # Include aesthetic_profile for context
    profile = feature.get("aesthetic_profile")
    if profile:
        # aesthetic_profile is JSONB — might be string or dict
        if isinstance(profile, dict):
            profile = profile.get("summary", str(profile))
        lines.append(f"\nExisting profile (context only): {profile}")

    return "\n".join(lines)


def generate_summary(client, feature):
    """Generate a one-sentence radar summary for a single feature."""
    avgs = compute_group_avgs(feature)
    user_prompt = format_user_prompt(feature, avgs)

    for attempt in range(MAX_RETRIES):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=150,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            summary = response.content[0].text.strip()
            # Clean up any stray quotes
            if summary.startswith('"') and summary.endswith('"'):
                summary = summary[1:-1]

            return {
                "feature_id": feature["id"],
                "homeowner_name": feature.get("homeowner_name"),
                "radar_summary": summary,
                "space_avg": avgs["space"],
                "story_avg": avgs["story"],
                "stage_avg": avgs["stage"],
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
                "cost": (
                    response.usage.input_tokens / 1_000_000 * INPUT_COST_PER_M
                    + response.usage.output_tokens / 1_000_000 * OUTPUT_COST_PER_M
                ),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        except anthropic.RateLimitError:
            wait = 30 * (attempt + 1)
            print(f"    Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        except Exception as e:
            print(f"    API error: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(5)
                continue
            return None

    return None


# ── Apply to Database ────────────────────────────────────────

def apply_to_db(sb):
    """Push JSONL results to Supabase features.radar_summary."""
    results = load_existing_results()
    if not results:
        print("No JSONL results found to apply.")
        return

    print(f"Applying {len(results)} radar summaries to Supabase...")
    applied = 0
    errors = 0

    # Batch upsert in groups of 50
    items = list(results.values())
    for i in range(0, len(items), 50):
        batch = items[i:i + 50]
        for rec in batch:
            try:
                sb.table("features").update(
                    {"radar_summary": rec["radar_summary"]}
                ).eq("id", rec["feature_id"]).execute()
                applied += 1
            except Exception as e:
                print(f"  Error on feature {rec['feature_id']}: {e}")
                errors += 1

        print(f"  {applied}/{len(items)} applied ({errors} errors)")

    print(f"\nDone: {applied} applied, {errors} errors")


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate one-sentence radar chart summaries for AD features"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview count + cost estimate")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit number of features to process")
    parser.add_argument("--apply-db", action="store_true",
                        help="Push JSONL results to Supabase")
    args = parser.parse_args()

    sb = get_supabase()

    # Apply mode — push existing JSONL to DB
    if args.apply_db:
        apply_to_db(sb)
        return

    print("Fetching scored features...")
    features = fetch_scored_features(sb, limit=args.limit)
    print(f"  {len(features)} features with all 9 scores")

    # Resume: skip features already in JSONL
    existing = load_existing_results()
    todo = [f for f in features if f["id"] not in existing]
    print(f"  {len(existing)} already done, {len(todo)} remaining")

    if not todo:
        print("All features already have radar summaries.")
        return

    if args.dry_run:
        # Estimate: ~300 input tokens + ~40 output tokens per call
        est_input = len(todo) * 300
        est_output = len(todo) * 40
        est_cost = (
            est_input / 1_000_000 * INPUT_COST_PER_M
            + est_output / 1_000_000 * OUTPUT_COST_PER_M
        )
        print(f"\n  Features to process: {len(todo)}")
        print(f"  Estimated tokens: ~{est_input:,} in / ~{est_output:,} out")
        print(f"  Estimated cost: ~${est_cost:.2f}")
        print(f"\n  Sample features:")
        for f in todo[:10]:
            avgs = compute_group_avgs(f)
            name = (f.get("homeowner_name") or "Anonymous")[:40]
            print(f"    {name:<40} SPACE={avgs['space']} STORY={avgs['story']} STAGE={avgs['stage']}")
        return

    # Ensure output dir exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Output file
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    outpath = os.path.join(OUTPUT_DIR, f"radar_{ts}.jsonl")
    print(f"  Output: {outpath}")

    client = get_client()

    total_done = 0
    total_errors = 0
    total_input_tokens = 0
    total_output_tokens = 0
    start_time = time.time()

    with open(outpath, "a") as outf:
        for i, feature in enumerate(todo):
            name = (feature.get("homeowner_name") or "Anonymous")[:40]
            avgs = compute_group_avgs(feature)

            result = generate_summary(client, feature)
            if result:
                outf.write(json.dumps(result) + "\n")
                outf.flush()
                total_done += 1
                total_input_tokens += result["input_tokens"]
                total_output_tokens += result["output_tokens"]

                if (i + 1) % 50 == 0 or i == 0:
                    elapsed = time.time() - start_time
                    rate = total_done / elapsed if elapsed > 0 else 0
                    cost = (
                        total_input_tokens / 1_000_000 * INPUT_COST_PER_M
                        + total_output_tokens / 1_000_000 * OUTPUT_COST_PER_M
                    )
                    print(
                        f"  [{total_done}/{len(todo)}] {name:<40} "
                        f"SPACE={avgs['space']} STORY={avgs['story']} STAGE={avgs['stage']} "
                        f"| ${cost:.3f} | {rate:.1f}/s"
                    )
            else:
                total_errors += 1
                print(f"  [{total_done}/{len(todo)}] FAILED: {name}")

    # Final summary
    elapsed = time.time() - start_time
    cost = (
        total_input_tokens / 1_000_000 * INPUT_COST_PER_M
        + total_output_tokens / 1_000_000 * OUTPUT_COST_PER_M
    )
    print(f"\n{'═' * 60}")
    print(f"  COMPLETE: {total_done} summaries, {total_errors} errors")
    print(f"  Tokens: {total_input_tokens:,} in / {total_output_tokens:,} out")
    print(f"  Cost: ${cost:.4f}")
    print(f"  Time: {elapsed:.0f}s ({total_done / elapsed:.1f}/s)")
    print(f"  Output: {outpath}")
    print(f"\n  Run --apply-db to push to Supabase")
    print(f"{'═' * 60}")


if __name__ == "__main__":
    main()
