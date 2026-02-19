"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useMounted } from "@/lib/use-mounted";

// ── Warm dark-cream palette — scholarly instrument, not terminal ─────────────
const MONO = "JetBrains Mono, monospace";
const BODY = "var(--font-inter), Inter, system-ui, sans-serif";
const BG = "#1B1815";
const CARD_BG = "#242019";
const CARD_DEEP = "#15120F";
const BORDER = "#3A332A";
const TEXT_LIGHT = "#E8E0D4";
const TEXT_MID = "#B0A594";
const TEXT_DIM = "rgba(176, 165, 148, 0.75)";
const CARD_GLOW = "0 0 24px rgba(184, 115, 51, 0.06), 0 1px 2px rgba(0,0,0,0.2)";
const GREEN = "rgba(46, 204, 113, 0.7)";
const GOLD = "rgba(210, 170, 100, 0.85)";
const GOLD_DIM = "rgba(210, 170, 100, 0.65)";
const COPPER = "#B87333";
const COPPER_DIM = "rgba(184, 115, 51, 0.25)";

// ── Data ────────────────────────────────────────────────────────────────────

interface Axis {
  num: number;
  name: string;
  description: string;
  anchors: [string, string]; // [low anchor, high anchor]
  predictedBaseline: number;
  predictedEpstein: number;
}

const groups: {
  label: string;
  tag: string;
  subtitle: string;
  axes: Axis[];
}[] = [
  {
    label: "SPACE",
    tag: "GROUP 1",
    subtitle: "The Physical Experience",
    axes: [
      {
        num: 1,
        name: "Grandeur",
        description:
          "Scale and material weight of the architecture. Ceiling height, room volume, stone vs. drywall. How much space does the architecture demand?",
        anchors: [
          "8-foot ceilings, human-scale rooms, drywall",
          "Triple-height spaces, gilded surfaces, glossy materials. The architecture dominates its occupants",
        ],
        predictedBaseline: 2.8,
        predictedEpstein: 4.0,
      },
      {
        num: 2,
        name: "Material Warmth",
        description:
          "The dominant tactile temperature of the space. Cold (marble, chrome, lacquer) to warm (wood, linen, leather). What do your hands expect to feel?",
        anchors: [
          "White marble, lacquered surfaces, chrome, glass. Hard and cold",
          "Wide-plank oak, linen, leather, terracotta, stone fireplace. Everything is tactile",
        ],
        predictedBaseline: 3.2,
        predictedEpstein: 2.3,
      },
      {
        num: 3,
        name: "Maximalism",
        description:
          "Density of objects with internal coherence. Not just quantity \u2014 quantity with dialogue between color, texture, pattern, and provenance.",
        anchors: [
          "Spare, minimal, few objects, open space",
          "Maximum density with maximum coherence. Pattern-on-pattern, every surface activated",
        ],
        predictedBaseline: 2.8,
        predictedEpstein: 3.5,
      },
    ],
  },
  {
    label: "STORY",
    tag: "GROUP 2",
    subtitle: "The Narrative It Tells",
    axes: [
      {
        num: 4,
        name: "Historicism",
        description:
          "How consistently the space commits to a historical period. Measures temporal range from no period reference to full era consistency. Penalizes anachronisms.",
        anchors: [
          "No historical reference. Contemporary everything",
          "Full era consistency. Integrated infrastructure, no anachronisms",
        ],
        predictedBaseline: 2.5,
        predictedEpstein: 3.3,
      },
      {
        num: 5,
        name: "Provenance",
        description:
          "How convincingly the space communicates accumulated life. Patina, wear, inherited objects. Not the age of the antiques \u2014 the relationship between the objects and the building.",
        anchors: [
          "Everything arrived at once. New construction, pristine furnishings",
          "Genuine accumulation across generations. Fading, chips, water rings",
        ],
        predictedBaseline: 2.5,
        predictedEpstein: 2.8,
      },
      {
        num: 6,
        name: "Hospitality",
        description:
          "Whether the home is designed primarily for its residents or for their guests. Private retreat vs. social venue.",
        anchors: [
          "Designed for the resident. Spaces feel right with one or two people",
          "Social venue. Guest wings, ballrooms, terraces scaled for events. The architecture is waiting for the party",
        ],
        predictedBaseline: 2.5,
        predictedEpstein: 4.0,
      },
    ],
  },
  {
    label: "STAGE",
    tag: "GROUP 3",
    subtitle: "Who It\u2019s Performing For",
    axes: [
      {
        num: 7,
        name: "Formality",
        description:
          "The behavioral rules the room enforces on its occupants. Does the room invite you in or put you in your place?",
        anchors: [
          "Warm, personal, curl-up furniture. The room says \u201cyou belong here\u201d",
          "Overscaled, expensive, uncomfortable. The room makes you feel small",
        ],
        predictedBaseline: 2.5,
        predictedEpstein: 4.0,
      },
      {
        num: 8,
        name: "Curation",
        description:
          "Who directed this room and for whom. The spectrum from self-curated private living to designer-directed publishable lifestyle.",
        anchors: [
          "Self-curated. The homeowner chose everything for personal reasons",
          "Fully designer-directed for editorial lifestyle. Publishable, placeless",
        ],
        predictedBaseline: 3.0,
        predictedEpstein: 4.2,
      },
      {
        num: 9,
        name: "Theatricality",
        description:
          "How loudly the room performs wealth for an outside audience. The gap between \u201cif you know you know\u201d and \u201ceveryone must know.\u201d",
        anchors: [
          "\u201cIf you know you know.\u201d Function-first luxury. Wealth serves the self",
          "Full performance. Brand-name everything, celebrity photos, gilding. Everything needs you to know its price",
        ],
        predictedBaseline: 2.0,
        predictedEpstein: 3.8,
      },
    ],
  },
];

// ── Reusable sub-components ─────────────────────────────────────────────────

function SectionHeader({
  num,
  title,
  subtitle,
}: {
  num: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] tracking-widest"
        style={{ fontFamily: MONO, color: GOLD }}
      >
        SECTION {num}
      </p>
      <h3
        className="mt-2 text-[32px] font-bold leading-[1.1] tracking-tight"
        style={{ fontFamily: MONO, color: TEXT_LIGHT }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-[14px] leading-[1.6]"
        style={{ fontFamily: BODY, color: TEXT_MID }}
      >
        {subtitle}
      </p>
      <div className="mt-5" style={{ borderTop: `1px solid ${BORDER}` }} />
    </div>
  );
}

function ScaleBar({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  const pct = ((value - 1) / 4) * 100;
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-[52px] text-right text-[9px] tracking-wider"
        style={{ fontFamily: MONO, color: TEXT_DIM }}
      >
        {label}
      </span>
      <div
        className="relative h-[6px] flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(176, 165, 148, 0.1)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="w-[28px] text-[11px] font-bold"
        style={{ fontFamily: MONO, color }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ── 9-axis radar data ────────────────────────────────────────────────────────

const radarData = groups.flatMap((g) => g.axes).map((axis) => ({
  axis: axis.name,
  baseline: axis.predictedBaseline,
  epstein: axis.predictedEpstein,
}));

// Group label mapping for colored axis labels
const axisGroupMap: Record<string, string> = {};
groups.forEach((g) => g.axes.forEach((a) => (axisGroupMap[a.name] = g.label)));

const GROUP_COLORS: Record<string, string> = {
  SPACE: "#B0A594",   // TEXT_MID — neutral
  STORY: "#D2AA64",   // GOLD — warm
  STAGE: "#B87333",   // COPPER — hot
};

function RadarAxisTick({ payload, x, y, textAnchor }: any) {
  const name = payload.value as string;
  const group = axisGroupMap[name] || "SPACE";
  const color = GROUP_COLORS[group] || TEXT_MID;
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={11}
      fontFamily={MONO}
      fill={color}
      fontWeight={600}
    >
      {name}
    </text>
  );
}

function RadarTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div
      className="rounded border px-3 py-2"
      style={{
        backgroundColor: CARD_DEEP,
        borderColor: BORDER,
        fontFamily: MONO,
      }}
    >
      <p className="text-[11px] font-bold" style={{ color: TEXT_LIGHT }}>
        {data.axis}
      </p>
      <p className="mt-1 text-[10px]" style={{ color: GREEN }}>
        AD Baseline: {data.baseline.toFixed(1)}
      </p>
      <p className="text-[10px]" style={{ color: COPPER }}>
        Epstein Orbit: {data.epstein.toFixed(1)}
      </p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

/**
 * Aesthetic Metric Methodology — the 9-axis Space/Story/Stage instrument.
 *
 * Presents the v2 scoring system: 3 groups, 9 axes, 1-5 numeric scales,
 * predicted Epstein divergence, and the diagnostic composite.
 *
 * This grid alignment? *chef's kiss* — Sable
 */
export function AestheticMethodologySection() {
  const mounted = useMounted();
  return (
    <section
      className="relative overflow-hidden"
      id="aesthetic-methodology"
      style={{ backgroundColor: BG, borderTop: `1px solid ${BORDER}` }}
    >
      {/* Warm amber gradient — distinct from the cool purple of Agent section */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background:
            "linear-gradient(180deg, rgba(184,115,51,0.12) 0%, rgba(140,100,50,0.04) 50%, transparent 100%)",
        }}
      />

      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
          paddingTop: "80px",
          paddingBottom: "80px",
        }}
      >
        {/* ══════════════════════════════════════════════════════════════════
            MAIN HEADER
        ══════════════════════════════════════════════════════════════════ */}
        <p
          className="text-[11px] font-bold uppercase tracking-[0.15em]"
          style={{ fontFamily: MONO, color: COPPER }}
        >
          Aesthetic Scoring Instrument v2
        </p>

        <h2
          className="mt-3 text-[48px] font-bold leading-[1.08] tracking-tight"
          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
        >
          HOW TASTE WAS MEASURED
        </h2>

        <p
          className="mt-2 text-[15px]"
          style={{ fontFamily: BODY, color: TEXT_MID }}
        >
          A 9-axis numeric scoring instrument for classifying interior design
          aesthetics.
        </p>

        {/* Intro body text — 4 columns wide, Inter for prose */}
        <div
          className="mt-5 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
          style={{ fontFamily: BODY, color: TEXT_MID }}
        >
          <p>
            The previous 6-dimension categorical taxonomy could classify homes
            but not measure intensity. A home was either
            &ldquo;Classical/Neoclassical&rdquo; or it wasn&rsquo;t &mdash;
            there was no way to capture how classical, or to distinguish a
            tasteful Georgian from a gilded McMansion. The v2 instrument
            replaces categories with calibrated 1&ndash;5 scales, each anchored
            by concrete visual descriptions validated against professional
            architectural judgment.
          </p>
          <p>
            The instrument is organized into three groups &mdash; Space, Story,
            and Stage &mdash; reflecting how a room operates on three levels
            simultaneously: its physical presence, the narrative it constructs
            about its inhabitants, and the audience it performs for. Each axis
            is scored independently by Claude Opus Vision reading the original
            magazine pages.
          </p>
          <p>
            The theoretical frame draws on Bourdieu&rsquo;s cultural capital
            (taste as class marker), Veblen&rsquo;s conspicuous consumption
            (decoration as status display), and contemporary computational
            aesthetics research. The scoring anchors were calibrated through
            collaborative Q&amp;A with a licensed architect and interior
            designer.
          </p>
        </div>

        <div className="mt-6" style={{ borderTop: `1px solid ${BORDER}` }} />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: THE INSTRUMENT
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-16">
          <SectionHeader
            num="1"
            title="THE INSTRUMENT"
            subtitle="Nine axes. Three groups. Each scored 1–5."
          />

          {/* Three group cards — one per row */}
          <div className="mt-10 flex flex-col gap-12">
            {groups.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="mb-6 flex items-baseline gap-4">
                  <span
                    className="text-[9px] tracking-widest"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    {group.tag}
                  </span>
                  <span
                    className="text-[24px] font-bold tracking-tight"
                    style={{ fontFamily: MONO, color: COPPER }}
                  >
                    {group.label}
                  </span>
                  <span
                    className="text-[13px] italic"
                    style={{ fontFamily: BODY, color: TEXT_MID }}
                  >
                    &mdash; {group.subtitle}
                  </span>
                </div>

                {/* Axis cards — 3 per row matching the 3 axes per group */}
                <div className="grid gap-6 md:grid-cols-3">
                  {group.axes.map((axis) => (
                    <div
                      key={axis.num}
                      className="flex flex-col rounded border p-6"
                      style={{
                        backgroundColor: CARD_BG,
                        borderColor: BORDER,
                        boxShadow: CARD_GLOW,
                      }}
                    >
                      {/* Number + name */}
                      <div className="flex items-baseline gap-3">
                        <span
                          className="text-[36px] font-bold leading-none"
                          style={{
                            fontFamily: MONO,
                            color: COPPER_DIM,
                          }}
                        >
                          {String(axis.num).padStart(2, "0")}
                        </span>
                        <span
                          className="text-[15px] font-bold tracking-wide"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          {axis.name}
                        </span>
                      </div>

                      {/* Description — Inter for readable prose */}
                      <p
                        className="mt-3 text-[13px] leading-[1.65]"
                        style={{ fontFamily: BODY, color: TEXT_MID }}
                      >
                        {axis.description}
                      </p>

                      {/* Anchor scale */}
                      <div
                        className="mt-4 rounded px-4 py-3"
                        style={{
                          backgroundColor: "rgba(21, 19, 15, 0.6)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <span
                              className="text-[9px] font-bold"
                              style={{
                                fontFamily: MONO,
                                color: "rgba(46, 204, 113, 0.5)",
                              }}
                            >
                              1
                            </span>
                            <p
                              className="mt-1 text-[10px] leading-[1.5]"
                              style={{
                                fontFamily: BODY,
                                color: TEXT_DIM,
                              }}
                            >
                              {axis.anchors[0]}
                            </p>
                          </div>
                          <div
                            className="mx-2 mt-2 h-px flex-shrink-0"
                            style={{
                              width: "24px",
                              backgroundColor: BORDER,
                            }}
                          />
                          <div className="flex-1 text-right">
                            <span
                              className="text-[9px] font-bold"
                              style={{
                                fontFamily: MONO,
                                color: COPPER,
                              }}
                            >
                              5
                            </span>
                            <p
                              className="mt-1 text-[10px] leading-[1.5]"
                              style={{
                                fontFamily: BODY,
                                color: TEXT_DIM,
                              }}
                            >
                              {axis.anchors[1]}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Predicted divergence bars */}
                      <div className="mt-4 flex flex-col gap-2">
                        <ScaleBar
                          value={axis.predictedBaseline}
                          color="rgba(46, 204, 113, 0.6)"
                          label="AD BASE"
                        />
                        <ScaleBar
                          value={axis.predictedEpstein}
                          color={COPPER}
                          label="EPSTEIN"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            9-AXIS RADAR — PREDICTED DIVERGENCE
        ══════════════════════════════════════════════════════════════════ */}
        <div
          className="mt-16 rounded border p-8"
          style={{
            backgroundColor: CARD_DEEP,
            borderColor: BORDER,
            boxShadow: CARD_GLOW,
          }}
        >
          {/* Card header */}
          <div className="flex items-baseline justify-between">
            <div>
              <p
                className="text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                PREDICTED DIVERGENCE
              </p>
              <p
                className="mt-1 text-[13px]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                9 axes &middot; predicted values &middot; results pending
              </p>
            </div>
            {/* Legend */}
            <div className="hidden items-center gap-6 md:flex">
              <div className="flex items-center gap-2">
                <div
                  className="h-[2px] w-5"
                  style={{ backgroundColor: GREEN }}
                />
                <span
                  className="text-[10px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  AD BASELINE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-[2px] w-5"
                  style={{ backgroundColor: COPPER }}
                />
                <span
                  className="text-[10px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  EPSTEIN ORBIT
                </span>
              </div>
            </div>
          </div>

          {/* Radar chart */}
          <div className="mt-6" style={{ height: 480 }}>
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={radarData}
                  cx="50%"
                  cy="50%"
                  outerRadius="72%"
                >
                  <PolarGrid
                    stroke={BORDER}
                    strokeDasharray="2 4"
                  />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={<RadarAxisTick />}
                    tickLine={false}
                  />
                  <PolarRadiusAxis
                    domain={[1, 5]}
                    tickCount={5}
                    tick={{
                      fontSize: 9,
                      fill: TEXT_DIM,
                      fontFamily: MONO,
                    }}
                    axisLine={false}
                  />
                  {/* AD Baseline — green, dashed, subtle */}
                  <Radar
                    name="AD Baseline"
                    dataKey="baseline"
                    stroke={GREEN}
                    fill={GREEN}
                    fillOpacity={0.06}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                  {/* Epstein Orbit — copper, solid, prominent */}
                  <Radar
                    name="Epstein Orbit"
                    dataKey="epstein"
                    stroke={COPPER}
                    fill={COPPER}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Tooltip
                    content={<RadarTooltipContent />}
                    cursor={false}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div
                className="flex h-full items-center justify-center"
              >
                <p
                  className="text-[12px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  Loading chart&hellip;
                </p>
              </div>
            )}
          </div>

          {/* Group labels below chart */}
          <div
            className="mt-4 flex justify-center gap-8 border-t pt-4"
            style={{ borderColor: BORDER }}
          >
            {groups.map((g) => (
              <div key={g.label} className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: GROUP_COLORS[g.label],
                  }}
                />
                <span
                  className="text-[9px] tracking-widest"
                  style={{
                    fontFamily: MONO,
                    color: GROUP_COLORS[g.label],
                  }}
                >
                  {g.tag}: {g.label}
                </span>
                <span
                  className="text-[9px] italic"
                  style={{ fontFamily: BODY, color: TEXT_DIM }}
                >
                  {g.subtitle}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: THE DIAGNOSTIC COMPOSITE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="2"
            title="THE EPSTEIN SIGNATURE"
            subtitle="A single composite score that captures the aesthetic of performed wealth."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Left: the formula */}
            <div
              className="flex flex-col rounded border p-8"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                DIAGNOSTIC FORMULA
              </p>
              <div
                className="mt-6 rounded px-6 py-5"
                style={{ backgroundColor: "rgba(184, 115, 51, 0.1)" }}
              >
                <p
                  className="text-center text-[14px] font-bold leading-[2]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  <span style={{ color: TEXT_LIGHT }}>SIGNATURE</span> ={" "}
                  <span style={{ color: GOLD }}>( Theatricality</span> +{" "}
                  <span style={{ color: GOLD }}>Curation</span> +{" "}
                  <span style={{ color: GOLD }}>Formality )</span>
                  <br />
                  <span style={{ color: TEXT_DIM }}>&minus;</span>{" "}
                  <span style={{ color: GREEN }}>( Provenance</span> +{" "}
                  <span style={{ color: GREEN }}>Material Warmth )</span>
                </p>
              </div>
              <p
                className="mt-5 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                High STAGE scores (performing for an audience) combined with low
                Provenance (purchased rather than inherited) and low Material
                Warmth (cold, hard surfaces) produces the Epstein aesthetic
                signature. Cold, curated, performing.
              </p>
            </div>

            {/* Right: predicted gap summary */}
            <div
              className="flex flex-col rounded border p-8"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                PREDICTED DIVERGENCE
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                The STAGE group &mdash; Formality, Curation, and Theatricality
                &mdash; is predicted to show the largest divergence between the
                Epstein orbit and the AD baseline. These are rooms that perform
                wealth for an audience rather than serve their residents.
              </p>

              {/* Gap stats */}
              <div className="mt-6 flex flex-col gap-3">
                {[
                  { axis: "Theatricality", gap: "+1.8", note: "Largest predicted gap" },
                  { axis: "Hospitality", gap: "+1.5", note: "Venues, not homes" },
                  { axis: "Formality", gap: "+1.5", note: "Rooms that intimidate" },
                  { axis: "Curation", gap: "+1.2", note: "Designer-directed" },
                  { axis: "Grandeur", gap: "+1.2", note: "Scale and weight" },
                  { axis: "Material Warmth", gap: "\u22120.9", note: "Colder than baseline" },
                ].map((row) => (
                  <div
                    key={row.axis}
                    className="flex items-center gap-3"
                  >
                    <span
                      className="w-[100px] text-[10px]"
                      style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                    >
                      {row.axis}
                    </span>
                    <span
                      className="w-[40px] text-right text-[11px] font-bold"
                      style={{
                        fontFamily: MONO,
                        color: row.gap.startsWith("\u2212")
                          ? GREEN
                          : COPPER,
                      }}
                    >
                      {row.gap}
                    </span>
                    <span
                      className="text-[9px]"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      {row.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: METHODOLOGY & VALIDATION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="3"
            title="SCORING METHODOLOGY"
            subtitle="How every home was scored. Rater, inputs, validation plan."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD }}
              >
                RATER
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Claude Opus Vision (multimodal LLM) acts as a calibrated
                semantic rater, not a trained classifier. All ~1,600 features
                are scored with the same model and prompt for apples-to-apples
                comparison.
              </p>
            </div>
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD }}
              >
                INPUT
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Article page images (462&times;600 JPEG from Azure Blob
                Storage) plus article text and captions visible in the
                images. Both visual and textual channels work together to
                produce each score.
              </p>
            </div>
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD }}
              >
                VALIDATION
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Test&ndash;retest reliability study completed: 100 stratified
                features scored three independent times (2,700 comparisons).{" "}
                <span style={{ color: GOLD }}>87% exact agreement</span>,{" "}
                <span style={{ color: GOLD }}>99.7% within &plusmn;1</span>.
                See Section 4 below for full results and methodology.
              </p>
            </div>
          </div>

          {/* Academic grounding — proper bibliography */}
          <div
            className="mt-6 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              REFERENCES
            </p>
            <div
              className="mt-4 flex flex-col gap-2 text-[11px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_DIM }}
            >
              <p>Bourdieu, P. (1984). <em style={{ color: TEXT_MID }}>Distinction: A Social Critique of the Judgement of Taste.</em> Harvard University Press.</p>
              <p>Veblen, T. (1899). <em style={{ color: TEXT_MID }}>The Theory of the Leisure Class.</em> Macmillan.</p>
              <p>Trigg, A. B. (2001). &ldquo;Veblen, Bourdieu, and Conspicuous Consumption.&rdquo; <em style={{ color: TEXT_MID }}>Journal of Economic Issues,</em> 35(1), 99&ndash;115.</p>
              <p>Osgood, C. E., Suci, G. J., &amp; Tannenbaum, P. H. (1957). <em style={{ color: TEXT_MID }}>The Measurement of Meaning.</em> University of Illinois Press.</p>
              <p>Shabrina, Z., Arcaute, E., &amp; Batty, M. (2019). &ldquo;Inside 50,000 Living Rooms.&rdquo; <em style={{ color: TEXT_MID }}>arXiv:1911.09635.</em></p>
              <p>Kim, S., &amp; Lee, S. (2020). &ldquo;Stochastic Detection of Interior Design Styles.&rdquo; <em style={{ color: TEXT_MID }}>Applied Sciences,</em> 10(20), 7299.</p>
              <p>Adilova, L., &amp; Shamoi, P. (2024). &ldquo;Aesthetic Preference Prediction in Interior Design.&rdquo; <em style={{ color: TEXT_MID }}>Applied Sciences,</em> 14(9), 3688.</p>
              <p>Yavuz, M. C. (2025). &ldquo;Is the LLM-as-a-Judge Reliable?&rdquo; <em style={{ color: TEXT_MID }}>arXiv:2502.04915.</em></p>
              <p>Koo, T. K., &amp; Li, M. Y. (2016). &ldquo;A Guideline of Selecting and Reporting Intraclass Correlation Coefficients for Reliability Research.&rdquo; <em style={{ color: TEXT_MID }}>Journal of Chiropractic Medicine,</em> 15(2), 155&ndash;163.</p>
              <p>Walter, S. D., Eliasziw, M., &amp; Donner, A. (1998). &ldquo;Sample Size and Optimal Designs for Reliability Studies.&rdquo; <em style={{ color: TEXT_MID }}>Statistics in Medicine,</em> 17(1), 101&ndash;110.</p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: SCORING RELIABILITY
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="4"
            title="SCORING RELIABILITY"
            subtitle="Three independent runs. 2,700 comparisons. Strong measurement consistency."
          />

          {/* ── Key Findings — hero stats ── */}
          <div
            className="mt-10 rounded border p-8"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <p
              className="text-[10px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD }}
            >
              KEY FINDINGS
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {[
                { stat: "87%", label: "Exact Agreement", note: "Identical scores across all three runs" },
                { stat: "99.7%", label: "Within \u00B11", note: "Only 3 outlier scores out of 900 per run" },
                { stat: "0.00", label: "Systematic Bias", note: "Mean axis deviations all near zero" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p
                    className="text-[48px] font-bold leading-none tracking-tight"
                    style={{ fontFamily: MONO, color: COPPER }}
                  >
                    {item.stat}
                  </p>
                  <p
                    className="mt-2 text-[13px] font-bold"
                    style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="mt-1 text-[11px]"
                    style={{ fontFamily: BODY, color: TEXT_DIM }}
                  >
                    {item.note}
                  </p>
                </div>
              ))}
            </div>

            {/* Axis-level highlights */}
            <div
              className="mt-8 border-t pt-6"
              style={{ borderColor: BORDER }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p
                    className="text-[9px] font-bold tracking-wider"
                    style={{ fontFamily: MONO, color: GREEN }}
                  >
                    MOST STABLE AXES
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {[
                      { axis: "Grandeur", r2: "92%", r3: "89%", note: "Most stable axis" },
                      { axis: "Theatricality", r2: "90%", r3: "85%", note: "Consistent wealth signal" },
                      { axis: "Formality", r2: "88%", r3: "91%", note: "Run 3 even better" },
                    ].map((row) => (
                      <div key={row.axis} className="flex items-baseline gap-3">
                        <span
                          className="w-[100px] text-[11px]"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          {row.axis}
                        </span>
                        <span
                          className="text-[11px] font-bold"
                          style={{ fontFamily: MONO, color: GREEN }}
                        >
                          {row.r2} / {row.r3}
                        </span>
                        <span
                          className="text-[9px]"
                          style={{ fontFamily: MONO, color: TEXT_DIM }}
                        >
                          {row.note}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p
                    className="text-[9px] font-bold tracking-wider"
                    style={{ fontFamily: MONO, color: GOLD }}
                  >
                    LEAST STABLE (STILL STRONG)
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {[
                      { axis: "Hospitality", r2: "87%", r3: "84%", note: "Hardest to score" },
                      { axis: "Curation", r2: "85%", r3: "87%", note: "100% within \u00B11" },
                      { axis: "Historicism", r2: "85%", r3: "86%", note: "100% within \u00B11" },
                    ].map((row) => (
                      <div key={row.axis} className="flex items-baseline gap-3">
                        <span
                          className="w-[100px] text-[11px]"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          {row.axis}
                        </span>
                        <span
                          className="text-[11px] font-bold"
                          style={{ fontFamily: MONO, color: GOLD }}
                        >
                          {row.r2} / {row.r3}
                        </span>
                        <span
                          className="text-[9px]"
                          style={{ fontFamily: MONO, color: TEXT_DIM }}
                        >
                          {row.note}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Study Design prose ── */}
          <div
            className="mt-10 flex flex-col gap-5 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Study Design
            </p>
            <p className="-mt-2">
              100 features were selected using stratified random sampling: 25
              from each decade (1990s, 2000s, 2010s, 2020s) to ensure coverage
              across different eras of magazine photography, formatting, and
              architectural trends. Each feature was scored three independent
              times using the same model (Claude Opus) and the same rubric
              (nine axes, 1&ndash;5 scale), producing 2,700 individual score
              comparisons.
            </p>
            <p>
              Sample size of 100 exceeds the Koo &amp; Li (2016) recommended
              minimum of 30 heterogeneous samples for ICC reliability studies.
              Three independent scoring runs satisfy their recommendation of
              at least three raters or occasions. For our expected ICC (~0.85)
              and minimum acceptable ICC (~0.75), the Walter, Eliasziw &amp;
              Donner (1998) formula requires approximately 20&ndash;40
              subjects with three observations each &mdash; our 100 is well
              above that threshold.
            </p>

            <p
              className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Independence of Runs
            </p>
            <p className="-mt-2">
              Each scoring run is genuinely independent. The Anthropic API is
              stateless: every call sends a fresh HTTP request with no session
              ID, no conversation thread, and no memory of prior calls. The
              prompt sends only the page images, homeowner name, issue date,
              and rubric &mdash; never prior scores. The 13% disagreement rate
              is itself evidence of independence: a caching system would
              produce 100% agreement. Furthermore, when the model assigns the
              same score across runs, it writes different rationale text each
              time &mdash; arriving at the same conclusion through a fresh
              evaluation, not retrieving a cached answer.
            </p>

            <p
              className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Results
            </p>
            <p className="-mt-2">
              Across all nine axes, Run 2 showed a mean absolute deviation
              (MAD) of 0.12 from Run 1 scores, with 87.7% exact agreement.
              Run 3 showed a MAD of 0.14 from Run 1, with 86.6% exact
              agreement. 99.7% of all scores fell within &plusmn;1 of the
              original &mdash; only 3 outlier comparisons per run out of 900.
              Grandeur was the most stable axis (92%/89% exact across Runs
              2/3), while Hospitality showed the most variability (87%/84%)
              but still achieved 99% within &plusmn;1.
            </p>
            <p>
              Total cost for scoring 100 features across three runs: $16.41
              ($5.47 per run). The instrument is both reliable and economical.
            </p>
          </div>

          {/* ── Same House, Three Test Runs ── */}
          {(() => {
            // ── Agreement data: 3 houses × 3 runs ──
            const agreementHouses = [
              {
                name: "Donald Judd",
                title: "Donald Judd\u2019s Swiss Retreat",
                year: 1991,
                scores: [1, 1, 1],
                scoreColor: GREEN,
                imgUrl: "https://architecturaldigest.blob.core.windows.net/architecturaldigest19910901thumbnails/Pages/0x600/76.jpg",
                linkUrl: "/report/4304",
                runs: [
                  "Judd\u2019s retreat is the epitome of \u2018if you know you know\u2019 \u2014 his own minimalist sculptures and handmade furniture serve his artistic practice rather than performing wealth, and the converted provincial inn in a remote lakeside village is deliberately anti-ostentatious.",
                  "The quintessential \u2018if you know you know\u2019 space \u2014 the wealth is in the artistic vision and restraint, not in brand signaling; his own sculptures and furniture serve his personal aesthetic\u2026the lakeside setting is deliberately out of sight from chic resort towns.",
                  "The antithesis of performance \u2014 a remote lakeside inn transformed for private artistic work, furnished with his own designs and pieces by Alvar Aalto, with no brand signaling or wealth display.",
                ],
                insight: (
                  <>
                    All three runs independently scored 1 and all three used
                    the phrase &ldquo;if you know you know&rdquo; or its
                    equivalent.{" "}
                    <span style={{ color: GOLD }}>
                      But the supporting evidence differs:
                    </span>{" "}
                    Run 1 emphasizes the village remoteness, Run 2 notes
                    it&rsquo;s &ldquo;out of sight from chic resort
                    towns,&rdquo; Run 3 cites specific furniture (Aalto).
                  </>
                ),
              },
              {
                name: "Tyler Perry",
                title: "Setting the Scenes",
                year: 2019,
                scores: [5, 5, 5],
                scoreColor: COPPER,
                imgUrl: "https://architecturaldigest.blob.core.windows.net/architecturaldigest20191201thumbnails/Pages/0x600/98.jpg",
                linkUrl: "/report/9516",
                runs: [
                  "The entire facility is pure performance \u2014 a full White House replica, commercial jet set, brownstone facades, and church interior all exist to create spectacle.",
                  "A performance of mogul-level ambition \u2014 a personal White House replica, a commercial jet, rows of brownstones, all built to broadcast the scale of Perry\u2019s empire, with the article noting it\u2019s the largest production facility owned by an African American.",
                  "Theatrical by definition \u2014 a full White House replica, back-lot brownstones, a mock commercial jet, and a church set all exist to perform and impress, and Perry explicitly describes the scale as exceeding any African American-owned production facility in history.",
                ],
                insight: (
                  <>
                    All three runs scored 5 instantly &mdash; a White House
                    replica and a private commercial jet are hard to argue
                    with.{" "}
                    <span style={{ color: GOLD }}>
                      But the reasoning differs:
                    </span>{" "}
                    Run 1 focuses on spectacle, Run 2 frames it as
                    &ldquo;mogul-level ambition,&rdquo; Run 3 notes
                    Perry&rsquo;s own words about historical significance.
                  </>
                ),
              },
              {
                name: "Cher",
                title: "Architectural Digest Visits: Cher",
                year: 1996,
                scores: [4, 4, 4],
                scoreColor: GOLD,
                imgUrl: "https://architecturaldigest.blob.core.windows.net/architecturaldigest19961001thumbnails/Pages/0x600/150.jpg",
                linkUrl: "/report/4726",
                runs: [
                  "A 10,000-square-foot Venetian-Gothic villa on La Gorce Island with Egyptian bronze figures, 17th-century Italian paintings, and a Moorish courtyard \u2014 that performs Cher\u2019s larger-than-life persona, though it serves her genuine aesthetic obsession rather than pure brand display.",
                  "A dramatic Gothic-romantic fantasy at high volume \u2014 Egyptian bronze figures, religious paintings, a Gothic iron bed, Moorish tilework \u2014 it\u2019s a self-conscious spectacle that broadcasts Cher\u2019s persona, though it serves her genuine taste rather than brand-name signaling.",
                  "A deliberate performance of a very specific aesthetic identity \u2014 Gothic ecclesiastical grandeur with Egyptian bronzes, religious paintings, and Moorish architecture \u2014 that broadcasts Cher\u2019s larger-than-life persona, though it serves her genuine taste rather than brand names.",
                ],
                insight: (
                  <>
                    All three scored 4 (not 5) for the same reason: the home
                    performs loudly, but it serves Cher&rsquo;s genuine
                    aesthetic obsession rather than generic brand display.{" "}
                    <span style={{ color: GOLD }}>
                      That &ldquo;though&rdquo; clause appears independently
                      in all three runs
                    </span>{" "}
                    &mdash; the model consistently distinguishes between
                    theatrical self-expression (4) and theatrical
                    wealth-broadcasting (5).
                  </>
                ),
              },
            ];

            // ── Disagreement data: 3 houses × 3 runs ──
            const disagreementHouses = [
              {
                name: "Peter Marino",
                title: "Winter Wonder",
                year: 2016,
                scores: [4, 4, 3],
                scoreColor: GOLD,
                imgUrl: "https://architecturaldigest.blob.core.windows.net/architecturaldigest20160101thumbnails/Pages/0x600/184.jpg",
                linkUrl: "/dossier/300",
                runs: [
                  "Multiple monumental Anselm Kiefer paintings (globally recognized artist), a Han dynasty horse, Charlotte Perriand bench, Jean-Michel Frank armchair, Poltrona Frau furniture, Loro Piana cashmere curtains\u2026all broadcast significant wealth and connoisseurship to an audience.",
                  "The dramatically cantilevered bird-in-flight architecture, multiple monumental Anselm Kiefer paintings, Han dynasty horse sculpture, rose candalgia marble master bath from a buying trip to Carrara\u2026all broadcast significant wealth and connoisseurship.",
                  "Multiple monumental Anselm Kiefer paintings, named designer furniture (Poltrona Frau, Charlotte Perriand, Jean-Michel Frank, Carlo de Carli)\u2026all announce significant wealth and taste, but the collection reflects genuine decades-long passion rather than brand-name trophy display.",
                ],
                insight: (
                  <>
                    Runs 1 and 2 focused on the broadcasting &mdash; the
                    Kiefers, the Han dynasty horse, the marble bath. Run 3
                    noticed the same objects but gave credit for &ldquo;genuine
                    decades-long passion,&rdquo; pulling it down to 3.{" "}
                    <span style={{ color: GOLD }}>
                      This is exactly the kind of subjective edge case where
                      reasonable raters disagree.
                    </span>
                  </>
                ),
              },
              {
                name: "James Burrows",
                title: "A Bel-Air Program",
                year: 1997,
                scores: [2, 3, 3],
                scoreColor: GOLD,
                imgUrl: "https://architecturaldigest.blob.core.windows.net/architecturaldigest19970701thumbnails/Pages/0x600/104.jpg",
                linkUrl: "/report/8153",
                runs: [
                  "Quiet, knowing wealth through quality English antiques, Scalamandr\u00e9 and Clarence House fabrics\u2026the Emmy awards are casually placed in the library rather than showcased.",
                  "Recognizable contemporary art (Fischl, Ruscha, Andoe) and Emmy awards, and the previous ownership by Richard Gere and Cindy Crawford is mentioned, signaling Hollywood status, but the overall tone is restrained.",
                  "The Eric Fischl painting prominently displayed, Emmy awards visible on the library shelf, and recognizable designer pieces signal taste-conscious display, but the atmosphere is restrained rather than brand-broadcasting.",
                ],
                insight: (
                  <>
                    Run 1 emphasized the casualness of the Emmy placement
                    (&ldquo;casually placed\u2026rather than showcased&rdquo;)
                    and scored low. Runs 2 and 3 weighed the Hollywood signals
                    more heavily &mdash; Emmys visible, Fischl painting
                    prominent, Gere/Crawford provenance &mdash; and bumped it
                    to 3.{" "}
                    <span style={{ color: GOLD }}>
                      The debate: are casually displayed Emmys a performance
                      or not?
                    </span>
                  </>
                ),
              },
              {
                name: "Anonymous",
                title: "In the Spirit of Mustique",
                year: 1993,
                scores: [1, 2, 2],
                scoreColor: GOLD,
                imgUrl: "https://architecturaldigest.blob.core.windows.net/architecturaldigest19930701thumbnails/Pages/0x600/150.jpg",
                linkUrl: "/report/7828",
                runs: [
                  "The anonymous businessman explicitly values total privacy (\u2018there are no celebrities, only friends\u2019), uses \u2018nonaggressive materials,\u2019 and the wealth is expressed through land, location, and quiet architectural quality.",
                  "\u2018Nonaggressive materials\u2019 of natural wood and copper, deliberately avoids ostentation\u2026wealth is evident in the seven-acre site and scale but not performed.",
                  "While the house is on exclusive Mustique alongside Princess Margaret and Mick Jagger, the owner insists \u2018there are no celebrities, only friends\u2019\u2026wealth expressed through land and privacy rather than display.",
                ],
                insight: (
                  <>
                    Run 1 took the owner&rsquo;s privacy claim at face value
                    and scored 1 (&ldquo;if you know you know&rdquo;). Runs 2
                    and 3 acknowledged that living on Mustique next to Princess
                    Margaret and Mick Jagger is itself a form of quiet
                    performance &mdash; you chose to be there &mdash; and
                    scored 2.{" "}
                    <span style={{ color: GOLD }}>
                      A defensible disagreement either way.
                    </span>
                  </>
                ),
              },
            ];

            // Shared 3×3 grid renderer
            function ThreeByThreeGrid({
              houses,
              label,
            }: {
              houses: typeof agreementHouses;
              label: string;
            }) {
              return (
                <div
                  className="mt-4 grid gap-5 md:grid-cols-3"
                  aria-label={label}
                >
                  {houses.map((house) => (
                    <div
                      key={house.name}
                      className="flex flex-col overflow-hidden rounded border"
                      style={{ backgroundColor: CARD_BG, borderColor: BORDER, boxShadow: CARD_GLOW }}
                    >
                      {/* Image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={house.imgUrl}
                        alt={`${house.name} — ${house.title}`}
                        className="w-full object-cover"
                        style={{
                          maxHeight: "200px",
                          filter: "grayscale(30%) contrast(1.05)",
                        }}
                      />

                      {/* Name header */}
                      <div
                        className="px-4 py-3 text-center"
                        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: CARD_DEEP }}
                      >
                        <a
                          href={house.linkUrl}
                          className="text-[13px] font-bold underline decoration-1 underline-offset-2"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          {house.name}
                        </a>
                        <p
                          className="mt-0.5 text-[10px]"
                          style={{ fontFamily: BODY, color: TEXT_DIM }}
                        >
                          &ldquo;{house.title}&rdquo; ({house.year})
                        </p>
                      </div>

                      {/* Three run quotes stacked vertically */}
                      <div className="flex flex-1 flex-col">
                        {house.runs.map((text, runIdx) => (
                          <div
                            key={runIdx}
                            className="px-4 py-3"
                            style={{
                              borderBottom: `1px solid ${BORDER}`,
                            }}
                          >
                            <p
                              className="mb-1.5 text-[8px] font-bold tracking-widest"
                              style={{ fontFamily: MONO, color: TEXT_DIM }}
                            >
                              RUN {runIdx + 1} &mdash; THEATRICALITY
                            </p>
                            <p
                              className="text-[12px] leading-[1.65] italic"
                              style={{ fontFamily: BODY, color: TEXT_MID }}
                            >
                              &ldquo;{text}&rdquo;
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                              <span
                                className="inline-flex items-center justify-center rounded px-2 py-px text-[13px] font-bold"
                                style={{
                                  fontFamily: MONO,
                                  backgroundColor: house.scoreColor,
                                  color: "#FFFFFF",
                                  minWidth: "24px",
                                }}
                              >
                                {house.scores[runIdx]}
                              </span>
                              <span
                                className="text-[11px] tracking-wide"
                                style={{ fontFamily: MONO, color: TEXT_DIM }}
                              >
                                Theatricality
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Insight footer */}
                      <div
                        className="mt-auto px-4 py-3"
                        style={{ backgroundColor: CARD_DEEP }}
                      >
                        <p
                          className="text-[11px] leading-[1.65]"
                          style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                        >
                          {house.insight}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div className="mt-14">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Same House, Three Test Runs
                </p>
                <p
                  className="mt-2 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  Numbers only tell half the story. Below are the actual
                  rationale texts produced by each independent scoring run for
                  six homes spanning the full Theatricality scale. The first
                  three show perfect agreement &mdash; identical scores through
                  genuinely different reasoning. The second three show the
                  model&rsquo;s &plusmn;1 disagreements on genuinely ambiguous
                  cases.
                </p>

                {/* ══════════════════════════════════════════════════════════
                    PERFECT AGREEMENT — 3×3 grid
                ══════════════════════════════════════════════════════════ */}
                <p
                  className="mt-10 text-[9px] font-bold tracking-widest"
                  style={{ fontFamily: MONO, color: GREEN }}
                >
                  PERFECT AGREEMENT &mdash; SAME SCORE, DIFFERENT REASONING
                </p>
                <ThreeByThreeGrid houses={agreementHouses} label="Perfect agreement cases" />

                {/* ══════════════════════════════════════════════════════════
                    THOUGHTFUL DISAGREEMENT — 3×3 grid
                ══════════════════════════════════════════════════════════ */}
                <p
                  className="mt-14 text-[9px] font-bold tracking-widest"
                  style={{ fontFamily: MONO, color: GOLD }}
                >
                  THOUGHTFUL DISAGREEMENT &mdash; &plusmn;1 ON GENUINELY AMBIGUOUS CASES
                </p>
                <p
                  className="mt-2 text-[13px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
                  style={{ fontFamily: BODY, color: TEXT_DIM }}
                >
                  Even the &ldquo;disagreements&rdquo; are thoughtful. The
                  model is debating genuinely ambiguous cases &mdash; is Marino
                  a collector or a showman? Are casually placed Emmys a
                  performance? Is choosing Mustique itself theatrical? These
                  are questions a panel of human raters would split on too.
                </p>
                <ThreeByThreeGrid houses={disagreementHouses} label="Thoughtful disagreement cases" />
              </div>
            );
          })()}

          {/* ── Reliability Results Table ── */}
          <div
            className="mt-10 overflow-hidden rounded border"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div
              className="px-4 py-2.5"
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                TEST&ndash;RETEST RELIABILITY &mdash; 3 RUNS &times; 100 FEATURES &times; 9 AXES
              </p>
            </div>
            <div className="overflow-x-auto p-4">
              <table
                className="w-full text-[11px]"
                style={{ fontFamily: MONO, borderCollapse: "collapse" }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <th className="px-3 py-2 text-left" style={{ color: TEXT_LIGHT }}>
                      Axis
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: GREEN }}>
                      Run 2 MAD
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: GREEN }}>
                      Run 2 Exact
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: COPPER }}>
                      Run 3 MAD
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: COPPER }}>
                      Run 3 Exact
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: GOLD }}>
                      Run 3 &plusmn;1
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { axis: "Grandeur", r2mad: "0.08", r2ex: "92%", r3mad: "0.11", r3ex: "89%", r3pm: "100%" },
                    { axis: "Material Warmth", r2mad: "0.12", r2ex: "88%", r3mad: "0.16", r3ex: "85%", r3pm: "99%" },
                    { axis: "Maximalism", r2mad: "0.12", r2ex: "88%", r3mad: "0.13", r3ex: "87%", r3pm: "100%" },
                    { axis: "Historicism", r2mad: "0.15", r2ex: "85%", r3mad: "0.14", r3ex: "86%", r3pm: "100%" },
                    { axis: "Provenance", r2mad: "0.14", r2ex: "86%", r3mad: "0.15", r3ex: "85%", r3pm: "100%" },
                    { axis: "Hospitality", r2mad: "0.14", r2ex: "87%", r3mad: "0.17", r3ex: "84%", r3pm: "99%" },
                    { axis: "Formality", r2mad: "0.12", r2ex: "88%", r3mad: "0.10", r3ex: "91%", r3pm: "99%" },
                    { axis: "Curation", r2mad: "0.15", r2ex: "85%", r3mad: "0.13", r3ex: "87%", r3pm: "100%" },
                    { axis: "Theatricality", r2mad: "0.10", r2ex: "90%", r3mad: "0.16", r3ex: "85%", r3pm: "99%" },
                  ].map((row) => (
                    <tr
                      key={row.axis}
                      style={{ borderBottom: `1px solid ${BORDER}` }}
                    >
                      <td className="px-3 py-2" style={{ color: TEXT_LIGHT }}>
                        {row.axis}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: GREEN }}>
                        {row.r2mad}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: GREEN }}>
                        {row.r2ex}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: COPPER }}>
                        {row.r3mad}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: COPPER }}>
                        {row.r3ex}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: GOLD }}>
                        {row.r3pm}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                    <td
                      className="px-3 py-2 font-bold"
                      style={{ color: TEXT_LIGHT }}
                    >
                      MEAN
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: GREEN }}
                    >
                      0.12
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: GREEN }}
                    >
                      87.7%
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: COPPER }}
                    >
                      0.14
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: COPPER }}
                    >
                      86.6%
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: GOLD }}
                    >
                      99.7%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
