#!/usr/bin/env python3
"""Re-resolve Wikipedia pages for fame_metrics entries with nulled Wikipedia data.

Uses the improved compound-name-aware search from measure_fame.py.
Directly updates Supabase — no JSONL intermediate.

Usage:
    python3 src/fix_wikipedia_matches.py              # Re-resolve all nulled entries
    python3 src/fix_wikipedia_matches.py --dry-run    # Preview what would be resolved
    python3 src/fix_wikipedia_matches.py --limit 50   # Test with first 50
"""

import argparse
import asyncio
import os
import ssl
import sys
import time
import urllib.parse

import aiohttp
import certifi
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(__file__))
from measure_fame import (
    USER_AGENT,
    WIKIPEDIA_BATCH_DELAY,
    WIKIPEDIA_CONCURRENCY,
    _wiki_get,
    split_compound_name,
    _wiki_search_single,
    wikipedia_edit_count,
    wikipedia_pageviews,
    wikipedia_search,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

WIKIREFS_BATCH_SIZE = 20

# Names whose Wikipedia matches were manually reviewed and found to be wrong person/topic.
# Skip these during re-collection to prevent false positives from recurring.
WIKIPEDIA_BLOCKLIST = {
    "Prince Charles (The Prince of Wales)",
    "The Count and Countess of Orgaz",
    "Roberto F. Cruz's son",
    "King Juan Carlos and Queen Sofia",
    "Caroline Ladd Pratt",
    "Tom James and Nancy Fiskel",
    "Shervie and David Price",
    "Danny Meyer",  # algorithm matches footballer, not the restaurateur — wrong page
    "Wayne and Valerie Carney",
    "Ed and Ruth Morrow",
    "Tom Strong and Tatiana Ballabrera",
    "Edgar and Hope Scott",
    "W. Clarke and Elizabeth Swanson",
    "Jun Gi and Eul Sun Hong",
    "Patrick Robert",
    "James and Sandy Cape",
    "Frédéric de Luca and Patrick Seguin",  # compound logic picks wrong Luca Landi; Patrick Seguin set manually
    "Tom and Lynn Meredith",
    "Pauline Pitt",
    "Prince Henry of Hesse",
    "Louise Simone",
    "Karen Hudson",
    "Diane Burn",
    "Alfred and Deeann Baldwin",
    "Dan and Amelia Musser",
    # "David Kleinberg",  # REMOVED — IS the famous interior designer
    "Michelle R. Smith",
    "Tracy Gardner and Dani James",
    "Weitsmans",
    "Robert Dirstein and James Robertson",
    "Luke Edward Hall and Duncan Campbell",
    "Sir George and Lady Christies",
    "Hans and Victoria Schmidt",
    "Tom and Bunty Armstrong",
    "Augusta Holland",
    "Gerald and Kathleen Peters",  # matched politician, not AD homeowner
    "James and Lisa Cohen",  # matched journalist, not AD homeowner
    "Steven Stark and Candice Stark",  # matched author, not AD homeowner
    "Angus Wilkie and Leu Morgan",  # matched "Wilkie (surname)" disambiguation
    # Round 2 false positives (2026-03-03)
    "Robert and Susan Burns",  # matched Robert Burns (18th century Scottish poet)
    "Ray and Sylvia Jacobs",  # matched Ray Jacobs (1960s NFL player)
    "Max Goldstein and Jay Ezra Nayssan",  # matched Max Goldstein (19th century mathematician)
    # "Ulla Johnson and Zach Miner",  # REMOVED — tightened algo now correctly matches Ulla Johnson (designer)
    "Jorge Elias",  # matched Jorge Elias (footballer), not interior designer
    "Sam Brustad and Yuki Shimizu",  # matched Yuki Shimizu (manga artist)
    "Manuel Parra",  # matched Luis Manuel Carbonell Parra (Colombian politician)
    "Van Dusen",  # matched Chris Van Dusen (TV showrunner)
    "Eugene Brown and Santine Brown",  # matched Eugene Brown (chess player)
    "David Jones",  # too generic, wrong person
    "Gabriel Hendifar and Jeremy Anderson",  # matched Jeremy Anderson (sculptor d.1998)
    "Rachel and Jerry Martin",  # matched Rachel Martin (NPR host)
    "Sri Dhavirach and Helen Smith",  # matched Helen Smith (generic, wrong)
    "Lisa and James Cohen",  # matched Lisa R. Cohen (journalist)
    "Courtney and Nicholas Stern",  # matched Nicholas Stern (economist)
    "Candice and Steven Stark",  # matched Steven D. Stark (author)
    # Round 3 false positives (2026-03-03, tightened algorithm)
    "Carole and Robert McNeill",  # matched Robert McNeill Alexander (zoologist)
    # "Edmund and Nina Stevens",  # REMOVED — IS Edmund Stevens, Pulitzer-winning Moscow correspondent
    "Elizabeth and W. Clarke Swanson",  # matched Elizabeth Lyons Swanson
    "Perry Saffire and Stephen Harvey",  # matched Steve Harvey (TV host)
    "James LaForce and Stephen Henderson",  # matched Stephen McKinley Henderson (actor)
    "Michael and Carol Newman",  # matched Michael Newman (Baywatch actor)
    "Sir Laurence Parsons",  # matched Laurence Parsons, 1st Earl of Rosse (18th century)
    "Edward and Mrs. Boscawen",  # matched Edward Boscawen (18th century admiral)
    "Bill Murray",  # matched Bill Murray (offensive lineman), not the AD homeowner
    "Richard Lewis and Donna Allen",  # matched Richard Lewis (comedian)
    "Gary Locke and Suzanne Tucker",  # matched Gary Locke (WA Governor)
    "Leo Seigal and Maxwell Anderson",  # matched Maxwell Anderson (playwright d.1959)
    "Fred Woodward and Janice Woodward",  # matched Fred Woodward (actor)
    "John and Norma King",  # matched John King (wrong person, 0 edits)
    "Dr. Larry Dumont and Martin Gould",  # matched Martin Gould (journalist)
    "Colman",  # mononym matched Colman Domingo (actor)
    "Kasper",  # mononym matched Kasper Schmeichel (goalkeeper)
    "Patrick",  # mononym matched Patrick Swayze (actor)
    "Hollywood film director and his young family",  # not a real name
    "Hendrix and Allardyce",  # matched Sam Allardyce (football manager)
    "Hariri & Hariri",  # matched Hariri (Lebanese political family), not architecture firm
    "Cheri and Megan Harris",  # matched Megan Harris (24 views, wrong person)
    # Round 4 false positives (2026-03-03) — only provably wrong matches
    "John N. Palmer",  # matched John M. Palmer (wrong middle initial N ≠ M)
    "Duncan and Gail MacNaughton",  # matched Duncan MacNaughton (1932 Olympic jumper, d.1998)
    # Round 5 false positives (2026-03-03) — from re-validation after algorithm tightening
    "Rodney Mims Cook, Jr.",  # matched father (Rodney Mims Cook Sr.), not son
    "Liz and Pierro",  # matched Pierro (Australian racehorse), not person
    # Round 6 false positives (2026-03-03) — from re-collection audit
    "Betty and Stanley McDermott Jr.",  # matched Betty White (actress), not AD homeowner
    "Adam and Eve (pseudonyms)",  # matched Adam Lanza; pseudonyms, not real names
    "Ted Turner",  # matched Ted Turner (guitarist), not the media mogul
    "Laura Gonzalez",  # matched Laura González (Miss Colombia), not French interior designer
    "David Jimenez",  # matched David Jiménez (footballer)
    "Madame Carven",  # matched Carven Holcombe; should be Marie-Louise Carven but algo can't verify
    "Allen and Lynn Turner",  # matched Allen Turner (cricketer)
    "Dan John Anderson",  # matched Dan Anderson (psychologist), different middle name
    "Rita and Samuel Robert",  # reversed match to Robert Rita (IL politician)
    # Round 7 false positives (2026-03-03) — from comprehensive audit
    "Film producer",  # generic Wikipedia article, not a person name at all
    "George Dunbar",  # matched George Dunbar (MP), not AD homeowner
    "Bob Hill",  # matched Bob Hill (racing driver), not AD homeowner
    "Bunny Williams and John Rosselli",  # matched John Rosselli (historian), not antiques dealer
    "Howard and Trina Feldman",  # matched Howard Feldman (neuroscientist), not AD homeowner
    "Stavros Niarchos Foundation",  # foundation, not a person
    "Donald C. Smith and Carol A. Groh",  # matched Donald Smith (banker), wrong person
    "Ed Hardy",  # re-matches Ed Hardy (brand), not Don Ed Hardy the person
    "Greg Norman and Laura Norman",  # re-matches Greg Norman Medal, not the golfer
    "Bernard B. Jacobs",  # re-matches Bernard B. Jacobs Theatre, not the person
    "John and Diane",  # "John" is too generic — matched the generic "John" article
    "Lady Egremont",  # matched Egremont, Cumbria (town), no person page
    "Richland (referenced as homeowner in third image)",  # not a person name
    "The Earl and Countess of Wilton",  # matched "The EARL" (not a person)
    "Lord and Lady Spencer",  # matched "Spencer" disambiguation
    "United States Government / State Department",  # not a person
    "The British Royal Family",  # not a person
    "Lord and Lady Rosebery",  # matched "Rosebery" disambiguation
    "Viscount and Viscountess Cobham",  # matched Cobham Limited (company)
    "William and Patricia Anton",  # matched William Anton of Asseburg (wrong person)
    "Multiple: Duke of Devonshire (Stoker Cavendish), Fiona Herbert (Countess of Carnarvon), Emma Manners (Duchess of Rutland)",  # compound, matched wrong duke
}


async def get_reference_count(session, title):
    """Count <ref> tags on a Wikipedia page."""
    import re as _re
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "parse",
        "page": title,
        "prop": "wikitext",
        "format": "json",
    }
    headers = {"User-Agent": USER_AGENT}
    try:
        status, data = await _wiki_get(session, url, params=params, headers=headers)
        if status != 200 or data is None:
            return None
        if "error" in data:
            return None
        wikitext = data.get("parse", {}).get("wikitext", {}).get("*", "")
        return len(_re.findall(r"<ref[\s>]", wikitext))
    except Exception:
        return None


async def resolve_one(session, sem, name):
    """Resolve Wikipedia page + metrics for one name."""
    async with sem:
        title = await wikipedia_search(session, name)
        if not title:
            return {
                "wikipedia_page": None,
                "wikipedia_edit_count": None,
                "wikipedia_pageviews": None,
                "wikipedia_reference_count": None,
            }

        edits = await wikipedia_edit_count(session, title)
        views = await wikipedia_pageviews(session, title)
        refs = await get_reference_count(session, title)

        return {
            "wikipedia_page": title,
            "wikipedia_edit_count": edits,
            "wikipedia_pageviews": views,
            "wikipedia_reference_count": refs,
        }


async def run(entries, dry_run=False):
    """Re-resolve Wikipedia for all entries."""
    sem = asyncio.Semaphore(WIKIPEDIA_CONCURRENCY)
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(limit=WIKIPEDIA_CONCURRENCY, ssl=ssl_ctx)
    timeout = aiohttp.ClientTimeout(total=30)

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    resolved = 0
    no_page = 0
    errors = 0
    updated = 0

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        for batch_start in range(0, len(entries), WIKIREFS_BATCH_SIZE):
            batch = entries[batch_start:batch_start + WIKIREFS_BATCH_SIZE]
            tasks = [(e, resolve_one(session, sem, e["homeowner_name"])) for e in batch]

            results = await asyncio.gather(
                *[t[1] for t in tasks], return_exceptions=True
            )

            batch_found = 0
            for (entry, _), result in zip(tasks, results):
                name = entry["homeowner_name"]
                fame_id = entry["id"]

                if isinstance(result, Exception):
                    print(f"    ERROR {name}: {result}")
                    errors += 1
                    continue

                resolved += 1
                wp = result.get("wikipedia_page")

                if wp:
                    batch_found += 1
                    edits = result.get("wikipedia_edit_count") or 0
                    views = result.get("wikipedia_pageviews") or 0
                    refs = result.get("wikipedia_reference_count") or 0

                    if not dry_run:
                        try:
                            sb.from_("fame_metrics").update({
                                "wikipedia_page": wp,
                                "wikipedia_edit_count": result["wikipedia_edit_count"],
                                "wikipedia_pageviews": result["wikipedia_pageviews"],
                            }).eq("id", fame_id).execute()
                            updated += 1
                        except Exception as e:
                            print(f"    DB ERROR {name}: {e}")
                            errors += 1

                    tag = "[DRY]" if dry_run else "[OK]"
                    print(f"    {tag} {name:<45} → {wp} (edits={edits:,} views={views:,})")
                else:
                    no_page += 1

            done = min(batch_start + WIKIREFS_BATCH_SIZE, len(entries))
            print(
                f"  [{done:>4}/{len(entries)}] "
                f"resolved={resolved} found={resolved - no_page} "
                f"no_page={no_page} errors={errors}"
            )

            await asyncio.sleep(WIKIPEDIA_BATCH_DELAY)

    print(f"\n  Summary: {resolved} resolved, {resolved - no_page} found pages, "
          f"{no_page} no Wikipedia page, {errors} errors, {updated} DB updates")
    return resolved, no_page, errors


def main():
    parser = argparse.ArgumentParser(description="Re-resolve Wikipedia matches for nulled fame entries")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating DB")
    parser.add_argument("--limit", type=int, default=None, help="Limit entries to process")
    args = parser.parse_args()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # Get all entries with null Wikipedia edit count
    print("Fetching fame_metrics entries with null Wikipedia data...")
    entries = []
    offset = 0
    while True:
        resp = (sb.from_("fame_metrics")
                .select("id, homeowner_name, group_label")
                .is_("wikipedia_edit_count", "null")
                .range(offset, offset + 999)
                .execute())
        if not resp.data:
            break
        entries.extend(resp.data)
        if len(resp.data) < 1000:
            break
        offset += 1000

    print(f"  Found {len(entries)} entries needing Wikipedia resolution")

    ep_count = sum(1 for e in entries if e["group_label"] == "epstein")
    bl_count = sum(1 for e in entries if e["group_label"] == "baseline")
    print(f"  Epstein: {ep_count}, Baseline: {bl_count}")

    if args.limit:
        entries = entries[:args.limit]
        print(f"  Limited to {len(entries)} entries")

    # Filter out blocklisted names (known false positive Wikipedia matches)
    before = len(entries)
    entries = [e for e in entries if e["homeowner_name"] not in WIKIPEDIA_BLOCKLIST]
    if before != len(entries):
        print(f"  Skipped {before - len(entries)} blocklisted names (known false positives)")

    if not entries:
        print("  Nothing to do!")
        return

    est_min = len(entries) * 3 * WIKIPEDIA_BATCH_DELAY / WIKIREFS_BATCH_SIZE / 60
    print(f"  Estimated time: ~{est_min:.0f} min")

    if args.dry_run:
        print("\n  DRY RUN — no DB updates")

    t0 = time.time()
    asyncio.run(run(entries, dry_run=args.dry_run))
    elapsed = time.time() - t0
    print(f"\n  Done in {elapsed:.0f}s ({elapsed / 60:.1f} min)")


if __name__ == "__main__":
    main()
