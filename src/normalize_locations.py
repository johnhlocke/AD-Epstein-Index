#!/usr/bin/env python3
"""Deterministic location normalization for Supabase features table.

Exact-match mappings only — no LLM, no fuzzy matching, no API costs.
Normalizes country abbreviations, state abbreviations, and city synonyms
to canonical forms for consistent Neo4j Location nodes.

Usage:
    python3 src/normalize_locations.py --dry-run    # Show what would change
    python3 src/normalize_locations.py --apply       # Update Supabase
"""

import os
import sys
import time

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


# ── Canonical Mappings ────────────────────────────────────────

COUNTRY_MAP = {
    "US": "United States",
    "USA": "United States",
    "U.S.": "United States",
    "U.S.A.": "United States",
    "England": "United Kingdom",
    "Scotland": "United Kingdom",
    "Wales": "United Kingdom",
    "Northern Ireland": "United Kingdom",
    "St. Vincent and the Grenadines": "Saint Vincent and the Grenadines",
    "St. Lucia": "Saint Lucia",
    "St. Kitts and Nevis": "Saint Kitts and Nevis",
    "St. Barths": "Saint Barthelemy",
    "St. Barts": "Saint Barthelemy",
    "St. Barthélemy": "Saint Barthelemy",
}

# When country becomes UK, the old country value moves to state
# (e.g., country="England" → country="United Kingdom", state="England")
UK_CONSTITUENT_COUNTRIES = {"England", "Scotland", "Wales", "Northern Ireland"}

STATE_MAP = {
    "NY": "New York",
    "CA": "California",
    "FL": "Florida",
    "CT": "Connecticut",
    "MA": "Massachusetts",
    "TX": "Texas",
    "CO": "Colorado",
    "IL": "Illinois",
    "NM": "New Mexico",
    "HI": "Hawaii",
    "PA": "Pennsylvania",
    "MT": "Montana",
    "VA": "Virginia",
    "WA": "Washington",
    "NJ": "New Jersey",
    "MI": "Michigan",
    "LA": "Louisiana",
    "SC": "South Carolina",
    "WY": "Wyoming",
    "TN": "Tennessee",
    "AZ": "Arizona",
    "GA": "Georgia",
    "MD": "Maryland",
    "OH": "Ohio",
    "UT": "Utah",
    "RI": "Rhode Island",
    "ID": "Idaho",
    "NV": "Nevada",
    "WI": "Wisconsin",
    "IN": "Indiana",
    "MO": "Missouri",
    "OR": "Oregon",
    "MN": "Minnesota",
    "NC": "North Carolina",
    "DC": "District of Columbia",
    "D.C.": "District of Columbia",
}

CITY_MAP = {
    "Manhattan": "New York",
    "New York City": "New York",
    "Brooklyn": "New York",
    "Bronx": "New York",
    "Queens": "New York",
    "Staten Island": "New York",
    "Bel Air": "Bel-Air",   # Standardize hyphenation
}


def get_sb():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


def fetch_all_locations(sb):
    """Fetch all features with location fields, grouped by unique combo."""
    all_features = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, location_city, location_state, location_country"
        ).range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Group feature IDs by (city, state, country) combo
    combos = {}
    for f in all_features:
        key = (
            f.get("location_city") or "",
            f.get("location_state") or "",
            f.get("location_country") or "",
        )
        combos.setdefault(key, []).append(f["id"])

    return combos, len(all_features)


def normalize_combo(city, state, country):
    """Apply deterministic normalization rules to a (city, state, country) tuple.

    Returns (new_city, new_state, new_country) or None if unchanged.
    Only applies exact-match mappings. Does NOT touch compound values
    like "Manhattan and East Hampton".
    """
    new_city = city or None
    new_state = state or None
    new_country = country or None

    changed = False

    # ── Country normalization ──
    if new_country and new_country in COUNTRY_MAP:
        canonical_country = COUNTRY_MAP[new_country]

        # If converting a UK constituent country, preserve it as state
        if new_country in UK_CONSTITUENT_COUNTRIES and not new_state:
            new_state = new_country
            changed = True

        new_country = canonical_country
        changed = True

    # ── State normalization ──
    if new_state and new_state in STATE_MAP:
        new_state = STATE_MAP[new_state]
        changed = True

    # ── City normalization ──
    if new_city and new_city in CITY_MAP:
        new_city = CITY_MAP[new_city]
        changed = True

    # Convert empty strings back to None
    new_city = new_city if new_city else None
    new_state = new_state if new_state else None
    new_country = new_country if new_country else None

    return (new_city, new_state, new_country, changed)


def main():
    if "--dry-run" in sys.argv:
        mode = "dry-run"
    elif "--apply" in sys.argv:
        mode = "apply"
    else:
        print("Usage: python3 src/normalize_locations.py --dry-run|--apply")
        sys.exit(1)

    sb = get_sb()

    print(f"Mode: {mode}")
    print("Fetching all features...")
    combos, total_features = fetch_all_locations(sb)
    print(f"  {total_features} features, {len(combos)} unique location combos\n")

    changes = []  # [(old_combo, new_combo, feature_ids)]

    for (city, state, country), feature_ids in combos.items():
        new_city, new_state, new_country, changed = normalize_combo(city, state, country)
        if changed:
            changes.append((
                (city or None, state or None, country or None),
                (new_city, new_state, new_country),
                feature_ids,
            ))

    if not changes:
        print("No changes needed — all locations already normalized.")
        return

    # Sort by number of affected features (biggest impact first)
    changes.sort(key=lambda c: -len(c[2]))

    total_affected = sum(len(c[2]) for c in changes)
    print(f"Found {len(changes)} combos to normalize ({total_affected} features affected):\n")

    for old, new, ids in changes:
        old_str = f"({old[0]}, {old[1]}, {old[2]})"
        new_str = f"({new[0]}, {new[1]}, {new[2]})"
        print(f"  {old_str}")
        print(f"    -> {new_str}  [{len(ids)} features]")

    if mode == "dry-run":
        print(f"\nDRY RUN — no changes applied. Use --apply to update Supabase.")
        return

    # ── Apply changes ──
    print(f"\nApplying {len(changes)} changes...")
    updated = 0
    errors = 0

    for old, new, feature_ids in changes:
        update = {
            "location_city": new[0],
            "location_state": new[1],
            "location_country": new[2],
        }

        # Batch update in chunks of 100
        for i in range(0, len(feature_ids), 100):
            chunk = feature_ids[i : i + 100]
            for attempt in range(3):
                try:
                    sb.from_("features").update(update).in_("id", chunk).execute()
                    updated += len(chunk)
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(2 ** attempt)
                    else:
                        print(f"  ERROR updating {len(chunk)} features: {e}")
                        errors += len(chunk)

    print(f"\nDONE")
    print(f"  Features updated: {updated}")
    if errors:
        print(f"  Errors: {errors}")


if __name__ == "__main__":
    main()
