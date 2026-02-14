"use client";

import { useMounted } from "@/lib/use-mounted";
import type { AestheticRadarData } from "@/lib/types";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COPPER = "#B87333";
const BASELINE_GREEN = "rgba(46, 204, 113, 0.7)";

interface AestheticRadarCardProps {
  data?: AestheticRadarData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded border border-border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-foreground">
        {(d.dimension as string).replace("\n", " ")}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: COPPER }}>
        Epstein orbit: {d.epstein}%
      </p>
      <p className="text-[11px]" style={{ color: BASELINE_GREEN }}>
        AD baseline: {d.baseline}%
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTick({ payload, x, y, textAnchor }: any) {
  const lines = (payload.value as string).split("\n");
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={9}
      fill="#999"
      fontFamily="futura-pt, sans-serif"
    >
      {lines.map((line: string, i: number) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Compact radar chart card — matches the ConfirmedTimeline diagram style.
 *
 * Light #FAFAFA background, 1px border, subtle drop shadow.
 * Renders the 6-axis aesthetic comparison: copper for Epstein orbit,
 * dashed green for AD baseline.
 */
export function AestheticRadarCard({ data }: AestheticRadarCardProps) {
  const mounted = useMounted();

  if (!mounted) return null;

  const axes = data?.axes ?? [];
  const hasData = axes.length > 0;

  return (
    <div
      className="h-[340px] overflow-hidden rounded border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={axes} cx="50%" cy="50%" outerRadius="65%">
            <PolarGrid stroke="#E0E0E0" strokeWidth={0.5} />
            <PolarAngleAxis dataKey="dimension" tick={<CustomTick />} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 8, fill: "#C0C0C0" }}
              tickCount={5}
              axisLine={false}
            />
            <Radar
              name="Epstein orbit"
              dataKey="epstein"
              stroke={COPPER}
              fill={COPPER}
              fillOpacity={0.18}
              strokeWidth={2}
            />
            <Radar
              name="AD baseline"
              dataKey="baseline"
              stroke={BASELINE_GREEN}
              fill="rgba(46, 204, 113, 0.05)"
              fillOpacity={0.05}
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                fontSize: 10,
                fontFamily: "futura-pt, sans-serif",
                paddingTop: 4,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p
            className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/50"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Radar Chart Loading...
          </p>
        </div>
      )}
    </div>
  );
}
