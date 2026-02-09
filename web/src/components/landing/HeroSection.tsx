import { SectionContainer } from "@/components/layout/SectionContainer";
import type { StatsResponse } from "@/lib/types";

interface HeroSectionProps {
  stats: StatsResponse;
}

export function HeroSection({ stats }: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[70vh] items-center border-b border-border bg-background py-24">
      <SectionContainer width="text">
        <p className="text-sm font-medium uppercase tracking-widest text-copper">
          Data Investigation
        </p>
        <h1 className="mt-4 font-serif text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
          The AD-Epstein Index
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
          A systematic cross-reference of every home featured in{" "}
          <em>Architectural Digest</em> (1988&ndash;2025) against the
          U.S. Department of Justice&rsquo;s Epstein document library.
        </p>
        <div className="mt-12 flex flex-wrap gap-8 border-t border-border pt-8">
          <div>
            <p className="font-mono text-3xl font-bold">{stats.issues.total}</p>
            <p className="text-sm text-muted-foreground">Issues Scanned</p>
          </div>
          <div>
            <p className="font-mono text-3xl font-bold">{stats.features.total}</p>
            <p className="text-sm text-muted-foreground">Homes Cataloged</p>
          </div>
          <div>
            <p className="font-mono text-3xl font-bold">{stats.dossiers.total}</p>
            <p className="text-sm text-muted-foreground">Dossiers Built</p>
          </div>
        </div>
      </SectionContainer>
    </section>
  );
}
