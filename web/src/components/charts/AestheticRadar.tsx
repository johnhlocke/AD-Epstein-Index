"use client";

import { useMounted } from "@/lib/use-mounted";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/**
 * Aesthetic Radar — 6-dimension taxonomy spider chart.
 *
 * Stub component with placeholder data. Will be populated with
 * real taxonomy scores once the aesthetic analysis is complete.
 */

const COPPER = "#B87333";

const PLACEHOLDER_DATA = [
  { dimension: "Formality", epstein: 78, baseline: 52 },
  { dimension: "Scale", epstein: 85, baseline: 60 },
  { dimension: "Ornamentation", epstein: 72, baseline: 55 },
  { dimension: "Color Palette", epstein: 65, baseline: 58 },
  { dimension: "Material Cost", epstein: 90, baseline: 48 },
  { dimension: "Historical Ref.", epstein: 70, baseline: 45 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded border px-3 py-2 text-xs"
      style={{
        backgroundColor: "#1a0e2e",
        borderColor: "#2a2a3a",
        color: "#E0E0E5",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <p className="font-bold">{d.dimension}</p>
      <p style={{ color: COPPER }}>Epstein-linked: {d.epstein}</p>
      <p style={{ color: "rgba(46, 204, 113, 0.7)" }}>Baseline: {d.baseline}</p>
    </div>
  );
}

export function AestheticRadar() {
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <div
      className="h-[400px] overflow-hidden rounded border"
      style={{
        backgroundColor: "rgba(26, 14, 46, 0.6)",
        borderColor: "#2a2a3a",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={PLACEHOLDER_DATA} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#2a2a3a" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{
              fontSize: 10,
              fill: "#A0A0B0",
              fontFamily: "JetBrains Mono, monospace",
            }}
          />
          <Radar
            name="Epstein-linked homes"
            dataKey="epstein"
            stroke={COPPER}
            fill={COPPER}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Radar
            name="AD baseline"
            dataKey="baseline"
            stroke="rgba(46, 204, 113, 0.7)"
            fill="rgba(46, 204, 113, 0.15)"
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
