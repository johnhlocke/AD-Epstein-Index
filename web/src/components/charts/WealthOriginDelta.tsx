"use client";

import { useMounted } from "@/lib/use-mounted";

interface DeltaRow {
  key: string;
  label: string;
  epsteinPct: number;
  baselinePct: number;
  delta: number; // positive = Epstein higher
}

const ROWS: DeltaRow[] = [
  { key: "MIXED", label: "Mixed", epsteinPct: 25.9, baselinePct: 13.3, delta: 12.6 },
  { key: "MARRIED_INTO", label: "Married Into", epsteinPct: 6.3, baselinePct: 4.8, delta: 1.5 },
  { key: "OLD_MONEY", label: "Old Money", epsteinPct: 15.4, baselinePct: 16.0, delta: -0.6 },
  { key: "SELF_MADE", label: "Self-Made", epsteinPct: 52.4, baselinePct: 66.0, delta: -13.5 },
];

const MAX_DELTA = 15; // scale bars to ±15pp
const RED = "#C0392B";
const GREY = "#999";

/**
 * Diverging delta bar chart showing the percentage-point difference
 * between Epstein orbit and AD baseline wealth origin classifications.
 * Bars extend left (Epstein lower) or right (Epstein higher) from center.
 */
export function WealthOriginDelta() {
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {/* Header labels */}
      <div style={{ paddingLeft: 4, paddingRight: 4 }}>
        <div className="flex">
          <div className="flex flex-col items-start" style={{ width: "50%" }}>
            <span
              className="whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.1em]"
              style={{ fontFamily: "var(--font-jetbrains-mono), monospace", color: "#999" }}
            >
              Baseline Higher
            </span>
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" width="100%" height="6" style={{ display: "block", marginTop: 2 }}>
              <line x1="4" y1="3" x2="100" y2="3" stroke="#444" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <polygon points="0,3 5,0 5,6" fill="#444" />
            </svg>
          </div>
          <div className="flex flex-col items-end" style={{ width: "50%" }}>
            <span
              className="whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.1em]"
              style={{ fontFamily: "var(--font-jetbrains-mono), monospace", color: "#999" }}
            >
              Epstein Higher
            </span>
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" width="100%" height="6" style={{ display: "block", marginTop: 2 }}>
              <line x1="0" y1="3" x2="96" y2="3" stroke="#444" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <polygon points="100,3 95,0 95,6" fill="#444" />
            </svg>
          </div>
        </div>
      </div>

      {/* Delta rows — wrapped in relative container for continuous center line */}
      <div className="relative">
        {/* Continuous center line spanning all rows */}
        <div
          className="absolute top-0 bottom-0"
          style={{ left: "calc(50% + 10px)", width: 2, backgroundColor: "#333", marginLeft: -1, zIndex: 0 }}
        />

        <div className="flex flex-col gap-3">
          {ROWS.map((row) => {
            const isPositive = row.delta >= 0;
            const count = Math.round(Math.abs(row.delta));

            return (
              <div key={row.key} className="flex items-center gap-0">
                {/* Label */}
                <div
                  className="shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.04em]"
                  style={{
                    width: 76,
                    paddingRight: 8,
                    fontFamily: "futura-pt, sans-serif",
                    color: row.key === "MIXED" ? RED : "#444",
                    lineHeight: 1.0,
                  }}
                >
                  {row.label}
                </div>

                {/* Bar area — unit boxes, each = 1pp, fit within half-width */}
                <div className="relative flex-1" style={{ height: 18, zIndex: 1 }}>
                  <div
                    className="absolute top-0"
                    style={{
                      height: 18,
                      display: "grid",
                      gridTemplateColumns: `repeat(${count}, 1fr)`,
                      gap: 1,
                      ...(isPositive
                        ? { left: "calc(50% + 3px)", width: `calc(${(count / MAX_DELTA) * 50}% - 3px)` }
                        : { right: "calc(50% + 3px)", width: `calc(${(count / MAX_DELTA) * 50}% - 3px)` }),
                    }}
                  >
                    {Array.from({ length: count }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          height: 18,
                          backgroundColor: isPositive ? RED : "#BCBCBC",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Delta value */}
                <div className="shrink-0 text-right" style={{ width: 56 }}>
                  <span
                    className="text-[12px] font-bold tabular-nums"
                    style={{
                      fontFamily: "futura-pt, sans-serif",
                      color: isPositive ? RED : GREY,
                    }}
                  >
                    {isPositive ? "+" : ""}
                    {row.delta.toFixed(1)}
                    <span className="text-[9px] font-normal">%</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scale ticks */}
      <div className="relative" style={{ marginLeft: 80, marginRight: 56, height: 14 }}>
        {[-15, -10, -5, 0, 5, 10, 15].map((v) => (
          <span
            key={v}
            className="absolute -translate-x-1/2 text-[7px] tabular-nums"
            style={{
              left: `${((v + MAX_DELTA) / (MAX_DELTA * 2)) * 100}%`,
              fontFamily: "futura-pt, sans-serif",
              color: "#A3A3A3",
            }}
          >
            {v === 0 ? "0" : `${v > 0 ? "+" : ""}${v}`}
          </span>
        ))}
      </div>

      {/* Annotation */}
      <div
        className="mt-2 rounded-sm px-3 py-2"
        style={{ backgroundColor: "rgba(192,57,43,0.07)", borderLeft: "3px solid #C0392B" }}
      >
        <span
          className="text-[11px] leading-snug"
          style={{ fontFamily: "futura-pt, sans-serif", color: "#7B241C" }}
        >
          <strong>Mixed</strong> (inherited platform + self-amplified) is nearly 2&times; overrepresented
          in the Epstein orbit&thinsp;&mdash;&thinsp;25.9% vs.&nbsp;13.3% baseline.{" "}
          <strong>Self-Made</strong> drops 13.5 percentage points. The displacement is nearly 1:1.
        </span>
      </div>
    </div>
  );
}
