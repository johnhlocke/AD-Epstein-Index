#!/usr/bin/env python3
"""Normalize location_city / location_state / location_country via Haiku.

Sends unique (city, state, country) combos in batches, gets standardized output,
then updates all matching features.

Rules:
- Country: Full English name ("United States" not "USA", "United Kingdom" not "England")
- City: Actual municipality (e.g. "New York City" not "Manhattan"/"Brooklyn";
        Beverly Hills, Santa Monica, Malibu stay as-is — they're real cities)
- State: Full US state names ("New York" not "NY"); colloquial English region names
        for non-US ("Tuscany" not "Toscana", "Provence" not "Provence-Alpes-Côte d'Azur")
- England/Scotland/Wales → state field, country → "United Kingdom"
- "Hamptons" → null city (use specific town if known)
- "D.C." / "DC" → "District of Columbia" in state, "Washington" in city

Usage:
    python3 src/normalize_locations.py
    python3 src/normalize_locations.py --dry-run
"""

import json
import os
import sys
import time

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BATCH_SIZE = 60  # combos per API call


def get_sb():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def get_all_locations(sb):
    """Fetch all features, deduplicate by location combo."""
    all_locs = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, location_city, location_state, location_country"
        ).range(offset, offset + 999).execute()
        all_locs.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Group by (city, state, country)
    combos = {}
    for f in all_locs:
        key = (
            f.get("location_city") or "",
            f.get("location_state") or "",
            f.get("location_country") or "",
        )
        if key not in combos:
            combos[key] = []
        combos[key].append(f["id"])

    return combos


SYSTEM_PROMPT = """You are a location data normalizer. Given raw location data from a magazine database,
return standardized city/state/country values.

RULES:
1. COUNTRY: Full English name. "USA"/"US" → "United States". "England"/"Scotland"/"Wales" as country → "United Kingdom".
2. CITY: Actual municipality name.
   - "Manhattan"/"Brooklyn"/"Bronx"/"Queens"/"Staten Island" → "New York City"
   - "New York" (when it means the city) → "New York City"
   - "Bel Air"/"Bel-Air" → "Los Angeles" (it's a neighborhood, not a city)
   - "Hamptons" → null (it's a region, not a city — keep specific towns like East Hampton, Southampton)
   - "Hudson Valley"/"Napa Valley"/"Martha's Vineyard" → null city (these are regions; put in state if useful)
   - Beverly Hills, Santa Monica, Malibu, Palm Beach — keep as-is (they are real municipalities)
   - Capitalize properly: "milan" → "Milan", "saint-tropez" → "Saint-Tropez"
3. STATE: Full name for US states ("NY" → "New York", "CA" → "California").
   - "D.C."/"DC" → "District of Columbia"
   - For non-US: use colloquial English region names ("Tuscany" not "Toscana", "Provence" not "Provence-Alpes-Côte d'Azur")
   - "England"/"Scotland"/"Wales"/"Northern Ireland" go in state when country is UK
   - "Long Island" → state should be "New York", city stays null if no specific town
   - "Martha's Vineyard" → state "Massachusetts", city null
   - "Napa Valley" → state "California", city null
   - "Hudson Valley" → state "New York", city null
4. If all three fields are empty/unknown, return nulls.

Return ONLY a JSON array. Each element: {"idx": <index>, "city": "..." or null, "state": "..." or null, "country": "..." or null}
No explanation, no markdown fences."""


def normalize_batch(client, batch):
    """Send a batch of location combos to Haiku for normalization."""
    lines = []
    for i, (city, state, country) in enumerate(batch):
        lines.append(f'{i}: city="{city}" state="{state}" country="{country}"')

    user_msg = "Normalize these locations:\n\n" + "\n".join(lines)

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = resp.content[0].text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]

    results = json.loads(text)

    tokens_in = resp.usage.input_tokens
    tokens_out = resp.usage.output_tokens
    cost = (tokens_in * 1.0 + tokens_out * 5.0) / 1_000_000

    return results, cost


def main():
    dry_run = "--dry-run" in sys.argv

    sb = get_sb()
    client = anthropic.Anthropic()

    combos = get_all_locations(sb)
    combo_keys = list(combos.keys())

    print(f"Total features: {sum(len(v) for v in combos.values())}")
    print(f"Unique location combos: {len(combo_keys)}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Estimated batches: {(len(combo_keys) + BATCH_SIZE - 1) // BATCH_SIZE}")
    print()

    total_cost = 0
    total_updated = 0
    total_changed = 0

    for batch_start in range(0, len(combo_keys), BATCH_SIZE):
        batch_keys = combo_keys[batch_start:batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(combo_keys) + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"[Batch {batch_num}/{total_batches}] Processing {len(batch_keys)} combos...")

        try:
            results, cost = normalize_batch(client, batch_keys)
            total_cost += cost
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        # Apply results
        for r in results:
            idx = r["idx"]
            if idx >= len(batch_keys):
                continue

            old_key = batch_keys[idx]
            new_city = r.get("city") or None
            new_state = r.get("state") or None
            new_country = r.get("country") or None

            old_city, old_state, old_country = old_key
            old_city = old_city or None
            old_state = old_state or None
            old_country = old_country or None

            # Check if anything changed
            changed = (new_city != old_city or new_state != old_state or new_country != old_country)

            if changed:
                feature_ids = combos[old_key]
                total_changed += len(feature_ids)

                if dry_run:
                    print(f"  WOULD UPDATE {len(feature_ids)} features:")
                    print(f"    ({old_city}, {old_state}, {old_country})")
                    print(f"    → ({new_city}, {new_state}, {new_country})")
                else:
                    update = {
                        "location_city": new_city,
                        "location_state": new_state,
                        "location_country": new_country,
                    }
                    # Batch update by IDs with retry
                    for i in range(0, len(feature_ids), 100):
                        chunk = feature_ids[i:i+100]
                        for attempt in range(3):
                            try:
                                sb.from_("features").update(update).in_("id", chunk).execute()
                                break
                            except Exception as db_err:
                                if attempt < 2:
                                    time.sleep(2 ** attempt)
                                else:
                                    print(f"    DB error after 3 attempts: {db_err}")

                total_updated += len(feature_ids)

        sys.stdout.flush()

    print(f"\n{'=' * 60}")
    print(f"DONE")
    print(f"{'=' * 60}")
    print(f"Combos processed: {len(combo_keys)}")
    print(f"Features updated: {total_updated}")
    print(f"Features changed: {total_changed}")
    print(f"Total cost: ${total_cost:.2f}")


if __name__ == "__main__":
    main()
