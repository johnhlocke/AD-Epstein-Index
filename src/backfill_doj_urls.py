#!/usr/bin/env python3
"""
Backfill DOJ PDF URLs into dossiers.doj_documents column.

For each dossier:
1. Look up cross_references.doj_results.top_results for the feature
2. Extract full justice.gov PDF URLs with filenames and snippets
3. Write to dossiers.doj_documents JSONB column
4. Also enrich epstein_connections entries with document_urls where EFTA IDs match

Usage:
    python3 src/backfill_doj_urls.py              # Backfill all dossiers
    python3 src/backfill_doj_urls.py --dry-run     # Preview without writing
    python3 src/backfill_doj_urls.py --id 283      # Single dossier
    python3 src/backfill_doj_urls.py --confirmed   # Only confirmed dossiers
"""

import argparse
import json
import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from db import get_supabase

# Pattern to find EFTA document IDs in text
EFTA_PATTERN = re.compile(r'(EFTA\d{8,11})(?:\.pdf)?', re.IGNORECASE)


def get_xref_data(sb, feature_id: int) -> dict:
    """Get cross_reference data for a feature.

    Returns {url_map, bb_status, bb_matches, doj_total, doj_confidence, top_results}
    """
    r = sb.table("cross_references").select(
        "doj_results, black_book_status, black_book_matches, "
        "binary_verdict, combined_verdict"
    ).eq("feature_id", feature_id).limit(1).execute()

    if not r.data:
        return {"url_map": {}, "top_results": []}

    xref = r.data[0]

    # Parse DOJ results
    doj = xref.get("doj_results")
    if isinstance(doj, str):
        doj = json.loads(doj)
    doj = doj or {}

    top_results = doj.get("top_results", [])
    url_map = {}
    for entry in top_results:
        filename = entry.get("filename", "").strip()
        url = entry.get("url", "").strip()
        snippet = entry.get("snippet", "").strip()
        if filename and url:
            key = filename.replace(".pdf", "").upper()
            url_map[key] = {
                "url": url,
                "filename": filename,
                "snippet": snippet[:300] if snippet else "",
            }

    return {
        "url_map": url_map,
        "top_results": top_results,
        "bb_status": xref.get("black_book_status"),
        "bb_matches": xref.get("black_book_matches"),
        "doj_total": doj.get("total_results", 0),
        "doj_confidence": doj.get("confidence"),
        "binary_verdict": xref.get("binary_verdict"),
        "combined_verdict": xref.get("combined_verdict"),
    }


def extract_efta_ids(text: str) -> list[str]:
    """Extract EFTA document IDs from text."""
    if not text:
        return []
    return [m.upper() for m in EFTA_PATTERN.findall(text)]


def enrich_existing_connections(connections: list, url_map: dict) -> list:
    """Add document_urls to each existing epstein_connections entry."""
    for conn in connections:
        context_text = conn.get("context", "") or ""
        evidence_text = conn.get("evidence", "") or ""
        combined_text = f"{context_text} {evidence_text}"

        efta_ids = extract_efta_ids(combined_text)

        # Match against URL map
        doc_urls = []
        seen = set()
        for efta_id in efta_ids:
            if efta_id in url_map and efta_id not in seen:
                doc_urls.append(url_map[efta_id]["url"])
                seen.add(efta_id)

        # Also try to match any URLs not yet assigned
        # (some connections mention docs by description, not ID)
        conn["document_urls"] = doc_urls

    return connections


def build_connections_from_xref(xref_data: dict, dossier: dict) -> list:
    """Build epstein_connections entries from raw xref data.

    Used when the dossier has empty epstein_connections.
    Creates structured entries from DOJ top_results and BB matches.
    """
    connections = []
    url_map = xref_data["url_map"]
    top_results = xref_data["top_results"]

    # Add DOJ document entries
    if top_results:
        # Group snippets into a single DOJ connection entry with all URLs
        doj_urls = []
        doj_snippets = []
        for entry in top_results:
            url = entry.get("url", "").strip()
            snippet = entry.get("snippet", "").strip()
            filename = entry.get("filename", "").strip()
            if url:
                doj_urls.append(url)
            if snippet:
                # Clean up snippet — remove filename prefix if present
                clean = snippet
                if filename and clean.startswith(filename):
                    clean = clean[len(filename):].lstrip(" -\n")
                doj_snippets.append(clean[:200])

        if doj_urls:
            # Use editor_reasoning to provide context about what these docs show
            editor_reasoning = dossier.get("editor_reasoning", "") or ""
            context_summary = editor_reasoning[:500] if editor_reasoning else "DOJ search results for this individual"

            connections.append({
                "source": "doj_library",
                "match_type": "search_results",
                "evidence": f"{xref_data['doj_total']} DOJ documents found (confidence: {xref_data['doj_confidence'] or 'unknown'})",
                "context": context_summary,
                "document_urls": doj_urls,
                "snippets": doj_snippets[:5],  # Top 5 snippets for context
            })

    # Add BB match entry if present
    bb_status = xref_data.get("bb_status")
    bb_matches = xref_data.get("bb_matches")
    if bb_status and bb_status != "no_match" and bb_matches:
        if isinstance(bb_matches, str):
            try:
                bb_matches = json.loads(bb_matches)
            except (json.JSONDecodeError, TypeError):
                bb_matches = [{"raw": bb_matches}]

        bb_context = ""
        if isinstance(bb_matches, list):
            for m in bb_matches[:3]:
                if isinstance(m, dict):
                    bb_context += f"{m.get('name', '')} — {m.get('context', '')}\n"
                else:
                    bb_context += str(m) + "\n"

        connections.append({
            "source": "black_book",
            "match_type": bb_status.replace("match(", "").replace(")", "") if "(" in str(bb_status) else str(bb_status),
            "evidence": f"Black Book match: {bb_status}",
            "context": bb_context.strip() or "Black Book entry found",
            "document_urls": [],
        })

    return connections


def backfill_dossier(sb, dossier: dict, xref_data: dict, dry_run: bool = False) -> dict:
    """Backfill a single dossier with DOJ URLs."""
    did = dossier["id"]
    name = dossier["subject_name"]
    verdict = dossier["editor_verdict"] or "PENDING"
    url_map = xref_data["url_map"]
    top_results = xref_data["top_results"]

    # ── Build doj_documents array (the new dedicated column) ──
    doj_documents = []
    seen_urls = set()
    for entry in top_results:
        url = entry.get("url", "").strip()
        filename = entry.get("filename", "").strip()
        snippet = entry.get("snippet", "").strip()
        if url and url not in seen_urls:
            doj_documents.append({
                "filename": filename,
                "url": url,
                "snippet": snippet[:300] if snippet else "",
            })
            seen_urls.add(url)

    # ── Enrich epstein_connections with inline document_urls ──
    connections = dossier.get("epstein_connections") or []
    if isinstance(connections, str):
        connections = json.loads(connections)

    had_connections = bool(connections)
    connections_changed = False

    if connections:
        connections = enrich_existing_connections(connections, url_map)

        # Add remaining unmatched URLs as supplementary entry
        used_urls = set()
        for c in connections:
            used_urls.update(c.get("document_urls", []))

        remaining_urls = [
            entry["url"] for entry in url_map.values()
            if entry["url"] not in used_urls
        ]
        if remaining_urls:
            connections.append({
                "source": "doj_library",
                "match_type": "additional_documents",
                "evidence": f"{len(remaining_urls)} additional DOJ documents from search",
                "context": "Additional documents found in DOJ search not cited in primary analysis",
                "document_urls": remaining_urls,
            })
        connections_changed = True
    else:
        # Build connections from scratch using xref data
        connections = build_connections_from_xref(xref_data, dossier)
        connections_changed = bool(connections)

    summary = {
        "id": did,
        "name": name,
        "verdict": verdict,
        "had_connections": had_connections,
        "connections_count": len(connections),
        "doj_doc_count": len(doj_documents),
        "doj_docs_available": len(url_map),
    }

    if not dry_run:
        update = {}
        if doj_documents:
            update["doj_documents"] = doj_documents
        if connections_changed and connections:
            update["epstein_connections"] = connections
        if update:
            sb.table("dossiers").update(update).eq("id", did).execute()

    return summary


def main():
    parser = argparse.ArgumentParser(description="Backfill DOJ PDF URLs into dossiers")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--id", type=int, help="Single dossier ID")
    parser.add_argument("--confirmed", action="store_true", help="Only confirmed dossiers")
    args = parser.parse_args()

    sb = get_supabase()

    # Fetch dossiers
    query = sb.table("dossiers").select(
        "id, subject_name, editor_verdict, feature_id, "
        "epstein_connections, editor_reasoning, strength_rationale, key_findings"
    )

    if args.id:
        query = query.eq("id", args.id)
    elif args.confirmed:
        query = query.eq("editor_verdict", "CONFIRMED")

    result = query.order("id").execute()
    dossiers = result.data or []

    print(f"Backfilling DOJ URLs for {len(dossiers)} dossiers{'  (DRY RUN)' if args.dry_run else ''}")
    print("=" * 70)

    stats = {
        "total": 0, "enriched_existing": 0, "built_new": 0,
        "no_xref_data": 0, "total_doj_docs": 0,
    }

    for d in dossiers:
        stats["total"] += 1
        feature_id = d["feature_id"]

        # Get xref data (DOJ URLs + BB matches)
        xref_data = get_xref_data(sb, feature_id)
        url_map = xref_data["url_map"]

        if not url_map and not xref_data.get("bb_status"):
            stats["no_xref_data"] += 1
            verdict_tag = d["editor_verdict"] or "PENDING"
            print(f"  [{verdict_tag:10s}] {d['subject_name']:40s} — no xref data")
            continue

        summary = backfill_dossier(sb, d, xref_data, dry_run=args.dry_run)

        if summary["had_connections"]:
            stats["enriched_existing"] += 1
            action = "enriched"
        else:
            stats["built_new"] += 1
            action = "built"

        stats["total_doj_docs"] += summary["doj_doc_count"]

        verdict_tag = summary["verdict"]
        name = summary["name"]
        n_conns = summary["connections_count"]
        n_docs = summary["doj_doc_count"]
        n_avail = summary["doj_docs_available"]

        print(f"  [{verdict_tag:10s}] {name:40s} — {action}: {n_conns} conns, {n_docs} DOJ docs")

    print("=" * 70)
    print(f"Total dossiers: {stats['total']}")
    print(f"Enriched existing connections: {stats['enriched_existing']}")
    print(f"Built new connections from xref: {stats['built_new']}")
    print(f"No xref data: {stats['no_xref_data']}")
    print(f"Total DOJ documents linked: {stats['total_doj_docs']}")
    if args.dry_run:
        print("\n(DRY RUN — no changes written)")


if __name__ == "__main__":
    main()
