"use client";

import { useMounted } from "@/lib/use-mounted";

/**
 * Forbes Self-Made Score heatmap — 10 columns (scores 1–10) × 6 rows
 * (Epstein ALL/HIGH/MED, Baseline ALL/HIGH/MED).
 *
 * Data is static from the expanded Forbes scoring run (461 people).
 * All LOW-confidence results eliminated — only HIGH and MEDIUM retained.
 * Red (#C0392B) saturation for Epstein rows, teal for baseline rows.
 * Per-group normalization. Count displayed inside each cell.
 */

type ScoreRow = Record<number, number>;

interface GroupData {
  HIGH: ScoreRow;
  MEDIUM: ScoreRow;
}

const EPSTEIN: GroupData = {
  HIGH:   { 1: 1, 2: 12, 3: 9, 4: 7, 5: 8, 6: 2, 7: 2, 8: 11, 9: 8 },
  MEDIUM: { 1: 1, 3: 9, 4: 5, 5: 7, 6: 11, 7: 50, 8: 16, 9: 2 },
};

const BASELINE: GroupData = {
  HIGH:   { 1: 20, 2: 11, 3: 9, 4: 6, 5: 4, 6: 1, 7: 2, 8: 8, 9: 16, 10: 1 },
  MEDIUM: { 1: 3, 2: 21, 3: 21, 4: 4, 5: 13, 6: 34, 7: 71, 8: 40, 9: 14 },
};

function compositeRow(data: GroupData): ScoreRow {
  const all: ScoreRow = {};
  for (const conf of ["HIGH", "MEDIUM"] as const) {
    for (const [s, v] of Object.entries(data[conf])) {
      all[Number(s)] = (all[Number(s)] ?? 0) + v;
    }
  }
  return all;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CONF_LEVELS: (keyof GroupData)[] = ["HIGH", "MEDIUM"];
const CONF_LABELS: Record<string, string> = { HIGH: "High", MEDIUM: "Med" };

const RED = { r: 192, g: 57, b: 43 };
const TEAL = { r: 26, g: 158, b: 143 };

function cellBg(count: number, groupMax: number, base: { r: number; g: number; b: number }): string {
  if (count === 0) return "#F5F5F5";
  const t = Math.sqrt(count / groupMax);
  const opacity = 0.15 + 0.85 * t;
  return `rgba(${base.r}, ${base.g}, ${base.b}, ${opacity.toFixed(2)})`;
}

function cellText(count: number, groupMax: number): string {
  if (count === 0) return "transparent";
  const t = Math.sqrt(count / groupMax);
  return t > 0.55 ? "#fff" : "#333";
}

const FONT = "futura-pt, sans-serif";
const MONO = "var(--font-jetbrains-mono), monospace";

function renderRow(
  label: string,
  row: ScoreRow,
  groupMax: number,
  base: { r: number; g: number; b: number },
  isComposite: boolean,
  key: string,
) {
  const counts = SCORES.map((s) => row[s] ?? 0);
  const rowTotal = counts.reduce((s, v) => s + v, 0);

  return (
    <tr key={key}>
      <td
        className="pr-2 text-right text-[10px]"
        style={{
          fontFamily: FONT,
          color: isComposite ? `rgb(${base.r}, ${base.g}, ${base.b})` : "#999",
          width: 40,
          fontWeight: isComposite ? 700 : 600,
          verticalAlign: "middle",
          borderTop: isComposite ? `1px solid rgb(${base.r}, ${base.g}, ${base.b})` : undefined,
          paddingTop: isComposite ? 3 : undefined,
        }}
      >
        {label}
        <span
          className="ml-1 text-[8px] font-normal tabular-nums"
          style={{ color: isComposite ? `rgb(${base.r}, ${base.g}, ${base.b})` : "#BBB" }}
        >
          {rowTotal}
        </span>
      </td>
      {SCORES.map((score) => {
        const count = row[score] ?? 0;
        return (
          <td
            key={score}
            className="text-center"
            style={{
              backgroundColor: cellBg(count, groupMax, base),
              color: cellText(count, groupMax),
              fontFamily: MONO,
              fontSize: isComposite ? 12 : 11,
              fontWeight: 700,
              width: "9%",
              height: isComposite ? 32 : 26,
              border: "1px solid #fff",
              borderTop: isComposite ? `1px solid rgb(${base.r}, ${base.g}, ${base.b})` : "1px solid #fff",
            }}
          >
            {count > 0 ? count : ""}
          </td>
        );
      })}
    </tr>
  );
}

export function ForbesHeatmap() {
  const mounted = useMounted();
  if (!mounted) return null;

  function renderGroup(
    label: string,
    data: GroupData,
    base: { r: number; g: number; b: number },
    nTotal: number,
  ) {
    const allRow = compositeRow(data);
    // Group max includes composite for normalization
    const groupMax = Math.max(
      ...SCORES.map((s) => allRow[s] ?? 0),
      1,
    );

    return (
      <>
        <tr>
          <td
            colSpan={11}
            className="px-2 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ fontFamily: FONT, color: `rgb(${base.r}, ${base.g}, ${base.b})`, borderBottom: `2px solid rgb(${base.r}, ${base.g}, ${base.b})` }}
          >
            {label} <span style={{ fontWeight: 400, color: "#999" }}>(n={nTotal})</span>
          </td>
        </tr>
        {CONF_LEVELS.map((conf) =>
          renderRow(CONF_LABELS[conf], data[conf], groupMax, base, false, `${label}-${conf}`)
        )}
        {renderRow("All", allRow, groupMax, base, true, `${label}-ALL`)}
      </>
    );
  }

  return (
    <div className="px-3 py-3">
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: 40 }} />
            {SCORES.map((s) => (
              <th
                key={s}
                className="pb-1 text-center text-[10px] font-bold"
                style={{ fontFamily: FONT, color: "#666" }}
              >
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renderGroup("Epstein Orbit", EPSTEIN, RED, 161)}
          {renderGroup("AD Baseline", BASELINE, TEAL, 300)}
        </tbody>
      </table>

      {/* Scale legend */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: FONT, color: "#999" }}>
            Inherited
          </span>
          <svg width="60" height="4">
            <rect width="60" height="4" rx="1" fill="url(#scoreGrad)" />
            <defs>
              <linearGradient id="scoreGrad">
                <stop offset="0%" stopColor="#C0392B" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#999" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#1A9E8F" stopOpacity="0.6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-[8px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: FONT, color: "#999" }}>
            Self-Made
          </span>
        </div>
        <span className="text-[8px]" style={{ fontFamily: FONT, color: "#BBB" }}>
          Forbes 1&ndash;10 scale &rarr;
        </span>
      </div>

      {/* Annotation */}
      <div
        className="mt-3 rounded-sm px-3 py-2"
        style={{ backgroundColor: "rgba(192,57,43,0.07)", borderLeft: "3px solid #C0392B" }}
      >
        <span
          className="text-[11px] leading-snug"
          style={{ fontFamily: FONT, color: "#7B241C" }}
        >
          <strong>Epstein HIGH confidence</strong>: bimodal&thinsp;&mdash;&thinsp;inherited (1&ndash;4) <em>and</em> humble
          self-made (8&ndash;9), with just 4 names at 6&ndash;7.
          <br />
          <strong>Baseline</strong> concentrates at 6&ndash;7 in MEDIUM, but HIGH confidence
          is bimodal too&thinsp;&mdash;&thinsp;heavily inherited (1&ndash;3) <em>and</em> self-made (8&ndash;9).
          All LOW-confidence defaults eliminated.
        </span>
      </div>
    </div>
  );
}
