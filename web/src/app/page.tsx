import { Suspense } from "react";
import { getStats, getAestheticRadarData } from "@/lib/queries";
import { HeroMosaic } from "@/components/landing/HeroMosaic";
import { HeroSection } from "@/components/landing/HeroSection";
import { KeyFinding } from "@/components/landing/KeyFinding";
import { SearchableIndex } from "@/components/landing/SearchableIndex";
import { ConfirmedTimeline } from "@/components/charts/ConfirmedTimeline";
import { GraphPreview } from "@/components/graph/GraphPreview";
import { DossierExample } from "@/components/landing/DossierExample";
import { AestheticPivotBridge } from "@/components/landing/AestheticPivotBridge";
import { BaselineAesthetic } from "@/components/landing/BaselineAesthetic";
import { EpsteinAesthetic } from "@/components/landing/EpsteinAesthetic";
import { AestheticAnalysis } from "@/components/landing/AestheticAnalysis";
import { TestingAesthetic } from "@/components/landing/TestingAesthetic";
import { Conclusion } from "@/components/landing/Conclusion";
import { WhatsNext } from "@/components/landing/WhatsNext";
import { AgentMethodologySection } from "@/components/landing/MethodologySection";
import { AestheticMethodologySection } from "@/components/landing/AestheticMethodologySection";
import { Appendix } from "@/components/landing/Appendix";
import { Contact } from "@/components/landing/Contact";
import { ChapterBanner } from "@/components/landing/ChapterBanner";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic"; // Render on-demand, not at build time

export default async function Home() {
  const [stats, radarData] = await Promise.all([
    getStats(),
    getAestheticRadarData(),
  ]);

  return (
    <div className="flex flex-col">
      {/* ── 1. Hero (with mosaic slot under subhead) ── */}
      <HeroSection
        stats={stats}
        mosaic={
          <Suspense
            fallback={
              <div
                style={{ height: "clamp(320px, 50vh, 600px)", background: "#222" }}
                aria-hidden="true"
              />
            }
          >
            <HeroMosaic />
          </Suspense>
        }
      />

      {/* ── Chapter 1: Finding 01 ── */}
      <ChapterBanner
        id="finding-01"
        num="1"
        title="Finding 01: The Names"
        summary={`In this section, ${stats.features.total.toLocaleString()} AD homeowners are cross-referenced against the DOJ Epstein files, yielding ${stats.dossiers.confirmed.toLocaleString()} confirmed connections across socialites, financiers, and media figures.`}
      />

      {/* ── 1.1 Who Are They? ── */}
      <KeyFinding stats={stats} />

      {/* ── Searchable Index ── */}
      <div
        className="n-body n-body-narrow pb-6"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <p>
          The searchable index below contains every feature in the database.
          Each confirmed connection links to a dossier with the specific DOJ
          evidence&mdash;the flight log entry, the dinner guest list, the
          address book page&mdash;that established the link. The timeline
          that follows maps the temporal and geographic distribution.
        </p>
      </div>
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
        <section className="narrative bg-background pb-20 pt-14" id="timeline">
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: "var(--grid-max-width)",
              paddingLeft: "var(--grid-margin)",
              paddingRight: "var(--grid-margin)",
            }}
          >
            <p className="n-label">Key Finding 01 (Cont.)</p>
            <h2 className="n-title">1.2 What, When and Where Are They</h2>
            <hr className="n-rule mb-6" />

            <div className="n-body n-body-narrow mb-8">
              <p>
                The connections cluster in the late 1990s and early 2000s, the
                period when Epstein&rsquo;s social infrastructure was at its most
                expansive. Geographically, they concentrate in Manhattan, Palm
                Beach, the Hamptons, and London&mdash;the same circuit described
                in Epstein&rsquo;s own correspondence. Several interior designers
                appear across multiple connected homes, suggesting shared
                professional networks that independently intersected with
                Epstein&rsquo;s circle.
              </p>
            </div>

            <ConfirmedTimeline data={stats.confirmedTimeline} categoryBreakdown={stats.categoryBreakdown} />

            {/* ── Knowledge Graph (4 minor columns) ── */}
            <div
              className="mt-12"
              style={{ maxWidth: "calc(4 * (100% - 5 * 24px) / 6 + 3 * 24px)" }}
            >
              <div
                className="overflow-hidden border"
                style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
              >
                <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
                  >
                    How Are They Connected?<br />
                    <span style={{ fontWeight: 400, color: "#666" }}>Knowledge Graph of Confirmed Connections</span>
                  </p>
                </div>
                <GraphPreview />
              </div>
              <p className="n-caption">
                Fig. 5 &mdash; Interactive knowledge graph of confirmed Epstein
                connections within the AD homeowner population. Copper rings
                mark confirmed links. Drag to explore, scroll to zoom.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── 1.3 What a Typical AD Homeowner Looks Like ── */}
      <section id="typical-homeowner" className="narrative bg-background pb-20 pt-14">
        <div
          className="mx-auto w-full"
          style={{
            maxWidth: "var(--grid-max-width)",
            paddingLeft: "var(--grid-margin)",
            paddingRight: "var(--grid-margin)",
          }}
        >
          <p className="n-label">Key Finding 01 (Cont.)</p>
          <h2 className="n-title">1.3 What a Typical AD Homeowner Looks Like</h2>
          <hr className="n-rule" />
        </div>
      </section>

      {/* ── 1.4 The Epstein Profile vs the AD Baseline ── */}
      <DossierExample />

      {/* ── Bridge: The Aesthetic Pivot ── */}
      <AestheticPivotBridge />

      {/* ── Chapter 2: Finding 02 ── */}
      <ChapterBanner
        id="finding-02"
        num="2"
        title="Finding 02: The Aesthetic"
        summary="In this section, every home is scored on nine aesthetic axes to determine whether Epstein-connected homes share a measurable design signature."
      />

      {/* ── 2.1 Determining the AD Baseline Aesthetic ── */}
      <BaselineAesthetic />

      {/* ── E: Is There an Epstein Aesthetic? (Key Finding 02 cont.) ── */}
      <EpsteinAesthetic radarData={radarData} />

      {/* ── F: An Aesthetic Analysis (Key Finding 02 cont.) ── */}
      <AestheticAnalysis />

      {/* ── G: Testing the Epstein Aesthetic (Key Finding 02 cont.) ── */}
      <TestingAesthetic />

      {/* ── Chapter 3: Conclusion ── */}
      <ChapterBanner
        id="finding-03"
        num="3"
        title="Conclusion"
        summary="In this section, we examine what the overlap between elite taste and a criminal social network means for the cultural pipeline that shapes mainstream design."
      />

      {/* ── 3. Conclusion ── */}
      <Conclusion />

      {/* ── What's Next + Contact ── */}
      <WhatsNext />

      {/* ── Methodology: Agent AI ── */}
      <AgentMethodologySection stats={stats} />

      {/* ── Methodology: Aesthetic Metric ── */}
      <AestheticMethodologySection />

      {/* ── Appendix ── */}
      <Appendix />

      {/* ── Contact ── */}
      <Contact />
    </div>
  );
}
