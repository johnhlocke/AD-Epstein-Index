#!/usr/bin/env python3
"""
Graph analytics engine — NetworkX-powered structural analysis on top of Neo4j.

Pulls the knowledge graph from Neo4j into NetworkX, runs community detection,
centrality metrics, similarity analysis, and path finding, then writes
results back as node properties.

Usage:
    python3 src/graph_analytics.py --run          # Full analytics pipeline
    python3 src/graph_analytics.py --report       # Print analytics summary
    python3 src/graph_analytics.py --person "Name" # Analytics for one person

Designed for Elena (Researcher) to call during investigations.
"""

import argparse
import json
import os
import sys
import time

import networkx as nx

sys.path.insert(0, os.path.dirname(__file__))

from graph_db import get_driver, close_driver, run_write, get_stats

ANALYTICS_CACHE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "graph_analytics_cache.json"
)


# ── Load Graph from Neo4j ─────────────────────────────────────


def load_graph_from_neo4j():
    """Pull the full graph from Neo4j into a NetworkX MultiGraph.

    Nodes carry all Neo4j properties. Edges carry relationship type.
    Returns (G, person_nodes) where person_nodes is a set of Person node names.
    """
    driver = get_driver()
    G = nx.Graph()  # Undirected — relationships are bidirectional for analytics
    person_nodes = set()

    with driver.session() as session:
        # Load all nodes
        result = session.run(
            "MATCH (n) RETURN labels(n) AS labels, properties(n) AS props"
        )
        for record in result:
            labels = record["labels"]
            props = dict(record["props"])
            label = labels[0] if labels else "Unknown"
            name = props.get("name") or props.get("key") or props.get("issue_id")
            if not name:
                continue

            node_id = f"{label}:{name}"
            props["_label"] = label
            props["_node_id"] = node_id
            G.add_node(node_id, **props)

            if label == "Person":
                person_nodes.add(node_id)

        # Load all relationships
        result = session.run(
            "MATCH (a)-[r]->(b) "
            "RETURN labels(a)[0] AS a_label, properties(a) AS a_props, "
            "       type(r) AS rel_type, properties(r) AS r_props, "
            "       labels(b)[0] AS b_label, properties(b) AS b_props"
        )
        for record in result:
            a_name = record["a_props"].get("name") or record["a_props"].get("key") or record["a_props"].get("issue_id")
            b_name = record["b_props"].get("name") or record["b_props"].get("key") or record["b_props"].get("issue_id")
            if not a_name or not b_name:
                continue

            a_id = f"{record['a_label']}:{a_name}"
            b_id = f"{record['b_label']}:{b_name}"
            rel_type = record["rel_type"]

            G.add_edge(a_id, b_id, rel_type=rel_type, **dict(record["r_props"]))

    print(f"Loaded graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    print(f"  Person nodes: {len(person_nodes)}")
    return G, person_nodes


# ── Community Detection ───────────────────────────────────────


def detect_communities(G):
    """Run Louvain community detection. Returns dict {node_id: community_id}."""
    import community as community_louvain

    # Only run on connected components with > 1 node
    partition = community_louvain.best_partition(G, random_state=42)
    n_communities = len(set(partition.values()))
    print(f"  Detected {n_communities} communities")
    return partition


# ── Centrality Metrics ────────────────────────────────────────


def compute_centrality(G, person_nodes):
    """Compute PageRank, betweenness, and degree centrality.

    Returns dict {node_id: {pagerank, betweenness, degree_centrality, clustering}}.
    """
    print("  Computing PageRank...")
    pagerank = nx.pagerank(G, alpha=0.85, max_iter=100)

    print("  Computing betweenness centrality...")
    betweenness = nx.betweenness_centrality(G)

    print("  Computing degree centrality...")
    degree_cent = nx.degree_centrality(G)

    print("  Computing clustering coefficients...")
    clustering = nx.clustering(G)

    metrics = {}
    for node in G.nodes():
        metrics[node] = {
            "pagerank": round(pagerank.get(node, 0), 6),
            "betweenness": round(betweenness.get(node, 0), 6),
            "degree_centrality": round(degree_cent.get(node, 0), 6),
            "clustering": round(clustering.get(node, 0), 4),
            "degree": G.degree(node),
        }

    # Report top people by each metric
    person_metrics = {k: v for k, v in metrics.items() if k in person_nodes}
    if person_metrics:
        top_pr = sorted(person_metrics.items(), key=lambda x: x[1]["pagerank"], reverse=True)[:5]
        top_bw = sorted(person_metrics.items(), key=lambda x: x[1]["betweenness"], reverse=True)[:5]
        print(f"  Top PageRank: {', '.join(n.split(':',1)[1] for n, _ in top_pr)}")
        print(f"  Top Betweenness: {', '.join(n.split(':',1)[1] for n, _ in top_bw)}")

    return metrics


# ── Similarity Analysis ──────────────────────────────────────


def compute_person_similarity(G, person_nodes, top_n=10):
    """Compute Jaccard similarity between Person nodes based on shared neighbors.

    Returns dict {(person_a, person_b): jaccard_score} for top pairs.
    """
    person_list = sorted(person_nodes)
    pairs = []

    for i, a in enumerate(person_list):
        neighbors_a = set(G.neighbors(a))
        if not neighbors_a:
            continue
        for b in person_list[i + 1:]:
            neighbors_b = set(G.neighbors(b))
            if not neighbors_b:
                continue
            intersection = neighbors_a & neighbors_b
            union = neighbors_a | neighbors_b
            if union:
                jaccard = len(intersection) / len(union)
                if jaccard > 0:
                    pairs.append((a, b, jaccard, sorted(intersection)))

    pairs.sort(key=lambda x: x[2], reverse=True)
    top_pairs = pairs[:top_n]

    if top_pairs:
        print(f"  Top similar pairs:")
        for a, b, score, shared in top_pairs[:5]:
            a_name = a.split(":", 1)[1]
            b_name = b.split(":", 1)[1]
            shared_names = [s.split(":", 1)[1] for s in shared[:3]]
            print(f"    {a_name} <-> {b_name}: {score:.3f} (shared: {', '.join(shared_names)})")

    return {(a, b): {"score": score, "shared": shared} for a, b, score, shared in top_pairs}


# ── Path Finding ──────────────────────────────────────────────


def find_all_paths(G, source_name, target_name, max_depth=4):
    """Find all simple paths between two person names (up to max_depth hops).

    Args:
        G: NetworkX graph
        source_name: Display name (e.g., "Kelly Ripa And Mark Consuelos")
        target_name: Display name
        max_depth: Maximum path length

    Returns:
        List of paths, each path is a list of node_ids.
    """
    # Find node IDs by name (case-insensitive search)
    source_id = _find_person_node(G, source_name)
    target_id = _find_person_node(G, target_name)

    if not source_id or not target_id:
        return []

    try:
        paths = list(nx.all_simple_paths(G, source_id, target_id, cutoff=max_depth))
        return paths
    except (nx.NetworkXError, nx.NodeNotFound):
        return []


def _find_person_node(G, name):
    """Find a Person node by name (case-insensitive)."""
    name_lower = name.strip().lower()
    for node in G.nodes():
        if node.startswith("Person:"):
            node_name = node.split(":", 1)[1].lower()
            if node_name == name_lower:
                return node
            # Fuzzy: check if name is contained
            if name_lower in node_name or node_name in name_lower:
                return node
    return None


# ── Person Context (for Elena) ────────────────────────────────


def get_person_context(G, person_nodes, name, communities, centrality, similarity):
    """Build a comprehensive analytics context for one person.

    This is what Elena calls during investigation — gives her structural
    intelligence about where this person sits in the network.

    Returns a dict with community info, centrality, neighbors, similar people, etc.
    """
    node_id = _find_person_node(G, name)
    if not node_id:
        return {"error": f"Person '{name}' not found in graph"}

    node_data = G.nodes[node_id]
    metrics = centrality.get(node_id, {})
    community_id = communities.get(node_id)

    # Neighbors by type
    neighbors = {"designers": [], "locations": [], "styles": [], "issues": [], "authors": [], "epstein_sources": [], "persons": []}
    for neighbor in G.neighbors(node_id):
        label = G.nodes[neighbor].get("_label", "Unknown")
        neighbor_name = neighbor.split(":", 1)[1] if ":" in neighbor else neighbor
        edge_data = G.edges[node_id, neighbor]
        rel_type = edge_data.get("rel_type", "UNKNOWN")

        bucket = {
            "Designer": "designers",
            "Location": "locations",
            "Style": "styles",
            "Issue": "issues",
            "Author": "authors",
            "EpsteinSource": "epstein_sources",
            "Person": "persons",
        }.get(label, "persons")
        neighbors[bucket].append({"name": neighbor_name, "rel_type": rel_type})

    # Community members (other people in the same community)
    community_members = []
    if community_id is not None:
        for other_node, other_comm in communities.items():
            if other_comm == community_id and other_node != node_id and other_node in person_nodes:
                other_name = other_node.split(":", 1)[1]
                other_metrics = centrality.get(other_node, {})
                other_data = G.nodes.get(other_node, {})
                community_members.append({
                    "name": other_name,
                    "detective_verdict": other_data.get("detective_verdict"),
                    "pagerank": other_metrics.get("pagerank", 0),
                })
        community_members.sort(key=lambda x: x["pagerank"], reverse=True)

    # Similar people (by Jaccard)
    similar = []
    for (a, b), data in similarity.items():
        other = None
        if a == node_id:
            other = b
        elif b == node_id:
            other = a
        if other:
            other_name = other.split(":", 1)[1]
            other_data = G.nodes.get(other, {})
            shared_names = [s.split(":", 1)[1] for s in data["shared"]]
            similar.append({
                "name": other_name,
                "jaccard_score": data["score"],
                "shared_connections": shared_names,
                "detective_verdict": other_data.get("detective_verdict"),
            })
    similar.sort(key=lambda x: x["jaccard_score"], reverse=True)

    # Epstein proximity: shortest path to any Epstein-linked person
    epstein_proximity = None
    for other_node in person_nodes:
        if other_node == node_id:
            continue
        other_data = G.nodes.get(other_node, {})
        if other_data.get("detective_verdict") == "YES":
            try:
                path = nx.shortest_path(G, node_id, other_node)
                path_names = [n.split(":", 1)[1] for n in path]
                hops = len(path) - 1
                if epstein_proximity is None or hops < epstein_proximity["hops"]:
                    epstein_proximity = {
                        "target": other_node.split(":", 1)[1],
                        "hops": hops,
                        "path": path_names,
                    }
            except nx.NetworkXNoPath:
                continue

    # Count flagged people in same community
    flagged_in_community = sum(
        1 for m in community_members
        if m.get("detective_verdict") == "YES"
    )

    return {
        "name": name,
        "node_id": node_id,
        "detective_verdict": node_data.get("detective_verdict"),
        "connection_strength": node_data.get("connection_strength"),
        # Centrality
        "pagerank": metrics.get("pagerank", 0),
        "pagerank_percentile": _percentile(metrics.get("pagerank", 0), centrality, "pagerank", person_nodes),
        "betweenness": metrics.get("betweenness", 0),
        "betweenness_percentile": _percentile(metrics.get("betweenness", 0), centrality, "betweenness", person_nodes),
        "degree": metrics.get("degree", 0),
        "clustering_coefficient": metrics.get("clustering", 0),
        # Community
        "community_id": community_id,
        "community_size": len(community_members) + 1,
        "community_members": community_members[:10],
        "flagged_in_community": flagged_in_community,
        # Neighbors
        "designers": neighbors["designers"],
        "locations": neighbors["locations"],
        "styles": neighbors["styles"],
        "epstein_sources": neighbors["epstein_sources"],
        # Structural
        "similar_persons": similar[:5],
        "epstein_proximity": epstein_proximity,
    }


def _percentile(value, centrality, metric, person_nodes):
    """Compute percentile rank among person nodes."""
    person_values = sorted(
        centrality[n].get(metric, 0) for n in person_nodes if n in centrality
    )
    if not person_values:
        return 0
    rank = sum(1 for v in person_values if v <= value)
    return round(rank / len(person_values) * 100, 1)


# ── Write Back to Neo4j ──────────────────────────────────────


def write_analytics_to_neo4j(communities, centrality):
    """Write community IDs and centrality scores back to Neo4j as node properties."""
    print("Writing analytics to Neo4j...")

    # Build batch of updates
    batch = []
    for node_id, community_id in communities.items():
        if ":" not in node_id:
            continue
        label, name = node_id.split(":", 1)
        metrics = centrality.get(node_id, {})
        batch.append({
            "label": label,
            "name": name,
            "community_id": community_id,
            "pagerank": metrics.get("pagerank", 0),
            "betweenness": metrics.get("betweenness", 0),
            "degree_centrality": metrics.get("degree_centrality", 0),
            "clustering": metrics.get("clustering", 0),
        })

    # Write in batches using UNWIND
    BATCH_SIZE = 50
    written = 0
    for i in range(0, len(batch), BATCH_SIZE):
        chunk = batch[i:i + BATCH_SIZE]

        # Group by label for efficient MATCH
        by_label = {}
        for item in chunk:
            by_label.setdefault(item["label"], []).append(item)

        for label, items in by_label.items():
            key_prop = "name" if label != "Location" else "key"
            cypher = f"""
            UNWIND $items AS row
            MATCH (n:{label} {{{key_prop}: row.name}})
            SET n.community_id = row.community_id,
                n.pagerank = row.pagerank,
                n.betweenness = row.betweenness,
                n.degree_centrality = row.degree_centrality,
                n.clustering = row.clustering
            """
            run_write(cypher, {"items": items})

        written += len(chunk)

    print(f"  Updated {written} nodes with analytics properties")


# ── Cache ─────────────────────────────────────────────────────


def save_cache(communities, centrality, similarity):
    """Cache analytics results to disk for fast lookups."""
    cache = {
        "timestamp": time.time(),
        "communities": communities,
        "centrality": centrality,
        "similarity": {f"{a}||{b}": v for (a, b), v in similarity.items()},
    }
    os.makedirs(os.path.dirname(ANALYTICS_CACHE_PATH), exist_ok=True)
    with open(ANALYTICS_CACHE_PATH, "w") as f:
        json.dump(cache, f)
    print(f"  Cached analytics to {ANALYTICS_CACHE_PATH}")


def invalidate_cache():
    """Delete the analytics cache, forcing a fresh recompute on next access."""
    if os.path.exists(ANALYTICS_CACHE_PATH):
        os.remove(ANALYTICS_CACHE_PATH)


def load_cache():
    """Load cached analytics. Returns (communities, centrality, similarity) or None."""
    if not os.path.exists(ANALYTICS_CACHE_PATH):
        return None
    try:
        with open(ANALYTICS_CACHE_PATH) as f:
            cache = json.load(f)
        age_min = (time.time() - cache.get("timestamp", 0)) / 60
        if age_min > 60:  # Stale after 1 hour
            return None
        similarity = {}
        for key, val in cache.get("similarity", {}).items():
            parts = key.split("||")
            if len(parts) == 2:
                similarity[(parts[0], parts[1])] = val
        return cache["communities"], cache["centrality"], similarity
    except Exception:
        return None


# ── Full Pipeline ─────────────────────────────────────────────


def run_analytics():
    """Run the full analytics pipeline: load → analyze → write back → cache."""
    print("=" * 60)
    print("GRAPH ANALYTICS PIPELINE")
    print("=" * 60)

    start = time.time()

    # Load
    G, person_nodes = load_graph_from_neo4j()
    if G.number_of_nodes() == 0:
        print("Graph is empty — run sync_graph.py first")
        return None, None, None

    # Analyze
    print("\nCommunity detection...")
    communities = detect_communities(G)

    print("\nCentrality metrics...")
    centrality = compute_centrality(G, person_nodes)

    print("\nSimilarity analysis...")
    similarity = compute_person_similarity(G, person_nodes)

    # Write back
    print()
    write_analytics_to_neo4j(communities, centrality)

    # Cache
    save_cache(communities, centrality, similarity)

    elapsed = time.time() - start
    print(f"\nAnalytics complete in {elapsed:.1f}s")

    return communities, centrality, similarity


def get_person_analytics(name):
    """Get analytics for a single person. Uses cache if fresh, otherwise runs pipeline.

    This is the main entry point for Elena's investigation code.
    """
    # Try cache first
    cached = load_cache()
    if cached:
        communities, centrality, similarity = cached
        G, person_nodes = load_graph_from_neo4j()
        return get_person_context(G, person_nodes, name, communities, centrality, similarity)

    # Run full pipeline
    communities, centrality, similarity = run_analytics()
    if communities is None:
        return {"error": "Graph is empty"}

    G, person_nodes = load_graph_from_neo4j()
    return get_person_context(G, person_nodes, name, communities, centrality, similarity)


def update_person_verdict(name, editor_verdict):
    """Update a Person node's editor_verdict in Neo4j.

    Called by the Editor after confirming/rejecting a dossier so the graph
    reflects the new verdict immediately.
    """
    try:
        run_write(
            "MATCH (p:Person {name: $name}) SET p.editor_verdict = $verdict",
            {"name": name.strip().title(), "verdict": editor_verdict},
        )
    except Exception:
        pass  # Graph unavailable — not critical


def recompute_after_verdict():
    """Invalidate cache and recompute analytics after a verdict change.

    This makes Elena's confirmed findings ripple through the network:
    community metrics shift, proximity calculations change for everyone nearby.
    Runs the full pipeline (typically 2-5 seconds).
    """
    invalidate_cache()
    try:
        run_analytics()
    except Exception:
        pass  # Graph unavailable — analytics will recompute on next access


# ── Report ────────────────────────────────────────────────────


def print_report():
    """Print a summary of graph analytics."""
    G, person_nodes = load_graph_from_neo4j()
    if G.number_of_nodes() == 0:
        print("Graph is empty")
        return

    communities = detect_communities(G)
    centrality = compute_centrality(G, person_nodes)

    # Community report
    comm_sizes = {}
    for node, comm in communities.items():
        comm_sizes[comm] = comm_sizes.get(comm, 0) + 1

    print(f"\n{'='*60}")
    print("ANALYTICS REPORT")
    print(f"{'='*60}")
    print(f"Nodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}")
    print(f"Person nodes: {len(person_nodes)}")
    print(f"Communities: {len(comm_sizes)}")
    print(f"  Sizes: {sorted(comm_sizes.values(), reverse=True)}")

    # Top people by centrality
    person_metrics = {k: v for k, v in centrality.items() if k in person_nodes}
    if person_metrics:
        print(f"\nTop 10 by PageRank:")
        for node, m in sorted(person_metrics.items(), key=lambda x: x[1]["pagerank"], reverse=True)[:10]:
            name = node.split(":", 1)[1]
            data = G.nodes[node]
            verdict = data.get("detective_verdict", "")
            flag = " [FLAGGED]" if verdict == "YES" else ""
            print(f"  {name}: PR={m['pagerank']:.4f} BW={m['betweenness']:.4f} deg={m['degree']}{flag}")

        print(f"\nTop 10 by Betweenness (bridge people):")
        for node, m in sorted(person_metrics.items(), key=lambda x: x[1]["betweenness"], reverse=True)[:10]:
            name = node.split(":", 1)[1]
            data = G.nodes[node]
            verdict = data.get("detective_verdict", "")
            flag = " [FLAGGED]" if verdict == "YES" else ""
            print(f"  {name}: BW={m['betweenness']:.4f} PR={m['pagerank']:.4f} deg={m['degree']}{flag}")


# ── CLI ───────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Graph analytics engine")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--run", action="store_true", help="Run full analytics pipeline")
    group.add_argument("--report", action="store_true", help="Print analytics summary")
    group.add_argument("--person", type=str, help="Analytics for one person")

    args = parser.parse_args()

    try:
        if args.run:
            run_analytics()
        elif args.report:
            print_report()
        elif args.person:
            context = get_person_analytics(args.person)
            print(json.dumps(context, indent=2, default=str))
    finally:
        close_driver()


if __name__ == "__main__":
    main()
