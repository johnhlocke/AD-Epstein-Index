import { getNeo4jDriver, toNumber } from "./neo4j";
import type { GraphData, GraphNode, GraphLink } from "./graph-types";

/**
 * Map a Neo4j node record to a GraphNode.
 * Expects the query to return: id(n), labels(n), n properties.
 */
function mapNode(record: Record<string, unknown>): GraphNode {
  const labels = record.labels as string[];
  const props = record.props as Record<string, unknown>;
  const nodeType = mapLabelToType(labels?.[0] ?? "Person", props.name as string | undefined);

  return {
    id: `${nodeType}:${props.name ?? props.key ?? record.nodeId}`,
    label:
      (props.display_name as string) ??
      (props.name as string) ??
      (props.key as string) ??
      "Unknown",
    nodeType,
    detectiveVerdict: (props.detective_verdict as string) ?? null,
    connectionStrength: (props.connection_strength as string) ?? null,
    editorVerdict: (props.editor_verdict as string) ?? null,
    featureCount: toNumber(props.feature_count),
    communityId: props.community_id != null ? toNumber(props.community_id) : null,
    pagerank: typeof props.pagerank === "number" ? props.pagerank : null,
    betweenness: typeof props.betweenness === "number" ? props.betweenness : null,
    city: (props.city as string) ?? null,
    state: (props.state as string) ?? null,
    country: (props.country as string) ?? null,
    month: props.month != null ? toNumber(props.month) : null,
    year: props.year != null ? toNumber(props.year) : null,
    dossierId: props.dossier_id != null ? toNumber(props.dossier_id) : null,
  };
}

function mapLabelToType(
  label: string,
  name?: string
): GraphNode["nodeType"] {
  if (label === "EpsteinSource") {
    if (name === "DOJ Library") return "doj_source";
    if (name === "Black Book") return "bb_source";
    return "epstein_source";
  }
  const map: Record<string, GraphNode["nodeType"]> = {
    Person: "person",
    Designer: "designer",
    Location: "location",
    Style: "style",
    Issue: "issue",
    Author: "author",
  };
  return map[label] ?? "person";
}

/**
 * Run a Cypher query that returns nodes and relationships,
 * then deduplicate into GraphData.
 */
async function runGraphQuery(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<GraphData> {
  const driver = getNeo4jDriver();
  const session = driver.session({ defaultAccessMode: "READ" });

  try {
    const result = await session.run(cypher, params);

    const nodeMap = new Map<string, GraphNode>();
    const linkSet = new Set<string>();
    const links: GraphLink[] = [];

    for (const record of result.records) {
      // Process nodes
      for (const key of record.keys) {
        const val = record.get(key);

        // Neo4j Node
        if (val && typeof val === "object" && "labels" in val && "properties" in val) {
          const node = mapNode({
            nodeId: val.identity?.toNumber?.() ?? val.elementId,
            labels: val.labels,
            props: val.properties,
          });
          nodeMap.set(node.id, node);
        }

        // Neo4j Relationship
        if (val && typeof val === "object" && "type" in val && "start" in val && "end" in val) {
          // Relationships are handled via source/target nodes
        }

        // Neo4j Path
        if (val && typeof val === "object" && "segments" in val) {
          const path = val as { segments: Array<{ start: unknown; end: unknown; relationship: unknown }> };
          for (const seg of path.segments) {
            const startNode = seg.start as { identity: unknown; labels: string[]; properties: Record<string, unknown> };
            const endNode = seg.end as { identity: unknown; labels: string[]; properties: Record<string, unknown> };
            const rel = seg.relationship as { type: string; properties: Record<string, unknown> };

            const sn = mapNode({
              nodeId: (startNode.identity as { toNumber?: () => number })?.toNumber?.() ?? String(startNode.identity),
              labels: startNode.labels,
              props: startNode.properties,
            });
            const en = mapNode({
              nodeId: (endNode.identity as { toNumber?: () => number })?.toNumber?.() ?? String(endNode.identity),
              labels: endNode.labels,
              props: endNode.properties,
            });

            nodeMap.set(sn.id, sn);
            nodeMap.set(en.id, en);

            const linkKey = `${sn.id}->${en.id}:${rel.type}`;
            if (!linkSet.has(linkKey)) {
              linkSet.add(linkKey);
              links.push({
                source: sn.id,
                target: en.id,
                relType: rel.type,
                properties: rel.properties,
              });
            }
          }
        }
      }
    }

    // Filter out nodes with no useful label (e.g. issues titled "Unknown")
    for (const [id, node] of nodeMap) {
      if (node.label === "Unknown") nodeMap.delete(id);
    }
    const validIds = new Set(nodeMap.keys());
    const filteredLinks = links.filter(
      (l) => validIds.has(l.source) && validIds.has(l.target)
    );

    // Compute degree for each node
    const nodes = Array.from(nodeMap.values());
    const degreeMap = new Map<string, number>();
    for (const link of filteredLinks) {
      degreeMap.set(link.source, (degreeMap.get(link.source) ?? 0) + 1);
      degreeMap.set(link.target, (degreeMap.get(link.target) ?? 0) + 1);
    }
    for (const node of nodes) {
      node.degree = degreeMap.get(node.id) ?? 0;
    }

    return { nodes, links: filteredLinks };
  } finally {
    await session.close();
  }
}

// ── Query Functions ──────────────────────────────────────────

/** 1. Everything within N hops of a person */
export async function getEgoNetwork(
  name: string,
  depth: number = 2
): Promise<GraphData> {
  const normalizedName = name.trim().split(/\s+/).map(
    w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(" ");

  return runGraphQuery(
    `MATCH path = (p:Person {name: $name})-[*1..${Math.min(depth, 3)}]-(connected)
     RETURN path
     LIMIT 200`,
    { name: normalizedName }
  );
}

/** 2. Shortest path between two people */
export async function getShortestPath(
  name1: string,
  name2: string
): Promise<GraphData> {
  const norm = (s: string) => s.trim().split(/\s+/).map(
    w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(" ");

  return runGraphQuery(
    `MATCH path = shortestPath(
       (a:Person {name: $name1})-[*..6]-(b:Person {name: $name2})
     )
     RETURN path`,
    { name1: norm(name1), name2: norm(name2) }
  );
}

/** 3. People who share a designer with an Epstein-linked person */
export async function getSharedDesignerNetwork(): Promise<GraphData> {
  return runGraphQuery(
    `MATCH (ep:Person)-[:APPEARS_IN]->(:EpsteinSource)
     MATCH (ep)-[:HIRED]->(d:Designer)<-[:HIRED]-(other:Person)
     WHERE ep <> other
     WITH ep, d, other LIMIT 100
     MATCH path1 = (ep)-[:HIRED]->(d)
     MATCH path2 = (other)-[:HIRED]->(d)
     OPTIONAL MATCH path3 = (ep)-[:APPEARS_IN]->(:EpsteinSource)
     RETURN path1, path2, path3`
  );
}

/** 4. Highest-degree Person nodes */
export async function getMostConnectedHubs(
  limit: number = 20
): Promise<GraphData> {
  return runGraphQuery(
    `MATCH (p:Person)
     WHERE p.is_anonymous IS NULL OR p.is_anonymous = false
     WITH p, size([(p)-[]-() | 1]) AS deg
     ORDER BY deg DESC
     LIMIT $limit
     MATCH path = (p)-[]-(connected)
     RETURN path
     LIMIT 500`,
    { limit: neo4jInt(limit) }
  );
}

/** 5. All Epstein-linked persons + their connections */
export async function getEpsteinSubgraph(): Promise<GraphData> {
  return runGraphQuery(
    `MATCH (p:Person)-[ai:APPEARS_IN]->(es:EpsteinSource)
     WITH p, ai, es
     OPTIONAL MATCH path = (p)-[]-(connected)
     RETURN p, ai, es, path
     LIMIT 500`
  );
}

/** 6. Full graph overview (capped, only connected nodes) */
export async function getFullGraph(): Promise<GraphData> {
  return runGraphQuery(
    `MATCH (n)
     WHERE size([(n)-[]-() | 1]) > 1
     WITH n LIMIT 300
     MATCH path = (n)-[]-(m)
     RETURN path
     LIMIT 500`
  );
}

/** 6b. Confirmed-only network: confirmed persons + shared designers/locations + Epstein sources */
export async function getConfirmedNetwork(): Promise<GraphData> {
  return runGraphQuery(
    `// Get all confirmed people
     MATCH (p:Person)
     WHERE p.editor_verdict = 'CONFIRMED'
     WITH collect(p) AS confirmed

     // Shared designers between confirmed people
     UNWIND confirmed AS p1
     OPTIONAL MATCH (p1)-[:HIRED]->(d:Designer)<-[:HIRED]-(p2:Person)
     WHERE p2 IN confirmed AND p1 <> p2
     WITH confirmed, collect(DISTINCT d) AS sharedDesigners

     // Shared locations between confirmed people
     UNWIND confirmed AS p1
     OPTIONAL MATCH (p1)-[:LIVES_IN]->(loc:Location)<-[:LIVES_IN]-(p2:Person)
     WHERE p2 IN confirmed AND p1 <> p2
     WITH confirmed, sharedDesigners, collect(DISTINCT loc) AS sharedLocations

     // Now return paths for: person→designer, person→location, person→source
     UNWIND confirmed AS p

     // Epstein source connections
     OPTIONAL MATCH srcPath = (p)-[:APPEARS_IN]->(es:EpsteinSource)

     // Designer connections (only shared designers)
     OPTIONAL MATCH desPath = (p)-[:HIRED]->(d:Designer)
     WHERE d IN sharedDesigners

     // Location connections (only shared locations)
     OPTIONAL MATCH locPath = (p)-[:LIVES_IN]->(loc:Location)
     WHERE loc IN sharedLocations

     RETURN p, srcPath, desPath, locPath`
  );
}

/** 7. Autocomplete search for person names */
export async function searchNodes(
  query: string
): Promise<GraphNode[]> {
  const driver = getNeo4jDriver();
  const session = driver.session({ defaultAccessMode: "READ" });

  try {
    const result = await session.run(
      `MATCH (p:Person)
       WHERE toLower(p.name) CONTAINS toLower($query)
         AND (p.is_anonymous IS NULL OR p.is_anonymous = false)
       RETURN p.name AS name, p.detective_verdict AS verdict,
              p.connection_strength AS strength, p.feature_count AS fc
       ORDER BY p.feature_count DESC
       LIMIT 10`,
      { query }
    );

    return result.records.map((r) => ({
      id: `person:${r.get("name")}`,
      label: r.get("name") as string,
      nodeType: "person" as const,
      detectiveVerdict: r.get("verdict") as string | null,
      connectionStrength: r.get("strength") as string | null,
      featureCount: toNumber(r.get("fc")),
    }));
  } finally {
    await session.close();
  }
}

/** Helper to create a Neo4j integer for parameters */
function neo4jInt(n: number) {
  // neo4j-driver expects native numbers for LIMIT — no conversion needed
  return n;
}
