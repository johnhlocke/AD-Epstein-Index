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

interface FeaturesTimelineProps {
  data: { year: number; count: number }[];
}

export function FeaturesTimeline({ data }: FeaturesTimelineProps) {
  const mounted = useMounted();

  if (!data.length) return null;

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section
      className="border-b border-border bg-background pb-20 pt-16"
      id="timeline-features"
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
              Features by Year
            </p>

            <Separator className="mt-2 mb-5" />

            <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
              Number of featured homes extracted per year from the Architectural
              Digest archive. Peaks and valleys reveal the magazine&rsquo;s
              shifting editorial appetite.
            </p>

            <div className="mt-8 border-t border-border pt-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {total.toLocaleString()}
              </p>
              <p
                className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Total Features
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
                <BarChart
                  data={data}
                  margin={{ top: 30, right: 30, bottom: 20, left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="none"
                    stroke="#ECECEC"
                    strokeWidth={0.5}
                  />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fontSize: 10,
                      fill: "#999",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                    axisLine={{ stroke: "#DCDCDC" }}
                    tickLine={{ stroke: "#DCDCDC" }}
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "#999",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E5E5",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                  />
                  <Bar dataKey="count" fill="#B87333" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
