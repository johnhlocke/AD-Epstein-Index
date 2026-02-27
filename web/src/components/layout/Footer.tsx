import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto py-12" style={{ maxWidth: "var(--grid-max-width)", paddingLeft: "var(--grid-margin)", paddingRight: "var(--grid-margin)" }}>
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="max-w-[612px]">
            <h3 className="font-serif text-lg font-semibold">AD-Epstein Index</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              A data-driven research project cataloging every featured home in
              Architectural Digest (1988&ndash;2025) and cross-referencing with
              the DOJ Epstein Library.
            </p>
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <div className="flex flex-col gap-2">
              <span className="font-medium text-foreground">Project</span>
              <a href="#agent-methodology" className="hover:text-foreground transition-colors">
                Agent Methodology
              </a>
              <a href="#aesthetic-methodology" className="hover:text-foreground transition-colors">
                Aesthetic Methodology
              </a>
              <a
                href="https://www.justice.gov/epstein"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                DOJ Epstein Library
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-medium text-foreground">Data</span>
              <a href="#index" className="hover:text-foreground transition-colors">
                Searchable Index
              </a>
              <a href="/api/stats" className="hover:text-foreground transition-colors">
                Stats API
              </a>
              <a
                href="https://github.com/johnhlocke/AD-Epstein-Index"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground">
          Data sourced from archive.org and the U.S. Department of Justice.
          This project presents factual findings — presence in public records does not imply wrongdoing.
        </p>
      </div>
    </footer>
  );
}
