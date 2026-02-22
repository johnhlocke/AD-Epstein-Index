"use client";

import data from "./data.json";

const MONO = "JetBrains Mono, monospace";
const BODY = "var(--font-inter), Inter, system-ui, sans-serif";
const BG = "#1B1815";
const CARD_BG = "#242019";
const CARD_DEEP = "#15120F";
const BORDER = "#3A332A";
const TEXT_LIGHT = "#E8E0D4";
const TEXT_MID = "#B0A594";
const TEXT_DIM = "rgba(176, 165, 148, 0.75)";
const CARD_GLOW =
  "0 0 24px rgba(184, 115, 51, 0.06), 0 1px 2px rgba(0,0,0,0.2)";
const GREEN = "rgba(46, 204, 113, 0.7)";
const GOLD = "rgba(210, 170, 100, 0.85)";
const COPPER = "#B87333";

const GROUP_COLORS: Record<string, string> = {
  SPACE: "#C4A882",
  STORY: "#A3B18A",
  STAGE: "#B8A9C9",
};

// Axis index → group
const AXIS_GROUPS = [
  "SPACE",
  "SPACE",
  "SPACE",
  "STORY",
  "STORY",
  "STORY",
  "STAGE",
  "STAGE",
  "STAGE",
];

type Feature = (typeof data)["features"][number];

function ScoreCell({
  orig,
  retest,
  axisIdx,
}: {
  orig: number;
  retest: number | null;
  axisIdx: number;
}) {
  const match = retest === orig;
  const group = AXIS_GROUPS[axisIdx];
  const groupColor = GROUP_COLORS[group];

  return (
    <td
      className="px-1.5 py-1 text-center text-[11px]"
      style={{
        fontFamily: MONO,
        color: match ? TEXT_MID : COPPER,
        fontWeight: match ? 400 : 700,
        backgroundColor: match
          ? "transparent"
          : "rgba(184, 115, 51, 0.08)",
        borderLeft: `1px solid ${BORDER}`,
      }}
    >
      {retest ?? "—"}
      {!match && retest !== null && (
        <span
          className="ml-0.5 text-[8px]"
          style={{ color: groupColor }}
        >
          {retest! > orig ? "+" : ""}
          {retest! - orig}
        </span>
      )}
    </td>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const { id, name, year, month, title, orig, origSummary, runA, runASummary, runB, runBSummary, exact, images, insight } = feature;

  return (
    <div>
      {/* Large section header */}
      <p
        className="mb-3 text-[28px] font-bold tracking-tight"
        style={{ fontFamily: MONO, color: TEXT_DIM }}
      >
        Test–Retest: {String(index + 1).padStart(2, "0")}
      </p>

      <div
        className="overflow-hidden rounded border"
        style={{
          backgroundColor: CARD_BG,
          borderColor: BORDER,
          boxShadow: CARD_GLOW,
        }}
      >
        {/* Image row — contact-sheet above header */}
      {images && images.length > 0 && (
        <div
          className="flex flex-wrap"
          style={{
            gap: "4px",
            padding: "4px",
            backgroundColor: CARD_DEEP,
          }}
        >
          {images.map((img) => (
            <img
              key={img.page}
              src={img.url}
              alt={`Page ${img.page}`}
              loading="lazy"
              className="rounded-sm object-cover"
              style={{
                width: "calc((100% - 5 * 4px) / 6)",
                height: "200px",
                filter: "grayscale(0.6)",
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: CARD_DEEP }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="text-[11px]"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            #{id}
          </span>
          <a
            href={`/report/${id}`}
            className="text-[14px] font-bold underline decoration-1 underline-offset-2"
            style={{ fontFamily: MONO, color: TEXT_LIGHT }}
          >
            {name}
          </a>
          {title && (
            <span
              className="text-[11px] italic"
              style={{ fontFamily: BODY, color: TEXT_DIM }}
            >
              &ldquo;{title}&rdquo;
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px]"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            AD {year}-{String(month).padStart(2, "0")}
          </span>
          <span
            className="rounded px-2 py-0.5 text-[11px] font-bold"
            style={{
              fontFamily: MONO,
              backgroundColor:
                exact === 9
                  ? "rgba(46, 204, 113, 0.15)"
                  : exact >= 7
                    ? "rgba(210, 170, 100, 0.15)"
                    : "rgba(184, 115, 51, 0.15)",
              color:
                exact === 9
                  ? GREEN
                  : exact >= 7
                    ? GOLD
                    : COPPER,
            }}
          >
            {exact}/9
          </span>
        </div>
      </div>

      {/* Score table */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-[11px]"
          style={{ fontFamily: MONO, borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <th
                className="px-3 py-1.5 text-left text-[9px] tracking-wider"
                style={{ color: TEXT_DIM, width: "60px" }}
              >
                RUN
              </th>
              {data.axes.map((ax, i) => (
                <th
                  key={ax}
                  className="px-1.5 py-1.5 text-center text-[8px] tracking-wider"
                  style={{
                    color: GROUP_COLORS[AXIS_GROUPS[i]],
                    borderLeft: `1px solid ${BORDER}`,
                  }}
                >
                  {ax.length > 8 ? ax.slice(0, 4) + "." : ax}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Original */}
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td
                className="px-3 py-1 text-[10px] font-bold"
                style={{ color: TEXT_LIGHT }}
              >
                Original
              </td>
              {orig.map((v, i) => (
                <td
                  key={i}
                  className="px-1.5 py-1 text-center"
                  style={{
                    fontFamily: MONO,
                    color: TEXT_LIGHT,
                    borderLeft: `1px solid ${BORDER}`,
                  }}
                >
                  {v}
                </td>
              ))}
            </tr>
            {/* Run A */}
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td
                className="px-3 py-1 text-[10px]"
                style={{ color: GREEN }}
              >
                Run A
              </td>
              {runA
                ? runA.map((v, i) => (
                    <ScoreCell
                      key={i}
                      orig={orig[i]}
                      retest={v}
                      axisIdx={i}
                    />
                  ))
                : (
                  <td
                    colSpan={9}
                    className="px-3 py-1 text-center"
                    style={{ color: TEXT_DIM, borderLeft: `1px solid ${BORDER}` }}
                  >
                    Error
                  </td>
                )}
            </tr>
            {/* Run B */}
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td
                className="px-3 py-1 text-[10px]"
                style={{ color: COPPER }}
              >
                Run B
              </td>
              {runB
                ? runB.map((v, i) => (
                    <ScoreCell
                      key={i}
                      orig={orig[i]}
                      retest={v}
                      axisIdx={i}
                    />
                  ))
                : (
                  <td
                    colSpan={9}
                    className="px-3 py-1 text-center"
                    style={{ color: TEXT_DIM, borderLeft: `1px solid ${BORDER}` }}
                  >
                    Error
                  </td>
                )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Aesthetic summaries */}
      <div style={{ borderTop: `1px solid ${BORDER}` }}>
        {[
          { label: "Original", summary: origSummary, color: TEXT_LIGHT },
          { label: "Run A", summary: runASummary, color: GREEN },
          { label: "Run B", summary: runBSummary, color: COPPER },
        ].map(
          ({ label, summary, color }) =>
            summary && (
              <div
                key={label}
                className="px-4 py-2.5"
                style={{ borderBottom: `1px solid ${BORDER}` }}
              >
                <span
                  className="mr-2 text-[8px] font-bold uppercase tracking-widest"
                  style={{ fontFamily: MONO, color }}
                >
                  {label}
                </span>
                <span
                  className="text-[12px] leading-[1.65] italic"
                  style={{ fontFamily: BODY, color: TEXT_MID }}
                >
                  {summary}
                </span>
              </div>
            ),
        )}
      </div>

      {/* Insight callout */}
      {insight && (
        <div
          className="px-4 py-3"
          style={{
            backgroundColor: "rgba(184, 115, 51, 0.06)",
            borderLeft: `3px solid ${COPPER}`,
          }}
        >
          <span
            className="mr-2 text-[8px] font-bold uppercase tracking-widest"
            style={{ fontFamily: MONO, color: COPPER }}
          >
            Analysis
          </span>
          <span
            className="text-[12.5px] leading-[1.7]"
            style={{ fontFamily: BODY, color: TEXT_MID }}
          >
            {insight}
          </span>
        </div>
      )}
      </div>
    </div>
  );
}

export function ReliabilityAppendix() {
  const perfect = data.features.filter((f) => f.exact === 9).length;
  const nearPerfect = data.features.filter((f) => f.exact >= 7).length;

  return (
    <div
      className="relative mx-auto w-full"
      style={{
        maxWidth: "var(--grid-max-width)",
        paddingLeft: "var(--grid-margin)",
        paddingRight: "var(--grid-margin)",
        paddingTop: "60px",
        paddingBottom: "80px",
      }}
    >
      {/* Header */}
      <p
        className="text-[11px] font-bold uppercase tracking-[0.15em]"
        style={{ fontFamily: MONO, color: COPPER }}
      >
        Appendix &middot; Scoring Reliability
      </p>

      <h1
        className="mt-3 text-[36px] font-bold leading-[1.1] tracking-tight"
        style={{ fontFamily: MONO, color: TEXT_LIGHT }}
      >
        TEST&ndash;RETEST: ALL 100 HOMES
      </h1>

      <p
        className="mt-3 text-[14px] leading-[1.7]"
        style={{ fontFamily: BODY, color: TEXT_MID }}
      >
        Every home below was scored three independent times by Claude Opus 4.6
        using the same v2.3 instrument: nine axes, 1&ndash;5 scale, original
        magazine page images. No run has access to prior scores. Sorted by
        number of exact matches (fewest first) so the most interesting
        disagreements appear at the top.
      </p>

      {/* Summary stats */}
      <div
        className="mt-6 flex flex-wrap gap-6"
      >
        {[
          { stat: `${perfect}`, label: "Perfect 9/9", color: GREEN },
          { stat: `${nearPerfect}`, label: "\u2265 7/9", color: GOLD },
          { stat: `${data.n}`, label: "Total homes", color: TEXT_MID },
          { stat: "900", label: "Axis comparisons", color: TEXT_MID },
        ].map((item) => (
          <div key={item.label} className="flex items-baseline gap-2">
            <span
              className="text-[24px] font-bold"
              style={{ fontFamily: MONO, color: item.color }}
            >
              {item.stat}
            </span>
            <span
              className="text-[11px] tracking-wider"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Back link */}
      <div className="mt-6">
        <a
          href="/#aesthetic-methodology"
          className="text-[12px] underline decoration-1 underline-offset-2"
          style={{ fontFamily: MONO, color: COPPER }}
        >
          &larr; Back to Methodology
        </a>
      </div>

      <div className="mt-4" style={{ borderTop: `1px solid ${BORDER}` }} />

      {/* All features */}
      <div className="mt-8 flex flex-col gap-14">
        {data.features.map((feature, i) => (
          <FeatureCard key={feature.id} feature={feature} index={i} />
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-12 rounded border p-6 text-center"
        style={{
          backgroundColor: CARD_DEEP,
          borderColor: BORDER,
        }}
      >
        <p
          className="text-[13px] leading-[1.7]"
          style={{ fontFamily: BODY, color: TEXT_MID }}
        >
          All scores produced by Claude Opus 4.6 &middot; v2.3 scoring
          instrument &middot; Seed 42 random sample &middot; Total cost: $34.89
          &middot;{" "}
          <a
            href="/#aesthetic-methodology"
            className="underline"
            style={{ color: COPPER }}
          >
            Full methodology
          </a>
        </p>
      </div>
    </div>
  );
}
