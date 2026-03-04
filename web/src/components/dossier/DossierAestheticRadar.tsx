"use client";

import { useMounted } from "@/lib/use-mounted";
import type { Feature } from "@/lib/types";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,

  Tooltip,
} from "recharts";

import { GROUP_COLORS } from "@/lib/design-tokens";

const COPPER = "#B87333";

/** Short axis labels for the radar (keep tight for small chart) */
const AXES = [
  { key: "score_grandeur", label: "Grandeur", group: "SPACE" },
  { key: "score_material_warmth", label: "Material\nWarmth", group: "SPACE" },
  { key: "score_maximalism", label: "Maximalism", group: "SPACE" },
  { key: "score_historicism", label: "Historicism", group: "STORY" },
  { key: "score_provenance", label: "Provenance", group: "STORY" },
  { key: "score_hospitality", label: "Hospitality", group: "STORY" },
  { key: "score_formality", label: "Formality", group: "STAGE" },
  { key: "score_curation", label: "Curation", group: "STAGE" },
  { key: "score_theatricality", label: "Theatricality", group: "STAGE" },
] as const;

/** Anchor descriptions keyed by axis → score (1-5) */
const ANCHORS: Record<string, Record<number, string>> = {
  score_grandeur: {
    1: "Human-scale rooms, 8-foot ceilings, books and clutter, drywall construction",
    2: "Comfortable rooms, adequate ceiling height, standard residential construction",
    3: "Clean, organized, generous proportions — quality but doesn't announce itself",
    4: "High ceilings, stone or substantial construction, impressive volume",
    5: "Triple-height spaces, gilded surfaces, glossy/reflective materials — the architecture dominates",
  },
  score_material_warmth: {
    1: "White marble floors, lacquered surfaces, chrome fixtures, glass — hard and cold",
    2: "Mostly cold materials with minor warm accents",
    3: "Balanced tension — worn wood floors with clean white walls",
    4: "Predominantly warm with some cool structure — paneled rooms, upholstered furniture",
    5: "Wide-plank oak, linen, leather, terracotta, stone fireplace — everything is tactile",
  },
  score_maximalism: {
    1: "Spare, minimal, few objects, open space — gallery-like emptiness",
    2: "Some objects but restrained, breathing room between things",
    3: "Moderate layering — objects present but not competing",
    4: "Dense and rich — many objects in harmony, consistent colors and textures",
    5: "Maximum density with maximum coherence — pattern-on-pattern, every surface activated",
  },
  score_historicism: {
    1: "No historical reference — contemporary everything or wild cross-era mixing",
    2: "Minor period accents in an otherwise contemporary space",
    3: "References history through antiques or revival architecture, with some anachronisms",
    4: "Strong period commitment with minor modern intrusions",
    5: "Full era consistency — period-appropriate furniture, hidden modern infrastructure",
  },
  score_provenance: {
    1: "Everything arrived at once — new construction, pristine furnishings, no patina",
    2: "Mostly new but with enough items to partially fake accumulated life",
    3: "A great designer creating a space that feels like it's been there forever",
    4: "Mix of inherited and purchased — the building itself has age",
    5: "Genuine accumulation across generations — fading, chips, water rings",
  },
  score_hospitality: {
    1: "Designed for the resident — kitchen is personal, best room is the private study",
    2: "Primarily private with a decent entertaining space",
    3: "Balanced — comfortable for daily life but can host a dinner party",
    4: "Public rooms dominate — guest rooms, large entertaining spaces",
    5: "Social venue — catering kitchen, guest wings, ballrooms, terraces for events",
  },
  score_formality: {
    1: "Warm, personal touches, curl-up furniture — the room says 'you belong here'",
    2: "Comfortable but with some structure — you'd keep your shoes on",
    3: "Quality and considered but not intimidating",
    4: "Clearly formal — careful surfaces, deliberate arrangement, implied rules",
    5: "Overscaled, expensive, uncomfortable furniture — the room makes you feel small",
  },
  score_curation: {
    1: "Self-curated — the homeowner chose everything for personal reasons",
    2: "Mostly personal with some professional input",
    3: "Professional designer involved but the owner's personality is still evident",
    4: "Designer-directed with styled vignettes, composed sight lines",
    5: "Fully designer-directed for editorial lifestyle — publishable, placeless",
  },
  score_theatricality: {
    1: "'If you know you know' — timeless, function-first luxury that serves the self",
    2: "Quality evident but understated — a few knowing pieces, no brand broadcasting",
    3: "Some recognizable designer pieces but restrained",
    4: "Brand names prominent, statement furniture, recognizable art — the room is performing",
    5: "Full performance — brand-name everything, celebrity photos, gilding, overdone classicism",
  },
};

// GROUP_COLORS imported from @/lib/design-tokens

// ═══════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════

interface DossierAestheticRadarProps {
  feature: Feature;
  groupColors?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded border border-border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-foreground">
        {(d.axisLabel as string).replace("\n", " ")}
      </p>
      <p className="mt-1 text-[11px] font-mono" style={{ color: COPPER }}>
        Score: {d.scoreValue}/5
      </p>
      <p className="text-[11px] text-muted-foreground">{d.group}</p>
    </div>
  );
}

/**
 * Interpolate between two hex colors. t=0 → colorA, t=1 → colorB.
 */
function lerpColor(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Compute a point along the line from center to a position between two polygon vertices.
 * t=0 → vertex a, t=1 → vertex b (both at their full radius).
 */
function interpPoint(
  cx: number, cy: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Custom radar shape: colored triangular sectors with smooth blending at group boundaries.
 * Uses radial gradients (transparent center → intense edge) and subdivided blend sectors
 * at each SPACE/STORY/STAGE boundary. No SVG filters — crisp edges guaranteed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ColoredRadarShape(props: any) {
  const { points, groupColors: gc } = props;
  const GC = gc ?? GROUP_COLORS;
  if (!points || points.length < 3) return null;

  const cx = points[0].cx;
  const cy = points[0].cy;

  const maxR = Math.max(
    ...points.map((p: { x: number; y: number }) =>
      Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
    )
  );

  const polyPath =
    points.map((p: { x: number; y: number }, i: number) =>
      `${i === 0 ? "M" : "L"}${p.x},${p.y}`
    ).join(" ") + " Z";

  const GROUPS = ["SPACE", "STORY", "STAGE"] as const;

  // Group boundaries: sector i ends one group and sector i+1 starts another
  const boundaries = new Set<number>();
  for (let i = 0; i < AXES.length; i++) {
    const next = (i + 1) % AXES.length;
    if (AXES[i].group !== AXES[next].group) {
      boundaries.add(i);
    }
  }

  // Build all triangular sectors, subdividing at boundaries
  const BLEND_STEPS = 6;
  const sectors: { d: string; gradId: string }[] = [];

  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    const groupA = AXES[i].group;
    const groupB = AXES[next].group;

    if (boundaries.has(i)) {
      for (let s = 0; s < BLEND_STEPS; s++) {
        const t0 = s / BLEND_STEPS;
        const t1 = (s + 1) / BLEND_STEPS;
        const p0 = interpPoint(cx, cy, points[i], points[next], t0);
        const p1 = interpPoint(cx, cy, points[i], points[next], t1);
        const tMid = (t0 + t1) / 2;
        const blendColor = lerpColor(GC[groupA], GC[groupB], tMid);
        sectors.push({
          d: `M${cx},${cy} L${p0.x},${p0.y} L${p1.x},${p1.y} Z`,
          gradId: `blend-${i}-${s}`,
        });
        (sectors[sectors.length - 1] as { d: string; gradId: string; color: string }).color = blendColor;
      }
    } else {
      sectors.push({
        d: `M${cx},${cy} L${points[i].x},${points[i].y} L${points[next].x},${points[next].y} Z`,
        gradId: `grad-${groupA}`,
      });
    }
  }

  return (
    <g>
      <defs>
        {/* Radial gradients for each group */}
        {GROUPS.map((group) => (
          <radialGradient
            key={group}
            id={`grad-${group}`}
            cx={cx}
            cy={cy}
            r={maxR}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={GC[group]} stopOpacity={0.1} />
            <stop offset="100%" stopColor={GC[group]} stopOpacity={1.0} />
          </radialGradient>
        ))}
        {/* Radial gradients for blend sectors */}
        {sectors.map((s) => {
          const blendSector = s as { d: string; gradId: string; color?: string };
          if (!blendSector.color) return null;
          return (
            <radialGradient
              key={blendSector.gradId}
              id={blendSector.gradId}
              cx={cx}
              cy={cy}
              r={maxR}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={blendSector.color} stopOpacity={0.1} />
              <stop offset="100%" stopColor={blendSector.color} stopOpacity={1.0} />
            </radialGradient>
          );
        })}
        {/* Blur filter to smooth color transitions between groups */}
        <filter id="sector-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        {/* Radial mask: white at center (blur visible), black at edges (blur hidden) */}
        <radialGradient id="blur-fade" cx={cx} cy={cy} r={maxR} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" />
          <stop offset="50%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id="blur-mask">
          <rect x={cx - maxR * 1.5} y={cy - maxR * 1.5} width={maxR * 3} height={maxR * 3} fill="url(#blur-fade)" />
        </mask>
        {/* Clip to polygon shape so blur doesn't bleed outside */}
        <clipPath id="shape-clip">
          <path d={polyPath} />
        </clipPath>
      </defs>

      {/* Custom grid rings — progressively darker toward perimeter */}
      {[1, 2, 3, 4, 5].map((ring) => {
        const r = (ring / 5) * maxR;
        const opacity = 0.05 + (ring / 5) * 0.55;
        return (
          <circle
            key={`grid-ring-${ring}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`rgba(100,100,100,${opacity})`}
            strokeWidth={0.5}
          />
        );
      })}
      {/* Radial spokes */}
      {AXES.map((_, i) => {
        const angle = (i * 360) / AXES.length - 90;
        const rad = (angle * Math.PI) / 180;
        const x2 = cx + maxR * Math.cos(rad);
        const y2 = cy + maxR * Math.sin(rad);
        return (
          <line
            key={`spoke-${i}`}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="rgba(100,100,100,0.4)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Sharp sectors (base layer — visible at edges) */}
      {sectors.map((s, i) => (
        <path
          key={`sector-sharp-${i}`}
          d={s.d}
          fill={`url(#${s.gradId})`}
        />
      ))}

      {/* Blurred sectors (overlay — fades in toward center, clipped to shape) */}
      <g filter="url(#sector-blur)" clipPath="url(#shape-clip)" mask="url(#blur-mask)">
        {sectors.map((s, i) => (
          <path
            key={`sector-blur-${i}`}
            d={s.d}
            fill={`url(#${s.gradId})`}
          />
        ))}
      </g>

      {/* Crisp outer edge — neutral gray */}
      <path
        d={polyPath}
        fill="none"
        stroke="#444"
        strokeWidth={2}
      />

      {/* Crisp vertex dots */}
      {points.map((_: unknown, i: number) => {
        const color = GC[AXES[i].group];
        return (
          <circle
            key={`dot-${i}`}
            cx={points[i].x} cy={points[i].y}
            r={3.5}
            fill={color}
          />
        );
      })}

    </g>
  );
}

/** Map axis label → group color for radar tick labels */
const LABEL_TO_GROUP_COLOR: Record<string, string> = {};
for (const axis of AXES) {
  LABEL_TO_GROUP_COLOR[axis.label] = GROUP_COLORS[axis.group];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AxisTick({ payload, x, y, textAnchor }: any) {
  const label = payload.value as string;
  const lines = label.split("\n");
  const color = "#1A1A1A";
  const yAdj = label === "Grandeur" ? y - 6 : y;
  return (
    <text
      x={x}
      y={yAdj}
      textAnchor={textAnchor}
      fontSize={10}
      fill={color}
      fontFamily="futura-pt, sans-serif"
      fontWeight={700}
    >
      {lines.map((line: string, i: number) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 15}>
          {line.toUpperCase()}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Full-width radar chart with summary + axis-by-axis breakdown.
 */
export function DossierAestheticRadar({ feature, groupColors }: DossierAestheticRadarProps) {
  const GC = groupColors ?? GROUP_COLORS;
  const mounted = useMounted();

  // Build radar data from feature scores
  const chartData = AXES.map((axis) => {
    const val = feature[axis.key as keyof Feature] as number | null;
    return {
      axisLabel: axis.label,
      scoreValue: val ?? 0,
      group: axis.group,
    };
  });

  const hasScores = chartData.some((d) => d.scoreValue > 0);

  if (!hasScores) return null;

  // Build rationale items — prefer per-home rationale from Opus, fall back to generic anchors
  const perHome = feature.scoring_rationale ?? {};
  // Map score_key (e.g. "score_grandeur") → rationale JSON key (e.g. "grandeur")
  const rationaleKeyMap: Record<string, string> = {
    score_grandeur: "grandeur",
    score_material_warmth: "material_warmth",
    score_maximalism: "maximalism",
    score_historicism: "historicism",
    score_provenance: "provenance",
    score_hospitality: "hospitality",
    score_formality: "formality",
    score_curation: "curation",
    score_theatricality: "theatricality",
  };

  const rationale = AXES.map((axis) => {
    const val = feature[axis.key as keyof Feature] as number | null;
    if (!val) return null;
    // Per-home rationale from Opus (v2.2+)
    const jsonKey = rationaleKeyMap[axis.key];
    const homeRationale = jsonKey ? perHome[jsonKey] : undefined;
    // Fall back to generic anchor if no per-home rationale
    const anchor = homeRationale || ANCHORS[axis.key]?.[val];
    if (!anchor) return null;
    return {
      label: axis.label.replace("\n", " "),
      scoreValue: val,
      group: axis.group,
      anchor,
      isPerHome: !!homeRationale,
    };
  }).filter(Boolean) as { label: string; scoreValue: number; group: string; anchor: string; isPerHome: boolean }[];

  // Group by SPACE / STORY / STAGE
  const grouped = {
    SPACE: rationale.filter((r) => r.group === "SPACE"),
    STORY: rationale.filter((r) => r.group === "STORY"),
    STAGE: rationale.filter((r) => r.group === "STAGE"),
  };

  const groupLabels: Record<string, string> = {
    SPACE: "Space — The Physical Experience",
    STORY: "Story — The Narrative It Tells",
    STAGE: "Stage — Who It's Performing For",
  };

  return (
    <div>
      {/* Radar chart */}
      {mounted ? (
        <RadarChart width={630} height={630} data={chartData} cx="50%" cy="50%" outerRadius="65%">
          <PolarGrid stroke="none" gridType="circle" />
          <PolarAngleAxis dataKey="axisLabel" tick={<AxisTick />} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={false}
            tickCount={6}
            axisLine={false}
            style={{ display: "none" }}
          />
          <Radar
            name="Score"
            dataKey="scoreValue"
            shape={<ColoredRadarShape groupColors={GC} />}
          />
          <Tooltip content={<ChartTooltip />} />
        </RadarChart>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Scoring Breakdown — one column per group (SPACE / STORY / STAGE)
// ═══════════════════════════════════════════════════════════

export function ScoringBreakdown({ feature, groupColors }: { feature: Feature; groupColors?: Record<string, string> }) {
  const GC = groupColors ?? GROUP_COLORS;
  const perHome = feature.scoring_rationale ?? {};
  const rationaleKeyMap: Record<string, string> = {
    score_grandeur: "grandeur",
    score_material_warmth: "material_warmth",
    score_maximalism: "maximalism",
    score_historicism: "historicism",
    score_provenance: "provenance",
    score_hospitality: "hospitality",
    score_formality: "formality",
    score_curation: "curation",
    score_theatricality: "theatricality",
  };

  const rationale = AXES.map((axis) => {
    const val = feature[axis.key as keyof Feature] as number | null;
    if (!val) return null;
    const jsonKey = rationaleKeyMap[axis.key];
    const homeRationale = jsonKey ? perHome[jsonKey] : undefined;
    const anchor = homeRationale || ANCHORS[axis.key]?.[val];
    if (!anchor) return null;
    return {
      label: axis.label.replace("\n", " "),
      scoreValue: val,
      group: axis.group,
      anchor,
    };
  }).filter(Boolean) as { label: string; scoreValue: number; group: string; anchor: string }[];

  const grouped = {
    SPACE: rationale.filter((r) => r.group === "SPACE"),
    STORY: rationale.filter((r) => r.group === "STORY"),
    STAGE: rationale.filter((r) => r.group === "STAGE"),
  };

  const groupLabels: Record<string, string> = {
    SPACE: "Space",
    STORY: "Story",
    STAGE: "Stage",
  };

  const groupSubtitles: Record<string, string> = {
    SPACE: "The Physical Experience",
    STORY: "The Narrative It Tells",
    STAGE: "Who It's Performing For",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {(["SPACE", "STORY", "STAGE"] as const).map((groupKey) => (
        <div key={groupKey}>
          {/* Group header */}
          <div
            style={{ backgroundColor: GC[groupKey], padding: "4px 8px", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <span
              className="font-mono uppercase"
              style={{ fontSize: "18px", fontWeight: 900, letterSpacing: "0.15em", color: "#fff", flexShrink: 0 }}
            >
              {groupLabels[groupKey]}
            </span>
            <span style={{ width: "2px", alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <span
              className="text-[12px] italic"
              style={{ fontFamily: "'Lora', serif", color: "rgba(255,255,255,0.5)" }}
            >
              {groupSubtitles[groupKey]}
            </span>
          </div>
          {/* Axis items in a row */}
          <div className="mt-1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {grouped[groupKey].map((item) => (
              <div key={item.label}>
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.08em]"
                  style={{ fontFamily: "futura-pt, sans-serif", color: "#1A1A1A" }}
                >
                  {item.label}
                </span>
                <div className="flex" style={{ width: "100%", gap: "2px" }}>
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <div
                      key={dot}
                      style={{
                        flex: 1,
                        height: "8px",
                        backgroundColor: dot <= item.scoreValue
                          ? GC[item.group]
                          : "#E5E5E5",
                        opacity: dot <= item.scoreValue
                          ? 0.3 + (dot / 5) * 0.7
                          : 1,
                      }}
                    />
                  ))}
                </div>
                <p
                  className="mt-1 text-[10px] leading-[1.5]"
                  style={{ fontFamily: "'Lora', serif", color: "#444" }}
                >
                  {item.anchor}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
