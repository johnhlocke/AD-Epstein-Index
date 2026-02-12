"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { useMounted } from "@/lib/use-mounted";

const VERDICT_COLORS = {
  Confirmed: "#2D6A4F",
  Rejected: "#A3A3A3",
  "Pending Review": "#B8860B",
};

interface VerdictBreakdownProps {
  dossiers: {
    total: number;
    confirmed: number;
    rejected: number;
    pending: number;
  };
}

export function VerdictBreakdown({ dossiers }: VerdictBreakdownProps) {
  const mounted = useMounted();

  if (dossiers.total === 0) return null;

  const data = [
    { name: "Confirmed", value: dossiers.confirmed },
    { name: "Rejected", value: dossiers.rejected },
    { name: "Pending Review", value: dossiers.pending },
  ].filter((d) => d.value > 0);

  return (
    <SectionContainer width="wide" className="py-20" id="verdicts">
      <h2 className="font-serif text-3xl font-bold">Epstein Connections</h2>
      <p className="mt-2 mb-8 text-muted-foreground">
        Breakdown of cross-reference investigations by Editor verdict.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex h-[300px] items-center justify-center md:col-span-2">
          {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={120}
                dataKey="value"
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={VERDICT_COLORS[entry.name as keyof typeof VERDICT_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E5E5",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-4xl font-bold">
            {dossiers.total}
          </p>
          <p className="text-sm text-muted-foreground">
            Total dossiers investigated
          </p>
          <div className="mt-4 space-y-2 text-sm">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: VERDICT_COLORS[d.name as keyof typeof VERDICT_COLORS] }}
                />
                <span className="text-muted-foreground">
                  {d.value} {d.name.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
