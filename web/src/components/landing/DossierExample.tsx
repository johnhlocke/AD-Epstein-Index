/**
 * Dossier Example — shows what a confirmed connection looks like.
 *
 * Two-column layout on warm off-white: AD feature on left, Epstein
 * evidence on right. Placeholder fields for name, issue, source,
 * evidence, and verdict. Will be populated with a real dossier.
 */
export function DossierExample() {
  return (
    <section id="dossier-example" className="narrative" style={{ backgroundColor: "#FAF8F5" }}>
      <div
        className="mx-auto w-full pb-16 pt-14"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <p className="n-label">Example Dossier</p>
        <h2 className="n-title">1.4 The Epstein Profile vs the AD Baseline</h2>
        <hr className="n-rule" />

        {/* Two-column layout */}
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {/* Left: AD Magazine Spread placeholder */}
          <div>
            <p
              className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              AD Feature
            </p>
            <div
              className="flex h-[280px] items-center justify-center rounded"
              style={{ backgroundColor: "#F0ECE4" }}
            >
              <p
                className="text-[11px] uppercase tracking-[0.2em]"
                style={{
                  fontFamily: "futura-pt, sans-serif",
                  color: "#B8A88A",
                }}
              >
                AD Magazine Spread
              </p>
            </div>
          </div>

          {/* Right: Epstein Connection fields */}
          <div>
            <p
              className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              Epstein Connection
            </p>
            <div
              className="rounded border border-border/40 p-6"
              style={{ backgroundColor: "#FAF6F1" }}
            >
              <div className="space-y-5">
                <DossierField label="Name" value="[Homeowner Name]" />
                <DossierField label="AD Issue" value="[Month Year]" />
                <DossierField label="Source" value="[Black Book / DOJ / Both]" />
                <DossierField
                  label="Evidence"
                  value="[Contact entry, flight log, guest list, etc.]"
                />
                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                    style={{ fontFamily: "futura-pt, sans-serif" }}
                  >
                    Verdict
                  </p>
                  <p
                    className="mt-1 text-[18px] font-bold uppercase tracking-[0.05em]"
                    style={{ fontFamily: "futura-pt, sans-serif", color: "#2D6A4F" }}
                  >
                    Confirmed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DossierField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
        style={{ fontFamily: "futura-pt, sans-serif" }}
      >
        {label}
      </p>
      <p className="mt-1 font-serif text-[15px] text-[#1A1A1A]">{value}</p>
    </div>
  );
}
