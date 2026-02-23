"use client";

import { useMounted } from "@/lib/use-mounted";
import { GROUP_COLORS } from "@/lib/design-tokens";
import { useRef, useState, useEffect } from "react";

/* ────────────────────────────────────────────────────────────
   3-year smoothed yearly axis means (from data/yearly_axis_means.json)
   Truncated to 1988-2025 (2026 has only n=17)
   ──────────────────────────────────────────────────────────── */

interface YearRow {
  year: number;
  Grandeur: number;
  MaterialWarmth: number;
  Maximalism: number;
  Historicism: number;
  Provenance: number;
  Hospitality: number;
  Formality: number;
  Curation: number;
  Theatricality: number;
}

const DATA: YearRow[] = [
  { year:1988, Grandeur:3.559, MaterialWarmth:4.245, Maximalism:4.072, Historicism:3.611, Provenance:3.814, Hospitality:3.212, Formality:3.046, Curation:3.309, Theatricality:2.276 },
  { year:1989, Grandeur:3.609, MaterialWarmth:4.227, Maximalism:3.941, Historicism:3.615, Provenance:3.754, Hospitality:3.164, Formality:3.018, Curation:3.322, Theatricality:2.225 },
  { year:1990, Grandeur:3.577, MaterialWarmth:4.278, Maximalism:3.928, Historicism:3.683, Provenance:3.741, Hospitality:3.129, Formality:2.993, Curation:3.312, Theatricality:2.159 },
  { year:1991, Grandeur:3.551, MaterialWarmth:4.317, Maximalism:3.915, Historicism:3.737, Provenance:3.741, Hospitality:3.124, Formality:2.986, Curation:3.336, Theatricality:2.138 },
  { year:1992, Grandeur:3.413, MaterialWarmth:4.413, Maximalism:3.989, Historicism:3.789, Provenance:3.792, Hospitality:3.097, Formality:2.889, Curation:3.304, Theatricality:2.079 },
  { year:1993, Grandeur:3.349, MaterialWarmth:4.399, Maximalism:3.939, Historicism:3.767, Provenance:3.792, Hospitality:3.047, Formality:2.782, Curation:3.282, Theatricality:2.079 },
  { year:1994, Grandeur:3.292, MaterialWarmth:4.415, Maximalism:3.904, Historicism:3.699, Provenance:3.818, Hospitality:3.010, Formality:2.609, Curation:3.210, Theatricality:1.971 },
  { year:1995, Grandeur:3.375, MaterialWarmth:4.393, Maximalism:3.839, Historicism:3.640, Provenance:3.779, Hospitality:3.057, Formality:2.628, Curation:3.230, Theatricality:2.032 },
  { year:1996, Grandeur:3.433, MaterialWarmth:4.430, Maximalism:3.797, Historicism:3.566, Provenance:3.699, Hospitality:3.073, Formality:2.644, Curation:3.275, Theatricality:2.028 },
  { year:1997, Grandeur:3.504, MaterialWarmth:4.386, Maximalism:3.688, Historicism:3.528, Provenance:3.548, Hospitality:3.136, Formality:2.790, Curation:3.413, Theatricality:2.165 },
  { year:1998, Grandeur:3.512, MaterialWarmth:4.382, Maximalism:3.744, Historicism:3.571, Provenance:3.484, Hospitality:3.149, Formality:2.927, Curation:3.535, Theatricality:2.220 },
  { year:1999, Grandeur:3.566, MaterialWarmth:4.340, Maximalism:3.697, Historicism:3.582, Provenance:3.431, Hospitality:3.246, Formality:3.051, Curation:3.627, Theatricality:2.330 },
  { year:2000, Grandeur:3.580, MaterialWarmth:4.287, Maximalism:3.679, Historicism:3.579, Provenance:3.365, Hospitality:3.262, Formality:3.083, Curation:3.682, Theatricality:2.314 },
  { year:2001, Grandeur:3.592, MaterialWarmth:4.206, Maximalism:3.512, Historicism:3.439, Provenance:3.267, Hospitality:3.301, Formality:3.074, Curation:3.683, Theatricality:2.356 },
  { year:2002, Grandeur:3.538, MaterialWarmth:4.146, Maximalism:3.399, Historicism:3.308, Provenance:3.203, Hospitality:3.246, Formality:3.011, Curation:3.654, Theatricality:2.320 },
  { year:2003, Grandeur:3.568, MaterialWarmth:4.189, Maximalism:3.393, Historicism:3.227, Provenance:3.211, Hospitality:3.264, Formality:2.981, Curation:3.657, Theatricality:2.347 },
  { year:2004, Grandeur:3.650, MaterialWarmth:4.100, Maximalism:3.346, Historicism:3.158, Provenance:3.168, Hospitality:3.302, Formality:2.985, Curation:3.677, Theatricality:2.363 },
  { year:2005, Grandeur:3.740, MaterialWarmth:4.017, Maximalism:3.294, Historicism:3.104, Provenance:3.132, Hospitality:3.353, Formality:3.018, Curation:3.715, Theatricality:2.379 },
  { year:2006, Grandeur:3.803, MaterialWarmth:3.937, Maximalism:3.164, Historicism:3.040, Provenance:2.995, Hospitality:3.418, Formality:3.056, Curation:3.745, Theatricality:2.443 },
  { year:2007, Grandeur:3.774, MaterialWarmth:3.987, Maximalism:3.127, Historicism:2.974, Provenance:2.884, Hospitality:3.429, Formality:3.013, Curation:3.741, Theatricality:2.462 },
  { year:2008, Grandeur:3.764, MaterialWarmth:4.045, Maximalism:3.084, Historicism:2.955, Provenance:2.763, Hospitality:3.465, Formality:2.974, Curation:3.771, Theatricality:2.499 },
  { year:2009, Grandeur:3.786, MaterialWarmth:4.038, Maximalism:3.115, Historicism:2.943, Provenance:2.710, Hospitality:3.458, Formality:2.989, Curation:3.792, Theatricality:2.506 },
  { year:2010, Grandeur:3.826, MaterialWarmth:3.946, Maximalism:3.172, Historicism:2.967, Provenance:2.821, Hospitality:3.464, Formality:3.044, Curation:3.862, Theatricality:2.579 },
  { year:2011, Grandeur:3.839, MaterialWarmth:3.895, Maximalism:3.396, Historicism:3.011, Provenance:3.003, Hospitality:3.425, Formality:3.073, Curation:3.878, Theatricality:2.628 },
  { year:2012, Grandeur:3.816, MaterialWarmth:3.827, Maximalism:3.518, Historicism:2.982, Provenance:3.085, Hospitality:3.496, Formality:3.099, Curation:3.919, Theatricality:2.743 },
  { year:2013, Grandeur:3.831, MaterialWarmth:3.771, Maximalism:3.587, Historicism:2.936, Provenance:3.052, Hospitality:3.540, Formality:3.081, Curation:3.928, Theatricality:2.799 },
  { year:2014, Grandeur:3.889, MaterialWarmth:3.684, Maximalism:3.539, Historicism:2.855, Provenance:2.990, Hospitality:3.673, Formality:3.089, Curation:3.934, Theatricality:2.871 },
  { year:2015, Grandeur:3.902, MaterialWarmth:3.693, Maximalism:3.563, Historicism:2.887, Provenance:3.099, Hospitality:3.644, Formality:3.004, Curation:3.872, Theatricality:2.828 },
  { year:2016, Grandeur:3.785, MaterialWarmth:3.737, Maximalism:3.591, Historicism:2.843, Provenance:3.237, Hospitality:3.586, Formality:2.754, Curation:3.694, Theatricality:2.698 },
  { year:2017, Grandeur:3.639, MaterialWarmth:3.809, Maximalism:3.617, Historicism:2.830, Provenance:3.370, Hospitality:3.439, Formality:2.537, Curation:3.579, Theatricality:2.575 },
  { year:2018, Grandeur:3.555, MaterialWarmth:3.826, Maximalism:3.668, Historicism:2.790, Provenance:3.386, Hospitality:3.376, Formality:2.406, Curation:3.513, Theatricality:2.545 },
  { year:2019, Grandeur:3.448, MaterialWarmth:3.904, Maximalism:3.704, Historicism:2.838, Provenance:3.387, Hospitality:3.266, Formality:2.372, Curation:3.521, Theatricality:2.509 },
  { year:2020, Grandeur:3.465, MaterialWarmth:3.951, Maximalism:3.706, Historicism:2.798, Provenance:3.284, Hospitality:3.272, Formality:2.389, Curation:3.557, Theatricality:2.558 },
  { year:2021, Grandeur:3.364, MaterialWarmth:3.985, Maximalism:3.557, Historicism:2.683, Provenance:3.205, Hospitality:3.155, Formality:2.291, Curation:3.550, Theatricality:2.482 },
  { year:2022, Grandeur:3.395, MaterialWarmth:4.010, Maximalism:3.527, Historicism:2.656, Provenance:3.183, Hospitality:3.187, Formality:2.327, Curation:3.598, Theatricality:2.511 },
  { year:2023, Grandeur:3.314, MaterialWarmth:4.054, Maximalism:3.573, Historicism:2.773, Provenance:3.238, Hospitality:3.177, Formality:2.319, Curation:3.569, Theatricality:2.429 },
  { year:2024, Grandeur:3.302, MaterialWarmth:4.149, Maximalism:3.665, Historicism:2.955, Provenance:3.396, Hospitality:3.123, Formality:2.360, Curation:3.526, Theatricality:2.318 },
  { year:2025, Grandeur:3.403, MaterialWarmth:4.257, Maximalism:3.622, Historicism:3.169, Provenance:3.414, Hospitality:3.125, Formality:2.418, Curation:3.581, Theatricality:2.328 },
];

/* ── Chart configuration ── */

type AxisKey = keyof Omit<YearRow, "year">;

interface SeriesConfig {
  key: AxisKey;
  label: string;
  fillType: "hatch" | "solid-light" | "solid-dark";
}

interface ChartConfig {
  title: string;
  groupLabel: string;
  series: [SeriesConfig, SeriesConfig, SeriesConfig];
}

const CHARTS: ChartConfig[] = [
  {
    title: "The Physical Experience",
    groupLabel: "SPACE",
    series: [
      { key: "MaterialWarmth", label: "Material Warmth", fillType: "solid-dark" },
      { key: "Maximalism", label: "Maximalism", fillType: "solid-light" },
      { key: "Grandeur", label: "Grandeur", fillType: "hatch" },
    ],
  },
  {
    title: "The Narrative It Tells",
    groupLabel: "STORY",
    series: [
      { key: "Provenance", label: "Provenance", fillType: "solid-dark" },
      { key: "Historicism", label: "Historicism", fillType: "solid-light" },
      { key: "Hospitality", label: "Hospitality", fillType: "hatch" },
    ],
  },
  {
    title: "Who It\u2019s Performing For",
    groupLabel: "STAGE",
    series: [
      { key: "Curation", label: "Curation", fillType: "solid-dark" },
      { key: "Formality", label: "Formality", fillType: "solid-light" },
      { key: "Theatricality", label: "Theatricality", fillType: "hatch" },
    ],
  },
];

/* Y-axis range — crop to where the data actually lives */
const Y_MIN = 1.5;
const Y_MAX = 4.8;

/* Margins */
const ML = 0;   // left (no y-axis labels)
const MR = 0;   // right
const MT = 32;  // top (room for callouts)
const MB = 24;  // bottom (x-axis ticks)

/* ── Catmull-Rom → cubic bezier path generation ── */

interface Pt { x: number; y: number }

/** Convert data points to catmull-rom cubic bezier SVG path (smooth curve) */
function catmullRomPath(points: Pt[], tension = 0.35): string {
  if (points.length < 2) return "";
  const n = points.length;

  // Pad with phantom points for edge tangents
  const pts: Pt[] = [
    { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
    ...points,
    { x: 2 * points[n - 1].x - points[n - 2].x, y: 2 * points[n - 1].y - points[n - 2].y },
  ];

  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let i = 1; i < n; i++) {
    const p0 = pts[i];      // i-1 + 1 (padded)
    const p1 = pts[i + 1];  // i + 1
    const p2 = pts[i + 2];  // i+1 + 1

    const cp1x = p1.x + (p1.x - p0.x) * tension;
    const cp1y = p1.y + (p1.y - p0.y) * tension;
    const cp2x = p2.x - (pts[i + 2].x - p1.x) * tension;
    const cp2y = p2.y - (pts[i + 2].y - p1.y) * tension;

    // Wait — let me use the standard catmull-rom to bezier conversion.
    // For segment from points[i-1] to points[i]:
    const _p0 = pts[i - 1 + 1]; // original points[i-1]
    const _p1 = pts[i + 1];     // original points[i]

    // Tangent at _p0: (pts[i+1] - pts[i-1]) * tension
    // Tangent at _p1: (pts[i+2] - pts[i]) * tension
    const t0x = (pts[i + 1].x - pts[i - 1].x) * tension;
    const t0y = (pts[i + 1].y - pts[i - 1].y) * tension;
    const t1x = (pts[i + 2].x - pts[i].x) * tension;
    const t1y = (pts[i + 2].y - pts[i].y) * tension;

    const c1x = _p0.x + t0x / 3;
    const c1y = _p0.y + t0y / 3;
    const c2x = _p1.x - t1x / 3;
    const c2y = _p1.y - t1y / 3;

    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${_p1.x.toFixed(2)},${_p1.y.toFixed(2)}`;
  }

  return d;
}

/** Make a closed area path (curve + straight bottom edge) */
function areaPath(points: Pt[], bottomY: number): string {
  const curve = catmullRomPath(points);
  if (!curve) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x.toFixed(2)},${bottomY.toFixed(2)} L ${first.x.toFixed(2)},${bottomY.toFixed(2)} Z`;
}

/* ── Fill styles — derived from GROUP_COLORS ── */

/** Parse hex to [r,g,b] */
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Darken an RGB color by factor (0 = black, 1 = original) */
function darken([r, g, b]: [number, number, number], f: number): [number, number, number] {
  return [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
}

/** Build fill styles for a given group color hex */
function groupFillStyles(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  const [dr, dg, db] = darken([r, g, b], 0.7);
  return {
    hatch: {
      hatchFill: `rgba(${r},${g},${b},0.15)`,
      hatchStroke: hex,
      strokeColor: hex,
      strokeWidth: 1.2,
    },
    "solid-light": {
      fillColor: `rgba(${r},${g},${b},0.30)`,
      strokeColor: `rgba(${r},${g},${b},0.7)`,
      strokeWidth: 1,
    },
    "solid-dark": {
      fillColor: `rgba(${dr},${dg},${db},0.45)`,
      strokeColor: `rgb(${dr},${dg},${db})`,
      strokeWidth: 1,
    },
  } as const;
}

/** Per-group fill style lookup */
const GROUP_FILL_STYLES: Record<string, ReturnType<typeof groupFillStyles>> = {
  SPACE: groupFillStyles(GROUP_COLORS.SPACE),
  STORY: groupFillStyles(GROUP_COLORS.STORY),
  STAGE: groupFillStyles(GROUP_COLORS.STAGE),
};

/* ── Single chart component ── */

function SingleChart({ config }: { config: ChartConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const height = 260;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const chartW = width - ML - MR;
  const chartH = height - MT - MB;

  /** Map data coordinates to SVG coordinates */
  function toSvg(year: number, score: number): Pt {
    const x = ML + ((year - 1988) / (2025 - 1988)) * chartW;
    const y = MT + (1 - (score - Y_MIN) / (Y_MAX - Y_MIN)) * chartH;
    return { x, y };
  }

  const bottomY = MT + chartH;

  /** Find a good callout position for each series (near a local max) */
  function findCalloutYear(key: AxisKey): number {
    // Find the year with the max value for this axis
    let bestYear = 2005;
    let bestVal = -Infinity;
    for (const row of DATA) {
      if (row.year < 1992 || row.year > 2020) continue; // avoid edges
      const v = row[key] as number;
      if (v > bestVal) { bestVal = v; bestYear = row.year; }
    }
    return bestYear;
  }

  // Compute callout positions — spread them apart
  const calloutYears: number[] = [];
  for (const s of config.series) {
    let cy = findCalloutYear(s.key);
    // Ensure minimum 5-year gap from existing callouts
    for (const existing of calloutYears) {
      if (Math.abs(cy - existing) < 6) {
        // Shift by searching for next best peak
        const candidates = DATA
          .filter(r => r.year >= 1992 && r.year <= 2020)
          .filter(r => calloutYears.every(e => Math.abs(r.year - e) >= 6))
          .sort((a, b) => (b[s.key] as number) - (a[s.key] as number));
        if (candidates.length > 0) cy = candidates[0].year;
      }
    }
    calloutYears.push(cy);
  }

  // X-axis ticks
  const xTicks = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025];

  return (
    <div ref={containerRef} className="w-full">
      {/* Chart title */}
      <div className="mb-2 flex items-baseline gap-2">
        <span
          className="text-[8px] font-bold uppercase tracking-[0.15em]"
          style={{ fontFamily: "futura-pt, sans-serif", color: GROUP_COLORS[config.groupLabel] || "#B87333" }}
        >
          {config.groupLabel}
        </span>
        <span
          className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          {config.title}
        </span>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        style={{ fontFamily: "futura-pt, sans-serif" }}
      >
        <defs>
          {/* Diagonal hatching pattern */}
          <pattern
            id={`hatch-${config.groupLabel}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill={GROUP_FILL_STYLES[config.groupLabel]?.hatch.hatchFill ?? "rgba(180,162,130,0.15)"} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={GROUP_FILL_STYLES[config.groupLabel]?.hatch.hatchStroke ?? "#8B7355"} strokeWidth="1" opacity="0.5" />
          </pattern>
        </defs>

        {/* Subtle horizontal grid lines */}
        {[2, 3, 4].map((score) => {
          const y = toSvg(1988, score).y;
          return (
            <line
              key={score}
              x1={ML}
              y1={y}
              x2={width - MR}
              y2={y}
              stroke="#E0DDD6"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Area fills — render back to front (first series = back) */}
        {config.series.map((s, idx) => {
          const points = DATA.map((row) => toSvg(row.year, row[s.key] as number));
          const path = areaPath(points, bottomY);
          const gStyles = GROUP_FILL_STYLES[config.groupLabel];
          const fill = s.fillType === "hatch"
            ? `url(#hatch-${config.groupLabel})`
            : gStyles[s.fillType].fillColor;

          return (
            <path
              key={s.key}
              d={path}
              fill={fill}
              stroke="none"
              style={{ mixBlendMode: idx > 0 ? "multiply" : undefined }}
            />
          );
        })}

        {/* Stroke lines on top (reverse order so front line renders last) */}
        {[...config.series].reverse().map((s) => {
          const points = DATA.map((row) => toSvg(row.year, row[s.key] as number));
          const curvePath = catmullRomPath(points);
          const gStyles = GROUP_FILL_STYLES[config.groupLabel];
          const sStyle = gStyles[s.fillType];

          return (
            <path
              key={`stroke-${s.key}`}
              d={curvePath}
              fill="none"
              stroke={sStyle.strokeColor}
              strokeWidth={sStyle.strokeWidth}
              opacity={0.8}
            />
          );
        })}

        {/* Callout annotations */}
        {config.series.map((s, idx) => {
          const year = calloutYears[idx];
          const row = DATA.find((r) => r.year === year);
          if (!row) return null;
          const val = row[s.key] as number;
          const pt = toSvg(year, val);

          // Stagger callout heights
          const calloutY = 6 + idx * 9;

          return (
            <g key={`callout-${s.key}`}>
              {/* Vertical line from callout to curve */}
              <line
                x1={pt.x}
                y1={calloutY + 4}
                x2={pt.x}
                y2={pt.y}
                stroke="#999"
                strokeWidth={0.5}
              />
              {/* Small circle at curve intersection */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={3}
                fill={GROUP_FILL_STYLES[config.groupLabel]?.[s.fillType]?.strokeColor ?? "#8B7355"}
                stroke="#FAFAFA"
                strokeWidth={1.5}
              />
              {/* Label */}
              <text
                x={pt.x}
                y={calloutY}
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
                letterSpacing="0.12em"
                fill="#4A3828"
                style={{ textTransform: "uppercase" } as React.CSSProperties}
              >
                {s.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* X-axis ticks */}
        {xTicks.map((year) => {
          const x = toSvg(year, Y_MIN).x;
          return (
            <text
              key={year}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize="8"
              fill="#AAAAAA"
              letterSpacing="0.03em"
            >
              {year}
            </text>
          );
        })}

        {/* Bottom axis line */}
        <line x1={ML} y1={bottomY} x2={width - MR} y2={bottomY} stroke="#D4CFC4" strokeWidth={0.75} />
      </svg>
    </div>
  );
}

/* ── Exported triptych ── */

export function FeltronAreaCharts() {
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {CHARTS.map((config) => (
        <SingleChart key={config.groupLabel} config={config} />
      ))}
    </div>
  );
}
