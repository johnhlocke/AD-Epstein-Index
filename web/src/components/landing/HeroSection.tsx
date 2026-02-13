import type { StatsResponse } from "@/lib/types";
import { Separator } from "@/components/ui/separator";

interface HeroSectionProps {
  stats: StatsResponse;
}

/**
 * Hero section — "They Live" editorial layout.
 *
 * Futura PT Black headline, Playfair serif body, centered epigraph,
 * 6-column stats grid with copper anchor stat for confirmed connections.
 */
export function HeroSection({ stats }: HeroSectionProps) {
  return (
    <section className="relative border-b border-border bg-background">
      <div
        className="mx-auto flex w-full flex-col"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
          paddingTop: "72px",
          paddingBottom: "96px",
        }}
      >
        {/* ── Epigraph ── */}
        <div className="mb-12 flex flex-col items-center text-center md:mb-16">
          <blockquote className="max-w-[520px] font-serif text-[14px] italic leading-[1.8] text-muted-foreground md:text-[15px]">
            &ldquo;While civilization has been improving our houses, it has not
            equally improved the men who are to inhabit them. It has created
            palaces, but it was not so easy to create noblemen and
            kings.&rdquo;
          </blockquote>
          <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-[#999]">
            Henry David Thoreau
          </p>
        </div>

        {/* ── Headline + Subhead ── */}
        <div className="mb-10 md:mb-12">
          <h1
            className="text-[48px] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-[64px] md:text-[80px] lg:text-[96px]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Where They Live
          </h1>
          <p
            className="mt-3 max-w-[600px] text-base font-bold leading-[1.4] text-foreground/80 md:mt-4 md:text-lg lg:text-xl"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            A Visual Map of the Connections between Architectural Digest and
            the Epstein Files
          </p>
        </div>

        {/* ── Intro Section ── */}
        <div className="flex flex-col">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Introduction
          </p>

          <Separator className="mt-2" />

          {/* Three-column body — serif for warmth against the geometric headline */}
          <div className="mt-5 grid gap-6 md:grid-cols-3">
            <p className="font-serif text-[15px] leading-[1.75] text-foreground/65">
              This investigation looks at the last 28 years of Architectural
              Digest (AD) stretching back to 1988. In that time, the magazine
              celebrated the homes of over 1600 individuals. Many of those
              featured are of great wealth and power. And perhaps
              unsurprisingly, many of those also happen to have had direct and
              repeated contact with Jeffrey Epstein as documented in the
              Department of Justice&rsquo;s Epstein Files. This site names
              those connected homeowners and documents the nature of those
              connections.
            </p>
            <p className="font-serif text-[15px] leading-[1.75] text-foreground/65">
              Architectural Digest is considered the preeminent arbiter of
              mainstream taste in interior design. If there is a high
              correlation between AD features and Epstein&rsquo;s network, it
              warrants asking: &ldquo;How much of what we consider &lsquo;good
              design&rsquo; as highlighted in the featured pages of AD was
              commissioned, built, and lived in by those with connections to
              Epstein?&rdquo; What does that reveal about the aesthetics of
              power and design? Is there a demonstrable &ldquo;Epstein
              aesthetic&rdquo; that can be seen consistently across these
              homes?
            </p>
            <p className="font-serif text-[15px] leading-[1.75] text-foreground/65">
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

        {/* ── 6-Column Stats Grid ── */}
        <div className="mt-12 md:mt-14">
          <Separator />
          <div className="grid grid-cols-2 gap-6 pt-8 sm:grid-cols-3 md:grid-cols-6 md:gap-px">
            {/* Stat 1: Years Covered */}
            <div className="flex flex-col py-3 pr-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight md:text-[32px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                28
              </p>
              <p
                className="mt-2 text-[9px] uppercase tracking-[0.15em] text-muted-foreground md:text-[10px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Years Covered
              </p>
            </div>

            {/* Stat 2: Issues Scanned */}
            <div className="flex flex-col py-3 pr-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight md:text-[32px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {stats.issues.total}
              </p>
              <p
                className="mt-2 text-[9px] uppercase tracking-[0.15em] text-muted-foreground md:text-[10px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Issues Scanned
              </p>
            </div>

            {/* Stat 3: Homes Cataloged */}
            <div className="flex flex-col py-3 pr-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight md:text-[32px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {stats.features.total}
              </p>
              <p
                className="mt-2 text-[9px] uppercase tracking-[0.15em] text-muted-foreground md:text-[10px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Homes Cataloged
              </p>
            </div>

            {/* Stat 4: Names Cross-Referenced */}
            <div className="flex flex-col py-3 pr-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight md:text-[32px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {stats.crossReferences.total}
              </p>
              <p
                className="mt-2 text-[9px] uppercase tracking-[0.15em] text-muted-foreground md:text-[10px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Names Cross-Referenced
              </p>
            </div>

            {/* Stat 5: Dossiers Built */}
            <div className="flex flex-col py-3 pr-4">
              <p
                className="text-[28px] font-bold leading-none tracking-tight md:text-[32px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                {stats.dossiers.total}
              </p>
              <p
                className="mt-2 text-[9px] uppercase tracking-[0.15em] text-muted-foreground md:text-[10px]"
                style={{ fontFamily: "futura-pt, sans-serif" }}
              >
                Dossiers Built
              </p>
            </div>

            {/* Stat 6: Confirmed Connections — THE anchor stat */}
            <div
              className="-my-1 flex flex-col justify-center rounded px-4 py-4"
              style={{ backgroundColor: "rgba(184, 115, 51, 0.12)" }}
            >
              <p
                className="text-[32px] font-black leading-none tracking-tight md:text-[36px]"
                style={{
                  fontFamily: "futura-pt, sans-serif",
                  color: "#D4A574",
                }}
              >
                {stats.dossiers.confirmed}
              </p>
              <p
                className="mt-2 text-[9px] font-bold uppercase tracking-[0.15em] md:text-[10px]"
                style={{
                  fontFamily: "futura-pt, sans-serif",
                  color: "#B87333",
                }}
              >
                Confirmed Connections
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
