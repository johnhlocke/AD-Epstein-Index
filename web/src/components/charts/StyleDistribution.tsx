"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { useMounted } from "@/lib/use-mounted";

interface StyleDistributionProps {
  data: { style: string; count: number }[];
}

export function StyleDistribution({ data }: StyleDistributionProps) {
  const mounted = useMounted();

  if (!data.length) return null;

  // Truncate long style names for chart labels
  // IMPORTANT: rename 'style' to 'styleName' because Recharts spreads data
  // properties onto SVG elements, and 'style' as a string crashes React 19.
  const chartData = data.map((d) => ({
    styleName: d.style,
    count: d.count,
    label: d.style.length > 25 ? d.style.slice(0, 22) + "..." : d.style,
  }));

  return (
    <SectionContainer width="wide" className="py-20" id="styles">
      <h2 className="font-serif text-3xl font-bold">Design Styles</h2>
      <p className="mt-2 mb-8 text-muted-foreground">
        Most frequently identified design styles across all featured homes.
      </p>
      <div className="h-[500px] w-full">
        {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 140 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: "#737373" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: "#737373" }}
              tickLine={false}
              axisLine={false}
              width={130}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E5E5",
                borderRadius: "6px",
                fontSize: "13px",
              }}
              formatter={(value) => [String(value), "Count"]}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0] as { payload?: { styleName?: string } } | undefined;
                return item?.payload?.styleName ?? String(_label);
              }}
            />
            <Bar dataKey="count" fill="#2D6A4F" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </SectionContainer>
  );
}
