import { Separator } from "@/components/ui/separator";

/**
 * F: An Aesthetic Analysis — Finding 02 continued.
 *
 * Three-column editorial text describing the taxonomy methodology,
 * followed by two diagram placeholders for taxonomy breakdown and heatmap.
 */
export function AestheticAnalysis() {
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
          Key Finding 02 (Cont.)
        </p>
        <h2
          className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          An Aesthetic Analysis
        </h2>

        <Separator className="mt-5" />

        {/* Three-column body — placeholder text */}
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            To quantify the aesthetic patterns, a six-dimension taxonomy was
            developed covering architectural period, decorative philosophy,
            cultural orientation, material palette, art and display, and spatial
            character. Each of the 1,628 cataloged homes was tagged across all
            six dimensions using AI-assisted classification trained on the
            original magazine text and page imagery.
          </p>
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            The taxonomy maps 36 distinct values across the six dimensions,
            allowing each home to be represented as a multi-dimensional
            aesthetic profile. When the profiles of Epstein-connected homes are
            aggregated and compared against the full AD archive, the divergences
            become statistically visible &mdash; not as subtle signals, but as
            pronounced clustering in specific aesthetic territories.
          </p>
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            The following visualizations break down each dimension, comparing
            the frequency of aesthetic values in the Epstein orbit against the
            general AD population. The radar chart provides a six-axis overview;
            the heatmap offers granular detail by individual value. Together,
            they define the contours of what might be called the Epstein
            aesthetic.
          </p>
        </div>

        {/* Diagram Placeholders */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <DiagramPlaceholder label="6-Dimension Taxonomy Breakdown" />
          <DiagramPlaceholder label="Style Comparison Heatmap" />
        </div>
      </div>
    </section>
  );
}

function DiagramPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="flex h-[340px] items-center justify-center rounded border border-dashed border-border"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/50"
        style={{ fontFamily: "futura-pt, sans-serif" }}
      >
        {label}
      </p>
    </div>
  );
}
