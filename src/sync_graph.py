#!/usr/bin/env python3
"""
Sync Supabase data to Neo4j knowledge graph.

Usage:
    python3 src/sync_graph.py --full        # Full rebuild (clear + sync all)
    python3 src/sync_graph.py --incremental  # Sync only new features since last run
    python3 src/sync_graph.py --stats        # Print graph statistics

Reads features, issues, cross_references, and dossiers from Supabase,
then builds a graph of people, designers, locations, styles, issues,
authors, and Epstein connections.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from db import get_supabase
from graph_db import (
    get_driver,
    close_driver,
    create_constraints,
    clear_graph,
    get_stats,
    run_write,
)

SYNC_STATE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "graph_sync_state.json"
)

BATCH_SIZE = 50


def normalize_name(name):
    """Normalize a person/designer/author name for graph dedup."""
    if not name:
        return None
    return name.strip().title()


def build_location_key(city, state, country):
    """Build a unique location key from components."""
    parts = [p.strip() for p in (city, state, country) if p and p.strip()]
    return ", ".join(parts) if parts else None


def fetch_all_data():
    """Fetch all needed data from Supabase in 4 queries."""
    sb = get_supabase()

    print("Fetching issues...")
    issues_result = sb.table("issues").select("*").execute()
    issues = {i["id"]: i for i in (issues_result.data or [])}
    print(f"  {len(issues)} issues")

    print("Fetching features...")
    features = []
    offset = 0
    while True:
        batch = sb.table("features").select("*").range(offset, offset + 999).execute()
        features.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
    print(f"  {len(features)} features")

    print("Fetching cross-references...")
    xrefs_all = []
    offset = 0
    while True:
        batch = sb.table("cross_references").select("*").range(offset, offset + 999).execute()
        xrefs_all.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
    xrefs = {x["feature_id"]: x for x in xrefs_all}
    print(f"  {len(xrefs)} cross-references")

    print("Fetching dossiers...")
    dossiers_all = []
    offset = 0
    while True:
        batch = sb.table("dossiers").select("*").range(offset, offset + 999).execute()
        dossiers_all.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
    dossiers = {d["feature_id"]: d for d in dossiers_all}
    print(f"  {len(dossiers)} dossiers")

    return issues, features, xrefs, dossiers


def create_static_nodes():
    """Create static EpsteinSource nodes."""
    run_write(
        'MERGE (s:EpsteinSource {name: "Black Book"}) '
        'MERGE (s2:EpsteinSource {name: "DOJ Library"})'
    )
    print("Created EpsteinSource nodes")


def build_feature_batch(features, issues, xrefs, dossiers):
    """Transform features into batch-ready dicts for graph insertion."""
    batch = []
    for f in features:
        issue = issues.get(f.get("issue_id"))
        if not issue:
            continue

        homeowner = f.get("homeowner_name")
        is_anonymous = not homeowner or homeowner.strip().lower() in (
            "anonymous", "null", "none", ""
        )

        # Anonymous homeowners get unique keys to avoid merging into one node
        if is_anonymous:
            person_name = f"Anonymous (issue:{f.get('issue_id')}:feature:{f['id']})"
            homeowner_display = "Anonymous"
        else:
            person_name = normalize_name(homeowner)
            homeowner_display = person_name

        if not person_name:
            continue

        # Location key
        loc_key = build_location_key(
            f.get("location_city"),
            f.get("location_state"),
            f.get("location_country"),
        )

        # Designer
        designer = normalize_name(f.get("designer_name"))

        # Style
        style = f.get("design_style")
        if style and style.strip().lower() not in ("null", "none", "n/a", "unknown"):
            style = style.strip()
        else:
            style = None

        # Author
        author = normalize_name(f.get("article_author"))

        # Cross-reference data
        xref = xrefs.get(f["id"])
        dossier = dossiers.get(f["id"])

        # Detective verdict and connection strength
        detective_verdict = None
        connection_strength = None
        editor_verdict = None
        bb_match_type = None
        bb_confidence = None
        doj_match = False

        if xref:
            combined = xref.get("editor_override_verdict") or xref.get("combined_verdict")
            binary = xref.get("binary_verdict", "NO")
            detective_verdict = binary
            bb_status = xref.get("black_book_status", "")
            if bb_status and bb_status not in ("no_match", "pending"):
                bb_match_type = bb_status
                bb_confidence = float(xref.get("confidence_score") or 0)
            doj_status = xref.get("doj_status", "")
            if doj_status and doj_status not in ("no_match", "pending", "searched"):
                doj_match = True

        if dossier:
            connection_strength = dossier.get("connection_strength")
            editor_verdict = dossier.get("editor_verdict")

        # Parse aesthetic_profile JSONB
        raw_profile = f.get("aesthetic_profile") or {}
        if isinstance(raw_profile, str):
            try:
                raw_profile = json.loads(raw_profile)
            except (json.JSONDecodeError, TypeError):
                raw_profile = {}
        if not isinstance(raw_profile, dict):
            raw_profile = {}

        # Validate single-select dimensions are strings (LLM may return arrays)
        for dim in ["envelope", "atmosphere", "materiality", "power_status", "cultural_orientation"]:
            val = raw_profile.get(dim)
            if val and not isinstance(val, str):
                raw_profile[dim] = None

        # Validate art_categories is a list of non-empty strings
        art_cats = raw_profile.get("art_collection", [])
        if isinstance(art_cats, list):
            art_cats = [c for c in art_cats if c and isinstance(c, str) and c.lower() not in ("null", "none", "")]
        else:
            art_cats = []

        batch.append({
            "person_name": person_name,
            "homeowner_display": homeowner_display,
            "is_anonymous": is_anonymous,
            "issue_id": issue["id"],
            "issue_month": issue.get("month"),
            "issue_year": issue.get("year"),
            "issue_identifier": issue.get("identifier", f"issue_{issue['id']}"),
            "page_number": f.get("page_number"),
            "designer": designer,
            "loc_key": loc_key,
            "loc_city": f.get("location_city"),
            "loc_state": f.get("location_state"),
            "loc_country": f.get("location_country"),
            "style": style,
            "author": author,
            "article_title": f.get("article_title"),
            "detective_verdict": detective_verdict,
            "connection_strength": connection_strength,
            "editor_verdict": editor_verdict,
            "bb_match_type": bb_match_type,
            "bb_confidence": bb_confidence,
            "doj_match": doj_match,
            "feature_id": f["id"],
            # Aesthetic taxonomy dimensions
            "envelope": raw_profile.get("envelope"),
            "atmosphere": raw_profile.get("atmosphere"),
            "materiality": raw_profile.get("materiality"),
            "power_status": raw_profile.get("power_status"),
            "cultural_orientation": raw_profile.get("cultural_orientation"),
            "art_categories": art_cats,
        })

    return batch


def sync_batch(batch):
    """Sync a batch of features to Neo4j using UNWIND."""
    if not batch:
        return

    cypher = """
    UNWIND $batch AS row

    // Person node
    MERGE (p:Person {name: row.person_name})
    ON CREATE SET
        p.display_name = row.homeowner_display,
        p.is_anonymous = row.is_anonymous,
        p.detective_verdict = row.detective_verdict,
        p.connection_strength = row.connection_strength,
        p.editor_verdict = row.editor_verdict,
        p.feature_count = 1
    ON MATCH SET
        p.feature_count = p.feature_count + 1,
        p.detective_verdict = CASE
            WHEN row.detective_verdict = 'YES' THEN 'YES'
            ELSE p.detective_verdict
        END,
        p.connection_strength = CASE
            WHEN row.connection_strength IS NOT NULL AND (
                p.connection_strength IS NULL OR
                row.connection_strength IN ['HIGH', 'MEDIUM']
            ) THEN row.connection_strength
            ELSE p.connection_strength
        END,
        p.editor_verdict = CASE
            WHEN row.editor_verdict IS NOT NULL THEN row.editor_verdict
            ELSE p.editor_verdict
        END

    // Issue node + FEATURED_IN
    MERGE (i:Issue {issue_id: row.issue_id})
    ON CREATE SET i.month = row.issue_month, i.year = row.issue_year,
                  i.identifier = row.issue_identifier
    MERGE (p)-[fi:FEATURED_IN]->(i)
    ON CREATE SET fi.page_number = row.page_number

    // Designer (conditional)
    FOREACH (_ IN CASE WHEN row.designer IS NOT NULL THEN [1] ELSE [] END |
        MERGE (d:Designer {name: row.designer})
        MERGE (p)-[:HIRED]->(d)
    )

    // Location (conditional)
    FOREACH (_ IN CASE WHEN row.loc_key IS NOT NULL THEN [1] ELSE [] END |
        MERGE (l:Location {key: row.loc_key})
        ON CREATE SET l.city = row.loc_city, l.state = row.loc_state,
                      l.country = row.loc_country
        MERGE (p)-[:LIVES_IN]->(l)
    )

    // Style (conditional)
    FOREACH (_ IN CASE WHEN row.style IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Style {name: row.style})
        MERGE (p)-[:HAS_STYLE]->(s)
    )

    // Author (conditional)
    FOREACH (_ IN CASE WHEN row.author IS NOT NULL THEN [1] ELSE [] END |
        MERGE (a:Author {name: row.author})
        MERGE (p)-[pr:PROFILED_BY]->(a)
        ON CREATE SET pr.article_title = row.article_title
    )

    // Black Book connection (conditional)
    FOREACH (_ IN CASE WHEN row.bb_match_type IS NOT NULL THEN [1] ELSE [] END |
        MERGE (bb:EpsteinSource {name: 'Black Book'})
        MERGE (p)-[ai:APPEARS_IN]->(bb)
        ON CREATE SET ai.match_type = row.bb_match_type,
                      ai.confidence = row.bb_confidence
    )

    // DOJ connection (conditional)
    FOREACH (_ IN CASE WHEN row.doj_match THEN [1] ELSE [] END |
        MERGE (doj:EpsteinSource {name: 'DOJ Library'})
        MERGE (p)-[:APPEARS_IN]->(doj)
    )

    // Aesthetic taxonomy — dimensional Style nodes
    FOREACH (_ IN CASE WHEN row.envelope IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Style {name: row.envelope})
        ON CREATE SET s.dimension = 'envelope'
        MERGE (p)-[:HAS_STYLE {dimension: 'envelope'}]->(s)
    )
    FOREACH (_ IN CASE WHEN row.atmosphere IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Style {name: row.atmosphere})
        ON CREATE SET s.dimension = 'atmosphere'
        MERGE (p)-[:HAS_STYLE {dimension: 'atmosphere'}]->(s)
    )
    FOREACH (_ IN CASE WHEN row.materiality IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Style {name: row.materiality})
        ON CREATE SET s.dimension = 'materiality'
        MERGE (p)-[:HAS_STYLE {dimension: 'materiality'}]->(s)
    )
    FOREACH (_ IN CASE WHEN row.power_status IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Style {name: row.power_status})
        ON CREATE SET s.dimension = 'power_status'
        MERGE (p)-[:HAS_STYLE {dimension: 'power_status'}]->(s)
    )
    FOREACH (_ IN CASE WHEN row.cultural_orientation IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Style {name: row.cultural_orientation})
        ON CREATE SET s.dimension = 'cultural_orientation'
        MERGE (p)-[:HAS_STYLE {dimension: 'cultural_orientation'}]->(s)
    )

    // Art collection — ArtCategory nodes (multi-value)
    FOREACH (art IN row.art_categories |
        MERGE (ac:ArtCategory {name: art})
        MERGE (p)-[:DISPLAYS]->(ac)
    )
    """

    run_write(cypher, {"batch": batch})


def full_sync():
    """Full rebuild: clear graph, create constraints, sync all data."""
    print("=" * 60)
    print("FULL SYNC: Supabase → Neo4j")
    print("=" * 60)

    start = time.time()

    # Fetch all data
    issues, features, xrefs, dossiers = fetch_all_data()

    # Prepare graph
    print("\nClearing graph...")
    clear_graph()

    print("Creating constraints...")
    create_constraints()

    print("Creating static nodes...")
    create_static_nodes()

    # Build and sync batches
    print(f"\nBuilding feature batch ({len(features)} features)...")
    batch = build_feature_batch(features, issues, xrefs, dossiers)
    print(f"  {len(batch)} valid features to sync")

    synced = 0
    for i in range(0, len(batch), BATCH_SIZE):
        chunk = batch[i : i + BATCH_SIZE]
        sync_batch(chunk)
        synced += len(chunk)
        if synced % 200 == 0 or synced == len(batch):
            print(f"  Synced {synced}/{len(batch)} features")

    elapsed = time.time() - start

    # Save sync state
    state = {
        "last_full_sync": datetime.now(timezone.utc).isoformat(),
        "features_synced": synced,
        "elapsed_seconds": round(elapsed, 1),
    }
    os.makedirs(os.path.dirname(SYNC_STATE_PATH), exist_ok=True)
    with open(SYNC_STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)

    # Print stats
    print(f"\nSync complete in {elapsed:.1f}s")
    stats = get_stats()
    print(f"  Nodes: {stats['total_nodes']} ({stats['nodes']})")
    print(f"  Relationships: {stats['total_relationships']} ({stats['relationships']})")


def incremental_sync():
    """Sync only features created since last sync."""
    # Load last sync time
    last_sync = None
    if os.path.exists(SYNC_STATE_PATH):
        with open(SYNC_STATE_PATH) as f:
            state = json.load(f)
        last_sync = state.get("last_full_sync") or state.get("last_incremental_sync")

    if not last_sync:
        print("No previous sync found — running full sync instead")
        return full_sync()

    print(f"Incremental sync (since {last_sync})")

    sb = get_supabase()

    # Fetch new features
    features_result = (
        sb.table("features")
        .select("*")
        .gt("created_at", last_sync)
        .execute()
    )
    features = features_result.data or []

    if not features:
        print("No new features since last sync")
        return

    print(f"  {len(features)} new features")

    # Fetch supporting data
    issues_result = sb.table("issues").select("*").execute()
    issues = {i["id"]: i for i in (issues_result.data or [])}

    xrefs_all = []
    off = 0
    while True:
        batch = sb.table("cross_references").select("*").range(off, off + 999).execute()
        xrefs_all.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        off += 1000
    xrefs = {x["feature_id"]: x for x in xrefs_all}

    dossiers_all = []
    off = 0
    while True:
        batch = sb.table("dossiers").select("*").range(off, off + 999).execute()
        dossiers_all.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        off += 1000
    dossiers = {d["feature_id"]: d for d in dossiers_all}

    # Ensure static nodes exist
    create_static_nodes()

    # Build and sync
    batch = build_feature_batch(features, issues, xrefs, dossiers)
    for i in range(0, len(batch), BATCH_SIZE):
        sync_batch(batch[i : i + BATCH_SIZE])

    # Update sync state
    state = {
        "last_incremental_sync": datetime.now(timezone.utc).isoformat(),
        "last_full_sync": last_sync,
        "features_synced": len(batch),
    }
    with open(SYNC_STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)

    print(f"Synced {len(batch)} new features")
    print_stats()


def export_graph_json(output_path=None):
    """Export the Neo4j graph as a force-graph-compatible JSON file.

    Writes to tools/agent-office/graph.json by default.
    """
    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(__file__), "..", "tools", "agent-office", "graph.json"
        )

    driver = get_driver()
    nodes = []
    links = []
    node_ids = set()

    # Color palette matching web/src/lib/graph-types.ts
    colors = {
        "Person": "#5B8DB8",
        "Designer": "#7EB5D6",
        "Location": "#D4A04A",
        "Style": "#C27C4E",
        "Issue": "#E8C47A",
        "Author": "#A89070",
        "EpsteinSource": "#E05A47",
    }

    def _make_node(labels, props):
        """Build a node dict from Neo4j labels + properties. Returns (node_id, node) or (None, None)."""
        label = labels[0] if labels else "Unknown"
        name = props.get("name") or props.get("key") or str(props.get("issue_id", ""))
        if not name:
            return None, None
        node_id = f"{label}:{name}"
        if node_id in node_ids:
            return node_id, None  # Already added
        display = props.get("display_name") or name
        if display.startswith("Anonymous ("):
            display = "Anonymous"
        node = {
            "id": node_id,
            "label": display,
            "nodeType": label.lower() if label != "EpsteinSource" else "epstein_source",
            "color": colors.get(label, "#888"),
        }
        if props.get("pagerank") is not None:
            node["pagerank"] = round(float(props["pagerank"]), 6)
        if props.get("community_id") is not None:
            node["communityId"] = int(props["community_id"])
        if props.get("detective_verdict"):
            node["detectiveVerdict"] = props["detective_verdict"]
        if props.get("connection_strength"):
            node["connectionStrength"] = props["connection_strength"]
        if props.get("editor_verdict"):
            node["editorVerdict"] = props["editor_verdict"]
        return node_id, node

    with driver.session() as session:
        # Only export the subgraph around xref leads (persons with detective_verdict)
        # This keeps the agent office panel lightweight while Neo4j retains the full graph.
        # Step 1: Get lead persons and their 1-hop neighborhood
        result = session.run(
            "MATCH (p:Person) WHERE p.connection_strength IS NOT NULL "
            "OPTIONAL MATCH (p)-[r]-(neighbor) "
            "RETURN labels(p) AS labels, properties(p) AS props, "
            "       collect(DISTINCT {labels: labels(neighbor), props: properties(neighbor)}) AS neighbors, "
            "       collect(DISTINCT {a_label: labels(startNode(r))[0], a_props: properties(startNode(r)), "
            "                         rel_type: type(r), "
            "                         b_label: labels(endNode(r))[0], b_props: properties(endNode(r))}) AS rels"
        )
        for record in result:
            # Add the lead person
            nid, node = _make_node(record["labels"], dict(record["props"]))
            if nid and node:
                node_ids.add(nid)
                nodes.append(node)

            # Add neighbors
            for nb in record["neighbors"]:
                if not nb["labels"]:
                    continue
                nb_id, nb_node = _make_node(nb["labels"], dict(nb["props"]))
                if nb_id and nb_node:
                    node_ids.add(nb_id)
                    nodes.append(nb_node)

            # Add relationships
            for rel in record["rels"]:
                a_name = rel["a_props"].get("name") or rel["a_props"].get("key") or str(rel["a_props"].get("issue_id", ""))
                b_name = rel["b_props"].get("name") or rel["b_props"].get("key") or str(rel["b_props"].get("issue_id", ""))
                if not a_name or not b_name:
                    continue
                source = f"{rel['a_label']}:{a_name}"
                target = f"{rel['b_label']}:{b_name}"
                if source in node_ids and target in node_ids:
                    links.append({
                        "source": source,
                        "target": target,
                        "relType": rel["rel_type"],
                    })

    # Deduplicate links (multiple lead persons can share neighbors)
    seen_links = set()
    unique_links = []
    for link in links:
        key = (link["source"], link["target"], link["relType"])
        if key not in seen_links:
            seen_links.add(key)
            unique_links.append(link)

    graph_data = {
        "nodes": nodes,
        "links": unique_links,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(graph_data, f)

    print(f"Exported graph JSON: {len(nodes)} nodes, {len(links)} links → {output_path}")
    return output_path


def print_stats():
    """Print graph statistics."""
    stats = get_stats()
    print("\nNeo4j Graph Statistics")
    print("=" * 40)
    print(f"Total nodes: {stats['total_nodes']}")
    for label, count in sorted(stats["nodes"].items()):
        print(f"  {label}: {count}")
    print(f"\nTotal relationships: {stats['total_relationships']}")
    for rtype, count in sorted(stats["relationships"].items()):
        print(f"  {rtype}: {count}")


def main():
    parser = argparse.ArgumentParser(description="Sync Supabase → Neo4j knowledge graph")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--full", action="store_true", help="Full rebuild")
    group.add_argument("--incremental", action="store_true", help="Sync new features only")
    group.add_argument("--stats", action="store_true", help="Print graph statistics")
    group.add_argument("--export", action="store_true", help="Export graph as JSON for agent-office")

    args = parser.parse_args()

    try:
        if args.full:
            full_sync()
            export_graph_json()  # Auto-export after full sync
        elif args.incremental:
            incremental_sync()
            export_graph_json()  # Auto-export after incremental sync
        elif args.stats:
            print_stats()
        elif args.export:
            export_graph_json()
    finally:
        close_driver()


if __name__ == "__main__":
    main()
