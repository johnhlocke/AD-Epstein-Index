"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Separator } from "@/components/ui/separator";
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
    <section
      className="border-b border-border bg-background pb-20 pt-16"
      id="verdicts"
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
              Epstein Connections
            </p>

            <Separator className="mt-2 mb-5" />

            <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
              Breakdown of cross-reference investigations by Editor verdict.
              Each dossier is reviewed against DOJ records and the Little Black
              Book.
            </p>

            {/* Stats */}
            <div className="mt-8 border-t border-border pt-4">
              <p
                className="font-mono text-[36px] font-bold leading-none tracking-tight"
              >
                {dossiers.total}
              </p>
              <p
                className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Total Dossiers
              </p>

              {dossiers.confirmed > 0 && (
                <div className="mt-4">
                  <p
                    className="text-[28px] font-bold leading-none tracking-tight"
                    style={{
                      fontFamily: "futura-pt, sans-serif",
                      color: "#2D6A4F",
                    }}
                  >
                    {dossiers.confirmed}
                  </p>
                  <p
                    className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
                    style={{ fontFamily: "futura-pt, sans-serif" }}
                  >
                    Confirmed
                  </p>
                </div>
              )}

              {dossiers.rejected > 0 && (
                <div className="mt-4">
                  <p
                    className="text-[28px] font-bold leading-none tracking-tight text-[#A3A3A3]"
                    style={{ fontFamily: "futura-pt, sans-serif" }}
                  >
                    {dossiers.rejected}
                  </p>
                  <p
                    className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
                    style={{ fontFamily: "futura-pt, sans-serif" }}
                  >
                    Rejected
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Chart ── */}
          <div
            className="flex h-[400px] items-center justify-center overflow-hidden rounded border border-border"
            style={{ backgroundColor: "#FAFAFA" }}
          >
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={140}
                    dataKey="value"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          VERDICT_COLORS[
                            entry.name as keyof typeof VERDICT_COLORS
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E5E5",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontFamily: "futura-pt, sans-serif",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
