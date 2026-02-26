"use client";

import { useMounted } from "@/lib/use-mounted";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { CategorySkewChart } from "./CategorySkewChart";
import { USMapDiagram } from "./USMapDiagram";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface TimelineEntry {
  personName: string;
  year: number;
  month: number | null;
  connectionStrength: string | null;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  category: string | null;
}

interface CategoryRow {
  category: string;
  baselinePct: number;
  epsteinPct: number;
}

interface ConfirmedTimelineProps {
  data: TimelineEntry[];
  categoryBreakdown: CategoryRow[];
}

interface PlotPoint extends TimelineEntry {
  x: number;
  y: number;
}

const COPPER = "#B87333";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Map entries to x/y with jitter so overlapping year+month pairs separate */
function toPlotPoints(data: TimelineEntry[]): PlotPoint[] {
  // Count how many entries share each year+month cell
  const cellCounts = new Map<string, number>();
  for (const d of data) {
    const key = `${d.year}:${d.month ?? 6}`;
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }

  // Track how many we've placed per cell for offset calculation
  const cellIndex = new Map<string, number>();

  return data.map((d) => {
    const m = d.month ?? 6;
    const key = `${d.year}:${m}`;
    const total = cellCounts.get(key) ?? 1;
    const idx = cellIndex.get(key) ?? 0;
    cellIndex.set(key, idx + 1);

    // Apply jitter offsets when multiple dots share a cell
    // 1st: center, 2nd: right, 3rd: nudge up, 4th: nudge down, 5+: ring
    let xOff = 0;
    let yOff = 0;
    if (total === 2) {
      xOff = idx === 0 ? -0.8 : 0.8;
    } else if (total >= 3 && total <= 4) {
      const offsets = [
        { dx: -0.8, dy: 0 },
        { dx: 0.8, dy: 0 },
        { dx: 0, dy: -0.45 },
        { dx: 0, dy: 0.45 },
      ];
      xOff = offsets[idx]?.dx ?? 0;
      yOff = offsets[idx]?.dy ?? 0;
    } else if (total > 4) {
      const angle = (idx / total) * 2 * Math.PI;
      xOff = Math.cos(angle) * 0.8;
      yOff = Math.sin(angle) * 0.4;
    }

    return {
      ...d,
      x: d.year + xOff,
      y: m + yOff,
    };
  });
}

/** Radius varies by connection strength: HIGH=10, MEDIUM=8, LOW=6 */
function strengthRadius(strength: string | null): number {
  switch (strength?.toUpperCase()) {
    case "HIGH":
      return 15;
    case "LOW":
      return 10;
    default:
      return 12;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props as {
    cx: number;
    cy: number;
    payload: PlotPoint;
  };
  if (cx == null || cy == null) return null;

  const r = strengthRadius(payload?.connectionStrength);
  const cat = payload?.category ?? "Other";
  const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={colors.bg}
      fillOpacity={1}
      stroke="none"
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as PlotPoint;

  const dateStr = d.month
    ? `${MONTH_ABBR[d.month - 1]} ${d.year}`
    : String(d.year);

  const locParts = [d.locationCity, d.locationState].filter(Boolean);
  const locStr = locParts.length > 0 ? locParts.join(", ") : null;

  const cat = d.category ?? null;
  const catColors = cat ? (CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other) : null;

  return (
    <div className="rounded border border-border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-foreground">{d.personName}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Featured {dateStr}
      </p>
      {locStr && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{locStr}</p>
      )}
      {cat && catColors && (
        <span
          className="mt-1 inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-tight"
          style={{ backgroundColor: catColors.bg, color: catColors.text }}
        >
          {cat}
        </span>
      )}
    </div>
  );
}

/**
 * "Where and When" — three-panel editorial layout.
 *
 * Three equal-width diagrams: category breakdown, US map, temporal scatter.
 * All share the same height and styling conventions.
 */
export function ConfirmedTimeline({ data, categoryBreakdown }: ConfirmedTimelineProps) {
  const mounted = useMounted();

  const plotData = toPlotPoints(data);

  if (!mounted || data.length === 0) {
    return null;
  }

  return (
    <div>
      {/* ── Three-column content ── */}
      <div className="grid items-start gap-6 md:grid-cols-3">
        {/* ── Left: Category dumbbell chart ── */}
        <div className="flex flex-col">
          <div className="h-[340px]">
            <CategorySkewChart data={categoryBreakdown} />
          </div>
          <p className="mt-2 font-serif text-[12px] italic leading-[1.5] text-[#737373]">
            The Epstein orbit skews heavily toward Business and Celebrity
            categories — together accounting for over half of confirmed
            connections.
          </p>
        </div>

        {/* ── Center: US map + caption ── */}
        <div className="flex flex-col">
          <USMapDiagram
            locations={data.map((d) => ({
              personName: d.personName,
              locationCity: d.locationCity,
              locationState: d.locationState,
              locationCountry: d.locationCountry,
            }))}
          />
          <p className="mt-2 font-serif text-[12px] italic leading-[1.5] text-[#737373]">
            Confirmed connections concentrate along the Northeast corridor and
            Southern California — mirroring the wealth corridors where
            Epstein operated.
          </p>
        </div>

        {/* ── Right: Compact timeline chart + caption ── */}
        <div className="flex flex-col">
          <div
            className="h-[340px] overflow-hidden rounded border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
            style={{ backgroundColor: "#FAFAFA" }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
              >
                <CartesianGrid
                  strokeDasharray="none"
                  stroke="#ECECEC"
                  strokeWidth={0.5}
                />
                {/* ── Key date markers (rendered early so dots paint on top) ── */}
                <ReferenceLine
                  x={2005}
                  stroke="#B0B0B0"
                  strokeDasharray="3 3"
                  strokeWidth={0.75}
                  label={{
                    value: "Epstein Investigated",
                    position: "insideTopLeft",
                    angle: -90,
                    dx: -10,
                    dy: 8,
                    style: {
                      fontSize: 9,
                      fill: "#777777",
                      fontFamily: "futura-pt, sans-serif",
                      fontWeight: 500,
                      letterSpacing: "0.03em",
                    },
                  }}
                />
                <ReferenceLine
                  x={2008}
                  stroke="#B0B0B0"
                  strokeDasharray="3 3"
                  strokeWidth={0.75}
                  label={{
                    value: "Epstein Convicted",
                    position: "insideTopLeft",
                    angle: -90,
                    dx: -10,
                    dy: 8,
                    style: {
                      fontSize: 9,
                      fill: "#777777",
                      fontFamily: "futura-pt, sans-serif",
                      fontWeight: 500,
                      letterSpacing: "0.03em",
                    },
                  }}
                />
                <ReferenceLine
                  x={2010}
                  stroke="#B0B0B0"
                  strokeDasharray="3 3"
                  strokeWidth={0.75}
                  label={{
                    value: "Seigal Rehabilitates",
                    position: "insideTopLeft",
                    angle: -90,
                    dx: -10,
                    dy: 8,
                    style: {
                      fontSize: 9,
                      fill: "#777777",
                      fontFamily: "futura-pt, sans-serif",
                      fontWeight: 500,
                      letterSpacing: "0.03em",
                    },
                  }}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[1988, 2026]}
                  ticks={[1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025]}
                  tickFormatter={(v: number) => String(Math.round(v))}
                  tick={{
                    fontSize: 8,
                    fill: "#A3A3A3",
                    fontFamily: "futura-pt, sans-serif",
                  }}
                  axisLine={{ stroke: "#DCDCDC", strokeWidth: 1 }}
                  tickLine={{ stroke: "#DCDCDC", strokeWidth: 0.5 }}
                  height={20}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0.5, 12.5]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                  tickFormatter={(v: number) =>
                    MONTH_ABBR[Math.round(v) - 1] ?? ""
                  }
                  tick={{
                    fontSize: 7,
                    fill: "#A3A3A3",
                    fontFamily: "futura-pt, sans-serif",
                  }}
                  axisLine={{ stroke: "#DCDCDC", strokeWidth: 1 }}
                  tickLine={{ stroke: "#DCDCDC", strokeWidth: 0.5 }}
                  width={28}
                  reversed
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Scatter data={plotData} shape={<CustomDot />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 font-serif text-[12px] italic leading-[1.5] text-[#737373]">
            Features peak sharply between 1997 and 2003 — the period of
            Epstein&rsquo;s most expansive social networking — then taper
            after his first arrest in 2006.
          </p>
        </div>
      </div>
    </div>
  );
}
