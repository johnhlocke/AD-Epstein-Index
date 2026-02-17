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

const GROUP_COLORS: Record<string, string> = {
  SPACE: "#6366F1", // indigo
  STORY: "#F59E0B", // amber
  STAGE: "#EF4444", // red
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AxisTick({ payload, x, y, textAnchor }: any) {
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

      {/* Scored Home Qualities summary */}
      {summary && (
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
          <p className="mt-2 font-serif text-[15px] leading-[1.7] text-foreground/80">
            {summary}
          </p>
        </div>
      )}

      {/* Full-width radar chart */}
      <div
        className="h-[420px] overflow-hidden rounded border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
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
                stroke={COPPER}
                fill={COPPER}
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ r: 3, fill: COPPER }}
              />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      {/* Scoring rationale — 3-column grid on desktop */}
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {(["SPACE", "STORY", "STAGE"] as const).map((groupKey) => {
          const items = grouped[groupKey];
          if (!items.length) return null;
          return (
            <div key={groupKey}>
              <p
                className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em]"
                style={{ color: GROUP_COLORS[groupKey] }}
              >
                {groupLabels[groupKey]}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.label}
                    className="rounded border border-border bg-muted/30 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold" style={{ color: COPPER }}>
                        {item.scoreValue}
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                      <div className="ml-auto flex gap-1">
                        {[1, 2, 3, 4, 5].map((dot) => (
                          <div
                            key={dot}
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                dot <= item.scoreValue ? COPPER : "#E5E5E5",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.anchor}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
