"use client";

import { useState } from "react";
import type { GraphPreset } from "@/lib/graph-types";
import { nodeColors } from "@/lib/graph-types";

interface GraphControlsProps {
  activePreset: GraphPreset;
  loading: boolean;
  onFetchGraph: (preset: GraphPreset, params?: Record<string, string>) => void;
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

  const presets: {
    key: GraphPreset;
    label: string;
    description: string;
  }[] = [
    { key: "full", label: "Overview", description: "Full graph (connected nodes only)" },
    { key: "epstein", label: "Epstein Links", description: "All Epstein-linked persons" },
    { key: "shared-designers", label: "Shared Designers", description: "People sharing designers with flagged persons" },
    { key: "hubs", label: "Most Connected", description: "Highest-degree person nodes" },
  ];

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/graph?preset=search&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(
        (data.results ?? []).map((r: { id: string; label: string; detectiveVerdict?: string | null }) => ({
          id: r.id,
          label: r.label,
          verdict: r.detectiveVerdict,
        }))
      );
    } catch {
      setSearchResults([]);
    }
  }

  const inputClass =
    "w-full rounded border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-500 border-neutral-700 text-neutral-200 placeholder:text-neutral-600";
  const btnPrimary =
    "w-full rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg font-bold text-neutral-100">
          Connection Explorer
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Knowledge graph of AD-featured people, designers, and Epstein
          connections.
        </p>
      </div>

      {/* Preset buttons */}
      <div className="space-y-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Presets
        </h3>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => onFetchGraph(p.key)}
            disabled={loading}
            className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
              activePreset === p.key
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
            } disabled:opacity-50`}
          >
            <span className="font-medium">{p.label}</span>
            <span className="block text-[11px] opacity-50">{p.description}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Search Person
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Type a name..."
          className={inputClass}
        />
        {searchResults.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded border border-neutral-700">
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onFetchGraph("ego", { name: r.label, depth: String(egoDepth) });
                  setSearchQuery(r.label);
                  setSearchResults([]);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800"
              >
                <span>{r.label}</span>
                {r.verdict === "YES" && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: "#E05A4722", color: "#E05A47" }}>
                    Flagged
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ego network */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Ego Network
        </h3>
        <input
          type="text"
          value={egoName}
          onChange={(e) => setEgoName(e.target.value)}
          placeholder="Person name"
          className={inputClass}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-500">Depth:</label>
          <input
            type="range"
            min={1}
            max={3}
            value={egoDepth}
            onChange={(e) => setEgoDepth(Number(e.target.value))}
            className="flex-1 accent-neutral-500"
          />
          <span className="w-4 text-center font-mono text-xs text-neutral-400">
            {egoDepth}
          </span>
        </div>
        <button
          onClick={() => {
            if (egoName.trim()) {
              onFetchGraph("ego", { name: egoName.trim(), depth: String(egoDepth) });
            }
          }}
          disabled={loading || !egoName.trim()}
          className={`${btnPrimary} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}
        >
          Explore
        </button>
      </div>

      {/* Shortest path */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Shortest Path
        </h3>
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
              onFetchGraph("shortest", { from: pathFrom.trim(), to: pathTo.trim() });
            }
          }}
          disabled={loading || !pathFrom.trim() || !pathTo.trim()}
          className={`${btnPrimary} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}
        >
          Find Path
        </button>
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Legend
        </h3>
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
            <div key={type} className="flex items-center gap-2 text-xs text-neutral-400">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  border: `1.5px solid ${nodeColors[type]}`,
                  boxShadow: `0 0 4px ${nodeColors[type]}66`,
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
