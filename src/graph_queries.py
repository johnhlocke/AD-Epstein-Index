"""
Ad-hoc investigative graph queries for the Researcher agent.

Unlike graph_analytics.py (pre-computed, cached), these run live Cypher
queries against Neo4j for real-time investigation. Elena calls these
mid-dossier to pull threads as they emerge.

All functions return structured dicts, never raw Neo4j records.
All fail gracefully (return empty results) if Neo4j is unavailable.
"""

from graph_db import run_query


def _safe_query(cypher, params=None):
    """Run a Cypher query, returning [] on any failure."""
    try:
        return run_query(cypher, params or {})
    except Exception:
        return []


# ═══════════════════════════════════════════════════════════════
# STRUCTURAL QUERIES — "Who connects to whom?"
# ═══════════════════════════════════════════════════════════════

def shared_designers(name):
    """Who else hired the same designer(s) as this person?

    Returns list of {person, designer, issue_year, verdict}.
    """
    records = _safe_query("""
        MATCH (p:Person {name: $name})-[:HIRED]->(d:Designer)<-[:HIRED]-(other:Person)
        WHERE other.name <> $name
        OPTIONAL MATCH (other)-[:FEATURED_IN]->(i:Issue)
        RETURN DISTINCT other.name AS person,
               d.name AS designer,
               other.detective_verdict AS verdict,
               other.editor_verdict AS editor_verdict,
               collect(DISTINCT i.year) AS years
        ORDER BY other.detective_verdict DESC, other.name
    """, {"name": name})
    return records


def shared_locations(name):
    """Who else lives in / is associated with the same location(s)?

    Returns list of {person, location, verdict}.
    """
    records = _safe_query("""
        MATCH (p:Person {name: $name})-[:LIVES_IN]->(l:Location)<-[:LIVES_IN]-(other:Person)
        WHERE other.name <> $name
        RETURN DISTINCT other.name AS person,
               l.key AS location,
               other.detective_verdict AS verdict,
               other.editor_verdict AS editor_verdict
        ORDER BY other.detective_verdict DESC, other.name
    """, {"name": name})
    return records


def shared_issues(name):
    """Who was featured in the same magazine issue(s)?

    Returns list of {person, issue_id, year, month, verdict}.
    """
    records = _safe_query("""
        MATCH (p:Person {name: $name})-[:FEATURED_IN]->(i:Issue)<-[:FEATURED_IN]-(other:Person)
        WHERE other.name <> $name
        RETURN DISTINCT other.name AS person,
               i.issue_id AS issue_id,
               i.year AS year,
               i.month AS month,
               other.detective_verdict AS verdict,
               other.editor_verdict AS editor_verdict
        ORDER BY i.year, i.month
    """, {"name": name})
    return records


def shared_authors(name):
    """Who else was profiled by the same journalist(s)?

    Returns list of {person, author, verdict}.
    """
    records = _safe_query("""
        MATCH (p:Person {name: $name})-[:PROFILED_BY]->(a:Author)<-[:PROFILED_BY]-(other:Person)
        WHERE other.name <> $name
        RETURN DISTINCT other.name AS person,
               a.name AS author,
               other.detective_verdict AS verdict,
               other.editor_verdict AS editor_verdict
        ORDER BY other.detective_verdict DESC, other.name
    """, {"name": name})
    return records


def ego_network(name, depth=2):
    """Everything within N hops of a person.

    Returns {nodes: [{name, type, verdict}], edges: [{from, to, rel}]}.
    """
    records = _safe_query("""
        MATCH path = (p:Person {name: $name})-[*1..""" + str(min(depth, 4)) + """]->(n)
        WITH DISTINCT n, labels(n)[0] AS nodeType,
             [r IN relationships(path) | type(r)] AS relTypes,
             [r IN relationships(path) | startNode(r).name] AS fromNames,
             [r IN relationships(path) | endNode(r).name] AS toNames
        RETURN n.name AS name, nodeType,
               n.detective_verdict AS verdict,
               n.editor_verdict AS editor_verdict,
               relTypes, fromNames, toNames
        LIMIT 200
    """, {"name": name})

    nodes = {}
    edges = set()
    # Add the center node
    nodes[name] = {"name": name, "type": "Person", "verdict": None}

    for r in records:
        node_name = r.get("name") or str(r)
        node_type = r.get("nodeType", "Unknown")
        nodes[node_name] = {
            "name": node_name,
            "type": node_type,
            "verdict": r.get("verdict"),
            "editor_verdict": r.get("editor_verdict"),
        }
        # Reconstruct edges from path data
        rel_types = r.get("relTypes") or []
        from_names = r.get("fromNames") or []
        to_names = r.get("toNames") or []
        for rt, fn, tn in zip(rel_types, from_names, to_names):
            if fn and tn:
                edges.add((fn, tn, rt))

    return {
        "nodes": list(nodes.values()),
        "edges": [{"from": e[0], "to": e[1], "rel": e[2]} for e in edges],
    }


def shortest_path(name1, name2):
    """Shortest path between two people through any node types.

    Returns {path: [{name, type}], length, relationships: [rel_type]}.
    """
    records = _safe_query("""
        MATCH (a:Person {name: $name1}), (b:Person {name: $name2})
        MATCH path = shortestPath((a)-[*..8]-(b))
        RETURN [n IN nodes(path) | {name: n.name, type: labels(n)[0]}] AS nodes,
               [r IN relationships(path) | type(r)] AS rels,
               length(path) AS hops
    """, {"name1": name1, "name2": name2})

    if not records:
        return {"path": [], "length": -1, "relationships": []}

    r = records[0]
    return {
        "path": r.get("nodes", []),
        "length": r.get("hops", -1),
        "relationships": r.get("rels", []),
    }


def flagged_neighbors(name, depth=2):
    """Find Epstein-flagged persons within N hops.

    Returns list of {person, verdict, editor_verdict, hops, path_summary}.
    """
    records = _safe_query("""
        MATCH (start:Person {name: $name})
        MATCH path = shortestPath((start)-[*1..""" + str(min(depth, 4)) + """]-(flagged:Person))
        WHERE flagged.detective_verdict IN ['YES', 'confirmed_match', 'likely_match']
              AND flagged.name <> $name
        RETURN flagged.name AS person,
               flagged.detective_verdict AS verdict,
               flagged.editor_verdict AS editor_verdict,
               length(path) AS hops,
               [n IN nodes(path) | n.name] AS path_names,
               [r IN relationships(path) | type(r)] AS path_rels
        ORDER BY length(path), flagged.name
        LIMIT 20
    """, {"name": name})
    return records


def designers_client_list(designer_name):
    """All clients of a specific designer, with their verdicts.

    Returns list of {person, verdict, editor_verdict, year}.
    """
    records = _safe_query("""
        MATCH (p:Person)-[:HIRED]->(d:Designer {name: $designer})
        OPTIONAL MATCH (p)-[:FEATURED_IN]->(i:Issue)
        RETURN DISTINCT p.name AS person,
               p.detective_verdict AS verdict,
               p.editor_verdict AS editor_verdict,
               collect(DISTINCT i.year) AS years
        ORDER BY p.detective_verdict DESC, p.name
    """, {"designer": designer_name})
    return records


# ═══════════════════════════════════════════════════════════════
# TEMPORAL QUERIES — "Who connects to whom in this era?"
# ═══════════════════════════════════════════════════════════════

def temporal_connections(name, year_start, year_end):
    """All connections of a person filtered to a specific era.

    Returns {designers: [...], cofeatures: [...], locations: [...], flagged: [...]}.
    """
    designers = _safe_query("""
        MATCH (p:Person {name: $name})-[:FEATURED_IN]->(i:Issue)
        WHERE i.year >= $y1 AND i.year <= $y2
        MATCH (p)-[:HIRED]->(d:Designer)<-[:HIRED]-(other:Person)-[:FEATURED_IN]->(i2:Issue)
        WHERE i2.year >= $y1 AND i2.year <= $y2 AND other.name <> $name
        RETURN DISTINCT other.name AS person, d.name AS designer,
               other.detective_verdict AS verdict,
               collect(DISTINCT i2.year) AS years
        ORDER BY other.detective_verdict DESC
    """, {"name": name, "y1": year_start, "y2": year_end})

    cofeatures = _safe_query("""
        MATCH (p:Person {name: $name})-[:FEATURED_IN]->(i:Issue)<-[:FEATURED_IN]-(other:Person)
        WHERE i.year >= $y1 AND i.year <= $y2 AND other.name <> $name
        RETURN DISTINCT other.name AS person, i.year AS year, i.month AS month,
               other.detective_verdict AS verdict
        ORDER BY i.year, i.month
    """, {"name": name, "y1": year_start, "y2": year_end})

    locations = _safe_query("""
        MATCH (p:Person {name: $name})-[:FEATURED_IN]->(i:Issue)
        WHERE i.year >= $y1 AND i.year <= $y2
        MATCH (p)-[:LIVES_IN]->(l:Location)<-[:LIVES_IN]-(other:Person)-[:FEATURED_IN]->(i2:Issue)
        WHERE i2.year >= $y1 AND i2.year <= $y2 AND other.name <> $name
        RETURN DISTINCT other.name AS person, l.key AS location,
               other.detective_verdict AS verdict
        ORDER BY other.detective_verdict DESC
    """, {"name": name, "y1": year_start, "y2": year_end})

    flagged = _safe_query("""
        MATCH (p:Person)-[:FEATURED_IN]->(i:Issue)
        WHERE i.year >= $y1 AND i.year <= $y2
          AND p.detective_verdict IN ['YES', 'confirmed_match', 'likely_match']
        RETURN DISTINCT p.name AS person, p.detective_verdict AS verdict,
               p.editor_verdict AS editor_verdict,
               collect(DISTINCT i.year) AS years
        ORDER BY p.name
    """, {"y1": year_start, "y2": year_end})

    return {
        "era": f"{year_start}-{year_end}",
        "shared_designers": designers,
        "cofeatures": cofeatures,
        "shared_locations": locations,
        "flagged_in_era": flagged,
    }


def temporal_designer_overlap(name, year_start=None, year_end=None):
    """Who shared a designer with this person, optionally within a time window?

    Without year constraints, searches all time. This is Elena's
    "who else hired this designer?" query.

    Returns list of {person, designer, years, verdict}.
    """
    if year_start and year_end:
        return _safe_query("""
            MATCH (p:Person {name: $name})-[:HIRED]->(d:Designer)<-[:HIRED]-(other:Person)
            WHERE other.name <> $name
            MATCH (other)-[:FEATURED_IN]->(i:Issue)
            WHERE i.year >= $y1 AND i.year <= $y2
            RETURN DISTINCT other.name AS person, d.name AS designer,
                   other.detective_verdict AS verdict,
                   other.editor_verdict AS editor_verdict,
                   collect(DISTINCT i.year) AS years
            ORDER BY other.detective_verdict DESC, other.name
        """, {"name": name, "y1": year_start, "y2": year_end})
    else:
        return shared_designers(name)


def era_flagged_persons(year_start, year_end):
    """All Epstein-flagged persons featured in a specific era.

    Returns list of {person, verdict, editor_verdict, years}.
    """
    return _safe_query("""
        MATCH (p:Person)-[:FEATURED_IN]->(i:Issue)
        WHERE i.year >= $y1 AND i.year <= $y2
          AND p.detective_verdict IN ['YES', 'confirmed_match', 'likely_match']
        RETURN DISTINCT p.name AS person,
               p.detective_verdict AS verdict,
               p.editor_verdict AS editor_verdict,
               collect(DISTINCT i.year) AS years
        ORDER BY min(i.year), p.name
    """, {"y1": year_start, "y2": year_end})


def person_timeline(name):
    """Full timeline of a person's AD appearances with all context.

    Returns list of {year, month, issue_id, designers, locations, styles, cofeatures}.
    """
    records = _safe_query("""
        MATCH (p:Person {name: $name})-[:FEATURED_IN]->(i:Issue)
        OPTIONAL MATCH (p)-[:HIRED]->(d:Designer)
        OPTIONAL MATCH (p)-[:LIVES_IN]->(l:Location)
        OPTIONAL MATCH (p)-[:HAS_STYLE]->(s:Style)
        OPTIONAL MATCH (other:Person)-[:FEATURED_IN]->(i)
        WHERE other.name <> $name
        RETURN i.year AS year, i.month AS month, i.issue_id AS issue_id,
               collect(DISTINCT d.name) AS designers,
               collect(DISTINCT l.key) AS locations,
               collect(DISTINCT s.name) AS styles,
               collect(DISTINCT {name: other.name, verdict: other.detective_verdict}) AS cofeatures
        ORDER BY i.year, i.month
    """, {"name": name})
    return records


# ═══════════════════════════════════════════════════════════════
# RAW QUERY — For edge cases Elena can't anticipate
# ═══════════════════════════════════════════════════════════════

def raw_query(cypher, params=None):
    """Execute an arbitrary read-only Cypher query.

    For investigative edge cases that the preset functions don't cover.
    Returns list of record dicts.
    """
    return _safe_query(cypher, params)
