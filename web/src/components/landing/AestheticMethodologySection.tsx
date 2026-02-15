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
                Test-retest reliability (20 features scored twice, measuring
                ICC). Human calibration set (25&ndash;30 features manually
                scored by a licensed architect). Cohen&rsquo;s kappa for
                inter-rater agreement. Results pending.
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
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
