"use client";

import { useMounted } from "@/lib/use-mounted";

interface CategoryRow {
  category: string;
  baselinePct: number;
  epsteinPct: number;
}

interface CategorySlopeChartProps {
  data: CategoryRow[];
}

/**
 * Slope chart comparing AD baseline vs Epstein orbit category percentages.
 * Two vertical axes — lines connect each category's position across both.
 * Categories that climb = overrepresented in Epstein orbit.
 */
export function CategorySlopeChart({ data }: CategorySlopeChartProps) {
  const mounted = useMounted();
  if (!mounted || data.length === 0) return null;

  const maxPct = Math.max(...data.map((c) => Math.max(c.baselinePct, c.epsteinPct)), 1);

  // Sort by Epstein % descending for right-axis ordering
  const sorted = [...data].sort((a, b) => b.epsteinPct - a.epsteinPct);

  // SVG dimensions
  const W = 360;
  const H = 280;
  const PAD_TOP = 32;
  const PAD_BOTTOM = 12;
  const PAD_LEFT = 80;
  const PAD_RIGHT = 80;
  const AXIS_LEFT = PAD_LEFT;
  const AXIS_RIGHT = W - PAD_RIGHT;

  const chartH = H - PAD_TOP - PAD_BOTTOM;

  // Y position from percentage (0% at bottom, maxPct at top)
  const yFromPct = (pct: number) => PAD_TOP + chartH - (pct / maxPct) * chartH;

  const FONT = "futura-pt, sans-serif";
  const MONO = "var(--font-jetbrains-mono), monospace";

  return (
    <div className="px-2 py-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: FONT }}>
        {/* Axis labels */}
        <text
          x={AXIS_LEFT}
          y={PAD_TOP - 16}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          letterSpacing="0.1em"
          fill="#999"
          style={{ textTransform: "uppercase" as const }}
        >
          AD Baseline
        </text>
        <text
          x={AXIS_RIGHT}
          y={PAD_TOP - 16}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          letterSpacing="0.1em"
          fill="#C0392B"
          style={{ textTransform: "uppercase" as const }}
        >
          Epstein Orbit
        </text>

        {/* Vertical axis lines */}
        <line x1={AXIS_LEFT} y1={PAD_TOP} x2={AXIS_LEFT} y2={PAD_TOP + chartH} stroke="#DCDCDC" strokeWidth={1} />
        <line x1={AXIS_RIGHT} y1={PAD_TOP} x2={AXIS_RIGHT} y2={PAD_TOP + chartH} stroke="#DCDCDC" strokeWidth={1} />

        {/* Horizontal grid lines */}
        {[0, 5, 10, 15, 20, 25, 30].filter((v) => v <= maxPct).map((v) => (
          <line
            key={v}
            x1={AXIS_LEFT}
            y1={yFromPct(v)}
            x2={AXIS_RIGHT}
            y2={yFromPct(v)}
            stroke="#F0F0F0"
            strokeWidth={0.5}
          />
        ))}

        {/* Slope lines + labels */}
        {sorted.map((row) => {
          const y1 = yFromPct(row.baselinePct);
          const y2 = yFromPct(row.epsteinPct);
          const rising = row.epsteinPct > row.baselinePct;
          const strokeColor = rising ? "#C0392B" : "#CCCCCC";
          const strokeW = rising ? 2 : 1;
          const opacity = rising ? 0.9 : 0.45;

          return (
            <g key={row.category} opacity={opacity}>
              {/* Connecting line */}
              <line
                x1={AXIS_LEFT}
                y1={y1}
                x2={AXIS_RIGHT}
                y2={y2}
                stroke={strokeColor}
                strokeWidth={strokeW}
              />

              {/* Left dot + label */}
              <circle cx={AXIS_LEFT} cy={y1} r={3.5} fill={rising ? "#666" : "#CCC"} />
              <text
                x={AXIS_LEFT - 8}
                y={y1}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={700}
                fill={rising ? "#333" : "#999"}
              >
                {row.category}
              </text>
              <text
                x={AXIS_LEFT - 8}
                y={y1 + 11}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={8}
                fontFamily={MONO}
                fill={rising ? "#666" : "#AAA"}
              >
                {row.baselinePct}%
              </text>

              {/* Right dot + label */}
              <circle cx={AXIS_RIGHT} cy={y2} r={4} fill={rising ? "#C0392B" : "#CCC"} />
              <text
                x={AXIS_RIGHT + 8}
                y={y2}
                textAnchor="start"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={700}
                fill={rising ? "#A93226" : "#999"}
              >
                {row.epsteinPct}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
