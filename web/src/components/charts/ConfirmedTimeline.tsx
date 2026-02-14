"use client";

import { useMounted } from "@/lib/use-mounted";
import { USMapDiagram } from "./USMapDiagram";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface TimelineEntry {
  personName: string;
  year: number;
  month: number | null;
  connectionStrength: string | null;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
}

interface ConfirmedTimelineProps {
  data: TimelineEntry[];
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
    let xOff = 0;
    let yOff = 0;
    if (total === 2) {
      // Two dots: offset left/right by ~0.8 year
      xOff = idx === 0 ? -0.8 : 0.8;
    } else if (total === 3) {
      // Three dots: triangle pattern
      const offsets = [
        { dx: -0.8, dy: -0.25 },
        { dx: 0.8, dy: -0.25 },
        { dx: 0, dy: 0.3 },
      ];
      xOff = offsets[idx].dx;
      yOff = offsets[idx].dy;
    } else if (total > 3) {
      // Spread in a ring
      const angle = (idx / total) * 2 * Math.PI;
      xOff = Math.cos(angle) * 0.8;
      yOff = Math.sin(angle) * 0.3;
    }

    return {
      ...d,
      x: d.year + xOff,
      y: m + yOff,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy } = props as {
    cx: number;
    cy: number;
  };
  if (cx == null || cy == null) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={14}
      fill={COPPER}
      fillOpacity={0.3}
      stroke={COPPER}
      strokeOpacity={0.2}
      strokeWidth={0.5}
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

  return (
    <div className="rounded border border-border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-foreground">{d.personName}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Featured {dateStr}
      </p>
      {locStr && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{locStr}</p>
      )}
      {d.connectionStrength && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Strength: {d.connectionStrength}
        </p>
      )}
    </div>
  );
}

/**
 * "Where and When" — three-panel editorial layout.
 *
 * Columns 1-2: section label, description text, stat count.
 * Columns 3-4: minimal US map with semi-transparent copper dots.
 * Columns 5-6: compact temporal scatter chart.
 *
 * Both diagrams share the same copper palette and dot style.
 */
export function ConfirmedTimeline({ data }: ConfirmedTimelineProps) {
  const mounted = useMounted();

  const plotData = toPlotPoints(data);

  if (!mounted || data.length === 0) {
    return null;
  }

  return (
    <div>
      {/* ── Three-column content ── */}
      <div className="grid items-start gap-6 md:grid-cols-3">
        {/* ── Left: Editorial text ── */}
        <div className="flex flex-col">
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            Confirmed names span three decades of Architectural Digest. The
            clustering is not random &mdash; it peaks during the late 1990s and
            early 2000s, the years of Epstein&rsquo;s most active social
            networking. The geographic concentration along both coasts mirrors the
            wealth corridors where Epstein operated.
          </p>

        </div>

        {/* ── Center: US map ── */}
        <USMapDiagram
          locations={data.map((d) => ({
            personName: d.personName,
            locationCity: d.locationCity,
            locationState: d.locationState,
            locationCountry: d.locationCountry,
          }))}
        />

        {/* ── Right: Compact timeline chart ── */}
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
      </div>
    </div>
  );
}
