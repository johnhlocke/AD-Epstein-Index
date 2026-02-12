"use client";

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { useMounted } from "@/lib/use-mounted";

const COLORS = ["#B87333", "#2D6A4F", "#4A7C8F", "#9B7653", "#6B5B73", "#D4A574", "#8B5E3C"];

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

function CustomContent({ x, y, width, height, index, name }: TreemapContentProps) {
  const color = COLORS[index % COLORS.length];
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
        rx={3}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFFFFF"
          fontSize={width > 120 ? 12 : 10}
          fontWeight={500}
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
    <SectionContainer width="wide" className="py-20" id="geography">
      <h2 className="font-serif text-3xl font-bold">Locations</h2>
      <p className="mt-2 mb-8 text-muted-foreground">
        Where the featured homes are located. Larger areas represent more
        frequent locations.
      </p>
      <div className="h-[400px] w-full">
        {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treeData}
            dataKey="size"
            aspectRatio={4 / 3}
            content={<CustomContent x={0} y={0} width={0} height={0} index={0} name="" />}
          >
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E5E5",
                borderRadius: "6px",
                fontSize: "13px",
              }}
              formatter={(value) => [String(value), "Homes"]}
            />
          </Treemap>
        </ResponsiveContainer>
        )}
      </div>
    </SectionContainer>
  );
}
