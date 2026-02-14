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
import { Separator } from "@/components/ui/separator";
import { useMounted } from "@/lib/use-mounted";

interface StyleDistributionProps {
  data: { style: string; count: number }[];
}

export function StyleDistribution({ data }: StyleDistributionProps) {
  const mounted = useMounted();

  if (!data.length) return null;

  // IMPORTANT: rename 'style' to 'styleName' because Recharts spreads data
  // properties onto SVG elements, and 'style' as a string crashes React 19.
  const chartData = data.map((d) => ({
    styleName: d.style,
    count: d.count,
    label: d.style.length > 25 ? d.style.slice(0, 22) + "..." : d.style,
  }));

  return (
    <section
      className="border-b border-border bg-background pb-20 pt-16"
      id="styles"
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
              Design Styles
            </p>

            <Separator className="mt-2 mb-5" />

            <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
              Most frequently identified design styles across all featured
              homes. Does a particular aesthetic dominate the Epstein-adjacent
              portfolio?
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
                Styles Identified
              </p>
            </div>
          </div>

          {/* ── Chart ── */}
          <div
            className="h-[500px] overflow-hidden rounded border border-border"
            style={{ backgroundColor: "#FAFAFA" }}
          >
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, bottom: 20, left: 140 }}
                >
                  <CartesianGrid
                    strokeDasharray="none"
                    stroke="#ECECEC"
                    strokeWidth={0.5}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{
                      fontSize: 10,
                      fill: "#999",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                    axisLine={{ stroke: "#DCDCDC" }}
                    tickLine={{ stroke: "#DCDCDC" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{
                      fontSize: 10,
                      fill: "#999",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E5E5",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                    formatter={(value) => [String(value), "Count"]}
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0] as
                        | { payload?: { styleName?: string } }
                        | undefined;
                      return item?.payload?.styleName ?? String(_label);
                    }}
                  />
                  <Bar dataKey="count" fill="#2D6A4F" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
