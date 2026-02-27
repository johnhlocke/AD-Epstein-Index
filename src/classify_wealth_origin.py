#!/usr/bin/env python3
"""Classify confirmed Epstein-connected homeowners by wealth origin.

Uses Claude Opus to determine whether each confirmed homeowner's wealth
is self-made, inherited (old money/patrician), married-into, or unknown.
Also classifies a random baseline sample for comparison.

This supports the hypothesis that Epstein's network over-indexes on
newly wealthy / socially aspirational people whose homes need to
*perform* status, vs. old-money patricians who can afford quiet.

Usage:
    python3 src/classify_wealth_origin.py                # Classify all confirmed
    python3 src/classify_wealth_origin.py --baseline 200 # Also classify 200 baseline
    python3 src/classify_wealth_origin.py --dry-run      # Preview names only
    python3 src/classify_wealth_origin.py --limit 10     # First 10 only
    python3 src/classify_wealth_origin.py --report       # Print results summary

Cost estimate (Opus): ~$0.02-0.04 per name, ~$8-15 for 400 names.
"""

import argparse
import json
import os
import random
import sys
import time
from collections import Counter
from datetime import datetime, timezone

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MODEL = "claude-opus-4-6"
MODEL_PRICING = {"input": 15.0, "output": 75.0}  # per 1M tokens

# Output file for results (also stored in Supabase)
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wealth_origin")

CLASSIFICATION_PROMPT = """You are classifying the wealth origin of a person who was featured as a homeowner in Architectural Digest magazine. This person has been confirmed as having a documented connection to Jeffrey Epstein's social network (appearing in DOJ records, flight logs, black book, etc.).

Based on your knowledge of this person, classify their wealth origin into ONE of these categories:

1. **SELF_MADE** — Built their own fortune through business, entertainment, finance, tech, fashion, media, etc. First-generation wealth. Examples: hedge fund founders, tech entrepreneurs, entertainment moguls, fashion empire builders, real estate developers who started from scratch.

2. **OLD_MONEY** — Inherited wealth from established family. Multi-generational fortune. Patrician family name. Examples: Rockefellers, Vanderbilts, European aristocracy, old banking families, families with generational trusts and estates.

3. **MARRIED_INTO** — Primary route to wealth/status was through marriage to a wealthy spouse. May have had their own career but the AD-featured home reflects the spouse's wealth.

4. **MIXED** — Combination that doesn't fit neatly. Example: came from a wealthy family AND built their own empire, or married wealthy AND had significant independent success.

5. **UNKNOWN** — You don't have enough information to classify this person confidently.

Important guidelines:
- Base this on publicly available biographical information
- "Self-made" includes people who came from comfortable backgrounds but built fortunes far exceeding their family's (e.g., someone from an upper-middle-class family who became a billionaire)
- "Old money" requires GENERATIONAL wealth — the fortune predates them by at least one generation
- Consider the PRIMARY source of the wealth that funded the AD-featured home
- Be honest when you're uncertain — use UNKNOWN rather than guessing
- Provide a brief rationale (1-2 sentences) explaining your classification

Person to classify:
Name: {name}
Category in AD: {category}
Location: {location}
Year featured: {year}
Designer: {designer}

Respond in this exact JSON format:
{{
  "classification": "SELF_MADE" | "OLD_MONEY" | "MARRIED_INTO" | "MIXED" | "UNKNOWN",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "rationale": "Brief explanation",
  "wealth_source": "Brief description of primary wealth source (e.g., 'Hedge fund founder', 'Vanderbilt heir', 'Married to real estate developer')",
  "notable_facts": "Any relevant context about their social positioning"
}}"""

BASELINE_PROMPT = """You are classifying the wealth origin of a person who was featured as a homeowner in Architectural Digest magazine. This person is NOT known to be connected to Jeffrey Epstein — they are part of the general AD homeowner population.

Based on your knowledge of this person, classify their wealth origin into ONE of these categories:

1. **SELF_MADE** — Built their own fortune through business, entertainment, finance, tech, fashion, media, etc. First-generation wealth.

2. **OLD_MONEY** — Inherited wealth from established family. Multi-generational fortune. Patrician family name.

3. **MARRIED_INTO** — Primary route to wealth/status was through marriage to a wealthy spouse.

4. **MIXED** — Combination that doesn't fit neatly.

5. **UNKNOWN** — You don't have enough information to classify this person confidently.

Important guidelines:
- Base this on publicly available biographical information
- Be honest when you're uncertain — use UNKNOWN rather than guessing
- Provide a brief rationale (1-2 sentences)

Person to classify:
Name: {name}
Category in AD: {category}
Location: {location}
Year featured: {year}
Designer: {designer}

Respond in this exact JSON format:
{{
  "classification": "SELF_MADE" | "OLD_MONEY" | "MARRIED_INTO" | "MIXED" | "UNKNOWN",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "rationale": "Brief explanation",
  "wealth_source": "Brief description of primary wealth source",
  "notable_facts": "Any relevant context"
}}"""


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def fetch_confirmed_homeowners(sb, limit=None):
    """Fetch all confirmed Epstein-connected homeowners with feature context."""
    # Get confirmed dossiers
    query = sb.table("dossiers").select(
        "id, feature_id, subject_name, connection_strength"
    ).eq("editor_verdict", "CONFIRMED")

    all_dossiers = []
    offset = 0
    while True:
        batch = query.range(offset, offset + 999).execute()
        all_dossiers.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Deduplicate by subject_name (some people have multiple features)
    seen_names = set()
    unique_dossiers = []
    for d in all_dossiers:
        name = (d.get("subject_name") or "").strip().lower()
        if name and name not in seen_names:
            seen_names.add(name)
            unique_dossiers.append(d)

    # Fetch feature context for each
    results = []
    for d in unique_dossiers:
        feat = sb.table("features").select(
            "id, homeowner_name, subject_category, location_city, "
            "location_state, location_country, designer_name, issue_id"
        ).eq("id", d["feature_id"]).execute()

        if not feat.data:
            continue

        f = feat.data[0]

        # Get issue year
        issue = sb.table("issues").select("year").eq("id", f["issue_id"]).execute()
        year = issue.data[0]["year"] if issue.data else None

        location_parts = [f.get("location_city"), f.get("location_state"), f.get("location_country")]
        location = ", ".join(p for p in location_parts if p) or "Unknown"

        results.append({
            "dossier_id": d["id"],
            "feature_id": d["feature_id"],
            "name": d.get("subject_name") or f.get("homeowner_name") or "Unknown",
            "category": f.get("subject_category") or "Unknown",
            "location": location,
            "year": year,
            "designer": f.get("designer_name") or "Unknown",
            "connection_strength": d.get("connection_strength"),
            "group": "epstein",
        })

    if limit:
        results = results[:limit]

    return results


def fetch_baseline_homeowners(sb, count=200, exclude_names=None):
    """Fetch a random sample of non-Epstein AD homeowners for comparison."""
    exclude_names = exclude_names or set()

    # Get features that do NOT have a confirmed dossier
    # First get all confirmed feature IDs
    confirmed = sb.table("dossiers").select("feature_id").eq(
        "editor_verdict", "CONFIRMED"
    ).execute()
    confirmed_ids = set(d["feature_id"] for d in confirmed.data)

    # Fetch named features
    all_features = []
    offset = 0
    while True:
        batch = sb.table("features").select(
            "id, homeowner_name, subject_category, location_city, "
            "location_state, location_country, designer_name, issue_id"
        ).not_.is_("homeowner_name", "null").range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Filter out confirmed and anonymous
    baseline_pool = []
    seen_names = set()
    for f in all_features:
        if f["id"] in confirmed_ids:
            continue
        name = (f.get("homeowner_name") or "").strip()
        name_lower = name.lower()
        if not name or name_lower in ("anonymous", "unknown", ""):
            continue
        if name_lower in exclude_names or name_lower in seen_names:
            continue
        seen_names.add(name_lower)
        baseline_pool.append(f)

    # Random sample
    random.seed(42)  # Reproducible
    sample = random.sample(baseline_pool, min(count, len(baseline_pool)))

    # Enrich with issue year
    results = []
    issue_cache = {}
    for f in sample:
        iid = f["issue_id"]
        if iid not in issue_cache:
            issue = sb.table("issues").select("year").eq("id", iid).execute()
            issue_cache[iid] = issue.data[0]["year"] if issue.data else None

        location_parts = [f.get("location_city"), f.get("location_state"), f.get("location_country")]
        location = ", ".join(p for p in location_parts if p) or "Unknown"

        results.append({
            "feature_id": f["id"],
            "name": f.get("homeowner_name") or "Unknown",
            "category": f.get("subject_category") or "Unknown",
            "location": location,
            "year": issue_cache[iid],
            "designer": f.get("designer_name") or "Unknown",
            "group": "baseline",
        })

    return results


def classify_person(client, person, is_baseline=False):
    """Call Opus to classify a single person's wealth origin."""
    prompt_template = BASELINE_PROMPT if is_baseline else CLASSIFICATION_PROMPT
    prompt = prompt_template.format(
        name=person["name"],
        category=person.get("category", "Unknown"),
        location=person.get("location", "Unknown"),
        year=person.get("year", "Unknown"),
        designer=person.get("designer", "Unknown"),
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )

    # Parse JSON from response
    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        import re
        match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            result = {
                "classification": "UNKNOWN",
                "confidence": "LOW",
                "rationale": f"Failed to parse response: {text[:200]}",
                "wealth_source": "",
                "notable_facts": "",
            }

    # Track cost
    usage = response.usage
    cost = (usage.input_tokens * MODEL_PRICING["input"] / 1_000_000 +
            usage.output_tokens * MODEL_PRICING["output"] / 1_000_000)

    return {
        **person,
        **result,
        "cost": cost,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
    }


def print_report(results):
    """Print a summary comparison of Epstein vs baseline wealth origins."""
    epstein = [r for r in results if r.get("group") == "epstein"]
    baseline = [r for r in results if r.get("group") == "baseline"]

    def summarize(group, label):
        total = len(group)
        if total == 0:
            print(f"\n  {label}: No data")
            return

        counts = Counter(r.get("classification", "UNKNOWN") for r in group)
        confident = [r for r in group if r.get("confidence") in ("HIGH", "MEDIUM")]
        confident_counts = Counter(r.get("classification", "UNKNOWN") for r in confident)

        print(f"\n  {label} (n={total}):")
        print(f"  {'─' * 50}")

        categories = ["SELF_MADE", "OLD_MONEY", "MARRIED_INTO", "MIXED", "UNKNOWN"]
        for cat in categories:
            n = counts.get(cat, 0)
            pct = (n / total) * 100 if total > 0 else 0
            bar = "█" * int(pct / 2)
            print(f"    {cat:<15} {n:>3}  ({pct:5.1f}%)  {bar}")

        print(f"\n    High/Medium confidence only (n={len(confident)}):")
        for cat in categories:
            if cat == "UNKNOWN":
                continue
            n = confident_counts.get(cat, 0)
            pct = (n / len(confident)) * 100 if confident else 0
            bar = "█" * int(pct / 2)
            print(f"    {cat:<15} {n:>3}  ({pct:5.1f}%)  {bar}")

    print("\n" + "=" * 60)
    print("  WEALTH ORIGIN CLASSIFICATION — SUMMARY")
    print("=" * 60)

    summarize(epstein, "EPSTEIN ORBIT")
    summarize(baseline, "AD BASELINE")

    # Chi-square-style comparison
    if epstein and baseline:
        print(f"\n  {'─' * 50}")
        print("  COMPARISON (High/Med confidence, excl. UNKNOWN):")
        print(f"  {'─' * 50}")

        ep_conf = [r for r in epstein if r.get("confidence") in ("HIGH", "MEDIUM") and r.get("classification") != "UNKNOWN"]
        bl_conf = [r for r in baseline if r.get("confidence") in ("HIGH", "MEDIUM") and r.get("classification") != "UNKNOWN"]

        if ep_conf and bl_conf:
            for cat in ["SELF_MADE", "OLD_MONEY", "MARRIED_INTO", "MIXED"]:
                ep_n = sum(1 for r in ep_conf if r.get("classification") == cat)
                bl_n = sum(1 for r in bl_conf if r.get("classification") == cat)
                ep_pct = (ep_n / len(ep_conf)) * 100
                bl_pct = (bl_n / len(bl_conf)) * 100
                diff = ep_pct - bl_pct
                arrow = "▲" if diff > 0 else "▼" if diff < 0 else "="
                print(f"    {cat:<15}  Epstein: {ep_pct:5.1f}%  Baseline: {bl_pct:5.1f}%  {arrow} {abs(diff):+.1f}pp")

    # Total cost
    total_cost = sum(r.get("cost", 0) for r in results)
    total_input = sum(r.get("input_tokens", 0) for r in results)
    total_output = sum(r.get("output_tokens", 0) for r in results)
    print(f"\n  Cost: ${total_cost:.2f} ({total_input:,} in / {total_output:,} out tokens)")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Classify wealth origin of AD homeowners")
    parser.add_argument("--baseline", type=int, default=0,
                        help="Number of baseline (non-Epstein) homeowners to classify (default: 0)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit number of confirmed homeowners to classify")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview names without calling API")
    parser.add_argument("--report", action="store_true",
                        help="Print report from existing results file")
    parser.add_argument("--topup-baseline", type=int, default=0,
                        help="Classify more baseline names to reach N non-UNKNOWN total (e.g. --topup-baseline 200)")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(OUTPUT_DIR, f"classification_{timestamp}.jsonl")

    sb = get_supabase()

    # Report mode: just print from latest results file
    if args.report:
        import glob
        files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "classification_*.jsonl")))
        if not files:
            print("No results files found.")
            return
        latest = files[-1]
        print(f"Reading: {latest}")
        results = []
        with open(latest) as f:
            for line in f:
                results.append(json.loads(line))
        print_report(results)
        return

    # Top-up mode: classify more baseline names to reach target non-UNKNOWN count
    if args.topup_baseline > 0:
        import glob as globmod
        target = args.topup_baseline

        # Load existing results
        files = sorted(globmod.glob(os.path.join(OUTPUT_DIR, "classification_*.jsonl")))
        if not files:
            print("No existing results to top up from.")
            return
        latest = files[-1]
        print(f"Loading existing results from: {latest}")

        existing = []
        with open(latest) as f:
            for line in f:
                existing.append(json.loads(line))

        # Count current non-UNKNOWN baseline
        existing_baseline = [r for r in existing if r.get("group") == "baseline"]
        non_unknown = [r for r in existing_baseline if r.get("classification") != "UNKNOWN"]
        already_classified_names = set(r["name"].strip().lower() for r in existing_baseline)

        print(f"  Existing baseline: {len(existing_baseline)} total, {len(non_unknown)} non-UNKNOWN")
        needed = target - len(non_unknown)
        if needed <= 0:
            print(f"  Already have {len(non_unknown)} non-UNKNOWN baseline (target: {target}). Nothing to do.")
            return

        # Fetch more baseline names (oversample to account for UNKNOWN rate)
        oversample = int(needed * 1.6)  # ~40% buffer for UNKNOWNs
        print(f"  Need {needed} more non-UNKNOWN. Sampling ~{oversample} new names...")

        # Get confirmed names to exclude
        confirmed = fetch_confirmed_homeowners(sb)
        exclude = set(p["name"].strip().lower() for p in confirmed) | already_classified_names

        # Fetch larger pool with different seed
        all_features = []
        offset = 0
        while True:
            batch = sb.table("features").select(
                "id, homeowner_name, subject_category, location_city, "
                "location_state, location_country, designer_name, issue_id"
            ).not_.is_("homeowner_name", "null").range(offset, offset + 999).execute()
            all_features.extend(batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000

        confirmed_ids = set(d["feature_id"] for d in confirmed)
        pool = []
        seen = set()
        for f in all_features:
            if f["id"] in confirmed_ids:
                continue
            name = (f.get("homeowner_name") or "").strip()
            name_lower = name.lower()
            if not name or name_lower in ("anonymous", "unknown", ""):
                continue
            if name_lower in exclude or name_lower in seen:
                continue
            seen.add(name_lower)
            pool.append(f)

        random.seed(99)  # Different seed from original run
        random.shuffle(pool)
        candidates = pool[:oversample]

        # Enrich with issue year
        issue_cache = {}
        new_people = []
        for f in candidates:
            iid = f["issue_id"]
            if iid not in issue_cache:
                issue = sb.table("issues").select("year").eq("id", iid).execute()
                issue_cache[iid] = issue.data[0]["year"] if issue.data else None
            location_parts = [f.get("location_city"), f.get("location_state"), f.get("location_country")]
            location = ", ".join(p for p in location_parts if p) or "Unknown"
            new_people.append({
                "feature_id": f["id"],
                "name": f.get("homeowner_name") or "Unknown",
                "category": f.get("subject_category") or "Unknown",
                "location": location,
                "year": issue_cache[iid],
                "designer": f.get("designer_name") or "Unknown",
                "group": "baseline",
            })

        if args.dry_run:
            print(f"\n  DRY RUN — would classify {len(new_people)} new baseline names")
            for p in new_people[:20]:
                print(f"    {p['name']:<35} {p.get('category', '?'):<12}")
            if len(new_people) > 20:
                print(f"    ... and {len(new_people) - 20} more")
            return

        # Classify until we hit target
        client = anthropic.Anthropic()
        new_results = []
        new_non_unknown = 0
        total_cost = 0.0

        print(f"\nClassifying up to {len(new_people)} new baseline names (stopping at {needed} non-UNKNOWN)...\n")

        with open(output_file, "w") as out:
            # Write all existing results first
            for r in existing:
                out.write(json.dumps(r, default=str) + "\n")

            for i, person in enumerate(new_people, 1):
                print(f"  [{i}/{len(new_people)}] [BASELINE] {person['name']:<35}", end="", flush=True)
                try:
                    result = classify_person(client, person, is_baseline=True)
                    new_results.append(result)
                    total_cost += result.get("cost", 0)
                    cls = result.get("classification", "?")
                    conf = result.get("confidence", "?")
                    print(f"  → {cls:<15} ({conf})")
                    out.write(json.dumps(result, default=str) + "\n")
                    out.flush()

                    if cls != "UNKNOWN":
                        new_non_unknown += 1
                        if new_non_unknown >= needed:
                            print(f"\n  Reached target! {new_non_unknown} new non-UNKNOWN classified.")
                            break

                    time.sleep(0.5)
                except Exception as e:
                    print(f"  ERROR: {e}")
                    error_result = {**person, "classification": "ERROR", "confidence": "LOW", "rationale": str(e), "cost": 0}
                    new_results.append(error_result)
                    out.write(json.dumps(error_result, default=str) + "\n")
                    out.flush()
                    time.sleep(2)

        print(f"\n  Added {len(new_results)} new ({new_non_unknown} non-UNKNOWN)")
        print(f"  Cost: ${total_cost:.2f}")
        print(f"  Results: {output_file}")

        # Print updated report
        all_results = existing + new_results
        print_report(all_results)
        return

    # Fetch confirmed homeowners
    print("Fetching confirmed Epstein-connected homeowners...")
    confirmed = fetch_confirmed_homeowners(sb, limit=args.limit)
    print(f"  Found {len(confirmed)} unique confirmed homeowners")

    # Fetch baseline if requested
    baseline = []
    if args.baseline > 0:
        exclude = set(p["name"].strip().lower() for p in confirmed)
        print(f"Fetching {args.baseline} random baseline homeowners...")
        baseline = fetch_baseline_homeowners(sb, count=args.baseline, exclude_names=exclude)
        print(f"  Found {len(baseline)} baseline homeowners")

    all_people = confirmed + baseline

    if args.dry_run:
        print(f"\n{'─' * 60}")
        print(f"DRY RUN — would classify {len(all_people)} people")
        print(f"  Confirmed: {len(confirmed)}")
        print(f"  Baseline:  {len(baseline)}")
        print(f"  Est. cost: ${len(all_people) * 0.03:.2f}")
        print(f"{'─' * 60}")
        for p in confirmed[:20]:
            print(f"  [EPSTEIN]  {p['name']:<35} {p.get('category', '?'):<12} {p.get('location', '?')}")
        if len(confirmed) > 20:
            print(f"  ... and {len(confirmed) - 20} more confirmed")
        for p in baseline[:10]:
            print(f"  [BASELINE] {p['name']:<35} {p.get('category', '?'):<12} {p.get('location', '?')}")
        if len(baseline) > 10:
            print(f"  ... and {len(baseline) - 10} more baseline")
        return

    # Classify
    client = anthropic.Anthropic()
    results = []
    total_cost = 0.0

    print(f"\nClassifying {len(all_people)} homeowners with {MODEL}...")
    print(f"Output: {output_file}\n")

    with open(output_file, "w") as f:
        for i, person in enumerate(all_people, 1):
            group_label = "EPSTEIN" if person.get("group") == "epstein" else "BASELINE"
            print(f"  [{i}/{len(all_people)}] [{group_label}] {person['name']:<35}", end="", flush=True)

            try:
                result = classify_person(
                    client, person,
                    is_baseline=(person.get("group") == "baseline")
                )
                results.append(result)
                total_cost += result.get("cost", 0)

                cls = result.get("classification", "?")
                conf = result.get("confidence", "?")
                print(f"  → {cls:<15} ({conf})")

                # Write line
                f.write(json.dumps(result, default=str) + "\n")
                f.flush()

                # Rate limiting — be gentle with Opus
                time.sleep(0.5)

            except Exception as e:
                print(f"  ERROR: {e}")
                error_result = {
                    **person,
                    "classification": "ERROR",
                    "confidence": "LOW",
                    "rationale": str(e),
                    "cost": 0,
                }
                results.append(error_result)
                f.write(json.dumps(error_result, default=str) + "\n")
                f.flush()
                time.sleep(2)  # Back off on error

    print(f"\nDone! Results saved to {output_file}")
    print_report(results)


if __name__ == "__main__":
    main()
