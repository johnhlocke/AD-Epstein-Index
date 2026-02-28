import type { Metadata } from "next";
import { AestheticScoresExplorer } from "@/components/aesthetic-scores/AestheticScoresExplorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aesthetic Scores — Where They Live",
  description:
    "Browse the 9-axis aesthetic scores for every home featured in Architectural Digest (1988–2025). Search by homeowner, designer, year, or headline.",
};

export default function AestheticScoresPage() {
  return (
    <div className="min-h-screen bg-background pb-20 pt-10">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        {/* Page header */}
        <div className="mb-10">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: "JetBrains Mono, monospace", color: "#B87333" }}
          >
            Appendix
          </p>
          <h1
            className="mt-2 text-[28px] font-bold leading-[1.1] tracking-tight md:text-[36px]"
            style={{ fontFamily: "var(--font-playfair-display), Georgia, serif", color: "#1A1A1A" }}
          >
            Aesthetic Scores
          </h1>
          <p
            className="mt-3 text-[15px] leading-[1.7]"
            style={{
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
              color: "#666",
              maxWidth: "calc(4 * (100% - 5 * 24px) / 6 + 3 * 24px)",
            }}
          >
            Every home in the dataset, scored across 9 aesthetic axes by Claude Opus
            4.6 Vision. Search to view the magazine pages, radar profile, per-axis
            scores, and the AI-generated aesthetic summary for any feature.
          </p>
          <div className="mt-5" style={{ borderTop: "1px solid #E2DDD5" }} />
        </div>

        <AestheticScoresExplorer />
      </div>
    </div>
  );
}
