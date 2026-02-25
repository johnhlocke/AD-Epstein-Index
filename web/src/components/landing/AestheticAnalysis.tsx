import { Separator } from "@/components/ui/separator";

/**
 * F: An Aesthetic Analysis — Finding 02 continued.
 *
 * Three-column editorial text describing the taxonomy methodology,
 * followed by two diagram placeholders for taxonomy breakdown and heatmap.
 */
export function AestheticAnalysis() {
  return (
    <section id="aesthetic-analysis" className="bg-background pb-16 pt-14">
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
            character. Each of the 3,763 cataloged homes was tagged across all
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

        {/* ── Case Study: Alberto Pinto ── */}
        <div className="mt-16">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
          >
            Case Study
          </p>
          <h3
            className="mt-2 text-[22px] font-black uppercase leading-[0.95] tracking-[0.01em] md:text-[26px]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Alberto Pinto: Epstein&rsquo;s Designer
          </h3>

          <Separator className="mt-5" />

          <div className="mt-5 grid gap-6 md:grid-cols-3">
            <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
              Alberto Pinto designed interiors for at least three Epstein
              properties&mdash;9 East 71st Street in Manhattan (the site of
              alleged crimes), the Avenue Foch apartment in Paris, and the Great
              St. James Island estate in the U.S. Virgin Islands. DOJ documents
              contain room-by-room budgets, architectural drawings, and
              procurement invoices spanning 2012&ndash;2016. He is listed in
              Epstein&rsquo;s Black Book with his Paris office address and phone
              number. Personal emails show Pinto hosting Epstein at his Paris
              home and sharing his security code. This was not a vendor
              relationship. It was a sustained, personal, multi-property
              collaboration (849 DOJ document results, confidence: 0.98).
            </p>
            <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
              Architectural Digest featured seven homes designed by Pinto
              between 1988 and 2025, including two of his own residences (Paris
              and Rio de Janeiro) and his wife Linda Pinto&rsquo;s Paris
              apartment. Three of these seven homeowners are independently
              confirmed as Epstein-connected. The remaining four are not&mdash;
              this project only confirms homeowners with direct evidence in the
              DOJ records, and hiring Epstein&rsquo;s designer is not the same
              as being in Epstein&rsquo;s network. But every one of those homes
              channels the same aesthetic vocabulary Pinto developed for 9 East
              71st Street, Avenue Foch, and Great St. James.
            </p>
            <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
              Pinto is the literal mechanism of the aesthetic pipeline described
              in this paper. He is a confirmed node in Epstein&rsquo;s social
              network, a celebrated designer in AD&rsquo;s editorial pipeline,
              and the author of a design vocabulary that AD presented to its
              readership as aspirational taste. The knowledge graph below
              visualizes this subgraph: one designer node, seven AD features,
              three confirmed homeowner connections, and the aesthetic influence
              radiating outward through AD&rsquo;s cultural machinery.
            </p>
          </div>

          {/* Placeholder diagrams for Pinto case study */}
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <DiagramPlaceholder label="Pinto Subgraph — Knowledge Graph" />
            <DiagramPlaceholder label="Pinto 7 Homes — Aesthetic Score Comparison" />
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <DiagramPlaceholder label="Pinto Aesthetic vs. AD Baseline Radar" />
            <DiagramPlaceholder label="Pinto Timeline — AD Features × Epstein Collaboration" />
          </div>
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
