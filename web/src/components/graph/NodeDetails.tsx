"use client";

import type { GraphNode } from "@/lib/graph-types";
import { nodeColors } from "@/lib/graph-types";

interface NodeDetailsProps {
  node: GraphNode;
  onClose: () => void;
  onExplore: (name: string) => void;
}

export function NodeDetails({ node, onClose, onExplore }: NodeDetailsProps) {
  const verdictBadge = () => {
    if (node.nodeType !== "person") return null;

    if (node.editorVerdict === "CONFIRMED") {
      return (
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "#2D6A4F33", color: "#5FBF8A" }}
        >
          Confirmed Connection
        </span>
      );
    }
    if (node.editorVerdict === "REJECTED") {
      return (
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "#E05A4722", color: "#E07A6A" }}
        >
          Rejected
        </span>
      );
    }
    if (node.detectiveVerdict === "YES") {
      return (
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "#D4A04A22", color: "#D4A04A" }}
        >
          Flagged — Pending Review
        </span>
      );
    }
    return null;
  };

  const properties: { label: string; value: string | number }[] = [];

  if (node.featureCount && node.featureCount > 0) {
    properties.push({ label: "AD Appearances", value: node.featureCount });
  }
  if (node.connectionStrength) {
    properties.push({ label: "Connection Strength", value: node.connectionStrength });
  }
  if (node.city || node.state || node.country) {
    const parts = [node.city, node.state, node.country].filter(Boolean);
    properties.push({ label: "Location", value: parts.join(", ") });
  }
  if (node.year) {
    const monthStr = node.month ? `${node.month}/` : "";
    properties.push({ label: "Issue Date", value: `${monthStr}${node.year}` });
  }
  if (node.degree != null) {
    properties.push({ label: "Connections", value: node.degree });
  }
  if (node.communityId != null) {
    properties.push({ label: "Community", value: `#${node.communityId}` });
  }
  if (node.pagerank != null) {
    properties.push({ label: "PageRank", value: node.pagerank.toFixed(4) });
  }
  if (node.betweenness != null && node.betweenness > 0) {
    properties.push({ label: "Betweenness", value: node.betweenness.toFixed(4) });
  }

  const color = nodeColors[node.nodeType] ?? "#888";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              border: `1.5px solid ${color}`,
              boxShadow: `0 0 6px ${color}66`,
            }}
          />
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
            {node.nodeType.replace("_", " ")}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300"
          aria-label="Close details"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </button>
      </div>

      {/* Name */}
      <h3 className="font-serif text-xl font-bold leading-tight text-neutral-100">
        {node.label}
      </h3>

      {/* Verdict badge */}
      {verdictBadge()}

      {/* Properties */}
      {properties.length > 0 && (
        <div
          className="space-y-2 border-t pt-3"
          style={{ borderColor: "#222" }}
        >
          {properties.map((p) => (
            <div key={p.label} className="flex justify-between text-sm">
              <span className="text-neutral-500">{p.label}</span>
              <span className="font-mono text-xs text-neutral-300">
                {p.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {node.nodeType === "person" && (
        <div className="space-y-2 border-t pt-3" style={{ borderColor: "#222" }}>
          <button
            onClick={() => onExplore(node.label)}
            className="w-full rounded bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
          >
            Explore Connections
          </button>
        </div>
      )}
    </div>
  );
}
