import { FeltronAreaCharts } from "@/components/charts/FeltronAreaChart";
import { AestheticRadarTimelapse } from "@/components/charts/AestheticRadarTimelapse";

/* ────────────────────────────────────────────────────────────
   Static baseline data (from data/baseline_analysis.json)
   Hardcoded for SSR — this is a one-time analysis, not live.
   ──────────────────────────────────────────────────────────── */

const AXES = [
  "Grandeur",
  "Material Warmth",
  "Maximalism",
  "Historicism",
  "Provenance",
  "Hospitality",
  "Formality",
  "Curation",
  "Theatricality",
] as const;

type AxisName = (typeof AXES)[number];

/** Percentage distribution at each score 1-5, per axis */
const DISTRIBUTIONS: Record<AxisName, [number, number, number, number, number]> = {
  Grandeur:         [1.6, 12.2, 27.9, 42.3, 15.9],
  "Material Warmth":[0.9,  4.7, 14.7, 40.4, 39.2],
  Maximalism:       [4.8, 11.3, 23.5, 39.6, 20.9],
  Historicism:      [11.5, 14.4, 24.2, 37.5, 12.4],
  Provenance:       [7.2, 11.4, 35.3, 32.0, 14.1],
  Hospitality:      [5.7, 14.4, 35.9, 34.5,  9.5],
  Formality:        [14.0, 22.8, 31.9, 26.7,  4.6],
  Curation:         [2.2, 10.6, 22.8, 56.3,  8.0],
  Theatricality:    [16.9, 42.8, 28.9,  9.1,  2.3],
};

const MEANS: Record<AxisName, number> = {
  Grandeur: 3.59,
  "Material Warmth": 4.12,
  Maximalism: 3.60,
  Historicism: 3.25,
  Provenance: 3.34,
  Hospitality: 3.28,
  Formality: 2.85,
  Curation: 3.57,
  Theatricality: 2.37,
};

/** Groups as defined in the scoring instrument */
const GROUPS: { label: string; axes: AxisName[]; alpha: number }[] = [
  { label: "SPACE", axes: ["Grandeur", "Material Warmth", "Maximalism"], alpha: 0.19 },
  { label: "STORY", axes: ["Historicism", "Provenance", "Hospitality"], alpha: 0.41 },
  { label: "STAGE", axes: ["Formality", "Curation", "Theatricality"], alpha: 0.83 },  // confirmed at 0.832 on full n=3763
];

/** Era-band mean scores for each axis */
interface EraProfile {
  label: string;
  years: string;
  n: number;
  means: Record<AxisName, number>;
}

const ERAS: EraProfile[] = [
  {
    label: "Late Cold War",
    years: "1988–1994",
    n: 860,
    means: {
      Grandeur: 3.48, "Material Warmth": 4.33, Maximalism: 3.96,
      Historicism: 3.71, Provenance: 3.78, Hospitality: 3.12,
      Formality: 2.92, Curation: 3.31, Theatricality: 2.15,
    },
  },
  {
    label: "Millennial",
    years: "1995–2004",
    n: 1058,
    means: {
      Grandeur: 3.52, "Material Warmth": 4.30, Maximalism: 3.62,
      Historicism: 3.46, Provenance: 3.43, Hospitality: 3.20,
      Formality: 2.90, Curation: 3.53, Theatricality: 2.23,
    },
  },
  {
    label: "Pre-Crash",
    years: "2005–2009",
    n: 547,
    means: {
      Grandeur: 3.78, "Material Warmth": 3.98, Maximalism: 3.13,
      Historicism: 3.00, Provenance: 2.88, Hospitality: 3.44,
      Formality: 3.02, Curation: 3.76, Theatricality: 2.47,
    },
  },
  {
    label: "Post-Crash",
    years: "2010–2015",
    n: 551,
    means: {
      Grandeur: 3.86, "Material Warmth": 3.80, Maximalism: 3.46,
      Historicism: 2.94, Provenance: 3.00, Hospitality: 3.54,
      Formality: 3.08, Curation: 3.91, Theatricality: 2.75,
    },
  },
  {
    label: "Digital Era",
    years: "2016–2025",
    n: 735,
    means: {
      Grandeur: 3.45, "Material Warmth": 3.97, Maximalism: 3.63,
      Historicism: 2.83, Provenance: 3.33, Hospitality: 3.26,
      Formality: 2.41, Curation: 3.56, Theatricality: 2.48,
    },
  },
];

/** Number of features with complete scores used in PCA */

/* ── Color palettes ── */

/** Five-shade warm palette for distribution bars (score 1 → 5) */
const SCORE_COLORS = ["#E8E0D4", "#D4C4AE", "#B8A088", "#8B7355", "#5C4A32"];

/** Map a score mean (roughly 2.0–4.5) to a warm heatmap color */
function heatColor(value: number): string {
  // Clamp to 1–5 range, then interpolate
  const t = Math.max(0, Math.min(1, (value - 1) / 4));
  // From pale cream to dark warm brown
  const r = Math.round(240 - t * 148);
  const g = Math.round(232 - t * 158);
  const b = Math.round(218 - t * 168);
  return `rgb(${r},${g},${b})`;
}

/** Text color for heatmap cells — dark on light, light on dark */
function heatTextColor(value: number): string {
  return value >= 3.5 ? "#FAF5EE" : "#4A3828";
}

/* ────────────────────────────────────────────────────────────
   Components
   ──────────────────────────────────────────────────────────── */

/** Single distribution strip for one axis */
function DistributionStrip({ axis }: { axis: AxisName }) {
  const dist = DISTRIBUTIONS[axis];
  const mean = MEANS[axis];

  return (
    <div className="flex items-center gap-3">
      {/* Axis label */}
      <div className="w-[110px] shrink-0 text-right">
        <span
          className="text-[11px] font-medium tracking-[0.02em] text-[#4A3828]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          {axis}
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-[22px] flex-1 overflow-hidden rounded-[3px]">
        {dist.map((pct, i) => (
          <div
            key={i}
            className="relative"
            style={{
              width: `${pct}%`,
              backgroundColor: SCORE_COLORS[i],
              minWidth: pct > 0 ? 2 : 0,
            }}
            title={`Score ${i + 1}: ${pct}%`}
          >
            {/* Show percentage label if segment is wide enough */}
            {pct >= 12 && (
              <span
                className="absolute inset-0 flex items-center justify-center text-[9px] font-medium tabular-nums"
                style={{
                  fontFamily: "futura-pt, sans-serif",
                  color: i >= 3 ? "#FAF5EE" : "#5C4A32",
                }}
              >
                {pct.toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Mean */}
      <div className="w-[40px] shrink-0 text-right">
        <span
          className="text-[12px] font-bold tabular-nums text-[#4A3828]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          {mean.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/** Full distribution chart with all 9 axes, grouped */
function DistributionChart() {
  return (
    <div
      className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Score Distribution Across 3,763 Features
        </span>
        <span
          className="text-[9px] uppercase tracking-[0.08em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Mean
        </span>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-3">
        {[1, 2, 3, 4, 5].map((score, i) => (
          <span key={score} className="flex items-center gap-1">
            <span
              className="inline-block h-[8px] w-[8px] rounded-[2px]"
              style={{ backgroundColor: SCORE_COLORS[i] }}
            />
            <span
              className="text-[8px] tabular-nums text-[#999]"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              {score}
            </span>
          </span>
        ))}
      </div>

      {/* Grouped axes */}
      {GROUPS.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? "mt-4" : ""}>
          {/* Group label */}
          <div className="mb-2 flex items-center gap-2">
            <span
              className="text-[8px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              {group.label}
            </span>
            <span
              className="text-[8px] tracking-[0.05em] text-[#AAAAAA]"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              {"\u03B1"} = {group.alpha.toFixed(2)}
            </span>
            {group.alpha >= 0.60 && (
              <span className="rounded-[2px] bg-[#E8F5E9] px-1.5 py-[1px] text-[7px] font-medium uppercase tracking-[0.1em] text-[#2E7D32]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Valid Composite
              </span>
            )}
          </div>

          {/* Strips */}
          <div className="flex flex-col gap-1.5">
            {group.axes.map((ax) => (
              <DistributionStrip key={ax} axis={ax} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Era heatmap: 5 eras × 9 axes, colored by mean score */
function EraHeatmap() {
  // Short labels for column headers
  const SHORT: Record<AxisName, string> = {
    Grandeur: "Grnd",
    "Material Warmth": "Wrm",
    Maximalism: "Max",
    Historicism: "Hist",
    Provenance: "Prov",
    Hospitality: "Hosp",
    Formality: "Form",
    Curation: "Cur",
    Theatricality: "Thtr",
  };

  // Compute drift (first era → last era)
  const drifts: Record<AxisName, number> = {} as Record<AxisName, number>;
  for (const ax of AXES) {
    drifts[ax] = +(ERAS[ERAS.length - 1].means[ax] - ERAS[0].means[ax]).toFixed(2);
  }

  return (
    <div
      className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      {/* Header */}
      <div className="mb-3">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          How AD&rsquo;s Aesthetic Evolved: 1988&ndash;2025
        </span>
      </div>

      {/* Heatmap table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-[90px] pb-2 text-left">
                <span
                  className="text-[8px] uppercase tracking-[0.1em] text-[#AAAAAA]"
                  style={{ fontFamily: "futura-pt, sans-serif" }}
                >
                  Era
                </span>
              </th>
              {AXES.map((ax) => (
                <th key={ax} className="pb-2 text-center">
                  <span
                    className="text-[8px] font-medium uppercase tracking-[0.05em] text-[#999]"
                    style={{ fontFamily: "futura-pt, sans-serif" }}
                  >
                    {SHORT[ax]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ERAS.map((era) => (
              <tr key={era.label}>
                <td className="py-[3px] pr-2">
                  <div>
                    <span
                      className="text-[10px] font-medium text-[#4A3828]"
                      style={{ fontFamily: "futura-pt, sans-serif" }}
                    >
                      {era.label}
                    </span>
                    <br />
                    <span
                      className="text-[8px] text-[#AAAAAA]"
                      style={{ fontFamily: "futura-pt, sans-serif" }}
                    >
                      {era.years} &middot; n={era.n}
                    </span>
                  </div>
                </td>
                {AXES.map((ax) => {
                  const val = era.means[ax];
                  return (
                    <td key={ax} className="p-[2px]">
                      <div
                        className="flex h-[32px] items-center justify-center rounded-[3px]"
                        style={{
                          backgroundColor: heatColor(val),
                          color: heatTextColor(val),
                        }}
                      >
                        <span
                          className="text-[10px] font-medium tabular-nums"
                          style={{ fontFamily: "futura-pt, sans-serif" }}
                        >
                          {val.toFixed(1)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Drift row */}
            <tr>
              <td className="pt-2 pr-2">
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#999]"
                  style={{ fontFamily: "futura-pt, sans-serif" }}
                >
                  37-yr Drift
                </span>
              </td>
              {AXES.map((ax) => {
                const d = drifts[ax];
                const color = d > 0.15 ? "#B87333" : d < -0.15 ? "#4A7C8B" : "#999";
                return (
                  <td key={ax} className="pt-2 text-center">
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{ fontFamily: "futura-pt, sans-serif", color }}
                    >
                      {Math.abs(d) < 0.05 ? "0.0" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Scale legend */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className="text-[8px] text-[#AAAAAA]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Low (1)
        </span>
        <div className="flex h-[8px] flex-1 overflow-hidden rounded-[2px]">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: heatColor(1 + (i / 19) * 4) }}
            />
          ))}
        </div>
        <span
          className="text-[8px] text-[#AAAAAA]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          High (5)
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Section
   ──────────────────────────────────────────────────────────── */

export function BaselineAesthetic() {
  return (
    <section className="narrative bg-background pb-16 pt-14" id="baseline">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <p className="n-label">Key Finding 02</p>
        <h2 className="n-title">2.1 Determining the AD Baseline Aesthetic</h2>
        <hr className="n-rule" />

        <div className="n-body n-body-narrow mt-5">
          <p>
            Before we can identify an Epstein aesthetic, we need to know what
            Architectural Digest homes look like in general. We scored every
            feature in the archive &mdash; 3,763 homes spanning 37 years &mdash;
            on nine axes measuring everything from material warmth to theatrical
            display. The result is the most comprehensive quantitative profile of
            AD&rsquo;s editorial aesthetic ever assembled.
          </p>

          <p>
            The data reveals a clear editorial identity. AD homes are overwhelmingly
            warm (mean&nbsp;4.12/5 on Material Warmth), richly layered with objects
            in dialogue (Maximalism&nbsp;3.60), and professionally curated
            (Curation&nbsp;3.57, with 56% of all features scoring exactly 4). The
            magazine&rsquo;s signature is tactile luxury &mdash; wood, linen,
            leather &mdash; shaped by a designer&rsquo;s hand.
          </p>

          <p>
            Critically, AD homes do <em>not</em> perform wealth for an outside
            audience. Theatricality is the lowest-scoring axis at 2.37, with 60%
            of features scoring 1 or 2. The correlation structure confirms two
            opposing clusters: a &ldquo;performing&rdquo; cluster (Formality,
            Curation, Theatricality) and a &ldquo;living&rdquo; cluster (Warmth,
            Provenance, Historicism) that are anti-correlated &mdash; Bourdieu&rsquo;s
            distinction between display and authenticity, measured in the data.
          </p>
        </div>

        {/* ── Visualizations: two-column ── */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Animated radar timelapse — spans both columns */}
          <div className="md:col-span-2 flex justify-center">
            <div className="w-full" style={{ maxWidth: 560 }}>
              <AestheticRadarTimelapse />
              <p className="n-caption">
                37 years of AD&rsquo;s aesthetic identity, year by year. Watch how
                Material Warmth dominates throughout while Historicism and Formality
                steadily contract &mdash; the magazine&rsquo;s shift from traditional
                period rooms to curated contemporary spaces, animated in real time.
              </p>
            </div>
          </div>

          <div className="flex flex-col">
            <DistributionChart />
            <p className="n-caption">
              Material Warmth dominates at 4.12 &mdash; nearly 80% of AD homes
              score 4 or 5. Theatricality clusters at the opposite end: the
              magazine consistently publishes homes that don&rsquo;t perform.
              Only STAGE (Formality + Curation + Theatricality) passes
              Cronbach&rsquo;s alpha as a valid composite measure.
            </p>
          </div>

          <div className="flex flex-col">
            <EraHeatmap />
            <p className="n-caption">
              The largest temporal shift is Historicism, dropping 0.9 points
              over 37 years as AD moved from traditional period rooms to
              contemporary design. Formality fell 0.5 points. Curation rose
              slightly &mdash; homes became more designer-directed even as they
              became less formal. Every axis shows statistically significant era
              effects (Kruskal-Wallis p &lt; 10&#8315;&#xB9;&#8310;).
            </p>
          </div>
        </div>

        {/* ── Feltron-style temporal charts ── */}
        <div className="mt-10">
          <FeltronAreaCharts />
          <p className="n-caption">
            Three-year rolling averages across 3,763 scored features. Each
            chart shows one axis group (SPACE / STORY / STAGE) with its
            three sub-metrics overlaid. The organic separation between
            Material Warmth and Grandeur in SPACE confirms these measure
            different constructs; the tight tracking of STAGE&rsquo;s three
            metrics confirms it as a valid composite.
          </p>
        </div>

        {/* PCA / Construct Validation content moved to AestheticMethodologySection Section 5 */}
      </div>
    </section>
  );
}
