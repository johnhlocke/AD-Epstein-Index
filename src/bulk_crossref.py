"""
Bulk cross-reference all unchecked features against Epstein records.

Standalone script that bypasses the pipeline scheduling and processes
all remaining names directly. Uses the same BB + DOJ search logic as
the Detective agent, writes to the same Supabase tables.

Safe to run alongside the orchestrator (upsert_cross_reference is idempotent).

Usage:
    python3 src/bulk_crossref.py                  # Process all unchecked
    python3 src/bulk_crossref.py --bb-only         # BB only (no DOJ browser)
    python3 src/bulk_crossref.py --limit 20        # First 20 unchecked
    python3 src/bulk_crossref.py --dry-run          # Show what would be checked
    python3 src/bulk_crossref.py --name "John Doe"  # Check a single name
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from cross_reference import (
    search_black_book, load_black_book, assess_combined_verdict,
    contextual_glance, verdict_to_binary, split_names, SKIP_NAMES,
)
from db import (
    get_features_needing_detective, get_features_missing_crossref,
    upsert_cross_reference, get_supabase,
)


# Per-name DOJ search timeout (seconds) — prevents one hung search from blocking everything
DOJ_NAME_TIMEOUT = 60


async def bulk_crossref(args):
    """Main cross-reference loop."""
    print("=" * 60)
    print("BULK CROSS-REFERENCE — BB + DOJ")
    print("=" * 60)

    # Load Black Book
    book_text = load_black_book()
    if not book_text:
        print("ERROR: Black Book not found")
        return
    print(f"Black Book loaded ({len(book_text):,} chars)")

    # Get unchecked features
    if args.name:
        # Single name mode — create a fake feature record
        unchecked = [{"id": 0, "homeowner_name": args.name, "issue_id": None}]
    elif args.missing_xref:
        unchecked = get_features_missing_crossref()
        print(f"Found {len(unchecked)} features missing cross-references")
    else:
        unchecked = get_features_needing_detective()
        print(f"Found {len(unchecked)} unchecked features")

    if not unchecked:
        print("Nothing to check — all features have detective verdicts!")
        return

    # Deduplicate by name (group feature IDs)
    name_to_features = {}
    for feat in unchecked:
        name = (feat.get("homeowner_name") or "").strip()
        if not name or name.lower() in SKIP_NAMES or name == "Anonymous":
            continue
        name_to_features.setdefault(name, []).append(feat["id"])

    names = list(name_to_features.keys())
    if args.limit:
        names = names[:args.limit]

    print(f"Unique names to check: {len(names)}")
    print()

    if args.dry_run:
        for i, name in enumerate(names):
            fids = name_to_features[name]
            print(f"  [{i+1}] {name} (feature IDs: {fids})")
        print(f"\nDry run — {len(names)} names would be checked")
        return

    # Start DOJ browser (unless --bb-only)
    doj_client = None
    if not args.bb_only:
        print("Launching DOJ browser...")
        try:
            from doj_search import DOJSearchClient
            doj_client = DOJSearchClient()
            await doj_client.start()
            print("DOJ browser ready")
        except Exception as e:
            print(f"DOJ browser failed: {e}")
            print("Falling back to BB-only mode")
            doj_client = None

    # Process names
    stats = {"checked": 0, "yes": 0, "no": 0, "errors": 0, "skipped": 0}
    start_time = time.time()

    try:
        for i, name in enumerate(names):
            feature_ids = name_to_features[name]
            individuals = split_names(name) or [name]

            # Search each individual, keep the strongest result
            best_bb_matches = None
            best_doj_result = None
            best_verdict_info = None
            best_bb_verdict = "no_match"
            best_doj_verdict = "skipped" if args.bb_only else "pending"

            for individual in individuals:
                if not individual or len(individual.strip()) < 3:
                    continue

                # BB search (instant)
                bb_matches = search_black_book(individual, book_text)
                if bb_matches:
                    best_bb_matches = bb_matches
                    best_bb_verdict = "match"

                # DOJ search (with per-name timeout)
                doj_result = None
                doj_verdict = "skipped" if args.bb_only else "pending"

                if doj_client and not args.bb_only:
                    try:
                        doj_result = await asyncio.wait_for(
                            doj_client.search_name_variations(individual),
                            timeout=DOJ_NAME_TIMEOUT,
                        )
                        if doj_result.get("search_successful"):
                            doj_verdict = "searched"
                        else:
                            doj_verdict = "error"
                    except asyncio.TimeoutError:
                        print(f"  TIMEOUT: DOJ search for '{individual}' exceeded {DOJ_NAME_TIMEOUT}s — skipping")
                        doj_verdict = "timeout"
                        # Try to recover browser for next name
                        try:
                            await doj_client.ensure_ready()
                        except Exception:
                            pass
                    except Exception as e:
                        print(f"  ERROR: DOJ search for '{individual}': {e}")
                        doj_verdict = "error"
                        # Try to recover browser
                        try:
                            await doj_client.stop()
                            await asyncio.sleep(2)
                            await doj_client.start()
                        except Exception:
                            doj_client = None  # Give up on DOJ

                # Compute verdict
                if doj_verdict == "searched":
                    verdict_info = assess_combined_verdict(individual, bb_matches, doj_result)
                else:
                    # BB-only or DOJ failed
                    if best_bb_verdict == "match":
                        fallback = "needs_review"
                        verdict_info = {
                            "verdict": fallback,
                            "confidence_score": 0.5,
                            "rationale": f"BB match, DOJ {doj_verdict}",
                            "false_positive_indicators": [],
                        }
                    else:
                        verdict_info = {
                            "verdict": "no_match",
                            "confidence_score": 0.0,
                            "rationale": f"No BB match, DOJ {doj_verdict}",
                            "false_positive_indicators": [],
                        }

                # Keep strongest
                if best_verdict_info is None or verdict_info.get("confidence_score", 0) > best_verdict_info.get("confidence_score", 0):
                    best_verdict_info = verdict_info
                    best_doj_result = doj_result
                    best_doj_verdict = doj_verdict

                await asyncio.sleep(0.3)  # Brief rate limit

            if best_verdict_info is None:
                best_verdict_info = {"verdict": "no_match", "confidence_score": 0, "rationale": "No results", "false_positive_indicators": []}

            # Contextual glance for ambiguous cases
            combined = best_verdict_info["verdict"]
            glance_result = None
            if combined in ("possible_match", "needs_review"):
                try:
                    glance_result = contextual_glance(name, best_bb_matches, best_doj_result)
                except Exception:
                    pass

            # Binary verdict
            binary_verdict = verdict_to_binary(
                combined,
                best_verdict_info.get("confidence_score", 0),
                glance_override=glance_result,
            )

            # Write to Supabase
            if not args.name:  # Skip DB write for --name mode
                for fid in feature_ids:
                    try:
                        xref_data = {
                            "homeowner_name": name,
                            "black_book_status": "match" if best_bb_matches else "no_match",
                            "black_book_matches": json.dumps(best_bb_matches)[:2000] if best_bb_matches else None,
                            "doj_status": best_doj_verdict,
                            "doj_results": json.dumps({
                                "total_results": best_doj_result.get("total_results", 0) if best_doj_result else 0,
                                "confidence": best_doj_result.get("confidence", "none") if best_doj_result else "none",
                                "snippets": best_doj_result.get("snippets", []) if best_doj_result else [],
                            })[:2000] if best_doj_result else None,
                            "combined_verdict": combined,
                            "confidence_score": best_verdict_info.get("confidence_score", 0),
                            "verdict_rationale": best_verdict_info.get("rationale", "")[:500],
                            "binary_verdict": binary_verdict,
                            "false_positive_indicators": json.dumps(best_verdict_info.get("false_positive_indicators", [])),
                            "individuals_searched": json.dumps(individuals),
                            "checked_at": datetime.now(timezone.utc).isoformat(),
                        }
                        upsert_cross_reference(fid, xref_data)

                        # Update features.detective_verdict
                        sb = get_supabase()
                        sb.table("features").update({"detective_verdict": binary_verdict}).eq("id", fid).execute()
                    except Exception as e:
                        print(f"  DB ERROR for feature {fid}: {e}")
                        stats["errors"] += 1

            stats["checked"] += 1
            if binary_verdict == "YES":
                stats["yes"] += 1
            else:
                stats["no"] += 1

            # Progress
            elapsed = time.time() - start_time
            rate = stats["checked"] / elapsed if elapsed > 0 else 0
            remaining = (len(names) - (i + 1)) / rate if rate > 0 else 0
            bb_tag = "BB:match" if best_bb_matches else "BB:none"
            doj_tag = f"DOJ:{best_doj_verdict}"

            print(
                f"[{i+1}/{len(names)}] {binary_verdict:3} "
                f"{bb_tag:10} {doj_tag:14} "
                f"{name[:40]:40} "
                f"({elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining)"
            )

    finally:
        # Cleanup DOJ browser
        if doj_client:
            try:
                await doj_client.stop()
            except Exception:
                pass

    # Summary
    elapsed = time.time() - start_time
    print()
    print("=" * 60)
    print(f"DONE: {stats['checked']} checked, {stats['yes']} YES, {stats['no']} NO, {stats['errors']} errors")
    print(f"Time: {elapsed:.0f}s ({elapsed/60:.1f} min)")
    if stats["checked"] > 0:
        print(f"Rate: {stats['checked']/elapsed:.1f} names/sec")
    print("=" * 60)


def _bb_match_type(bb_matches):
    """Extract best match type from BB matches."""
    if not bb_matches:
        return None
    rank = {"last_first": 4, "full_name": 3, "last_name_only": 2}
    best = None
    best_rank = 0
    for m in bb_matches:
        mt = m.get("match_type", "")
        r = rank.get(mt, 0)
        if r > best_rank:
            best_rank = r
            best = mt
    return best


def main():
    parser = argparse.ArgumentParser(description="Bulk cross-reference unchecked features")
    parser.add_argument("--bb-only", action="store_true", help="Black Book only (no DOJ browser)")
    parser.add_argument("--missing-xref", action="store_true", help="Check features with no cross_references row (post-detective extraction gap)")
    parser.add_argument("--limit", type=int, help="Limit number of names to check")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be checked")
    parser.add_argument("--name", type=str, help="Check a single name")
    args = parser.parse_args()

    asyncio.run(bulk_crossref(args))


if __name__ == "__main__":
    main()
