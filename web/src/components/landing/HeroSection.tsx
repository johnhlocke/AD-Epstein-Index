import type { StatsResponse } from "@/lib/types";
import { Separator } from "@/components/ui/separator";

interface HeroSectionProps {
  stats: StatsResponse;
}

export function HeroSection({ stats }: HeroSectionProps) {
  return (
    <section className="relative border-b border-border bg-background">
      <div
        className="mx-auto flex w-full flex-col gap-12"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
          paddingTop: "96px",
          paddingBottom: "96px",
        }}
      >
        {/* Hero Content — left 3 slices (612px) */}
        <div className="w-full lg:max-w-[612px]">
          <h1 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-[76px]">
            Where They Live
          </h1>
          <blockquote className="mt-2 font-serif text-xs italic leading-[1.6] text-muted-foreground max-w-[397px]">
            &ldquo;While civilization has been improving our houses, it has not
            equally improved the men who are to inhabit them. It has created
            palaces, but it was not so easy to create noblemen and
            kings.&rdquo;
          </blockquote>
          <p className="mt-2 text-xs text-[#838281]">
            Henry David Thoreau
          </p>
        </div>

        {/* Description Intro — full width with label, divider, and 3-column text */}
        <div className="flex flex-col">
          <p className="text-lg font-bold leading-none text-muted-foreground">
            Intro
          </p>
          <Separator className="mt-0" />
          <div className="mt-0 grid gap-6 md:grid-cols-3">
            <p className="text-base font-bold leading-[1.5] text-muted-foreground">
              This investigation looks at the last 28 years of Architectural
              Digest (AD) stretching back to 1988. In that time, the magazine
              celebrated the homes of over 1600 individuals. Many of those
              featured are of great wealth and power. And perhaps
              unsurprisingly, many of those also happen to have had direct and
              repeated contact with Jeffrey Epstein as documented in the
              Department of Justice&rsquo;s Epstein Files. This site names those
              connected homeowners and documents the nature of those
              connections.
            </p>
            <p className="text-base font-bold leading-[1.5] text-muted-foreground">
              Architectural Digest is considered the preeminent arbiter of
              mainstream taste in interior design. If there is a high
              correlation between AD features and Epstein&rsquo;s network, it
              warrants asking: &ldquo;How much of what we consider &ldquo;good
              design&rdquo; as highlighted in the featured pages of AD was
              commissioned, built, and lived in by those with connections to
              Epstein?&rdquo; What does that reveal about the aesthetics of
              power and design? Is there a demonstrable &ldquo;Epstein
              aesthetic&rdquo; that can be seen consistently across these homes?
            </p>
            <p className="text-base font-bold leading-[1.5] text-muted-foreground">
              This is not a claim of guilt. Appearing in a contact book or a
              legal document does not imply criminal conduct. What it does
              establish is proximity — that a meaningful number of individuals
              celebrated by America&rsquo;s most influential design magazine
              also moved in circles that intersected, directly and repeatedly,
              with Jeffrey Epstein&rsquo;s. The patterns that emerge from that
              overlap are the subject of this investigation.
            </p>
          </div>
        </div>

        {/* Stats Section — full width */}
        <div>
          <Separator />
          <div className="flex flex-wrap gap-24 pt-8">
            <div>
              <p className="font-mono text-[30px] font-bold leading-tight">
                {stats.issues.total}
              </p>
              <p className="text-sm text-muted-foreground">Issues Scanned</p>
            </div>
            <div>
              <p className="font-mono text-[30px] font-bold leading-tight">
                {stats.features.total}
              </p>
              <p className="text-sm text-muted-foreground">Homes Cataloged</p>
            </div>
            <div>
              <p className="font-mono text-[30px] font-bold leading-tight">
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
