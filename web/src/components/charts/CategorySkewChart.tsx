"use client";

import { useMounted } from "@/lib/use-mounted";

interface CategoryRow {
  category: string;
  baselinePct: number;
  epsteinPct: number;
}

interface CategorySkewChartProps {
  data: CategoryRow[];
}

/**
 * Multiplier chart showing how much each category is over/underrepresented
 * in the Epstein orbit vs AD baseline. Bar length = ratio (epstein / baseline).
 * 1.0x = baseline line. >1x = overrepresented, <1x = underrepresented.
 */
export function CategorySkewChart({ data }: CategorySkewChartProps) {
  const mounted = useMounted();

  if (!mounted || data.length === 0) return null;

  // Calculate multipliers and sort descending
  const withMultiplier = data
    .filter((c) => c.baselinePct > 0 && c.category !== "Private")
    .map((c) => ({
      ...c,
      multiplier: c.epsteinPct / c.baselinePct,
    }))
    .sort((a, b) => b.multiplier - a.multiplier);

  const maxMult = Math.max(...withMultiplier.map((c) => c.multiplier), 1);
  // Round up to nearest 0.5x for clean scale
  const scaleMax = Math.ceil(maxMult * 2) / 2;

  const FONT = "futura-pt, sans-serif";
  const MONO = "var(--font-jetbrains-mono), monospace";
  const LABEL_W = 72;
  const BAR_H = 24;
  const GAP = 5;

  // Position of 1.0x baseline line
  const baselinePos = (1 / scaleMax) * 100;

  return (
    <div className="px-4 py-3">
      {/* Bars */}
      <div className="flex flex-col" style={{ gap: GAP }}>
        {withMultiplier.map((row) => {
          const barW = (row.multiplier / scaleMax) * 100;
          const over = row.multiplier >= 1;

          return (
            <div key={row.category} className="flex items-center">
              {/* Category label */}
              <div
                className="shrink-0 pr-3 text-right text-[10px] font-bold"
                style={{ width: LABEL_W, fontFamily: FONT, color: "#333" }}
              >
                {row.category}
              </div>

              {/* Bar area */}
              <div
                className="relative flex-1"
                style={{ height: BAR_H }}
              >
                {/* 1.0x baseline marker */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${baselinePos}%`,
                    width: 1,
                    backgroundColor: "#000",
                  }}
                />

                {/* Bar */}
                <div
                  className="absolute top-1 bottom-1 left-0"
                  style={{
                    width: `${barW}%`,
                    backgroundColor: over ? "#C0392B" : "rgba(0, 0, 0, 0.08)",
                    opacity: over ? 0.15 + 0.85 * (row.multiplier / scaleMax) : 1,
                  }}
                />

                {/* Multiplier label at end of bar */}
                <span
                  className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold tabular-nums"
                  style={{
                    left: `${barW + 1}%`,
                    fontFamily: MONO,
                    color: over ? "#A93226" : "#999",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.multiplier.toFixed(1)}x
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scale label */}
      <div className="relative mt-1" style={{ marginLeft: LABEL_W }}>
        <span
          className="absolute -translate-x-1/2 text-[8px]"
          style={{
            left: `${baselinePos}%`,
            fontFamily: FONT,
            color: "#999",
          }}
        >
          1.0x
        </span>
      </div>
    </div>
  );
}
