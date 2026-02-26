/**
 * F: An Aesthetic Analysis — Finding 02 continued.
 *
 * Three-column editorial text describing the taxonomy methodology,
 * followed by two diagram placeholders for taxonomy breakdown and heatmap.
 */
export function AestheticAnalysis() {
  return (
    <section id="aesthetic-analysis" className="narrative bg-background pb-16 pt-14">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <p className="n-label">Key Finding 02 (Cont.)</p>
        <h2 className="n-title">2.3 Why These Homes Perform</h2>
        <hr className="n-rule" />

        <div className="n-body n-body-narrow mt-5">
          <p>
            To quantify the aesthetic patterns, a six-dimension taxonomy was
            developed covering architectural period, decorative philosophy,
            cultural orientation, material palette, art and display, and spatial
            character. Each of the 3,763 cataloged homes was tagged across all
            six dimensions using AI-assisted classification trained on the
            original magazine text and page imagery.
          </p>
          <p>
            The taxonomy maps 36 distinct values across the six dimensions,
            allowing each home to be represented as a multi-dimensional
            aesthetic profile. When the profiles of Epstein-connected homes are
            aggregated and compared against the full AD archive, the divergences
            become statistically visible &mdash; not as subtle signals, but as
            pronounced clustering in specific aesthetic territories.
          </p>
          <p>
            The following visualizations break down each dimension, comparing
            the frequency of aesthetic values in the Epstein orbit against the
            general AD population. The radar chart provides a six-axis overview;
            the heatmap offers granular detail by individual value. Together,
            they define the contours of what might be called the Epstein
            aesthetic.
          </p>
        </div>

        {/* ── Han et al. Status Signaling Taxonomy ── */}
        <div className="mt-10" style={{ maxWidth: "var(--content-narrow)" }}>
          <div className="n-body n-body-narrow">
            <p>
              The sociologist Thorstein Veblen coined &ldquo;conspicuous
              consumption&rdquo; in 1899, but the modern taxonomy comes from Han,
              Nunes &amp; Dr&egrave;ze (2010), who mapped four consumer types by
              wealth and need for status. Their framework maps cleanly onto our
              data: AD&rsquo;s baseline skews Patrician&mdash;quiet taste, no
              need to broadcast&mdash;while the Epstein-connected homes shift
              sharply toward Parvenu territory.
            </p>
          </div>

          <div
            className="mt-4 overflow-hidden border"
            style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
          >
            <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
              <p
                className="text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
              >
                Status Signaling Taxonomy &mdash; Han, Nunes &amp; Dr&egrave;ze (2010)
              </p>
            </div>
            <div className="overflow-x-auto px-4 py-3">
              <table className="w-full border-collapse" style={{ fontFamily: "futura-pt, sans-serif" }}>
                <thead>
                  <tr>
                    {["Type", "Wealth", "Need for Status", "Signal Style", "Epstein Network?"].map(
                      (h: string, i: number) => (
                        <th
                          key={h}
                          className="border-b px-4 py-2.5 text-left text-[13px] font-bold uppercase tracking-[0.08em]"
                          style={{
                            borderColor: "#E0DCD4",
                            color: "#666",
                            borderRight: i < 4 ? "1px solid #E0DCD4" : undefined,
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="text-[14px]" style={{ color: "#333" }}>
                  <tr>
                    <td className="border-b border-[#E0DCD4] px-4 py-3 text-[17px] font-bold italic" style={{ borderRight: "1px solid #E0DCD4" }}>Patrician</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>High</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>Low</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>Quiet, subtle signals legible only to peers. Pays a premium for unbranded luxury &mdash; doesn&rsquo;t need others to recognize it.</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3">AD baseline &mdash; museum-quality but never performing. Wealth so established it doesn&rsquo;t need to announce itself.</td>
                  </tr>
                  <tr style={{ backgroundColor: "rgba(184, 115, 51, 0.08)" }}>
                    <td className="border-b border-[#E0DCD4] px-4 py-3 text-[17px] font-bold italic" style={{ borderRight: "1px solid #E0DCD4" }}>Parvenu</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>High</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>High</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>Loud, legible luxury; conspicuous markers even the uninitiated can decode &mdash; the Old Master, the name-brand architect</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3">Epstein orbit &mdash; new wealth performing patrician status it hasn&rsquo;t inherited. The home is an instrument of access.</td>
                  </tr>
                  <tr>
                    <td className="border-b border-[#E0DCD4] px-4 py-3 text-[17px] font-bold italic" style={{ borderRight: "1px solid #E0DCD4" }}>Poseur</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>Low</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>High</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>Counterfeit signals; mimics Parvenu with dupes and look-alikes, relies on &ldquo;close enough&rdquo;</td>
                    <td className="border-b border-[#E0DCD4] px-4 py-3">Downstream of the pipeline &mdash; the Cloud Couch dupe, the TikTok &ldquo;get the look for less&rdquo;</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-[17px] font-bold italic" style={{ borderRight: "1px solid #E0DCD4" }}>Proletarian</td>
                    <td className="px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>Low</td>
                    <td className="px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>Low</td>
                    <td className="px-4 py-3" style={{ borderRight: "1px solid #E0DCD4" }}>No signal; consumption is functional, not performative</td>
                    <td className="px-4 py-3">Outside the pipeline entirely. Not reading AD, or buying dupes. Not a participant in the meaning transfer chain.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p className="n-caption">
            Adapted from Han, Nunes &amp; Dr&egrave;ze (2010).
            The Epstein Network column maps our findings to the original
            taxonomy.
          </p>
        </div>

        {/* Diagram Placeholders */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <DiagramPlaceholder label="6-Dimension Taxonomy Breakdown" />
          <DiagramPlaceholder label="Style Comparison Heatmap" />
        </div>

        {/* ── Case Study: Alberto Pinto ── */}
        <div className="mt-16">
          <p className="n-label">Case Study</p>
          <h3 className="n-title" style={{ fontSize: 24 }}>
            Alberto Pinto: Epstein&rsquo;s Designer
          </h3>
          <hr className="n-rule" />

          <div className="n-body n-body-narrow mt-5">
            <p>
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
            <p>
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
            <p>
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
