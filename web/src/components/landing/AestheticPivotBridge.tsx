/**
 * Bridge: The Aesthetic Pivot — dark section with centered pull quote.
 *
 * Creates a dramatic tonal shift between Finding 01 (the names) and
 * Finding 02 (the aesthetic). Dark background, Playfair italic quote,
 * Inter attribution. The pivot point of the entire narrative.
 */
export function AestheticPivotBridge() {
  return (
    <section style={{ backgroundColor: "#1A1A1A" }}>
      <div
        className="mx-auto flex w-full flex-col items-center justify-center py-20"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <blockquote className="max-w-[800px] text-center font-serif text-[20px] italic leading-[1.7] text-white/50">
          &ldquo;The largest single residential property in Manhattan &mdash; a
          40-room Herbert N. Straus mansion with hand-painted Cocteau tiles, an
          18th-century French wood-paneled library, and enough old masters to
          fill a small museum. The question was never whether Epstein had taste.
          It was what that taste revealed.&rdquo;
        </blockquote>
        <p
          className="mt-5 text-[10px] uppercase tracking-[0.25em] text-white/25"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Composite Description from Public Reporting
        </p>
      </div>
    </section>
  );
}
