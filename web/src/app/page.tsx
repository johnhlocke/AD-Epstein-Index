import { Suspense } from "react";
import { getStats, getAestheticRadarData } from "@/lib/queries";
import { Separator } from "@/components/ui/separator";
import { HeroSection } from "@/components/landing/HeroSection";
import { KeyFindingsIntro } from "@/components/landing/KeyFindingsIntro";
import { KeyFinding } from "@/components/landing/KeyFinding";
import { SearchableIndex } from "@/components/landing/SearchableIndex";
import { ConfirmedTimeline } from "@/components/charts/ConfirmedTimeline";
// import { GraphPreview } from "@/components/graph/GraphPreview"; // Disabled — Neo4j queries slow down page load
import { DossierExample } from "@/components/landing/DossierExample";
import { AestheticPivotBridge } from "@/components/landing/AestheticPivotBridge";
import { EpsteinAesthetic } from "@/components/landing/EpsteinAesthetic";
import { AestheticAnalysis } from "@/components/landing/AestheticAnalysis";
import { TestingAesthetic } from "@/components/landing/TestingAesthetic";
import { Conclusion } from "@/components/landing/Conclusion";
import { WhatsNext } from "@/components/landing/WhatsNext";
import { AgentMethodologySection } from "@/components/landing/MethodologySection";
import { AestheticMethodologySection } from "@/components/landing/AestheticMethodologySection";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic"; // Render on-demand, not at build time

export default async function Home() {
  const [stats, radarData] = await Promise.all([
    getStats(),
    getAestheticRadarData(),
  ]);

  return (
    <div className="flex flex-col">
      {/* ── 1. Hero ── */}
      <HeroSection stats={stats} />

      {/* ── A: Key Findings Introduction ── */}
      <KeyFindingsIntro />

      {/* ── B: Who Are They? (Key Finding 01) ── */}
      <KeyFinding />

      {/* ── Searchable Index ── */}
      <Suspense
        fallback={
          <div
            className="pb-20"
            style={{
              paddingLeft: "var(--grid-margin)",
              paddingRight: "var(--grid-margin)",
            }}
          >
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <SearchableIndex defaultSort="year" defaultOrder="desc" />
      </Suspense>

      {/* ── C: When and Where Are They (Key Finding 01 cont.) ── */}
      {(stats.confirmedTimeline?.length ?? 0) > 0 && (
        <section className="bg-background pb-20 pt-14" id="timeline">
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: "var(--grid-max-width)",
              paddingLeft: "var(--grid-margin)",
              paddingRight: "var(--grid-margin)",
            }}
          >
            {/* Section Header */}
            <p
              className="text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              Key Finding 01 (Cont.)
            </p>
            <h2
              className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              What, When and Where Are They
            </h2>

            <Separator className="mt-5 mb-6" />

            <ConfirmedTimeline data={stats.confirmedTimeline} categoryBreakdown={stats.categoryBreakdown} />
          </div>
        </section>
      )}

      {/* ── D: How Are They Connected? — DISABLED (Neo4j slows page load) ── */}
      {/* Re-enable by uncommenting this section and the GraphPreview import above */}
      {/*
      <section className="bg-background pb-20 pt-14" id="graph">
        <div
          className="mx-auto w-full"
          style={{
            maxWidth: "var(--grid-max-width)",
            paddingLeft: "var(--grid-margin)",
            paddingRight: "var(--grid-margin)",
          }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
          >
            Key Finding 01 (Cont.)
          </p>
          <h2
            className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            How Are They Connected?
          </h2>
          <Separator className="mt-5 mb-6" />
          <GraphPreview />
        </div>
      </section>
      */}

      {/* ── Dossier Example ── */}
      <DossierExample />

      {/* ── Bridge: The Aesthetic Pivot ── */}
      <AestheticPivotBridge />

      {/* ── E: Is There an Epstein Aesthetic? (Key Finding 02) ── */}
      <EpsteinAesthetic radarData={radarData} />

      {/* ── F: An Aesthetic Analysis (Key Finding 02 cont.) ── */}
      <AestheticAnalysis />

      {/* ── G: Testing the Epstein Aesthetic (Key Finding 02 cont.) ── */}
      <TestingAesthetic />

      {/* ── H: Conclusion ── */}
      <Conclusion />

      {/* ── What's Next + Contact ── */}
      <WhatsNext />

      {/* ── Methodology: Agent AI ── */}
      <AgentMethodologySection stats={stats} />

      {/* ── Methodology: Aesthetic Metric ── */}
      <AestheticMethodologySection />
    </div>
  );
}
