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

/** Dark-mode node color palette — warm celestial tones on black */
export const nodeColors: Record<GraphNode["nodeType"], string> = {
  person: "#5B8DB8",       // Steel blue
  designer: "#7EB5D6",     // Light blue
  location: "#D4A04A",     // Gold
  style: "#C27C4E",        // Copper/orange
  issue: "#E8C47A",        // Pale gold
  author: "#A89070",       // Warm tan
  epstein_source: "#E05A47", // Signal red
};

/** Link colors by relationship type */
export const linkColors: Record<string, string> = {
  FEATURED_IN: "#C27C4E",   // Copper
  HIRED: "#5B8DB8",          // Blue
  LIVES_IN: "#D4A04A",      // Gold
  HAS_STYLE: "#C27C4E",     // Copper
  PROFILED_BY: "#A89070",   // Tan
  APPEARS_IN: "#E05A47",    // Red
};

/** Epstein-linked person ring color */
export const epsteinRingColor = "#E05A47";

/** Graph background */
export const graphBg = "#0A0A0A";

/** Node size formula — uses pagerank when available, falls back to degree */
export function nodeSize(degree: number, pagerank?: number | null): number {
  if (pagerank != null && pagerank > 0) {
    // PageRank-based: scale 0-1 range into 3-16 node radius
    return Math.max(3, Math.min(16, 3 + pagerank * 800));
  }
  return Math.max(3, Math.min(14, 2.5 + degree * 0.6));
}
