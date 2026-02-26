/**
 * What's Next — ongoing investigation status and future plans.
 *
 * Positioned between Conclusion and Methodology.
 * Two-column layout: left column for active work, right for future directions.
 */
export function WhatsNext() {
  return (
    <section id="whats-next" className="narrative bg-background pb-16 pt-14">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <p className="n-label">Ongoing</p>
        <h2 className="n-title">3.1 What&rsquo;s Next</h2>
        <hr className="n-rule mb-8" />

        <div className="n-body n-body-narrow">
          <p className="n-label mb-4">The Pipeline Is Still Running</p>
          <p>
            This investigation is not finished. The autonomous agent pipeline
            continues to process issues, cross-reference names, and build
            dossiers. Hundreds of features remain to be checked against the DOJ
            Epstein Library, and the confirmed connection count will grow as
            investigations complete. Every number on this page is live &mdash;
            drawn from the pipeline database in real time.
          </p>
          <p>
            The aesthetic taxonomy is also expanding. As new confirmed
            connections are identified, their homes are scored across all six
            dimensions, sharpening the statistical signal. The radar chart and
            comparison data update automatically.
          </p>

          <p className="n-label mb-4 mt-10">Future Directions</p>
          <p>
            The same methodology could be applied to other shelter magazines
            &mdash; Vogue Living, World of Interiors, Elle Decor &mdash; to
            test whether the patterns identified here are specific to
            Architectural Digest or reflect a broader overlap between
            high-end design media and Epstein&rsquo;s documented network.
          </p>
          <p>
            The full codebase &mdash; including the multi-agent pipeline,
            extraction logic, cross-referencing engine, and this website
            &mdash; is open for inspection. Every finding documented here can
            be independently verified against the primary sources: the DOJ
            Epstein Library and the archive.org collection of Architectural
            Digest.
          </p>
        </div>

      </div>
    </section>
  );
}
