"use client";

import { useMounted } from "@/lib/use-mounted";
import type { Feature } from "@/lib/types";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
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
// Narrative summary generator
// ═══════════════════════════════════════════════════════════

type Scores = {
  grandeur: number;
  materialWarmth: number;
  maximalism: number;
  historicism: number;
  provenance: number;
  hospitality: number;
  formality: number;
  curation: number;
  theatricality: number;
};

function extractScores(feature: Feature): Scores | null {
  const g = feature.score_grandeur;
  const mw = feature.score_material_warmth;
  const mx = feature.score_maximalism;
  const h = feature.score_historicism;
  const p = feature.score_provenance;
  const ho = feature.score_hospitality;
  const f = feature.score_formality;
  const c = feature.score_curation;
  const t = feature.score_theatricality;

  if (!g || !mw || !mx || !h || !p || !ho || !f || !c || !t) return null;

  return {
    grandeur: g,
    materialWarmth: mw,
    maximalism: mx,
    historicism: h,
    provenance: p,
    hospitality: ho,
    formality: f,
    curation: c,
    theatricality: t,
  };
}

function generateSummary(s: Scores): string {
  const parts: string[] = [];

  // ── SPACE sentence ──
  const spaceFragments: string[] = [];

  if (s.grandeur >= 4) spaceFragments.push("grand, architecturally imposing");
  else if (s.grandeur <= 2) spaceFragments.push("intimate, human-scale");

  if (s.materialWarmth >= 4) spaceFragments.push("with warm, tactile materials throughout");
  else if (s.materialWarmth <= 2) spaceFragments.push("with cold, hard surfaces — marble, chrome, lacquer");
  else if (s.materialWarmth === 3) spaceFragments.push("balancing warm and cool materials");

  if (s.maximalism >= 4) spaceFragments.push("and densely layered with objects in dialogue");
  else if (s.maximalism <= 2) spaceFragments.push("and spare, minimal furnishing");

  if (spaceFragments.length > 0) {
    parts.push(spaceFragments[0].charAt(0).toUpperCase() + spaceFragments[0].slice(1) +
      (spaceFragments.length > 1 ? ", " + spaceFragments.slice(1).join(", ") : "") + ".");
  }

  // ── STORY sentence ──
  const storyFragments: string[] = [];

  if (s.historicism >= 4) storyFragments.push("strongly committed to a historical period");
  else if (s.historicism <= 2) storyFragments.push("contemporary with little period reference");

  if (s.provenance >= 4) storyFragments.push("with genuine accumulated patina");
  else if (s.provenance <= 2) storyFragments.push("where everything feels newly acquired");

  if (s.hospitality >= 4) storyFragments.push("designed primarily as a social venue for entertaining");
  else if (s.hospitality <= 2) storyFragments.push("designed as a private retreat");
  else if (s.hospitality === 3) storyFragments.push("equally suited to private life and hosting");

  if (storyFragments.length > 0) {
    const story = storyFragments[0].charAt(0).toUpperCase() + storyFragments[0].slice(1) +
      (storyFragments.length > 1 ? ", " + storyFragments.slice(1).join(", ") : "");
    parts.push(story + ".");
  }

  // ── STAGE sentence ──
  const stageAvg = (s.formality + s.curation + s.theatricality) / 3;

  if (stageAvg >= 3.5) {
    const stageDetails: string[] = [];
    if (s.theatricality >= 4) stageDetails.push("performs wealth for an audience");
    if (s.formality >= 4) stageDetails.push("enforces behavioral rules on occupants");
    if (s.curation >= 4) stageDetails.push("styled by a designer for editorial effect");

    if (stageDetails.length > 0) {
      parts.push("The home " + stageDetails.join(", ") + ".");
    }
  } else if (stageAvg <= 2.5) {
    const lowDetails: string[] = [];
    if (s.theatricality <= 2) lowDetails.push("understated wealth");
    if (s.formality <= 2) lowDetails.push("welcoming informality");
    if (s.curation <= 2) lowDetails.push("personal curation");

    if (lowDetails.length > 0) {
      parts.push("The home reads as genuinely lived-in — " + lowDetails.join(", ") + ".");
    }
  }

  return parts.join(" ");
}

// ═══════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════

interface DossierAestheticRadarProps {
  feature: Feature;
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
  const { points } = props;
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
      // Boundary sector: subdivide into BLEND_STEPS thin slices with interpolated colors
      for (let s = 0; s < BLEND_STEPS; s++) {
        const t0 = s / BLEND_STEPS;
        const t1 = (s + 1) / BLEND_STEPS;
        const p0 = interpPoint(cx, cy, points[i], points[next], t0);
        const p1 = interpPoint(cx, cy, points[i], points[next], t1);
        const tMid = (t0 + t1) / 2;
        const blendColor = lerpColor(GROUP_COLORS[groupA], GROUP_COLORS[groupB], tMid);
        sectors.push({
          d: `M${cx},${cy} L${p0.x},${p0.y} L${p1.x},${p1.y} Z`,
          gradId: `blend-${i}-${s}`,
        });
        // We'll create individual radial gradients for blend sectors below
        // For now, store the color info
        (sectors[sectors.length - 1] as { d: string; gradId: string; color: string }).color = blendColor;
      }
    } else {
      // Interior sector: single triangle with group gradient
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
            <stop offset="0%" stopColor={GROUP_COLORS[group]} stopOpacity={0.1} />
            <stop offset="100%" stopColor={GROUP_COLORS[group]} stopOpacity={0.9} />
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
              <stop offset="100%" stopColor={blendSector.color} stopOpacity={0.9} />
            </radialGradient>
          );
        })}
      </defs>

      {/* All sectors */}
      {sectors.map((s, i) => (
        <path
          key={`sector-${i}`}
          d={s.d}
          fill={`url(#${s.gradId})`}
        />
      ))}

      {/* Crisp outer edge — neutral gray */}
      <path
        d={polyPath}
        fill="none"
        stroke="#999"
        strokeWidth={2}
      />

      {/* Crisp vertex dots */}
      {points.map((_: unknown, i: number) => {
        const color = GROUP_COLORS[AXES[i].group];
        return (
          <circle
            key={`dot-${i}`}
            cx={points[i].x} cy={points[i].y}
            r={3.5}
            fill={color}
          />
        );
      })}

      {/* Group arcs outside the chart */}
      {(() => {
        // Chart outer radius = where score 5 would be.
        // Derive from outerRadius of the chart: each point is at (score/5)*outerR from center.
        // Find the maximum possible radius by scaling up from the actual max data point.
        const maxScore = Math.max(...points.map((p: { value?: number }) => p.value ?? 0), 1);
        const chartOuterR = (maxR / maxScore) * 5;
        const arcR = chartOuterR + 18;
        const baseLabelR = arcR + 38;

        // Axis angle formula: 9 axes evenly spaced, index 0 at top
        const axisAngle = (idx: number) => -Math.PI / 2 + (idx * 2 * Math.PI / 9);

        const arcs = [
          { group: "SPACE" as const, startIdx: 0, endIdx: 2 },
          { group: "STORY" as const, startIdx: 3, endIdx: 5 },
          { group: "STAGE" as const, startIdx: 6, endIdx: 8 },
        ];

        return arcs.map(({ group, startIdx, endIdx }) => {
          const startA = axisAngle(startIdx);
          const endA = axisAngle(endIdx);
          // Nudge STAGE label angle upward to avoid overlapping "Curation"
          const midA = (startA + endA) / 2 + (group === "STAGE" ? 0.1 : group === "STORY" ? -0.1 : 0);
          const labelR = baseLabelR + (group === "STAGE" ? 14 : group === "STORY" ? -4 : 0);

          const sx = cx + arcR * Math.cos(startA);
          const sy = cy + arcR * Math.sin(startA);
          const ex = cx + arcR * Math.cos(endA);
          const ey = cy + arcR * Math.sin(endA);

          return (
            <g key={`arc-${group}`}>
              <path
                d={`M${sx},${sy} A${arcR},${arcR} 0 0,1 ${ex},${ey}`}
                fill="none"
                stroke={GROUP_COLORS[group]}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeOpacity={0.7}
              />
              <text
                x={cx + labelR * Math.cos(midA)}
                y={cy + labelR * Math.sin(midA)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight="bold"
                fill={GROUP_COLORS[group]}
                fontFamily="futura-pt, sans-serif"
                letterSpacing="0.1em"
              >
                {group}
              </text>
            </g>
          );
        });
      })()}
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
  const color = "#666";
  const yAdj = label === "Grandeur" ? y - 6 : y;
  return (
    <text
      x={x}
      y={yAdj}
      textAnchor={textAnchor}
      fontSize={12}
      fill={color}
      stroke="white"
      strokeWidth={4}
      strokeLinejoin="round"
      paintOrder="stroke"
      fontFamily="futura-pt, sans-serif"
    >
      {lines.map((line: string, i: number) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 15}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Full-width radar chart with summary + axis-by-axis breakdown.
 */
export function DossierAestheticRadar({ feature }: DossierAestheticRadarProps) {
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

  // Generate summary
  const scores = extractScores(feature);
  const summary = scores ? generateSummary(scores) : null;

  return (
    <div>
      <h2 className="mb-2 font-serif text-2xl font-bold">Aesthetic Profile</h2>

      {/* Scored Home Qualities summary — prefer Opus aesthetic_profile over template */}
      {(feature.aesthetic_profile || summary) && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Scored Home Qualities
            </h3>
            {feature.scoring_version && (
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {feature.scoring_version}
              </span>
            )}
          </div>
          {feature.aesthetic_profile ? (
            <blockquote className="mt-3 border-l-2 border-foreground/20 pl-4 font-serif text-lg italic leading-[1.8] text-foreground">
              {feature.aesthetic_profile}
            </blockquote>
          ) : (
            <p className="mt-2 font-serif text-base leading-[1.7] text-foreground">
              {summary}
            </p>
          )}
        </div>
      )}

      {/* Full-width radar chart */}
      <div
        className="h-[420px] overflow-hidden rounded border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="65%">
              <PolarGrid stroke="#E0E0E0" strokeWidth={0.5} />
              <PolarAngleAxis dataKey="axisLabel" tick={<AxisTick />} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 5]}
                tick={{ fontSize: 8, fill: "#C0C0C0" }}
                tickCount={6}
                axisLine={false}
              />
              <Radar
                name="Score"
                dataKey="scoreValue"
                shape={<ColoredRadarShape />}
              />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      {/* Scoring rationale — flat 3-column grid so rows align across groups */}
      <div className="mt-6 grid gap-x-6 gap-y-3 md:grid-cols-3">
        {/* Group headers */}
        {(["SPACE", "STORY", "STAGE"] as const).map((groupKey) => {
          const [title, subtitle] = groupLabels[groupKey].split(" — ");
          return (
            <div key={groupKey} className="mb-1 text-center">
              <p
                className="text-lg font-bold uppercase tracking-[0.1em]"
                style={{ color: GROUP_COLORS[groupKey] }}
              >
                {title}
              </p>
              {subtitle && (
                <p className="text-xs italic text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          );
        })}
        {/* Axis cards — row by row so CSS grid aligns heights */}
        {[0, 1, 2].map((rowIdx) =>
          (["SPACE", "STORY", "STAGE"] as const).map((groupKey) => {
            const item = grouped[groupKey][rowIdx];
            if (!item) return <div key={`${groupKey}-${rowIdx}`} />;
            return (
              <div
                key={item.label}
                className="rounded border border-border bg-muted/30 px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-xs font-bold text-white"
                    style={{
                      backgroundColor: GROUP_COLORS[item.group as keyof typeof GROUP_COLORS],
                      opacity: 0.4 + (item.scoreValue - 1) * 0.15,
                    }}
                  >
                    {item.scoreValue}
                  </span>
                  <div>
                    <span className="text-sm font-medium">{item.label}</span>
                    <div className="mt-1 flex gap-1">
                      {[1, 2, 3, 4, 5].map((dot) => (
                        <div
                          key={dot}
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              dot <= item.scoreValue ? "#555" : "#E5E5E5",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                  {item.anchor}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
