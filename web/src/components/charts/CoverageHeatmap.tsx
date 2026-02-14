"use client";

import { Fragment } from "react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const statusColors: Record<string, string> = {
  extracted: "bg-[#8B5E3C]",
  downloaded: "bg-[#D4A574]",
  discovered: "bg-[#E8D5C0]",
  skipped_pre1988: "bg-[#F0F0F0]",
  error: "bg-rejected-bg",
  extraction_error: "bg-rejected-bg",
  no_pdf: "bg-[#F0F0F0]",
};

interface CoverageHeatmapProps {
  coverage: { year: number; months: (string | null)[] }[];
}

export function CoverageHeatmap({ coverage }: CoverageHeatmapProps) {
  // Compute stats from the data
  let extracted = 0;
  for (const row of coverage) {
    for (const status of row.months) {
      if (status === "extracted") extracted++;
    }
  }

  return (
    <section
      className="border-b border-border bg-background pb-20 pt-16"
      id="coverage"
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
              Coverage Map
            </p>

            <Separator className="mt-2 mb-5" />

            <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
              How much of Architectural Digest have we scanned? Each cell is one
              issue &mdash; month by year &mdash; colored by pipeline status.
            </p>

            {/* Stats */}
            <div className="mt-8 border-t border-border pt-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {extracted}
              </p>
              <p
                className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Issues Extracted
              </p>

              <p
                className="mt-4 text-[28px] font-bold leading-none tracking-tight"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {coverage.length}
              </p>
              <p
                className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Years Covered
              </p>
            </div>

            {/* Legend */}
            <div className="mt-6 space-y-2 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-[1px] bg-[#8B5E3C]" />
                <span>Extracted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-[1px] bg-[#D4A574]" />
                <span>Downloaded</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-[1px] bg-[#E8D5C0]" />
                <span>Discovered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-[1px] border border-border bg-[#F0F0F0]" />
                <span>Not found</span>
              </div>
            </div>
          </div>

          {/* ── Heatmap Grid ── */}
          <div
            className="overflow-x-auto rounded border border-border p-4"
            style={{ backgroundColor: "#FAFAFA" }}
          >
            <div
              className="grid gap-[2px]"
              style={{
                gridTemplateColumns: `auto repeat(12, minmax(24px, 1fr))`,
              }}
            >
              {/* Month header row */}
              <div />
              {MONTHS.map((m, i) => (
                <div
                  key={i}
                  className="flex h-6 items-center justify-center text-[10px] font-medium text-muted-foreground"
                  style={{ fontFamily: "futura-pt, sans-serif" }}
                >
                  {m}
                </div>
              ))}

              {/* Year rows */}
              {coverage.map((row) => (
                <Fragment key={row.year}>
                  <div
                    className="flex h-6 items-center pr-2 text-[10px] text-muted-foreground"
                    style={{ fontFamily: "futura-pt, sans-serif" }}
                  >
                    {row.year}
                  </div>
                  {row.months.map((status, mi) => (
                    <Tooltip key={`${row.year}-${mi}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-6 rounded-[2px] border border-border/50 ${
                            status
                              ? (statusColors[status] ?? "bg-[#F0F0F0]")
                              : "bg-[#F0F0F0]"
                          }`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {MONTH_FULL[mi]} {row.year}: {status ?? "not found"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
