import { Separator } from "@/components/ui/separator";

/**
 * B: Who Are They? — Key Finding 01 three-column editorial text block.
 *
 * Section header with copper "KEY FINDING 01" label and Futura Heavy title,
 * followed by three columns summarizing the core finding, clustering,
 * and structural-proximity argument.
 */
export function KeyFinding() {
  return (
    <section
      className="bg-background pb-20 pt-14"
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
        {/* Section Header */}
        <p
          className="text-[11px] font-bold uppercase tracking-[0.15em]"
          style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
        >
          Key Finding 01
        </p>
        <h2
          className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Who Are They?
        </h2>

        <Separator className="mt-5" />

        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            Of the more than 1,000 homes featured in Architectural Digest
            between 1988 and 2025, at least 27 belong to individuals whose
            names appear in the Department of Justice&rsquo;s Epstein files or
            in Epstein&rsquo;s personal address book. These are not speculative
            links &mdash; each connection has been confirmed through direct name
            matches in official records.
          </p>
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            The confirmed connections are not evenly distributed. They cluster
            heavily in the magazine&rsquo;s coverage during the late 1990s and
            early 2000s &mdash; the same period when Epstein&rsquo;s social
            network was at its most expansive. Several interior designers appear
            repeatedly across these connected homes, suggesting shared
            professional networks that intersected with Epstein&rsquo;s circle.
          </p>
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
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
