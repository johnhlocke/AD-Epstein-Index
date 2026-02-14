import { Separator } from "@/components/ui/separator";

/**
 * What's Next — ongoing investigation status and future plans.
 *
 * Positioned between Conclusion and Methodology.
 * Two-column layout: left column for active work, right for future directions.
 */
export function WhatsNext() {
  return (
    <section className="bg-background pb-16 pt-14">
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
          Ongoing
        </p>
        <h2
          className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          What&rsquo;s Next
        </h2>

        <Separator className="mt-5 mb-8" />

        {/* Two-column layout */}
        <div className="grid gap-12 md:grid-cols-2">
          {/* Left: Active work */}
          <div>
            <p
              className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              The Pipeline Is Still Running
            </p>
            <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
              This investigation is not finished. The autonomous agent pipeline
              continues to process issues, cross-reference names, and build
              dossiers. Hundreds of features remain to be checked against the DOJ
              Epstein Library, and the confirmed connection count will grow as
              investigations complete. Every number on this page is live &mdash;
              drawn from the pipeline database in real time.
            </p>
            <p className="mt-4 font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
              The aesthetic taxonomy is also expanding. As new confirmed
              connections are identified, their homes are scored across all six
              dimensions, sharpening the statistical signal. The radar chart and
              comparison data update automatically.
            </p>
          </div>

          {/* Right: Future directions */}
          <div>
            <p
              className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              Future Directions
            </p>
            <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
              The same methodology could be applied to other shelter magazines
              &mdash; Vogue Living, World of Interiors, Elle Decor &mdash; to
              test whether the patterns identified here are specific to
              Architectural Digest or reflect a broader overlap between
              high-end design media and Epstein&rsquo;s documented network.
            </p>
            <p className="mt-4 font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
              The full codebase &mdash; including the multi-agent pipeline,
              extraction logic, cross-referencing engine, and this website
              &mdash; is open for inspection. Every finding documented here can
              be independently verified against the primary sources: the DOJ
              Epstein Library and the archive.org collection of Architectural
              Digest.
            </p>
          </div>
        </div>

        {/* Contact */}
        <Separator className="mt-12 mb-8" />

        <div className="text-center">
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            Questions, corrections, or leads?{" "}
            <a
              href="mailto:john.h.locke@gmail.com"
              className="underline underline-offset-4 transition-colors hover:opacity-70"
              style={{ color: "#B87333" }}
            >
              john.h.locke@gmail.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
