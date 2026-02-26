import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const appendixItems = [
  {
    letter: "A",
    title: "Full Index & Dossiers",
    href: "/fullindex",
    description:
      "Complete searchable database of all features with linked dossier reports.",
  },
  {
    letter: "B",
    title: "Aesthetic Scores",
    href: "/aestheticscores",
    description:
      "Full table of 9-axis aesthetic scores for all scored features.",
  },
  {
    letter: "C",
    title: "Knowledge Graph",
    href: "/fullgraph",
    description:
      "Interactive network visualization of people, properties, designers, and Epstein connections.",
  },
  {
    letter: "D",
    title: "Inter-Model Reliability Study",
    href: "/reliability",
    description:
      "ICC analysis across Opus, Sonnet, and Haiku scoring runs.",
  },
  {
    letter: "E",
    title: "Calibration Transcript",
    href: "/calibration-transcript",
    description:
      "Full scoring calibration session showing rubric development.",
  },
  {
    letter: "F",
    title: "Graph Explorer",
    href: "/explorer",
    description: "Interactive force-directed graph explorer.",
  },
  {
    letter: "G",
    title: "Category Breakdown Data",
    href: "/data/category-breakdown",
    description:
      "Individual-level data behind Fig. 2: every confirmed name by subject category with aggregate summary.",
  },
  {
    letter: "H",
    title: "Wealth Origin Classifications",
    href: "/data/wealth-origin",
    description:
      "Individual-level data behind Fig. 3: Opus-classified wealth origins for Epstein orbit and AD baseline.",
  },
  {
    letter: "I",
    title: "Forbes Self-Made Scores",
    href: "/data/forbes-scores",
    description:
      "Individual-level data behind Fig. 4: Forbes Self-Made Score (1–10) for all 445 classified individuals.",
  },
];

export function Appendix() {
  return (
    <section id="appendix" className="bg-background pb-16 pt-14">
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
          Appendix
        </p>
        <h2
          className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Supporting Materials
        </h2>

        <Separator className="mt-5 mb-8" />

        <p className="mb-10 max-w-[720px] font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
          The complete data, scoring tables, and interactive tools behind
          this investigation. Every finding documented above can be
          independently verified against these primary sources.
        </p>

        {/* Appendix list */}
        <div className="flex flex-col gap-6">
          {appendixItems.map((item, i) => (
            <div key={item.letter}>
              {i > 0 && <Separator className="mb-6" />}
              <Link
                href={item.href}
                className="group flex gap-4 transition-opacity hover:opacity-80"
              >
                <span
                  className="mt-0.5 text-[20px] font-bold leading-none"
                  style={{
                    fontFamily: "futura-pt, sans-serif",
                    color: "#B87333",
                  }}
                >
                  {item.letter}.
                </span>
                <div>
                  <p
                    className="text-[15px] font-bold leading-tight group-hover:underline group-hover:underline-offset-4"
                    style={{ fontFamily: "futura-pt, sans-serif" }}
                  >
                    {item.title}
                  </p>
                  <p className="mt-1.5 font-serif text-[14px] leading-[1.6] text-[#666]">
                    {item.description}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
