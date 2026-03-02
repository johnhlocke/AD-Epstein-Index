"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMounted } from "@/lib/use-mounted";
import { CategorySkewChart } from "./CategorySkewChart";
import { USMapDiagram } from "./USMapDiagram";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface TimelineEntry {
  dossierId: number;
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

/** Seeded pseudo-random for deterministic jitter (won't shift on re-render). */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/** Map entries to x/y with random jitter so dots look organic, not gridded. */
function toPlotPoints(data: TimelineEntry[]): PlotPoint[] {
  return data.map((d, i) => {
    const m = d.month ?? 6;
    // Seeded random offsets — consistent per entry
    const rx = seededRandom(i * 2 + 1) * 2 - 1;      // -1 to 1
    const ry = seededRandom(i * 2 + 2) * 2 - 1;      // -1 to 1
    return {
      ...d,
      x: d.year + rx * 0.08,
      y: m + ry * 0.08,
    };
  });
}

const DOT_COLOR = "#999999";
const DOT_R = 4;

/** Compute annual counts for the frequency line overlay. */
function getAnnualCounts(data: TimelineEntry[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const d of data) {
    if (d.year > 0) counts.set(d.year, (counts.get(d.year) ?? 0) + 1);
  }
  return counts;
}

/**
 * Build an SVG path string for the annual frequency line.
 * Maps year → x pixel and count → y pixel within the plot area.
 * Uses Catmull-Rom → cubic Bezier for smooth curves.
 */
function buildFrequencyPath(
  annualCounts: Map<number, number>,
  plotLeft: number,
  plotRight: number,
  plotTop: number,
  plotBottom: number,
): string {
  const xMin = 1988;
  const xMax = 2026;
  const maxCount = Math.max(...Array.from(annualCounts.values()), 1);

  const toX = (yr: number) => plotLeft + ((yr - xMin) / (xMax - xMin)) * (plotRight - plotLeft);
  // high count → top (plotTop), zero → bottom (plotBottom)
  const toY = (c: number) => plotBottom - (c / maxCount) * (plotBottom - plotTop);

  const points: [number, number][] = [];
  for (let yr = 1988; yr <= 2025; yr++) {
    points.push([toX(yr), toY(annualCounts.get(yr) ?? 0)]);
  }

  if (points.length < 2) return "";

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(i - 2, 0)];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[Math.min(i + 1, points.length - 1)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 12;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 12;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 12;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 12;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={DOT_R}
      fill={DOT_COLOR}
      fillOpacity={0.45}
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
      <p className="mt-1 text-[9px]" style={{ color: "#B87333" }}>Click to view dossier</p>
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
  const annualCounts = getAnnualCounts(data);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [linePath, setLinePath] = useState("");
  const [areaPath, setAreaPath] = useState("");
  const [plotBounds, setPlotBounds] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);

  // Measure the chart's plot area and build the SVG paths.
  // Uses the .recharts-surface SVG element + known chart margins/axis sizes.
  const updateLine = useCallback(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const surface = container.querySelector(".recharts-surface");
    if (!surface) return;

    const containerRect = container.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    // Chart margins: top=20, right=6, bottom=20, left=6
    // YAxis width=28, XAxis height=20
    const plotLeft = surfaceRect.left - containerRect.left + 6 + 28;
    const plotRight = surfaceRect.right - containerRect.left - 6;
    const plotTop = surfaceRect.top - containerRect.top + 20;
    const plotBottom = surfaceRect.bottom - containerRect.top - 20 - 20;
    setPlotBounds({ left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom });
    const line = buildFrequencyPath(annualCounts, plotLeft, plotRight, plotTop, plotBottom);
    setLinePath(line);
    // Close the path along the x-axis to create a filled area
    if (line) {
      const xMin = 1988;
      const xMax = 2026;
      const toX = (yr: number) => plotLeft + ((yr - xMin) / (xMax - xMin)) * (plotRight - plotLeft);
      setAreaPath(`${line} L${toX(2025)},${plotBottom} L${toX(1988)},${plotBottom} Z`);
    }
  }, [annualCounts]);

  useEffect(() => {
    if (!mounted) return;
    // Initial build after chart renders
    const timer = setTimeout(updateLine, 400);
    // Rebuild on resize
    const observer = new ResizeObserver(updateLine);
    if (chartContainerRef.current) observer.observe(chartContainerRef.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [mounted, updateLine]);

  if (!mounted || data.length === 0) {
    return null;
  }

  return (
    <div>
      {/* ── Two-column row: Fig. 5 + Fig. 6 ── */}
      <div className="grid items-start gap-6 md:grid-cols-2">
        {/* ── Left: Category dumbbell chart ── */}
        <div className="flex flex-col">
          <div
            className="overflow-hidden border"
            style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
          >
            <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
              <p
                className="text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
              >
                What Do They Do?<br />
                <span style={{ fontWeight: 400, color: "#666" }}>Subject Category: Epstein Orbit vs. AD Baseline</span>
              </p>
            </div>
            <div className="h-[340px]">
              <CategorySkewChart data={categoryBreakdown} />
            </div>
          </div>
          <p className="n-caption">
            Fig. 5 &mdash; The Epstein orbit skews heavily toward Business and Celebrity
            categories &mdash; together accounting for over half of confirmed
            connections.{" "}
            <a href="/data/category-breakdown" className="underline underline-offset-2" style={{ color: "#B87333" }}>
              View source data&nbsp;&rarr;
            </a>
          </p>
        </div>

        {/* ── Center: US map + caption ── */}
        <div className="flex flex-col">
          <div
            className="overflow-hidden border"
            style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
          >
            <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
              <p
                className="text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
              >
                Where Do They Live?<br />
                <span style={{ fontWeight: 400, color: "#666" }}>Geographic Distribution of Confirmed Connections</span>
              </p>
            </div>
            <USMapDiagram
              locations={data.map((d) => ({
                personName: d.personName,
                locationCity: d.locationCity,
                locationState: d.locationState,
                locationCountry: d.locationCountry,
              }))}
            />
          </div>
          <p className="n-caption">
            Fig. 6 &mdash; Confirmed connections concentrate along the Northeast corridor and
            Southern California &mdash; mirroring the wealth corridors where
            Epstein operated.
          </p>
        </div>
      </div>

      {/* ── Fig. 7: Timeline scatter — own row, 2 major columns wide ── */}
      <div className="mt-6" style={{ maxWidth: "calc(4 * (100% - 5 * 24px) / 6 + 3 * 24px)" }}>
        <div
          className="overflow-hidden border"
          style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
        >
          <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
            <p
              className="text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
            >
              When Were They Featured?<br />
              <span style={{ fontWeight: 400, color: "#666" }}>AD Epstein Features Per Year Closely Follow His Legal Timeline</span>
            </p>
          </div>
          <div ref={chartContainerRef} className="relative h-[460px]">
            {/* SVG overlay for frequency line + hatched area fill (z-10, below tooltip z-20) */}
            {linePath && (
              <svg className="pointer-events-none absolute inset-0" style={{ width: "100%", height: "100%", zIndex: 10 }}>
                <defs>
                  <pattern id="freq-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="5" stroke="#C0392B" strokeWidth="1" strokeOpacity="0.75" />
                  </pattern>
                </defs>
                {areaPath && <path d={areaPath} fill="url(#freq-hatch)" stroke="none" />}
                <path d={linePath} fill="none" stroke="#C0392B" strokeWidth={3} />
                {/* Callout lines + labels for key events */}
                {plotBounds && (() => {
                  const xMin = 1988;
                  const xMax = 2026;
                  const maxCount = Math.max(...Array.from(annualCounts.values()), 1);
                  const toX = (yr: number) => plotBounds.left + ((yr - xMin) / (xMax - xMin)) * (plotBounds.right - plotBounds.left);
                  const toY = (c: number) => plotBounds.bottom - (c / maxCount) * (plotBounds.bottom - plotBounds.top);
                  // Y axis domain is [0.5, 12.5] reversed — map month to pixel
                  const monthToY = (m: number) => plotBounds.top + ((m - (-0.5)) / (12.5 - (-0.5))) * (plotBounds.bottom - plotBounds.top);

                  // Position x at the actual month within the year (July 2006 ≈ 2006.5, Aug 2019 ≈ 2019.58)
                  // Linearly interpolate count between adjacent years for fractional positions
                  const lerpCount = (yr: number) => {
                    const y0 = Math.floor(yr);
                    const y1 = y0 + 1;
                    const c0 = annualCounts.get(y0) ?? 0;
                    const c1 = annualCounts.get(y1) ?? 0;
                    return c0 + (c1 - c0) * (yr - y0);
                  };

                  const arrest = { yearFrac: 2005 + 2 / 12, label: "2005: Epstein Arrested", labelLines: null as string[] | null, labelMonth: -0.6 };
                  const released = { yearFrac: 2009 + 6 / 12, label: "2009: Epstein Released", labelLines: null as string[] | null, labelMonth: -0.1 };
                  const rehab = { yearFrac: 2010 + 11 / 12, label: "2010: Seigal Rehabilitation", labelLines: null as string[] | null, labelMonth: 0.5 };
                  const death = { yearFrac: 2019 + 6 / 12, label: "", labelLines: ["2019: 2nd Arrest,", "Epstein Dies"], labelMonth: -0.6 };

                  return [arrest, released, rehab, death].map((evt) => {
                    const cx = toX(evt.yearFrac);
                    const cy = toY(lerpCount(evt.yearFrac));
                    const labelY = monthToY(evt.labelMonth);
                    return (
                      <g key={evt.yearFrac}>
                        <line x1={cx} y1={cy} x2={cx} y2={labelY - 10} stroke="#1A1A1A" strokeWidth={1.5} />
                        <circle cx={cx} cy={cy} r={4.5} fill="#1A1A1A" />
                        <text
                          x={cx + 5}
                          y={labelY}
                          textAnchor="start"
                          style={{
                            fontSize: 11,
                            fill: "#1A1A1A",
                            fontFamily: "futura-pt, sans-serif",
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                          }}
                        >
                          {evt.labelLines ? evt.labelLines.map((line, i) => (
                            <tspan key={i} x={cx + 5} dy={i === 0 ? 0 : 14}>{line}</tspan>
                          )) : evt.label}
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 6, bottom: 20, left: 6 }}
              >
                {/* ── Border lines: top + right edges ── */}
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[1988, 2026]}
                  ticks={[1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025]}
                  tickFormatter={(v: number) => String(Math.round(v))}
                  tick={{
                    fontSize: 8,
                    fill: "#1A1A1A",
                    fontFamily: "futura-pt, sans-serif",
                  }}
                  axisLine={{ stroke: "#1A1A1A", strokeWidth: 1 }}
                  tickLine={{ stroke: "#1A1A1A", strokeWidth: 0.5 }}
                  height={20}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[-0.5, 12.5]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                  tickFormatter={(v: number) =>
                    MONTH_ABBR[Math.round(v) - 1] ?? ""
                  }
                  tick={{
                    fontSize: 7,
                    fill: "#1A1A1A",
                    fontFamily: "futura-pt, sans-serif",
                  }}
                  axisLine={{ stroke: "#1A1A1A", strokeWidth: 1 }}
                  tickLine={{ stroke: "#1A1A1A", strokeWidth: 0.5 }}
                  width={28}
                  reversed
                />
                <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ zIndex: 20 }} />
                <Scatter
                  data={plotData}
                  shape={<CustomDot />}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {/* ── Legend ── */}
          <div
            className="flex items-center gap-5 px-3 py-2"
            style={{ borderTop: "1px solid #E5E5E5" }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-[8px] w-[8px] rounded-full"
                style={{ backgroundColor: DOT_COLOR }}
              />
              <span
                className="text-[9px] text-[#666]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Confirmed connection
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-[2.5px] w-[16px]"
                style={{ backgroundColor: "#C0392B", borderRadius: 1 }}
              />
              <span
                className="text-[9px] text-[#666]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Annual frequency (n/yr)
              </span>
            </div>
          </div>
        </div>
        <p className="n-caption">
          Fig. 7 &mdash; The frequency of Epstein-connected AD features tracks his
          legal trajectory: peaking during his social ascent, dropping sharply
          after his 2005 arrest, briefly recovering during the Seigal
          rehabilitation era, then collapsing permanently after his 2019 death.
        </p>
      </div>
    </div>
  );
}
