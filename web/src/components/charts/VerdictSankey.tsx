"use client";

import { useMemo } from "react";
import { useMounted } from "@/lib/use-mounted";
import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import type { NodeProps, LinkProps } from "recharts/types/chart/Sankey";

// ── Two-tone narrative palette ───────────────────────────────
// Warm neutral → deepening red as investigation confirms connection.
// Teal for cleared/dismissed path. Exact hex colors per spec.
const MONO = "JetBrains Mono, monospace";

// Node colors: 100% opaque (solid bars)
// Link gradient colors: 95% opacity at stops
//
// Confirmation path (warm neutral → blood red):
//   Features Extracted  #afaaa6 / grad #c6c1bd
//   Cross-Referenced    #edafa2 / grad #eebcb1
//   Likely Match        #d66a5d / grad #d47367
//   Dossier Built       #b8141f / grad #b61f29
//   Confirmed           #7f000f / grad #7d0514
//
// Other tiers interpolate between Cross-Referenced and Dossier Built.

// ── Dark variant (methodology section, dark bg) ─────────────
const NODE_THEME: Record<string, { fill: string; stroke: string }> = {
  "AD FEATURES SINCE 1988":      { fill: "#afaaa6", stroke: "#afaaa6" },
  "ANONYMOUS":               { fill: "#000000", stroke: "#000000" },
  "HOMEOWNER NAMES":  { fill: "#edafa2", stroke: "#edafa2" },
  "DISMISSED":               { fill: "#013539", stroke: "#013539" },
  "SUSPECTED EPSTEIN CONNECTION":            { fill: "#d66a5d", stroke: "#d66a5d" },
  "CONFIRMED MATCH":         { fill: "#c24035", stroke: "#c24035" },
  "LIKELY CONNECTION":          { fill: "#e08a7e", stroke: "#e08a7e" },
  "NEEDS REVIEW":            { fill: "#b8a8a0", stroke: "#b8a8a0" },
  "NO MATCH":                { fill: "#013539", stroke: "#013539" },
  "PENDING":                 { fill: "#b0a8a2", stroke: "#b0a8a2" },
  "DOSSIER BUILT":           { fill: "#b8141f", stroke: "#b8141f" },
  "REJECTED":                { fill: "#013539", stroke: "#013539" },
  "CONFIRMED EPSTEIN CONNECTION":               { fill: "#7f000f", stroke: "#7f000f" },
};

// Link gradient endpoints: { rgb, a } for linearGradient stops.
interface LinkEnd { rgb: string; a: number }
const LINK_COLORS: Record<string, LinkEnd> = {
  "AD FEATURES SINCE 1988":      { rgb: "198, 193, 189", a: 0.95 },  // #c6c1bd
  "ANONYMOUS":               { rgb: "0, 0, 0", a: 0.95 },
  "HOMEOWNER NAMES":  { rgb: "238, 188, 177", a: 0.95 },  // #eebcb1
  "DISMISSED":               { rgb: "5, 61, 67", a: 0.95 },
  "SUSPECTED EPSTEIN CONNECTION":            { rgb: "212, 115, 103", a: 0.95 },  // #d47367
  "CONFIRMED MATCH":         { rgb: "194, 64, 53", a: 0.95 },
  "LIKELY CONNECTION":          { rgb: "224, 138, 126", a: 0.95 },
  "NEEDS REVIEW":            { rgb: "184, 168, 160", a: 0.95 },
  "NO MATCH":                { rgb: "5, 61, 67", a: 0.95 },
  "PENDING":                 { rgb: "176, 168, 162", a: 0.95 },
  "DOSSIER BUILT":           { rgb: "182, 31, 41", a: 0.95 },    // #b61f29
  "REJECTED":                { rgb: "5, 61, 67", a: 0.95 },
  "CONFIRMED EPSTEIN CONNECTION":               { rgb: "125, 5, 20", a: 0.95 },     // #7d0514
};

const DEFAULT_NODE = { fill: "#afaaa6", stroke: "#afaaa6" };

// ── Light variant (paper/findings sections, cream bg) ────────
const LIGHT_NODE_THEME: Record<string, { fill: string; stroke: string }> = {
  "AD FEATURES SINCE 1988":      { fill: "#afaaa6", stroke: "#afaaa6" },
  "ANONYMOUS":               { fill: "#000000", stroke: "#000000" },
  "HOMEOWNER NAMES":  { fill: "#edafa2", stroke: "#edafa2" },
  "DISMISSED":               { fill: "#013539", stroke: "#013539" },
  "SUSPECTED EPSTEIN CONNECTION":            { fill: "#d66a5d", stroke: "#d66a5d" },
  "CONFIRMED MATCH":         { fill: "#c24035", stroke: "#c24035" },
  "LIKELY CONNECTION":          { fill: "#e08a7e", stroke: "#e08a7e" },
  "NEEDS REVIEW":            { fill: "#b8a8a0", stroke: "#b8a8a0" },
  "NO MATCH":                { fill: "#013539", stroke: "#013539" },
  "PENDING":                 { fill: "#b0a8a2", stroke: "#b0a8a2" },
  "DOSSIER BUILT":           { fill: "#b8141f", stroke: "#b8141f" },
  "REJECTED":                { fill: "#013539", stroke: "#013539" },
  "CONFIRMED EPSTEIN CONNECTION":               { fill: "#7f000f", stroke: "#7f000f" },
};
const LIGHT_DEFAULT_NODE = { fill: "#afaaa6", stroke: "#afaaa6" };

const LIGHT_LINK_COLORS: Record<string, LinkEnd> = {
  "AD FEATURES SINCE 1988":      { rgb: "198, 193, 189", a: 0.95 },
  "ANONYMOUS":               { rgb: "0, 0, 0", a: 0.95 },
  "HOMEOWNER NAMES":  { rgb: "238, 188, 177", a: 0.95 },
  "DISMISSED":               { rgb: "5, 61, 67", a: 0.95 },
  "SUSPECTED EPSTEIN CONNECTION":            { rgb: "212, 115, 103", a: 0.95 },
  "CONFIRMED MATCH":         { rgb: "194, 64, 53", a: 0.95 },
  "LIKELY CONNECTION":          { rgb: "224, 138, 126", a: 0.95 },
  "NEEDS REVIEW":            { rgb: "184, 168, 160", a: 0.95 },
  "NO MATCH":                { rgb: "5, 61, 67", a: 0.95 },
  "PENDING":                 { rgb: "176, 168, 162", a: 0.95 },
  "DOSSIER BUILT":           { rgb: "182, 31, 41", a: 0.95 },
  "REJECTED":                { rgb: "5, 61, 67", a: 0.95 },
  "CONFIRMED EPSTEIN CONNECTION":               { rgb: "125, 5, 20", a: 0.95 },
};


interface VerdictSankeyProps {
  featuresTotal: number;
  crossRefsTotal: number;
  dossiersTotal: number;
  confirmed: number;
  rejected: number;
  tierToConfirmed: Record<string, number>;
  tierToRejected: Record<string, number>;
  strengthCounts?: Record<string, number>;
  /** "dark" = methodology section (default), "light" = paper/findings sections */
  variant?: "dark" | "light";
}

// ── Custom Node ──────────────────────────────────────────────
function makeCustomNode(variant: "dark" | "light") {
  const nodeTheme = variant === "light" ? LIGHT_NODE_THEME : NODE_THEME;
  const defaultNode = variant === "light" ? LIGHT_DEFAULT_NODE : DEFAULT_NODE;
  const valueFill = variant === "light" ? "#1A1A1A" : "rgba(224, 224, 229, 0.95)";
  const nameFill = variant === "light" ? "#1A1A1A" : "#E0E0E5";
  const font = MONO;

  return function CustomNode(props: NodeProps) {
    const { x, y, width, height, payload } = props;
    const name = (payload as { name?: string })?.name ?? "";
    const value = (payload as { value?: number })?.value ?? 0;
    const colors = nodeTheme[name] ?? defaultNode;

    const labelX = x + width + 8;
    const isConfirmed = name === "CONFIRMED EPSTEIN CONNECTION";
    const scale = isConfirmed ? 1.5 : 1;

    // Terminal badge: filled rect with centered white text
    const TERMINAL_BADGES: Record<string, string> = {
      "ANONYMOUS": "#000000",
      "DISMISSED": "#013539",
      "REJECTED":  "#013539",
      "CONFIRMED EPSTEIN CONNECTION": "#7f000f",
    };
    const badgeFill = TERMINAL_BADGES[name];
    if (badgeFill) {
      const isEpsteinConfirmed = name === "CONFIRMED EPSTEIN CONNECTION";
      const badgeW = 100;
      const badgeH = isEpsteinConfirmed ? 52 : 34;
      const badgeX = x + width + 4;
      const badgeY = y + height / 2 - badgeH / 2;

      // Split name into lines for multi-line badges
      const nameLines = isEpsteinConfirmed
        ? ["CONFIRMED", "EPSTEIN", "CONNECTION"]
        : [name];

      return (
        <g>
          <rect x={x} y={y} width={width} height={height} fill={colors.stroke} stroke="none" />
          <rect x={badgeX} y={badgeY} width={badgeW} height={badgeH} fill={badgeFill} />
          <text
            x={badgeX + badgeW / 2}
            y={badgeY + (isEpsteinConfirmed ? 14 : badgeH / 2 - 6)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            fontFamily={font}
            fill="#ffffff"
            fontWeight={900}
            letterSpacing="0.04em"
          >
            {value.toLocaleString()}
          </text>
          {nameLines.map((line, i) => (
            <text
              key={i}
              x={badgeX + badgeW / 2}
              y={badgeY + (isEpsteinConfirmed ? 28 + i * 8 : badgeH / 2 + 8)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7}
              fontFamily={font}
              fill="#ffffff"
              letterSpacing="0.1em"
            >
              {line}
            </text>
          ))}
        </g>
      );
    }

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={colors.stroke}
          stroke="none"
        />
        {/* Value */}
        <text
          x={labelX}
          y={y + height / 2 - 1}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={10 * scale}
          fontFamily={font}
          fill={valueFill}
          fontWeight={900}
          letterSpacing="0.04em"
        >
          {value.toLocaleString()}
        </text>
        {/* Name */}
        <text
          x={labelX}
          y={y + height / 2 + 11}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={7 * scale}
          fontFamily={font}
          fill={nameFill}
          fontWeight={isConfirmed ? "bold" : "normal"}
          letterSpacing="0.1em"
        >
          {name}
        </text>
      </g>
    );
  };
}

// ── Custom Link (gradient ribbons) ───────────────────────────
const DEFAULT_LINK: LinkEnd = { rgb: "198, 193, 189", a: 0.95 };

function makeCustomLink(variant: "dark" | "light") {
  const colors = variant === "light" ? LIGHT_LINK_COLORS : LINK_COLORS;

  return function CustomLink(props: LinkProps) {
    const {
      sourceX,
      targetX,
      sourceY,
      targetY,
      linkWidth,
      payload,
    } = props;

    const sourceName = (payload?.source as { name?: string })?.name ?? "";
    const targetName = (payload?.target as { name?: string })?.name ?? "";
    const src = colors[sourceName] ?? DEFAULT_LINK;
    const tgt = colors[targetName] ?? DEFAULT_LINK;
    const halfWidth = linkWidth / 2;

    // Unique gradient ID per ribbon (source position differentiates parallel links)
    const gradId = `lg-${Math.round(sourceX)}-${Math.round(sourceY)}`;

    return (
      <g>
        <defs>
          <linearGradient
            id={gradId}
            x1={sourceX}
            y1={0}
            x2={targetX}
            y2={0}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={`rgb(${src.rgb})`} stopOpacity={src.a} />
            <stop offset="100%" stopColor={`rgb(${tgt.rgb})`} stopOpacity={tgt.a} />
          </linearGradient>
        </defs>
        <path
          d={`
            M${sourceX},${sourceY + halfWidth}
            L${targetX},${targetY + halfWidth}
            L${targetX},${targetY - halfWidth}
            L${sourceX},${sourceY - halfWidth}
            Z
          `}
          fill={`url(#${gradId})`}
          stroke="none"
        />
      </g>
    );
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SankeyTooltip({ active, payload, variant = "dark" }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  if (!item) return null;

  const bg = variant === "light" ? "#FAFAFA" : "#111118";
  const border = variant === "light" ? "#E0DCD4" : "#2a2a3a";
  const titleColor = variant === "light" ? "#1A1A1A" : "#E0E0E5";
  const dimColor = variant === "light" ? "rgba(26, 26, 26, 0.5)" : "rgba(160, 160, 176, 0.6)";
  const font = MONO;

  // Node tooltip
  if (item.payload?.name && !item.payload?.source) {
    return (
      <div
        className="rounded border px-3 py-2 shadow-lg"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        <p
          className="text-[11px] font-bold tracking-wider"
          style={{ fontFamily: font, color: titleColor }}
        >
          {item.payload.name}
        </p>
        <p
          className="mt-0.5 text-[10px]"
          style={{ fontFamily: font, color: dimColor }}
        >
          {Number(item.payload.value ?? 0).toLocaleString()} names
        </p>
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
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <p
        className="text-[10px] tracking-wider"
        style={{ fontFamily: font, color: dimColor }}
      >
        {source} &rarr; {target}
      </p>
      <p
        className="mt-0.5 text-[11px] font-bold"
        style={{ fontFamily: font, color: titleColor }}
      >
        {Number(value).toLocaleString()} names
      </p>
    </div>
  );
}

// Detective tier display order + labels
const TIER_ORDER = [
  { key: "likely_match", label: "SUSPECTED EPSTEIN CONNECTION" },
  { key: "confirmed_match", label: "CONFIRMED MATCH" },
  { key: "possible_match", label: "LIKELY CONNECTION" },
  { key: "needs_review", label: "NEEDS REVIEW" },
  { key: "no_match", label: "NO MATCH" },
  { key: "pending", label: "PENDING" },
];


export function VerdictSankey({
  featuresTotal,
  crossRefsTotal,
  dossiersTotal,
  confirmed,
  rejected,
  tierToConfirmed,
  tierToRejected,
  variant = "dark",
}: VerdictSankeyProps) {
  const mounted = useMounted();

  // Memoize so Recharts render props are stable across re-renders
  // (must be called before early return to satisfy rules-of-hooks)
  const NodeRenderer = useMemo(() => makeCustomNode(variant), [variant]);
  const LinkRenderer = useMemo(() => makeCustomLink(variant), [variant]);

  if (!mounted) return null;

  const anonymous = featuresTotal - crossRefsTotal;
  const dismissed = crossRefsTotal - dossiersTotal;

  // Build nodes and links for a 5-stage funnel:
  // Stage 0: AD FEATURES SINCE 1988 → ANONYMOUS + HOMEOWNER NAMES (Reader + Courier)
  // Stage 1: HOMEOWNER NAMES → DISMISSED + detective tiers (Detective)
  // Stage 2: detective tiers → DOSSIER BUILT (Researcher)
  // Stage 3: DOSSIER BUILT → REJECTED + CONFIRMED (Editor)

  const nodes: { name: string }[] = [];
  const links: { source: number; target: number; value: number }[] = [];

  // Node 0: corpus entry
  nodes.push({ name: "AD FEATURES SINCE 1988" });    // idx 0

  // Node 1: anonymous (features without cross-referenced names)
  nodes.push({ name: "ANONYMOUS" });              // idx 1
  links.push({ source: 0, target: 1, value: Math.max(anonymous, 1) });

  // Node 2: cross-referenced names
  const xrefIdx = nodes.length;
  nodes.push({ name: "HOMEOWNER NAMES" }); // idx 2
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

  // Stage 3: editor verdicts (REJECTED first so it sits above CONFIRMED)
  const rejectedIdx = nodes.length;
  nodes.push({ name: "REJECTED" });
  const confirmedIdx = nodes.length;
  nodes.push({ name: "CONFIRMED EPSTEIN CONNECTION" });

  // Link DOSSIER BUILT to REJECTED / CONFIRMED
  if (rejected > 0) links.push({ source: dossierIdx, target: rejectedIdx, value: rejected });
  if (confirmed > 0) links.push({ source: dossierIdx, target: confirmedIdx, value: confirmed });

  // Stage 4 (connection strength) omitted — CONFIRMED and REJECTED
  // are terminal nodes, keeping them at the same column depth.

  const data = { nodes, links };
  const rejectionRate = crossRefsTotal > 0
    ? Math.round(((crossRefsTotal - confirmed) / crossRefsTotal) * 100)
    : 0;

  const annotDim = variant === "light" ? "rgba(90, 90, 100, 0.5)" : "rgba(90, 90, 100, 0.55)";
  const annotTeal = variant === "light" ? "rgba(1, 53, 57, 0.7)" : "rgba(1, 53, 57, 0.6)";
  const annotFont = MONO;

  return (
    <div className="flex flex-col">
      {/* Context annotation */}
      <div className="flex items-baseline gap-3 px-3 pb-1 pt-2">
        <p
          className="text-[9px] tracking-wider"
          style={{ fontFamily: annotFont, color: annotDim }}
        >
          {featuresTotal.toLocaleString()} features &rarr; {crossRefsTotal.toLocaleString()} names cross-referenced
        </p>
        <p
          className="text-[9px] tracking-wider"
          style={{ fontFamily: annotFont, color: annotTeal }}
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
            margin={{ top: 12, right: 120, bottom: 32, left: 10 }}
            node={NodeRenderer}
            link={LinkRenderer}
          >
            <Tooltip content={<SankeyTooltip variant={variant} />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
