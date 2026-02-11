"use client";

import { useState } from "react";
import type { GraphPreset } from "@/lib/graph-types";

interface GraphControlsProps {
  activePreset: GraphPreset;
  loading: boolean;
  onFetchGraph: (
    preset: GraphPreset,
    params?: Record<string, string>
  ) => void;
}

export function GraphControls({
  activePreset,
  loading,
  onFetchGraph,
}: GraphControlsProps) {
  const [egoName, setEgoName] = useState("");
  const [egoDepth, setEgoDepth] = useState(2);
  const [pathFrom, setPathFrom] = useState("");
  const [pathTo, setPathTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; label: string; verdict?: string | null }[]
  >([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    presets: true,
    search: true,
    ego: false,
    path: false,
  });

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const presets: {
    key: GraphPreset;
    label: string;
    description: string;
  }[] = [
    {
      key: "full",
      label: "Overview",
      description: "Full graph (connected nodes only)",
    },
    {
      key: "epstein",
      label: "Epstein Links",
      description: "All Epstein-linked persons",
    },
    {
      key: "shared-designers",
      label: "Shared Designers",
      description: "People sharing designers with flagged persons",
    },
    {
      key: "hubs",
      label: "Most Connected",
      description: "Highest-degree person nodes",
    },
  ];

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/graph?preset=search&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setSearchResults(
        (data.results ?? []).map(
          (r: {
            id: string;
            label: string;
            detectiveVerdict?: string | null;
          }) => ({
            id: r.id,
            label: r.label,
            verdict: r.detectiveVerdict,
          })
        )
      );
    } catch {
      setSearchResults([]);
    }
  }

  const inputClass =
    "w-full rounded border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-500 border-neutral-700/50 text-neutral-200 placeholder:text-neutral-600";
  const btnClass =
    "w-full rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50";
  const sectionHeader =
    "flex w-full items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 cursor-pointer hover:text-neutral-400 transition-colors";

  return (
    <div className="space-y-1 p-4">
      {/* Title */}
      <div className="border-b border-neutral-800/50 pb-3">
        <h2 className="font-serif text-lg font-bold text-neutral-100">
          Connection Explorer
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
          Interactive knowledge graph of AD-featured people, designers, and
          Epstein connections.
        </p>
      </div>

      {/* Presets */}
      <div>
        <button onClick={() => toggle("presets")} className={sectionHeader}>
          <span>Presets</span>
          <span className="text-neutral-700">
            {expanded.presets ? "\u2212" : "+"}
          </span>
        </button>
        {expanded.presets && (
          <div className="space-y-0.5 pb-2">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => onFetchGraph(p.key)}
                disabled={loading}
                className={`w-full rounded px-3 py-2 text-left text-sm transition-all ${
                  activePreset === p.key
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
                } disabled:opacity-50`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="mt-0.5 block text-[10px] opacity-40">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div>
        <button onClick={() => toggle("search")} className={sectionHeader}>
          <span>Search</span>
          <span className="text-neutral-700">
            {expanded.search ? "\u2212" : "+"}
          </span>
        </button>
        {expanded.search && (
          <div className="space-y-2 pb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Type a name..."
              className={inputClass}
            />
            {searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border border-neutral-800">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onFetchGraph("ego", {
                        name: r.label,
                        depth: String(egoDepth),
                      });
                      setSearchQuery(r.label);
                      setSearchResults([]);
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800/60"
                  >
                    <span>{r.label}</span>
                    {r.verdict === "YES" && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          backgroundColor: "#D4A04A22",
                          color: "#D4A04A",
                        }}
                      >
                        Flagged
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ego Network */}
      <div>
        <button onClick={() => toggle("ego")} className={sectionHeader}>
          <span>Ego Network</span>
          <span className="text-neutral-700">
            {expanded.ego ? "\u2212" : "+"}
          </span>
        </button>
        {expanded.ego && (
          <div className="space-y-2 pb-2">
            <input
              type="text"
              value={egoName}
              onChange={(e) => setEgoName(e.target.value)}
              placeholder="Person name"
              className={inputClass}
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-600">Depth:</label>
              <input
                type="range"
                min={1}
                max={3}
                value={egoDepth}
                onChange={(e) => setEgoDepth(Number(e.target.value))}
                className="flex-1 accent-amber-600"
              />
              <span className="w-4 text-center font-mono text-xs text-neutral-500">
                {egoDepth}
              </span>
            </div>
            <button
              onClick={() => {
                if (egoName.trim()) {
                  onFetchGraph("ego", {
                    name: egoName.trim(),
                    depth: String(egoDepth),
                  });
                }
              }}
              disabled={loading || !egoName.trim()}
              className={btnClass}
            >
              Explore
            </button>
          </div>
        )}
      </div>

      {/* Shortest Path */}
      <div>
        <button onClick={() => toggle("path")} className={sectionHeader}>
          <span>Shortest Path</span>
          <span className="text-neutral-700">
            {expanded.path ? "\u2212" : "+"}
          </span>
        </button>
        {expanded.path && (
          <div className="space-y-2 pb-2">
            <input
              type="text"
              value={pathFrom}
              onChange={(e) => setPathFrom(e.target.value)}
              placeholder="From person"
              className={inputClass}
            />
            <input
              type="text"
              value={pathTo}
              onChange={(e) => setPathTo(e.target.value)}
              placeholder="To person"
              className={inputClass}
            />
            <button
              onClick={() => {
                if (pathFrom.trim() && pathTo.trim()) {
                  onFetchGraph("shortest", {
                    from: pathFrom.trim(),
                    to: pathTo.trim(),
                  });
                }
              }}
              disabled={loading || !pathFrom.trim() || !pathTo.trim()}
              className={btnClass}
            >
              Find Path
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
