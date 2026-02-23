"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useMounted } from "@/lib/use-mounted";
import { GROUP_COLORS } from "@/lib/design-tokens";

/* ────────────────────────────────────────────────────────────
   Smoothed yearly axis means 1988–2025 (from data/yearly_axis_means.json)
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

/* ── Axis definitions ── */

type AxisKey = keyof Omit<YearRow, "year">;

interface AxisDef {
  key: AxisKey;
  label: string;
  group: "SPACE" | "STORY" | "STAGE";
}

const AXES: AxisDef[] = [
  { key: "Grandeur", label: "Grandeur", group: "SPACE" },
  { key: "MaterialWarmth", label: "Material\nWarmth", group: "SPACE" },
  { key: "Maximalism", label: "Maximalism", group: "SPACE" },
  { key: "Historicism", label: "Historicism", group: "STORY" },
  { key: "Provenance", label: "Provenance", group: "STORY" },
  { key: "Hospitality", label: "Hospitality", group: "STORY" },
  { key: "Formality", label: "Formality", group: "STAGE" },
  { key: "Curation", label: "Curation", group: "STAGE" },
  { key: "Theatricality", label: "Theatricality", group: "STAGE" },
];

const NUM_AXES = AXES.length;
const SCORE_MIN = 1;
const SCORE_MAX = 5;

/* ── Geometry helpers ── */

/** Angle for axis i (0 = top, clockwise) */
function axisAngle(i: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / NUM_AXES;
}

/** Convert a score (1–5) to a point at axis i, given center and radius */
function scoreToPoint(
  cx: number,
  cy: number,
  radius: number,
  axisIdx: number,
  score: number,
): { x: number; y: number } {
  const t = (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
  const r = t * radius;
  const a = axisAngle(axisIdx);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Interpolate between two hex colors. t=0 → colorA, t=1 → colorB. */
function lerpColor(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Interpolate between two points. t=0 → a, t=1 → b. */
function interpPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Group boundaries: where axis i and i+1 belong to different groups */
const BOUNDARIES = new Set<number>();
for (let i = 0; i < NUM_AXES; i++) {
  if (AXES[i].group !== AXES[(i + 1) % NUM_AXES].group) {
    BOUNDARIES.add(i);
  }
}

/** Build colored sector data from vertex points (center → adjacent data vertices) */
function buildSectors(
  cx: number,
  cy: number,
  points: { x: number; y: number }[],
) {
  const BLEND_STEPS = 6;
  const sectors: { d: string; gradId: string; color?: string }[] = [];

  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    const groupA = AXES[i].group;
    const groupB = AXES[next].group;

    if (BOUNDARIES.has(i)) {
      for (let s = 0; s < BLEND_STEPS; s++) {
        const t0 = s / BLEND_STEPS;
        const t1 = (s + 1) / BLEND_STEPS;
        const p0 = interpPoint(points[i], points[next], t0);
        const p1 = interpPoint(points[i], points[next], t1);
        const tMid = (t0 + t1) / 2;
        const blendColor = lerpColor(
          GROUP_COLORS[groupA],
          GROUP_COLORS[groupB],
          tMid,
        );
        sectors.push({
          d: `M${cx},${cy} L${p0.x.toFixed(1)},${p0.y.toFixed(1)} L${p1.x.toFixed(1)},${p1.y.toFixed(1)} Z`,
          gradId: `tl-blend-${i}-${s}`,
          color: blendColor,
        });
      }
    } else {
      sectors.push({
        d: `M${cx},${cy} L${points[i].x.toFixed(1)},${points[i].y.toFixed(1)} L${points[next].x.toFixed(1)},${points[next].y.toFixed(1)} Z`,
        gradId: `tl-grad-${groupA}`,
      });
    }
  }

  return sectors;
}

/** Build SVG polygon path from an array of scores (one per axis) */
function scoresPolygon(
  cx: number,
  cy: number,
  radius: number,
  scores: number[],
): string {
  return scores
    .map((s, i) => {
      const p = scoreToPoint(cx, cy, radius, i, s);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

/** Lerp between two number arrays */
function lerpScores(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * t);
}

/** Extract the 9 axis scores from a data row */
function rowScores(row: YearRow): number[] {
  return AXES.map((ax) => row[ax.key]);
}

/* ── Animation constants ── */
const MS_PER_YEAR = 250;
const LERP_DURATION = MS_PER_YEAR; // smooth transition matches frame timing

/* ── Component ── */

export function AestheticRadarTimelapse() {
  const mounted = useMounted();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [yearIndex, setYearIndex] = useState(0);
  const [interpT, setInterpT] = useState(0); // 0–1 between current and next year
  const [hasStarted, setHasStarted] = useState(false);

  const totalYears = DATA.length; // 38

  // IntersectionObserver: auto-play when scrolled into view
  useEffect(() => {
    if (!mounted) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setPlaying(true);
          setHasStarted(true);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, hasStarted]);

  // Animation loop
  useEffect(() => {
    if (!playing) return;

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const totalDuration = totalYears * LERP_DURATION;
      const loopTime = elapsed % totalDuration;

      const exactFrame = loopTime / LERP_DURATION;
      const frameIdx = Math.floor(exactFrame);
      const frameFrac = exactFrame - frameIdx;

      setYearIndex(frameIdx % totalYears);
      setInterpT(frameFrac);

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, totalYears]);

  const handleClick = useCallback(() => {
    if (playing) {
      setPlaying(false);
    } else {
      setPlaying(true);
      if (!hasStarted) setHasStarted(true);
    }
  }, [playing, hasStarted]);

  if (!mounted) return null;

  // ── Compute interpolated scores ──
  const currentRow = DATA[yearIndex];
  const nextRow = DATA[(yearIndex + 1) % totalYears];
  const currentScores = rowScores(currentRow);
  const nextScores = rowScores(nextRow);
  const interpScores = lerpScores(currentScores, nextScores, interpT);

  // Ghost trail: 5 previous years (oldest first → newest last = darkest)
  const GHOST_COUNT = 5;
  const ghostTrail: { scores: number[]; opacity: number }[] = [];
  for (let g = GHOST_COUNT; g >= 1; g--) {
    const idx = (yearIndex - g + totalYears) % totalYears;
    // Oldest ghost (g=GHOST_COUNT) is faintest, newest (g=1) is darkest
    const opacity = 0.12 + (1 - g / GHOST_COUNT) * 0.35;
    ghostTrail.push({ scores: rowScores(DATA[idx]), opacity });
  }

  // Display year (snap to the nearest)
  const displayYear = interpT > 0.5 ? nextRow.year : currentRow.year;

  // ── SVG dimensions ──
  const W = 520;
  const H = 460;
  const CX = W / 2;
  const CY = 210;
  const R = 155; // outer radius for score=5

  // ── Concentric grid rings ──
  const gridRings = [1, 2, 3, 4, 5];

  // ── Compute vertex points for the interpolated polygon ──
  const interpPoints = interpScores.map((score, i) =>
    scoreToPoint(CX, CY, R, i, score),
  );

  // ── Build colored sectors (center → data vertices, group-colored radial gradients) ──
  const sectors = buildSectors(CX, CY, interpPoints);

  // Max radius of any data vertex (for gradient sizing)
  const maxR = Math.max(
    ...interpPoints.map((p) => Math.sqrt((p.x - CX) ** 2 + (p.y - CY) ** 2)),
    1,
  );

  // ── Timeline progress ──
  const progress = (yearIndex + interpT) / (totalYears - 1);

  return (
    <div
      ref={containerRef}
      className="relative cursor-pointer rounded border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: "#FAFAFA" }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") handleClick(); }}
      aria-label={playing ? "Pause animation" : "Play animation"}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Aesthetic Drift: 37 Years of AD
        </span>
        <span
          className="text-[9px] uppercase tracking-[0.08em] text-[#AAAAAA]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          {playing ? "click to pause" : "click to play"}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto block w-full"
        style={{ maxWidth: W, fontFamily: "futura-pt, sans-serif" }}
      >
        <defs>
          {/* Radial gradients per group — transparent center → rich color at edge */}
          {(["SPACE", "STORY", "STAGE"] as const).map((g) => (
            <radialGradient
              key={g}
              id={`tl-grad-${g}`}
              cx={CX}
              cy={CY}
              r={maxR}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={GROUP_COLORS[g]} stopOpacity={0.05} />
              <stop offset="100%" stopColor={GROUP_COLORS[g]} stopOpacity={1.0} />
            </radialGradient>
          ))}
          {/* Radial gradients for blended boundary sectors */}
          {sectors.map((s) => {
            if (!s.color) return null;
            return (
              <radialGradient
                key={s.gradId}
                id={s.gradId}
                cx={CX}
                cy={CY}
                r={maxR}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.05} />
                <stop offset="100%" stopColor={s.color} stopOpacity={1.0} />
              </radialGradient>
            );
          })}
        </defs>

        {/* Colored sector fills — data-shaped triangles from center to vertices */}
        {sectors.map((s, i) => (
          <path
            key={`sector-${i}`}
            d={s.d}
            fill={`url(#${s.gradId})`}
          />
        ))}

        {/* Concentric grid rings */}
        {gridRings.map((score) => {
          const r = ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * R;
          return (
            <circle
              key={score}
              cx={CX}
              cy={CY}
              r={r}
              fill="none"
              stroke="#E0E0E0"
              strokeWidth={score === 5 ? 0.75 : 0.4}
            />
          );
        })}

        {/* Radial axis lines */}
        {AXES.map((_, i) => {
          const p = scoreToPoint(CX, CY, R, i, SCORE_MAX);
          return (
            <line
              key={`axis-${i}`}
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
              stroke="#E0E0E0"
              strokeWidth={0.4}
            />
          );
        })}

        {/* Axis labels */}
        {AXES.map((ax, i) => {
          const p = scoreToPoint(CX, CY, R + 30, i, SCORE_MAX);
          const lines = ax.label.split("\n");
          // Grandeur (top) — nudge down so it doesn't float above the chart
          const yAdj = i === 0 ? 4 : 0;
          return (
            <text
              key={`label-${i}`}
              x={p.x}
              y={p.y + yAdj}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fill="#888"
              stroke="#FAFAFA"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {lines.map((line, li) => (
                <tspan key={li} x={p.x} dy={li === 0 ? 0 : 13}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}

        {/* Ghost trail — 5 previous years, fading from old to recent */}
        {ghostTrail.map((ghost, gi) => (
          <path
            key={`ghost-${gi}`}
            d={scoresPolygon(CX, CY, R, ghost.scores)}
            fill="none"
            stroke="#888"
            strokeWidth={0.75}
            opacity={ghost.opacity}
          />
        ))}

        {/* Outer polygon stroke */}
        <path
          d={scoresPolygon(CX, CY, R, interpScores)}
          fill="none"
          stroke="#999"
          strokeWidth={1.5}
        />

        {/* Vertex dots colored by group */}
        {interpScores.map((score, i) => {
          const p = scoreToPoint(CX, CY, R, i, score);
          return (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill={GROUP_COLORS[AXES[i].group]}
              stroke="#FAFAFA"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Year display — large centered number */}
        <text
          x={CX}
          y={CY + R + 70}
          textAnchor="middle"
          fontSize={42}
          fontWeight="900"
          fill="#1A1A1A"
          opacity={0.85}
          letterSpacing="-0.02em"
        >
          {displayYear}
        </text>

        {/* Play/pause indicator */}
        {!playing && hasStarted && (
          <g transform={`translate(${CX}, ${CY})`} opacity={0.3}>
            <polygon points="-8,-12 -8,12 12,0" fill="#1A1A1A" />
          </g>
        )}
      </svg>

      {/* Timeline scrubber */}
      <div className="px-4 pb-3">
        <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-[#E5E5E5]">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-none"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: "#B87333",
              opacity: 0.6,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between">
          <span
            className="text-[8px] tabular-nums text-[#AAAAAA]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            1988
          </span>
          <span
            className="text-[8px] tabular-nums text-[#AAAAAA]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            2025
          </span>
        </div>
      </div>
    </div>
  );
}
