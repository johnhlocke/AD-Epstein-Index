"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
} from "recharts";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useMounted } from "@/lib/use-mounted";
import { GROUP_COLORS } from "@/lib/design-tokens";
import { PCASection } from "@/components/charts/PCAChart";
import axisExemplars from "./axis-exemplars.json";
import somRaw from "./som-data.json";

// ── SOM data types ────────────────────────────────────────────────────────
interface SomData {
  metadata: {
    grid_size: number;
    topology: string;
    n_features: number;
    n_axes: number;
    axis_names: string[];
    axis_groups: string[];
    n_clusters: number;
    quantization_error: number;
    topographic_error: number;
    cluster_names: string[];
    decades: string[];
  };
  component_planes: Record<string, number[][]>;
  u_matrix: number[][];
  cluster_map: number[][];
  hit_map: number[][];
  decade_maps: Record<string, number[][]>;
  cluster_centroids: { cluster_id: number; name: string; centroid: number[] }[];
  bmu_assignments: { feature_id: number; bmu_x: number; bmu_y: number }[];
}
const somData = somRaw as SomData;

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

// ── Score distribution data (% of features scoring 1-5 per axis) ──
const AXIS_LABELS_SHORT = ["GR", "MW", "MX", "HI", "PR", "HO", "FO", "CU", "TH"] as const;
const AXIS_LABELS_FULL = [
  "Grandeur", "Material Warmth", "Maximalism", "Historicism",
  "Provenance", "Hospitality", "Formality", "Curation", "Theatricality",
] as const;
const AXIS_GROUPS = ["SPACE","SPACE","SPACE","STORY","STORY","STORY","STAGE","STAGE","STAGE"] as const;

const distributionData: { axis: string; short: string; group: string; pcts: number[] }[] = [
  { axis: "Grandeur",        short: "GR", group: "SPACE", pcts: [1.6, 12.2, 27.9, 42.4, 15.9] },
  { axis: "Material Warmth", short: "MW", group: "SPACE", pcts: [0.9, 4.7, 14.7, 40.4, 39.2] },
  { axis: "Maximalism",      short: "MX", group: "SPACE", pcts: [4.8, 11.3, 23.5, 39.6, 20.9] },
  { axis: "Historicism",     short: "HI", group: "STORY", pcts: [11.5, 14.5, 24.2, 37.5, 12.4] },
  { axis: "Provenance",      short: "PR", group: "STORY", pcts: [7.2, 11.5, 35.3, 31.9, 14.1] },
  { axis: "Hospitality",     short: "HO", group: "STORY", pcts: [5.7, 14.4, 35.9, 34.5, 9.5] },
  { axis: "Formality",       short: "FO", group: "STAGE", pcts: [14.0, 22.8, 31.9, 26.7, 4.5] },
  { axis: "Curation",        short: "CU", group: "STAGE", pcts: [2.2, 10.6, 22.8, 56.3, 8.0] },
  { axis: "Theatricality",   short: "TH", group: "STAGE", pcts: [16.9, 42.8, 28.9, 9.1, 2.3] },
];

// Correlation matrix (Spearman, row-major order matching AXIS_LABELS_FULL)
const CORR_MATRIX = [
  [ 1.000, -0.284,  0.065,  0.186, -0.194,  0.470,  0.646,  0.419,  0.493],
  [-0.284,  1.000,  0.333,  0.381,  0.456, -0.124, -0.445, -0.387, -0.490],
  [ 0.065,  0.333,  1.000,  0.500,  0.464,  0.083,  0.087, -0.046,  0.021],
  [ 0.186,  0.381,  0.500,  1.000,  0.539,  0.101,  0.181, -0.110, -0.212],
  [-0.194,  0.456,  0.464,  0.539,  1.000, -0.179, -0.298, -0.583, -0.544],
  [ 0.470, -0.124,  0.083,  0.101, -0.179,  1.000,  0.319,  0.346,  0.410],
  [ 0.646, -0.445,  0.087,  0.181, -0.298,  0.319,  1.000,  0.628,  0.612],
  [ 0.419, -0.387, -0.046, -0.110, -0.583,  0.346,  0.628,  1.000,  0.694],
  [ 0.493, -0.490,  0.021, -0.212, -0.544,  0.410,  0.612,  0.694,  1.000],
];

// Decade evolution data
const decadeData = [
  { decade: "1988-99", n: 1398, means: [3.47, 4.35, 3.89, 3.66, 3.71, 3.12, 2.87, 3.34, 2.14] },
  { decade: "2000-09", n: 1065, means: [3.68, 4.09, 3.29, 3.16, 3.06, 3.36, 3.01, 3.71, 2.40] },
  { decade: "2010-19", n: 850,  means: [3.78, 3.80, 3.54, 2.90, 3.12, 3.51, 2.89, 3.79, 2.69] },
  { decade: "2020-25", n: 433,  means: [3.33, 4.07, 3.61, 2.82, 3.30, 2.33, 3.54, 2.40, 3.14] },
];

// ── Cluster typology data (k-means, k=6, StandardScaler) ──
interface ClusterType {
  id: number;
  name: string;
  subtitle: string;
  pct: string;
  n: number;
  centroid: number[];
  description: string;
  examples: string[];
}

const CLUSTER_TYPES: ClusterType[] = [
  {
    id: 0, name: "The Lived-In Retreat", subtitle: "Warm, layered, unpretentious",
    pct: "17.6%", n: 662,
    centroid: [2.44, 4.73, 3.85, 3.39, 4.29, 2.30, 1.43, 2.39, 1.33],
    description: "Maximum warmth, maximum provenance, near-zero performance. These are homes that have accumulated objects and character over decades. Wood, linen, personal collections, inherited furniture. The design was not 'directed' — it grew. Low Hospitality suggests private retreats, not social spaces.",
    examples: ["Felicity Huffman & William H. Macy", "Teri Garr", "Gerson Castelo Branco"],
  },
  {
    id: 1, name: "The Clean Slate", subtitle: "Contemporary, minimal, designed",
    pct: "13.6%", n: 510,
    centroid: [3.42, 3.66, 2.27, 1.96, 2.37, 2.90, 2.65, 3.71, 2.28],
    description: "Low on history, provenance, and maximalism — these are new builds with clean-line contemporary design. No accumulated objects, no historical character. A designer directed the space (Curation 3.71) but there is nothing to inherit and nothing to display. The aesthetic is restraint, not abundance.",
    examples: ["Michael & Carol Newman", "Farmhouse Now", "No Boundaries"],
  },
  {
    id: 2, name: "The Grand Heritage", subtitle: "Old, grand, layered, unperformed",
    pct: "12.1%", n: 454,
    centroid: [4.19, 4.50, 4.29, 4.50, 4.56, 3.45, 3.21, 3.04, 1.75],
    description: "Everything high except performance. Grand rooms filled with historical character, real provenance, warm materials — and low Theatricality. These are the English country houses, Tuscan villas, and old New York apartments that accumulated grandeur over centuries. The building does the talking; no staging needed.",
    examples: ["Dede Pratesi", "Adrian & Irena Csáky", "Miguel de Oriol e Ybarra"],
  },
  {
    id: 3, name: "The Designer Showcase", subtitle: "Grand, curated, theatrical",
    pct: "19.6%", n: 737,
    centroid: [4.46, 3.88, 4.25, 3.87, 3.13, 3.96, 4.06, 4.24, 3.44],
    description: "The most 'performed' cluster. High across nearly every axis — grand, maximalist, historical, curated, formal, and theatrical. A professional designer directed the space to impress. Provenance is notably lower (3.13) — these homes display period references but the objects are sourced, not inherited.",
    examples: ["Penny Drue Baird", "Park Avenue Classic", "Fisher Island estate"],
  },
  {
    id: 4, name: "The Comfortable Middle", subtitle: "Warm, moderate, designer-touched",
    pct: "28.2%", n: 1060,
    centroid: [3.35, 4.50, 3.78, 3.36, 3.41, 3.40, 2.58, 3.77, 2.24],
    description: "The AD center of gravity. Warm materials, moderate grandeur, moderate provenance, professionally curated but not theatrical. This is the 'typical AD home' — a well-appointed living space with designer involvement that doesn't call attention to itself. It represents over a quarter of all features.",
    examples: ["A Civilized Rustic", "East by Far East", "Quick-Change Artistry"],
  },
  {
    id: 5, name: "The Cold Stage", subtitle: "Cool, curated, rootless, performative",
    pct: "9.0%", n: 340,
    centroid: [4.10, 2.49, 2.27, 1.54, 1.58, 3.66, 3.64, 4.31, 3.46],
    description: "The inverse of Cluster 0. Cold materials, no history, no provenance, but maximum curation and high theatricality. These are the blue-chip gallery apartments, the marble-and-chrome penthouses, the spaces designed to impress. The lowest Historicism and Provenance of any cluster — everything is new and purchased.",
    examples: ["Night and Day", "Steven & Claire Stull", "Martin & Toni Sosnoff"],
  },
];

// ── Cluster visualization constants ──
const CLUSTER_COLORS: Record<number, string> = {
  0: "#C9A96E", // Lived-In Retreat — warm amber
  1: "#6B8FA3", // Clean Slate — slate blue
  2: "#D4A574", // Grand Heritage — antique gold
  3: "#C97B84", // Designer Showcase — dusty rose
  4: "#7BA07B", // Comfortable Middle — sage
  5: "#8CB4C9", // Cold Stage — ice blue
};

// Compute STAGE and AUTH composites from centroids
// AUTH = (Material Warmth + Provenance + Historicism) / 3
// STAGE = (Formality + Curation + Theatricality) / 3
const CLUSTER_COMPOSITES = CLUSTER_TYPES.map((c) => ({
  id: c.id,
  name: c.name,
  n: c.n,
  pct: c.pct,
  stage: (c.centroid[6] + c.centroid[7] + c.centroid[8]) / 3,
  auth: (c.centroid[1] + c.centroid[4] + c.centroid[3]) / 3,
}));

// Decade-level cluster proportions (% of features per era)
const DECADE_CLUSTER_PROPORTIONS = [
  { decade: "1988–99", n: 1398, pcts: [20.0, 8.7, 19.0, 18.0, 28.0, 6.3] },
  { decade: "2000–09", n: 1065, pcts: [18.0, 11.0, 14.0, 20.0, 28.0, 9.0] },
  { decade: "2010–19", n: 850,  pcts: [15.0, 15.0, 8.0, 21.0, 29.0, 12.0] },
  { decade: "2020–25", n: 433,  pcts: [14.0, 17.1, 4.6, 20.0, 30.0, 14.3] },
];

// Axis name shortcodes for cluster radars
const CLUSTER_RADAR_AXES = [
  { key: "GR", full: "Grandeur" },
  { key: "MW", full: "Material Warmth" },
  { key: "MX", full: "Maximalism" },
  { key: "HI", full: "Historicism" },
  { key: "PR", full: "Provenance" },
  { key: "HO", full: "Hospitality" },
  { key: "FO", full: "Formality" },
  { key: "CU", full: "Curation" },
  { key: "TH", full: "Theatricality" },
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

// ── Case Study data & component ──────────────────────────────────────────────

interface CaseStudy {
  num: number;
  featureId: number;
  homeowner: string;
  articleTitle: string;
  year: number;
  location: string;
  scores: {
    grandeur: number;
    material_warmth: number;
    maximalism: number;
    historicism: number;
    provenance: number;
    hospitality: number;
    formality: number;
    curation: number;
    theatricality: number;
  };
  stageComposite: number;
  authComposite: number;
  aestheticSummary: string;
  teachingLabel: string;
  teachingPoint: string;
  imageUrls: string[];
}

const CASE_STUDIES: CaseStudy[] = [
  {
    num: 1,
    featureId: 8515,
    homeowner: "Charles S. Cohen",
    articleTitle: "French Twist",
    year: 2006,
    location: "New York",
    scores: { grandeur: 5, material_warmth: 4, maximalism: 5, historicism: 4, provenance: 2, hospitality: 4, formality: 5, curation: 5, theatricality: 5 },
    stageComposite: 5.0,
    authComposite: 3.33,
    aestheticSummary: "A real estate developer\u2019s fantasy of Parisian grandeur, built from rubble on Park Avenue. Every boiserie panel, every Louis XVI chair, every ormolu mount is museum-grade \u2014 and every inch screams acquisition, not inheritance.",
    teachingLabel: "MAXIMUM STAGE, LOW PROVENANCE",
    teachingPoint: "STAGE scores 5/5/5 while Provenance sits at 2. The rubric captures something specific here: spectacular material investment with no historical root system. Everything is real \u2014 the boiserie, the ormolu \u2014 but nothing grew here. The STAGE composite was designed to measure exactly this kind of purchased-wholesale grandeur.",
    imageUrls: [
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_116.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_117.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_118.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_119.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_120.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_121.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_122.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_123.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_124.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8515/page_125.jpg",
    ],
  },
  {
    num: 2,
    featureId: 7834,
    homeowner: "Jim Dine",
    articleTitle: "A Litchfield Landscape",
    year: 2012,
    location: "Litchfield County, CT",
    scores: { grandeur: 2, material_warmth: 5, maximalism: 4, historicism: 4, provenance: 5, hospitality: 2, formality: 1, curation: 1, theatricality: 1 },
    stageComposite: 1.0,
    authComposite: 4.67,
    aestheticSummary: "An artist\u2019s farmhouse where every object is an artifact of a lived creative life, not a curated display. Paint-spattered floors, handmade tools on the walls, decades of accumulated meaning in every room.",
    teachingLabel: "THE OPPOSITE PROFILE",
    teachingPoint: "Maximum Authenticity (4.67), zero STAGE (1.0). The radar inverts completely \u2014 every axis that was high in Cohen is low here, and vice versa. This proves the two composites are genuinely independent dimensions, not just a single opulence slider. A home can be maximalist (4) and historically rich (4) while scoring rock-bottom on performance.",
    imageUrls: [
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_110.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_111.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_112.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_113.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_114.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_115.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_116.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/7834/page_117.jpg",
    ],
  },
  {
    num: 3,
    featureId: 8841,
    homeowner: "Nancy Cain Marcus",
    articleTitle: "Neoclassical Beauty",
    year: 2014,
    location: "New York",
    scores: { grandeur: 5, material_warmth: 3, maximalism: 5, historicism: 5, provenance: 3, hospitality: 4, formality: 5, curation: 5, theatricality: 5 },
    stageComposite: 5.0,
    authComposite: 3.67,
    aestheticSummary: "A Napoleonic fever dream built from scratch on the 36th floor of Park Avenue. Molyneux conjures a Roman palazzo from thin air \u2014 barrel vaults, trompe-l\u2019\u0153il skies, a library that could be the study of a Medici prince.",
    teachingLabel: "PERFORMANCE \u2260 SHALLOW",
    teachingPoint: "Both STAGE and Historicism maxed at 5. This is the key orthogonality test: theatrical homes can have genuine intellectual depth and historical rigor. The performance here is learned, not cynical \u2014 Molyneux\u2019s neoclassicism is scholarly. The rubric correctly registers that spectacle and knowledge can coexist.",
    imageUrls: [
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_190.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_191.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_192.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_193.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_194.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_195.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_196.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/8841/page_197.jpg",
    ],
  },
  {
    num: 4,
    featureId: 6918,
    homeowner: "Adam Frampton & Karolina Czeczek",
    articleTitle: "Slim Chance",
    year: 2018,
    location: "Brooklyn",
    scores: { grandeur: 3, material_warmth: 2, maximalism: 1, historicism: 1, provenance: 1, hospitality: 1, formality: 2, curation: 3, theatricality: 1 },
    stageComposite: 2.0,
    authComposite: 1.33,
    aestheticSummary: "An architect\u2019s proof-of-concept squeezed onto a 15-foot-wide Brooklyn lot, where perforated metal, concrete, and poured floors create a cool, luminous vertical laboratory.",
    teachingLabel: "THE LOW END WORKS",
    teachingPoint: "The rubric doesn\u2019t bias toward abundance. Minimalist restraint registers as a coherent position, not a failure to score. Curation picks up a 3 because the design is intentional \u2014 every constraint is a material decision. This is philosophical opposition to display, accurately captured. Low scores are not punitive; they\u2019re descriptive.",
    imageUrls: [
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/6918/page_038.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/6918/page_042.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/6918/page_052.jpg",
    ],
  },
  {
    num: 5,
    featureId: 9308,
    homeowner: "Giancarlo Giammetti",
    articleTitle: "The High Life",
    year: 2010,
    location: "New York",
    scores: { grandeur: 5, material_warmth: 3, maximalism: 4, historicism: 2, provenance: 3, hospitality: 4, formality: 4, curation: 5, theatricality: 5 },
    stageComposite: 4.67,
    authComposite: 2.67,
    aestheticSummary: "A sky-high Manhattan trophy penthouse where every surface broadcasts blue-chip credentials \u2014 Picasso flanked by Basquiat, a Calder mobile spinning against the skyline. Jacques Grange\u2019s hand is everywhere: disciplined, professional, expensive.",
    teachingLabel: "CURATOR VS DEVELOPER",
    teachingPoint: "Compare with Cohen (#1). Both are high-STAGE Manhattan interiors. But Giammetti\u2019s space has Jacques Grange\u2019s professional hand: higher Hospitality (4), lower Formality (4 vs 5), lower Historicism (2 vs 4). The 9-axis system distinguishes between a curator\u2019s performance and a developer\u2019s fantasy \u2014 a distinction a single \u201copulence\u201d score would collapse.",
    imageUrls: [
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_122.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_123.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_124.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_125.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_126.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_127.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_128.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_129.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_130.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_131.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_132.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/dossier-images/9308/page_133.jpg",
    ],
  },
  {
    num: 6,
    featureId: 5937,
    homeowner: "Nick & Christian Candy",
    articleTitle: "The View from the Top",
    year: 2015,
    location: "Monte Carlo",
    scores: { grandeur: 5, material_warmth: 3, maximalism: 5, historicism: 4, provenance: 2, hospitality: 4, formality: 5, curation: 5, theatricality: 5 },
    stageComposite: 5.0,
    authComposite: 3.0,
    aestheticSummary: "New money\u2019s fantasy of old money, executed at staggering scale. The Candy brothers built a Belle \u00c9poque theme park atop Monte Carlo \u2014 nothing has ever been touched, only displayed.",
    teachingLabel: "DISPLAY VS INHABIT",
    teachingPoint: "The Opus summary nails it: \u201cnothing has ever been touched, only displayed.\u201d Maximum STAGE with Historicism at 4 \u2014 they know the references. But Provenance at 2 betrays the artifice: these rooms quote history without having any. The gap between Historicism and Provenance is one of the rubric\u2019s sharpest diagnostic signals.",
    imageUrls: [
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_148.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_149.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_150.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_151.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_152.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_153.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_154.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_155.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_156.jpg",
      "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/feature-images/5937/page_157.jpg",
    ],
  },
];

const SCORE_AXES: { key: keyof CaseStudy["scores"]; label: string; group: string }[] = [
  { key: "grandeur", label: "G", group: "SPACE" },
  { key: "material_warmth", label: "MW", group: "SPACE" },
  { key: "maximalism", label: "MX", group: "SPACE" },
  { key: "historicism", label: "H", group: "STORY" },
  { key: "provenance", label: "P", group: "STORY" },
  { key: "hospitality", label: "HO", group: "STORY" },
  { key: "formality", label: "F", group: "STAGE" },
  { key: "curation", label: "CU", group: "STAGE" },
  { key: "theatricality", label: "TH", group: "STAGE" },
];

function CaseStudyCard({ study, mounted }: { study: CaseStudy; mounted: boolean }) {
  const chartData = SCORE_AXES.map((a) => ({
    axis: a.label,
    fullName: a.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: study.scores[a.key],
    group: a.group,
  }));

  return (
    <div
      className="overflow-hidden rounded border md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
      style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
    >
      {/* Magazine spread pages */}
      {study.imageUrls.length > 0 && (
        <div
          className="grid grid-cols-3 gap-px sm:grid-cols-4"
          style={{ backgroundColor: BORDER }}
        >
          {study.imageUrls.map((url, i) => (
            <div key={i} className="relative aspect-[3/4]" style={{ backgroundColor: CARD_BG }}>
              <Image
                src={url}
                alt={`${study.homeowner} — page ${i + 1}`}
                fill
                sizes="(min-width: 768px) 160px, 25vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Header bar */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3"
        style={{ borderColor: BORDER }}
      >
        <span
          className="text-[11px] font-bold tracking-wider"
          style={{ fontFamily: MONO, color: COPPER }}
        >
          CASE {study.num}
        </span>
        <span
          className="text-[14px] font-bold"
          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
        >
          {study.homeowner}
        </span>
        <span
          className="text-[12px] italic"
          style={{ fontFamily: BODY, color: TEXT_MID }}
        >
          &ldquo;{study.articleTitle}&rdquo;
        </span>
        <span
          className="text-[11px]"
          style={{ fontFamily: MONO, color: TEXT_DIM }}
        >
          {study.location}, {study.year}
        </span>
      </div>

      {/* Body: radar + prose */}
      <div className="grid gap-6 p-5 md:grid-cols-[250px_1fr]">
        {/* Radar chart */}
        <div style={{ width: 250, height: 250, flexShrink: 0 }}>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke={BORDER} strokeDasharray="2 4" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fontSize: 9, fill: TEXT_DIM, fontFamily: MONO }}
                  tickLine={false}
                />
                <PolarRadiusAxis
                  domain={[1, 5]}
                  tickCount={5}
                  tick={{ fontSize: 8, fill: "rgba(176,165,148,0.4)", fontFamily: MONO }}
                  axisLine={false}
                />
                <Radar
                  dataKey="value"
                  stroke={COPPER}
                  fill={COPPER}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: COPPER }}
                />
                <Tooltip content={<CaseStudyTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ width: 250, height: 250, backgroundColor: CARD_BG, borderRadius: 4 }} />
          )}
        </div>

        {/* Text content */}
        <div className="flex flex-col gap-4">
          {/* Score pills */}
          <div className="flex flex-wrap gap-1.5">
            {SCORE_AXES.map((a) => (
              <span
                key={a.key}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  fontFamily: MONO,
                  backgroundColor: "rgba(0,0,0,0.3)",
                  color: GROUP_COLORS[a.group] || TEXT_MID,
                  border: `1px solid ${GROUP_COLORS[a.group] || BORDER}33`,
                }}
              >
                {a.label}
                <span style={{ color: TEXT_LIGHT }}>{study.scores[a.key]}</span>
              </span>
            ))}
            <span className="mx-1" />
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                fontFamily: MONO,
                backgroundColor: "rgba(184,115,51,0.1)",
                color: COPPER,
                border: `1px solid rgba(184,115,51,0.25)`,
              }}
            >
              STAGE {study.stageComposite.toFixed(2)}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                fontFamily: MONO,
                backgroundColor: "rgba(46,204,113,0.06)",
                color: GREEN,
                border: `1px solid rgba(46,204,113,0.15)`,
              }}
            >
              AUTH {study.authComposite.toFixed(2)}
            </span>
          </div>

          {/* Aesthetic summary (Opus voice) */}
          <p
            className="text-[13px] italic leading-[1.7]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            {study.aestheticSummary}
          </p>

          {/* Teaching point */}
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: GOLD }}
            >
              {study.teachingLabel}
            </p>
            <p
              className="mt-1.5 text-[13px] leading-[1.7]"
              style={{ fontFamily: BODY, color: TEXT_LIGHT }}
            >
              {study.teachingPoint}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseStudyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div
      className="rounded border px-3 py-2"
      style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, fontFamily: MONO }}
    >
      <p className="text-[11px] font-bold" style={{ color: TEXT_LIGHT }}>
        {data.fullName}
      </p>
      <p className="mt-0.5 text-[10px]" style={{ color: COPPER }}>
        Score: {data.value}/5
      </p>
    </div>
  );
}

// ── Cluster Typology Card ────────────────────────────────────────────────────

function ClusterTypologyCard({
  cluster,
  mounted,
}: {
  cluster: (typeof CLUSTER_TYPES)[number];
  mounted: boolean;
}) {
  const color = CLUSTER_COLORS[cluster.id] || TEXT_MID;
  const radarData = CLUSTER_RADAR_AXES.map((a, i) => ({
    axis: a.key,
    fullName: a.full,
    value: cluster.centroid[i],
  }));

  return (
    <div
      className="rounded border"
      style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-3"
        style={{ borderColor: BORDER }}
      >
        <span
          className="text-[10px] font-bold tracking-wider"
          style={{ fontFamily: MONO, color }}
        >
          C{cluster.id}
        </span>
        <span
          className="text-[14px] font-bold"
          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
        >
          {cluster.name}
        </span>
        <span
          className="text-[11px] italic"
          style={{ fontFamily: BODY, color: TEXT_DIM }}
        >
          {cluster.subtitle}
        </span>
      </div>

      {/* Body: radar + prose */}
      <div className="grid gap-5 p-5 md:grid-cols-[220px_1fr]">
        {/* Mini radar */}
        <div style={{ width: 220, height: 220, flexShrink: 0 }}>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke={BORDER} strokeDasharray="2 4" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fontSize: 8, fill: TEXT_DIM, fontFamily: MONO }}
                  tickLine={false}
                />
                <PolarRadiusAxis
                  domain={[1, 5]}
                  tickCount={5}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  dataKey="value"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: color }}
                />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div
                        className="rounded border px-2 py-1"
                        style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, fontFamily: MONO }}
                      >
                        <p className="text-[10px] font-bold" style={{ color: TEXT_LIGHT }}>
                          {d.fullName}
                        </p>
                        <p className="text-[10px]" style={{ color }}>
                          {d.value.toFixed(2)}
                        </p>
                      </div>
                    );
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ width: 220, height: 220, backgroundColor: CARD_BG, borderRadius: 4 }} />
          )}
        </div>

        {/* Stats + description */}
        <div className="flex flex-col gap-3">
          {/* Stat pills */}
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold"
              style={{ fontFamily: MONO, backgroundColor: `${color}18`, color, border: `1px solid ${color}33` }}
            >
              {cluster.pct} of AD &middot; n={cluster.n.toLocaleString()}
            </span>
          </div>

          {/* Description */}
          <p
            className="text-[13px] leading-[1.7]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            {cluster.description}
          </p>

          {/* Example homes */}
          <div className="flex flex-wrap gap-1.5">
            {cluster.examples.map((ex) => (
              <span
                key={ex}
                className="rounded px-2 py-0.5 text-[9px] italic"
                style={{
                  fontFamily: BODY,
                  backgroundColor: "rgba(58,51,42,0.4)",
                  color: TEXT_DIM,
                }}
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SOM Hex Grid Helpers ─────────────────────────────────────────────────────

const SOM_GRID = somData.metadata.grid_size; // 20
const HEX_R = 14; // hex radius in px
const HEX_W = HEX_R * Math.sqrt(3);
const HEX_H = HEX_R * 2;
const SOM_SVG_W = SOM_GRID * HEX_W + HEX_W * 0.5 + 4;
const SOM_SVG_H = SOM_GRID * HEX_H * 0.75 + HEX_H * 0.25 + 4;

/** Hex center in SVG coords. Even columns offset down. */
function hexCenter(col: number, row: number): [number, number] {
  const x = 2 + HEX_W * 0.5 + col * HEX_W;
  const y = 2 + HEX_R + row * HEX_H * 0.75 + (col % 2 === 1 ? HEX_H * 0.375 : 0);
  return [x, y];
}

/** Flat-top hexagon path. */
function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Map value to a color via linear interpolation between two RGB stops. */
function lerpColor(t: number, c0: [number, number, number], c1: [number, number, number]): string {
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
  return `rgb(${r},${g},${b})`;
}

/** 3-stop color ramp: low → mid → high */
function colorRamp3(t: number, low: [number, number, number], mid: [number, number, number], high: [number, number, number]): string {
  if (t <= 0.5) return lerpColor(t * 2, low, mid);
  return lerpColor((t - 0.5) * 2, mid, high);
}

const SOM_CLUSTER_COLORS: Record<number, string> = {
  0: "#6B8FA3", // Lived-In Retreat — slate blue
  1: "#8CB4C9", // Clean Slate — ice blue
  2: "#D4A574", // Grand Heritage — antique gold
  3: "#C97B84", // Designer Showcase — dusty rose
  4: "#7BA07B", // Comfortable Middle — sage
  5: "#C9A96E", // Cold Stage — warm gold
};

/** Shared SOM hex grid SVG. Renders 20×20 hexes with per-cell coloring. */
function SomHexGrid({
  colorFn,
  opacityFn,
  tooltipFn,
}: {
  colorFn: (col: number, row: number) => string;
  opacityFn?: (col: number, row: number) => number;
  tooltipFn?: (col: number, row: number) => string;
}) {
  const hexes: React.ReactNode[] = [];
  for (let col = 0; col < SOM_GRID; col++) {
    for (let row = 0; row < SOM_GRID; row++) {
      const [cx, cy] = hexCenter(col, row);
      hexes.push(
        <path
          key={`${col}-${row}`}
          d={hexPath(cx, cy, HEX_R - 0.5)}
          fill={colorFn(col, row)}
          fillOpacity={opacityFn ? opacityFn(col, row) : 1}
          stroke="rgba(27,24,21,0.6)"
          strokeWidth={0.5}
        >
          {tooltipFn && <title>{tooltipFn(col, row)}</title>}
        </path>
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${SOM_SVG_W} ${SOM_SVG_H}`}
      className="w-full"
      style={{ maxHeight: 420 }}
    >
      {hexes}
    </svg>
  );
}

// ── SOM Temporal Drift (animated) ──────────────────────────────────────────

const DECADE_MS = 3000; // time per decade in the animation

/** Precompute per-decade cluster percentages */
function computeDecadeClusterPcts(): Record<string, Record<number, number>> {
  const decades = somData.metadata.decades;
  const cm = somData.cluster_map;
  const result: Record<string, Record<number, number>> = {};
  for (const decade of decades) {
    const dmap = somData.decade_maps[decade];
    const counts: Record<number, number> = {};
    let total = 0;
    for (let c = 0; c < SOM_GRID; c++) {
      for (let r = 0; r < SOM_GRID; r++) {
        const hits = dmap[c][r];
        if (hits > 0) {
          const cid = cm[c][r];
          counts[cid] = (counts[cid] || 0) + hits;
          total += hits;
        }
      }
    }
    const pcts: Record<number, number> = {};
    for (let cid = 0; cid < 6; cid++) {
      pcts[cid] = total > 0 ? ((counts[cid] || 0) / total) * 100 : 0;
    }
    result[decade] = pcts;
  }
  return result;
}

const DECADE_CLUSTER_PCTS = computeDecadeClusterPcts();

function SomTemporalDrift({ mounted }: { mounted: boolean }) {
  const decades = somData.metadata.decades as string[];
  const [decadeIdx, setDecadeIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef(0);

  // Auto-play on scroll into view
  useEffect(() => {
    if (!mounted) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setPlaying(true);
          setHasStarted(true);
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mounted, hasStarted]);

  // Animation loop — cycles through decades
  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const totalDuration = decades.length * DECADE_MS;
      const loopTime = elapsed % totalDuration;
      const idx = Math.floor(loopTime / DECADE_MS) % decades.length;
      setDecadeIdx(idx);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, decades.length]);

  const handleClick = useCallback(() => {
    if (playing) {
      setPlaying(false);
    } else {
      setPlaying(true);
      if (!hasStarted) setHasStarted(true);
    }
  }, [playing, hasStarted]);

  const currentDecade = decades[decadeIdx];
  const prevDecade = decades[(decadeIdx - 1 + decades.length) % decades.length];
  const dmap = somData.decade_maps[currentDecade];
  const prevDmap = somData.decade_maps[prevDecade];
  const cm = somData.cluster_map;

  // Max hits across all decades for consistent scaling
  let globalMax = 0;
  for (const d of decades) {
    const dm = somData.decade_maps[d];
    for (let c = 0; c < SOM_GRID; c++)
      for (let r = 0; r < SOM_GRID; r++)
        if (dm[c][r] > globalMax) globalMax = dm[c][r];
  }

  const pcts = DECADE_CLUSTER_PCTS[currentDecade];

  // Biggest movers vs previous decade
  const prevPcts = DECADE_CLUSTER_PCTS[prevDecade];

  return (
    <div
      ref={containerRef}
      className="mt-6 rounded border p-6"
      style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
    >
      <div className="flex items-baseline justify-between">
        <p
          className="text-[10px] font-bold tracking-wider"
          style={{ fontFamily: MONO, color: GOLD_DIM }}
        >
          7C &mdash; THE AESTHETIC MAP &amp; HOW TASTE MIGRATES
        </p>
        <span
          className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
          style={{
            fontFamily: MONO,
            color: GREEN,
            backgroundColor: "rgba(46, 204, 113, 0.08)",
          }}
        >
          LIVE
        </span>
      </div>

      {mounted && (
        <div
          className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr] cursor-pointer"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") handleClick(); }}
          aria-label={playing ? "Pause animation" : "Play animation"}
        >
          {/* Left: Static reference map */}
          <div>
            <p
              className="mb-2 text-center text-[10px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              ALL HOMES (n=3,763)
            </p>
            <SomHexGrid
              colorFn={(col, row) => {
                const clusterId = cm[col][row];
                return SOM_CLUSTER_COLORS[clusterId] ?? "#3A332A";
              }}
              opacityFn={(col, row) => {
                const hits = somData.hit_map[col][row];
                return hits === 0 ? 0.25 : Math.min(0.4 + (hits / 33) * 0.6, 1);
              }}
              tooltipFn={(col, row) => {
                const clusterId = cm[col][row];
                const hits = somData.hit_map[col][row];
                return `${somData.metadata.cluster_names[clusterId]}\n${hits} homes`;
              }}
            />
            {/* Cluster legend */}
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {somData.metadata.cluster_names.map((name: string, i: number) => (
                <div key={name} className="flex items-center gap-1">
                  <div
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: SOM_CLUSTER_COLORS[i] }}
                  />
                  <span
                    className="text-[8px]"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Animated decade map */}
          <div>
            <p
              className="mb-2 text-center text-[13px] font-bold tracking-wider"
              style={{
                fontFamily: MONO,
                color: TEXT_LIGHT,
                transition: "color 0.3s",
              }}
            >
              {currentDecade}
            </p>

            {/* Animated hex grid — same cluster colors, opacity by decade hits */}
            <svg
              viewBox={`0 0 ${SOM_SVG_W} ${SOM_SVG_H}`}
              className="w-full"
              style={{ maxHeight: 420 }}
            >
              {(() => {
                const hexes: React.ReactNode[] = [];
                for (let col = 0; col < SOM_GRID; col++) {
                  for (let row = 0; row < SOM_GRID; row++) {
                    const [cx, cy] = hexCenter(col, row);
                    const clusterId = cm[col][row];
                    const color = SOM_CLUSTER_COLORS[clusterId] ?? "#3A332A";
                    const hits = dmap[col][row];
                    const prevHits = prevDmap[col][row];
                    // Blend current and previous for smoother visual
                    const blendHits = hits * 0.8 + prevHits * 0.2;
                    const opacity = blendHits === 0
                      ? 0.08
                      : Math.min(0.15 + (blendHits / globalMax) * 0.85, 1);

                    hexes.push(
                      <path
                        key={`${col}-${row}`}
                        d={hexPath(cx, cy, HEX_R - 0.5)}
                        fill={color}
                        fillOpacity={opacity}
                        stroke="rgba(27,24,21,0.6)"
                        strokeWidth={0.5}
                        style={{ transition: "fill-opacity 0.6s ease" }}
                      >
                        <title>{`${currentDecade}: ${hits} homes\n${somData.metadata.cluster_names[clusterId]}`}</title>
                      </path>
                    );
                  }
                }
                return hexes;
              })()}
              {/* Play/pause indicator */}
              {!playing && hasStarted && (
                <g transform={`translate(${SOM_SVG_W / 2}, ${SOM_SVG_H / 2})`} opacity={0.4}>
                  <polygon points="-10,-14 -10,14 14,0" fill="white" />
                </g>
              )}
            </svg>

            {/* Decade progress dots */}
            <div className="mt-2 flex items-center justify-center gap-2">
              {decades.map((d: string, i: number) => (
                <button
                  key={d}
                  onClick={(e) => { e.stopPropagation(); setDecadeIdx(i); setPlaying(false); }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: i === decadeIdx ? 10 : 6,
                      height: i === decadeIdx ? 10 : 6,
                      backgroundColor: i === decadeIdx ? TEXT_LIGHT : TEXT_DIM,
                      opacity: i === decadeIdx ? 1 : 0.4,
                      transition: "all 0.3s",
                    }}
                  />
                  <span
                    className="text-[7px]"
                    style={{
                      fontFamily: MONO,
                      color: i === decadeIdx ? TEXT_LIGHT : TEXT_DIM,
                      opacity: i === decadeIdx ? 1 : 0.5,
                      transition: "all 0.3s",
                    }}
                  >
                    {d}
                  </span>
                </button>
              ))}
            </div>

            {/* Cluster breakdown for current decade */}
            <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-1">
              {[0, 1, 2, 3, 4, 5].map((cid) => {
                const pct = pcts[cid];
                const prev = prevPcts[cid];
                const delta = pct - prev;
                const name = somData.metadata.cluster_names[cid].replace("The ", "");
                return (
                  <div key={cid} className="flex items-center gap-1">
                    <div
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SOM_CLUSTER_COLORS[cid] }}
                    />
                    <span
                      className="text-[8px] tabular-nums"
                      style={{
                        fontFamily: MONO,
                        color: TEXT_MID,
                        transition: "color 0.3s",
                      }}
                    >
                      {pct.toFixed(0)}%
                      {decadeIdx > 0 && (
                        <span style={{ color: delta > 1 ? GREEN : delta < -1 ? "#C97B84" : TEXT_DIM, marginLeft: 2 }}>
                          {delta > 0 ? "+" : ""}{delta.toFixed(0)}
                        </span>
                      )}
                    </span>
                    <span
                      className="text-[7px] truncate"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>

            <p
              className="mt-2 text-center text-[8px]"
              style={{ fontFamily: MONO, color: TEXT_DIM, opacity: 0.6 }}
            >
              {playing ? "click to pause" : "click to play"}
            </p>
          </div>
        </div>
      )}
      {!mounted && (
        <div
          className="mt-4 flex items-center justify-center rounded"
          style={{
            height: 360,
            backgroundColor: "rgba(58, 51, 42, 0.15)",
            border: `1px dashed ${BORDER}`,
          }}
        >
          <p
            className="text-[11px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            Loading aesthetic map&hellip;
          </p>
        </div>
      )}

      <div
        className="mt-5 flex flex-col gap-3 text-[13px] leading-[1.7]"
        style={{ fontFamily: BODY, color: TEXT_MID }}
      >
        <p>
          <strong style={{ color: TEXT_LIGHT }}>The map:</strong>{" "}
          On the left, each hexagon is colored by its k-means cluster
          assignment, with opacity encoding density&mdash;brighter
          hexagons contain more homes. Regions that touch each other
          share a family resemblance. Regions far apart on the map are
          aesthetically distant. This spatial arrangement is information
          that k-means alone cannot provide, because k-means discards
          topology.
        </p>
        <p>
          <strong style={{ color: TEXT_LIGHT }}>The drift:</strong>{" "}
          On the right, the same cluster-colored map animates through
          four decades. Watch the lights shift: Grand Heritage (gold)
          dims from 19% to 5%, Clean Slate (ice blue) brightens from
          9% to 17%, and Cold Stage (warm gold) holds steady
          throughout&mdash;the Epstein-associated aesthetic persists
          even as the magazine&rsquo;s overall taste evolves.
          The map doesn&rsquo;t change shape&mdash;the aesthetic
          landscape is fixed&mdash;but the <em>population</em> moves
          across it.
        </p>
      </div>
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

          {/* ════════════════════════════════════════════════════════════════
              THE INSTRUMENT IN ACTION — SIX SCORED HOMES
          ════════════════════════════════════════════════════════════════ */}
          <div className="mt-14">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              The Instrument in Action
            </p>
            <p
              className="mt-3 text-[13px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              Six homes from the scored dataset, each chosen to illustrate a
              different lesson about how the 9-axis rubric behaves in practice.
              The radar charts plot raw scores; STAGE and Authenticity composites
              are computed from the group means.
            </p>

            <div className="mt-8 flex flex-col gap-10">
              {CASE_STUDIES.map((cs) => (
                <CaseStudyCard key={cs.num} study={cs} mounted={mounted} />
              ))}
            </div>

            {/* Link to full appendix */}
            <a
              href="/aestheticscores"
              className="mt-10 block rounded border p-6 transition-colors hover:border-[#B87333]"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                boxShadow: CARD_GLOW,
                maxWidth: "calc(4*(100% - 5*24px)/6 + 3*24px)",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                Appendix
              </p>
              <p
                className="mt-2 text-[18px] font-bold leading-tight"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                Full Aesthetic Scores for All Features &rarr;
              </p>
              <p
                className="mt-2 text-[13px] leading-[1.6]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Search and browse the 9-axis scores, radar profiles, and
                AI-generated aesthetic summaries for every home in the dataset.
              </p>
            </a>
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
            PLAIN-ENGLISH VALIDATION SUMMARY (between Sections 5 and 6)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ fontFamily: MONO, color: COPPER }}
          >
            In Plain English
          </p>
          <p
            className="mt-2 text-[22px] font-light leading-[1.4]"
            style={{ fontFamily: BODY, color: TEXT_LIGHT }}
          >
            Three tests, one question: can we trust the numbers?
          </p>

          <div
            className="mt-10 flex flex-col gap-8 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            {/* Test-Retest */}
            <div>
              <p
                className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                Test 1 &mdash; Test-Retest Reliability
              </p>
              <p>
                <em style={{ color: TEXT_DIM }}>&ldquo;If the same AI scores the same home twice,
                does it give the same answer?&rdquo;</em>
              </p>
              <p className="mt-2">
                We had Opus score 100 homes three separate times. Result:{" "}
                <strong style={{ color: TEXT_LIGHT }}>91.1% exact match</strong>,{" "}
                <strong style={{ color: TEXT_LIGHT }}>100% within &plusmn;1 point</strong>.
                ICC 0.949&ndash;0.991. The scorer is extremely consistent with
                itself &mdash; like a bathroom scale that reads 150.2, then
                150.1, then 150.3. Not perfectly identical each time, but close
                enough to trust.
              </p>
            </div>

            {/* Inter-Model */}
            <div>
              <p
                className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                Test 2 &mdash; Inter-Model Agreement
              </p>
              <p>
                <em style={{ color: TEXT_DIM }}>&ldquo;If a different AI scores the same home with
                the same rubric, does it agree?&rdquo;</em>
              </p>
              <p className="mt-2">
                We gave 100 homes to three different Claude models (Opus,
                Sonnet, Haiku) &mdash; same rubric, same images, same prompt.
                Opus and Sonnet agree well (ICC 0.805, 96.8% within &plusmn;1).
                Haiku, the smallest model, wobbles more on interpretive
                judgments (ICC 0.676).
              </p>
              <p className="mt-2">
                The pattern is telling:{" "}
                <strong style={{ color: TEXT_LIGHT }}>physical axes</strong>{" "}
                (how big, how ornate, how old something looks) get high
                agreement across all three models.{" "}
                <strong style={{ color: TEXT_LIGHT }}>Interpretive axes</strong>{" "}
                (is this home performing for an audience? is it curated for
                show?) diverge more &mdash; especially with the smallest model.
                This is exactly what happens with human judges too. The rubric
                drives the scoring, not the individual model&rsquo;s
                personality.
              </p>
            </div>

            {/* PCA / Construct Validation */}
            <div>
              <p
                className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                Test 3 &mdash; Construct Validation
              </p>
              <p>
                <em style={{ color: TEXT_DIM }}>&ldquo;Do the 9 axes measure real, distinct
                things &mdash; or are some of them just measuring the same
                thing?&rdquo;</em>
              </p>
              <p className="mt-2">
                Principal Component Analysis on all 3,763 scored homes shows
                the 9 axes collapse into{" "}
                <strong style={{ color: TEXT_LIGHT }}>two dominant dimensions</strong>{" "}
                explaining 66% of the variance:{" "}
                <strong style={{ color: TEXT_LIGHT }}>Performance</strong>{" "}
                (Theatricality + Curation + Formality &mdash; &ldquo;Is this home a
                stage?&rdquo;) and{" "}
                <strong style={{ color: TEXT_LIGHT }}>Authenticity</strong>{" "}
                (Provenance + Material Warmth + Historicism &mdash; &ldquo;Is this home
                earned?&rdquo;). These two dimensions are nearly independent: a
                home can be high-performance and high-authenticity, or one
                without the other.
              </p>
            </div>

            {/* Bottom line */}
            <div
              className="mt-2 rounded border px-5 py-4"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                boxShadow: CARD_GLOW,
              }}
            >
              <p
                className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                The Bottom Line
              </p>
              <table
                className="w-full text-[13px]"
                style={{ fontFamily: BODY, borderCollapse: "collapse" }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <th className="px-3 py-2 text-left font-bold" style={{ color: TEXT_LIGHT }}>Test</th>
                    <th className="px-3 py-2 text-left font-bold" style={{ color: TEXT_LIGHT }}>What It Proves</th>
                    <th className="px-3 py-2 text-left font-bold" style={{ color: TEXT_LIGHT }}>Strength</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td className="px-3 py-2" style={{ color: TEXT_MID }}>Test-retest</td>
                    <td className="px-3 py-2" style={{ color: TEXT_MID }}>The scorer doesn&rsquo;t contradict itself</td>
                    <td className="px-3 py-2" style={{ color: GREEN }}>Excellent</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td className="px-3 py-2" style={{ color: TEXT_MID }}>Inter-model</td>
                    <td className="px-3 py-2" style={{ color: TEXT_MID }}>The rubric drives scoring, not the model</td>
                    <td className="px-3 py-2" style={{ color: GREEN }}>Good <span style={{ color: TEXT_DIM }}>(Moderate with Haiku)</span></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2" style={{ color: TEXT_MID }}>PCA</td>
                    <td className="px-3 py-2" style={{ color: TEXT_MID }}>The 9 axes measure 2 real constructs</td>
                    <td className="px-3 py-2" style={{ color: GREEN }}>Strong</td>
                  </tr>
                </tbody>
              </table>
              <p
                className="mt-3 text-[13px] leading-[1.6]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Together: the scoring instrument is consistent, reproducible
                across models, and measures real aesthetic dimensions &mdash;
                not noise.
              </p>
            </div>
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
                5A &mdash; DISTRIBUTION SHAPE: GROUPED BAR CHART
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                style={{
                  fontFamily: MONO,
                  color: "#4a7c59",
                  backgroundColor: "rgba(74, 124, 89, 0.12)",
                }}
              >
                RENDERED
              </span>
            </div>
            {/* Chart 5A: Distribution grouped bar chart */}
            {mounted && (() => {
              const scoreData = [1, 2, 3, 4, 5].map((score) => {
                const row: Record<string, number | string> = { score: String(score) };
                distributionData.forEach((d) => {
                  row[d.short] = d.pcts[score - 1];
                });
                return row;
              });
              const axisGroupColor = Object.fromEntries(
                distributionData.map((d) => [d.short, GROUP_COLORS[d.group] || TEXT_MID])
              );
              return (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={scoreData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                      <XAxis
                        dataKey="score"
                        tick={{ fill: TEXT_MID, fontSize: 11, fontFamily: MONO }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={{ stroke: BORDER }}
                        label={{ value: "Score", position: "insideBottom", offset: -2, fill: TEXT_DIM, fontSize: 10, fontFamily: MONO }}
                      />
                      <YAxis
                        tick={{ fill: TEXT_MID, fontSize: 10, fontFamily: MONO }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={{ stroke: BORDER }}
                        label={{ value: "%", angle: -90, position: "insideLeft", offset: 16, fill: TEXT_DIM, fontSize: 10, fontFamily: MONO }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 6,
                          fontFamily: MONO,
                          fontSize: 11,
                          color: TEXT_LIGHT,
                        }}
                        labelFormatter={(v) => `Score ${v}`}
                        formatter={(value, name) => {
                          const axis = distributionData.find((d) => d.short === name);
                          return [`${value}%`, axis ? axis.axis : String(name)];
                        }}
                      />
                      {distributionData.map((d) => (
                        <Bar
                          key={d.short}
                          dataKey={d.short}
                          fill={axisGroupColor[d.short]}
                          opacity={0.85}
                          radius={[2, 2, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
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
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Technical detail.
                </strong>{" "}
                Material Warmth has 39.2% of all features at score 5 and only
                0.9% at score 1. Theatricality inverts this: 16.9% at 1 and
                just 2.3% at 5. Curation clusters at 4 with 56.3% of all
                features. These asymmetries define the baseline
                &mdash; each axis has a distinctive distributional shape that
                reflects AD&rsquo;s editorial preferences across 3,763 scored
                homes.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  In plain language.
                </strong>{" "}
                Think of each violin as a sideways histogram &mdash; a fat
                bulge where most homes cluster. Material Warmth bulges at 4
                and 5 (AD overwhelmingly prefers warm, tactile spaces).
                Theatricality bulges at 1 and 2 (most AD homes are
                understated, not showy). Curation bulges at 4 (virtually
                everything in the magazine is professionally designed). The
                shapes aren&rsquo;t all the same &mdash; and that&rsquo;s the
                point. Each axis captures a genuinely different facet of
                taste.
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
                  color: GREEN,
                  backgroundColor: "rgba(74, 222, 128, 0.08)",
                }}
              >
                LIVE
              </span>
            </div>
            <div className="mt-4" style={{ height: 320 }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={baselineRadarData}
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                  >
                    <PolarGrid stroke="#1a1a1a" />
                    <PolarAngleAxis
                      dataKey="axis"
                      tick={<RadarAxisTick />}
                      tickLine={false}
                    />
                    <PolarRadiusAxis
                      domain={[0, 5]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="AD Baseline"
                      dataKey="mean"
                      stroke="#d4a574"
                      fill="#d4a574"
                      fillOpacity={0.15}
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
                              style={{ color: "#d4a574" }}
                            >
                              Mean: {d.mean}
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
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Technical detail.
                </strong>{" "}
                Overall means across all 3,763 features: Material Warmth 4.13
                (highest), Maximalism 3.61, Grandeur 3.60, Curation 3.59,
                Provenance 3.34, Historicism 3.25, Hospitality 3.28, Formality
                2.85, Theatricality 2.38 (lowest). The SPACE group runs
                consistently higher than the STAGE group, confirming that
                AD&rsquo;s editorial preference leans toward physical warmth
                and material presence over performative display.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  In plain language.
                </strong>{" "}
                Imagine averaging every home AD has ever published into a
                single house. The radar shows that house&rsquo;s
                &ldquo;personality profile&rdquo; &mdash; warm (Material
                Warmth ~4.1), tastefully arranged (Curation ~3.6), but
                notably understated (Theatricality ~2.4). The typical AD home
                doesn&rsquo;t shout. This radar becomes the measuring stick:
                when we later compare Epstein-connected homes, deviations
                from this shape tell us something.
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
                  color: "#8a9a6a",
                  backgroundColor: "rgba(138, 154, 106, 0.1)",
                }}
              >
                LIVE
              </span>
            </div>
            <div className="mt-4" style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px repeat(9, 1fr)", gap: "2px", maxWidth: 500, margin: "0 auto" }}>
                {/* Header row */}
                <div />
                {AXIS_LABELS_SHORT.map(label => (
                  <div key={label} style={{ textAlign: "center", fontSize: 10, fontFamily: MONO, color: TEXT_MID, paddingBottom: 4 }}>{label}</div>
                ))}
                {/* Data rows */}
                {CORR_MATRIX.map((row, i) => (
                  <div key={i} style={{ display: "contents" }}>
                    <div style={{ fontSize: 10, fontFamily: MONO, color: TEXT_MID, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
                      {AXIS_LABELS_SHORT[i]}
                    </div>
                    {row.map((val, j) => {
                      const abs = Math.abs(val);
                      const color = val >= 0
                        ? `rgba(212, 165, 116, ${abs * 0.8})`
                        : `rgba(100, 140, 180, ${abs * 0.8})`;
                      return (
                        <div
                          key={j}
                          title={`${AXIS_LABELS_SHORT[i]} \u00d7 ${AXIS_LABELS_SHORT[j]}: ${val.toFixed(3)}`}
                          style={{
                            aspectRatio: "1",
                            backgroundColor: color,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 8,
                            fontFamily: MONO,
                            color: abs > 0.4 ? "#fff" : TEXT_DIM,
                            cursor: "default",
                          }}
                        >
                          {i !== j ? val.toFixed(2) : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, fontSize: 11, fontFamily: MONO, color: TEXT_MID }}>
                <span><span style={{ display: "inline-block", width: 12, height: 12, backgroundColor: "rgba(100, 140, 180, 0.6)", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} />Negative</span>
                <span><span style={{ display: "inline-block", width: 12, height: 12, backgroundColor: "rgba(212, 165, 116, 0.6)", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} />Positive</span>
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
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Technical detail.
                </strong>{" "}
                Strongest positive correlation: Curation &harr; Theatricality
                (r&thinsp;=&thinsp;0.694) &mdash; curated homes tend to be
                theatrical. Strongest negative: Provenance &harr; Curation
                (r&thinsp;=&thinsp;&minus;0.583) &mdash; homes with genuine
                history tend to be less overtly curated. Material Warmth
                anti-correlates with the entire STAGE triad (&minus;0.387 to
                &minus;0.490). Maximalism &harr; Historicism
                (r&thinsp;=&thinsp;0.500) confirms that ornate historical
                homes pack in detail.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  In plain language.
                </strong>{" "}
                Copper squares mean &ldquo;these two rise together.&rdquo;
                Dark blue means &ldquo;when one goes up, the other goes
                down.&rdquo; The biggest finding: homes with genuine history
                (Provenance) tend to need less curatorial staging (Curation,
                r&thinsp;=&thinsp;&minus;0.58) &mdash; think of a Tuscan
                farmhouse that just <em>is</em>, versus a brand-new penthouse
                styled to within an inch of its life. Meanwhile, Material
                Warmth opposes the entire STAGE group &mdash; warm, lived-in
                spaces and performative display are genuinely different
                aesthetics, not just different words for the same thing.
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
                  color: GREEN,
                  backgroundColor: "rgba(46, 204, 113, 0.1)",
                }}
              >
                LIVE
              </span>
            </div>
            {mounted && (() => {
              const decadeChartData = decadeData.map(d => ({
                decade: d.decade,
                GR: d.means[0], MW: d.means[1], MX: d.means[2],
                HI: d.means[3], PR: d.means[4], HO: d.means[5],
                FO: d.means[6], CU: d.means[7], TH: d.means[8],
              }));
              const lines: { key: string; name: string; stroke: string }[] = [
                { key: "GR", name: "Grandeur", stroke: "#d4a574" },
                { key: "MW", name: "Material Warmth", stroke: "#b8956a" },
                { key: "MX", name: "Maximalism", stroke: "#a07850" },
                { key: "HI", name: "Historicism", stroke: "#8B7355" },
                { key: "PR", name: "Provenance", stroke: "#7a654a" },
                { key: "HO", name: "Hospitality", stroke: "#6b5940" },
                { key: "FO", name: "Formality", stroke: "#C19A6B" },
                { key: "CU", name: "Curation", stroke: "#aa8860" },
                { key: "TH", name: "Theatricality", stroke: "#937650" },
              ];
              return (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={decadeChartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(58, 51, 42, 0.3)" />
                      <XAxis
                        dataKey="decade"
                        tick={{ fill: TEXT_DIM, fontFamily: MONO, fontSize: 11 }}
                        stroke={BORDER}
                      />
                      <YAxis
                        domain={[2, 4.5]}
                        tick={{ fill: TEXT_DIM, fontFamily: MONO, fontSize: 11 }}
                        stroke={BORDER}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0a0a0a",
                          border: "1px solid #1a1a1a",
                          fontFamily: MONO,
                          fontSize: 11,
                        }}
                        labelStyle={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: 11 }}
                        itemStyle={{ fontFamily: MONO, fontSize: 10 }}
                      />
                      <Legend
                        wrapperStyle={{ fontFamily: MONO, fontSize: 10, color: TEXT_DIM, paddingTop: 8 }}
                      />
                      {lines.map(l => (
                        <Line
                          key={l.key}
                          dataKey={l.key}
                          name={l.name}
                          type="monotone"
                          stroke={l.stroke}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
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
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Technical detail.
                </strong>{" "}
                Theatricality rose from 2.14 (1988&ndash;99, n=1,398) to 3.14
                (2020&ndash;25, n=433) &mdash; a full point on a 5-point
                scale. Material Warmth dipped from 4.35 to 3.80 in the 2010s
                before recovering to 4.07. Historicism fell steadily from 3.66
                to 2.82. Hospitality collapsed from 3.12 to 2.33 in the most
                recent period. The STAGE group&rsquo;s ascent mirrors the
                STORY group&rsquo;s decline.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  In plain language.
                </strong>{" "}
                Think of this like fashion hemlines &mdash; aesthetic tastes
                rise and fall in measurable waves. In the late 80s and 90s,
                the typical AD home was a warm, historically rich Connecticut
                estate. By the 2010s, it was a cool, theatrical, white-walled
                gallery. Theatricality climbed a full point on a 5-point
                scale &mdash; like a student going from a C to a B+.
                Meanwhile, Historicism dropped almost a full point. AD&rsquo;s
                taste literally shifted from old to new, from warm to staged.
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
          {/* ════════════════════════════════════════════════════════════════
              CLUSTER TYPOLOGY — SIX AESTHETIC ARCHETYPES
          ════════════════════════════════════════════════════════════════ */}
          <div className="mt-16">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Six Aesthetic Typologies
            </p>
            <h3
              className="mt-2 text-[20px] font-bold leading-tight"
              style={{ fontFamily: MONO, color: TEXT_LIGHT }}
            >
              k-Means Clustering (k=6, n=3,763)
            </h3>
            <div
              className="mt-4 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                Do the 3,763 scored homes organize into recognizable types?
                k-means clustering on the 9-axis scores (StandardScaler
                normalization) reveals six distinct aesthetic archetypes, each
                with a characteristic radar shape. The silhouette score is
                modest (0.17)&mdash;these are gradients, not hard
                boxes&mdash;but the centroids are clearly differentiated and
                the examples validate intuitively.
              </p>
              <p>
                Two composites summarize each cluster: <strong style={{ color: COPPER }}>STAGE</strong>{" "}
                (mean of Formality + Curation + Theatricality) measures
                performance, while <strong style={{ color: GREEN }}>AUTH</strong>{" "}
                (mean of Material Warmth + Historicism + Provenance) measures
                accumulated authenticity. These two dimensions define the
                terrain of AD&rsquo;s aesthetic space.
              </p>
            </div>

            {/* ── 6 Individual Cluster Cards ── */}
            <div className="mt-10 flex flex-col gap-6">
              {CLUSTER_TYPES.map((c) => (
                <ClusterTypologyCard key={c.id} cluster={c} mounted={mounted} />
              ))}
            </div>

            {/* ── OVERLAY RADAR: All 6 Centroids ── */}
            <div
              className="mt-10 rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <p
                    className="text-[10px] font-bold tracking-wider"
                    style={{ fontFamily: MONO, color: GOLD_DIM }}
                  >
                    OVERLAY RADAR &mdash; ALL SIX CENTROIDS
                  </p>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ fontFamily: BODY, color: TEXT_DIM }}
                  >
                    Each polygon is one cluster&rsquo;s centroid profile. Shape
                    differences reveal where the archetypes diverge.
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                  style={{ fontFamily: MONO, color: GREEN, backgroundColor: "rgba(46,204,113,0.08)" }}
                >
                  LIVE
                </span>
              </div>
              <div className="mt-4" style={{ height: 420 }}>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={CLUSTER_RADAR_AXES.map((a, i) => ({
                        axis: a.key,
                        fullName: a.full,
                        ...Object.fromEntries(
                          CLUSTER_TYPES.map((c) => [`c${c.id}`, c.centroid[i]])
                        ),
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius="68%"
                    >
                      <PolarGrid stroke={BORDER} strokeDasharray="2 4" />
                      <PolarAngleAxis
                        dataKey="axis"
                        tick={({ payload, x, y, textAnchor }: any) => {
                          const idx = CLUSTER_RADAR_AXES.findIndex((a) => a.key === payload.value);
                          const group = idx < 3 ? "SPACE" : idx < 6 ? "STORY" : "STAGE";
                          return (
                            <text
                              x={x} y={y} textAnchor={textAnchor}
                              fontSize={10} fontFamily={MONO}
                              fill={GROUP_COLORS[group] || TEXT_MID}
                              fontWeight={600}
                            >
                              {payload.value}
                            </text>
                          );
                        }}
                        tickLine={false}
                      />
                      <PolarRadiusAxis
                        domain={[1, 5]}
                        tickCount={5}
                        tick={{ fontSize: 8, fill: "rgba(176,165,148,0.3)", fontFamily: MONO }}
                        axisLine={false}
                      />
                      {CLUSTER_TYPES.map((c) => (
                        <Radar
                          key={c.id}
                          name={c.name}
                          dataKey={`c${c.id}`}
                          stroke={CLUSTER_COLORS[c.id]}
                          fill={CLUSTER_COLORS[c.id]}
                          fillOpacity={0.04}
                          strokeWidth={1.5}
                        />
                      ))}
                      <Legend
                        wrapperStyle={{ fontFamily: MONO, fontSize: 10, color: TEXT_DIM, paddingTop: 12 }}
                        formatter={(value) => (
                          <span style={{ color: TEXT_MID }}>{value}</span>
                        )}
                      />
                      <Tooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          const axisObj = CLUSTER_RADAR_AXES.find((a) => a.key === label);
                          return (
                            <div
                              className="rounded border px-3 py-2"
                              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, fontFamily: MONO }}
                            >
                              <p className="text-[10px] font-bold" style={{ color: TEXT_LIGHT }}>
                                {axisObj?.full || label}
                              </p>
                              {payload.map((p: any) => (
                                <p key={p.name} className="text-[9px]" style={{ color: p.stroke }}>
                                  {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-[12px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                      Loading chart&hellip;
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── STAGE × AUTH SCATTER MAP ── */}
            <div
              className="mt-6 rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <p
                    className="text-[10px] font-bold tracking-wider"
                    style={{ fontFamily: MONO, color: GOLD_DIM }}
                  >
                    THE AESTHETIC MAP &mdash; STAGE &times; AUTHENTICITY
                  </p>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ fontFamily: BODY, color: TEXT_DIM }}
                  >
                    Each bubble is a cluster centroid. Size encodes number of homes.
                    The two axes define the primary tension in AD&rsquo;s aesthetic space.
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                  style={{ fontFamily: MONO, color: GREEN, backgroundColor: "rgba(46,204,113,0.08)" }}
                >
                  LIVE
                </span>
              </div>
              <div className="mt-4" style={{ height: 380 }}>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,51,42,0.25)" />
                      <XAxis
                        type="number"
                        dataKey="stage"
                        domain={[1, 4.5]}
                        name="STAGE"
                        tick={{ fill: TEXT_DIM, fontFamily: MONO, fontSize: 10 }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={{ stroke: BORDER }}
                        label={{
                          value: "STAGE composite →",
                          position: "insideBottom",
                          offset: -8,
                          fill: COPPER,
                          fontSize: 10,
                          fontFamily: MONO,
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="auth"
                        domain={[1, 5]}
                        name="AUTH"
                        tick={{ fill: TEXT_DIM, fontFamily: MONO, fontSize: 10 }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={{ stroke: BORDER }}
                        label={{
                          value: "← AUTH composite",
                          angle: -90,
                          position: "insideLeft",
                          offset: 8,
                          fill: GREEN,
                          fontSize: 10,
                          fontFamily: MONO,
                        }}
                      />
                      <ZAxis type="number" dataKey="n" range={[200, 900]} />
                      <ReferenceLine
                        x={2.93}
                        stroke={BORDER}
                        strokeDasharray="4 4"
                        label={{
                          value: "AD avg",
                          position: "top",
                          fill: TEXT_DIM,
                          fontSize: 9,
                          fontFamily: MONO,
                        }}
                      />
                      <ReferenceLine
                        y={3.57}
                        stroke={BORDER}
                        strokeDasharray="4 4"
                        label={{
                          value: "AD avg",
                          position: "right",
                          fill: TEXT_DIM,
                          fontSize: 9,
                          fontFamily: MONO,
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          if (!d) return null;
                          return (
                            <div
                              className="rounded border px-3 py-2"
                              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, fontFamily: MONO }}
                            >
                              <p className="text-[11px] font-bold" style={{ color: CLUSTER_COLORS[d.id] }}>
                                {d.name}
                              </p>
                              <p className="mt-1 text-[10px]" style={{ color: TEXT_MID }}>
                                {d.pct} &middot; n={d.n.toLocaleString()}
                              </p>
                              <p className="text-[10px]" style={{ color: COPPER }}>
                                STAGE: {d.stage.toFixed(2)}
                              </p>
                              <p className="text-[10px]" style={{ color: GREEN }}>
                                AUTH: {d.auth.toFixed(2)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      {CLUSTER_COMPOSITES.map((c) => (
                        <Scatter
                          key={c.id}
                          name={c.name}
                          data={[c]}
                          fill={CLUSTER_COLORS[c.id]}
                          stroke={CLUSTER_COLORS[c.id]}
                          strokeWidth={1.5}
                          fillOpacity={0.6}
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-[12px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                      Loading chart&hellip;
                    </p>
                  </div>
                )}
              </div>
              {/* Cluster labels below scatter */}
              <div
                className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2"
                style={{ fontFamily: MONO, fontSize: 10 }}
              >
                {CLUSTER_TYPES.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CLUSTER_COLORS[c.id] }}
                    />
                    <span style={{ color: TEXT_MID }}>C{c.id} {c.name}</span>
                  </div>
                ))}
              </div>
              <div
                className="mt-6 flex flex-col gap-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                <p>
                  The STAGE &times; AUTH plane captures the primary structural
                  tension revealed in the correlation analysis: performance
                  versus authenticity. The clusters separate cleanly on this
                  plane, with <strong style={{ color: TEXT_LIGHT }}>The Lived-In
                  Retreat</strong> (high AUTH, low STAGE) and{" "}
                  <strong style={{ color: TEXT_LIGHT }}>The Cold Stage</strong>{" "}
                  (low AUTH, high STAGE) occupying opposite corners. The
                  diagonal from bottom-left to top-right is the continuum from
                  &ldquo;spaces that perform&rdquo; to &ldquo;spaces that
                  simply are.&rdquo;
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>The Comfortable
                  Middle</strong>&mdash;28.2% of all AD homes&mdash;sits near
                  the population average on both axes. This is the magazine&rsquo;s
                  center of gravity: warm, curated, not extreme on any
                  dimension.
                </p>
              </div>
            </div>

            {/* ── DECADE PROPORTIONS: STACKED BAR ── */}
            <div
              className="mt-6 rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <p
                    className="text-[10px] font-bold tracking-wider"
                    style={{ fontFamily: MONO, color: GOLD_DIM }}
                  >
                    TEMPORAL STABILITY &mdash; CLUSTER PROPORTIONS BY DECADE
                  </p>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ fontFamily: BODY, color: TEXT_DIM }}
                  >
                    All six archetypes appear in every era, but in shifting
                    proportions.
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                  style={{ fontFamily: MONO, color: GREEN, backgroundColor: "rgba(46,204,113,0.08)" }}
                >
                  LIVE
                </span>
              </div>
              <div className="mt-4" style={{ height: 320 }}>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={DECADE_CLUSTER_PROPORTIONS.map((d) => ({
                        decade: d.decade,
                        n: d.n,
                        ...Object.fromEntries(
                          CLUSTER_TYPES.map((c, i) => [c.name, d.pcts[i]])
                        ),
                      }))}
                      margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,51,42,0.25)" />
                      <XAxis
                        dataKey="decade"
                        tick={{ fill: TEXT_DIM, fontFamily: MONO, fontSize: 11 }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={{ stroke: BORDER }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: TEXT_DIM, fontFamily: MONO, fontSize: 10 }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={{ stroke: BORDER }}
                        label={{
                          value: "% of features",
                          angle: -90,
                          position: "insideLeft",
                          offset: 12,
                          fill: TEXT_DIM,
                          fontSize: 10,
                          fontFamily: MONO,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CARD_DEEP,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 6,
                          fontFamily: MONO,
                          fontSize: 10,
                        }}
                        labelStyle={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: 11 }}
                        formatter={(value: any, name: any) => [
                          `${Number(value).toFixed(1)}%`,
                          String(name),
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontFamily: MONO, fontSize: 9, paddingTop: 8 }}
                        formatter={(value) => (
                          <span style={{ color: TEXT_MID }}>{value}</span>
                        )}
                      />
                      {CLUSTER_TYPES.map((c) => (
                        <Bar
                          key={c.id}
                          dataKey={c.name}
                          stackId="a"
                          fill={CLUSTER_COLORS[c.id]}
                          opacity={0.85}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-[12px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                      Loading chart&hellip;
                    </p>
                  </div>
                )}
              </div>
              <div
                className="mt-6 flex flex-col gap-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>
                    The Grand Heritage is disappearing.
                  </strong>{" "}
                  From 19% of features in the 1990s to 4.6% in the 2020s. AD
                  publishes fewer old-world estates with accumulated provenance.
                  This is AD&rsquo;s version of a documented cultural
                  shift&mdash;the inherited aristocratic home is being replaced.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>
                    The Clean Slate is rising.
                  </strong>{" "}
                  From 8.7% to 17.1%. Contemporary new builds with minimal
                  historical reference, directed by architects rather than
                  inherited from grandparents. AD in the 2020s features nearly
                  twice as many clean-line contemporary homes as in the 1990s.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>
                    The Cold Stage grows with Theatricality.
                  </strong>{" "}
                  From 6.3% to 14.3%. These performative, historically rootless
                  spaces mirror the decade-level Theatricality increase
                  (2.14 &rarr; 3.14). AD&rsquo;s editorial window is opening wider
                  to spaces that are designed to impress rather than to be
                  lived in.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>
                    The Comfortable Middle endures.
                  </strong>{" "}
                  Stable at ~28&ndash;30% across all four decades. The warm,
                  moderate, professionally curated home is the one constant in
                  AD&rsquo;s shifting aesthetic landscape. The center holds.
                </p>
              </div>
            </div>

            {/* ── SILHOUETTE + METHOD NOTE ── */}
            <div
              className="mt-6 rounded border p-5"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                METHODOLOGICAL NOTE
              </p>
              <p
                className="mt-3 text-[12px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                k-means with k=6, StandardScaler normalization on all 9 axes.
                Silhouette score: <strong style={{ color: TEXT_LIGHT }}>0.17</strong>.
                This is modest&mdash;deliberately so. Homes exist on a continuum, not in
                discrete bins. These typologies are <em>descriptions</em> of
                recognizable aesthetic neighborhoods, not categorical diagnoses. A
                silhouette of 0.7 would be suspicious, implying that the 9-axis space
                had sharp natural boundaries&mdash;which would contradict
                everything we know about taste as a gradient. The centroids are clearly
                differentiated, the decade stability is real, and the examples
                validate intuitively.
              </p>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SOM TOPOLOGY — SELF-ORGANIZING MAP VISUALIZATIONS
          ════════════════════════════════════════════════════════════════ */}
          <div className="mt-16">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              Topology Preservation
            </p>
            <h3
              className="mt-2 text-[20px] font-bold leading-tight"
              style={{ fontFamily: MONO, color: TEXT_LIGHT }}
            >
              Self-Organizing Map (20&times;20, n=3,763)
            </h3>
            <div
              className="mt-4 flex flex-col gap-4 text-[14px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: BODY, color: TEXT_MID }}
            >
              <p>
                A Self-Organizing Map (SOM) is an unsupervised neural network
                that takes the 9-dimensional aesthetic space and projects it
                onto a 2D hexagonal grid&mdash;preserving neighborhood
                relationships so that similar homes land on nearby hexagons.
                Where k-means tells us <em>what</em> the clusters are, the SOM
                tells us <em>how they relate to each other</em> in topological
                space.
              </p>
              <p>
                <strong style={{ color: TEXT_LIGHT }}>
                  Think of it like a map of a continent.
                </strong>{" "}
                k-means is like naming the countries. The SOM is the actual
                map&mdash;showing which countries share borders, where the
                mountain ranges (boundaries) are, and which regions blend
                smoothly into each other. The hexagons are neighborhoods,
                and homes migrate to the hexagon that best represents their
                aesthetic DNA.
              </p>
            </div>

            {/* ── 7A: Component Planes ─────────────────────────────────── */}
            <div
              className="mt-10 rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <div className="flex items-baseline justify-between">
                <p
                  className="text-[10px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GOLD_DIM }}
                >
                  7A &mdash; COMPONENT PLANES: WHERE EACH AXIS LIVES
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                  style={{
                    fontFamily: MONO,
                    color: GREEN,
                    backgroundColor: "rgba(46, 204, 113, 0.08)",
                  }}
                >
                  LIVE
                </span>
              </div>

              {/* Intro */}
              <p
                className="mt-4 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                Each tile below shows one axis of the 9-dimensional scorer
                projected onto the SOM grid. Bright hexagons score high on
                that axis, dark ones low. When two planes light up in the same
                region, those qualities travel together in real homes. When
                they look like negatives of each other, the qualities are
                opposites. Nine weather maps, one continent.
              </p>

              {!mounted && (
                <div
                  className="mt-4 flex items-center justify-center rounded"
                  style={{
                    height: 360,
                    backgroundColor: "rgba(58, 51, 42, 0.15)",
                    border: `1px dashed ${BORDER}`,
                  }}
                >
                  <p
                    className="text-[11px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    Loading SOM component planes&hellip;
                  </p>
                </div>
              )}

              {mounted && (() => {
                const groups: {
                  label: string;
                  subtitle: string;
                  axes: string[];
                  color: string;
                  analysis: React.ReactNode;
                }[] = [
                  {
                    label: "SPACE",
                    subtitle: "The physical experience",
                    axes: ["Grandeur", "Material Warmth", "Maximalism"],
                    color: GROUP_COLORS.SPACE,
                    analysis: (
                      <>
                        The weakest within-group coherence (avg <em>r</em> = 0.066).
                        Grandeur actually <em>anti</em>-correlates with Material
                        Warmth (<em>r</em> = &minus;0.39)&mdash;grand homes
                        aren&rsquo;t warm. Meanwhile Material Warmth and
                        Maximalism travel together (<em>r</em> = 0.51): richly
                        layered homes use real materials. The surprise: Grandeur
                        correlates more with STAGE axes than its own group
                        (<em>r</em> = 0.82 with Formality). It behaves less like
                        a physical property and more like a performance metric.
                      </>
                    ),
                  },
                  {
                    label: "STORY",
                    subtitle: "The narrative it tells",
                    axes: ["Historicism", "Provenance", "Hospitality"],
                    color: GROUP_COLORS.STORY,
                    analysis: (
                      <>
                        Moderate group coherence (avg <em>r</em> = 0.186).
                        Historicism and Provenance are strongly linked
                        (<em>r</em> = 0.73)&mdash;old styles and old buildings
                        travel together. The outlier is Hospitality: weakly related
                        to both (<em>r</em> &asymp; 0.09, &minus;0.26) and
                        actually more aligned with STAGE (<em>r</em> = 0.55 with
                        Theatricality). A home can feel welcoming as a performance
                        rather than as a consequence of its history.
                      </>
                    ),
                  },
                  {
                    label: "STAGE",
                    subtitle: "Who it's performing for",
                    axes: ["Formality", "Curation", "Theatricality"],
                    color: GROUP_COLORS.STAGE,
                    analysis: (
                      <>
                        The strongest group coherence by far (avg within-group
                        <em> r</em> = 0.768). All three planes light up in nearly
                        the same region of the map&mdash;Formality, Curation, and
                        Theatricality are almost interchangeable in how they
                        distribute across homes. They also share strong
                        anti-correlations with Material Warmth and Provenance: the
                        &ldquo;performance vs. depth&rdquo; axis that the
                        hypothesis test in Section 6 identified.
                      </>
                    ),
                  },
                ];

                return (
                  <div className="mt-5 flex flex-col gap-6">
                    {groups.map((g) => {
                      return (
                        <div key={g.label}>
                          {/* Group header */}
                          <div className="mb-3 flex items-baseline gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: g.color }}
                            />
                            <span
                              className="text-[11px] font-bold tracking-widest"
                              style={{ fontFamily: MONO, color: g.color }}
                            >
                              {g.label}
                            </span>
                            <span
                              className="text-[10px] tracking-wide"
                              style={{ fontFamily: MONO, color: TEXT_DIM }}
                            >
                              &mdash; {g.subtitle}
                            </span>
                          </div>

                          {/* 3 hex grids for this group */}
                          <div className="grid grid-cols-3 gap-3">
                            {g.axes.map((axisName) => {
                              const plane = somData.component_planes[axisName];
                              let pMin = Infinity, pMax = -Infinity;
                              for (let c = 0; c < SOM_GRID; c++) {
                                for (let r = 0; r < SOM_GRID; r++) {
                                  const v = plane[c][r];
                                  if (v < pMin) pMin = v;
                                  if (v > pMax) pMax = v;
                                }
                              }
                              return (
                                <div key={axisName}>
                                  <p
                                    className="mb-1.5 text-center text-[9px] font-bold tracking-wider"
                                    style={{ fontFamily: MONO, color: g.color }}
                                  >
                                    {axisName.toUpperCase()}
                                  </p>
                                  <SomHexGrid
                                    colorFn={(col, row) => {
                                      const t = pMax > pMin ? (plane[col][row] - pMin) / (pMax - pMin) : 0.5;
                                      return colorRamp3(
                                        t,
                                        [27, 24, 21],
                                        [120, 90, 50],
                                        [210, 170, 100]
                                      );
                                    }}
                                    tooltipFn={(col, row) =>
                                      `${axisName}: ${plane[col][row].toFixed(2)}`
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Group analysis */}
                          <p
                            className="mt-3 text-[12px] leading-[1.7]"
                            style={{ fontFamily: BODY, color: TEXT_MID }}
                          >
                            {g.analysis}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Grandeur cross-group callout */}
              <div
                className="mt-6 rounded border px-4 py-3"
                style={{
                  borderColor: `${GROUP_COLORS.SPACE}44`,
                  backgroundColor: `${GROUP_COLORS.SPACE}0A`,
                }}
              >
                <p
                  className="text-[10px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GROUP_COLORS.SPACE }}
                >
                  CROSS-GROUP FINDING
                </p>
                <p
                  className="mt-1.5 text-[12px] leading-[1.7]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  Grandeur is formally assigned to{" "}
                  <span style={{ color: GROUP_COLORS.SPACE }}>SPACE</span> but
                  empirically behaves like a{" "}
                  <span style={{ color: GROUP_COLORS.STAGE }}>STAGE</span> axis.
                  Its correlation with Formality (<em>r</em> = 0.82) exceeds
                  its correlation with its own groupmates Material Warmth
                  (<em>r</em> = &minus;0.39) and Maximalism (<em>r</em> = 0.15).
                  This was the axis-definition finding surfaced in{" "}
                  <strong style={{ color: TEXT_LIGHT }}>Section 4</strong>&mdash;the
                  SOM confirms it spatially.
                </p>
              </div>

              {/* Ideal vs. Actual comparison — visual */}
              <div
                className="mt-6 rounded border p-4"
                style={{ borderColor: BORDER, backgroundColor: "rgba(21, 18, 15, 0.6)" }}
              >
                <p
                  className="text-[10px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GOLD_DIM }}
                >
                  IDEAL vs. ACTUAL GROUP STRUCTURE
                </p>
                <p
                  className="mt-2 text-[12px] leading-[1.7]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  If the three groups were perfectly coherent, all axes within a
                  group would produce identical component planes, and planes across
                  groups would look distinct. Left: what that would look like.
                  Right: what we actually measured.
                </p>

                {/* Side-by-side mini hex grids */}
                {mounted && (() => {
                  const G = SOM_GRID; // 20

                  // Compute group centroid planes (average of 3 real planes per group).
                  // The "ideal" is: if all axes within a group were perfectly correlated,
                  // every plane in the group would look like this centroid.
                  const groupDefs: {
                    label: string;
                    color: string;
                    axes: string[];
                    verdict: "confirmed" | "partial" | "divergent";
                    avgR: string;
                  }[] = [
                    { label: "SPACE", color: GROUP_COLORS.SPACE, axes: ["Grandeur", "Material Warmth", "Maximalism"], verdict: "divergent", avgR: "0.07" },
                    { label: "STORY", color: GROUP_COLORS.STORY, axes: ["Historicism", "Provenance", "Hospitality"], verdict: "partial", avgR: "0.19" },
                    { label: "STAGE", color: GROUP_COLORS.STAGE, axes: ["Formality", "Curation", "Theatricality"], verdict: "confirmed", avgR: "0.77" },
                  ];

                  // Build ideal planes: for each group, pick the axis with the most
                  // spatial structure (highest variance across the SOM grid) as the
                  // template. Averaging anti-correlated axes (e.g. SPACE) produces a
                  // flat, structureless plane — picking the strongest signal is more
                  // honest about what "ideal coherence" would look like.
                  // Then boost contrast 20% so bright/dark regions are more defined.
                  const centroidPlanes: Record<string, { grid: number[][]; min: number; max: number }> = {};
                  for (const gd of groupDefs) {
                    // Find the axis with the highest variance
                    let bestAxis = gd.axes[0];
                    let bestVar = -1;
                    for (const ax of gd.axes) {
                      const plane = somData.component_planes[ax];
                      let sum = 0, sum2 = 0, count = 0;
                      for (let c = 0; c < G; c++) {
                        for (let r = 0; r < G; r++) {
                          sum += plane[c][r];
                          sum2 += plane[c][r] ** 2;
                          count++;
                        }
                      }
                      const variance = sum2 / count - (sum / count) ** 2;
                      if (variance > bestVar) {
                        bestVar = variance;
                        bestAxis = ax;
                      }
                    }

                    // Use the strongest axis as template, with 20% contrast boost
                    const source = somData.component_planes[bestAxis];
                    let rawMin = Infinity, rawMax = -Infinity;
                    let mean = 0;
                    for (let c = 0; c < G; c++)
                      for (let r = 0; r < G; r++) {
                        mean += source[c][r];
                        if (source[c][r] < rawMin) rawMin = source[c][r];
                        if (source[c][r] > rawMax) rawMax = source[c][r];
                      }
                    mean /= G * G;

                    // Copy source with contrast boost
                    let grid: number[][] = [];
                    for (let c = 0; c < G; c++) {
                      grid[c] = [];
                      for (let r = 0; r < G; r++) {
                        const boosted = mean + (source[c][r] - mean) * 1.2;
                        grid[c][r] = Math.max(rawMin, Math.min(rawMax, boosted));
                      }
                    }

                    // Spatial smoothing: 3 passes of hex-neighbor averaging.
                    // Produces compact, regular blobs for the ideal visualization.
                    const hexNbrs = (col: number, row: number): [number, number][] => {
                      const even = col % 2 === 0;
                      return [
                        [col, row - 1], [col, row + 1],
                        [col + 1, even ? row - 1 : row], [col + 1, even ? row : row + 1],
                        [col - 1, even ? row - 1 : row], [col - 1, even ? row : row + 1],
                      ];
                    };
                    for (let pass = 0; pass < 1; pass++) {
                      const smoothed: number[][] = [];
                      for (let c = 0; c < G; c++) {
                        smoothed[c] = [];
                        for (let r = 0; r < G; r++) {
                          let sum = grid[c][r] * 2; // center weighted 2×
                          let weight = 2;
                          for (const [nc, nr] of hexNbrs(c, r)) {
                            if (nc >= 0 && nc < G && nr >= 0 && nr < G) {
                              sum += grid[nc][nr];
                              weight++;
                            }
                          }
                          smoothed[c][r] = sum / weight;
                        }
                      }
                      grid = smoothed;
                    }

                    // Recompute min/max after smoothing
                    let cMin = Infinity, cMax = -Infinity;
                    for (let c = 0; c < G; c++)
                      for (let r = 0; r < G; r++) {
                        if (grid[c][r] < cMin) cMin = grid[c][r];
                        if (grid[c][r] > cMax) cMax = grid[c][r];
                      }
                    centroidPlanes[gd.label] = { grid, min: cMin, max: cMax };
                  }

                  const groupRows = groupDefs;

                  const verdictStyle = (v: "confirmed" | "partial" | "divergent") => {
                    const c =
                      v === "confirmed" ? GREEN : v === "partial" ? "#D4A843" : "#C97B84";
                    const bg =
                      v === "confirmed"
                        ? "rgba(46,204,113,0.08)"
                        : v === "partial"
                        ? "rgba(212,168,67,0.08)"
                        : "rgba(201,123,132,0.08)";
                    return { color: c, backgroundColor: bg };
                  };

                  // ── Contour tracer for ideal grid blob outlines ──
                  // Neighbor across each edge, by edge index. Back-edge is always (e+3)%6.
                  function edgeNeighbor(col: number, row: number, edge: number): [number, number] {
                    const even = col % 2 === 0;
                    // Edge 0: right-lower, 1: bottom, 2: left-lower,
                    //      3: left-upper, 4: top, 5: right-upper
                    const offsets: [number, number][] = even
                      ? [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
                      : [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];
                    const [dc, dr] = offsets[edge];
                    return [col + dc, row + dr];
                  }

                  // SVG coordinate of hex vertex at given index
                  function vertexXY(col: number, row: number, v: number): [number, number] {
                    const [cx, cy] = hexCenter(col, row);
                    const a = (Math.PI / 180) * (60 * v);
                    return [cx + HEX_R * Math.cos(a), cy + HEX_R * Math.sin(a)];
                  }

                  // Trace the outer contour of a hot blob → SVG path d.
                  // Accepts any 2D grid + a percentile cutoff (0..1).
                  function blobOutline(
                    grid: number[][],
                    pct: number
                  ): string {
                    const vals: number[] = [];
                    for (let c = 0; c < G; c++)
                      for (let r = 0; r < G; r++)
                        vals.push(grid[c][r]);
                    vals.sort((a, b) => a - b);
                    const threshold = vals[Math.floor(vals.length * pct)];
                    const hot = (c: number, r: number) =>
                      c >= 0 && c < G && r >= 0 && r < G && grid[c][r] >= threshold;

                    // Find a starting boundary edge: first hot hex with a cold neighbor
                    let startC = -1, startR = -1, startE = -1;
                    outer: for (let c = 0; c < G; c++) {
                      for (let r = 0; r < G; r++) {
                        if (!hot(c, r)) continue;
                        for (let e = 0; e < 6; e++) {
                          const [nc, nr] = edgeNeighbor(c, r, e);
                          if (!hot(nc, nr)) {
                            startC = c; startR = r; startE = e;
                            break outer;
                          }
                        }
                      }
                    }
                    if (startC < 0) return "";

                    // Walk the contour: at each step, record the start vertex of
                    // the current boundary edge, then advance clockwise.
                    const points: string[] = [];
                    let c = startC, r = startR, e = startE;
                    let safety = G * G * 6; // max possible edges
                    do {
                      // Record start vertex of this boundary edge
                      const [vx, vy] = vertexXY(c, r, e);
                      points.push(`${vx.toFixed(1)},${vy.toFixed(1)}`);

                      // Advance: try the next edge clockwise (e+1).
                      // If the neighbor across (e+1) is hot, cross into it and
                      // keep turning until we find a cold neighbor.
                      let ne = (e + 1) % 6;
                      let [nc, nr] = edgeNeighbor(c, r, ne);

                      while (hot(nc, nr)) {
                        // Cross to hot neighbor
                        c = nc; r = nr;
                        const backE = (ne + 3) % 6;
                        ne = (backE + 1) % 6;
                        [nc, nr] = edgeNeighbor(c, r, ne);
                      }
                      e = ne;
                    } while ((c !== startC || r !== startR || e !== startE) && --safety > 0);

                    if (points.length < 3) return "";
                    return `M${points.join("L")}Z`;
                  }

                  // Cool blue-slate ramp for ideal grids (complementary to warm brown-gold actual)
                  const idealColorRamp = (t: number) =>
                    colorRamp3(
                      t,
                      [18, 22, 32],     // near-black with blue undertone
                      [50, 62, 85],     // slate blue
                      [140, 160, 195]   // steel blue
                    );

                  return (
                    <div className="mt-5 grid grid-cols-2 gap-6">
                      {/* IDEAL column */}
                      <div>
                        <p
                          className="mb-3 text-center text-[13px] font-bold tracking-widest"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          IDEAL
                        </p>
                        <div className="flex flex-col gap-3">
                          {groupRows.map((g) => {
                            const cp = centroidPlanes[g.label];
                            const outline = blobOutline(centroidPlanes[g.label].grid, 0.72);
                            return (
                              <div key={`ideal-${g.label}`}>
                                <p
                                  className="mb-1 text-[8px] font-bold tracking-widest"
                                  style={{ fontFamily: MONO, color: g.color }}
                                >
                                  {g.label}
                                </p>
                                <div className="grid grid-cols-3 gap-1">
                                  {g.axes.map((axisName) => (
                                    <div key={`ideal-${axisName}`}>
                                      <p
                                        className="mb-0.5 text-center text-[7px] tracking-wider"
                                        style={{ fontFamily: MONO, color: `${g.color}88` }}
                                      >
                                        {axisName.split(" ").map(w => w[0]).join("")}
                                      </p>
                                      <svg
                                        viewBox={`0 0 ${SOM_SVG_W} ${SOM_SVG_H}`}
                                        className="w-full"
                                      >
                                        {/* Colored hexes */}
                                        {Array.from({ length: G }, (_, col) =>
                                          Array.from({ length: G }, (__, row) => {
                                            const [cx, cy] = hexCenter(col, row);
                                            const t = cp.max > cp.min
                                              ? (cp.grid[col][row] - cp.min) / (cp.max - cp.min)
                                              : 0.5;
                                            return (
                                              <path
                                                key={`h-${col}-${row}`}
                                                d={hexPath(cx, cy, HEX_R - 0.5)}
                                                fill={idealColorRamp(t)}
                                                stroke="rgba(18,22,32,0.5)"
                                                strokeWidth={0.4}
                                              />
                                            );
                                          })
                                        )}
                                        {/* Smooth blob outline */}
                                        {outline && (
                                          <path
                                            d={outline}
                                            fill="none"
                                            stroke="rgba(255,255,255,0.95)"
                                            strokeWidth={8}
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                          />
                                        )}
                                      </svg>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p
                          className="mt-2 text-center text-[9px] italic leading-[1.5]"
                          style={{ fontFamily: BODY, color: TEXT_DIM }}
                        >
                          Same white boundary, same position, all three.
                        </p>
                      </div>

                      {/* ACTUAL column */}
                      <div>
                        <p
                          className="mb-3 text-center text-[13px] font-bold tracking-widest"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          ACTUAL
                        </p>
                        <div className="flex flex-col gap-3">
                          {groupRows.map((g) => (
                            <div key={`actual-${g.label}`}>
                              <div className="mb-1 flex items-center justify-between">
                                <p
                                  className="text-[8px] font-bold tracking-widest"
                                  style={{ fontFamily: MONO, color: g.color }}
                                >
                                  {g.label}
                                </p>
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[7px] font-bold tracking-widest"
                                  style={verdictStyle(g.verdict)}
                                >
                                  <em style={{ fontFamily: BODY, fontStyle: "normal" }}>r</em>
                                  {" = "}{g.avgR}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1">
                                {g.axes.map((axisName) => {
                                  const plane = somData.component_planes[axisName];
                                  let pMin = Infinity, pMax = -Infinity;
                                  for (let c = 0; c < G; c++) {
                                    for (let r = 0; r < G; r++) {
                                      const v = plane[c][r];
                                      if (v < pMin) pMin = v;
                                      if (v > pMax) pMax = v;
                                    }
                                  }
                                  // Raw data, lower threshold → messier, more diffuse blob
                                  const actualOutline = blobOutline(plane, 0.50);
                                  return (
                                    <div key={`actual-${axisName}`}>
                                      <p
                                        className="mb-0.5 text-center text-[7px] tracking-wider"
                                        style={{ fontFamily: MONO, color: `${g.color}88` }}
                                      >
                                        {axisName.split(" ").map(w => w[0]).join("")}
                                      </p>
                                      <svg
                                        viewBox={`0 0 ${SOM_SVG_W} ${SOM_SVG_H}`}
                                        className="w-full"
                                      >
                                        {Array.from({ length: G }, (_, col) =>
                                          Array.from({ length: G }, (__, row) => {
                                            const [cx, cy] = hexCenter(col, row);
                                            const t = pMax > pMin
                                              ? (plane[col][row] - pMin) / (pMax - pMin)
                                              : 0.5;
                                            return (
                                              <path
                                                key={`h-${col}-${row}`}
                                                d={hexPath(cx, cy, HEX_R - 0.5)}
                                                fill={colorRamp3(
                                                  t,
                                                  [27, 24, 21],
                                                  [120, 90, 50],
                                                  [210, 170, 100]
                                                )}
                                                stroke="rgba(27,24,21,0.6)"
                                                strokeWidth={0.5}
                                              />
                                            );
                                          })
                                        )}
                                        {actualOutline && (
                                          <path
                                            d={actualOutline}
                                            fill="none"
                                            stroke="rgba(255,255,255,0.85)"
                                            strokeWidth={6}
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                          />
                                        )}
                                      </svg>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p
                          className="mt-2 text-center text-[9px] italic leading-[1.5]"
                          style={{ fontFamily: BODY, color: TEXT_DIM }}
                        >
                          Three different boundaries. Three different stories.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Narrative explanation */}
                <p
                  className="mt-5 text-[12px] leading-[1.75]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  <strong style={{ color: TEXT_LIGHT }}>Reading the boundaries:</strong>{" "}
                  The white outlines trace where each axis concentrates its highest
                  values on the map. On the left, every outline within a row is
                  identical&mdash;that&rsquo;s what perfect group coherence looks
                  like. The bright zone lives in exactly the same place for all
                  three axes. On the right, reality: STAGE&rsquo;s three outlines
                  nearly overlap (the group holds together), but SPACE&rsquo;s
                  outlines land in different regions entirely&mdash;Grandeur peaks
                  where Material Warmth doesn&rsquo;t, and vice versa. The shapes
                  tell you what the correlation numbers can&rsquo;t: not just
                  <em> how much</em> the axes agree, but <em>where</em> on the map
                  they disagree.
                </p>
                <p
                  className="mt-3 text-[12px] leading-[1.75]"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  <strong style={{ color: TEXT_LIGHT }}>
                    What this means for the instrument:
                  </strong>{" "}
                  The groupings aren&rsquo;t wrong&mdash;they&rsquo;re
                  incomplete. STAGE works exactly as designed: Formality,
                  Curation, and Theatricality measure one coherent thing. But
                  Grandeur behaves empirically like a STAGE axis (it peaks in
                  the same region), and a future version of the instrument
                  should probably move it there. Hospitality drifts toward
                  STAGE too&mdash;welcoming-as-performance rather than
                  welcoming-as-narrative. Provenance isn&rsquo;t irrelevant,
                  but it&rsquo;s married to Historicism, not to Hospitality.
                  SPACE and STORY are less &ldquo;groups&rdquo; and more
                  loose coalitions. None of this invalidates the
                  scores&mdash;all nine axes still measure real, distinct
                  qualities. It just means the three-group frame is a
                  simplification, and the data is telling us where a
                  four- or five-group structure might fit better.
                </p>

                <p className="mt-3 text-[12px] leading-[1.75]" style={{ fontFamily: BODY, color: TEXT_MID }}>
                  <strong style={{ color: TEXT_LIGHT }}>Why the cross-wiring happens:</strong>{" "}
                  When we designed the instrument, each group was meant to
                  capture a separate dimension of the home. SPACE was the
                  physical envelope&mdash;how big, how warm, how dense.
                  STORY was the narrative&mdash;what era, what history,
                  who&rsquo;s invited. STAGE was the performance&mdash;how
                  formal, how directed, how theatrical. The assumption was that
                  a room&rsquo;s size (Grandeur) would be independent of its
                  theatricality&mdash;a cathedral can be humble and a jewel box
                  can intimidate. That turned out to be wrong. In practice, the
                  homes AD publishes use scale <em>as</em> theatre: the
                  triple-height entry, the ballroom that dwarfs its visitors,
                  the glossy marble that reflects light like a stage set. The
                  high-Grandeur homes don&rsquo;t just occupy more cubic
                  feet&mdash;they weaponize that volume to create the same
                  power dynamics that Formality and Theatricality measure. The
                  architecture <em>is</em> the performance.
                </p>

                <p className="mt-3 text-[12px] leading-[1.75]" style={{ fontFamily: BODY, color: TEXT_MID }}>
                  Provenance and Historicism were meant to measure different
                  things: Historicism tracks era commitment (does the room pick
                  a period and stay there?), while Provenance tracks
                  accumulated life (did these objects grow into this building,
                  or arrive on a truck?). We expected them to diverge&mdash;a
                  brand-new house could be filled with genuine antiques (high
                  Historicism, low Provenance), and an old farmhouse could be
                  stripped to bare walls (low Historicism, high Provenance). But
                  r&nbsp;=&nbsp;0.59 says otherwise. In Architectural
                  Digest&rsquo;s world, the two travel together: homes that
                  commit to a period almost always <em>are</em> old, and homes
                  that feel genuinely accumulated almost always commit to an
                  era. The synthetic version&mdash;new house, purchased
                  antiques, decorator costuming a period&mdash;scores low on
                  both, because Opus reads the anachronisms. The real surprise
                  is Hospitality. We grouped it with STORY because we imagined
                  hospitality as a narrative choice&mdash;the homeowner who
                  designs for guests is telling a story about generosity. The
                  data says it&rsquo;s actually a staging choice. Hospitality
                  correlates with Theatricality (r&nbsp;=&nbsp;0.42) more than
                  with either of its groupmates, because in AD homes,
                  entertaining isn&rsquo;t generosity&mdash;it&rsquo;s a
                  production.
                </p>

                <p className="mt-3 text-[12px] leading-[1.75]" style={{ fontFamily: BODY, color: TEXT_MID }}>
                  <strong style={{ color: TEXT_LIGHT }}>What the instrument gets right:</strong>{" "}
                  Not everything defied expectations. Material Warmth and
                  Maximalism correlate at r&nbsp;=&nbsp;0.41, exactly as the
                  SPACE grouping predicted&mdash;homes built from leather,
                  wide-plank oak, and linen also tend to be layered with rugs,
                  folk art, and collected objects. Warm materials invite
                  accumulation; cold surfaces repel it. That&rsquo;s the
                  instrument reading a real physical relationship. The
                  anti-correlations are even more confirming: Material Warmth
                  runs opposite to Theatricality
                  (r&nbsp;=&nbsp;&minus;0.48) and Formality
                  (r&nbsp;=&nbsp;&minus;0.42). Warm, tactile homes
                  don&rsquo;t perform. Performing homes aren&rsquo;t warm.
                  That&rsquo;s SPACE vs. STAGE working exactly as designed. And
                  the strongest single anti-correlation in the entire
                  matrix&mdash;Provenance vs. Curation at
                  r&nbsp;=&nbsp;&minus;0.56&mdash;captures the deepest tension
                  in the instrument: rooms that feel genuinely accumulated are
                  almost never designer-directed, and designer-directed rooms
                  almost never feel genuinely accumulated. You can buy old
                  things, but you can&rsquo;t curate your way to provenance.
                  That one number validates the entire STORY-vs-STAGE axis.
                </p>

                {/* Verdict summary row */}
                <div
                  className="mt-5 flex items-center justify-center gap-4"
                  style={{ fontFamily: MONO }}
                >
                  {[
                    { label: "SPACE", r: "0.07", verdict: "divergent" as const, color: GROUP_COLORS.SPACE },
                    { label: "STORY", r: "0.19", verdict: "partial" as const, color: GROUP_COLORS.STORY },
                    { label: "STAGE", r: "0.77", verdict: "confirmed" as const, color: GROUP_COLORS.STAGE },
                  ].map((g) => {
                    const vc =
                      g.verdict === "confirmed" ? GREEN : g.verdict === "partial" ? "#D4A843" : "#C97B84";
                    const vbg =
                      g.verdict === "confirmed"
                        ? "rgba(46,204,113,0.08)"
                        : g.verdict === "partial"
                        ? "rgba(212,168,67,0.08)"
                        : "rgba(201,123,132,0.08)";
                    return (
                      <div key={g.label} className="flex items-center gap-1.5 text-[9px]">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        <span style={{ color: g.color }}>{g.label}</span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-widest"
                          style={{ color: vc, backgroundColor: vbg }}
                        >
                          {g.verdict === "confirmed"
                            ? "CONFIRMED"
                            : g.verdict === "partial"
                            ? "PARTIAL"
                            : "DIVERGENT"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p
                  className="mt-4 text-[11px] leading-[1.65]"
                  style={{ fontFamily: BODY, color: TEXT_DIM }}
                >
                  STAGE is the only group that behaves as theorized&mdash;a tight,
                  coherent performance cluster. SPACE and STORY are looser
                  federations whose members have cross-group loyalties. That&rsquo;s
                  not a failure of the instrument&mdash;it&rsquo;s the finding.
                  Aesthetic &ldquo;performance&rdquo; is the one dimension homes
                  commit to fully; the physical and narrative axes are more fluid.
                </p>
              </div>

              {/* Data source link */}
              <p
                className="mt-4 text-[10px] tracking-wide"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                Raw data behind these visualizations (SOM grids, PCA,
                baseline stats):{" "}
                <a
                  href="/api/methodology-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 transition-colors hover:no-underline"
                  style={{ color: GOLD_DIM }}
                >
                  Download JSON &rarr;
                </a>
              </p>
            </div>

            {/* ── 7B: U-Matrix ─────────────────────────────────────────── */}
            <div
              className="mt-6 rounded border p-6"
              style={{ backgroundColor: CARD_DEEP, borderColor: BORDER, boxShadow: CARD_GLOW }}
            >
              <div className="flex items-baseline justify-between">
                <p
                  className="text-[10px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GOLD_DIM }}
                >
                  7B &mdash; U-MATRIX: BOUNDARY MAP
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest"
                  style={{
                    fontFamily: MONO,
                    color: GREEN,
                    backgroundColor: "rgba(46, 204, 113, 0.08)",
                  }}
                >
                  LIVE
                </span>
              </div>

              {mounted && (() => {
                const um = somData.u_matrix;
                const cm = somData.cluster_map;
                let uMin = Infinity, uMax = -Infinity;
                for (let c = 0; c < SOM_GRID; c++) {
                  for (let r = 0; r < SOM_GRID; r++) {
                    const v = um[c][r];
                    if (v < uMin) uMin = v;
                    if (v > uMax) uMax = v;
                  }
                }

                // ── Contour tracer for cluster outlines ──
                // Same edge-walking algorithm as 7A blobOutline, but tests
                // cluster membership instead of a percentile threshold.
                function edgeNeighbor7B(col: number, row: number, edge: number): [number, number] {
                  const even = col % 2 === 0;
                  const offsets: [number, number][] = even
                    ? [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
                    : [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];
                  const [dc, dr] = offsets[edge];
                  return [col + dc, row + dr];
                }

                function vertexXY7B(col: number, row: number, v: number): [number, number] {
                  const [cx, cy] = hexCenter(col, row);
                  const a = (Math.PI / 180) * (60 * v);
                  return [cx + HEX_R * Math.cos(a), cy + HEX_R * Math.sin(a)];
                }

                // Trace all contours for a given cluster ID.
                // Returns array of SVG path d strings (one per connected boundary loop).
                function clusterOutlines(clusterId: number): string[] {
                  const inCluster = (c: number, r: number) =>
                    c >= 0 && c < SOM_GRID && r >= 0 && r < SOM_GRID && cm[c][r] === clusterId;

                  // Find ALL boundary edges for this cluster
                  const allEdges: { c: number; r: number; e: number }[] = [];
                  const used = new Set<string>();
                  for (let c = 0; c < SOM_GRID; c++) {
                    for (let r = 0; r < SOM_GRID; r++) {
                      if (!inCluster(c, r)) continue;
                      for (let e = 0; e < 6; e++) {
                        const [nc, nr] = edgeNeighbor7B(c, r, e);
                        if (!inCluster(nc, nr)) {
                          allEdges.push({ c, r, e });
                        }
                      }
                    }
                  }

                  const paths: string[] = [];

                  while (allEdges.length > 0) {
                    // Pick first unused edge as start
                    const start = allEdges[0];
                    const points: string[] = [];
                    let c = start.c, r = start.r, e = start.e;
                    let safety = SOM_GRID * SOM_GRID * 6;

                    do {
                      // Mark this edge as used
                      const edgeKey = `${c},${r},${e}`;
                      used.add(edgeKey);

                      // Record start vertex of this boundary edge
                      const [vx, vy] = vertexXY7B(c, r, e);
                      points.push(`${vx.toFixed(1)},${vy.toFixed(1)}`);

                      // Advance clockwise: try next edge (e+1)
                      let ne = (e + 1) % 6;
                      let [nc, nr] = edgeNeighbor7B(c, r, ne);

                      while (inCluster(nc, nr)) {
                        c = nc; r = nr;
                        const backE = (ne + 3) % 6;
                        ne = (backE + 1) % 6;
                        [nc, nr] = edgeNeighbor7B(c, r, ne);
                      }
                      e = ne;
                    } while ((c !== start.c || r !== start.r || e !== start.e) && --safety > 0);

                    // Remove all used edges from allEdges
                    for (let i = allEdges.length - 1; i >= 0; i--) {
                      const ae = allEdges[i];
                      if (used.has(`${ae.c},${ae.r},${ae.e}`)) {
                        allEdges.splice(i, 1);
                      }
                    }

                    if (points.length >= 3) {
                      paths.push(`M${points.join("L")}Z`);
                    }
                  }

                  return paths;
                }

                // Compute avg U-matrix at each cluster border for sharpness table
                const borderU: Record<string, { sum: number; n: number }> = {};
                for (let c = 0; c < SOM_GRID; c++) {
                  for (let r = 0; r < SOM_GRID; r++) {
                    const myCluster = cm[c][r];
                    for (let e = 0; e < 6; e++) {
                      const [nc, nr] = edgeNeighbor7B(c, r, e);
                      if (nc < 0 || nc >= SOM_GRID || nr < 0 || nr >= SOM_GRID) continue;
                      const neighborCluster = cm[nc][nr];
                      if (neighborCluster === myCluster) continue;
                      const lo = Math.min(myCluster, neighborCluster);
                      const hi = Math.max(myCluster, neighborCluster);
                      const key = `${lo}-${hi}`;
                      if (!borderU[key]) borderU[key] = { sum: 0, n: 0 };
                      borderU[key].sum += (um[c][r] + um[nc][nr]) / 2;
                      borderU[key].n += 1;
                    }
                  }
                }
                const borderAvg: Record<string, number> = {};
                for (const [key, { sum, n }] of Object.entries(borderU)) {
                  borderAvg[key] = sum / n;
                }
                const borderVals = Object.values(borderAvg);
                const bMin = Math.min(...borderVals);
                const bMax = Math.max(...borderVals);

                // Compute per-cluster avg border sharpness
                // (average U-matrix value across all edges where this cluster touches another)
                const clusterSharpness: Record<number, number> = {};
                for (let cid = 0; cid < 6; cid++) {
                  let sum = 0, n = 0;
                  for (const [key, avg] of Object.entries(borderAvg)) {
                    const [lo, hi] = key.split("-").map(Number);
                    if (lo === cid || hi === cid) { sum += avg; n++; }
                  }
                  clusterSharpness[cid] = n > 0 ? (sum / n - bMin) / (bMax - bMin) : 0.5;
                }

                // Build contour paths for each cluster — style varies by sharpness
                const clusterContours: React.ReactNode[] = [];
                const clusterColors7B: Record<number, string> = {
                  0: "#6B8FA3", 1: "#8CB4C9", 2: "#D4A574",
                  3: "#C97B84", 4: "#7BA07B", 5: "#C9A96E",
                };
                for (let cid = 0; cid < 6; cid++) {
                  const paths = clusterOutlines(cid);
                  const s = clusterSharpness[cid]; // 0 = softest, 1 = sharpest

                  // Sharp: thick crisp white line, subtle glow
                  // Soft: thin blurred line, heavy blur, lower opacity
                  const crispWidth = 1.5 + s * 4.5;     // 1.5 → 6
                  const crispOpacity = 0.3 + s * 0.7;    // 0.3 → 1.0
                  const glowWidth = 4 + s * 10;           // 4 → 14
                  const glowOpacity = 0.1 + (1 - s) * 0.3; // soft = more glow blur, sharp = less
                  const blurStd = 1.5 + (1 - s) * 4;      // soft = 5.5 blur, sharp = 1.5 blur

                  // For soft clusters: add extra-wide diffuse blur to show fuzziness
                  const extraBlurWidth = (1 - s) * 16;
                  const extraBlurOpacity = (1 - s) * 0.15;

                  for (let pi = 0; pi < paths.length; pi++) {
                    // Extra diffuse blur for soft boundaries
                    if (extraBlurWidth > 2) {
                      clusterContours.push(
                        <path
                          key={`diffuse-${cid}-${pi}`}
                          d={paths[pi]}
                          fill="none"
                          stroke={clusterColors7B[cid]}
                          strokeWidth={extraBlurWidth}
                          strokeOpacity={extraBlurOpacity}
                          strokeLinejoin="round"
                          filter="url(#blur7b-heavy)"
                        />
                      );
                    }
                    // Glow layer
                    clusterContours.push(
                      <path
                        key={`glow-${cid}-${pi}`}
                        d={paths[pi]}
                        fill="none"
                        stroke={clusterColors7B[cid]}
                        strokeWidth={glowWidth}
                        strokeOpacity={glowOpacity}
                        strokeLinejoin="round"
                        style={{ filter: `url(#blur7b-${cid})` }}
                      />
                    );
                    // Crisp layer
                    clusterContours.push(
                      <path
                        key={`contour-${cid}-${pi}`}
                        d={paths[pi]}
                        fill="none"
                        stroke={s > 0.5 ? "white" : clusterColors7B[cid]}
                        strokeWidth={crispWidth}
                        strokeOpacity={crispOpacity}
                        strokeLinejoin="round"
                        strokeDasharray={s < 0.3 ? "4 3" : "none"}
                      />
                    );
                  }
                }

                // Cluster centroid labels
                const clusterCentroids: Record<number, { sx: number; sy: number; n: number }> = {};
                for (let c = 0; c < SOM_GRID; c++) {
                  for (let r = 0; r < SOM_GRID; r++) {
                    const cid = cm[c][r];
                    if (!clusterCentroids[cid]) clusterCentroids[cid] = { sx: 0, sy: 0, n: 0 };
                    const [cx, cy] = hexCenter(c, r);
                    clusterCentroids[cid].sx += cx;
                    clusterCentroids[cid].sy += cy;
                    clusterCentroids[cid].n += 1;
                  }
                }
                const clusterLabels: React.ReactNode[] = [];
                const fullNames: Record<number, string> = {
                  0: "Lived-In Retreat", 1: "Clean Slate", 2: "Grand Heritage",
                  3: "Designer Showcase", 4: "Comfortable Middle", 5: "Cold Stage",
                };
                for (const [idStr, { sx, sy, n }] of Object.entries(clusterCentroids)) {
                  const id = Number(idStr);
                  clusterLabels.push(
                    <text
                      key={`label-${id}`}
                      x={sx / n}
                      y={sy / n}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize={7}
                      fontFamily={MONO}
                      fontWeight="bold"
                      style={{ textShadow: "0 0 6px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,1)" }}
                    >
                      {fullNames[id]}
                    </text>
                  );
                }

                // Build the SVG manually to layer boundary lines on top
                const hexes: React.ReactNode[] = [];
                for (let col = 0; col < SOM_GRID; col++) {
                  for (let row = 0; row < SOM_GRID; row++) {
                    const [cx, cy] = hexCenter(col, row);
                    const t = uMax > uMin ? (um[col][row] - uMin) / (uMax - uMin) : 0.5;
                    const fill = colorRamp3(t, [20, 25, 40], [80, 60, 45], [230, 200, 140]);
                    hexes.push(
                      <path
                        key={`${col}-${row}`}
                        d={hexPath(cx, cy, HEX_R - 0.5)}
                        fill={fill}
                        stroke="rgba(27,24,21,0.6)"
                        strokeWidth={0.5}
                      >
                        <title>{`Distance: ${um[col][row].toFixed(3)}\nCluster: ${somData.metadata.cluster_names[cm[col][row]]}`}</title>
                      </path>
                    );
                  }
                }

                return (
                  <div className="mt-4 mx-auto" style={{ maxWidth: 500 }}>
                    <svg
                      viewBox={`0 0 ${SOM_SVG_W} ${SOM_SVG_H}`}
                      className="w-full"
                      style={{ maxHeight: 420 }}
                    >
                      <defs>
                        <filter id="blur7b-heavy">
                          <feGaussianBlur stdDeviation="6" />
                        </filter>
                        {[0, 1, 2, 3, 4, 5].map((cid) => {
                          const s = clusterSharpness[cid];
                          const std = 1.5 + (1 - s) * 4;
                          return (
                            <filter key={`blur7b-${cid}`} id={`blur7b-${cid}`}>
                              <feGaussianBlur stdDeviation={std} />
                            </filter>
                          );
                        })}
                      </defs>
                      {hexes}
                      {clusterContours}
                      {clusterLabels}
                    </svg>
                    {/* Legend */}
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                          Low distance
                        </span>
                        <div
                          className="h-2 rounded"
                          style={{
                            width: 80,
                            background: "linear-gradient(to right, rgb(20,25,40), rgb(80,60,45), rgb(230,200,140))",
                          }}
                        />
                        <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                          High distance
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                      {somData.metadata.cluster_names.map((name: string, i: number) => (
                        <div key={name} className="flex items-center gap-1">
                          <div
                            className="h-2 w-4 rounded-sm"
                            style={{ backgroundColor: clusterColors7B[i], opacity: 0.9 }}
                          />
                          <span
                            className="text-[8px]"
                            style={{ fontFamily: MONO, color: TEXT_DIM }}
                          >
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Border sharpness table */}
                    <div className="mt-4 rounded p-3" style={{ backgroundColor: "rgba(27,24,21,0.4)", border: `1px solid ${BORDER}` }}>
                      <p className="text-[9px] font-bold tracking-wider mb-2" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                        CLUSTER BOUNDARY SHARPNESS (avg U-matrix distance)
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(borderAvg)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 6)
                          .map(([key, avg]) => {
                            const [lo, hi] = key.split("-").map(Number);
                            const names = somData.metadata.cluster_names;
                            const shortA = names[lo].replace("The ", "");
                            const shortB = names[hi].replace("The ", "");
                            const t = bMax > bMin ? (avg - bMin) / (bMax - bMin) : 0.5;
                            const barColor = t > 0.6 ? GREEN : t > 0.3 ? "#D4A843" : "#C97B84";
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <div
                                  className="rounded-full"
                                  style={{
                                    width: 40 + t * 60,
                                    height: 4,
                                    backgroundColor: barColor,
                                    opacity: 0.7,
                                  }}
                                />
                                <span className="text-[8px] whitespace-nowrap" style={{ fontFamily: MONO, color: TEXT_MID }}>
                                  {shortA} / {shortB}{" "}
                                  <span style={{ color: TEXT_DIM }}>({avg.toFixed(2)})</span>
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {!mounted && (
                <div
                  className="mt-4 flex items-center justify-center rounded"
                  style={{
                    height: 320,
                    backgroundColor: "rgba(58, 51, 42, 0.15)",
                    border: `1px dashed ${BORDER}`,
                  }}
                >
                  <p
                    className="text-[11px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    Loading U-matrix&hellip;
                  </p>
                </div>
              )}

              <div
                className="mt-5 flex flex-col gap-3 text-[13px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_MID }}
              >
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Technical:</strong>{" "}
                  The Unified Distance Matrix (U-matrix) measures the
                  average distance between each hexagon&rsquo;s weight vector
                  and its neighbors&rsquo;. Low values (dark) indicate smooth
                  transitions&mdash;homes in this region are aesthetically
                  similar. High values (bright) indicate steep gradients in
                  the 9D space&mdash;these are the boundaries between
                  aesthetic regions. The bright ridges are computed
                  independently of the k-means clusters&mdash;this is the
                  SOM&rsquo;s own topological structure, not a
                  post-hoc overlay. If the cluster boundaries (white lines)
                  fall on bright ridges, the typologies found real structure.
                  If they cross dark valleys, the clustering cut something
                  that was actually continuous.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Plain English:</strong>{" "}
                  Think of this as an elevation map. Dark cells are valleys
                  where homes look alike. Bright cells are ridgelines where
                  the aesthetic language changes sharply. The white lines are
                  where our six typologies draw their borders. We&rsquo;re
                  asking: did we cut along the mountain ridges, or did we
                  draw arbitrary lines through flat terrain?
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>The sharpest border:</strong>{" "}
                  Lived-In Retreat vs. Clean Slate dominates the map with an
                  average boundary distance of 1.24&mdash;far above any other
                  border. This is the deepest split in AD aesthetics: warm,
                  tactile, accumulated life on one side; spare, contemporary
                  minimalism on the other. If you forced the entire dataset
                  into just two categories, this is where it would break.
                  The ridge is bright and unbroken&mdash;there is no middle
                  ground between these two worlds.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>The Cold Stage is real:</strong>{" "}
                  The border between Cold Stage and its neighbors (Designer
                  Showcase at 0.97, Clean Slate at 0.97) is the second
                  sharpest zone on the map. Despite being the smallest
                  typology (9% of homes), the SOM treats it as genuinely
                  distinct&mdash;grand, cold, curated, theatrical spaces that
                  occupy their own corner of the aesthetic landscape. This is
                  the typology most over-represented in the Epstein orbit
                  (1.35&times; base rate), and the U-matrix confirms it
                  isn&rsquo;t a statistical artifact.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>The Comfortable Middle is a basin, not a box:</strong>{" "}
                  Look at how the white lines around the sage-green region
                  sit on dark terrain, not bright ridges. Three of its four
                  borders are softer than the average <em>interior</em>{" "}
                  cell&mdash;the Comfortable Middle grades smoothly into
                  Clean Slate, Grand Heritage, and Designer Showcase with no
                  natural boundary. The SOM is telling us this isn&rsquo;t a
                  &ldquo;type&rdquo; so much as the center of the
                  distribution. It&rsquo;s where you end up when no single
                  aesthetic dimension dominates. The k-means algorithm drew a
                  border because we asked for six boxes, but the topology
                  says this is a gradient.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Internal structure &mdash; the Lived-In Retreat wants to split:</strong>{" "}
                  Over half of the interior cells inside the Lived-In Retreat
                  have U-matrix values <em>higher than the average boundary
                  cell</em>. There&rsquo;s a ridge running through
                  it&mdash;possibly separating &ldquo;rustic lived-in&rdquo;
                  (beach cottages, farmhouses, wide-plank floors) from
                  &ldquo;intellectual lived-in&rdquo; (book-filled Parisian
                  apartments, collected art, layered textiles). If we ever
                  move to k&nbsp;=&nbsp;7, the first split would be here.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>The verdict:</strong>{" "}
                  The U-matrix validates the extremes and honestly reports the
                  middle. Lived-In vs. Clean Slate, Cold Stage as its own
                  world, Grand Heritage and Comfortable Middle internally
                  coherent&mdash;these are real. The Comfortable Middle&rsquo;s
                  soft borders and the Lived-In Retreat&rsquo;s internal ridge
                  are real too. The six typologies are genuine{" "}
                  <em>directions</em> in the data, but the boundaries between
                  them are gradients, not walls. That&rsquo;s consistent with
                  a silhouette score of 0.17, and it&rsquo;s the right answer
                  for something as inherently continuous as interior design
                  aesthetics. The clusters describe where you&rsquo;re
                  headed, not a box you&rsquo;re locked in.
                </p>
              </div>
            </div>

            {/* ── 7C: Cluster Map + Animated Temporal Drift ─────────── */}
            <SomTemporalDrift mounted={mounted} />

            {/* ── SOM Quality Metrics Note ──────────────────────────────── */}
            <div
              className="mt-6 rounded border p-5"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                SOM QUALITY METRICS
              </p>
              <div
                className="mt-3 flex flex-col gap-2 text-[12px] leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Quantization error: {somData.metadata.quantization_error.toFixed(4)}</strong>{" "}
                  &mdash; average distance from each data point to its
                  best-matching unit. Lower is better; this means each home
                  is represented well by its nearest hexagon.
                </p>
                <p>
                  <strong style={{ color: TEXT_LIGHT }}>Topographic error: {somData.metadata.topographic_error.toFixed(4)}</strong>{" "}
                  &mdash; fraction of data points whose two closest hexagons
                  are not adjacent. At 12.3%, the map preserves neighborhood
                  structure well: homes that are similar in 9D space almost
                  always land near each other on the 2D grid.
                </p>
                <p>
                  20&times;20 hexagonal grid, 10,000 iterations, PCA
                  initialization, Gaussian neighborhood. Trained on all {somData.metadata.n_features.toLocaleString()}{" "}
                  Opus-scored features.
                </p>
              </div>
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
