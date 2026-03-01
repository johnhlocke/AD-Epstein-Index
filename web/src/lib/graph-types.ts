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
    | "epstein_source"
    | "doj_source"
    | "bb_source";
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
  // Dossier link
  dossierId?: number | null;
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

/** Uncertainty ring rendering config — no blur on light bg, uses opacity + stroke */
export const uncertaintyConfig: Record<
  ConfidenceLevel,
  { blur: number; fillOpacity: number; ringOpacity: number; ringWidth: number }
> = {
  high: { blur: 0, fillOpacity: 0.25, ringOpacity: 1.0, ringWidth: 2.0 },
  good: { blur: 0, fillOpacity: 0.18, ringOpacity: 0.85, ringWidth: 1.8 },
  medium: { blur: 0, fillOpacity: 0.12, ringOpacity: 0.7, ringWidth: 1.5 },
  low: { blur: 0, fillOpacity: 0.06, ringOpacity: 0.5, ringWidth: 1.2 },
  very_low: { blur: 0, fillOpacity: 0.02, ringOpacity: 0.35, ringWidth: 1.0 },
};

// ── Colors ──────────────────────────────────────────────────

/** Node type colors — near-monochrome with copper/red accents for Epstein sources */
export const nodeColors: Record<GraphNode["nodeType"], string> = {
  person: "#AAAAAA", // Light gray — background
  designer: "#999999", // Medium gray — background
  location: "#BBBBBB", // Lighter gray — background
  style: "#CCCCCC", // Very light — structural
  issue: "#CCCCCC", // Very light — structural
  author: "#BBBBBB", // Light — structural
  epstein_source: "#B87333", // Copper — fallback
  bb_source: "#B87333", // Copper — Black Book (contact list)
  doj_source: "#9B2226", // Deep red — DOJ Library (legal records)
};

/** Link colors by relationship type — gray for structural, red for Epstein */
export const linkColors: Record<string, string> = {
  FEATURED_IN: "#D5D5D5", // Gray — structural
  HIRED: "#C5C5C5", // Gray — structural
  LIVES_IN: "#D0D0D0", // Gray — structural
  HAS_STYLE: "#DCDCDC", // Gray — structural
  PROFILED_BY: "#D5D5D5", // Gray — structural
  APPEARS_IN: "#9B2226", // Red — Epstein connection, the signal
};

/** Uncertainty ring color (copper/amber) */
export const uncertaintyColor = "#B87333";

/** Graph background */
export const graphBg = "#FAFAFA";

// ── Grid Drawing ────────────────────────────────────────────

/** Draw graph-paper grid on canvas before nodes render */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  globalScale: number
): void {
  const transform = ctx.getTransform();
  const canvas = ctx.canvas;

  // Visible area in world coordinates
  const left = -transform.e / transform.a;
  const top = -transform.f / transform.d;
  const right = (canvas.width - transform.e) / transform.a;
  const bottom = (canvas.height - transform.f) / transform.d;

  // Adaptive grid: spacing adjusts with zoom for constant screen density
  const baseSpacing = 50;
  const minorSpacing = baseSpacing / Math.max(0.3, Math.min(globalScale, 3));
  const majorSpacing = minorSpacing * 4;

  // Minor grid
  ctx.strokeStyle = "#ECECEC";
  ctx.lineWidth = 0.5 / globalScale;
  ctx.beginPath();

  let x = Math.floor(left / minorSpacing) * minorSpacing;
  for (; x <= right; x += minorSpacing) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  let y = Math.floor(top / minorSpacing) * minorSpacing;
  for (; y <= bottom; y += minorSpacing) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();

  // Major grid
  ctx.strokeStyle = "#DCDCDC";
  ctx.lineWidth = 1 / globalScale;
  ctx.beginPath();

  x = Math.floor(left / majorSpacing) * majorSpacing;
  for (; x <= right; x += majorSpacing) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  y = Math.floor(top / majorSpacing) * majorSpacing;
  for (; y <= bottom; y += majorSpacing) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();
}

// ── Sizing & Thresholds ─────────────────────────────────────

/** Node size formula — uses pagerank when available, falls back to degree */
export function nodeSize(degree: number, pagerank?: number | null): number {
  if (pagerank != null && pagerank > 0) {
    // PageRank-based: scale into 8-32 node radius
    return Math.max(8, Math.min(32, 8 + pagerank * 1600));
  }
  return Math.max(8, Math.min(28, 8 + degree * 1.4));
}

/** Nodes with degree >= this always show labels at any zoom */
export const LABEL_DEGREE_THRESHOLD = 2;

/** Below this zoom level, only high-degree nodes show labels */
export const LABEL_ZOOM_THRESHOLD = 2.0;