/**
 * A: Key Findings Introduction — centered summary paragraph.
 *
 * Sets the stage for both findings: the names and the aesthetic.
 * Centered Playfair Display on an 800px column, generous vertical padding.
 */
export function KeyFindingsIntro() {
  return (
    <section className="bg-background pb-12 pt-16">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <div className="mx-auto max-w-[800px] text-center">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
          >
            Key Findings
          </p>
          <p className="mt-8 font-serif text-[17px] leading-[1.8] text-[#1A1A1A]">
            This investigation identified {" "}
            <strong className="text-[#1A1A1A]">33 confirmed connections</strong>
            {" "} between individuals featured in Architectural Digest and those
            documented in Jeffrey Epstein&rsquo;s network &mdash; contact books,
            flight logs, legal proceedings, and DOJ records. Beyond the names
            themselves, a measurable aesthetic pattern emerged: the homes of
            Epstein-connected individuals share a distinct design vocabulary that
            diverges sharply from the broader AD archive. These are the two
            findings &mdash; who they are, and what their homes reveal.
          </p>
        </div>
      </div>
    </section>
  );
}
