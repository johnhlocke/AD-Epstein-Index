/** Graph visualization types for the Connection Explorer */

export interface GraphNode {
  id: string; // "person:Jane Smith", "designer:Thierry Despont"
  label: string; // Display name
  nodeType:
    | "person"
    | "designer"
    | "location"
    | "style"
    | "issue"
    | "author"
    | "epstein_source";
  detectiveVerdict?: string | null;
  connectionStrength?: string | null;
  editorVerdict?: string | null;
  featureCount?: number;
  degree?: number; // Set client-side from link count
  // Analytics (from graph_analytics.py → Neo4j)
  communityId?: number | null;
  pagerank?: number | null;
  betweenness?: number | null;
  // Location-specific
  city?: string | null;
  state?: string | null;
  country?: string | null;
  // Issue-specific
  month?: number | null;
  year?: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
  relType: string;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type GraphPreset =
  | "ego"
  | "shortest"
  | "shared-designers"
  | "hubs"
  | "epstein"
  | "full"
  | "search";

// ── Confidence / Uncertainty ────────────────────────────────

export type ConfidenceLevel = "high" | "good" | "medium" | "low" | "very_low";

/** Determine confidence level from node verdict data.
 *  Returns null for nodes with no Epstein connection (no ring shown). */
export function getConfidenceLevel(node: GraphNode): ConfidenceLevel | null {
  if (node.nodeType !== "person") return null;

  // Editor-confirmed = highest certainty
  if (node.editorVerdict === "CONFIRMED") return "high";
  // Editor-rejected = no uncertainty ring
  if (node.editorVerdict === "REJECTED") return null;

  // Detective flagged — confidence based on match strength
  if (node.detectiveVerdict === "YES") {
    switch (node.connectionStrength) {
      case "confirmed_match":
        return "high";
      case "likely_match":
        return "good";
      case "possible_match":
        return "medium";
      case "needs_review":
        return "low";
      default:
        return "medium"; // YES but unknown strength
    }
  }

  return null; // No Epstein connection data
}

/** Uncertainty ring rendering config — blur increases as confidence drops */
export const uncertaintyConfig: Record<
  ConfidenceLevel,
  { blur: number; fillOpacity: number; ringOpacity: number; ringWidth: number }
> = {
  high: { blur: 2, fillOpacity: 0.85, ringOpacity: 1.0, ringWidth: 2.0 },
  good: { blur: 6, fillOpacity: 0.6, ringOpacity: 0.9, ringWidth: 1.8 },
  medium: { blur: 12, fillOpacity: 0.35, ringOpacity: 0.8, ringWidth: 1.5 },
  low: { blur: 18, fillOpacity: 0.15, ringOpacity: 0.7, ringWidth: 1.2 },
  very_low: { blur: 24, fillOpacity: 0.05, ringOpacity: 0.6, ringWidth: 1.0 },
};

// ── Colors ──────────────────────────────────────────────────

/** Node type colors — reference-inspired palette on dark background */
export const nodeColors: Record<GraphNode["nodeType"], string> = {
  person: "#4A8FE7", // Bright blue
  designer: "#5CB3CC", // Teal
  location: "#E07A5F", // Warm coral
  style: "#6BAF7B", // Muted green
  issue: "#C4A882", // Warm tan
  author: "#8B7D6B", // Muted brown
  epstein_source: "#E05A47", // Signal red
};

/** Link colors by relationship type */
export const linkColors: Record<string, string> = {
  FEATURED_IN: "#C27C4E", // Copper
  HIRED: "#5CB3CC", // Teal
  LIVES_IN: "#E07A5F", // Coral
  HAS_STYLE: "#6BAF7B", // Green
  PROFILED_BY: "#8B7D6B", // Brown
  APPEARS_IN: "#E05A47", // Red
};

/** Uncertainty ring color (gold/amber) */
export const uncertaintyColor = "#D4A04A";

/** Graph background */
export const graphBg = "#0A0A0A";

// ── Sizing & Thresholds ─────────────────────────────────────

/** Node size formula — uses pagerank when available, falls back to degree */
export function nodeSize(degree: number, pagerank?: number | null): number {
  if (pagerank != null && pagerank > 0) {
    // PageRank-based: scale into 2-8 node radius
    return Math.max(2, Math.min(8, 2 + pagerank * 400));
  }
  return Math.max(2, Math.min(7, 2 + degree * 0.35));
}

/** Nodes with degree >= this always show labels at any zoom */
export const LABEL_DEGREE_THRESHOLD = 2;

/** Below this zoom level, only high-degree nodes show labels */
export const LABEL_ZOOM_THRESHOLD = 2.0;