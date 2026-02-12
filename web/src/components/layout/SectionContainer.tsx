interface SectionContainerProps {
  children: React.ReactNode;
  width?: "narrow" | "medium" | "wide";
  className?: string;
  id?: string;
}

/**
 * Grid-aligned section container.
 *
 * Uses CSS custom properties (--grid-margin, --grid-max-width) for responsive
 * margins that follow the proportional system: 24px → 48px → 96px.
 *
 * Tiers (at 1440px reference):
 *   narrow  = 612px  — 3 slices, body text / prose
 *   medium  = 824px  — 4 slices, charts with legends / tables
 *   wide    = 1248px — 6 slices, full content width
 */
export function SectionContainer({
  children,
  width = "wide",
  className = "",
  id,
}: SectionContainerProps) {
  return (
    <section
      id={id}
      className={`mx-auto w-full ${className}`}
      style={{
        maxWidth: "var(--grid-max-width)",
        paddingLeft: "var(--grid-margin)",
        paddingRight: "var(--grid-margin)",
      }}
    >
      {width === "wide" ? (
        children
      ) : (
        <div
          className="w-full"
          style={{
            maxWidth: width === "narrow" ? 612 : 824,
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}
