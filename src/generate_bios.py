#!/usr/bin/env python3
"""Generate archival 2-3 sentence biographical summaries for AD homeowners.

Uses Opus to synthesize existing wealth_profiles research data into concise,
factual bios. Stores results in wealth_profiles.bio_summary column.

Pages on wheretheylive.world pick up new bios automatically (server-rendered).

Usage:
    python3 src/generate_bios.py --dry-run       # Preview names + cost estimate
    python3 src/generate_bios.py                  # Generate bios (resumes by default)
    python3 src/generate_bios.py --limit 10       # Test with 10 names
    python3 src/generate_bios.py --name "Peter Marino"  # Generate for one person
"""

import argparse
import json
import os
import sys
import time

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── Configuration ────────────────────────────────────────────

MODEL = "claude-opus-4-20250514"
BATCH_SIZE = 12  # names per API call
MAX_RETRIES = 3

# Cost tracking
INPUT_COST_PER_M = 15.0   # Opus input $/M tokens
OUTPUT_COST_PER_M = 75.0  # Opus output $/M tokens

SYSTEM_PROMPT = """You write archival biographical summaries for a research index that cross-references Architectural Digest homeowners with public records.

Your tone is neutral, factual, and precise — like a museum placard or archival reference card. No editorializing, no adjectives of admiration, no magazine prose. State facts.

For each person, write exactly 3 sentences:
1. Who they are — profession, public role, what they are known for.
2. Their connection to Architectural Digest — what was featured and when, if known.
3. Their biographical origin and how they built or acquired their wealth — include specific details: where they grew up, family background, the specific mechanism of wealth (founded X company, inherited Y estate, married into Z family). This sentence should tell the reader the human story behind the money.

Rules:
- Use past tense for deceased persons, present tense for living.
- Never speculate. If data is thin, write fewer sentences rather than padding.
- Do not mention Epstein connections — that context appears elsewhere on the page.
- Do not use superlatives ("legendary", "iconic", "renowned"). Just state the facts.
- If the person is genuinely obscure and the research data says "Unknown", write a single factual sentence from whatever is available (category, location, AD issue).
- Aim for 50-80 words per bio. Do not exceed 100 words."""


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def get_client():
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


# ── Data Fetching ────────────────────────────────────────────

def fetch_profiles_needing_bios(sb, limit=None):
    """Fetch wealth_profiles rows where bio_summary is NULL."""
    query = (
        sb.table("wealth_profiles")
        .select(
            "id, feature_id, homeowner_name, classification, forbes_score, "
            "wealth_source, background, trajectory, rationale, education, "
            "museum_boards, elite_boards, cultural_capital_notes, "
            "social_capital_notes, generational_wealth, bio_summary"
        )
        .is_("bio_summary", "null")
        .order("id")
    )
    if limit:
        query = query.limit(limit)
    else:
        # Paginate to get all rows (Supabase default limit is 1000)
        all_rows = []
        page_size = 1000
        offset = 0
        while True:
            page = (
                sb.table("wealth_profiles")
                .select(
                    "id, feature_id, homeowner_name, classification, forbes_score, "
                    "wealth_source, background, trajectory, rationale, education, "
                    "museum_boards, elite_boards, cultural_capital_notes, "
                    "social_capital_notes, generational_wealth, bio_summary"
                )
                .is_("bio_summary", "null")
                .order("id")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            if not page.data:
                break
            all_rows.extend(page.data)
            if len(page.data) < page_size:
                break
            offset += page_size
        return all_rows

    return query.execute().data


def fetch_feature_context(sb, feature_ids):
    """Fetch feature data for AD article context."""
    if not feature_ids:
        return {}
    # Batch fetch features
    features = {}
    for i in range(0, len(feature_ids), 100):
        batch_ids = feature_ids[i:i + 100]
        result = sb.table("features").select(
            "id, article_title, article_author, subject_category, "
            "location_city, location_state, location_country, "
            "designer_name, architecture_firm, issue_id"
        ).in_("id", batch_ids).execute()
        for f in result.data:
            features[f["id"]] = f

    # Get issue dates for those features
    issue_ids = list({f["issue_id"] for f in features.values() if f.get("issue_id")})
    issues = {}
    if issue_ids:
        for i in range(0, len(issue_ids), 100):
            batch = issue_ids[i:i + 100]
            result = sb.table("issues").select("id, year, month").in_("id", batch).execute()
            for iss in result.data:
                issues[iss["id"]] = iss

    # Merge issue dates into features
    month_names = ["", "January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    for f in features.values():
        iss = issues.get(f.get("issue_id"))
        if iss:
            month = month_names[iss["month"]] if iss.get("month") else ""
            f["issue_date"] = f"{month} {iss['year']}".strip()
        else:
            f["issue_date"] = None

    return features


# ── Bio Generation ───────────────────────────────────────────

def format_person_context(profile, feature):
    """Format one person's data for the prompt."""
    lines = [f"Name: {profile['homeowner_name']}"]

    if feature:
        parts = []
        if feature.get("issue_date"):
            parts.append(f"AD issue: {feature['issue_date']}")
        if feature.get("article_title"):
            parts.append(f"Article: \"{feature['article_title']}\"")
        if feature.get("subject_category"):
            parts.append(f"Category: {feature['subject_category']}")
        loc = ", ".join(filter(None, [feature.get("location_city"),
                                       feature.get("location_state"),
                                       feature.get("location_country")]))
        if loc:
            parts.append(f"Location: {loc}")
        if feature.get("designer_name"):
            parts.append(f"Designer: {feature['designer_name']}")
        if parts:
            lines.append(" | ".join(parts))

    # Wealth research data
    for field, label in [
        ("wealth_source", "Wealth source"),
        ("background", "Background"),
        ("trajectory", "Trajectory"),
        ("classification", "Classification"),
        ("forbes_score", "Forbes score (1-10)"),
        ("education", "Education"),
        ("generational_wealth", "Generational wealth"),
        ("museum_boards", "Museum boards"),
        ("elite_boards", "Elite boards"),
        ("cultural_capital_notes", "Cultural capital"),
        ("social_capital_notes", "Social capital"),
    ]:
        val = profile.get(field)
        if val and str(val) not in ("Unknown", "None", "null", "UNKNOWN"):
            lines.append(f"{label}: {val}")

    return "\n".join(lines)


def generate_batch(client, batch, features):
    """Generate bios for a batch of profiles. Returns {profile_id: bio_text}."""
    # Build the user prompt
    person_blocks = []
    for i, profile in enumerate(batch, 1):
        feature = features.get(profile.get("feature_id"))
        ctx = format_person_context(profile, feature)
        person_blocks.append(f"[Person {i}: ID={profile['id']}]\n{ctx}")

    user_prompt = (
        "Write an archival biographical summary (2-3 sentences, under 60 words) "
        f"for each of the following {len(batch)} people.\n\n"
        "Return your response as a JSON array of objects with keys "
        "\"id\" (the profile ID) and \"bio\" (the summary text). "
        "No markdown, no code fences — just the JSON array.\n\n"
        + "\n\n".join(person_blocks)
    )

    for attempt in range(MAX_RETRIES):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            text = response.content[0].text.strip()
            # Strip markdown fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

            bios = json.loads(text)
            result = {}
            for entry in bios:
                pid = entry.get("id")
                bio = entry.get("bio", "").strip()
                if pid and bio:
                    result[pid] = bio

            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            return result, input_tokens, output_tokens

        except (json.JSONDecodeError, KeyError, IndexError) as e:
            if attempt < MAX_RETRIES - 1:
                print(f"    Parse error (attempt {attempt + 1}): {e}, retrying...")
                time.sleep(2)
                continue
            print(f"    Parse error after {MAX_RETRIES} attempts: {e}")
            return {}, 0, 0
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
            return {}, 0, 0

    return {}, 0, 0


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate archival bios for AD homeowners")
    parser.add_argument("--dry-run", action="store_true", help="Preview count + cost estimate")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of names")
    parser.add_argument("--name", type=str, default=None, help="Generate for one specific person")
    args = parser.parse_args()

    sb = get_supabase()

    if args.name:
        # Single-name mode
        result = (
            sb.table("wealth_profiles")
            .select("*")
            .ilike("homeowner_name", f"%{args.name}%")
            .execute()
        )
        if not result.data:
            print(f"No wealth profile found for '{args.name}'")
            return
        profiles = result.data
        print(f"Found {len(profiles)} matching profile(s)")
    else:
        print("Fetching profiles needing bios...")
        profiles = fetch_profiles_needing_bios(sb, limit=args.limit)
        print(f"  {len(profiles)} profiles need bios")

    if not profiles:
        print("All profiles already have bios.")
        return

    if args.dry_run:
        est_batches = (len(profiles) + BATCH_SIZE - 1) // BATCH_SIZE
        est_input = len(profiles) * 500  # ~500 tokens per person
        est_output = len(profiles) * 100  # ~100 tokens per bio
        est_cost = (est_input / 1_000_000 * INPUT_COST_PER_M +
                    est_output / 1_000_000 * OUTPUT_COST_PER_M)
        print(f"\n  Profiles to process: {len(profiles)}")
        print(f"  Batches ({BATCH_SIZE}/batch): {est_batches}")
        print(f"  Estimated tokens: ~{est_input:,} in / ~{est_output:,} out")
        print(f"  Estimated cost: ~${est_cost:.2f}")
        print(f"\n  Sample names:")
        for p in profiles[:10]:
            print(f"    {p['homeowner_name']:<40} {p.get('classification', '?')}")
        return

    # Fetch feature context for AD article info
    feature_ids = [p["feature_id"] for p in profiles if p.get("feature_id")]
    print(f"Fetching feature context for {len(feature_ids)} features...")
    features = fetch_feature_context(sb, feature_ids)
    print(f"  Got {len(features)} features")

    client = get_client()

    total_written = 0
    total_errors = 0
    total_input_tokens = 0
    total_output_tokens = 0

    for batch_start in range(0, len(profiles), BATCH_SIZE):
        batch = profiles[batch_start:batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(profiles) + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"\n  Batch {batch_num}/{total_batches} "
              f"({len(batch)} names: {batch[0]['homeowner_name']} ... {batch[-1]['homeowner_name']})")

        bios, inp_tok, out_tok = generate_batch(client, batch, features)
        total_input_tokens += inp_tok
        total_output_tokens += out_tok

        # Write bios to Supabase
        for profile in batch:
            bio = bios.get(profile["id"])
            if bio:
                try:
                    sb.table("wealth_profiles").update(
                        {"bio_summary": bio}
                    ).eq("id", profile["id"]).execute()
                    total_written += 1
                except Exception as e:
                    print(f"    DB error for {profile['homeowner_name']}: {e}")
                    total_errors += 1
            else:
                total_errors += 1

        cost = (total_input_tokens / 1_000_000 * INPUT_COST_PER_M +
                total_output_tokens / 1_000_000 * OUTPUT_COST_PER_M)
        print(f"    Written: {len(bios)}/{len(batch)} | "
              f"Total: {total_written} done, {total_errors} errors | "
              f"Cost: ${cost:.2f}")

    # Final summary
    cost = (total_input_tokens / 1_000_000 * INPUT_COST_PER_M +
            total_output_tokens / 1_000_000 * OUTPUT_COST_PER_M)
    print(f"\n{'═' * 60}")
    print(f"  COMPLETE: {total_written} bios written, {total_errors} errors")
    print(f"  Tokens: {total_input_tokens:,} in / {total_output_tokens:,} out")
    print(f"  Cost: ${cost:.2f}")
    print(f"{'═' * 60}")


if __name__ == "__main__":
    main()
