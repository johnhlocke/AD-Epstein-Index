"use client";

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { Separator } from "@/components/ui/separator";
import { useMounted } from "@/lib/use-mounted";

const COPPER_PALETTE = [
  "#8B5E3C",
  "#A0714D",
  "#B87333",
  "#C68B4F",
  "#D4A574",
  "#E0BA8A",
  "#E8D5C0",
];

interface GeographicMapProps {
  data: { location: string; count: number }[];
}

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  name: string;
}

function CustomContent({
  x,
  y,
  width,
  height,
  index,
  name,
}: TreemapContentProps) {
  const color = COPPER_PALETTE[index % COPPER_PALETTE.length];
  const showLabel = width > 60 && height > 30;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#FAFAFA"
        strokeWidth={2}
        rx={2}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFFFFF"
          fontSize={width > 120 ? 11 : 9}
          fontWeight={500}
          fontFamily="futura-pt, sans-serif"
        >
          {name.length > 20 ? name.slice(0, 17) + "..." : name}
        </text>
      )}
    </g>
  );
}

export function GeographicMap({ data }: GeographicMapProps) {
  const mounted = useMounted();

  if (!data.length) return null;

  const treeData = data.map((d) => ({
    name: d.location,
    size: d.count,
  }));

  return (
    <section
      className="border-b border-border bg-background pb-20 pt-16"
      id="geography"
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <div className="grid gap-6 md:grid-cols-[188px_1fr]">
          {/* ── Sidebar ── */}
          <div className="flex flex-col pt-1">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              Locations
            </p>

            <Separator className="mt-2 mb-5" />

            <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
              Where the featured homes are located. Larger areas represent more
              frequent locations across the archive.
            </p>

            <div className="mt-8 border-t border-border pt-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {data.length}
              </p>
              <p
                className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Locations Tracked
              </p>
            </div>
          </div>

          {/* ── Chart ── */}
          <div
            className="h-[400px] overflow-hidden rounded border border-border"
            style={{ backgroundColor: "#FAFAFA" }}
          >
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treeData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  content={
                    <CustomContent
                      x={0}
                      y={0}
                      width={0}
                      height={0}
                      index={0}
                      name=""
                    />
                  }
                >
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E5E5",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                    formatter={(value) => [String(value), "Homes"]}
                  />
                </Treemap>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
