"use client";

import { useMounted } from "@/lib/use-mounted";

interface WealthCategory {
  key: string;
  label: string;
  color: string;
  epsteinPct: number;
  baselinePct: number;
}

const CATEGORIES: WealthCategory[] = [
  { key: "SELF_MADE", label: "Self-Made", color: "#7A8B99", epsteinPct: 52.4, baselinePct: 66.0 },
  { key: "MIXED", label: "Mixed", color: "#B87333", epsteinPct: 25.9, baselinePct: 13.3 },
  { key: "OLD_MONEY", label: "Old Money", color: "#A69580", epsteinPct: 15.4, baselinePct: 16.0 },
  { key: "MARRIED_INTO", label: "Married Into", color: "#C4B5A5", epsteinPct: 6.3, baselinePct: 4.8 },
];

/**
 * Stacked horizontal bar chart comparing wealth origin composition
 * between AD baseline and Epstein orbit homeowners.
 */
export function WealthOriginStacked() {
  const mounted = useMounted();
  if (!mounted) return null;

  const rows: { label: string; labelSub: string; segments: { key: string; pct: number; color: string; catLabel: string }[] }[] = [
    {
      label: "AD Baseline",
      labelSub: "n = 188",
      segments: CATEGORIES.map((c) => ({ key: c.key, pct: c.baselinePct, color: c.color, catLabel: c.label })),
    },
    {
      label: "Epstein Orbit",
      labelSub: "n = 143",
      segments: CATEGORIES.map((c) => ({ key: c.key, pct: c.epsteinPct, color: c.color, catLabel: c.label })),
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {CATEGORIES.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[10px] w-[10px] rounded-sm"
              style={{ backgroundColor: c.color }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.08em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#666" }}
            >
              {c.label}
            </span>
          </span>
        ))}
      </div>

      {/* Bars */}
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            {/* Row label */}
            <div className="shrink-0" style={{ width: 90 }}>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.06em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: "#333" }}
              >
                {row.label}
              </div>
              <div
                className="text-[9px] tabular-nums"
                style={{ fontFamily: "futura-pt, sans-serif", color: "#999" }}
              >
                {row.labelSub}
              </div>
            </div>

            {/* Stacked bar */}
            <div className="flex flex-1 overflow-hidden rounded-sm" style={{ height: 28 }}>
              {row.segments.map((seg) => (
                <div
                  key={seg.key}
                  className="relative flex items-center justify-center overflow-hidden"
                  style={{
                    width: `${seg.pct}%`,
                    backgroundColor: seg.color,
                    minWidth: seg.pct > 3 ? undefined : 0,
                  }}
                >
                  {seg.pct >= 8 && (
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{
                        fontFamily: "futura-pt, sans-serif",
                        color: seg.key === "MIXED" ? "#FFF" : "rgba(255,255,255,0.9)",
                      }}
                    >
                      {seg.pct}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Annotation callout for MIXED */}
      <div
        className="mt-1 rounded-sm px-3 py-2"
        style={{ backgroundColor: "rgba(184,115,51,0.08)", borderLeft: "3px solid #B87333" }}
      >
        <span
          className="text-[11px] leading-snug"
          style={{ fontFamily: "futura-pt, sans-serif", color: "#5C3D1E" }}
        >
          <strong>Mixed</strong> (inherited platform + self-amplified) is nearly 2&times; overrepresented in the Epstein orbit — 25.9% vs. 13.3% baseline.{" "}
          <strong>Self-Made</strong> drops 13.5 percentage points.
        </span>
      </div>
    </div>
  );
}
