import { Suspense } from "react";
import { getStats } from "@/lib/queries";
import { HeroSection } from "@/components/landing/HeroSection";
import { KeyFindings } from "@/components/landing/KeyFindings";
import { MethodologySection } from "@/components/landing/MethodologySection";
import { CoverageHeatmap } from "@/components/charts/CoverageHeatmap";
import { FeaturesTimeline } from "@/components/charts/FeaturesTimeline";
import { StyleDistribution } from "@/components/charts/StyleDistribution";
import { GeographicMap } from "@/components/charts/GeographicMap";
import { VerdictBreakdown } from "@/components/charts/VerdictBreakdown";
import { SearchableIndex } from "@/components/landing/SearchableIndex";
import { Skeleton } from "@/components/ui/skeleton";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="flex flex-col">
      {/* 1. Hero */}
      <HeroSection stats={stats} />

      {/* 2. Key Findings */}
      <KeyFindings stats={stats} />

      {/* 3. Coverage Heatmap */}
      <CoverageHeatmap coverage={stats.coverage} />

      {/* 4. Features Timeline */}
      <FeaturesTimeline data={stats.features.byYear} />

      {/* 5. Style Distribution */}
      <StyleDistribution data={stats.features.topStyles} />

      {/* 6. Geographic Treemap */}
      <GeographicMap data={stats.features.topLocations} />

      {/* 7 & 8. Verdict Breakdown */}
      <VerdictBreakdown dossiers={stats.dossiers} />

      {/* 9. Searchable Index */}
      <Suspense fallback={<div className="py-20 px-6"><Skeleton className="h-96 w-full" /></div>}>
        <SearchableIndex />
      </Suspense>

      {/* 10. Methodology */}
      <MethodologySection />
    </div>
  );
}
