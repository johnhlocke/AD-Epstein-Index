"use client";

import { useMounted } from "@/lib/use-mounted";
import { Separator } from "@/components/ui/separator";
import type { AestheticRadarData } from "@/lib/types";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COPPER = "#B87333";
const BASELINE_GREEN = "rgba(46, 204, 113, 0.7)";

interface AestheticRadarProps {
  data?: AestheticRadarData;
  /** "standalone" renders with editorial text on light bg; "embedded" renders chart-only on dark bg */
  variant?: "standalone" | "embedded";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded border border-border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-foreground">
        {(d.dimension as string).replace("\n", " ")}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: COPPER }}>
        Epstein orbit: {d.epstein}%
      </p>
      <p className="text-[11px]" style={{ color: BASELINE_GREEN }}>
        AD baseline: {d.baseline}%
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTick({ payload, x, y, textAnchor }: any) {
  const lines = (payload.value as string).split("\n");
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={10}
      fill="#999"
      fontFamily="futura-pt, sans-serif"
    >
      {lines.map((line: string, i: number) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTick({ payload, x, y, textAnchor }: any) {
  const lines = (payload.value as string).split("\n");
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={10}
      fill="#A0A0B0"
      fontFamily="JetBrains Mono, monospace"
    >
      {lines.map((line: string, i: number) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Aesthetic Radar — 6-axis spider chart comparing Epstein orbit
 * aesthetic profile against the AD baseline population.
 *
 * Two variants:
 *  - "standalone" (default): light bg, editorial text left, chart right (for page sections)
 *  - "embedded": dark bg, chart only (for MethodologySection dark panel)
 */
export function AestheticRadar({
  data,
  variant = "standalone",
}: AestheticRadarProps) {
  const mounted = useMounted();

  if (!mounted) return null;

  const axes = data?.axes ?? [];
  const hasData = axes.length > 0;

  // ── Embedded variant (dark bg, chart only) ──
  if (variant === "embedded") {
    return (
      <div
        className="h-[400px] overflow-hidden rounded border"
        style={{
          backgroundColor: "rgba(26, 14, 46, 0.6)",
          borderColor: "#2a2a3a",
        }}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={axes} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#2a2a3a" />
              <PolarAngleAxis dataKey="dimension" tick={<DarkTick />} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 8, fill: "rgba(160,160,176,0.4)" }}
                tickCount={5}
                axisLine={false}
              />
              <Radar
                name="Epstein orbit"
                dataKey="epstein"
                stroke={COPPER}
                fill={COPPER}
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Radar
                name="AD baseline"
                dataKey="baseline"
                stroke={BASELINE_GREEN}
                fill="rgba(46, 204, 113, 0.15)"
                fillOpacity={0.15}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p
              className="text-[11px] tracking-wider"
              style={{
                color: "rgba(160, 160, 176, 0.4)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              AESTHETIC DATA LOADING...
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Standalone variant (light bg, editorial layout) ──
  if (!hasData) return null;

  return (
    <div>
      {/* ── Section header ── */}
      <p
        className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
        style={{ fontFamily: "futura-pt, sans-serif" }}
      >
        The Epstein Aesthetic
      </p>

      <Separator className="mt-2 mb-5" />

      {/* ── Two-column layout: text + chart ── */}
      <div className="grid items-start gap-8 md:grid-cols-3">
        {/* ── Left: Editorial text ── */}
        <div className="flex flex-col">
          <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
            Across {data!.epsteinCount} features linked to Epstein&rsquo;s orbit
            and {data!.baselineCount} in the general AD population, a distinct
            aesthetic signature emerges. Homes connected to the Epstein network
            skew toward classical grandeur, old-money art collections, and
            opulent stone &mdash; while actively avoiding the minimalism that
            defines much of contemporary design culture.
          </p>
          <p className="mt-4 font-serif text-[13px] leading-[1.75] text-foreground/40">
            Each axis shows the percentage of homes in each group that match the
            trait. The copper silhouette traces the Epstein orbit; the dashed
            green line shows what&rsquo;s typical across all of AD.
          </p>
        </div>

        {/* ── Right: Radar chart (spans 2 cols) ── */}
        <div
          className="col-span-2 h-[420px] overflow-hidden rounded border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "#FAFAFA" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={axes}
              cx="50%"
              cy="50%"
              outerRadius="68%"
            >
              <PolarGrid stroke="#E0E0E0" strokeWidth={0.5} />
              <PolarAngleAxis dataKey="dimension" tick={<CustomTick />} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 8, fill: "#C0C0C0" }}
                tickCount={5}
                axisLine={false}
              />
              <Radar
                name="Epstein orbit"
                dataKey="epstein"
                stroke={COPPER}
                fill={COPPER}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Radar
                name="AD baseline"
                dataKey="baseline"
                stroke={BASELINE_GREEN}
                fill="rgba(46, 204, 113, 0.05)"
                fillOpacity={0.05}
                strokeWidth={1.5}
                strokeDasharray="5 3"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  fontFamily: "futura-pt, sans-serif",
                  paddingTop: 8,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
