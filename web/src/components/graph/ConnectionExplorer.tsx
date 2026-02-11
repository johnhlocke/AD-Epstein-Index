"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useMounted } from "@/lib/use-mounted";
import type { GraphData, GraphNode, GraphPreset } from "@/lib/graph-types";
import {
  nodeColors,
  linkColors,
  uncertaintyColor,
  uncertaintyConfig,
  graphBg,
  nodeSize,
  getConfidenceLevel,
  LABEL_DEGREE_THRESHOLD,
  LABEL_ZOOM_THRESHOLD,
} from "@/lib/graph-types";
import { GraphControls } from "./GraphControls";
import { NodeDetails } from "./NodeDetails";

// react-force-graph-2d must be dynamically imported (no SSR — uses Canvas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as any;

/** Internal node type after force-graph adds x/y */
interface FGNode extends GraphNode {
  x?: number;
  y?: number;
}

interface FGLink {
  source: FGNode | string;
  target: FGNode | string;
  relType?: string;
}

export function ConnectionExplorer() {
  const mounted = useMounted();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<FGNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<GraphPreset>("full");

  // ── Data fetching ──────────────────────────────────────────

  const fetchGraph = useCallback(
    async (preset: GraphPreset, params: Record<string, string> = {}) => {
      setLoading(true);
      setError(null);
      setSelectedNode(null);
      setHoveredNode(null);

      const searchParams = new URLSearchParams({ preset, ...params });
      try {
        const res = await fetch(`/api/graph?${searchParams}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data: GraphData = await res.json();

        if (data.nodes?.length === 0) {
          setError(
            "No results found. The graph may be empty — run sync_graph.py first."
          );
        }

        setGraphData(data);
        setActivePreset(preset);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph");
        setGraphData({ nodes: [], links: [] });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load full graph on mount
  useEffect(() => {
    if (mounted) {
      fetchGraph("full");
    }
  }, [mounted, fetchGraph]);

  // Fit to view after simulation settles (cooldownTime=3000 + buffer)
  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      // First fit: quick orientation
      const early = setTimeout(() => {
        graphRef.current?.zoomToFit?.(400, 100);
      }, 600);
      // Second fit: after simulation cools down — nodes in final positions
      const late = setTimeout(() => {
        graphRef.current?.zoomToFit?.(600, 100);
      }, 3200);
      return () => {
        clearTimeout(early);
        clearTimeout(late);
      };
    }
  }, [graphData]);

  // ── Interaction handlers ───────────────────────────────────

  const handleNodeClick = useCallback((node: FGNode) => {
    setSelectedNode(node);
    if (graphRef.current?.centerAt && node.x != null && node.y != null) {
      graphRef.current.centerAt(node.x, node.y, 600);
      graphRef.current.zoom(2.5, 600);
    }
  }, []);

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

  // ── Canvas rendering ───────────────────────────────────────

  const handleNodeCanvas = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = nodeSize(node.degree ?? 0, node.pagerank);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const color = nodeColors[node.nodeType] ?? "#888";
      const confidence = getConfidenceLevel(node);
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;

      ctx.save();

      // ── 1. Uncertainty ring (gold, blur varies with confidence) ──
      if (confidence !== null) {
        const uc = uncertaintyConfig[confidence];

        ctx.save();
        ctx.shadowColor = uncertaintyColor;
        ctx.shadowBlur = uc.blur;

        // Outer uncertainty ring
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = uncertaintyColor;
        ctx.lineWidth = uc.ringWidth / globalScale;
        ctx.globalAlpha = uc.ringOpacity;
        ctx.stroke();

        // Uncertainty fill (solid for high confidence, fading to transparent)
        if (uc.fillOpacity > 0.05) {
          ctx.beginPath();
          ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
          ctx.fillStyle = uncertaintyColor;
          ctx.globalAlpha = uc.fillOpacity * 0.3;
          ctx.fill();
        }

        ctx.restore();
      }

      // ── 2. Selection ring ──
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 6, 0, 2 * Math.PI);
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // ── 3. Hover highlight ──
      if (isHovered && !isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // ── 4. Node body ──
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 16 : isHovered ? 10 : 4;

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.globalAlpha = 1;
      ctx.stroke();

      // Inner fill
      ctx.beginPath();
      ctx.arc(x, y, size * 0.55, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered ? 0.9 : 0.7;
      ctx.fill();

      ctx.restore();

      // ── 5. Labels ──
      const showLabel =
        isSelected ||
        isHovered ||
        (node.degree ?? 0) >= LABEL_DEGREE_THRESHOLD ||
        globalScale > LABEL_ZOOM_THRESHOLD;

      if (showLabel) {
        const fontSize = Math.max(10 / globalScale, 1.8);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Text shadow for readability against dark bg
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillText(node.label, x + 0.5, y + size + 4 + 0.5);

        ctx.fillStyle =
          isSelected || isHovered
            ? "rgba(255,255,255,0.95)"
            : "rgba(255,255,255,0.65)";
        ctx.fillText(node.label, x, y + size + 4);
      }
    },
    [selectedNode, hoveredNode]
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

  const handleLinkColor = useCallback((link: FGLink) => {
    const relType = link.relType ?? "";
    return (linkColors[relType] ?? "#444") + "AA";
  }, []);

  const handleLinkWidth = useCallback((link: FGLink) => {
    if (link.relType === "APPEARS_IN") return 4;
    if (link.relType === "HIRED") return 3;
    return 2.5;
  }, []);

  // ── Zoom controls ──────────────────────────────────────────

  const zoomIn = () =>
    graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 300);
  const zoomOut = () =>
    graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 300);
  const zoomReset = () => graphRef.current?.zoomToFit(400, 60);

  // ── Render ─────────────────────────────────────────────────

  if (!mounted) {
    return (
      <div
        className="flex h-[calc(100vh-56px)] items-center justify-center"
        style={{ backgroundColor: graphBg }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-800 border-t-amber-600" />
          <p className="font-mono text-xs text-neutral-600">
            Loading explorer...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left sidebar: controls */}
      <div
        className="w-[260px] shrink-0 overflow-y-auto border-r"
        style={{
          backgroundColor: "#0F0F0F",
          borderColor: "#1A1A1A",
          color: "#DDD",
        }}
      >
        <GraphControls
          activePreset={activePreset}
          loading={loading}
          onFetchGraph={fetchGraph}
        />
      </div>

      {/* Center: graph canvas */}
      <div
        ref={containerRef}
        className="relative flex-1"
        style={{ backgroundColor: graphBg }}
      >
        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
            style={{ backgroundColor: "rgba(10,10,10,0.92)" }}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-800 border-t-amber-600" />
            <p className="font-mono text-xs text-neutral-600">
              Loading graph...
            </p>
          </div>
        )}

        {/* Error message */}
        {error && !loading && (
          <div
            className="absolute left-4 top-4 z-20 rounded border px-4 py-2 text-sm"
            style={{
              backgroundColor: "#1A1A1A",
              borderColor: "#333",
              color: "#999",
            }}
          >
            {error}
          </div>
        )}

        {/* Force graph — pinned to z-0 so overlays render above */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeId="id"
            nodeCanvasObject={handleNodeCanvas}
            nodePointerAreaPaint={handlePointerArea}
            onNodeClick={handleNodeClick}
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
          />
        </div>

        {/* Hover tooltip */}
        {hoveredNode && !selectedNode && (
          <div
            className="pointer-events-none absolute z-30 rounded shadow-lg"
            style={{
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 44,
              backgroundColor: "rgba(12,12,12,0.95)",
              border: "1px solid #2A2A2A",
              padding: "8px 12px",
              maxWidth: 260,
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
            {getConfidenceLevel(hoveredNode) && (
              <div
                className="mt-1 flex items-center gap-1.5 text-[10px]"
                style={{ color: uncertaintyColor }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: uncertaintyColor }}
                />
                {getConfidenceLevel(hoveredNode)!.replace("_", " ")} confidence
              </div>
            )}
          </div>
        )}

        {/* Stats badge (bottom-left) */}
        <div
          className="absolute bottom-4 left-4 z-20 rounded px-3 py-1.5 font-mono text-xs"
          style={{
            backgroundColor: "rgba(15,15,15,0.92)",
            border: "1px solid #333",
            color: "#666",
          }}
        >
          {graphData.nodes.length} nodes &middot; {graphData.links.length} edges
        </div>

        {/* Zoom controls (bottom-right) */}
        <div className="absolute bottom-4 right-4 z-20 flex gap-1">
          {[
            { label: "\u2212", action: zoomOut },
            { label: "\u27F3", action: zoomReset },
            { label: "+", action: zoomIn },
          ].map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className="flex h-7 w-7 items-center justify-center rounded text-xs font-mono transition-colors hover:bg-neutral-600"
              style={{
                backgroundColor: "rgba(20,20,20,0.92)",
                border: "1px solid #333",
                color: "#888",
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Canvas legend overlay (top-right) */}
        <div
          className="absolute right-4 top-4 z-20 space-y-3 rounded p-3"
          style={{
            backgroundColor: "rgba(15,15,15,0.92)",
            border: "1px solid #333",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Node types */}
          <div>
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
              Node Types
            </p>
            <div className="space-y-1">
              {(
                [
                  ["person", "Person"],
                  ["designer", "Designer"],
                  ["location", "Location"],
                  ["style", "Style"],
                  ["issue", "Issue"],
                  ["author", "Author"],
                  ["epstein_source", "Epstein Source"],
                ] as const
              ).map(([type, label]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 text-[10px] text-neutral-500"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: nodeColors[type] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Uncertainty levels */}
          <div className="border-t border-neutral-800 pt-2">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
              Data Uncertainty
            </p>
            <div className="space-y-1.5">
              {(
                [
                  ["high", "High confidence"],
                  ["good", "Good confidence"],
                  ["medium", "Medium confidence"],
                  ["low", "Low confidence"],
                  ["very_low", "Very low confidence"],
                ] as const
              ).map(([level, label]) => {
                const uc = uncertaintyConfig[level];
                return (
                  <div
                    key={level}
                    className="flex items-center gap-2 text-[10px] text-neutral-500"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: `rgba(212,160,74,${uc.fillOpacity})`,
                        border: `1.5px solid ${uncertaintyColor}`,
                        boxShadow: `0 0 ${uc.blur}px rgba(212,160,74,${uc.ringOpacity * 0.6})`,
                      }}
                    />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar: node details (appears on click) */}
      {selectedNode && (
        <div
          className="w-[300px] shrink-0 overflow-y-auto border-l"
          style={{
            backgroundColor: "#0F0F0F",
            borderColor: "#1A1A1A",
            color: "#DDD",
          }}
        >
          <NodeDetails
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onExplore={(name) => fetchGraph("ego", { name })}
          />
        </div>
      )}
    </div>
  );
}
