#!/usr/bin/env python3
"""Backfill missing Gemini research passes from JSONL files.

Scans all data/wealth_research/researched_*.jsonl files, finds names
where research_1/2/3 (Gemini) are ERROR or missing, and re-runs
Gemini search grounding for each.

Results are written to a new JSONL file. Use --reclassify to also
re-run Opus classification with the updated research.

Usage:
    python3 src/retry_gemini_passes.py --dry-run         # Preview gaps
    python3 src/retry_gemini_passes.py                    # Backfill 1 Gemini pass
    python3 src/retry_gemini_passes.py --limit 10         # Test with 10
    python3 src/retry_gemini_passes.py --reclassify       # Also re-classify with Opus
    python3 src/retry_gemini_passes.py --apply-db         # Push to Supabase
"""

import argparse
import glob as globmod
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.dirname(__file__))
from research_classify import (
    SEARCH_GROUNDING_PROMPT,
    SEARCH_MODEL,
    GEMINI_TIMEOUT,
    SEARCH_PRICING,
    _extract_response_text,
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wealth_research")
INTER_NAME_DELAY = 3  # seconds between names
MAX_RETRIES = 4  # retries on 429/503


def get_gemini():
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


# ── JSONL Loading ────────────────────────────────────────────

def load_all_results():
    """Load all JSONL files, latest record per name wins."""
    results = {}
    files = sorted(globmod.glob(os.path.join(OUTPUT_DIR, "researched_*.jsonl")))
    for fpath in files:
        with open(fpath) as f:
            for line in f:
                if not line.strip():
                    continue
                rec = json.loads(line)
                name = rec.get("name", "").strip()
                if name:
                    results[name] = rec
    return results


def has_gemini_pass(rec):
    """Check if a record has at least 1 successful Gemini pass."""
    for key in ["research_1", "research_2", "research_3"]:
        val = rec.get(key, "")
        if val and len(val) > 50 and "ERROR" not in val:
            return True
    return False


def find_missing_gemini(results):
    """Return list of (name, record) missing all Gemini passes."""
    missing = []
    for name, rec in results.items():
        if not has_gemini_pass(rec):
            missing.append((name, rec))
    return missing


# ── Gemini Call ──────────────────────────────────────────────

def run_gemini_call(gemini_client, name, rec):
    """Run a single Gemini search grounding call with retry + backoff."""
    prompt = SEARCH_GROUNDING_PROMPT.format(
        name=name,
        year=rec.get("year", "Unknown"),
        category=rec.get("category", "Unknown"),
        location=rec.get("location", "Unknown"),
    )

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = gemini_client.models.generate_content(
                model=SEARCH_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    temperature=0.1,
                ),
            )
            text = _extract_response_text(response)
            if not text:
                if attempt < MAX_RETRIES:
                    time.sleep(2)
                    continue
                return None, 0, 0, "Empty response"

            usage = response.usage_metadata
            inp = usage.prompt_token_count if usage else 0
            out = usage.candidates_token_count if usage else 0
            return text, inp, out, None

        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
            is_unavailable = "503" in err_str or "UNAVAILABLE" in err_str
            if (is_rate_limit or is_unavailable) and attempt < MAX_RETRIES:
                wait = (2 ** attempt) * 5 + random.uniform(0, 3)
                time.sleep(wait)
                continue
            return None, 0, 0, err_str[:200]

    return None, 0, 0, "Max retries exceeded"


# ── Apply to DB ──────────────────────────────────────────────

def apply_to_db():
    """Push backfilled results to Supabase wealth_profiles."""
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # Load backfill JSONL files
    files = sorted(globmod.glob(os.path.join(OUTPUT_DIR, "gemini_backfill_*.jsonl")))
    if not files:
        print("No gemini_backfill_*.jsonl files found.")
        return

    records = []
    for fpath in files:
        with open(fpath) as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))

    print(f"Applying {len(records)} backfilled records to Supabase...")
    applied = 0
    errors = 0

    for rec in records:
        name = rec.get("name")
        update = {}
        if rec.get("classification"):
            update["classification"] = rec["classification"]
        if rec.get("forbes_score") is not None:
            update["forbes_score"] = rec["forbes_score"]
        if rec.get("wealth_source"):
            update["wealth_source"] = rec["wealth_source"]
        if rec.get("background"):
            update["background"] = rec["background"]
        if rec.get("trajectory"):
            update["trajectory"] = rec["trajectory"]
        if rec.get("rationale"):
            update["rationale"] = rec["rationale"]
        if rec.get("education"):
            update["education"] = rec["education"]
        if rec.get("museum_boards"):
            update["museum_boards"] = rec["museum_boards"]
        if rec.get("elite_boards"):
            update["elite_boards"] = rec["elite_boards"]
        if rec.get("generational_wealth"):
            update["generational_wealth"] = rec["generational_wealth"]
        if rec.get("cultural_capital_notes"):
            update["cultural_capital_notes"] = rec["cultural_capital_notes"]
        if rec.get("social_capital_notes"):
            update["social_capital_notes"] = rec["social_capital_notes"]

        if not update:
            continue

        try:
            sb.table("wealth_profiles").update(update).eq(
                "homeowner_name", name
            ).execute()
            applied += 1
        except Exception as e:
            print(f"  Error on {name}: {e}")
            errors += 1

        if applied % 50 == 0:
            print(f"  {applied}/{len(records)} applied")

    print(f"\nDone: {applied} applied, {errors} errors")


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Backfill missing Gemini research passes"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview names needing Gemini backfill")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit names to process")
    parser.add_argument("--reclassify", action="store_true",
                        help="Re-run Opus classification after Gemini backfill")
    parser.add_argument("--apply-db", action="store_true",
                        help="Push backfill results to Supabase")
    args = parser.parse_args()

    if args.apply_db:
        apply_to_db()
        return

    print(f"Loading JSONL from {OUTPUT_DIR}...")
    all_results = load_all_results()
    print(f"  {len(all_results)} unique names loaded")

    missing = find_missing_gemini(all_results)
    print(f"  {len(missing)} names missing Gemini passes")

    if args.limit:
        missing = missing[:args.limit]

    if not missing:
        print("All names have at least 1 Gemini pass!")
        return

    if args.dry_run:
        # Estimate cost: ~300 input + ~800 output tokens per call
        est_input = len(missing) * 300
        est_output = len(missing) * 800
        est_cost = (
            est_input / 1_000_000 * SEARCH_PRICING["input"]
            + est_output / 1_000_000 * SEARCH_PRICING["output"]
        )
        print(f"\n  Names to backfill: {len(missing)}")
        print(f"  Model: {SEARCH_MODEL}")
        print(f"  Estimated Gemini cost: ~${est_cost:.2f}")
        if args.reclassify:
            opus_cost = len(missing) * 0.09
            print(f"  Estimated Opus reclassify cost: ~${opus_cost:.2f}")
        print(f"  Estimated time: ~{len(missing) * (INTER_NAME_DELAY + 30) / 3600:.1f} hours")
        print(f"\n  Sample names:")
        for name, rec in missing[:15]:
            pplx = "yes" if rec.get("research_4", "") and len(rec.get("research_4", "")) > 50 and "ERROR" not in rec.get("research_4", "") else "no"
            cls = rec.get("classification", "?")
            print(f"    {name:<45s} pplx={pplx}  cls={cls}")
        if len(missing) > 15:
            print(f"    ... and {len(missing) - 15} more")
        return

    # Set up Opus client if reclassifying
    opus_client = None
    if args.reclassify:
        import anthropic
        from research_classify import classify_person, _merge_research_texts
        opus_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    gemini = get_gemini()

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    outpath = os.path.join(OUTPUT_DIR, f"gemini_backfill_{ts}.jsonl")
    print(f"  Output: {outpath}")
    print(f"  Model: {SEARCH_MODEL}")
    print(f"  Reclassify: {'yes' if args.reclassify else 'no'}")

    total_done = 0
    total_errors = 0
    total_input_tokens = 0
    total_output_tokens = 0
    start_time = time.time()

    with open(outpath, "w") as outf:
        for i, (name, rec) in enumerate(missing, 1):
            if i > 1:
                time.sleep(INTER_NAME_DELAY)

            print(f"  [{i:>4d}/{len(missing)}] {name:<45s}", end="", flush=True)

            text, inp, out, error = run_gemini_call(gemini, name, rec)

            if text:
                total_input_tokens += inp
                total_output_tokens += out

                # Merge Gemini result into first empty research slot
                updated = dict(rec)
                if not updated.get("research_1") or "ERROR" in updated.get("research_1", ""):
                    updated["research_1"] = text
                elif not updated.get("research_2") or "ERROR" in updated.get("research_2", ""):
                    updated["research_2"] = text
                elif not updated.get("research_3") or "ERROR" in updated.get("research_3", ""):
                    updated["research_3"] = text

                updated["gemini_backfill_model"] = SEARCH_MODEL
                updated["gemini_backfill_at"] = datetime.now(timezone.utc).isoformat()
                updated["gemini_input_tokens"] = (rec.get("gemini_input_tokens") or 0) + inp
                updated["gemini_output_tokens"] = (rec.get("gemini_output_tokens") or 0) + out

                # Optionally reclassify with Opus
                if args.reclassify and opus_client:
                    # Build research list for merge
                    research_results = []
                    for key in ["research_1", "research_2", "research_3"]:
                        val = updated.get(key, "")
                        if val and len(val) > 50 and "ERROR" not in val:
                            research_results.append({
                                "research": val, "grounded": True, "source": "gemini"
                            })
                    r4 = updated.get("research_4", "")
                    if r4 and len(r4) > 50 and "ERROR" not in r4:
                        research_results.append({
                            "research": r4, "grounded": True, "source": "perplexity"
                        })

                    if research_results:
                        merged = _merge_research_texts(research_results)
                        person = {
                            "name": name,
                            "year": rec.get("year", "Unknown"),
                            "category": rec.get("category", "Unknown"),
                            "location": rec.get("location", "Unknown"),
                        }
                        classification = classify_person(opus_client, person, merged)
                        updated.update(classification)
                        updated["opus_input_tokens"] = (rec.get("opus_input_tokens") or 0) + classification.get("opus_input_tokens", 0)
                        updated["opus_output_tokens"] = (rec.get("opus_output_tokens") or 0) + classification.get("opus_output_tokens", 0)
                        cls = classification.get("classification", "?")
                        score = classification.get("forbes_score", "?")
                        print(f" → {cls:<12s} Forbes {score}/10", end="")

                total_done += 1
                print(f" OK ({len(text):,} chars)")
            else:
                total_errors += 1
                print(f" FAIL: {error}")
                # Still write the record so we track the attempt
                updated = dict(rec)
                if not updated.get("research_1") or "ERROR" in updated.get("research_1", ""):
                    updated["research_1"] = f"ERROR: {error}"

            outf.write(json.dumps(updated) + "\n")
            outf.flush()

            if i % 50 == 0:
                elapsed = time.time() - start_time
                cost = (
                    total_input_tokens / 1_000_000 * SEARCH_PRICING["input"]
                    + total_output_tokens / 1_000_000 * SEARCH_PRICING["output"]
                )
                rate = total_done / elapsed if elapsed > 0 else 0
                print(f"    --- {total_done}/{len(missing)} done, "
                      f"{total_errors} errors, ${cost:.2f}, {rate:.2f}/s ---")

    elapsed = time.time() - start_time
    cost = (
        total_input_tokens / 1_000_000 * SEARCH_PRICING["input"]
        + total_output_tokens / 1_000_000 * SEARCH_PRICING["output"]
    )
    print(f"\n{'═' * 60}")
    print(f"  COMPLETE: {total_done} backfilled, {total_errors} errors")
    print(f"  Gemini tokens: {total_input_tokens:,} in / {total_output_tokens:,} out")
    print(f"  Gemini cost: ${cost:.2f}")
    print(f"  Time: {elapsed:.0f}s ({elapsed / 60:.1f} min)")
    print(f"  Output: {outpath}")
    print(f"{'═' * 60}")


if __name__ == "__main__":
    main()
