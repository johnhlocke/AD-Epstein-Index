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
import { GROUP_COLORS } from "@/lib/design-tokens";
import { PCASection } from "@/components/charts/PCAChart";
import axisExemplars from "./axis-exemplars.json";

// ── Exemplar types ─────────────────────────────────────────────────────────
interface Exemplar {
  featureId: number;
  homeowner: string;
  articleTitle: string;
  year: number | null;
  score: number;
  imageUrl: string;
  caption: string;
  dossierId: number | null;
}
interface AxisExemplarEntry {
  axis: string;
  low: Exemplar | null;
  high: Exemplar | null;
}
const exemplarData = axisExemplars as Record<string, AxisExemplarEntry>;

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
  key: string; // key into exemplarData
  description: string;
  anchors: [string, string]; // [low anchor, high anchor]
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
        key: "grandeur",
        description:
          "Scale and material weight of the architecture. Ceiling height, room volume, stone vs. drywall. How much space does the architecture demand?",
        anchors: [
          "8-foot ceilings, human-scale rooms, drywall",
          "Triple-height spaces, gilded surfaces, glossy materials. The architecture dominates its occupants",
        ],
      },
      {
        num: 2,
        name: "Material Warmth",
        key: "material_warmth",
        description:
          "The dominant tactile temperature of the space. Cold (marble, chrome, lacquer) to warm (wood, linen, leather). What do your hands expect to feel?",
        anchors: [
          "White marble, lacquered surfaces, chrome, glass. Hard and cold",
          "Wide-plank oak, linen, leather, terracotta, stone fireplace. Everything is tactile",
        ],
      },
      {
        num: 3,
        name: "Maximalism",
        key: "maximalism",
        description:
          "Density of objects with internal coherence. Not just quantity \u2014 quantity with dialogue between color, texture, pattern, and provenance.",
        anchors: [
          "Spare, minimal, few objects, open space",
          "Maximum density with maximum coherence. Pattern-on-pattern, every surface activated",
        ],
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
        key: "historicism",
        description:
          "How consistently the space commits to a historical period. Measures temporal range from no period reference to full era consistency. Penalizes anachronisms.",
        anchors: [
          "No historical reference. Contemporary everything",
          "Full era consistency. Integrated infrastructure, no anachronisms",
        ],
      },
      {
        num: 5,
        name: "Provenance",
        key: "provenance",
        description:
          "How convincingly the space communicates accumulated life. Patina, wear, inherited objects. Not the age of the antiques \u2014 the relationship between the objects and the building.",
        anchors: [
          "Everything arrived at once. New construction, pristine furnishings",
          "Genuine accumulation across generations. Fading, chips, water rings",
        ],
      },
      {
        num: 6,
        name: "Hospitality",
        key: "hospitality",
        description:
          "Whether the home is designed primarily for its residents or for their guests. Private retreat vs. social venue.",
        anchors: [
          "Designed for the resident. Spaces feel right with one or two people",
          "Social venue. Guest wings, ballrooms, terraces scaled for events. The architecture is waiting for the party",
        ],
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
        key: "formality",
        description:
          "The behavioral rules the room enforces on its occupants. Does the room invite you in or put you in your place?",
        anchors: [
          "Warm, personal, curl-up furniture. The room says \u201cyou belong here\u201d",
          "Overscaled, expensive, uncomfortable. The room makes you feel small",
        ],
      },
      {
        num: 8,
        name: "Curation",
        key: "curation",
        description:
          "Who directed this room and for whom. The spectrum from self-curated private living to designer-directed publishable lifestyle.",
        anchors: [
          "Self-curated. The homeowner chose everything for personal reasons",
          "Fully designer-directed for editorial lifestyle. Publishable, placeless",
        ],
      },
      {
        num: 9,
        name: "Theatricality",
        key: "theatricality",
        description:
          "How loudly the room performs wealth for an outside audience. The gap between \u201cif you know you know\u201d and \u201ceveryone must know.\u201d",
        anchors: [
          "\u201cIf you know you know.\u201d Function-first luxury. Wealth serves the self",
          "Full performance. Brand-name everything, celebrity photos, gilding. Everything needs you to know its price",
        ],
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

// ── Exemplar image sub-component ────────────────────────────────────────────

function ExemplarImage({
  exemplar,
  side,
  groupColor,
}: {
  exemplar: Exemplar | null;
  side: "low" | "high";
  groupColor: string;
}) {
  if (!exemplar) return null;
  const isLow = side === "low";
  const linkUrl = exemplar.dossierId
    ? `/dossier/${exemplar.dossierId}`
    : `/report/${exemplar.featureId}`;
  return (
    <div className="flex-1">
      <a href={linkUrl} className="block">
        <div className="overflow-hidden rounded" style={{ height: "180px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={exemplar.imageUrl}
            alt={`${exemplar.homeowner} — score ${exemplar.score}`}
            className="h-full w-full object-cover"
            style={{
              filter: isLow
                ? "grayscale(50%) contrast(1.05)"
                : "grayscale(10%) contrast(1.1)",
            }}
          />
        </div>
      </a>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="inline-flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded text-[11px] font-bold"
          style={{
            fontFamily: MONO,
            backgroundColor: `${groupColor}22`,
            color: groupColor,
          }}
        >
          {exemplar.score}
        </span>
        <span
          className="text-[10px]"
          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
        >
          {exemplar.homeowner}
          {exemplar.year ? ` (${exemplar.year})` : ""}
        </span>
      </div>
      <p
        className="mt-1.5 text-[11px] leading-[1.6]"
        style={{ fontFamily: BODY, color: TEXT_DIM }}
      >
        {exemplar.caption}
      </p>
      <a
        href={linkUrl}
        className="mt-2 inline-block text-[10px] tracking-wide hover:opacity-80"
        style={{ fontFamily: MONO, color: groupColor }}
      >
        Full Aesthetic Profile &rarr;
      </a>
    </div>
  );
}

// ── 9-axis radar data (predicted divergence, hardcoded) ──────────────────────

// Real baseline means computed from all 3,763 scored features (2026-02-22)
const BASELINE_MEANS = {
  grandeur: 3.59,
  material_warmth: 4.12,
  maximalism: 3.61,
  historicism: 3.25,
  provenance: 3.34,
  hospitality: 3.28,
  formality: 2.85,
  curation: 3.57,
  theatricality: 2.37,
};

// Standard deviations for baseline spread
const BASELINE_SD = {
  grandeur: 0.95,
  material_warmth: 0.89,
  maximalism: 1.08,
  historicism: 1.19,
  provenance: 1.08,
  hospitality: 1.01,
  formality: 1.10,
  curation: 0.87,
  theatricality: 0.94,
};

// Baseline-only radar data (Section 7)
const baselineRadarData = [
  { axis: "Grandeur", mean: 3.59, lo: 2.64, hi: 4.54 },
  { axis: "Material Warmth", mean: 4.12, lo: 3.23, hi: 5.00 },
  { axis: "Maximalism", mean: 3.61, lo: 2.53, hi: 4.69 },
  { axis: "Historicism", mean: 3.25, lo: 2.06, hi: 4.44 },
  { axis: "Provenance", mean: 3.34, lo: 2.26, hi: 4.42 },
  { axis: "Hospitality", mean: 3.28, lo: 2.27, hi: 4.29 },
  { axis: "Formality", mean: 2.85, lo: 1.75, hi: 3.95 },
  { axis: "Curation", mean: 3.57, lo: 2.70, hi: 4.44 },
  { axis: "Theatricality", mean: 2.37, lo: 1.43, hi: 3.31 },
];

// Comparison radar data — Epstein values still predicted (Section 8)
const radarData = [
  { axis: "Grandeur", baseline: 3.59, epstein: 4.0 },
  { axis: "Material Warmth", baseline: 4.12, epstein: 2.3 },
  { axis: "Maximalism", baseline: 3.61, epstein: 3.5 },
  { axis: "Historicism", baseline: 3.25, epstein: 3.3 },
  { axis: "Provenance", baseline: 3.34, epstein: 2.8 },
  { axis: "Hospitality", baseline: 3.28, epstein: 4.0 },
  { axis: "Formality", baseline: 2.85, epstein: 4.0 },
  { axis: "Curation", baseline: 3.57, epstein: 4.2 },
  { axis: "Theatricality", baseline: 2.37, epstein: 3.8 },
];

// Group label mapping for colored axis labels
const axisGroupMap: Record<string, string> = {};
groups.forEach((g) => g.axes.forEach((a) => (axisGroupMap[a.name] = g.label)));

// GROUP_COLORS imported from @/lib/design-tokens

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
            there was no way to capture <em>how</em> classical, or to
            distinguish a tasteful Georgian from a gilded McMansion. Numeric
            scales were needed: calibrated 1&ndash;5 axes, each anchored by
            concrete visual descriptions at both endpoints.
          </p>
          <p>
            The axes were developed through iterative adversarial calibration
            between an AI researcher and a licensed architect. Starting from
            the question &ldquo;what do you actually notice when you walk into
            a room?&rdquo;, we refined through concrete edge-case exercises
            &mdash; scoring the same home independently, comparing results,
            and resolving disagreements into clearer anchor definitions.
          </p>
          <p>
            A room operates on three levels simultaneously: its physical
            presence (<span style={{ color: GROUP_COLORS.SPACE }}>SPACE</span>),
            the narrative it constructs about its inhabitants (
            <span style={{ color: GROUP_COLORS.STORY }}>STORY</span>), and
            the audience it performs for (
            <span style={{ color: GROUP_COLORS.STAGE }}>STAGE</span>). Three
            independent axes per group, nine total. This adapts Osgood&rsquo;s
            semantic differential method [5] to interior design &mdash;
            bipolar scales anchored by descriptive opposites.
          </p>
          <p>
            Each axis is scored 1&ndash;5 with both endpoints anchored by
            visual descriptions. All 3,763 features were scored by Claude Opus
            4.6 Vision reading original magazine page images. No object
            detection dataset, no CNN training set. The model reads images
            holistically. The rubric <em>is</em> the reproducibility
            mechanism &mdash; validated through test&ndash;retest ICC &ge;
            0.949 (Section 3 below).
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
            subtitle="Why these nine dimensions. How they were calibrated. What each one measures."
          />

          {/* Derivation prose */}
          <div
            className="mt-10 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p>
              The axes emerged from a question posed to a practicing architect:
              <em>
                &ldquo;When you walk into a room photographed for AD, what do
                you actually notice?&rdquo;
              </em>{" "}
              Answers clustered into three domains &mdash; physical
              weight/texture, the story the objects tell, and who the room
              performs for. Three independent dimensions per domain.
            </p>
            <p>
              Anchors were calibrated through edge-case exercises. A Palm Beach
              mansion (2010, Mediterranean Revival, Basquiat on the wall,
              celebrity photos on the mantel) vs. a Connecticut farmhouse
              (1920s stone, worn Chesterfield, Saarinen table, folk art). Scored
              independently by the architect &rarr; reference profiles that
              stress-tested every axis.
            </p>
          </div>

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

                {/* Axis cards — one per row, 4 minor columns wide */}
                <div className="flex flex-col gap-8">
                  {group.axes.map((axis) => {
                    const exemplar = exemplarData[axis.key];
                    const gColor =
                      GROUP_COLORS[group.label] || TEXT_MID;
                    return (
                      <div
                        key={axis.num}
                        className="rounded border p-8 md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
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
                              color: `${gColor}66`,
                            }}
                          >
                            {String(axis.num).padStart(2, "0")}
                          </span>
                          <span
                            className="text-[18px] font-bold tracking-wide"
                            style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                          >
                            {axis.name}
                          </span>
                        </div>

                        {/* Description */}
                        <p
                          className="mt-3 text-[14px] leading-[1.7]"
                          style={{ fontFamily: BODY, color: TEXT_MID }}
                        >
                          {axis.description}
                        </p>

                        {/* ── Prominent 1–5 scale line ── */}
                        <div className="mt-6">
                          <div className="flex items-center gap-4">
                            <span
                              className="text-[20px] font-bold"
                              style={{
                                fontFamily: MONO,
                                color: `${gColor}88`,
                              }}
                            >
                              1
                            </span>
                            <div
                              className="relative h-[2px] flex-1"
                              style={{
                                background: `linear-gradient(to right, ${gColor}44, ${gColor}22 40%, ${gColor}22 60%, ${gColor})`,
                              }}
                            >
                              {/* Tick marks at 2, 3, 4 */}
                              {[25, 50, 75].map((pct) => (
                                <div
                                  key={pct}
                                  className="absolute top-[-3px] h-[8px] w-[1px]"
                                  style={{
                                    left: `${pct}%`,
                                    backgroundColor: `${gColor}44`,
                                  }}
                                />
                              ))}
                            </div>
                            <span
                              className="text-[20px] font-bold"
                              style={{
                                fontFamily: MONO,
                                color: gColor,
                              }}
                            >
                              5
                            </span>
                          </div>
                          {/* Anchor labels below the line */}
                          <div className="mt-2 flex justify-between gap-8">
                            <p
                              className="max-w-[45%] text-[11px] leading-[1.5]"
                              style={{ fontFamily: BODY, color: TEXT_DIM }}
                            >
                              {axis.anchors[0]}
                            </p>
                            <p
                              className="max-w-[45%] text-right text-[11px] leading-[1.5]"
                              style={{ fontFamily: BODY, color: TEXT_DIM }}
                            >
                              {axis.anchors[1]}
                            </p>
                          </div>
                        </div>

                        {/* Visual exemplars — score 1 vs score 5 */}
                        {exemplar && (
                          <div className="mt-6 flex gap-6">
                            <ExemplarImage
                              exemplar={exemplar.low}
                              side="low"
                              groupColor={gColor}
                            />
                            <ExemplarImage
                              exemplar={exemplar.high}
                              side="high"
                              groupColor={gColor}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              HOW THE SCORER SEES — Vision Methodology
          ════════════════════════════════════════════════════════════════ */}
          <div
            className="mt-14 rounded border p-8"
            style={{
              backgroundColor: CARD_DEEP,
              borderColor: BORDER,
              boxShadow: CARD_GLOW,
            }}
          >
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              HOW THE SCORER SEES
            </p>
            <div
              className="mt-5 flex flex-col gap-4 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                The rater is Claude Opus 4.6 Vision&mdash;a general-purpose
                multimodal LLM, not a specialized object detector. There is no
                separate CNN, no labeled training set, no formal object
                detection dataset.
              </p>
              <p>
                <span style={{ color: TEXT_LIGHT }}>
                  Why not object detection?
                </span>{" "}
                Because our source material is magazine pages, not bare
                photographs. Each page is a composite document: a photograph
                of an interior, surrounded by article text, captions, pull
                quotes, and editorial framing. An object detector sees pixels.
                An LLM reads the page.
              </p>
              <p>
                Consider what happens when the scorer encounters a page from
                David Copperfield&rsquo;s 1995 feature. An object detector
                would inventory: <em>glass display cases, old shoes, wooden
                trunk, framed documents</em>. It would count objects and
                classify materials. It cannot know those are Houdini&rsquo;s
                baby shoes, his metamorphosis trunk, and Kellar&rsquo;s
                unpublished biography manuscript&mdash;because that
                information is in the article text printed on the same page.
                That context is what makes the Provenance score a 5 instead
                of a 2.
              </p>
              <p>
                This dual-channel reading is the core methodological
                advantage. A gilt-framed portrait on a wall is just
                d&eacute;cor to an object detector. The LLM reads the
                caption&mdash;&ldquo;ancestral portrait, circa
                1780&rdquo;&mdash;and simultaneously feeds Provenance,
                Historicism, and Curation. A room full of branded furniture
                is &ldquo;high object count&rdquo; to a CNN. The LLM reads
                the article describing the homeowner&rsquo;s celebrity
                friendships and scores Theatricality. Shabrina et al. [3]
                classified 50,000 living rooms via transfer learning but
                explicitly could not capture dimensions like
                intent&mdash;because object detection doesn&rsquo;t read
                narrative.
              </p>
              <p>
                More concretely: 5 of our 9 axes are impossible to score
                from visual features alone.{" "}
                <strong style={{ color: TEXT_LIGHT }}>Provenance</strong>{" "}
                requires knowing whether objects were inherited or
                purchased&mdash;text only.{" "}
                <strong style={{ color: TEXT_LIGHT }}>Hospitality</strong>{" "}
                requires knowing whether the home is used for
                entertaining&mdash;text only.{" "}
                <strong style={{ color: TEXT_LIGHT }}>Curation</strong>{" "}
                requires knowing whether a designer directed the
                space&mdash;text only.{" "}
                <strong style={{ color: TEXT_LIGHT }}>Theatricality</strong>{" "}
                requires understanding social intent&mdash;text plus image.{" "}
                <strong style={{ color: TEXT_LIGHT }}>Historicism</strong>{" "}
                requires distinguishing genuine period commitment from
                anachronistic pastiche&mdash;text plus image. Only the
                SPACE group (Grandeur, Material Warmth, Maximalism) could
                plausibly be scored from photographs alone, and even there
                the article text provides crucial calibration.
              </p>
              <p>
                <span style={{ color: TEXT_LIGHT }}>
                  The trade-off:
                </span>{" "}
                classifications aren&rsquo;t reproducible in the traditional
                ML sense&mdash;no model checkpoint to share, no decision
                boundary to inspect. The resolution: grounded in
                LLM-as-Judge literature [7] (ICC 0.972 with clear criteria),
                human calibration, test&ndash;retest reliability, and clear
                rubric anchors. The rubric <em>is</em> the reproducibility
                mechanism.
              </p>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              ADVERSARIAL CALIBRATION — CHAT TRANSCRIPT
          ════════════════════════════════════════════════════════════════ */}
          <div className="mt-14">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Calibration: Adversarial Testing with a Licensed Architect
            </p>
            <p
              className="mt-3 text-[13px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              The scoring instrument was derived through live adversarial
              dialogue. The AI posed 11 questions&mdash;one per
              axis&mdash;then presented two hypothetical homes for
              independent scoring. Every disagreement was resolved into a
              clearer rubric anchor. Excerpts from that session:
            </p>

            {/* Chat-style transcript — 2 minor columns wide */}
            <div
              className="mt-6 overflow-hidden rounded-2xl border md:max-w-[calc(2*(100%-5*24px)/6+1*24px)]"
              style={{
                backgroundColor: "#0B0A09",
                borderColor: "rgba(58, 51, 42, 0.5)",
              }}
            >
              {/* Chat header bar */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{
                  backgroundColor: "rgba(21, 18, 15, 0.9)",
                  borderBottom: "1px solid rgba(58, 51, 42, 0.4)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.6)" }}
                  />
                  <span
                    className="text-[10px] font-medium tracking-wide"
                    style={{ fontFamily: MONO, color: TEXT_MID }}
                  >
                    Calibration Session
                  </span>
                </div>
                <span
                  className="text-[9px]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  Feb 15, 2026 &middot; 7:37 PM
                </span>
              </div>

              {/* Messages */}
              <div className="flex flex-col gap-3 px-4 py-5">
                {/* Timestamp divider */}
                <div className="flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[9px]"
                    style={{
                      fontFamily: MONO,
                      color: TEXT_DIM,
                      backgroundColor: "rgba(58, 51, 42, 0.3)",
                    }}
                  >
                    7:37 PM
                  </span>
                </div>

                {/* ARCH: Setup */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      Let&rsquo;s do a bit of a back and forth, almost like
                      flashcards. I am a licensed architect and designer, so
                      can help you with this.
                    </p>
                  </div>
                </div>

                {/* Section: GRANDEUR */}
                <div className="mt-2 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[8px] font-bold tracking-widest"
                    style={{
                      fontFamily: MONO,
                      color: COPPER,
                      backgroundColor: "rgba(184, 115, 51, 0.08)",
                    }}
                  >
                    GRANDEUR
                  </span>
                </div>

                {/* AI: Q1 */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_MID }}
                    >
                      Both are expensive. Both are well-designed. But one
                      reads as grand and the other as intimate. What are the
                      first three things your eye registers?
                    </p>
                  </div>
                </div>

                {/* ARCH: A1 */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      Grand: high ceilings, glossy materials, gold colors.
                      Intimate: low ceilings, wood, books, clutter.
                    </p>
                  </div>
                </div>

                {/* Section: PROVENANCE */}
                <div className="mt-2 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[8px] font-bold tracking-widest"
                    style={{
                      fontFamily: MONO,
                      color: COPPER,
                      backgroundColor: "rgba(184, 115, 51, 0.08)",
                    }}
                  >
                    PROVENANCE
                  </span>
                </div>

                {/* AI: Q6 */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_MID }}
                    >
                      One antique table has water rings and scratches.
                      The other is pristine, clearly restored, with a
                      protective glass top. Does the wear matter?
                    </p>
                  </div>
                </div>

                {/* ARCH: A6 */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      As a collector of fine vintage artifacts, you want to
                      see the patina of time. The fading, the chips, the
                      rings. That truly conveys history. Nothing can be
                      perfect and old. Unless it is a museum.
                    </p>
                  </div>
                </div>

                {/* Section: FORMALITY */}
                <div className="mt-2 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[8px] font-bold tracking-widest"
                    style={{
                      fontFamily: MONO,
                      color: COPPER,
                      backgroundColor: "rgba(184, 115, 51, 0.08)",
                    }}
                  >
                    FORMALITY
                  </span>
                </div>

                {/* AI: Q8 */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_MID }}
                    >
                      Without anyone telling you the rules, you know how
                      to behave. What design elements enforce formality?
                    </p>
                  </div>
                </div>

                {/* ARCH: A8 */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      Some furniture wants to make you feel small. It can
                      be overscaled, expensive, uncomfortable looking. It
                      is talking to you and telling you that you are the
                      visitor, you are beneath it and the homeowner, so
                      you better take off your damn shoes!
                    </p>
                  </div>
                </div>

                {/* Section: THEATRICALITY */}
                <div className="mt-2 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[8px] font-bold tracking-widest"
                    style={{
                      fontFamily: MONO,
                      color: COPPER,
                      backgroundColor: "rgba(184, 115, 51, 0.08)",
                    }}
                  >
                    THEATRICALITY
                  </span>
                </div>

                {/* AI: Q10 */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_MID }}
                    >
                      Everything is expensive but it all feels performed.
                      What are the tells?
                    </p>
                  </div>
                </div>

                {/* ARCH: A10 */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      Brand names, statement appliances and designer
                      furniture. Big statement art by globally known
                      artists (Koons, Warhol, Hirst) with no consistent
                      theme. Pictures of the homeowner with celebrities.
                    </p>
                  </div>
                </div>

                {/* AI: Q11 */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_MID }}
                    >
                      Now flip it. What does understated wealth look like?
                    </p>
                  </div>
                </div>

                {/* ARCH: A11 */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      Older, expensive items. &ldquo;If you know you
                      know&rdquo; expensive furniture that is more low
                      key. A few insanely expensive items like a crazy
                      espresso machine. Things that aren&rsquo;t trendy
                      but timeless.
                    </p>
                  </div>
                </div>

                {/* Timestamp divider — edge cases */}
                <div className="mt-2 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[9px]"
                    style={{
                      fontFamily: MONO,
                      color: TEXT_DIM,
                      backgroundColor: "rgba(58, 51, 42, 0.3)",
                    }}
                  >
                    8:06 PM &mdash; Edge Cases
                  </span>
                </div>

                {/* AI: Edge case Provenance setup */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_MID }}
                    >
                      Palm Beach mansion, 2010. French antiques, Basquiat
                      over the fireplace, photos with two presidents.
                      You scored Provenance 1. I scored 2. Why?
                    </p>
                  </div>
                </div>

                {/* ARCH: Provenance correction */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      You can buy old things but you can&rsquo;t buy
                      provenance. Everything arrived in 2010. Nothing
                      accumulated. The building itself has no patina.
                      Provenance is about inheritance, not acquisition.
                    </p>
                  </div>
                </div>

                {/* AI: Curation disagreement */}
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_MID }}
                    >
                      Connecticut farmhouse. I scored Curation 1 because
                      there&rsquo;s no visible designer. You gave it 5.
                      That tells me there are two kinds of curation?
                    </p>
                  </div>
                </div>

                {/* ARCH: Curation redefined */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      It is maybe the distinction between the
                      designer&rsquo;s curation, and the homeowner&rsquo;s
                      curation. Let&rsquo;s say a 1 is your original
                      understanding&mdash;the homeowner is curating for
                      themselves. A 5 is a designer curating for a trendy,
                      global lifestyle that could be anyplace.
                    </p>
                  </div>
                </div>

                {/* Timestamp divider — wrap up */}
                <div className="mt-2 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[9px]"
                    style={{
                      fontFamily: MONO,
                      color: TEXT_DIM,
                      backgroundColor: "rgba(58, 51, 42, 0.3)",
                    }}
                  >
                    8:21 PM
                  </span>
                </div>

                {/* ARCH: Wrap-up */}
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  >
                    <p
                      className="text-[11.5px] leading-[1.6]"
                      style={{ fontFamily: BODY, color: TEXT_LIGHT }}
                    >
                      I like it! Good work, I enjoyed our back and forth.
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat footer */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{
                  borderTop: "1px solid rgba(58, 51, 42, 0.4)",
                  backgroundColor: "rgba(21, 18, 15, 0.9)",
                }}
              >
                <span
                  className="text-[9px]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  45 min &middot; 15 exchanges &middot; 11 axes + 2 edge
                  cases
                </span>
                <a
                  href="/calibration-transcript"
                  className="text-[9px] tracking-wide hover:opacity-80"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Full Transcript &rarr;
                </a>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              PRIOR ART, ALTERNATIVES & HONEST LIMITATIONS
          ════════════════════════════════════════════════════════════════ */}
          <div className="mt-14">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Prior Art &amp; Honest Limitations
            </p>
            <p
              className="mt-3 text-[13px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              This scoring instrument does not exist in a vacuum. Several
              academic traditions have attempted to quantify the aesthetics
              of interior spaces, and we should be transparent about where
              our approach fits, what alternatives exist, and what we
              sacrifice by choosing this method.
            </p>

            {/* Three cards: precedents, alternatives, limitations */}
            <div className="mt-6 flex flex-col gap-6">

              {/* Card 1: What supports this approach */}
              <div
                className="rounded border p-6"
                style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
              >
                <p
                  className="text-[10px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GREEN }}
                >
                  WHAT SUPPORTS THIS APPROACH
                </p>
                <div
                  className="mt-4 flex flex-col gap-4 text-[13px] leading-[1.7]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Multi-dimensional scoring has strong precedent.</strong>{" "}
                    Osgood&rsquo;s semantic differential [5] established that
                    connotative meaning can be reliably measured along multiple
                    bipolar scales&mdash;our 9-axis system adapts this technique
                    from linguistics to interior design. Nasar (1994) [12]
                    identified three categories of architectural aesthetic
                    variables&mdash;formal, symbolic, and schema-based&mdash;that
                    map roughly onto our SPACE, STORY, and STAGE groupings.
                    Stamps (2000) [13] synthesized 277 studies and 41,000
                    respondents to validate multi-dimensional approaches to
                    architectural aesthetic measurement.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>LLM-as-rater reliability is established.</strong>{" "}
                    Zheng et al. (2023) [14] showed GPT-4 achieves &gt;80%
                    agreement with human preferences&mdash;the same level as
                    human-human agreement. Yavuz (2025) [7] found ICC 0.972
                    for rubric-based LLM scoring. Hashemi et al. (2024) [15]
                    demonstrated multi-dimensional, calibrated LLM evaluation
                    with 9 named dimensions and manual rubrics&mdash;the closest
                    methodological precedent to our approach. Their RMS error
                    against human panels was &lt;0.5, roughly 2&times; better
                    than uncalibrated baselines.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Vision-language models can assess architectural aesthetics.</strong>{" "}
                    Ishiguro &amp; Motoda (2024) [16] tested GPT-4V as an
                    aesthetic image rater on 31,220 images and achieved 0.708
                    accuracy against human panels. More recently, Hara et al.
                    (2025) [17] found LLM architectural evaluations align with
                    public opinion polls at 90&ndash;100% agreement. These
                    papers suggest the underlying capability is real, even if
                    the application to interior design scoring is new.
                  </p>
                </div>
              </div>

              {/* Card 2: What we could have done instead */}
              <div
                className="rounded border p-6"
                style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
              >
                <p
                  className="text-[10px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GOLD }}
                >
                  WHAT WE COULD HAVE DONE INSTEAD
                </p>
                <div
                  className="mt-4 flex flex-col gap-4 text-[13px] leading-[1.7]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>CNN-based classification.</strong>{" "}
                    NIMA (Talebi &amp; Milanfar, 2018) [18] predicts
                    distributions of human aesthetic ratings using fine-tuned
                    CNNs trained on 255,500 images with ~200 human ratings each.
                    MUSIQ (Ke et al., 2021) [19] handles native-resolution
                    images with a Vision Transformer. These approaches have
                    massive validated training sets. We don&rsquo;t. The
                    trade-off: they produce a single &ldquo;aesthetic quality&rdquo;
                    score, not the 9 semantic dimensions we need to identify a
                    signature.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Object detection + feature engineering.</strong>{" "}
                    Shabrina et al. (2019) [3] classified 1M+ Airbnb interior
                    images by detecting 5 ornamentation elements via transfer
                    learning. Fully interpretable, fully reproducible. The
                    limitation: object detection can count chandeliers but
                    cannot score Theatricality&mdash;the semantic judgment that
                    a room is &ldquo;performing&rdquo; is beyond piecemeal
                    feature counting.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Crowdsourced human ratings.</strong>{" "}
                    The AVA dataset (Murray et al., 2012) [20] collected ~200
                    ratings per image from Amazon Mechanical Turk. This is the
                    gold standard for ground truth. For our 3,763 features
                    &times; 9 axes &times; 3+ raters, that would require
                    ~100,000 individual judgments from trained raters&mdash;a
                    genuine research-lab effort that this project cannot fund.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Berlyne&rsquo;s collative variables.</strong>{" "}
                    The New Experimental Aesthetics (Berlyne, 1971) [21]
                    measures novelty, complexity, uncertainty, and
                    conflict&mdash;universal aesthetic dimensions with decades
                    of validation. Kaplan &amp; Kaplan (1989) [22] extended
                    this to built environments with coherence, complexity,
                    legibility, and mystery. We could have adopted these
                    existing frameworks directly. We didn&rsquo;t, because they
                    were designed for natural environments and don&rsquo;t
                    capture the sociological dimensions (Theatricality,
                    Curation, Hospitality) that distinguish the Epstein
                    aesthetic from the AD baseline.
                  </p>
                </div>
              </div>

              {/* Card 3: Honest limitations */}
              <div
                className="rounded border p-6"
                style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
              >
                <p
                  className="text-[10px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  WHAT WE SHOULD BE HONEST ABOUT
                </p>
                <div
                  className="mt-4 flex flex-col gap-4 text-[13px] leading-[1.7]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Single-rater problem.</strong>{" "}
                    The entire scoring system relies on one model (Claude Opus
                    4.6) as the sole rater. Psychometric convention requires
                    multi-rater panels. Shi et al. (2024) [23] found 48.4%
                    of LLM-judge verdicts reversed under position manipulation.
                    Our test-retest ICC of 0.949+ demonstrates internal
                    consistency (the model agrees with itself), but not
                    agreement with any human ground truth. Scoring a subset
                    with a second model (GPT-4o, Gemini) for inter-model
                    reliability would strengthen the claim.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>No training set.</strong>{" "}
                    Unlike NIMA (255,500 training images) or AVA (crowdsourced
                    at scale), our instrument has zero domain-specific training
                    data. The rubric anchors substitute for a training set. This
                    is actually how expert human raters work&mdash;an architect
                    can score cold using professional judgment&mdash;but it is
                    unusual in computational aesthetics and lacks precedent.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Magazine photography bias.</strong>{" "}
                    We score professionally styled, lit, and composed
                    photographs, not actual spaces. Stamps (1990) [11]
                    validated photographs as surrogates for environmental
                    assessment, but AD imagery is several degrees more curated
                    than his stimuli. Theatricality and Formality scores may
                    be inflated by styling rather than actual design.
                    This is a valid dataset for our research question&mdash;AD&rsquo;s
                    editorial choices are part of the story&mdash;but the scores
                    describe <em>how these homes are presented</em>, not
                    necessarily how they feel in person.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Dimensional independence unproven.</strong>{" "}
                    Our 9 axes were derived through expert judgment, not factor
                    analysis of human responses (the psychometric standard;
                    Osgood et al. derived their 3 dimensions from factor
                    analysis of thousands of responses [5]). Grandeur and
                    Theatricality may be correlated. Historicism and Provenance
                    both reference temporal depth. Factor analysis on the
                    scored dataset could reveal whether we actually have 9
                    independent dimensions or fewer latent factors.
                  </p>
                  <p>
                    <strong style={{ color: TEXT_LIGHT }}>Embedded aesthetic assumptions.</strong>{" "}
                    The rubric anchors encode specific aesthetic norms. The
                    Maximalism axis values &ldquo;coherence&rdquo;&mdash;an
                    AD-specific norm that privileges curated eclecticism over
                    random accumulation. A Bourdieuian critique [1] would note
                    that this rubric encodes a particular class fraction&rsquo;s
                    taste as the measurement standard. We acknowledge this: the
                    instrument was designed to measure deviation <em>within</em>{" "}
                    AD&rsquo;s value system, not to impose universal aesthetic
                    truth.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: METHODOLOGY & VALIDATION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="2"
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
                Claude Opus 4.6 Vision (multimodal LLM) acts as a calibrated
                semantic rater, not a trained classifier. All 3,763 features
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
                Test&ndash;retest reliability study completed: 100 random
                features scored three independent times (900 comparisons).
                ICC(3,1) ranged{" "}
                <span style={{ color: GOLD }}>0.949&ndash;0.991</span>{" "}
                across all nine axes (&ldquo;Excellent&rdquo;).{" "}
                <span style={{ color: GOLD }}>91.1% exact agreement</span>,{" "}
                <span style={{ color: GOLD }}>100% within &plusmn;1</span>.
                See Section 3 below for full results and methodology.
              </p>
            </div>
          </div>

          {/* Academic grounding — annotated bibliography */}
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
              className="mt-4 flex flex-col gap-4 text-[11px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_DIM }}
            >
              {/* Foundational Theory */}
              <p
                className="text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                FOUNDATIONAL THEORY
              </p>
              <p>
                [1] Bourdieu, P. (1984). <em style={{ color: TEXT_MID }}>Distinction: A Social Critique of the Judgement of Taste.</em> Harvard University Press.
                <br />
                <span style={{ color: TEXT_DIM }}>Survey-based correspondence analysis mapping taste to social position. Our framework for treating interior design as encoded class signal.</span>
              </p>
              <p>
                [2] Veblen, T. (1899). <em style={{ color: TEXT_MID }}>The Theory of the Leisure Class,</em> Ch. 4. Macmillan.
                <br />
                <span style={{ color: TEXT_DIM }}>Domestic interior decoration as conspicuous consumption. Directly informs Theatricality and Formality axes.</span>
              </p>

              {/* Computational Interior Design Classification */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                COMPUTATIONAL INTERIOR DESIGN CLASSIFICATION
              </p>
              <p>
                [3] Shabrina, Z., Arcaute, E., &amp; Batty, M. (2019). &ldquo;Inside 50,000 Living Rooms.&rdquo; <em style={{ color: TEXT_MID }}>arXiv:1911.09635.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>Transfer learning on 50K rooms, 5 ornamentation elements across 1M+ Airbnb images. Demonstrates scale but can&rsquo;t capture semantic dimensions like Theatricality.</span>
              </p>
              <p>
                [4] Kim, S., &amp; Lee, S. (2020). &ldquo;Stochastic Detection of Interior Design Styles.&rdquo; <em style={{ color: TEXT_MID }}>Applied Sciences,</em> 10(20), 7299.
                <br />
                <span style={{ color: TEXT_DIM }}>Probabilistic multi-label style classification. Validates continuous multi-dimensional scoring over binary categories.</span>
              </p>

              {/* Perception of Architectural Space */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                PERCEPTION OF ARCHITECTURAL SPACE
              </p>
              <p>
                [5] Osgood, C. E., Suci, G. J., &amp; Tannenbaum, P. H. (1957). <em style={{ color: TEXT_MID }}>The Measurement of Meaning.</em> University of Illinois Press.
                <br />
                <span style={{ color: TEXT_DIM }}>Semantic differential method &mdash; bipolar scales for measuring connotative meaning. Our 9-axis system adapts this to interior design.</span>
              </p>
              <p>
                [6] Adilova, L., &amp; Shamoi, P. (2024). &ldquo;Aesthetic Preference Prediction in Interior Design.&rdquo; <em style={{ color: TEXT_MID }}>Applied Sciences,</em> 14(9), 3688.
                <br />
                <span style={{ color: TEXT_DIM }}>Fuzzy logic for multi-dimensional aesthetic preference scoring. Supports non-binary continuous measurement.</span>
              </p>

              {/* LLM-as-Scorer Validation */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                LLM-AS-SCORER VALIDATION
              </p>
              <p>
                [7] Yavuz, M. C. (2025). &ldquo;Is the LLM-as-a-Judge Reliable?&rdquo; <em style={{ color: TEXT_MID }}>arXiv:2502.04915.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>ICC 0.972 for rubric-based LLM scoring. Key evidence that LLMs can serve as calibrated raters when given clear criteria.</span>
              </p>

              {/* Wealth, Taste, and Social Networks */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                WEALTH, TASTE, AND SOCIAL NETWORKS
              </p>
              <p>
                [8] Trigg, A. B. (2001). &ldquo;Veblen, Bourdieu, and Conspicuous Consumption.&rdquo; <em style={{ color: TEXT_MID }}>Journal of Economic Issues,</em> 35(1), 99&ndash;115.
                <br />
                <span style={{ color: TEXT_DIM }}>Bridges Veblen + Bourdieu: consumption as both status display and class distinction.</span>
              </p>
              <p>
                [9] Schr&ouml;der, J., &amp; Wallpach, S. (2017). &ldquo;The Home as Identity Construction.&rdquo; <em style={{ color: TEXT_MID }}>European Journal of Marketing.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>Identity construction through domestic curation. Directly informs the Theatricality + Curation axes.</span>
              </p>
              <p>
                [10] Halle, D. (1993). <em style={{ color: TEXT_MID }}>Inside Culture: Art and Class in the American Home.</em> University of Chicago Press.
                <br />
                <span style={{ color: TEXT_DIM }}>Art display patterns correlate with socioeconomic position across class categories.</span>
              </p>

              {/* Methodological Validation */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                METHODOLOGICAL VALIDATION
              </p>
              <p>
                [11] Stamps, A. E. (1990). &ldquo;Use of Photographs to Simulate Environments.&rdquo; <em style={{ color: TEXT_MID }}>Perceptual and Motor Skills,</em> 71, 907&ndash;913.
                <br />
                <span style={{ color: TEXT_DIM }}>Meta-analysis: photographs are valid surrogates for in-person environmental assessment. Validates scoring from magazine page images.</span>
              </p>

              {/* Architectural Aesthetic Measurement */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                ARCHITECTURAL AESTHETIC MEASUREMENT
              </p>
              <p>
                [12] Nasar, J. L. (1994). &ldquo;Urban Design Aesthetics: The Evaluative Qualities of Building Exteriors.&rdquo; <em style={{ color: TEXT_MID }}>Environment and Behavior,</em> 26(3), 377&ndash;401.
                <br />
                <span style={{ color: TEXT_DIM }}>Three categories of aesthetic variables (formal, symbolic, schema-based) that map onto our SPACE / STORY / STAGE groupings.</span>
              </p>
              <p>
                [13] Stamps, A. E. (2000). <em style={{ color: TEXT_MID }}>Psychology and the Aesthetics of the Built Environment.</em> Kluwer Academic.
                <br />
                <span style={{ color: TEXT_DIM }}>Meta-analysis of 277 studies, 41,000 respondents, 12,000 stimuli. The most thorough empirical synthesis of architectural aesthetic preference measurement.</span>
              </p>

              {/* LLM-as-Judge Methodology */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                LLM-AS-JUDGE METHODOLOGY
              </p>
              <p>
                [14] Zheng, L., et al. (2023). &ldquo;Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena.&rdquo; <em style={{ color: TEXT_MID }}>NeurIPS 2023.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>Foundational paper on LLM-as-judge. GPT-4 achieves &gt;80% agreement with human preferences, matching human-human agreement levels.</span>
              </p>
              <p>
                [15] Hashemi, H., et al. (2024). &ldquo;LLM-Rubric: A Multidimensional, Calibrated Approach to Automated Evaluation.&rdquo; <em style={{ color: TEXT_MID }}>ACL 2024,</em> pp. 13806&ndash;13834.
                <br />
                <span style={{ color: TEXT_DIM }}>Multi-axis rubric-based LLM scoring with 9 dimensions. RMS error &lt;0.5 against human panels. Closest methodological precedent to our approach.</span>
              </p>

              {/* VLM Aesthetic Assessment */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                VISION-LANGUAGE MODEL AESTHETIC ASSESSMENT
              </p>
              <p>
                [16] Ishiguro, K., &amp; Motoda, S. (2024). &ldquo;Assessing the Aesthetic Evaluation Capabilities of GPT-4 with Vision.&rdquo; <em style={{ color: TEXT_MID }}>arXiv:2403.03594.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>GPT-4V tested as aesthetic rater on 31,220 images. Best accuracy: 0.708. Found simpler prompts outperform persona-based ones.</span>
              </p>
              <p>
                [17] Hara, T., et al. (2025). &ldquo;LLMs Judging Architecture: Generative AI Mirrors Public Polls.&rdquo; <em style={{ color: TEXT_MID }}>Preprints.org.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>LLM architectural evaluations align with public opinion at 90&ndash;100% agreement. Directly demonstrates LLM architectural aesthetic judgment.</span>
              </p>

              {/* Alternative Approaches */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                ALTERNATIVE APPROACHES (NOT USED)
              </p>
              <p>
                [18] Talebi, H., &amp; Milanfar, P. (2018). &ldquo;NIMA: Neural Image Assessment.&rdquo; <em style={{ color: TEXT_MID }}>IEEE Trans. Image Processing,</em> 27(8), 3998&ndash;4011.
                <br />
                <span style={{ color: TEXT_DIM }}>CNN trained on AVA dataset (255,500 images, ~200 ratings each). Produces single aesthetic score, not multi-dimensional.</span>
              </p>
              <p>
                [19] Ke, J., et al. (2021). &ldquo;MUSIQ: Multi-Scale Image Quality Transformer.&rdquo; <em style={{ color: TEXT_MID }}>ICCV 2021.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>Vision Transformer for aesthetic assessment at native resolution. State-of-the-art on AVA. Single-score output.</span>
              </p>
              <p>
                [20] Murray, N., Marchesotti, L., &amp; Perronnin, F. (2012). &ldquo;AVA: A Large-Scale Database for Aesthetic Visual Analysis.&rdquo; <em style={{ color: TEXT_MID }}>CVPR 2012.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>255,500+ images, each rated by ~200 people. The benchmark for crowdsourced aesthetic ground truth.</span>
              </p>
              <p>
                [21] Berlyne, D. E. (1971). <em style={{ color: TEXT_MID }}>Aesthetics and Psychobiology.</em> Appleton-Century-Crofts.
                <br />
                <span style={{ color: TEXT_DIM }}>Collative variables (novelty, complexity, uncertainty, conflict) as aesthetic determinants. Foundational framework we adapted from.</span>
              </p>
              <p>
                [22] Kaplan, R., &amp; Kaplan, S. (1989). <em style={{ color: TEXT_MID }}>The Experience of Nature.</em> Cambridge University Press.
                <br />
                <span style={{ color: TEXT_DIM }}>Preference matrix: coherence, complexity, legibility, mystery. Validated for built environments but lacks sociological dimensions.</span>
              </p>

              {/* Bias & Critique */}
              <p
                className="mt-2 text-[9px] font-bold tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                BIAS &amp; CRITIQUE
              </p>
              <p>
                [23] Shi, W., et al. (2024). &ldquo;Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge.&rdquo; <em style={{ color: TEXT_MID }}>NeurIPS 2024.</em>
                <br />
                <span style={{ color: TEXT_DIM }}>Identified 12 bias types in LLM judges; 48.4% verdict reversal under position manipulation. Key critique of single-model scoring.</span>
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: SCORING RELIABILITY
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="3"
            title="SCORING RELIABILITY"
            subtitle="Three independent runs. 900 axis-comparisons. ICC(3,1) &ge; 0.949 on all nine axes."
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
                { stat: "91.1%", label: "Exact Agreement", note: "Identical scores across all three runs (820/900)" },
                { stat: "100%", label: "Within \u00B11", note: "Zero comparisons out of 900 exceeded \u00B11" },
                { stat: "0.969", label: "Median ICC", note: "Excellent reliability on all nine axes (Koo & Li)" },
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
                      { axis: "Material Warmth", icc: "0.991", exact: "98%", note: "Highest ICC" },
                      { axis: "Grandeur", icc: "0.990", exact: "97%", note: "Near-perfect stability" },
                      { axis: "Historicism", icc: "0.982", exact: "92%", note: "100% within \u00B11" },
                    ].map((row) => (
                      <div key={row.axis} className="flex items-baseline gap-3">
                        <span
                          className="w-[110px] text-[11px]"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          {row.axis}
                        </span>
                        <span
                          className="w-[42px] text-[11px] font-bold"
                          style={{ fontFamily: MONO, color: GREEN }}
                        >
                          {row.icc}
                        </span>
                        <span
                          className="w-[32px] text-[10px]"
                          style={{ fontFamily: MONO, color: TEXT_MID }}
                        >
                          {row.exact}
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
                    LEAST STABLE (STILL EXCELLENT)
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {[
                      { axis: "Theatricality", icc: "0.949", exact: "86%", note: "Lowest ICC, still Excellent" },
                      { axis: "Provenance", icc: "0.966", exact: "87%", note: "100% within \u00B11" },
                      { axis: "Curation", icc: "0.967", exact: "91%", note: "100% within \u00B11" },
                    ].map((row) => (
                      <div key={row.axis} className="flex items-baseline gap-3">
                        <span
                          className="w-[110px] text-[11px]"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          {row.axis}
                        </span>
                        <span
                          className="w-[42px] text-[11px] font-bold"
                          style={{ fontFamily: MONO, color: GOLD }}
                        >
                          {row.icc}
                        </span>
                        <span
                          className="w-[32px] text-[10px]"
                          style={{ fontFamily: MONO, color: TEXT_MID }}
                        >
                          {row.exact}
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
              100 features were randomly sampled (seed=42 for reproducibility)
              from the full corpus of 3,763 scored homes. Each feature was
              scored three independent times using the same model (Claude Opus
              4.6) and the same v2.3 rubric (nine axes, 1&ndash;5 scale),
              producing 900 axis-comparisons across three runs.
            </p>
            <p>
              Sample size of 100 exceeds the Koo &amp; Li (2016) recommended
              minimum of 30 heterogeneous samples for ICC reliability studies.
              Three independent scoring runs satisfy their recommendation of
              at least three raters or occasions. For our observed ICC range
              (0.949&ndash;0.991) and minimum acceptable ICC (~0.75), the
              Walter, Eliasziw &amp; Donner (1998) formula requires
              approximately 20&ndash;40 subjects with three observations
              each &mdash; our 100 is well above that threshold.
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
              and rubric &mdash; never prior scores. The 9.1% disagreement
              rate is itself evidence of independence: a caching system would
              produce 100% agreement. Furthermore, when the model assigns the
              same score across runs, it writes different aesthetic summary
              text each time &mdash; arriving at the same conclusion through
              a fresh evaluation, not retrieving a cached answer.
            </p>

            <p
              className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Results
            </p>
            <p className="-mt-2">
              Intraclass Correlation Coefficients (ICC(3,1), two-way mixed,
              consistency) ranged from 0.949 (Theatricality) to 0.991
              (Material Warmth) &mdash; all nine axes in the
              &ldquo;Excellent&rdquo; range (&gt;0.90) by the Koo &amp; Li
              classification. Composite scores were even more stable: STAGE
              ICC=0.982, SPACE ICC=0.987, total 9-axis mean ICC=0.987.
              Run A showed 93.9% mean exact agreement with the original; Run
              B showed 94.4%. Across all three runs, 91.1% of comparisons
              were exact matches (820/900), and 100% fell within &plusmn;1
              &mdash; not a single comparison out of 900 exceeded &plusmn;1.
              No systematic drift was detected: all
              axis means shifted by less than 0.04 points between runs.
            </p>
            <p>
              Total cost for scoring 100 features across three runs: $34.89
              ($0.17 per feature per run). The instrument is both reliable
              and economical. For context, human inter-rater reliability in
              aesthetic judgment studies typically ranges from ICC 0.60&ndash;0.80;
              this AI scorer exceeds that threshold on every axis.
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
                TEST&ndash;RETEST RELIABILITY &mdash; ICC(3,1) &mdash; 3 RUNS &times; 100 FEATURES &times; 9 AXES
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
                      ICC(3,1)
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: GREEN }}>
                      Run A Exact
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: COPPER }}>
                      Run B Exact
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: GOLD }}>
                      3-Way Exact
                    </th>
                    <th className="px-3 py-2 text-right" style={{ color: TEXT_MID }}>
                      3-Way &plusmn;1
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { axis: "Grandeur", icc: "0.990", aex: "97%", bex: "98%", tex: "97%", tw: "100%" },
                    { axis: "Material Warmth", icc: "0.991", aex: "100%", bex: "98%", tex: "98%", tw: "100%" },
                    { axis: "Maximalism", icc: "0.980", aex: "93%", bex: "97%", tex: "92%", tw: "100%" },
                    { axis: "Historicism", icc: "0.982", aex: "96%", bex: "93%", tex: "92%", tw: "100%" },
                    { axis: "Provenance", icc: "0.966", aex: "90%", bex: "94%", tex: "87%", tw: "100%" },
                    { axis: "Hospitality", icc: "0.969", aex: "91%", bex: "96%", tex: "89%", tw: "100%" },
                    { axis: "Formality", icc: "0.968", aex: "93%", bex: "92%", tex: "88%", tw: "100%" },
                    { axis: "Curation", icc: "0.967", aex: "93%", bex: "93%", tex: "91%", tw: "100%" },
                    { axis: "Theatricality", icc: "0.949", aex: "92%", bex: "89%", tex: "86%", tw: "100%" },
                  ].map((row) => (
                    <tr
                      key={row.axis}
                      style={{ borderBottom: `1px solid ${BORDER}` }}
                    >
                      <td className="px-3 py-2" style={{ color: TEXT_LIGHT }}>
                        {row.axis}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: GREEN }}>
                        {row.icc}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: GREEN }}>
                        {row.aex}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: COPPER }}>
                        {row.bex}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: GOLD }}>
                        {row.tex}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: TEXT_MID }}>
                        {row.tw}
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
                      0.974
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: GREEN }}
                    >
                      93.9%
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: COPPER }}
                    >
                      94.4%
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: GOLD }}
                    >
                      91.1%
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{ color: TEXT_MID }}
                    >
                      100%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Appendix link */}
          <div className="mt-8 text-center">
            <a
              href="/reliability"
              className="inline-block rounded border px-6 py-3 text-[12px] font-bold tracking-wider transition-colors hover:opacity-80"
              style={{
                fontFamily: MONO,
                color: COPPER,
                borderColor: COPPER,
                backgroundColor: "rgba(184, 115, 51, 0.08)",
              }}
            >
              VIEW ALL 100 HOMES &rarr; FULL APPENDIX
            </a>
          </div>

          {/* ── Inter-Model Agreement ── */}
          <div className="mt-16">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Inter-Model Agreement
            </p>
            <div
              className="mt-4 flex flex-col gap-5 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                Test-retest proves the <em>same model</em> agrees with itself.
                But a stronger claim is that the <em>rubric</em> drives scoring,
                not model-specific quirks. To test this, we scored the same
                100 stratified features with three different Claude models &mdash;
                Opus 4.6 (the production scorer), Sonnet 4.5, and Haiku 4.5 &mdash;
                using the identical prompt, rubric, and page images.
              </p>
              <p>
                If the rubric is doing the work, cheaper and faster models
                should produce substantially similar scores. If the scores
                depend on which model reads them, the rubric isn&rsquo;t
                reproducible &mdash; it&rsquo;s an artifact of one
                model&rsquo;s particular way of seeing.
              </p>
            </div>

            {/* ICC Results Table */}
            <div
              className="mt-8 overflow-hidden rounded border"
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
                  INTER-MODEL AGREEMENT &mdash; ICC(2,1) &mdash; 3 MODELS &times; 100 FEATURES &times; 9 AXES
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
                        Opus&ndash;Sonnet
                      </th>
                      <th className="px-3 py-2 text-right" style={{ color: COPPER }}>
                        Opus&ndash;Haiku
                      </th>
                      <th className="px-3 py-2 text-right" style={{ color: GOLD }}>
                        Sonnet&ndash;Haiku
                      </th>
                      <th className="px-3 py-2 text-right" style={{ color: TEXT_MID }}>
                        3-Way ICC
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { axis: "Grandeur", os: "0.851", oh: "0.510", sh: "0.602", tw: "0.680" },
                      { axis: "Material Warmth", os: "0.701", oh: "0.640", sh: "0.688", tw: "0.678" },
                      { axis: "Maximalism", os: "0.845", oh: "0.703", sh: "0.695", tw: "0.754" },
                      { axis: "Historicism", os: "0.849", oh: "0.822", sh: "0.859", tw: "0.844" },
                      { axis: "Provenance", os: "0.736", oh: "0.704", sh: "0.744", tw: "0.729" },
                      { axis: "Hospitality", os: "0.606", oh: "0.415", sh: "0.407", tw: "0.488" },
                      { axis: "Formality", os: "0.702", oh: "0.733", sh: "0.482", tw: "0.641" },
                      { axis: "Curation", os: "0.727", oh: "0.475", sh: "0.568", tw: "0.590" },
                      { axis: "Theatricality", os: "0.776", oh: "0.454", sh: "0.420", tw: "0.515" },
                    ].map((row) => (
                      <tr
                        key={row.axis}
                        style={{ borderBottom: `1px solid ${BORDER}` }}
                      >
                        <td className="px-3 py-2" style={{ color: TEXT_LIGHT }}>
                          {row.axis}
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: GREEN }}>
                          {row.os}
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: COPPER }}>
                          {row.oh}
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: GOLD }}>
                          {row.sh}
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: TEXT_MID }}>
                          {row.tw}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Summary row */}
              <div className="overflow-x-auto px-4 pb-2">
                <table
                  className="w-full text-[11px]"
                  style={{ fontFamily: MONO, borderCollapse: "collapse" }}
                >
                  <tbody>
                    <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                      <td className="px-3 py-2 font-bold" style={{ color: TEXT_LIGHT }}>Overall</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: GREEN }}>0.805</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: COPPER }}>0.676</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: GOLD }}>0.690</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: TEXT_MID }}>&mdash;</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4">
                <p
                  className="text-[11px] italic leading-[1.6]"
                  style={{ fontFamily: BODY, color: TEXT_DIM }}
                >
                  100 features &times; 3 models (Opus 4.6, Sonnet 4.5, Haiku 4.5). Cost: $4.35.
                  Opus&ndash;Sonnet agreement is &ldquo;Good&rdquo; (ICC 0.805); smaller models show
                  moderate agreement, with the most interpretive axes (Hospitality, Theatricality)
                  diverging the most. 96.8% of Opus&ndash;Sonnet comparisons fall within &plusmn;1.
                </p>
              </div>
            </div>

            {/* Example summaries */}
            <div
              className="mt-10 flex flex-col gap-5 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                What This Tells Us
              </p>
              <p className="-mt-2">
                The results split cleanly along the rubric&rsquo;s own axis
                groups. <strong style={{ color: TEXT_LIGHT }}>SPACE axes</strong>{" "}
                (Grandeur, Material Warmth, Maximalism, Historicism) &mdash;
                which describe physical, observable properties &mdash; achieve
                three-way ICC of 0.68&ndash;0.84. These are things any model
                can see: marble columns, layered textiles, period moulding.{" "}
                <strong style={{ color: TEXT_LIGHT }}>STAGE axes</strong>{" "}
                (Formality, Curation, Theatricality) &mdash; which require
                inferring intent from visual evidence &mdash; drop to
                0.52&ndash;0.64. Hospitality (0.49) is the weakest: judging
                whether a home &ldquo;performs for guests&rdquo; requires social
                inference that smaller models handle less consistently.
              </p>
              <p>
                This is exactly what a well-constructed rubric should produce.
                Physical descriptors converge across raters; interpretive
                judgments diverge. The Opus&ndash;Sonnet pair (ICC 0.805,
                96.8% within &plusmn;1) demonstrates that two capable models
                read the same instrument the same way. The wider spread with
                Haiku (ICC 0.676) reflects that model&rsquo;s smaller capacity
                for nuanced aesthetic judgment &mdash; not a rubric deficiency.
                For comparison, human inter-rater reliability on aesthetic
                assessments typically falls between 0.60 and 0.80.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: HUMAN VALIDATION (PLACEHOLDER)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="4"
            title="HUMAN VALIDATION"
            subtitle="A licensed architect scores a blind sample. The AI doesn't get the last word."
          />

          {/* Status banner */}
          <div
            className="mt-10 rounded border px-6 py-4"
            style={{
              backgroundColor: "rgba(184, 115, 51, 0.06)",
              borderColor: COPPER,
              borderStyle: "dashed",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                STATUS: PENDING
              </span>
              <span
                className="text-[12px]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                This section will be populated with results after the
                human scoring exercise is complete.
              </span>
            </div>
          </div>

          {/* Why this matters */}
          <div
            className="mt-6 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p>
              Section 3 demonstrated that the scorer agrees with
              itself&mdash;ICC &ge; 0.949 across all nine axes. But internal
              consistency is not the same as validity. A perfectly reliable
              thermometer that reads 10 degrees too high every time is
              reliable, not valid. The question this section answers:{" "}
              <strong style={{ color: TEXT_LIGHT }}>
                does the AI see what a trained human sees?
              </strong>
            </p>
            <p>
              A licensed architect who co-developed the scoring
              instrument&mdash;the same architect from the calibration
              transcript above&mdash;will independently score a blind sample
              of features using the same 9-axis rubric. Neither party will
              see the other&rsquo;s scores until both are submitted. The
              comparison will be published here in full, disagreements and
              all.
            </p>
          </div>

          {/* Study design */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Left: Protocol */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                PROTOCOL
              </p>
              <div
                className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Sample:</strong>{" "}
                  30 features selected by stratified random sampling&mdash;10
                  per decade (1990s, 2000s, 2010s/20s), balanced across
                  confirmed Epstein connections and baseline homes, spanning
                  the full range of prior AI scores (low, mid, high).
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Materials:</strong>{" "}
                  The architect receives the same inputs the AI
                  receives&mdash;magazine page images plus visible article
                  text. No homeowner names, no AI scores, no Epstein status.
                  Fully blinded.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Instrument:</strong>{" "}
                  The same 9-axis rubric with the same 1&ndash;5 anchor
                  descriptions. Scoring is independent: human scores are
                  collected before AI scores are revealed.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Analysis:</strong>{" "}
                  ICC(3,1) for each axis (human vs. AI). Exact agreement
                  rate. &plusmn;1 agreement rate. Per-axis bias direction
                  (does the AI systematically score higher or lower?).
                  Disagreement case studies published in full.
                </p>
              </div>
            </div>

            {/* Right: What the literature predicts */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                WHAT THE LITERATURE PREDICTS
              </p>
              <div
                className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Overall agreement: moderate to substantial.</strong>{" "}
                  Shanahan et al. (2025) found LLM&ndash;human agreement at
                  &kappa; &gt; 0.6 on qualitative coding tasks. Ishiguro &amp;
                  Motoda (2024) [16] achieved 0.708 accuracy on aesthetic
                  image ratings. We expect ICC in the 0.6&ndash;0.85 range:
                  high enough to validate comparative use, with interpretable
                  disagreements.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>SPACE axes: highest agreement.</strong>{" "}
                  Grandeur, Material Warmth, and Maximalism are the most
                  visually grounded dimensions. We expect &ge; 80% exact
                  agreement&mdash;you can see ceiling height and material
                  warmth in a photograph.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>STAGE axes: systematic AI inflation.</strong>{" "}
                  The calibration session already revealed this pattern. The
                  AI scores what it sees; the architect scores what it means.
                  We predict the AI will score Theatricality, Curation, and
                  Formality 1&ndash;2 points higher than the human on
                  average&mdash;because visual intensity reads as performance
                  to the model, while the architect applies contextual
                  knowledge about intent.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>STORY axes: productive disagreement.</strong>{" "}
                  Provenance and Historicism depend heavily on
                  text&mdash;whether objects were inherited or purchased,
                  whether period details are genuine. These are the axes
                  where human expertise provides the most signal, and where
                  we expect the most instructive disagreements.
                </p>
              </div>
            </div>
          </div>

          {/* Why this design */}
          <div
            className="mt-8 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <p
              className="text-[10px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              WHY THIS DESIGN
            </p>
            <div
              className="mt-4 flex flex-col gap-4 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                The standard for validating a new rating instrument is
                convergent validity&mdash;comparing scores against an
                established measure of the same construct. Since no prior
                9-axis interior design rubric exists, the closest available
                standard is calibrated expert judgment from a domain
                professional [13]. This is the approach used by Hashemi
                et al. (2024) [15] to validate their LLM-Rubric framework:
                human expert panels scoring the same items with the same
                rubric, followed by ICC analysis.
              </p>
              <p>
                The double-blind protocol (human doesn&rsquo;t see AI scores;
                AI doesn&rsquo;t see human scores) follows the standard
                for inter-rater reliability studies in psychometrics. The
                stratified sample ensures we test across the full range of
                aesthetic variation, not just the easy cases. Including
                known Epstein connections in the sample tests whether the
                diagnostic composite (Section 9) holds up under human
                scoring&mdash;if the STAGE inflation pattern disappears
                when a human scores, the Epstein signature finding would
                need revision.
              </p>
              <p>
                We will publish every score, every disagreement, and every
                case where the human and AI diverge by more than 1 point.
                If the AI is wrong, this section will say so. The project&rsquo;s
                credibility depends on presenting the validation results
                honestly, not on a particular outcome.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: CONSTRUCT VALIDATION
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="5"
            title="CONSTRUCT VALIDATION"
            subtitle="Principal Component Analysis proves the nine axes measure two genuinely independent qualities of domestic space."
          />

          <div
            className="mt-10 flex flex-col gap-5 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Are These Nine Axes Measuring Something Real?
            </p>
            <p className="-mt-2">
              Scoring homes on nine axes is only meaningful if those axes
              capture real, independent dimensions of variation &mdash; not nine
              ways of measuring the same thing. To test this, we
              use{" "}
              <a
                href="https://doi.org/10.1098/rsta.2015.0202"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: COPPER, textDecoration: "underline", textUnderlineOffset: "2px" }}
              >
                Principal Component Analysis
              </a>{" "}
              (PCA), the gold-standard technique for discovering the hidden
              structure in high-dimensional data. PCA takes our nine scores for
              each of 3,763 homes and asks: what are the fewest
              independent dimensions needed to explain most of the variation?
              If the answer is two or three &mdash; and if those dimensions
              align with our hypothesized groups &mdash; then the scoring
              instrument is measuring real constructs, not noise.
            </p>
            <p>
              The scree plot shows how much variation each component captures.
              The loadings chart shows which axes cluster together on the
              dominant dimension. Axes pointing the same direction are
              measuring related qualities; axes pointing opposite directions
              are anti-correlated &mdash; when one is high, the other tends
              to be low.
            </p>
          </div>

          <div className="mt-8">
            <PCASection />
          </div>

          <div
            className="mt-6 flex flex-col gap-5 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p
              className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Two Dominant Dimensions
            </p>
            <p className="-mt-2">
              <strong style={{ color: TEXT_LIGHT }}>The data reveals two dominant dimensions that explain 66%
              of all variation.</strong> The first component (41%) cleanly
              separates <em>performance</em> from <em>authenticity</em>.
              Theatricality, Curation, and Formality load together on the
              positive side. Provenance and Material Warmth load on the
              negative side. Across 3,763 AD homes, the single strongest
              pattern is a tug-of-war between homes that perform wealth for an
              audience and homes built from genuine, tactile accumulation.
              The second component (25%) captures traditional richness &mdash;
              Historicism and Maximalism load highest, distinguishing dense
              period rooms from spare contemporary spaces. After these two
              dimensions, every remaining component explains less than 9%,
              confirming the clear elbow at two.
            </p>
            <p>
              <strong style={{ color: TEXT_LIGHT }}>This tells us our nine axes are not nine versions
              of &ldquo;how expensive does it look.&rdquo;</strong> They
              capture at least two genuinely independent qualities of domestic
              space. But it also tells us the nine axes collapse into two
              validated composites &mdash; so we keep all nine for
              description (each tells a specific, interpretable story about a
              home) and use the composites for analysis.
            </p>

            <p
              className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              The Annotated Correlation Matrix
            </p>
            <p className="-mt-2">
              When we reorder the nine axes by where the data actually clusters
              them &mdash; rather than where we hypothesized they would
              go &mdash; two clean blocks emerge. Material Warmth, Maximalism,
              Historicism, and Provenance form an <em>Authenticity</em>{" "}
              cluster: homes built from real materials with
              real history, where the surfaces carry evidence of time.
              Grandeur, Hospitality, Formality, Curation, and Theatricality
              form a <em>Performance</em> cluster: homes
              arranged for an audience, where a designer&rsquo;s hand has
              shaped the space for visual impact.
            </p>
            <p>
              Notice that Grandeur and Hospitality, originally assigned to
              SPACE and STORY respectively, actually correlate with the
              Performance axes. The data moved them. This is why construct
              validation matters: our intuitions about which qualities
              &ldquo;go together&rdquo; are tested against what a thousand
              homes actually show, and the data wins.
            </p>

            <p
              className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Nine Axes or Two?
            </p>
            <p className="-mt-2">
              <strong style={{ color: TEXT_LIGHT }}>Should future scoring use two axes instead of
              nine?</strong> No &mdash; and this is a subtle but important
              distinction. The nine axes are the <em>measurement
              instrument</em>; the two composites are what that instrument{" "}
              <em>reveals</em>. Each individual axis describes something
              specific and interpretable about a home &mdash; its material
              warmth, its historical layers, its theatrical staging. These
              granular scores are irreplaceable for description: when we say
              a home scores 5 on Theatricality and 2 on Provenance, that
              tells a vivid, precise story that a single
              &ldquo;Performance&rdquo; number never could.
            </p>
            <p>
              The validated composites serve a different purpose: they are
              the right tool for <em>statistical comparison</em> between
              groups of homes. When we later ask whether Epstein-connected
              homes differ from the AD baseline, we need scores that are
              internally consistent and statistically defensible. Nine
              individual axes would require correcting for multiple
              comparisons; two composites with strong Cronbach&rsquo;s alpha
              values give us cleaner, more powerful tests. Score on nine,
              analyze on two.
            </p>
          </div>

          {/* ── Two Composites ── */}
          <div
            className="mt-8 rounded border p-5"
            style={{ backgroundColor: CARD_BG, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="mb-4">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                Two Composite Scores Derived from PCA
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {/* STAGE composite */}
              <div
                className="rounded border p-4"
                style={{ backgroundColor: CARD_DEEP, borderColor: BORDER }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: GROUP_COLORS.STAGE }}
                  />
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{ fontFamily: MONO, color: GROUP_COLORS.STAGE }}
                  >
                    Stage Composite
                  </span>
                  <span
                    className="text-[9px]"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    &alpha; = 0.83
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Formality + Curation + Theatricality
                </p>
                <p
                  className="mt-3 text-[13px] leading-[1.6]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  Measures <strong style={{ color: TEXT_LIGHT }}>performative display</strong> &mdash; how much a home
                  is staged for an outside audience. High scores mean designer-directed,
                  brand-conscious, formally arranged spaces. Low scores mean understated,
                  self-curated, &ldquo;if you know you know&rdquo; restraint. Mean: 2.93/5.
                </p>
              </div>
              {/* AUTHENTICITY composite */}
              <div
                className="rounded border p-4"
                style={{ backgroundColor: CARD_DEEP, borderColor: BORDER }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: GROUP_COLORS.STORY }}
                  />
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{ fontFamily: MONO, color: GROUP_COLORS.STORY }}
                  >
                    Authenticity Composite
                  </span>
                  <span
                    className="text-[9px]"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    &alpha; = 0.75
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Material Warmth + Provenance + Historicism
                </p>
                <p
                  className="mt-3 text-[13px] leading-[1.6]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  Measures <strong style={{ color: TEXT_LIGHT }}>genuine accumulation</strong> &mdash; tactile warmth,
                  patina of age, and historical continuity. High scores mean worn wood,
                  inherited furniture, period architecture. Low scores mean new
                  construction, cold surfaces, contemporary everything. Mean: 3.57/5.
                </p>
              </div>
            </div>
            <p
              className="mt-4 text-[12px] italic leading-[1.5]"
              style={{ fontFamily: BODY, color: TEXT_DIM }}
            >
              These two composites are anti-correlated (r&nbsp;=&nbsp;&minus;0.39):
              as a home&rsquo;s performative display increases, its markers of
              genuine accumulation tend to decrease. This is not a design rule
              but a statistical tendency across 3,763 scored
              features &mdash; Bourdieu&rsquo;s distinction between cultural
              capital and economic display, measured in the data. The remaining
              three axes (Grandeur, Maximalism, Hospitality) operate
              independently and are retained as individual descriptors.
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6: THE AD BASELINE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="6"
            title="THE AD BASELINE"
            subtitle="What does Architectural Digest actually look like, statistically? Define the population before measuring anything against it."
          />

          {/* Status banner */}
          <div
            className="mt-10 rounded border px-6 py-4"
            style={{
              backgroundColor: "rgba(184, 115, 51, 0.06)",
              borderColor: COPPER,
              borderStyle: "dashed",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                STATUS: PENDING
              </span>
              <span
                className="text-[12px]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                Charts and statistics will be populated after scoring is
                complete across all 3,763 features.
              </span>
            </div>
          </div>

          {/* Why baseline first */}
          <div
            className="mt-6 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p>
              What is the average AD home? How much variation exists
              across axes? Does the magazine&rsquo;s aesthetic change over
              37 years? These are not rhetorical questions&mdash;they
              require statistical answers. Without a rigorously defined
              baseline, any subsequent comparison is meaningless. You
              can&rsquo;t measure deviation from a center you
              haven&rsquo;t defined.
            </p>
            <p>
              This is not a trivial question. AD is a curated publication:
              editors select homes, photographers style them, writers frame
              them. The baseline we define is not &ldquo;what American
              homes look like&rdquo;&mdash;it is{" "}
              <em>what AD chooses to celebrate</em>. That editorial filter
              is the subject. Following Bourdieu [1], the magazine occupies
              a specific position in the field of cultural production, and
              our 9-axis baseline characterizes that position
              quantitatively for the first time.
            </p>
          </div>

          {/* Three-card approach: Define, Visualize, Verify */}
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {/* Define */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                DEFINE
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                For each of the 9 axes: mean, median, 10% trimmed mean,
                standard deviation, IQR, coefficient of variation, skewness,
                and kurtosis. If these three averages converge, the baseline
                is robust. If they diverge, that reveals skewness or
                bimodality in AD&rsquo;s aesthetic&mdash;a finding in
                itself.
              </p>
              <p
                className="mt-3 text-[12px] leading-[1.6]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                Wilcox (2012) recommends trimmed means for bounded scales.
                Norman (2010) validates parametric methods on Likert-type
                data at n &gt; 30. With n = 3,763, both approaches are
                defensible.
              </p>
            </div>
            {/* Visualize */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                VISUALIZE
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Nine violin plots showing each axis&rsquo;s full
                distribution&mdash;not just the mean. Box plots hide
                bimodality; violins reveal whether Historicism has two
                modes (contemporary cluster at 1&ndash;2, classical
                cluster at 4&ndash;5) or one.
              </p>
              <p
                className="mt-3 text-[12px] leading-[1.6]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                The 9-axis radar profile shows the &ldquo;shape&rdquo; of
                the AD aesthetic&mdash;which dimensions the magazine
                favors and which it suppresses. A correlation heatmap
                reveals which axes move together and which are independent.
              </p>
            </div>
            {/* Verify */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                VERIFY
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                The baseline must account for time. AD in 1992 is not AD
                in 2024. Decade-binned profiles and rolling 5-year means
                per axis will reveal whether the magazine&rsquo;s taste
                drifted&mdash;and in which directions.
              </p>
              <p
                className="mt-3 text-[12px] leading-[1.6]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                The baseline must be verified against known cultural
                shifts: does the minimalism revolution appear after 2008?
                Does Material Warmth rise in the 2020s? If the baseline
                captures real editorial drift, it is measuring something
                real. Rothman et al. (2008) establishes temporally
                stratified baselines as the standard for observational
                research.
              </p>
            </div>
          </div>

          {/* ── Chart Placeholders ── */}

          {/* 5A: Violin Plots */}
          <div
            className="mt-10 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                5A &mdash; DISTRIBUTION SHAPE: VIOLIN PLOTS
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            {/* Chart placeholder */}
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 280,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  9 violin plots &middot; one per axis &middot; grouped
                  by SPACE / STORY / STAGE
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Median + IQR box embedded in each violin
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                Nine mirrored kernel-density plots, one per axis, showing
                the full distribution of scores across all 3,763 features.
                Unlike box plots, violins reveal distribution
                <em> shape</em>&mdash;bimodality, skewness, and
                ceiling/floor effects are visible. Each violin contains
                an embedded box showing the median and IQR.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                Does Historicism show two humps (contemporary homes
                clustering at 1&ndash;2 and classical homes at 4&ndash;5)?
                Does Material Warmth skew high (AD favors warm interiors)?
                Are any axes bimodal, suggesting two distinct aesthetic
                populations within AD? Floor and ceiling effects
                (clustering at 1 or 5) reveal the natural boundaries of
                the magazine&rsquo;s taste.
              </p>
            </div>
          </div>

          {/* 5B: Radar Profile */}
          <div
            className="mt-6 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                5B &mdash; AESTHETIC PROFILE: BASELINE RADAR
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 320,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  9-axis radar &middot; AD population mean on each axis
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Shaded &plusmn;1 SD band showing natural variation
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                The canonical multi-dimensional profile visualization.
                The AD population mean on each axis forms a polygon; a
                shaded band (&plusmn;1 SD) shows the natural spread. This
                is the &ldquo;shape&rdquo; of the AD aesthetic&mdash;which
                dimensions the magazine favors and which it suppresses.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                Is the profile roughly circular (moderate scores
                everywhere, an eclectic magazine)? Or does it bulge on
                certain axes (a magazine with strong preferences)?
                Which axes have tight bands (consensus) vs. wide bands
                (diversity)? The radar answers the simplest question:
                &ldquo;What does AD actually look like?&rdquo;
              </p>
            </div>
          </div>

          {/* 5C: Correlation Heatmap */}
          <div
            className="mt-6 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                5C &mdash; INTER-AXIS RELATIONSHIPS: CORRELATION HEATMAP
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 260,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  9 &times; 9 Spearman correlation matrix &middot; full
                  AD population
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Hierarchical clustering to reveal axis grouping
                  structure
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                A 9&times;9 matrix of Spearman rank correlations between
                all axis pairs, with color intensity proportional to
                correlation strength. This is step one in any psychometric
                scale validation: before comparing groups, you need to
                understand the internal structure of the instrument.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                Are any axes redundant? If Grandeur and Formality
                correlate at &rho; &gt; 0.8, they may be measuring the
                same latent construct. Are axes within groups (SPACE,
                STORY, STAGE) more correlated with each other than across
                groups? They should be, if the grouping is meaningful. Do
                Theatricality and Material Warmth show a negative
                correlation? That would suggest an inherent tension in
                AD&rsquo;s aesthetic between performed and lived spaces.
                The internal correlation structure validates (or
                challenges) the three-group taxonomy.
              </p>
            </div>
          </div>

          {/* 5D: Ridge Plots */}
          <div
            className="mt-6 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                5D &mdash; TEMPORAL EVOLUTION: RIDGE PLOTS BY DECADE
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 300,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  9 ridge plots &middot; 4 stacked density curves each
                  (1988&ndash;99, 2000&ndash;09, 2010&ndash;19, 2020&ndash;25)
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Small multiples matrix: 9 axes &times; 4 decades
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                Stacked density curves, one per decade per axis, showing
                how the AD aesthetic evolves over 37 years. Ridge plots
                compress four distributions into a single vertical
                stack&mdash;you read them top to bottom as a timeline.
                The minimalism revolution (post-2008), the maximalist
                revival (mid-2010s), warm minimalism (2020s)&mdash;these
                documented cultural shifts should appear as distribution
                changes.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                Does Maximalism shift leftward after 2008? Does Material
                Warmth trend upward in the 2020s? Does Theatricality
                increase over time as AD features more celebrity homes?
                These documented cultural shifts should appear as
                distribution changes if the instrument is measuring
                something real. The ridge plots also establish whether
                the baseline is stable enough for decade-level
                comparisons, or whether each era must be treated as its
                own population.
              </p>
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 7: THE AD BASELINE — RESULTS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="7"
            title="THE AD BASELINE"
            subtitle="Based on 3,763 scored features across 37 years: this is what Architectural Digest looks like."
          />

          {/* Opening declaration */}
          <div
            className="mt-6 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p>
              A typical AD home is{" "}
              <strong style={{ color: TEXT_LIGHT }}>
                warm, moderately grand, designer-curated, and quiet.
              </strong>{" "}
              It scores highest on Material Warmth (4.12/5) and lowest on
              Theatricality (2.37/5). It has real objects (Provenance 3.34)
              in a space with some historical character (Historicism 3.25),
              arranged by a professional (Curation 3.57) into rooms that
              are welcoming rather than intimidating (Formality 2.85). It
              does not perform for an audience.
            </p>
            <p>
              That sentence is the baseline. Everything below is the
              evidence.
            </p>
          </div>

          {/* ── THE RADAR: SHAPE OF AD ── */}
          <div
            className="mt-10 rounded border p-8"
            style={{
              backgroundColor: CARD_DEEP,
              borderColor: BORDER,
              boxShadow: CARD_GLOW,
            }}
          >
            <div className="flex items-baseline justify-between">
              <div>
                <p
                  className="text-[11px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GOLD_DIM }}
                >
                  THE SHAPE OF AD
                </p>
                <p
                  className="mt-1 text-[13px]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  9-axis population means &middot; n = 3,763 &middot;
                  &plusmn;1 SD band
                </p>
              </div>
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
                    POPULATION MEAN
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-[10px] w-5 rounded-sm"
                    style={{ backgroundColor: "rgba(46, 204, 113, 0.12)" }}
                  />
                  <span
                    className="text-[10px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    &plusmn;1 SD
                  </span>
                </div>
              </div>
            </div>

            {/* Radar chart */}
            <div className="mt-6" style={{ height: 480 }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={baselineRadarData}
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
                    {/* ±1 SD band — high */}
                    <Radar
                      name="+1 SD"
                      dataKey="hi"
                      stroke="transparent"
                      fill={GREEN}
                      fillOpacity={0.08}
                    />
                    {/* ±1 SD band — low (drawn to clip visually) */}
                    <Radar
                      name="-1 SD"
                      dataKey="lo"
                      stroke="transparent"
                      fill={BG}
                      fillOpacity={0.9}
                    />
                    {/* Population mean — green, solid */}
                    <Radar
                      name="AD Baseline"
                      dataKey="mean"
                      stroke={GREEN}
                      fill={GREEN}
                      fillOpacity={0.10}
                      strokeWidth={2}
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div
                            className="rounded border px-3 py-2"
                            style={{
                              backgroundColor: CARD_DEEP,
                              borderColor: BORDER,
                              fontFamily: MONO,
                            }}
                          >
                            <p
                              className="text-[10px] font-bold"
                              style={{ color: TEXT_LIGHT }}
                            >
                              {d.axis}
                            </p>
                            <p
                              className="mt-1 text-[10px]"
                              style={{ color: GREEN }}
                            >
                              Mean: {d.mean} &nbsp; SD range: {d.lo}&ndash;{d.hi}
                            </p>
                          </div>
                        );
                      }}
                      cursor={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p
                    className="text-[12px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    Loading chart&hellip;
                  </p>
                </div>
              )}
            </div>

            {/* Group labels */}
            <div
              className="mt-4 flex justify-center gap-8 border-t pt-4"
              style={{ borderColor: BORDER }}
            >
              {groups.map((g) => (
                <div key={g.label} className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: GROUP_COLORS[g.label] }}
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
                </div>
              ))}
            </div>
          </div>

          {/* ── FIVE KEY FINDINGS ── */}
          <div className="mt-10">
            <p
              className="text-[10px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              FIVE KEY FINDINGS
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Finding 1 */}
            <div
              className="rounded border p-5"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[24px] font-bold"
                  style={{ fontFamily: MONO, color: GREEN }}
                >
                  4.12
                </span>
                <span
                  className="text-[10px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  / 5
                </span>
              </div>
              <p
                className="mt-1 text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                MATERIAL WARMTH DOMINATES
              </p>
              <p
                className="mt-2 text-[12px] leading-[1.65]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                The single strongest signal: AD overwhelmingly favors warm
                interiors. 79.6% of all features score 4 or 5. Wood, linen,
                leather, and layered textiles are the magazine&rsquo;s
                default. Cold, hard-surfaced spaces are the exception, not
                the rule.
              </p>
            </div>

            {/* Finding 2 */}
            <div
              className="rounded border p-5"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[24px] font-bold"
                  style={{ fontFamily: MONO, color: GREEN }}
                >
                  2.37
                </span>
                <span
                  className="text-[10px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  / 5
                </span>
              </div>
              <p
                className="mt-1 text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                THEATRICALITY IS LOWEST
              </p>
              <p
                className="mt-2 text-[12px] leading-[1.65]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                59.7% of AD homes score 1 or 2 on Theatricality. Only 2.3%
                score 5. The magazine celebrates homes that feel
                lived-in, not performed. The &ldquo;if you know, you
                know&rdquo; aesthetic is AD&rsquo;s center of gravity.
              </p>
            </div>

            {/* Finding 3 */}
            <div
              className="rounded border p-5"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="mt-1 text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                SPACE &gt; STORY &gt; STAGE
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {[
                  { label: "SPACE", val: 3.77, color: GROUP_COLORS["SPACE"] },
                  { label: "STORY", val: 3.29, color: GROUP_COLORS["STORY"] },
                  { label: "STAGE", val: 2.93, color: GROUP_COLORS["STAGE"] },
                ].map((g) => (
                  <div key={g.label} className="flex items-center gap-3">
                    <span
                      className="w-[50px] text-[10px] font-bold tracking-wider"
                      style={{ fontFamily: MONO, color: g.color }}
                    >
                      {g.label}
                    </span>
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${((g.val - 1) / 4) * 100}%`,
                        backgroundColor: g.color,
                        opacity: 0.6,
                      }}
                    />
                    <span
                      className="text-[10px]"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      {g.val.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <p
                className="mt-3 text-[12px] leading-[1.65]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Group means descend systematically. AD prioritizes the
                physical experience of a space over the story it tells,
                and the story over who it performs for.
              </p>
            </div>

            {/* Finding 4 */}
            <div
              className="rounded border p-5"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="mt-1 text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                STAGE AXES MOVE TOGETHER
              </p>
              <div className="mt-3 flex flex-col gap-1">
                {[
                  { pair: "Curation \u2194 Theatricality", r: "0.694" },
                  { pair: "Formality \u2194 Curation", r: "0.628" },
                  { pair: "Formality \u2194 Theatricality", r: "0.612" },
                ].map((c) => (
                  <div key={c.pair} className="flex items-center justify-between">
                    <span
                      className="text-[10px]"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      {c.pair}
                    </span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ fontFamily: MONO, color: COPPER }}
                    >
                      &rho; = {c.r}
                    </span>
                  </div>
                ))}
              </div>
              <p
                className="mt-3 text-[12px] leading-[1.65]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Within-STAGE mean correlation: &rho; = 0.645. Within-SPACE:
                only 0.038. The three STAGE axes may reflect a single
                latent &ldquo;performance&rdquo; construct. SPACE axes are
                genuinely independent&mdash;Grandeur, Material Warmth, and
                Maximalism measure different things.
              </p>
            </div>

            {/* Finding 5 */}
            <div
              className="rounded border p-5"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="mt-1 text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                PROVENANCE OPPOSES PERFORMANCE
              </p>
              <div className="mt-3 flex flex-col gap-1">
                {[
                  { pair: "Provenance \u2194 Curation", r: "\u22120.583" },
                  { pair: "Provenance \u2194 Theatricality", r: "\u22120.544" },
                  { pair: "Mat. Warmth \u2194 Theatricality", r: "\u22120.490" },
                ].map((c) => (
                  <div key={c.pair} className="flex items-center justify-between">
                    <span
                      className="text-[10px]"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      {c.pair}
                    </span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ fontFamily: MONO, color: GREEN }}
                    >
                      &rho; = {c.r}
                    </span>
                  </div>
                ))}
              </div>
              <p
                className="mt-3 text-[12px] leading-[1.65]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                The strongest negative correlations: homes with real age
                and accumulated objects are less curated, less theatrical,
                and warmer. Inherited homes don&rsquo;t perform.
                Performed homes aren&rsquo;t inherited. This is the
                structural tension at the heart of the AD aesthetic.
              </p>
            </div>

            {/* Finding 6: Temporal drift */}
            <div
              className="rounded border p-5"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <p
                className="mt-1 text-[11px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                THE BASELINE MOVES
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {[
                  { axis: "Historicism", from: "3.66", to: "2.82", dir: "\u2193", note: "Away from period interiors" },
                  { axis: "Theatricality", from: "2.14", to: "2.69", dir: "\u2191", note: "More celebrity culture" },
                  { axis: "Curation", from: "3.34", to: "3.79", dir: "\u2191", note: "More designer-driven" },
                ].map((t) => (
                  <div key={t.axis} className="flex items-center gap-2">
                    <span
                      className="w-[100px] text-[10px]"
                      style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                    >
                      {t.axis}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      {t.from} {t.dir} {t.to}
                    </span>
                    <span
                      className="text-[9px] italic"
                      style={{ fontFamily: BODY, color: TEXT_DIM }}
                    >
                      {t.note}
                    </span>
                  </div>
                ))}
              </div>
              <p
                className="mt-3 text-[12px] leading-[1.65]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                The baseline is not static. 1990s AD and 2020s AD are
                different magazines. Any comparison must be temporally
                matched&mdash;you cannot compare a 1995 home against the
                all-time mean without confounding era with aesthetics.
              </p>
            </div>
          </div>

          {/* ── THE NINE AXES: SCORE TABLE ── */}
          <div
            className="mt-10 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <p
              className="text-[10px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              POPULATION STATISTICS &mdash; ALL 3,763 FEATURES
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full" style={{ fontFamily: MONO }}>
                <thead>
                  <tr
                    className="border-b text-left text-[9px] tracking-wider"
                    style={{ borderColor: BORDER, color: TEXT_DIM }}
                  >
                    <th className="pb-2 pr-4">AXIS</th>
                    <th className="pb-2 pr-3 text-right">MEAN</th>
                    <th className="pb-2 pr-3 text-right">MEDIAN</th>
                    <th className="pb-2 pr-3 text-right">SD</th>
                    <th className="pb-2 pr-3 text-right">SKEW</th>
                    <th className="hidden pb-2 text-right md:table-cell">MODE %</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Grandeur", mean: "3.59", med: "4.0", sd: "0.95", skew: "\u22120.41", mode: "4 (42%)", group: "SPACE" },
                    { name: "Material Warmth", mean: "4.12", med: "4.0", sd: "0.89", skew: "\u22120.95", mode: "4 (40%)", group: "SPACE" },
                    { name: "Maximalism", mean: "3.61", med: "4.0", sd: "1.08", skew: "\u22120.61", mode: "4 (40%)", group: "SPACE" },
                    { name: "Historicism", mean: "3.25", med: "3.0", sd: "1.19", skew: "\u22120.46", mode: "4 (38%)", group: "STORY" },
                    { name: "Provenance", mean: "3.34", med: "3.0", sd: "1.08", skew: "\u22120.38", mode: "3 (35%)", group: "STORY" },
                    { name: "Hospitality", mean: "3.28", med: "3.0", sd: "1.01", skew: "\u22120.35", mode: "3 (36%)", group: "STORY" },
                    { name: "Formality", mean: "2.85", med: "3.0", sd: "1.10", skew: "\u22120.12", mode: "3 (32%)", group: "STAGE" },
                    { name: "Curation", mean: "3.57", med: "4.0", sd: "0.87", skew: "\u22120.86", mode: "4 (56%)", group: "STAGE" },
                    { name: "Theatricality", mean: "2.37", med: "2.0", sd: "0.94", skew: "+0.50", mode: "2 (43%)", group: "STAGE" },
                  ].map((row) => (
                    <tr
                      key={row.name}
                      className="border-b text-[10px]"
                      style={{ borderColor: "rgba(58, 51, 42, 0.3)" }}
                    >
                      <td
                        className="py-2 pr-4"
                        style={{ color: GROUP_COLORS[row.group] || TEXT_LIGHT }}
                      >
                        {row.name}
                      </td>
                      <td className="py-2 pr-3 text-right" style={{ color: TEXT_LIGHT }}>
                        {row.mean}
                      </td>
                      <td className="py-2 pr-3 text-right" style={{ color: TEXT_DIM }}>
                        {row.med}
                      </td>
                      <td className="py-2 pr-3 text-right" style={{ color: TEXT_DIM }}>
                        {row.sd}
                      </td>
                      <td className="py-2 pr-3 text-right" style={{ color: TEXT_DIM }}>
                        {row.skew}
                      </td>
                      <td
                        className="hidden py-2 text-right md:table-cell"
                        style={{ color: TEXT_DIM }}
                      >
                        {row.mode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              className="mt-4 text-[11px] leading-[1.6]"
              style={{ fontFamily: BODY, color: TEXT_DIM }}
            >
              All axes left-skewed except Theatricality (right-skewed). Mean,
              median, and 10% trimmed mean converge within 0.1 for all axes,
              confirming robust central tendency despite bounded 1&ndash;5
              scale. Curation has the tightest distribution (SD = 0.87);
              Historicism the widest (SD = 1.19).
            </p>
          </div>

          {/* ── WHAT THIS MEANS ── */}
          <div
            className="mt-8 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p>
              <strong style={{ color: TEXT_LIGHT }}>
                In Bourdieu&rsquo;s terms:
              </strong>{" "}
              AD occupies a specific position in the field of cultural
              production&mdash;high material warmth, moderate grandeur,
              high curation, low theatricality. It celebrates the
              <em> habitus</em> of cultivated wealth: spaces that signal
              taste through material quality and professional arrangement
              rather than through spectacle or brand display. The
              magazine&rsquo;s aesthetic center is &ldquo;tasteful
              abundance, quietly performed.&rdquo;
            </p>
            <p>
              The anti-correlation between Provenance and the STAGE axes
              is the most structurally interesting finding. It means{" "}
              <em>within AD&rsquo;s own corpus</em>, inherited wealth and
              performed wealth are opposing aesthetics. Homes with real
              accumulation over time need less staging. Homes without
              history compensate with curation and performance. This
              tension is the baseline&rsquo;s most important feature
              &mdash;and the axis along which any subset might diverge.
            </p>
          </div>

          {/* ── WHY THIS MATTERS ── */}
          <div
            className="mt-10 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <p
              className="text-[10px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              WHY THIS MATTERS
            </p>
            <div
              className="mt-4 flex flex-col gap-4 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Material Warmth at 4.12 is the highest score by far.
                </strong>{" "}
                It proves AD has a real, measurable aesthetic preference,
                not just editorial variety. The magazine has a{" "}
                <em>type</em>.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Theatricality at 2.37 is the lowest
                </strong>{" "}
                &mdash; and this is the axis we predict will be{" "}
                <em>highest</em> in the Epstein subset. The baseline sets
                up the comparison perfectly: AD&rsquo;s center of gravity
                is anti-theatrical. If Epstein homes score high on
                Theatricality, they&rsquo;re deviating from the
                magazine&rsquo;s core identity.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  The Provenance&ndash;Performance anti-correlation
                  (&rho; = &minus;0.58)
                </strong>{" "}
                is the structural finding. It means the data independently
                discovered the exact tension we hypothesized: inherited
                wealth and performed wealth are opposing aesthetics within
                AD&rsquo;s own corpus. We didn&rsquo;t train the scorer
                to find this &mdash; it emerged from the scores.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  STAGE axes correlate at 0.645 while SPACE axes sit at
                  0.038.
                </strong>{" "}
                This validates the grouping <em>and</em> suggests that
                &ldquo;performance&rdquo; may be a single measurable
                construct. The instrument is measuring what we designed it
                to measure.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  The temporal drift is real and readable.
                </strong>{" "}
                Historicism declining from 3.66 to 2.82, Theatricality
                rising from 2.14 to 2.69. These match documented cultural
                shifts, which means the scorer is capturing real
                phenomena, not noise.
              </p>
              <p>
                The entire project hinged on whether the scoring instrument
                would produce meaningful structure, and it did &mdash;
                strongly.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 8: COMPARATIVE ANALYSIS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="8"
            title="COMPARATIVE ANALYSIS"
            subtitle="With the baseline defined, test whether a specific subset — homes connected to Jeffrey Epstein — deviates from it."
          />

          {/* Intro */}
          <div
            className="mt-6 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p>
              Section 6 defined the population. This section asks: does
              the Epstein-connected subset (134 homes, 3.6% of the corpus)
              occupy a different region of the aesthetic space? The question
              is specific and testable. The answer may be yes, no, or
              &ldquo;only on certain axes.&rdquo; All three are reported.
            </p>
          </div>

          {/* 6A: PCA Biplot */}
          <div
            className="mt-10 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                6A &mdash; DIMENSIONALITY REDUCTION: PCA BIPLOT
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 320,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  3,763 points projected onto PC1 &times; PC2 &middot;
                  axis loading vectors overlaid
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Baseline points gray &middot; Epstein points copper
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                Principal Component Analysis projects the 9-dimensional
                score data onto two axes that capture the most variance.
                Each of the 3,763 homes becomes a point; the 9 original
                axes appear as loading vectors showing which dimensions
                drive each principal component. This is the technique
                Bourdieu used (as correspondence analysis) to map the
                &ldquo;social space of taste&rdquo; in <em>Distinction</em>{" "}
                [1], and the standard approach in Manovich&rsquo;s{" "}
                <em>Cultural Analytics</em> (2020) for positioning items
                in a cultural corpus.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                Do Epstein homes cluster in a specific region of the
                reduced space, or are they scattered like the general
                population? Clustering means a coherent Epstein
                aesthetic&mdash;these homes share a distinct position in
                taste-space. Dispersion means Epstein&rsquo;s social
                network is aesthetically diverse and any mean differences
                are driven by outliers. The loading vectors reveal
                <em> what</em> drives separation: if PC1 is loaded heavily
                on STAGE axes, the primary dimension of variation in AD is
                the performance axis&mdash;exactly where we predict the
                Epstein divergence.
              </p>
            </div>
          </div>

          {/* 6B: Parallel Coordinates */}
          <div
            className="mt-6 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                6B &mdash; MULTIVARIATE PATTERNS: PARALLEL COORDINATES
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 260,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  3,763 lines across 9 vertical axes &middot; ordered
                  SPACE → STORY → STAGE
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Baseline lines faint gray &middot; Epstein lines copper
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                Each home is a polyline connecting its score on all 9 axes,
                arranged left to right: SPACE, then STORY, then STAGE. The
                general population appears as a dense bundle of faint gray
                lines; the Epstein subset is drawn in copper on top. Where
                the copper lines diverge from the gray bundle, the
                Epstein aesthetic departs from the AD norm. Where they
                blend in, the groups are indistinguishable.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                Crossing patterns. If the copper lines are high on the
                left (SPACE: grand, cold, maximal) and high on the right
                (STAGE: formal, curated, theatrical), but low in the
                middle (STORY: low provenance, low historicism)&mdash;that
                is the visual signature of purchased spectacle without
                inherited depth. The parallel coordinates chart makes this
                cross-group pattern visible in a way no single-axis chart
                can.
              </p>
            </div>
          </div>

          {/* 6C: Small Multiples */}
          <div
            className="mt-6 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                6C &mdash; DIRECT COMPARISON: OVERLAID HISTOGRAMS
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 240,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  3 &times; 3 grid &middot; baseline histogram (green)
                  &middot; Epstein histogram (copper)
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Cliff&rsquo;s &delta; and CLES printed on each panel
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                The simplest and most honest visualization&mdash;nine
                overlaid frequency distributions, one per axis, arranged
                in a 3&times;3 grid matching the SPACE / STORY / STAGE
                grouping. The AD baseline appears as a green histogram;
                the Epstein subset (normalized to the same height) appears
                in copper. Each panel includes the Cliff&rsquo;s delta
                effect size and Common Language Effect Size in the corner.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                Separation and overlap. If both distributions sit on top
                of each other, the axis does not distinguish the groups.
                If the copper histogram shifts rightward (higher scores),
                Epstein homes score above the baseline on that axis. The
                <em> amount</em> of shift is the effect size. Tufte (1983)
                calls small multiples &ldquo;the most effective device for
                presenting repetitions of a design&rdquo;&mdash;nine
                panels with the same visual grammar let the reader compare
                axes instantly.
              </p>
            </div>
          </div>

          {/* 6D: Group Comparison */}
          <div
            className="mt-6 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                6D &mdash; THE HYPOTHESIS TEST: SPACE / STORY / STAGE
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: COPPER,
                  backgroundColor: "rgba(184, 115, 51, 0.1)",
                }}
              >
                PENDING
              </span>
            </div>
            <div
              className="mt-4 flex items-center justify-center rounded"
              style={{
                height: 220,
                backgroundColor: "rgba(58, 51, 42, 0.15)",
                border: `1px dashed ${BORDER}`,
              }}
            >
              <div className="text-center">
                <p
                  className="text-[11px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  3 grouped bars &middot; baseline vs. Epstein mean per
                  group &middot; 95% bootstrap CI error bars
                </p>
                <p
                  className="mt-1 text-[9px]"
                  style={{ fontFamily: MONO, color: COPPER }}
                >
                  Pre-registered confirmatory test: STAGE divergence
                </p>
              </div>
            </div>
            <div
              className="mt-4 flex flex-col gap-3 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                This is the confirmatory test. The three axis groups are
                collapsed to their means: SPACE (Grandeur + Material
                Warmth + Maximalism), STORY (Historicism + Provenance +
                Hospitality), STAGE (Formality + Curation +
                Theatricality). Baseline and Epstein means are compared
                for each group, with 95% bootstrap confidence intervals.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  What to look for:
                </strong>{" "}
                The pre-registered hypothesis predicts STAGE will show the
                largest divergence&mdash;Epstein-connected homes perform
                for an audience more than the AD average. If SPACE and
                STORY show <em>no</em> significant difference while STAGE
                does, the finding is specific: these homes are not bigger,
                warmer, or more historic than average&mdash;they are more
                performed. If all three groups diverge equally, the
                Epstein aesthetic is just &ldquo;more of everything,&rdquo;
                which is a different (and less interesting) finding. If
                nothing diverges, the hypothesis is wrong and this section
                will say so.
              </p>
            </div>
          </div>

          {/* Statistical approach */}
          <div
            className="mt-8 rounded border p-6"
            style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
          >
            <p
              className="text-[10px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              STATISTICAL APPROACH
            </p>
            <div
              className="mt-4 flex flex-col gap-4 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                The comparison between 134 Epstein-connected homes and
                3,629 baseline homes presents a classic unequal-groups
                problem. With n = 3,763, almost any difference will be
                &ldquo;statistically significant&rdquo;&mdash;a 0.1-point
                gap on a 5-point scale will produce p &lt; 0.05. This is
                why{" "}
                <strong style={{ color: TEXT_LIGHT }}>
                  we lead with effect sizes, not p-values.
                </strong>
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Step 1: Multivariate test.
                </strong>{" "}
                PERMANOVA (Anderson, 2001) tests whether the 9-dimensional
                profile differs between groups using permutation of distance
                matrices&mdash;no distributional assumptions. This single
                test controls familywise error before any per-axis follow-up.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Step 2: Per-axis follow-up.
                </strong>{" "}
                Mann-Whitney U tests (non-parametric, appropriate for ordinal
                data) with Benjamini-Hochberg false discovery rate correction
                across 9 comparisons. Both corrected and uncorrected p-values
                reported for transparency.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Step 3: Effect sizes.
                </strong>{" "}
                Cliff&rsquo;s delta (&delta;) for every axis&mdash;the
                non-parametric effect size measuring the probability that a
                randomly selected Epstein home scores higher than a baseline
                home. Reported as Common Language Effect Size: &ldquo;63%
                of Epstein homes are more formal than a random AD
                home&rdquo; is more meaningful than &ldquo;d = 0.47.&rdquo;
                Bootstrap 95% confidence intervals on all estimates.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Step 4: Multivariate characterization.
                </strong>{" "}
                Mahalanobis distance measures how far the Epstein centroid
                is from the baseline in the full 9-dimensional space.
                Linear Discriminant Analysis identifies which axes drive
                the separation&mdash;directly testing the STAGE divergence
                hypothesis. Cross-validated classification accuracy
                (AUC) measures whether the aesthetic signature is
                detectable.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Step 5: Temporal matching.
                </strong>{" "}
                Every analysis is repeated within decade bins. If the
                Epstein difference vanishes within decades, it&rsquo;s
                a temporal confound, not an Epstein effect. This is the
                single most important robustness check (Rosenbaum &amp;
                Rubin, 1983).
              </p>
            </div>
          </div>

          {/* Confirmatory vs exploratory */}
          <div
            className="mt-8 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            <p>
              <strong style={{ color: TEXT_LIGHT }}>
                A note on confirmatory vs. exploratory analysis.
              </strong>{" "}
              We have one pre-registered hypothesis: the STAGE group
              (Theatricality + Curation + Formality) will show the largest
              divergence between Epstein-connected homes and the AD
              baseline. This is tested first as a confirmatory analysis.
              Any other findings&mdash;unexpected divergences on SPACE or
              STORY axes, temporal interactions, bimodal
              distributions&mdash;are exploratory and labeled as such. The
              distinction matters for credibility: testing 9 axes and
              reporting only the significant ones is p-hacking by another
              name (Benjamini &amp; Hochberg, 1995).
            </p>
            <p>
              The 134 Epstein-connected homes remain in the full-population
              baseline. At 3.6% of the total, they are too small to
              meaningfully shift population statistics (Rothman et al.,
              2008). Results are reported both with and without exclusion
              as a sensitivity check.
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 9: THE DIAGNOSTIC COMPOSITE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="9"
            title="THE EPSTEIN SIGNATURE"
            subtitle="A single composite score that captures the aesthetic of performed wealth."
          />

          {/* 9-AXIS RADAR — PREDICTED DIVERGENCE */}
          <div
            className="mt-10 rounded border p-8"
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
      </div>
    </section>
  );
}
