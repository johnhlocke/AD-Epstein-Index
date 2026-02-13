"""
Neo4j graph database client — singleton driver pattern matching db.py.

Provides connection management, constraint setup, and query helpers
for the knowledge graph that maps relationships between AD-featured
people, designers, locations, styles, and Epstein connections.

Usage:
    from graph_db import get_driver, run_query, create_constraints
"""

import os
import ssl
from dotenv import load_dotenv

load_dotenv()

# Python 3.14 on macOS needs explicit cert path for SSL
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except ImportError:
    pass

_driver = None


def get_driver():
    """Return a singleton Neo4j driver from environment variables."""
    global _driver
    if _driver is None:
        from neo4j import GraphDatabase

        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")

        if not uri or not username or not password:
            raise RuntimeError(
                "NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD must be set in .env"
            )

        _driver = GraphDatabase.driver(uri, auth=(username, password))
        # Verify connectivity
        _driver.verify_connectivity()

    return _driver


def close_driver():
    """Close the Neo4j driver. Call at shutdown."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def run_query(cypher, params=None, write=False):
    """Execute a Cypher query and return list of record dicts.

    Args:
        cypher: Cypher query string
        params: Optional dict of query parameters
        write: If True, use a write transaction (default: read)

    Returns:
        List of dicts (one per record)
    """
    driver = get_driver()
    with driver.session() as session:
        if write:
            result = session.run(cypher, params or {})
        else:
            result = session.run(cypher, params or {})
        return [record.data() for record in result]


def run_write(cypher, params=None):
    """Execute a write Cypher query. Returns summary counters."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run(cypher, params or {})
        summary = result.consume()
        return {
            "nodes_created": summary.counters.nodes_created,
            "relationships_created": summary.counters.relationships_created,
            "properties_set": summary.counters.properties_set,
        }


def create_constraints():
    """Create uniqueness constraints on all node labels."""
    constraints = [
        ("Person", "name"),
        ("Designer", "name"),
        ("Location", "key"),
        ("Style", "name"),
        ("Issue", "issue_id"),
        ("Author", "name"),
        ("EpsteinSource", "name"),
        ("ArtCategory", "name"),
    ]

    driver = get_driver()
    with driver.session() as session:
        for label, prop in constraints:
            constraint_name = f"unique_{label.lower()}_{prop}"
            cypher = (
                f"CREATE CONSTRAINT {constraint_name} IF NOT EXISTS "
                f"FOR (n:{label}) REQUIRE n.{prop} IS UNIQUE"
            )
            session.run(cypher)

    print(f"Created {len(constraints)} uniqueness constraints")


def clear_graph():
    """Delete all nodes and relationships. Use for full rebuild."""
    driver = get_driver()
    with driver.session() as session:
        # Delete in batches to avoid memory issues
        while True:
            result = session.run(
                "MATCH (n) WITH n LIMIT 10000 DETACH DELETE n RETURN count(*) AS deleted"
            )
            record = result.single()
            deleted = record["deleted"] if record else 0
            if deleted == 0:
                break
    print("Graph cleared")


def get_stats():
    """Return node and relationship counts by type."""
    driver = get_driver()
    with driver.session() as session:
        # Node counts by label
        node_result = session.run(
            "CALL db.labels() YIELD label "
            "CALL (label) { MATCH (n) WHERE label IN labels(n) RETURN count(n) AS count } "
            "RETURN label, count"
        )
        nodes = {r["label"]: r["count"] for r in node_result}

        # Relationship counts by type
        rel_result = session.run(
            "CALL db.relationshipTypes() YIELD relationshipType AS type "
            "CALL (type) { MATCH ()-[r]->() WHERE type(r) = type RETURN count(r) AS count } "
            "RETURN type, count"
        )
        rels = {r["type"]: r["count"] for r in rel_result}

        total_nodes = sum(nodes.values())
        total_rels = sum(rels.values())

    return {
        "nodes": nodes,
        "relationships": rels,
        "total_nodes": total_nodes,
        "total_relationships": total_rels,
    }
