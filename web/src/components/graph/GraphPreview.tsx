"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMounted } from "@/lib/use-mounted";
import { Separator } from "@/components/ui/separator";
import type { GraphData, GraphNode } from "@/lib/graph-types";
import {
  nodeColors,
  linkColors,
  uncertaintyColor,
  uncertaintyConfig,
  graphBg,
  nodeSize,
  getConfidenceLevel,
  drawGrid,
  LABEL_DEGREE_THRESHOLD,
} from "@/lib/graph-types";

// react-force-graph-2d has no TS types and must be dynamically imported (Canvas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D: any = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
}

interface FGLink {
  source: FGNode | string;
  target: FGNode | string;
  relType?: string;
}

/**
 * Landing-page graph preview — "Graph Paper" Swiss editorial style.
 *
 * Two-column layout: editorial text in slice 1, graph in slices 2-6.
 * White background with subtle grid lines, restrained color palette.
 */
export function GraphPreview() {
  const mounted = useMounted();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [loaded, setLoaded] = useState(false);

  // Hover state lives in refs — no React re-renders on mouse move
  const hoveredNodeRef = useRef<FGNode | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Fetch graph on mount
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        const res = await fetch("/api/graph?preset=confirmed");
        if (!res.ok) return;
        const data: GraphData = await res.json();
        setGraphData(data);
        setLoaded(true);
      } catch {
        // Silently fail — the preview is non-critical
      }
    })();
  }, [mounted]);

  // Fit to view after settle
  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      const early = setTimeout(
        () => graphRef.current?.zoomToFit?.(400, 40),
        600
      );
      const late = setTimeout(
        () => graphRef.current?.zoomToFit?.(600, 40),
        3200
      );
      return () => {
        clearTimeout(early);
        clearTimeout(late);
      };
    }
  }, [graphData]);

  // ── Grid background — drawn before each frame ──

  const handleRenderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawGrid(ctx, globalScale);
    },
    []
  );

  // ── Canvas rendering — Swiss minimal style ──

  const handleNodeCanvas = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = nodeSize(node.degree ?? 0, node.pagerank);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const color = nodeColors[node.nodeType] ?? "#888";
      const confidence = getConfidenceLevel(node);
      const isHovered = hoveredNodeRef.current?.id === node.id;

      ctx.save();

      // Uncertainty ring (copper, no glow — just clean strokes)
      if (confidence !== null) {
        const uc = uncertaintyConfig[confidence];

        // Ring
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = uncertaintyColor;
        ctx.lineWidth = uc.ringWidth / globalScale;
        ctx.globalAlpha = uc.ringOpacity;
        ctx.stroke();

        // Subtle fill
        if (uc.fillOpacity > 0.03) {
          ctx.beginPath();
          ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
          ctx.fillStyle = uncertaintyColor;
          ctx.globalAlpha = uc.fillOpacity;
          ctx.fill();
        }
      }

      // Hover ring
      if (isHovered) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, size + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Node body — solid fill + thin stroke, no glow
      ctx.globalAlpha = 1;

      // Fill
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered ? 1.0 : 0.85;
      ctx.fill();

      // Stroke
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / globalScale;
      ctx.globalAlpha = 1;
      ctx.stroke();

      ctx.restore();

      // Labels for hub nodes — dark text on light bg
      const showLabel =
        isHovered || (node.degree ?? 0) >= LABEL_DEGREE_THRESHOLD;

      if (showLabel) {
        const fontSize = Math.max(10 / globalScale, 1.8);
        ctx.font = `500 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered ? "#1A1A1A" : "#555555";
        ctx.fillText(node.label, x, y + size + 3);
      }
    },
    []
  );

  const handlePointerArea = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const size = nodeSize(node.degree ?? 0, node.pagerank);
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, size + 8, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  // Hover handler — updates ref + tooltip DOM directly, no React state
  const handleNodeHover = useCallback((node: FGNode | null) => {
    hoveredNodeRef.current = node;

    const tip = tooltipRef.current;
    if (tip) {
      if (node && graphRef.current?.graph2ScreenCoords) {
        const coords = graphRef.current.graph2ScreenCoords(
          node.x ?? 0,
          node.y ?? 0
        );
        tip.style.display = "block";
        tip.style.left = `${coords.x + 14}px`;
        tip.style.top = `${coords.y - 56}px`;
        tip.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${nodeColors[node.nodeType]}"></span>
            <span style="font-size:12px;font-weight:500;color:#1A1A1A">${node.label}</span>
          </div>
          <div style="margin-top:4px;display:flex;gap:12px;font-size:10px;color:#737373">
            <span>${node.nodeType.replace("_", " ")}</span>
            ${node.degree != null ? `<span>${node.degree} connections</span>` : ""}
          </div>
        `;
      } else {
        tip.style.display = "none";
      }
    }

    graphRef.current?.refresh?.();
  }, []);

  const handleLinkColor = useCallback((link: FGLink) => {
    const base = linkColors[link.relType ?? ""] ?? "#DDDDDD";
    // Epstein links get more opacity, structural links stay subtle
    if (link.relType === "APPEARS_IN") return base + "CC";
    return base + "66";
  }, []);

  const handleLinkWidth = useCallback((link: FGLink) => {
    if (link.relType === "APPEARS_IN") return 2;
    if (link.relType === "HIRED") return 1.5;
    return 0.8;
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-6 md:grid-cols-[188px_1fr]">
        <div />
        <div
          className="flex h-[650px] items-center justify-center rounded border border-border"
          style={{ backgroundColor: graphBg }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-[#B87333]" />
            <p className="text-xs text-muted-foreground">Loading graph...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[188px_1fr]">
      {/* ── Column 1: Editorial text ── */}
      <div className="flex flex-col pt-1">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Network Analysis
        </p>

        <Separator className="mt-2 mb-5" />

        <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
          Each node represents a person, designer, location, or Epstein source
          document. Connections emerge from 28 years of Architectural Digest
          features cross-referenced against the DOJ&rsquo;s Epstein library.
        </p>

        <p className="mt-4 font-serif text-[15px] leading-[1.75] text-foreground/60">
          Copper rings mark confirmed Epstein connections. The closer two nodes
          sit, the stronger their relationship in the network.
        </p>

        {/* Legend — integrated into text column */}
        {loaded && (
          <div className="mt-8">
            <p
              className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              Node Types
            </p>
            <div className="mt-2 space-y-1.5">
              {(
                [
                  ["person", "Person"],
                  ["designer", "Designer"],
                  ["location", "Location"],
                  ["epstein_source", "Epstein Source"],
                ] as const
              ).map(([type, label]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 text-[11px] text-muted-foreground"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: nodeColors[type] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: "transparent",
                    border: `1.5px solid ${uncertaintyColor}`,
                  }}
                />
                <span>Epstein Connection</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats — Feltron-style big numbers */}
        {loaded && (
          <div className="mt-8 border-t border-border pt-4">
            <p
              className="text-[28px] font-bold leading-none tracking-tight"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              {graphData.nodes.length}
            </p>
            <p
              className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              Nodes
            </p>
            <p
              className="mt-4 text-[28px] font-bold leading-none tracking-tight"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              {graphData.links.length}
            </p>
            <p
              className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              Edges
            </p>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/explorer"
          className="mt-auto inline-flex items-center gap-1 pt-6 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors hover:text-foreground"
          style={{
            fontFamily: "futura-pt, sans-serif",
            color: "#B87333",
          }}
        >
          Explore Full Graph &rarr;
        </Link>
      </div>

      {/* ── Columns 2-6: Graph canvas ── */}
      <div
        ref={containerRef}
        className="relative h-[650px] overflow-hidden rounded border border-border"
        style={{ backgroundColor: graphBg }}
      >
        {/* Graph canvas */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeId="id"
            nodeCanvasObject={handleNodeCanvas}
            nodePointerAreaPaint={handlePointerArea}
            onNodeHover={handleNodeHover}
            onRenderFramePre={handleRenderFramePre}
            linkColor={handleLinkColor}
            linkWidth={handleLinkWidth}
            linkCurvature={0.15}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            cooldownTime={3000}
            warmupTicks={30}
            backgroundColor={graphBg}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            enableNodeDrag={true}
          />
        </div>

        {/* Hover tooltip — light theme */}
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-30 rounded border border-border bg-background shadow-sm"
          style={{
            display: "none",
            padding: "8px 12px",
            maxWidth: 240,
          }}
        />
      </div>
    </div>
  );
}
