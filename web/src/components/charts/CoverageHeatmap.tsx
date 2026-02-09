"use client";

import { Fragment } from "react";
import { SectionContainer } from "@/components/layout/SectionContainer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
  return (
    <SectionContainer width="viz" className="py-20" id="coverage">
      <h2 className="font-serif text-3xl font-bold">Coverage Map</h2>
      <p className="mt-2 mb-8 text-muted-foreground">
        How much of Architectural Digest have we scanned? Each cell is one
        issue (month &times; year).
      </p>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-[#8B5E3C]" />
          <span>Extracted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-[#D4A574]" />
          <span>Downloaded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-[#E8D5C0]" />
          <span>Discovered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm border border-border bg-[#F0F0F0]" />
          <span>Not yet found</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[2px]" style={{
          gridTemplateColumns: `auto repeat(12, 1fr)`,
        }}>
          {/* Month header row */}
          <div />
          {MONTHS.map((m, i) => (
            <div
              key={i}
              className="flex h-6 w-8 items-center justify-center text-[10px] font-medium text-muted-foreground"
            >
              {m}
            </div>
          ))}

          {/* Year rows */}
          {coverage.map((row) => (
            <Fragment key={row.year}>
              <div className="flex h-6 items-center pr-2 text-[11px] font-mono text-muted-foreground">
                {row.year}
              </div>
              {row.months.map((status, mi) => (
                <Tooltip key={`${row.year}-${mi}`}>
                  <TooltipTrigger asChild>
                    <div
                      className={`h-6 w-8 rounded-[2px] border border-border/50 ${
                        status ? statusColors[status] ?? "bg-[#F0F0F0]" : "bg-[#F0F0F0]"
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
    </SectionContainer>
  );
}
