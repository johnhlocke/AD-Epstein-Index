"use client";

import { useMounted } from "@/lib/use-mounted";
import { GROUP_COLORS } from "@/lib/design-tokens";

/* ────────────────────────────────────────────────────────────
   PCA results computed from 1,000 scored AD features (9 axes).
   StandardScaler → PCA via sklearn.
   ──────────────────────────────────────────────────────────── */

const VARIANCE = [41.3, 24.7, 8.6, 7.8, 6.2, 4.3, 2.6, 2.3, 2.2];
const CUMULATIVE = [41.3, 66.0, 74.6, 82.4, 88.6, 92.9, 95.5, 97.8, 100.0];

interface LoadingRow {
  label: string;
  shortLabel: string;
  group: "SPACE" | "STORY" | "STAGE";
  pc1: number;
  pc2: number;
}

const LOADINGS: LoadingRow[] = [
  { label: "Theatricality", shortLabel: "Thtr", group: "STAGE", pc1: +0.436, pc2: +0.086 },
  { label: "Curation", shortLabel: "Cur", group: "STAGE", pc1: +0.415, pc2: +0.094 },
  { label: "Formality", shortLabel: "Form", group: "STAGE", pc1: +0.386, pc2: +0.307 },
  { label: "Provenance", shortLabel: "Prov", group: "STORY", pc1: -0.376, pc2: +0.319 },
  { label: "Material Warmth", shortLabel: "Wrm", group: "SPACE", pc1: -0.348, pc2: +0.248 },
  { label: "Grandeur", shortLabel: "Grnd", group: "SPACE", pc1: +0.337, pc2: +0.349 },
  { label: "Hospitality", shortLabel: "Hosp", group: "STORY", pc1: +0.256, pc2: +0.299 },
  { label: "Historicism", shortLabel: "Hist", group: "STORY", pc1: -0.163, pc2: +0.552 },
  { label: "Maximalism", shortLabel: "Max", group: "SPACE", pc1: -0.143, pc2: +0.465 },
];

// Sort by PC1 loading for the diverging bar chart
const LOADINGS_SORTED = [...LOADINGS].sort((a, b) => a.pc1 - b.pc1);

const N = 3763;

/* ── Scree Plot ── */

function ScreePlot() {
  const W = 400;
  const H = 200;
  const ML = 36;
  const MR = 12;
  const MT = 16;
  const MB = 32;
  const chartW = W - ML - MR;
  const chartH = H - MT - MB;

  const barW = chartW / 9 - 4;
  const maxVal = 50;

  return (
    <div>
      <div className="mb-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Scree Plot &mdash; Variance Explained per Component
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, fontFamily: "futura-pt, sans-serif" }}
      >
        {/* Y-axis grid */}
        {[0, 10, 20, 30, 40, 50].map((v) => {
          const y = MT + chartH - (v / maxVal) * chartH;
          return (
            <g key={v}>
              <line x1={ML} y1={y} x2={W - MR} y2={y} stroke="#E5E5E5" strokeWidth={0.5} />
              <text x={ML - 4} y={y} textAnchor="end" dominantBaseline="central" fontSize={8} fill="#AAA">
                {v}%
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {VARIANCE.map((v, i) => {
          const x = ML + i * (chartW / 9) + 2;
          const barH = (v / maxVal) * chartH;
          const y = MT + chartH - barH;
          // First two bars highlighted (above the elbow)
          const fill = i < 2 ? "#B87333" : "#D4D0C8";
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={fill} rx={2} />
              {/* Value label */}
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={8}
                fontWeight={i < 2 ? "700" : "400"}
                fill={i < 2 ? "#4A3828" : "#AAA"}
              >
                {v.toFixed(1)}%
              </text>
              {/* X label */}
              <text
                x={x + barW / 2}
                y={MT + chartH + 14}
                textAnchor="middle"
                fontSize={8}
                fill="#AAA"
              >
                PC{i + 1}
              </text>
            </g>
          );
        })}

        {/* Cumulative line */}
        {CUMULATIVE.map((v, i) => {
          const x = ML + i * (chartW / 9) + 2 + barW / 2;
          const y = MT + chartH - (v / 100) * chartH;
          const prev = i > 0 ? {
            x: ML + (i - 1) * (chartW / 9) + 2 + barW / 2,
            y: MT + chartH - (CUMULATIVE[i - 1] / 100) * chartH,
          } : null;
          return (
            <g key={`cum-${i}`}>
              {prev && (
                <line x1={prev.x} y1={prev.y} x2={x} y2={y} stroke="#999" strokeWidth={1} strokeDasharray="3,2" />
              )}
              <circle cx={x} cy={y} r={2.5} fill="#999" />
              {(i === 1 || i === 2) && (
                <text x={x + 6} y={y - 2} fontSize={7} fill="#999">
                  {v.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Elbow annotation */}
        <line
          x1={ML + 2 * (chartW / 9) - 1}
          y1={MT}
          x2={ML + 2 * (chartW / 9) - 1}
          y2={MT + chartH}
          stroke="#B87333"
          strokeWidth={1}
          strokeDasharray="4,3"
          opacity={0.5}
        />
        <text
          x={ML + 2 * (chartW / 9) + 4}
          y={MT + 8}
          fontSize={7}
          fill="#B87333"
          fontWeight="700"
        >
          elbow
        </text>
      </svg>
    </div>
  );
}

/* ── PC1 Loadings — Diverging Bar Chart ── */

function LoadingsChart() {
  const W = 400;
  const H = 240;
  const ML = 110;
  const MR = 16;
  const MT = 16;
  const MB = 24;
  const chartW = W - ML - MR;
  const chartH = H - MT - MB;

  const rowH = chartH / LOADINGS_SORTED.length;
  const maxAbs = 0.5;
  const centerX = ML + chartW / 2;

  return (
    <div>
      <div className="mb-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          PC1 Loadings &mdash; Performance vs. Authenticity
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, fontFamily: "futura-pt, sans-serif" }}
      >
        {/* Center line */}
        <line
          x1={centerX}
          y1={MT}
          x2={centerX}
          y2={MT + chartH}
          stroke="#CCC"
          strokeWidth={0.75}
        />

        {/* Axis labels */}
        <text x={ML + 4} y={MT + chartH + 14} fontSize={7} fill="#AAA" textAnchor="start">
          Authenticity
        </text>
        <text x={W - MR - 4} y={MT + chartH + 14} fontSize={7} fill="#AAA" textAnchor="end">
          Performance
        </text>

        {/* Zero label */}
        <text x={centerX} y={MT + chartH + 14} fontSize={7} fill="#CCC" textAnchor="middle">
          0
        </text>

        {LOADINGS_SORTED.map((row, i) => {
          const y = MT + i * rowH + rowH / 2;
          const barLen = (Math.abs(row.pc1) / maxAbs) * (chartW / 2);
          const isPositive = row.pc1 > 0;
          const barX = isPositive ? centerX : centerX - barLen;
          const color = GROUP_COLORS[row.group];

          return (
            <g key={row.label}>
              {/* Subtle row line */}
              <line
                x1={ML}
                y1={y}
                x2={W - MR}
                y2={y}
                stroke="#F0F0F0"
                strokeWidth={0.5}
              />

              {/* Label */}
              <text
                x={ML - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={9}
                fill="#4A3828"
                fontWeight="500"
              >
                {row.label}
              </text>

              {/* Group dot */}
              <circle
                cx={ML - 2}
                cy={y}
                r={2.5}
                fill={color}
              />

              {/* Bar */}
              <rect
                x={barX}
                y={y - rowH * 0.3}
                width={barLen}
                height={rowH * 0.6}
                fill={color}
                opacity={0.75}
                rx={2}
              />

              {/* Value */}
              <text
                x={isPositive ? barX + barLen + 4 : barX - 4}
                y={y}
                textAnchor={isPositive ? "start" : "end"}
                dominantBaseline="central"
                fontSize={8}
                fontWeight="600"
                fill={color}
              >
                {row.pc1 > 0 ? "+" : ""}{row.pc1.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Correlation Heatmaps (Ideal + Actual) ── */

const SHORT_LABELS = ["Grnd", "Wrm", "Max", "Hist", "Prov", "Hosp", "Form", "Cur", "Thtr"];

const AXIS_GROUPS: ("SPACE" | "STORY" | "STAGE")[] = [
  "SPACE", "SPACE", "SPACE", "STORY", "STORY", "STORY", "STAGE", "STAGE", "STAGE",
];

const CORR: number[][] = [
  [+1.00, -0.27, +0.04, +0.15, -0.20, +0.48, +0.66, +0.43, +0.51],
  [-0.27, +1.00, +0.41, +0.44, +0.50, -0.10, -0.42, -0.34, -0.48],
  [+0.04, +0.41, +1.00, +0.54, +0.53, +0.09, +0.06, -0.08, +0.03],
  [+0.15, +0.44, +0.54, +1.00, +0.59, +0.10, +0.17, -0.11, -0.20],
  [-0.20, +0.50, +0.53, +0.59, +1.00, -0.17, -0.28, -0.56, -0.52],
  [+0.48, -0.10, +0.09, +0.10, -0.17, +1.00, +0.33, +0.38, +0.42],
  [+0.66, -0.42, +0.06, +0.17, -0.28, +0.33, +1.00, +0.62, +0.62],
  [+0.43, -0.34, -0.08, -0.11, -0.56, +0.38, +0.62, +1.00, +0.67],
  [+0.51, -0.48, +0.03, -0.20, -0.52, +0.42, +0.62, +0.67, +1.00],
];

/** What a perfect 3-group structure would look like:
 *  ~0.70 within-group, ~0.05 between-group */
const IDEAL: number[][] = [
  [+1.00, +0.70, +0.70, +0.05, +0.05, +0.05, +0.05, +0.05, +0.05],
  [+0.70, +1.00, +0.70, +0.05, +0.05, +0.05, +0.05, +0.05, +0.05],
  [+0.70, +0.70, +1.00, +0.05, +0.05, +0.05, +0.05, +0.05, +0.05],
  [+0.05, +0.05, +0.05, +1.00, +0.70, +0.70, +0.05, +0.05, +0.05],
  [+0.05, +0.05, +0.05, +0.70, +1.00, +0.70, +0.05, +0.05, +0.05],
  [+0.05, +0.05, +0.05, +0.70, +0.70, +1.00, +0.05, +0.05, +0.05],
  [+0.05, +0.05, +0.05, +0.05, +0.05, +0.05, +1.00, +0.70, +0.70],
  [+0.05, +0.05, +0.05, +0.05, +0.05, +0.05, +0.70, +1.00, +0.70],
  [+0.05, +0.05, +0.05, +0.05, +0.05, +0.05, +0.70, +0.70, +1.00],
];

/** Map correlation value (-1 to +1) to a diverging color (blue ← white → copper) */
function corrColor(v: number): string {
  if (v >= 0) {
    // White → copper
    const t = Math.min(v, 1);
    const r = Math.round(255 - t * 71);  // 255 → 184
    const g = Math.round(255 - t * 140); // 255 → 115
    const b = Math.round(255 - t * 204); // 255 → 51
    return `rgb(${r},${g},${b})`;
  } else {
    // White → steel blue
    const t = Math.min(-v, 1);
    const r = Math.round(255 - t * 181); // 255 → 74
    const g = Math.round(255 - t * 131); // 255 → 124
    const b = Math.round(255 - t * 112); // 255 → 143
    return `rgb(${r},${g},${b})`;
  }
}

function corrTextColor(v: number): string {
  return Math.abs(v) > 0.4 ? "#FFF" : "#4A3828";
}

function HeatmapGrid({ data, title, showValues }: {
  data: number[][];
  title: string;
  showValues?: boolean;
}) {
  const cellSize = 36;
  const labelW = 44;
  const labelH = 30;
  const W = labelW + 9 * cellSize;
  const H = labelH + 9 * cellSize;
  const show = showValues !== false;

  return (
    <div>
      <div className="mb-2">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          {title}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, fontFamily: "futura-pt, sans-serif" }}
      >
        {/* Column headers */}
        {SHORT_LABELS.map((label, j) => (
          <text
            key={`col-${j}`}
            x={labelW + j * cellSize + cellSize / 2}
            y={labelH - 6}
            textAnchor="middle"
            fontSize={7}
            fill={GROUP_COLORS[AXIS_GROUPS[j]]}
            fontWeight="600"
          >
            {label}
          </text>
        ))}

        {/* Group brackets along top */}
        {[
          { label: "SPACE", start: 0, end: 2 },
          { label: "STORY", start: 3, end: 5 },
          { label: "STAGE", start: 6, end: 8 },
        ].map((g) => {
          const x1 = labelW + g.start * cellSize + 2;
          const x2 = labelW + (g.end + 1) * cellSize - 2;
          return (
            <line
              key={`bracket-${g.label}`}
              x1={x1}
              y1={labelH - 1}
              x2={x2}
              y2={labelH - 1}
              stroke={GROUP_COLORS[g.label as keyof typeof GROUP_COLORS]}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.5}
            />
          );
        })}

        {/* Row headers */}
        {SHORT_LABELS.map((label, i) => (
          <text
            key={`row-${i}`}
            x={labelW - 4}
            y={labelH + i * cellSize + cellSize / 2}
            textAnchor="end"
            dominantBaseline="central"
            fontSize={7}
            fill={GROUP_COLORS[AXIS_GROUPS[i]]}
            fontWeight="600"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {data.map((row, i) =>
          row.map((v, j) => {
            const x = labelW + j * cellSize;
            const y = labelH + i * cellSize;
            return (
              <g key={`cell-${i}-${j}`}>
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={cellSize - 2}
                  height={cellSize - 2}
                  fill={i === j ? "#F5F5F5" : corrColor(v)}
                  rx={2}
                />
                {show && (
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={i === j ? 7 : 8}
                    fontWeight={Math.abs(v) >= 0.5 && i !== j ? "700" : "400"}
                    fill={i === j ? "#CCC" : corrTextColor(v)}
                  >
                    {i === j ? "\u2014" : (v > 0 ? "+" : "") + v.toFixed(2)}
                  </text>
                )}
              </g>
            );
          }),
        )}

        {/* Group separator lines */}
        {[3, 6].map((idx) => (
          <g key={`sep-${idx}`}>
            <line
              x1={labelW + idx * cellSize}
              y1={labelH}
              x2={labelW + idx * cellSize}
              y2={H}
              stroke="#D4D0C8"
              strokeWidth={1}
            />
            <line
              x1={labelW}
              y1={labelH + idx * cellSize}
              x2={W}
              y2={labelH + idx * cellSize}
              stroke="#D4D0C8"
              strokeWidth={1}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Annotated Heatmap — reordered by actual clusters ── */

/** Reorder indices: Authenticity (Wrm, Max, Hist, Prov) then Performance (Grnd, Hosp, Form, Cur, Thtr) */
const REORDER = [1, 2, 3, 4, 0, 5, 6, 7, 8];
const REORDER_SHORT = REORDER.map((i) => SHORT_LABELS[i]);
const REORDER_CORR = REORDER.map((i) => REORDER.map((j) => CORR[i][j]));
const CLUSTER_SPLIT = 4; // first 4 = Authenticity, last 5 = Performance

function AnnotatedHeatmap() {
  const cellSize = 36;
  const labelW = 44;
  const labelH = 30;
  const W = labelW + 9 * cellSize;
  const H = labelH + 9 * cellSize;

  return (
    <div>
      <div className="mb-2">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Annotated &mdash; Axes Reordered by Actual Clusters
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, fontFamily: "futura-pt, sans-serif" }}
      >
        {/* Column headers — colored by cluster */}
        {REORDER_SHORT.map((label, j) => (
          <text
            key={`col-${j}`}
            x={labelW + j * cellSize + cellSize / 2}
            y={labelH - 6}
            textAnchor="middle"
            fontSize={7}
            fill={j < CLUSTER_SPLIT ? GROUP_COLORS.STORY : GROUP_COLORS.STAGE}
            fontWeight="600"
          >
            {label}
          </text>
        ))}

        {/* Cluster brackets along top */}
        {[
          { label: "AUTHENTICITY", color: GROUP_COLORS.STORY, start: 0, end: CLUSTER_SPLIT - 1 },
          { label: "PERFORMANCE", color: GROUP_COLORS.STAGE, start: CLUSTER_SPLIT, end: 8 },
        ].map((g) => {
          const x1 = labelW + g.start * cellSize + 2;
          const x2 = labelW + (g.end + 1) * cellSize - 2;
          return (
            <line
              key={`bracket-${g.label}`}
              x1={x1}
              y1={labelH - 1}
              x2={x2}
              y2={labelH - 1}
              stroke={g.color}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.7}
            />
          );
        })}

        {/* Row headers — colored by cluster */}
        {REORDER_SHORT.map((label, i) => (
          <text
            key={`row-${i}`}
            x={labelW - 4}
            y={labelH + i * cellSize + cellSize / 2}
            textAnchor="end"
            dominantBaseline="central"
            fontSize={7}
            fill={i < CLUSTER_SPLIT ? GROUP_COLORS.STORY : GROUP_COLORS.STAGE}
            fontWeight="600"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {REORDER_CORR.map((row, i) =>
          row.map((v, j) => {
            const x = labelW + j * cellSize;
            const y = labelH + i * cellSize;
            return (
              <g key={`cell-${i}-${j}`}>
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={cellSize - 2}
                  height={cellSize - 2}
                  fill={i === j ? "#F5F5F5" : corrColor(v)}
                  rx={2}
                />
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={i === j ? 7 : 8}
                  fontWeight={Math.abs(v) >= 0.5 && i !== j ? "700" : "400"}
                  fill={i === j ? "#CCC" : corrTextColor(v)}
                >
                  {i === j ? "\u2014" : (v > 0 ? "+" : "") + v.toFixed(2)}
                </text>
              </g>
            );
          }),
        )}

        {/* Cluster split line */}
        <line
          x1={labelW + CLUSTER_SPLIT * cellSize}
          y1={labelH}
          x2={labelW + CLUSTER_SPLIT * cellSize}
          y2={H}
          stroke="#D4D0C8"
          strokeWidth={1}
        />
        <line
          x1={labelW}
          y1={labelH + CLUSTER_SPLIT * cellSize}
          x2={W}
          y2={labelH + CLUSTER_SPLIT * cellSize}
          stroke="#D4D0C8"
          strokeWidth={1}
        />

        {/* ── Bold cluster outlines ── */}

        {/* Authenticity block (top-left 4×4) */}
        <rect
          x={labelW + 1}
          y={labelH + 1}
          width={CLUSTER_SPLIT * cellSize - 2}
          height={CLUSTER_SPLIT * cellSize - 2}
          fill="none"
          stroke={GROUP_COLORS.STORY}
          strokeWidth={3}
          rx={3}
          opacity={0.8}
        />

        {/* Performance block (bottom-right 5×5) */}
        <rect
          x={labelW + CLUSTER_SPLIT * cellSize + 1}
          y={labelH + CLUSTER_SPLIT * cellSize + 1}
          width={(9 - CLUSTER_SPLIT) * cellSize - 2}
          height={(9 - CLUSTER_SPLIT) * cellSize - 2}
          fill="none"
          stroke={GROUP_COLORS.STAGE}
          strokeWidth={3}
          rx={3}
          opacity={0.8}
        />

        {/* Anti-correlation zone (top-right quadrant) */}
        <rect
          x={labelW + CLUSTER_SPLIT * cellSize + 1}
          y={labelH + 1}
          width={(9 - CLUSTER_SPLIT) * cellSize - 2}
          height={CLUSTER_SPLIT * cellSize - 2}
          fill="none"
          stroke="#4A7C8F"
          strokeWidth={2}
          strokeDasharray="6,3"
          rx={3}
          opacity={0.6}
        />

        {/* Anti-correlation zone (bottom-left quadrant) */}
        <rect
          x={labelW + 1}
          y={labelH + CLUSTER_SPLIT * cellSize + 1}
          width={CLUSTER_SPLIT * cellSize - 2}
          height={(9 - CLUSTER_SPLIT) * cellSize - 2}
          fill="none"
          stroke="#4A7C8F"
          strokeWidth={2}
          strokeDasharray="6,3"
          rx={3}
          opacity={0.6}
        />

        {/* Cluster labels */}
        <text
          x={labelW + (CLUSTER_SPLIT * cellSize) / 2}
          y={H + 14}
          textAnchor="middle"
          fontSize={8}
          fontWeight="700"
          fill={GROUP_COLORS.STORY}
          letterSpacing="0.08em"
        >
          AUTHENTICITY
        </text>
        <text
          x={labelW + CLUSTER_SPLIT * cellSize + ((9 - CLUSTER_SPLIT) * cellSize) / 2}
          y={H + 14}
          textAnchor="middle"
          fontSize={8}
          fontWeight="700"
          fill={GROUP_COLORS.STAGE}
          letterSpacing="0.08em"
        >
          PERFORMANCE
        </text>

        {/* Anti-correlation label */}
        <text
          x={labelW + CLUSTER_SPLIT * cellSize + ((9 - CLUSTER_SPLIT) * cellSize) / 2}
          y={labelH + (CLUSTER_SPLIT * cellSize) / 2 - 6}
          textAnchor="middle"
          fontSize={7}
          fill="#4A7C8F"
          fontWeight="600"
          opacity={0.8}
        >
          anti-
        </text>
        <text
          x={labelW + CLUSTER_SPLIT * cellSize + ((9 - CLUSTER_SPLIT) * cellSize) / 2}
          y={labelH + (CLUSTER_SPLIT * cellSize) / 2 + 4}
          textAnchor="middle"
          fontSize={7}
          fill="#4A7C8F"
          fontWeight="600"
          opacity={0.8}
        >
          correlated
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[10px] w-[10px] rounded-[2px] border-2"
            style={{ borderColor: GROUP_COLORS.STORY }}
          />
          <span className="text-[8px] font-medium text-[#737373]" style={{ fontFamily: "futura-pt, sans-serif" }}>
            Correlated cluster
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[10px] w-[10px] rounded-[2px] border-2 border-dashed"
            style={{ borderColor: "#4A7C8F" }}
          />
          <span className="text-[8px] font-medium text-[#737373]" style={{ fontFamily: "futura-pt, sans-serif" }}>
            Anti-correlated zone
          </span>
        </span>
      </div>
    </div>
  );
}

/* ── Methodology Card ── */

function MethodologyCard() {
  return (
    <div>
      <div className="mb-3">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          How We Calculated This
        </span>
      </div>

      <div className="space-y-4">
        {/* Correlation */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: "futura-pt, sans-serif", color: "#4A3828" }}
          >
            1. Pearson Correlation
          </p>
          <div
            className="mt-1 rounded bg-[#F0EDE8] px-3 py-2 font-mono text-[11px] leading-[1.6] text-[#4A3828]"
          >
            r = &Sigma;(x&#7522; &minus; x&#772;)(y&#7522; &minus; y&#772;) &frasl; &radic;[&Sigma;(x&#7522; &minus; x&#772;)&sup2; &times; &Sigma;(y&#7522; &minus; y&#772;)&sup2;]
          </div>
          <p className="mt-1 font-serif text-[12px] leading-[1.5] text-[#737373]">
            Measures linear association between each pair of axes across
            all {N} homes. Values range from &minus;1 (perfectly opposed) to
            +1 (move in lockstep). The heatmap above is this matrix.
          </p>
        </div>

        {/* PCA */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: "futura-pt, sans-serif", color: "#4A3828" }}
          >
            2. Principal Component Analysis
          </p>
          <div
            className="mt-1 rounded bg-[#F0EDE8] px-3 py-2 font-mono text-[11px] leading-[1.6] text-[#4A3828]"
          >
            R &middot; v = &lambda; &middot; v
          </div>
          <p className="mt-1 font-serif text-[12px] leading-[1.5] text-[#737373]">
            Eigendecomposition of the correlation matrix R. Each
            eigenvalue &lambda; measures how much variance that component
            captures. The eigenvector v gives the loadings &mdash; the
            weight of each axis on that component. We standardize all
            scores (zero mean, unit variance) before computing R so that
            no axis dominates by scale. Variance explained =
            &lambda;&#7522; &frasl; &Sigma;&lambda;.
          </p>
        </div>

        {/* Cronbach's Alpha */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: "futura-pt, sans-serif", color: "#4A3828" }}
          >
            3. Cronbach&rsquo;s Alpha
          </p>
          <div
            className="mt-1 rounded bg-[#F0EDE8] px-3 py-2 font-mono text-[11px] leading-[1.6] text-[#4A3828]"
          >
            &alpha; = (k &frasl; (k&minus;1)) &times; (1 &minus; &Sigma;&sigma;&#7522;&sup2; &frasl; &sigma;&sup2;<sub>total</sub>)
          </div>
          <p className="mt-1 font-serif text-[12px] leading-[1.5] text-[#737373]">
            Measures internal consistency: do the axes in a composite move
            together? k = number of axes in the group, &sigma;&#7522;&sup2; =
            variance of each axis, &sigma;&sup2;<sub>total</sub> = variance
            of their sum. Above 0.70 is generally accepted as a valid
            composite. STAGE scores 0.83, Authenticity scores 0.75.
          </p>
        </div>

        {/* Tools */}
        <div className="rounded border border-border bg-white px-3 py-2">
          <p
            className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#AAA]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Tools
          </p>
          <p className="mt-1 font-serif text-[11px] leading-[1.5] text-[#737373]">
            Python 3.14, scikit-learn (StandardScaler, PCA), NumPy.
            All scores are integer 1&ndash;5 from Claude Opus 4 vision
            analysis of magazine spread images. n&nbsp;=&nbsp;{N}.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Exported Section ── */

export function PCASection() {
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Row 1: Scree plot + Loadings */}
      <div className="grid gap-6 md:grid-cols-2">
        <div
          className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "#FAFAFA" }}
        >
          <ScreePlot />
        </div>
        <div
          className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "#FAFAFA" }}
        >
          <LoadingsChart />
        </div>
      </div>

      {/* Row 2: Ideal vs Actual correlation heatmaps */}
      <div className="grid gap-6 md:grid-cols-2">
        <div
          className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "#FAFAFA" }}
        >
          <HeatmapGrid
            data={IDEAL}
            title="Ideal &mdash; If All Three Groups Were Valid"
            showValues={false}
          />
          <p
            className="mt-2 text-center text-[8px] uppercase tracking-[0.1em] text-[#AAA]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Three hot blocks on diagonal, cool everywhere else
          </p>
        </div>
        <div
          className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "#FAFAFA" }}
        >
          <HeatmapGrid
            data={CORR}
            title="Actual &mdash; What 3,763 AD Homes Show"
          />
          {/* Shared legend */}
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-[7px] text-[#AAA]" style={{ fontFamily: "futura-pt, sans-serif" }}>
              &minus;0.60
            </span>
            <div className="flex h-[8px] w-[120px] overflow-hidden rounded-[2px]">
              {Array.from({ length: 24 }, (_, i) => {
                const v = -0.6 + (i / 23) * 1.28;
                return (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: corrColor(v) }}
                  />
                );
              })}
            </div>
            <span className="text-[7px] text-[#AAA]" style={{ fontFamily: "futura-pt, sans-serif" }}>
              +0.67
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Annotated heatmap — reordered by actual clusters */}
      <div
        className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <AnnotatedHeatmap />
      </div>

      {/* Honest reading: ideal vs actual comparison */}
      <div
        className="rounded border border-border bg-[#FAFAFA] px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      >
        <p
          className="mb-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Reading the Comparison
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: GROUP_COLORS.STAGE }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: GROUP_COLORS.STAGE }}
              >
                Stage &mdash; Validated
              </span>
            </div>
            <p className="font-serif text-[13px] leading-[1.6] text-[#1A1A1A]">
              The bottom-right block matches the ideal pattern almost exactly.
              Formality, Curation, and Theatricality correlate at +0.62 to +0.67
              &mdash; a cohesive cluster. Cronbach&rsquo;s &alpha;&nbsp;=&nbsp;0.83.
              This group measures one real thing: <em>performative display</em>.
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: GROUP_COLORS.STORY }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: GROUP_COLORS.STORY }}
              >
                Story &mdash; Partially Validated
              </span>
            </div>
            <p className="font-serif text-[13px] leading-[1.6] text-[#1A1A1A]">
              The center block is mixed. Historicism and Provenance correlate
              strongly (+0.59), but Hospitality does not belong with them
              &mdash; it correlates more with Grandeur (+0.48) and the STAGE
              axes. The original trio doesn&rsquo;t cohere, so we replace it
              with a validated composite: Material&nbsp;Warmth + Provenance +
              Historicism (&alpha;&nbsp;=&nbsp;0.75).
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: GROUP_COLORS.SPACE }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: GROUP_COLORS.SPACE }}
              >
                Space &mdash; Not Validated
              </span>
            </div>
            <p className="font-serif text-[13px] leading-[1.6] text-[#1A1A1A]">
              The top-left block shows no internal cohesion. Grandeur correlates
              with the STAGE axes (+0.51 to +0.66), not with its supposed
              groupmates. Material Warmth anti-correlates with Grandeur (&minus;0.27).
              These three axes measure different things, not one construct.
              &alpha;&nbsp;=&nbsp;0.19 &mdash; well below any validity threshold.
            </p>
          </div>
        </div>
        <p className="mt-4 font-serif text-[12px] italic leading-[1.5] text-[#737373]">
          The data supports two natural clusters, not three. Our nine axes are
          individually meaningful &mdash; each describes a specific, interpretable
          quality of a home &mdash; but they collapse into two validated composites
          for statistical analysis: <strong>Stage</strong> (performance) and{" "}
          <strong>Authenticity</strong> (genuine accumulation), which are
          anti-correlated at r&nbsp;=&nbsp;&minus;0.39.
        </p>
      </div>

      {/* Row 3: Methodology */}
      <div
        className="rounded border border-border p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <MethodologyCard />
      </div>
    </div>
  );
}
