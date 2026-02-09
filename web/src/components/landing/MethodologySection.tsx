import { SectionContainer } from "@/components/layout/SectionContainer";
import { Separator } from "@/components/ui/separator";

const steps = [
  {
    phase: "Phase 1",
    title: "Build the AD Database",
    description:
      "An autonomous multi-agent system discovers, downloads, and extracts data from every issue of Architectural Digest available on archive.org (1988\u20132025). A vision AI reads each issue's table of contents, then extracts homeowner names, designers, locations, styles, and other metrics from each featured home.",
  },
  {
    phase: "Phase 2",
    title: "Cross-Reference with Epstein Records",
    description:
      "Every extracted name is automatically cross-referenced against Epstein's Little Black Book (a text document of ~1,500 names) and the DOJ's Full Epstein Library (justice.gov/epstein). A Detective agent searches both sources, and a Researcher agent builds dossiers on potential matches. An Editor agent reviews every dossier before confirming or rejecting.",
  },
  {
    phase: "Phase 3",
    title: "Interactive Visualization",
    description:
      "This website. All data is served from a Supabase database via server-side queries. No client-side API keys are exposed. The searchable index, charts, and dossier pages are generated from live pipeline data.",
  },
];

export function MethodologySection() {
  return (
    <SectionContainer width="text" className="py-20" id="methodology">
      <h2 className="font-serif text-3xl font-bold">Methodology</h2>
      <p className="mt-2 mb-8 text-muted-foreground">
        How the data was collected, cross-referenced, and verified.
      </p>
      <div className="space-y-8">
        {steps.map((step, i) => (
          <div key={i}>
            <p className="text-xs font-semibold uppercase tracking-widest text-copper">
              {step.phase}
            </p>
            <h3 className="mt-1 font-serif text-xl font-semibold">{step.title}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {step.description}
            </p>
            {i < steps.length - 1 && <Separator className="mt-8" />}
          </div>
        ))}
      </div>
      <div className="mt-12 rounded-lg border border-border bg-muted/50 p-6">
        <h3 className="font-serif text-lg font-semibold">Important Disclaimer</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Appearance in Epstein-related documents does not imply wrongdoing.
          Many names appear in address books, flight logs, and legal filings
          for entirely innocuous reasons. This project identifies name matches
          in public records — it does not make accusations. Every match is
          reviewed and categorized by confidence level.
        </p>
      </div>
    </SectionContainer>
  );
}
