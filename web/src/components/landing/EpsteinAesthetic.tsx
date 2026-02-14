import { Separator } from "@/components/ui/separator";
import { AestheticRadarCard } from "@/components/charts/AestheticRadarCard";
import type { AestheticRadarData } from "@/lib/types";

interface EpsteinAestheticProps {
  radarData?: AestheticRadarData;
}

/**
 * E: Is There an Epstein Aesthetic? — Finding 02 introduction.
 *
 * Two text columns flanking a live radar chart in the center.
 * Chart styled to match the ConfirmedTimeline diagram.
 */
export function EpsteinAesthetic({ radarData }: EpsteinAestheticProps) {
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
          Key Finding 02
        </p>
        <h2
          className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Is There an Epstein Aesthetic?
        </h2>

        <Separator className="mt-5" />

        {/* Three-column: text | radar chart | text */}
        <div className="mt-5 grid items-start gap-6 md:grid-cols-3">
          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            When the homes of confirmed Epstein connections are analyzed as a
            group, a striking pattern emerges. Across six aesthetic dimensions
            &mdash; from architectural period to decorative philosophy &mdash;
            the Epstein-connected homes diverge sharply from the broader AD
            archive. They are 3.4&times; more likely to feature Classical
            Grandeur and 2.4&times; more likely to lean Formal in their
            decorative approach.
          </p>

          {/* Center: Live radar chart */}
          <AestheticRadarCard data={radarData} />

          <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
            These patterns don&rsquo;t prove anything about the individuals
            themselves. But they do suggest that the intersection of extreme
            wealth, social proximity to Epstein, and a particular flavor of
            European-inflected opulence is not coincidental. It is a
            measurable signal in the data &mdash; one that the following
            analysis quantifies across every confirmed home.
          </p>
        </div>

        {/* Diagram Placeholder */}
        <div className="mt-10">
          <DiagramPlaceholder label="Aesthetic Score Distribution" />
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
