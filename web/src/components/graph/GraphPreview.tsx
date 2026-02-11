"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMounted } from "@/lib/use-mounted";
import type { GraphData, GraphNode } from "@/lib/graph-types";
import {
  nodeColors,
  linkColors,
  uncertaintyColor,
  uncertaintyConfig,
  graphBg,
  nodeSize,
  getConfidenceLevel,
  LABEL_DEGREE_THRESHOLD,
} from "@/lib/graph-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as any;

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
 * Compact, read-only graph preview for the landing page.
 * Loads the full graph overview, supports hover + drag, and
 * links through to the full Connection Explorer.
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
  const [hoveredNode, setHoveredNode] = useState<FGNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  // Fetch full graph on mount
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        const res = await fetch("/api/graph?preset=full");
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

  // ── Canvas rendering (simplified from ConnectionExplorer) ──

  const handleNodeCanvas = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = nodeSize(node.degree ?? 0, node.pagerank);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const color = nodeColors[node.nodeType] ?? "#888";
      const confidence = getConfidenceLevel(node);
      const isHovered = hoveredNode?.id === node.id;

      ctx.save();

      // Uncertainty ring
      if (confidence !== null) {
        const uc = uncertaintyConfig[confidence];
        ctx.save();
        ctx.shadowColor = uncertaintyColor;
        ctx.shadowBlur = uc.blur;
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = uncertaintyColor;
        ctx.lineWidth = uc.ringWidth / globalScale;
        ctx.globalAlpha = uc.ringOpacity;
        ctx.stroke();
        if (uc.fillOpacity > 0.05) {
          ctx.beginPath();
          ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
          ctx.fillStyle = uncertaintyColor;
          ctx.globalAlpha = uc.fillOpacity * 0.3;
          ctx.fill();
        }
        ctx.restore();
      }

      // Hover ring
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, size + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Node body
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered ? 10 : 4;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.globalAlpha = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, size * 0.55, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered ? 0.9 : 0.7;
      ctx.fill();

      ctx.restore();

      // Labels for hub nodes
      const showLabel =
        isHovered || (node.degree ?? 0) >= LABEL_DEGREE_THRESHOLD;

      if (showLabel) {
        const fontSize = Math.max(10 / globalScale, 1.8);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillText(node.label, x + 0.5, y + size + 3 + 0.5);
        ctx.fillStyle = isHovered
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.6)";
        ctx.fillText(node.label, x, y + size + 3);
      }
    },
    [hoveredNode]
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

  const handleNodeHover = useCallback((node: FGNode | null) => {
    setHoveredNode(node);
    if (node && graphRef.current?.graph2ScreenCoords) {
      const coords = graphRef.current.graph2ScreenCoords(
        node.x ?? 0,
        node.y ?? 0
      );
      setTooltipPos({ x: coords.x, y: coords.y - 12 });
    }
  }, []);

  const handleLinkColor = useCallback((link: FGLink) => {
    return (linkColors[link.relType ?? ""] ?? "#444") + "AA";
  }, []);

  const handleLinkWidth = useCallback((link: FGLink) => {
    if (link.relType === "APPEARS_IN") return 4;
    if (link.relType === "HIRED") return 3;
    return 2.5;
  }, []);

  if (!mounted) {
    return (
      <div
        className="flex h-[500px] items-center justify-center rounded-lg"
        style={{ backgroundColor: graphBg }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-800 border-t-amber-600" />
          <p className="font-mono text-xs text-neutral-600">
            Loading graph...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[500px] overflow-hidden rounded-lg border border-white/[0.08]"
      style={{ backgroundColor: graphBg }}
    >
      {/* Graph canvas — pinned to z-0 */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeId="id"
          nodeCanvasObject={handleNodeCanvas}
          nodePointerAreaPaint={handlePointerArea}
          onNodeHover={handleNodeHover}
          linkColor={handleLinkColor}
          linkWidth={handleLinkWidth}
          linkCurvature={0.2}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleSpeed={0.004}
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

      {/* Hover tooltip */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-30 rounded shadow-lg"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 44,
            backgroundColor: "rgba(12,12,12,0.95)",
            border: "1px solid #2A2A2A",
            padding: "8px 12px",
            maxWidth: 240,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: nodeColors[hoveredNode.nodeType] }}
            />
            <span className="text-xs font-medium text-neutral-200">
              {hoveredNode.label}
            </span>
          </div>
          <div className="mt-1 flex gap-3 text-[10px] text-neutral-500">
            <span>{hoveredNode.nodeType.replace("_", " ")}</span>
            {hoveredNode.degree != null && (
              <span>{hoveredNode.degree} connections</span>
            )}
          </div>
        </div>
      )}

      {/* Stats + CTA overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between p-4">
        <div
          className="rounded px-3 py-1.5 font-mono text-xs"
          style={{
            backgroundColor: "rgba(12,12,12,0.9)",
            border: "1px solid #333",
            color: "#666",
          }}
        >
          {graphData.nodes.length} nodes &middot; {graphData.links.length} edges
        </div>

        <Link
          href="/explorer"
          className="rounded px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "rgba(184,115,51,0.15)",
            border: "1px solid rgba(184,115,51,0.3)",
            color: "#D4A574",
          }}
        >
          Explore Full Graph &rarr;
        </Link>
      </div>

      {/* Compact legend (top-right) */}
      {loaded && (
        <div
          className="absolute right-3 top-3 z-20 rounded p-2.5"
          style={{
            backgroundColor: "rgba(12,12,12,0.88)",
            border: "1px solid #2A2A2A",
          }}
        >
          <div className="space-y-0.5">
            {(
              [
                ["person", "Person"],
                ["designer", "Designer"],
                ["location", "Location"],
                ["style", "Style"],
              ] as const
            ).map(([type, label]) => (
              <div
                key={type}
                className="flex items-center gap-1.5 text-[9px] text-neutral-500"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: nodeColors[type] }}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
