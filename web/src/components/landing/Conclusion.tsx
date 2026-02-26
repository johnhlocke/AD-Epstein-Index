/**
 * H: Conclusion — centered italic closing statement.
 *
 * Measured, restrained final paragraph. No hysteria, no overreach.
 * Just facts, white space, and a proper Playfair italic sign-off.
 */
export function Conclusion() {
  return (
    <section id="conclusion" className="narrative bg-background pb-20 pt-12">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <div className="n-body mx-auto max-w-[800px] text-center">
          <p className="text-[17px] italic leading-[1.8]">
            This project does not claim that taste is criminal, or that owning a
            gilded antique makes someone complicit. What it demonstrates is that
            the social world Jeffrey Epstein moved through &mdash; the one
            documented in flight logs, address books, and legal proceedings
            &mdash; overlaps with the world Architectural Digest celebrates. The
            aesthetic patterns that emerge from that overlap are consistent,
            measurable, and worth examining. The homes are real. The names are
            public record. The connections speak for themselves.
          </p>
        </div>
      </div>
    </section>
  );
}
