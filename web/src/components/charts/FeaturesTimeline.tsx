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

interface FeaturesTimelineProps {
  data: { year: number; count: number }[];
}

export function FeaturesTimeline({ data }: FeaturesTimelineProps) {
  const mounted = useMounted();

  if (!data.length) return null;

  return (
    <SectionContainer width="viz" className="py-20" id="timeline">
      <h2 className="font-serif text-3xl font-bold">Features by Year</h2>
      <p className="mt-2 mb-8 text-muted-foreground">
        Number of featured homes extracted per year.
      </p>
      <div className="h-[400px] w-full">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: "#737373" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#737373" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E5E5",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
              <Bar dataKey="count" fill="#B87333" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionContainer>
  );
}
