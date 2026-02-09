import { SectionContainer } from "@/components/layout/SectionContainer";
import { StatCard } from "@/components/shared/StatCard";
import type { StatsResponse } from "@/lib/types";

interface KeyFindingsProps {
  stats: StatsResponse;
}

export function KeyFindings({ stats }: KeyFindingsProps) {
  const coveragePercent = Math.round(
    ((stats.issues.extracted + stats.issues.downloaded) / stats.issues.target) * 100
  );

  return (
    <SectionContainer width="viz" className="py-20" id="findings">
      <h2 className="font-serif text-3xl font-bold">Key Findings</h2>
      <p className="mt-2 text-muted-foreground">
        Current progress across all phases of the investigation.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Coverage"
          value={`${coveragePercent}%`}
          sublabel={`${stats.issues.extracted} of ${stats.issues.target} issues`}
        />
        <StatCard
          label="Named Homeowners"
          value={stats.features.withHomeowner}
          sublabel={`of ${stats.features.total} features extracted`}
        />
        <StatCard
          label="Dossiers Confirmed"
          value={stats.dossiers.confirmed}
          sublabel={`${stats.dossiers.rejected} rejected, ${stats.dossiers.pending} pending`}
        />
        <StatCard
          label="Design Styles Found"
          value={stats.features.topStyles.length}
          sublabel={stats.features.topStyles[0]?.style ?? ""}
        />
      </div>
    </SectionContainer>
  );
}
