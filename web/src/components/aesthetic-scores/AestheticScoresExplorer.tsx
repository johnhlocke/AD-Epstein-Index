"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
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

// ── Palette ────────────────────────────────────────────────────────────────
const BORDER = "#E2DDD5";
const COPPER = "#B87333";
const TEXT_DIM = "#999";
const MONO = "JetBrains Mono, monospace";
const BODY = "var(--font-inter), Inter, system-ui, sans-serif";

const MONTHS = [
  { value: "", label: "Any" },
  { value: "1", label: "Jan" }, { value: "2", label: "Feb" },
  { value: "3", label: "Mar" }, { value: "4", label: "Apr" },
  { value: "5", label: "May" }, { value: "6", label: "Jun" },
  { value: "7", label: "Jul" }, { value: "8", label: "Aug" },
  { value: "9", label: "Sep" }, { value: "10", label: "Oct" },
  { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
];

// ── Types ──────────────────────────────────────────────────────────────────
interface FeatureImage {
  feature_id: number;
  page_number: number;
  public_url: string;
}

interface AestheticFeature {
  id: number;
  article_title: string | null;
  homeowner_name: string | null;
  designer_name: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  design_style: string | null;
  score_grandeur: number | null;
  score_material_warmth: number | null;
  score_maximalism: number | null;
  score_historicism: number | null;
  score_provenance: number | null;
  score_hospitality: number | null;
  score_formality: number | null;
  score_curation: number | null;
  score_theatricality: number | null;
  scoring_rationale: Record<string, string> | null;
  aesthetic_profile: string | null;
  issues: { month: number | null; year: number };
  images: FeatureImage[];
}

interface APIResponse {
  data: AestheticFeature[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Axis definitions ───────────────────────────────────────────────────────
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

// Short labels for score grid
const AXIS_SHORT: Record<string, string> = {
  score_grandeur: "Grandeur",
  score_material_warmth: "Material Warmth",
  score_maximalism: "Maximalism",
  score_historicism: "Historicism",
  score_provenance: "Provenance",
  score_hospitality: "Hospitality",
  score_formality: "Formality",
  score_curation: "Curation",
  score_theatricality: "Theatricality",
};

// ── Colored radar shape helpers (ported from DossierAestheticRadar) ───────

function lerpColor(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ColoredRadarShape(props: any) {
  const { points, featureId } = props;
  if (!points || points.length < 3) return null;

  const cx = points[0].cx;
  const cy = points[0].cy;
  // Unique prefix per feature to avoid SVG gradient ID collisions
  const prefix = `asr-${featureId}`;

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

  const boundaries = new Set<number>();
  for (let i = 0; i < AXES.length; i++) {
    const next = (i + 1) % AXES.length;
    if (AXES[i].group !== AXES[next].group) boundaries.add(i);
  }

  const BLEND_STEPS = 6;
  const sectors: { d: string; gradId: string; color?: string }[] = [];

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
        const blendColor = lerpColor(GROUP_COLORS[groupA], GROUP_COLORS[groupB], tMid);
        sectors.push({
          d: `M${cx},${cy} L${p0.x},${p0.y} L${p1.x},${p1.y} Z`,
          gradId: `${prefix}-blend-${i}-${s}`,
          color: blendColor,
        });
      }
    } else {
      sectors.push({
        d: `M${cx},${cy} L${points[i].x},${points[i].y} L${points[next].x},${points[next].y} Z`,
        gradId: `${prefix}-grad-${groupA}`,
      });
    }
  }

  return (
    <g>
      <defs>
        {GROUPS.map((group) => (
          <radialGradient
            key={group}
            id={`${prefix}-grad-${group}`}
            cx={cx} cy={cy} r={maxR}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={GROUP_COLORS[group]} stopOpacity={0.1} />
            <stop offset="100%" stopColor={GROUP_COLORS[group]} stopOpacity={0.9} />
          </radialGradient>
        ))}
        {sectors.map((s) => {
          if (!s.color) return null;
          return (
            <radialGradient
              key={s.gradId}
              id={s.gradId}
              cx={cx} cy={cy} r={maxR}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.1} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.9} />
            </radialGradient>
          );
        })}
      </defs>

      {sectors.map((s, i) => (
        <path key={`sector-${i}`} d={s.d} fill={`url(#${s.gradId})`} />
      ))}

      <path d={polyPath} fill="none" stroke="#999" strokeWidth={2} />

      {points.map((_: unknown, i: number) => (
        <circle
          key={`dot-${i}`}
          cx={points[i].x} cy={points[i].y}
          r={3}
          fill={GROUP_COLORS[AXES[i].group]}
        />
      ))}
    </g>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AxisTick({ payload, x, y, textAnchor }: any) {
  const label = payload.value as string;
  const lines = label.split("\n");
  const yAdj = label === "Grandeur" ? y - 6 : y;
  return (
    <text
      x={x} y={yAdj} textAnchor={textAnchor}
      fontSize={10} fill="#666"
      stroke="white" strokeWidth={4}
      strokeLinejoin="round" paintOrder="stroke"
      fontFamily="futura-pt, sans-serif"
    >
      {lines.map((line: string, i: number) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>{line}</tspan>
      ))}
    </text>
  );
}

// ── Radar tooltip ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScoreTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded border px-3 py-2 shadow-sm"
      style={{ backgroundColor: "#fff", borderColor: BORDER, fontFamily: MONO }}
    >
      <p className="text-[11px] font-bold" style={{ color: "#1A1A1A" }}>
        {(d.axisLabel as string).replace("\n", " ")}
      </p>
      <p className="mt-0.5 text-[10px]" style={{ color: COPPER }}>
        Score: {d.scoreValue}/5
      </p>
      <p className="text-[10px]" style={{ color: TEXT_DIM }}>{d.group}</p>
    </div>
  );
}

// ── Score card for one feature ─────────────────────────────────────────────
function FeatureScoreCard({ feature, mounted }: { feature: AestheticFeature; mounted: boolean }) {
  const radarData = AXES.map((a) => ({
    axis: a.label,
    axisLabel: a.label,
    scoreValue: (feature as unknown as Record<string, number | null>)[a.key] ?? 0,
    group: a.group,
  }));

  const location = [feature.location_city, feature.location_state, feature.location_country]
    .filter(Boolean)
    .join(", ");

  const monthName = feature.issues.month
    ? MONTHS.find((m) => m.value === String(feature.issues.month))?.label
    : null;

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: BORDER }}
    >
      {/* ── Magazine spread images ── */}
      {feature.images.length > 0 && (
        <div className="grid grid-cols-3 gap-px sm:grid-cols-4" style={{ backgroundColor: BORDER }}>
          {feature.images.map((img, i) => (
            <div
              key={i}
              className="relative aspect-[3/4]"
              style={{ backgroundColor: "#F5F2ED" }}
            >
              <Image
                src={img.public_url}
                alt={`${feature.homeowner_name ?? "Feature"} — page ${img.page_number}`}
                fill
                sizes="(min-width: 768px) 160px, 25vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Header ── */}
      <div className="border-b px-5 py-3" style={{ borderColor: BORDER }}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3
            className="text-[15px] font-bold"
            style={{ fontFamily: MONO, color: "#1A1A1A" }}
          >
            {feature.homeowner_name ?? "Anonymous"}
          </h3>
          {feature.article_title && (
            <span className="text-[13px] italic" style={{ fontFamily: BODY, color: "#666" }}>
              &ldquo;{feature.article_title}&rdquo;
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 text-[11px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
          {location && <span>{location}</span>}
          <span>{monthName ? `${monthName} ` : ""}{feature.issues.year}</span>
          {feature.designer_name && <span>Designer: {feature.designer_name}</span>}
          {feature.design_style && <span>{feature.design_style}</span>}
        </div>
      </div>

      {/* ── Body: 6 minor columns → radar (2 cols) | scores + summary (4 cols) ── */}
      <div className="grid gap-[var(--grid-gutter)] p-5 md:grid-cols-6">
        {/* Radar — 2 minor columns */}
        <div className="md:col-span-2">
          <div style={{ width: "100%", aspectRatio: "1 / 1", maxWidth: 300 }}>
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="58%">
                  <PolarGrid stroke="#B0A89C" strokeDasharray="3 2" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={<AxisTick />}
                    tickLine={false}
                  />
                  <PolarRadiusAxis
                    domain={[1, 5]}
                    tickCount={5}
                    tick={{ fontSize: 8, fill: "#ccc", fontFamily: MONO }}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="scoreValue"
                    stroke="transparent"
                    fill="transparent"
                    shape={<ColoredRadarShape featureId={feature.id} />}
                  />
                  <Tooltip content={<ScoreTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ width: "100%", aspectRatio: "1 / 1", backgroundColor: "#F5F2ED", borderRadius: 4 }} />
            )}
          </div>
        </div>

        {/* Scores + summary — 4 minor columns */}
        <div className="flex flex-col gap-4 md:col-span-4">
          {/* Score grid: 3 groups × 3 axes */}
          <div className="grid grid-cols-3 gap-x-[var(--grid-gutter)] gap-y-3">
            {(["SPACE", "STORY", "STAGE"] as const).map((group) => (
              <div key={group}>
                <p
                  className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ fontFamily: MONO, color: GROUP_COLORS[group] }}
                >
                  {group}
                </p>
                {AXES.filter((a) => a.group === group).map((axis) => {
                  const score = (feature as unknown as Record<string, number | null>)[axis.key];
                  return (
                    <div key={axis.key} className="mb-1.5 flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold"
                        style={{
                          fontFamily: MONO,
                          backgroundColor: `${GROUP_COLORS[axis.group]}20`,
                          color: GROUP_COLORS[axis.group],
                        }}
                      >
                        {score ?? "–"}
                      </span>
                      <span className="text-[11px]" style={{ fontFamily: MONO, color: "#666" }}>
                        {AXIS_SHORT[axis.key]}
                      </span>
                      <span className="ml-auto flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: score != null && n <= score
                                ? GROUP_COLORS[axis.group]
                                : "#E2DDD5",
                            }}
                          />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Aesthetic summary */}
          {feature.aesthetic_profile && (
            <p
              className="text-[13px] italic leading-[1.7]"
              style={{ fontFamily: BODY, color: "#555" }}
            >
              {feature.aesthetic_profile}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main explorer ──────────────────────────────────────────────────────────
export function AestheticScoresExplorer() {
  const mounted = useMounted();
  const [results, setResults] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);

  // Search field refs
  const homeownerRef = useRef<HTMLInputElement>(null);
  const designerRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLSelectElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const headlineRef = useRef<HTMLInputElement>(null);

  const fetchResults = useCallback(async (targetPage: number) => {
    const homeowner = homeownerRef.current?.value.trim();
    const designer = designerRef.current?.value.trim();
    const month = monthRef.current?.value;
    const year = yearRef.current?.value.trim();
    const headline = headlineRef.current?.value.trim();

    // Require at least one search term
    if (!homeowner && !designer && !year && !month && !headline) return;

    // If year is provided without month, warn
    if (year && !month) {
      // Still allow it but it will be a broader search
    }

    setLoading(true);
    setHasSearched(true);

    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("limit", "10");
    if (homeowner) params.set("homeowner", homeowner);
    if (designer) params.set("designer", designer);
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    if (headline) params.set("headline", headline);

    try {
      const res = await fetch(`/api/aesthetic-scores?${params}`);
      const data: APIResponse = await res.json();
      setResults(data);
      setPage(targetPage);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        setPage(1);
        fetchResults(1);
      }
    },
    [fetchResults]
  );

  const handleSearch = useCallback(() => {
    setPage(1);
    fetchResults(1);
  }, [fetchResults]);

  const inputStyle: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: 13,
    backgroundColor: "#FAFAFA",
    borderColor: BORDER,
    color: "#1A1A1A",
  };

  return (
    <div>
      {/* ── Search bar: 6 minor columns ── */}
      <div className="grid grid-cols-2 gap-[var(--grid-gutter)] md:grid-cols-6">
        {/* Homeowner — 2 cols */}
        <div className="md:col-span-2">
          <label
            className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: MONO, color: COPPER }}
          >
            Homeowner
          </label>
          <input
            ref={homeownerRef}
            type="text"
            placeholder="e.g. Ralph Lauren"
            onKeyDown={handleKeyDown}
            className="w-full rounded border px-3 py-2"
            style={inputStyle}
          />
        </div>
        {/* Designer — 1 col */}
        <div className="md:col-span-1">
          <label
            className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: MONO, color: COPPER }}
          >
            Designer
          </label>
          <input
            ref={designerRef}
            type="text"
            placeholder="Despont"
            onKeyDown={handleKeyDown}
            className="w-full rounded border px-3 py-2"
            style={inputStyle}
          />
        </div>
        {/* Headline — 1 col */}
        <div className="md:col-span-1">
          <label
            className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: MONO, color: COPPER }}
          >
            Headline
          </label>
          <input
            ref={headlineRef}
            type="text"
            placeholder="French Twist"
            onKeyDown={handleKeyDown}
            className="w-full rounded border px-3 py-2"
            style={inputStyle}
          />
        </div>
        {/* Month — 1 col */}
        <div className="md:col-span-1">
          <label
            className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: MONO, color: COPPER }}
          >
            Month
          </label>
          <select
            ref={monthRef}
            className="w-full rounded border px-2 py-2"
            style={inputStyle}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        {/* Year — 1 col */}
        <div className="md:col-span-1">
          <label
            className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: MONO, color: COPPER }}
          >
            Year
          </label>
          <input
            ref={yearRef}
            type="text"
            placeholder="2006"
            onKeyDown={handleKeyDown}
            className="w-full rounded border px-3 py-2"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Search button */}
      <div className="mt-4">
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded px-5 py-2 text-[12px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ fontFamily: MONO, backgroundColor: COPPER, color: "#fff" }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* ── Results ── */}
      <div className="mt-8">
        {!hasSearched && (
          <div className="py-16 text-center">
            <p className="text-[14px]" style={{ fontFamily: BODY, color: TEXT_DIM }}>
              Search by homeowner, designer, issue date, or article headline to
              browse aesthetic scores for all {mounted ? "3,763" : "\u2014"} scored features.
            </p>
          </div>
        )}

        {hasSearched && !loading && results && results.data.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[14px]" style={{ fontFamily: BODY, color: TEXT_DIM }}>
              No scored features found matching your search.
            </p>
          </div>
        )}

        {loading && (
          <div className="py-16 text-center">
            <p className="text-[14px]" style={{ fontFamily: MONO, color: COPPER }}>
              Loading...
            </p>
          </div>
        )}

        {hasSearched && !loading && results && results.data.length > 0 && (
          <>
            <p
              className="mb-6 text-[11px]"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              Showing {(results.page - 1) * results.pageSize + 1}–
              {Math.min(results.page * results.pageSize, results.total)} of{" "}
              {results.total.toLocaleString()} results
            </p>

            <div className="flex flex-col gap-8">
              {results.data.map((feature) => (
                <FeatureScoreCard key={feature.id} feature={feature} mounted={mounted} />
              ))}
            </div>

            {results.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  onClick={() => { setPage(page - 1); fetchResults(page - 1); }}
                  disabled={page <= 1}
                  className="rounded border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-30"
                  style={{ fontFamily: MONO, borderColor: BORDER, color: "#666" }}
                >
                  Prev
                </button>
                <span className="text-[11px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Page {results.page} of {results.totalPages}
                </span>
                <button
                  onClick={() => { setPage(page + 1); fetchResults(page + 1); }}
                  disabled={page >= results.totalPages}
                  className="rounded border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-30"
                  style={{ fontFamily: MONO, borderColor: BORDER, color: "#666" }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
