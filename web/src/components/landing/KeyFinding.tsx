import { Separator } from "@/components/ui/separator";

/**
 * Key Finding — three-column editorial text block.
 *
 * Sits between the Hero introduction and the Temporal Analysis chart.
 * Summarizes the core finding, the clustering pattern, and the
 * structural-proximity argument in newspaper column layout.
 */
export function KeyFinding() {
  return (
    <section
      className="bg-background pb-20 pt-16"
      id="key-finding"
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Key Finding
        </p>

        <Separator className="mt-2" />

        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
            Of the more than 1,000 homes featured in Architectural Digest
            between 1988 and 2025, at least 27 belong to individuals whose
            names appear in the Department of Justice&rsquo;s Epstein files or
            in Epstein&rsquo;s personal address book. These are not speculative
            links &mdash; each connection has been confirmed through direct name
            matches in official records.
          </p>
          <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
            The confirmed connections are not evenly distributed. They cluster
            heavily in the magazine&rsquo;s coverage during the late 1990s and
            early 2000s &mdash; the same period when Epstein&rsquo;s social
            network was at its most expansive. Several interior designers appear
            repeatedly across these connected homes, suggesting shared
            professional networks that intersected with Epstein&rsquo;s circle.
          </p>
          <p className="font-serif text-[15px] leading-[1.75] text-foreground/60">
            This does not imply that Architectural Digest knowingly featured
            Epstein associates. It reveals something more structural: that the
            world of high-end residential design &mdash; the architects, the
            decorators, the tastemakers &mdash; overlapped significantly with
            the social milieu documented in the Epstein files. The question is
            not one of intent but of proximity.
          </p>
        </div>
      </div>
    </section>
  );
}
