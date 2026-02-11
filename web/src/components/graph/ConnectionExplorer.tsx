"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useMounted } from "@/lib/use-mounted";
import type { GraphData, GraphNode, GraphPreset } from "@/lib/graph-types";
import {
  nodeColors,
  linkColors,
  epsteinRingColor,
  graphBg,
  nodeSize,
} from "@/lib/graph-types";
import { GraphControls } from "./GraphControls";
import { NodeDetails } from "./NodeDetails";

// react-force-graph-2d must be dynamically imported (no SSR — uses Canvas).
// Cast to any: the library's generic node type conflicts with our custom GraphNode shape.
const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d"),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as any;

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
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<GraphPreset>("full");

  const fetchGraph = useCallback(
    async (preset: GraphPreset, params: Record<string, string> = {}) => {
      setLoading(true);
      setError(null);
      setSelectedNode(null);

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

  const handleNodeClick = useCallback((node: FGNode) => {
    setSelectedNode(node);
    if (graphRef.current?.centerAt && node.x != null && node.y != null) {
      graphRef.current.centerAt(node.x, node.y, 400);
    }
  }, []);

  const handleNodeCanvas = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = nodeSize(node.degree ?? 0, node.pagerank);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const color = nodeColors[node.nodeType] ?? "#888";
      const isEpsteinLinked = node.detectiveVerdict === "YES";
      const isSelected = selectedNode?.id === node.id;

      // Outer glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 20 : isEpsteinLinked ? 14 : 8;

      // Epstein ring (larger, red glow)
      if (isEpsteinLinked) {
        ctx.shadowColor = epsteinRingColor;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = epsteinRingColor;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      // Inner fill (darker, semi-transparent center)
      ctx.beginPath();
      ctx.arc(x, y, size * 0.55, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();

      // Label — only on hover/select or when very zoomed in
      if (isSelected || (globalScale > 2.5 && (node.degree ?? 0) > 1)) {
        const fontSize = Math.max(9 / globalScale, 1.5);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.label, x, y + size + 3);
      }
    },
    [selectedNode]
  );

  const handlePointerArea = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const size = nodeSize(node.degree ?? 0, node.pagerank);
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, size + 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const handleLinkColor = useCallback((link: FGLink) => {
    const relType = link.relType ?? "";
    const base = linkColors[relType] ?? "#444";
    // Return with alpha for subtlety
    return base + "88"; // ~53% opacity via hex alpha
  }, []);

  if (!mounted) {
    return (
      <div
        className="flex h-[calc(100vh-56px)] items-center justify-center"
        style={{ backgroundColor: graphBg }}
      >
        <p className="text-neutral-500 font-mono text-sm">
          Loading explorer...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left sidebar: controls */}
      <div
        className="w-[280px] shrink-0 overflow-y-auto border-r p-4"
        style={{
          backgroundColor: "#111",
          borderColor: "#222",
          color: "#DDD",
        }}
      >
        <GraphControls
          activePreset={activePreset}
          loading={loading}
          onFetchGraph={fetchGraph}
        />
      </div>

      {/* Center: graph */}
      <div className="relative flex-1" style={{ backgroundColor: graphBg }}>
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ backgroundColor: "rgba(10,10,10,0.85)" }}
          >
            <p className="font-mono text-sm text-neutral-500">
              Loading graph...
            </p>
          </div>
        )}

        {error && !loading && (
          <div
            className="absolute left-4 top-4 z-10 rounded px-4 py-2 text-sm shadow"
            style={{
              backgroundColor: "#1A1A1A",
              borderColor: "#333",
              color: "#999",
            }}
          >
            {error}
          </div>
        )}

        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeId="id"
          nodeCanvasObject={handleNodeCanvas}
          nodePointerAreaPaint={handlePointerArea}
          onNodeClick={handleNodeClick}
          linkColor={handleLinkColor}
          linkWidth={1}
          linkCurvature={0.3}
          linkDirectionalParticles={0}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          cooldownTime={3000}
          backgroundColor={graphBg}
        />

        {/* Stats bar */}
        <div
          className="absolute bottom-4 left-4 z-10 rounded px-3 py-1.5 font-mono text-xs"
          style={{
            backgroundColor: "rgba(20,20,20,0.9)",
            border: "1px solid #222",
            color: "#666",
          }}
        >
          {graphData.nodes.length} nodes &middot; {graphData.links.length}{" "}
          edges
        </div>
      </div>

      {/* Right sidebar: node details */}
      {selectedNode && (
        <div
          className="w-[320px] shrink-0 overflow-y-auto border-l p-4"
          style={{
            backgroundColor: "#111",
            borderColor: "#222",
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
