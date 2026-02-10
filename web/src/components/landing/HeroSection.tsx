import type { StatsResponse } from "@/lib/types";

interface HeroSectionProps {
  stats: StatsResponse;
}

export function HeroSection({ stats }: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[70vh] items-center border-b border-border bg-background py-24">
      {/* Grid-aligned: pl-[100px] matches our 100px margin, content spans columns 1–6 */}
      <div className="w-full px-6 lg:pl-[100px] lg:pr-[100px]">
        <div className="max-w-[50%]">
          <h1 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Where They Live
          </h1>
          <blockquote className="mt-8 font-serif text-base italic leading-relaxed text-muted-foreground">
            &ldquo;While civilization has been improving our houses, it has not
            equally improved the men who are to inhabit them. It has created
            palaces, but it was not so easy to create noblemen and
            kings.&rdquo;
            <footer className="mt-2 text-sm not-italic tracking-wide text-copper">
              &mdash; Henry David Thoreau
            </footer>
          </blockquote>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            A systematic cross-reference of every home featured in{" "}
            <em>Architectural Digest</em> (1988&ndash;2025) against the U.S.
            Department of Justice&rsquo;s Epstein document library.
          </p>
          <div className="mt-10 flex flex-wrap gap-12 border-t border-border pt-8">
            <div>
              <p className="font-mono text-3xl font-bold">
                {stats.issues.total}
              </p>
              <p className="text-sm text-muted-foreground">Issues Scanned</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold">
                {stats.features.total}
              </p>
              <p className="text-sm text-muted-foreground">Homes Cataloged</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold">
                {stats.dossiers.total}
              </p>
              <p className="text-sm text-muted-foreground">Dossiers Built</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
