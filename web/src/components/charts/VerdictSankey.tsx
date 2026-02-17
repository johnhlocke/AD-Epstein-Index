"use client";

import { useMounted } from "@/lib/use-mounted";
import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import type { NodeProps, LinkProps } from "recharts/types/chart/Sankey";

// ── Colors (on-system per design-rules.md) ──────────────────
const MONO = "JetBrains Mono, monospace";
const GREEN = "rgba(45, 106, 79, 0.95)";       // #2D6A4F — forest green
const GREEN_DIM = "rgba(45, 106, 79, 0.25)";
const RED = "rgba(155, 34, 38, 0.85)";          // #9B2226
const RED_DIM = "rgba(155, 34, 38, 0.2)";
const GOLD = "rgba(184, 134, 11, 0.9)";         // #B8860B
const GOLD_DIM = "rgba(184, 134, 11, 0.2)";
const COPPER = "#B87333";
const COPPER_DIM = "rgba(184, 115, 51, 0.25)";
const SLATE = "rgba(74, 124, 143, 0.85)";       // #4A7C8F
const SLATE_DIM = "rgba(74, 124, 143, 0.2)";
const NEUTRAL = "rgba(160, 160, 176, 0.6)";
const NEUTRAL_DIM = "rgba(160, 160, 176, 0.15)";

// Color scheme by node name
const NODE_THEME: Record<string, { fill: string; stroke: string }> = {
  // Stage -1: corpus
  "FEATURES EXTRACTED": { fill: NEUTRAL_DIM, stroke: NEUTRAL },
  "ANONYMOUS": { fill: "rgba(160, 160, 176, 0.08)", stroke: "rgba(160, 160, 176, 0.3)" },
  // Stage 0
  "CROSS-REFERENCED NAMES": { fill: NEUTRAL_DIM, stroke: NEUTRAL },
  "DISMISSED":         { fill: RED_DIM, stroke: RED },
  // Stage 1: detective tiers
  "CONFIRMED MATCH":   { fill: GREEN_DIM, stroke: GREEN },
  "LIKELY MATCH":      { fill: COPPER_DIM, stroke: COPPER },
  "POSSIBLE MATCH":    { fill: GOLD_DIM, stroke: GOLD },
  "NEEDS REVIEW":      { fill: SLATE_DIM, stroke: SLATE },
  "NO MATCH":          { fill: RED_DIM, stroke: RED },
  "PENDING":           { fill: NEUTRAL_DIM, stroke: NEUTRAL },
  // Stage 2: researcher dossier
  "DOSSIER BUILT":     { fill: "rgba(130, 100, 180, 0.2)", stroke: "rgba(130, 100, 180, 0.7)" },
  // Stage 3: editor verdict
  "CONFIRMED":         { fill: GREEN_DIM, stroke: GREEN },
  "REJECTED":          { fill: RED_DIM, stroke: RED },
  // Stage 3: connection strength
  "HIGH":              { fill: GREEN_DIM, stroke: GREEN },
  "MEDIUM":            { fill: COPPER_DIM, stroke: COPPER },
  "LOW":               { fill: GOLD_DIM, stroke: GOLD },
  "COINCIDENCE":       { fill: SLATE_DIM, stroke: SLATE },
};

const LINK_THEME: Record<string, string> = {
  "ANONYMOUS": "rgba(160, 160, 176, 0.06)",
  "CROSS-REFERENCED NAMES": "rgba(160, 160, 176, 0.08)",
  "DISMISSED":         "rgba(155, 34, 38, 0.12)",
  "CONFIRMED MATCH":   "rgba(45, 106, 79, 0.14)",
  "LIKELY MATCH":      "rgba(184, 115, 51, 0.14)",
  "POSSIBLE MATCH":    "rgba(184, 134, 11, 0.10)",
  "NEEDS REVIEW":      "rgba(74, 124, 143, 0.10)",
  "NO MATCH":          "rgba(155, 34, 38, 0.10)",
  "PENDING":           "rgba(160, 160, 176, 0.08)",
  "DOSSIER BUILT":     "rgba(130, 100, 180, 0.12)",
  "CONFIRMED":         "rgba(45, 106, 79, 0.18)",
  "REJECTED":          "rgba(155, 34, 38, 0.12)",
  "HIGH":              "rgba(45, 106, 79, 0.18)",
  "MEDIUM":            "rgba(184, 115, 51, 0.14)",
  "LOW":               "rgba(184, 134, 11, 0.10)",
  "COINCIDENCE":       "rgba(74, 124, 143, 0.08)",
};

// Agent attribution by node name — correlates with vertical flow diagram
const NODE_AGENT: Record<string, string> = {
  "FEATURES EXTRACTED":      "Reader + Courier",
  "CROSS-REFERENCED NAMES":  "Detective",
  "DISMISSED":               "Detective",
  "CONFIRMED MATCH":         "Detective",
  "LIKELY MATCH":            "Detective",
  "POSSIBLE MATCH":          "Detective",
  "NEEDS REVIEW":            "Detective",
  "NO MATCH":                "Detective",
  "PENDING":                 "Detective",
  "DOSSIER BUILT":            "Researcher",
  "CONFIRMED":               "Editor",
  "REJECTED":                "Editor",
  "HIGH":                    "Editor",
  "MEDIUM":                  "Editor",
  "LOW":                     "Editor",
  "COINCIDENCE":             "Editor",
};

const DEFAULT_NODE = { fill: NEUTRAL_DIM, stroke: "rgba(160, 160, 176, 0.4)" };

interface VerdictSankeyProps {
  featuresTotal: number;
  crossRefsTotal: number;
  dossiersTotal: number;
  confirmed: number;
  rejected: number;
  tierToConfirmed: Record<string, number>;
  tierToRejected: Record<string, number>;
  strengthCounts: Record<string, number>;
}

// ── Custom Node ──────────────────────────────────────────────
function CustomNode(props: NodeProps) {
  const { x, y, width, height, payload } = props;
  const name = (payload as { name?: string })?.name ?? "";
  const value = (payload as { value?: number })?.value ?? 0;
  const colors = NODE_THEME[name] ?? DEFAULT_NODE;
  const agent = NODE_AGENT[name];

  const labelX = x + width + 8;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1.5}
        rx={2}
      />
      {/* Value */}
      <text
        x={labelX}
        y={y + height / 2 - (agent ? 4 : 1)}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={10}
        fontFamily={MONO}
        fill="rgba(224, 224, 229, 0.95)"
        fontWeight="bold"
        letterSpacing="0.04em"
      >
        {value.toLocaleString()}
      </text>
      {/* Name */}
      <text
        x={labelX}
        y={y + height / 2 + (agent ? 8 : 11)}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={7}
        fontFamily={MONO}
        fill="rgba(160, 160, 176, 0.55)"
        letterSpacing="0.1em"
      >
        {name}
      </text>
      {/* Agent attribution */}
      {agent && (
        <text
          x={labelX}
          y={y + height / 2 + 19}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={6.5}
          fontFamily={MONO}
          fill="rgba(160, 160, 176, 0.3)"
          letterSpacing="0.06em"
          fontStyle="italic"
        >
          {agent}
        </text>
      )}
    </g>
  );
}

// ── Custom Link ──────────────────────────────────────────────
function CustomLink(props: LinkProps) {
  const {
    sourceX,
    targetX,
    sourceY,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth,
    payload,
  } = props;

  const targetName = (payload?.target as { name?: string })?.name ?? "";
  const fillColor = LINK_THEME[targetName] ?? "rgba(160, 160, 176, 0.05)";
  const halfWidth = linkWidth / 2;

  return (
    <path
      d={`
        M${sourceX},${sourceY + halfWidth}
        C${sourceControlX},${sourceY + halfWidth}
          ${targetControlX},${targetY + halfWidth}
          ${targetX},${targetY + halfWidth}
        L${targetX},${targetY - halfWidth}
        C${targetControlX},${targetY - halfWidth}
          ${sourceControlX},${sourceY - halfWidth}
          ${sourceX},${sourceY - halfWidth}
        Z
      `}
      fill={fillColor}
      stroke="none"
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  if (!item) return null;

  // Node tooltip
  if (item.payload?.name && !item.payload?.source) {
    const agent = NODE_AGENT[item.payload.name];
    return (
      <div
        className="rounded border px-3 py-2 shadow-lg"
        style={{ backgroundColor: "#111118", borderColor: "#2a2a3a" }}
      >
        <p
          className="text-[11px] font-bold tracking-wider"
          style={{ fontFamily: MONO, color: "#E0E0E5" }}
        >
          {item.payload.name}
        </p>
        <p
          className="mt-0.5 text-[10px]"
          style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.6)" }}
        >
          {Number(item.payload.value ?? 0).toLocaleString()} names
        </p>
        {agent && (
          <p
            className="mt-1 text-[9px]"
            style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.4)" }}
          >
            {agent}
          </p>
        )}
      </div>
    );
  }

  // Link tooltip
  const source = item.payload?.source?.name ?? "";
  const target = item.payload?.target?.name ?? "";
  const value = item.value ?? 0;
  return (
    <div
      className="rounded border px-3 py-2 shadow-lg"
      style={{ backgroundColor: "#111118", borderColor: "#2a2a3a" }}
    >
      <p
        className="text-[10px] tracking-wider"
        style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.6)" }}
      >
        {source} &rarr; {target}
      </p>
      <p
        className="mt-0.5 text-[11px] font-bold"
        style={{ fontFamily: MONO, color: "#E0E0E5" }}
      >
        {Number(value).toLocaleString()} names
      </p>
    </div>
  );
}

// Detective tier display order + labels
const TIER_ORDER = [
  { key: "confirmed_match", label: "CONFIRMED MATCH" },
  { key: "likely_match", label: "LIKELY MATCH" },
  { key: "possible_match", label: "POSSIBLE MATCH" },
  { key: "needs_review", label: "NEEDS REVIEW" },
  { key: "no_match", label: "NO MATCH" },
  { key: "pending", label: "PENDING" },
];

const STRENGTH_ORDER = ["HIGH", "MEDIUM", "LOW", "COINCIDENCE"];

export function VerdictSankey({
  featuresTotal,
  crossRefsTotal,
  dossiersTotal,
  confirmed,
  rejected,
  tierToConfirmed,
  tierToRejected,
  strengthCounts,
}: VerdictSankeyProps) {
  const mounted = useMounted();
  if (!mounted) return null;

  const anonymous = featuresTotal - crossRefsTotal;
  const dismissed = crossRefsTotal - dossiersTotal;

  // Build nodes and links for a 6-stage funnel:
  // Stage 0: FEATURES EXTRACTED → ANONYMOUS + CROSS-REFERENCED NAMES (Reader + Courier)
  // Stage 1: CROSS-REFERENCED NAMES → DISMISSED + detective tiers (Detective)
  // Stage 2: detective tiers → DOSSIER BUILT (Researcher)
  // Stage 3: DOSSIER BUILT → CONFIRMED + REJECTED (Editor)
  // Stage 4: CONFIRMED → HIGH + MEDIUM + LOW + COINCIDENCE (Editor)

  const nodes: { name: string }[] = [];
  const links: { source: number; target: number; value: number }[] = [];

  // Node 0: corpus entry
  nodes.push({ name: "FEATURES EXTRACTED" });    // idx 0

  // Node 1: anonymous (features without cross-referenced names)
  nodes.push({ name: "ANONYMOUS" });              // idx 1
  links.push({ source: 0, target: 1, value: Math.max(anonymous, 1) });

  // Node 2: cross-referenced names
  const xrefIdx = nodes.length;
  nodes.push({ name: "CROSS-REFERENCED NAMES" }); // idx 2
  links.push({ source: 0, target: xrefIdx, value: Math.max(crossRefsTotal, 1) });

  // Node 3: dismissed
  const dismissedIdx = nodes.length;
  nodes.push({ name: "DISMISSED" });             // idx 3
  links.push({ source: xrefIdx, target: dismissedIdx, value: Math.max(dismissed, 1) });

  // Stage 1: detective tiers — only add tiers that have data
  const tierIndices: Record<string, number> = {};
  for (const { key, label } of TIER_ORDER) {
    const conf = tierToConfirmed[key] ?? 0;
    const rej = tierToRejected[key] ?? 0;
    const total = conf + rej;
    if (total === 0) continue;

    const idx = nodes.length;
    nodes.push({ name: label });
    tierIndices[key] = idx;
    links.push({ source: xrefIdx, target: idx, value: total });
  }

  // Stage 2: DOSSIER BUILT — Researcher investigates each lead
  const dossierIdx = nodes.length;
  nodes.push({ name: "DOSSIER BUILT" });

  // Link each tier to DOSSIER BUILT (pass-through)
  for (const { key } of TIER_ORDER) {
    const tierIdx = tierIndices[key];
    if (tierIdx === undefined) continue;
    const conf = tierToConfirmed[key] ?? 0;
    const rej = tierToRejected[key] ?? 0;
    const total = conf + rej;
    if (total > 0) links.push({ source: tierIdx, target: dossierIdx, value: total });
  }

  // Stage 3: editor verdicts
  const confirmedIdx = nodes.length;
  nodes.push({ name: "CONFIRMED" });
  const rejectedIdx = nodes.length;
  nodes.push({ name: "REJECTED" });

  // Link DOSSIER BUILT to CONFIRMED / REJECTED
  if (confirmed > 0) links.push({ source: dossierIdx, target: confirmedIdx, value: confirmed });
  if (rejected > 0) links.push({ source: dossierIdx, target: rejectedIdx, value: rejected });

  // Stage 4: connection strength from CONFIRMED
  const strengthIndices: Record<string, number> = {};
  for (const s of STRENGTH_ORDER) {
    const count = strengthCounts[s] ?? 0;
    if (count === 0) continue;
    const idx = nodes.length;
    nodes.push({ name: s });
    strengthIndices[s] = idx;
    links.push({ source: confirmedIdx, target: idx, value: count });
  }

  const data = { nodes, links };
  const rejectionRate = crossRefsTotal > 0
    ? Math.round(((crossRefsTotal - confirmed) / crossRefsTotal) * 100)
    : 0;

  return (
    <div className="flex flex-col">
      {/* Context annotation */}
      <div className="flex items-baseline gap-3 px-3 pb-1 pt-2">
        <p
          className="text-[9px] tracking-wider"
          style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.45)" }}
        >
          {featuresTotal.toLocaleString()} features &rarr; {crossRefsTotal.toLocaleString()} names cross-referenced
        </p>
        <p
          className="text-[9px] tracking-wider"
          style={{ fontFamily: MONO, color: "rgba(155, 34, 38, 0.6)" }}
        >
          {rejectionRate}% rejection rate
        </p>
      </div>
      {/* Sankey chart */}
      <div className="h-[600px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={data}
            nodeWidth={12}
            nodePadding={22}
            linkCurvature={0.5}
            iterations={64}
            sort={false}
            margin={{ top: 12, right: 80, bottom: 32, left: 10 }}
            node={CustomNode}
            link={CustomLink}
          >
            <Tooltip content={<CustomTooltip />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
