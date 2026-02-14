import { Suspense } from "react";
import { getStats } from "@/lib/queries";
import { HeroSection } from "@/components/landing/HeroSection";
import { KeyFinding } from "@/components/landing/KeyFinding";
import { GraphPreview } from "@/components/graph/GraphPreview";
import { ConfirmedTimeline } from "@/components/charts/ConfirmedTimeline";
import { MethodologySection } from "@/components/landing/MethodologySection";
import { SearchableIndex } from "@/components/landing/SearchableIndex";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic"; // Render on-demand, not at build time

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="flex flex-col">
      {/* 1. Hero */}
      <HeroSection stats={stats} />

      {/* 1.5 Key Finding */}
      <KeyFinding />

      {/* 2. Searchable Index */}
      <Suspense fallback={<div className="py-20" style={{ paddingLeft: "var(--grid-margin)", paddingRight: "var(--grid-margin)" }}><Skeleton className="h-96 w-full" /></div>}>
        <SearchableIndex />
      </Suspense>

      {/* 3. Confirmed Timeline */}
      {(stats.confirmedTimeline?.length ?? 0) > 0 && (
        <section className="border-b border-border bg-background pb-20 pt-16" id="timeline">
          <div className="mx-auto w-full" style={{ maxWidth: "var(--grid-max-width)", paddingLeft: "var(--grid-margin)", paddingRight: "var(--grid-margin)" }}>
            <ConfirmedTimeline data={stats.confirmedTimeline} />
          </div>
        </section>
      )}

      {/* 4. Knowledge Graph Preview */}
      <section className="border-b border-border bg-background pb-20 pt-16" id="graph">
        <div className="mx-auto w-full" style={{ maxWidth: "var(--grid-max-width)", paddingLeft: "var(--grid-margin)", paddingRight: "var(--grid-margin)" }}>
          <GraphPreview />
        </div>
      </section>

      {/* 4. Methodology */}
      <MethodologySection />
    </div>
  );
}
