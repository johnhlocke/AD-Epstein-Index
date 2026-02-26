/**
 * G: Testing the Epstein Aesthetic — Finding 02 continued.
 *
 * Three-column editorial text describing the blind test methodology,
 * followed by two diagram placeholders for test results and confidence.
 */
export function TestingAesthetic() {
  return (
    <section id="testing" className="narrative bg-background pb-16 pt-14">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        <p className="n-label">Key Finding 02 (Cont.)</p>
        <h2 className="n-title">2.4 Testing: 9 East 71st Street</h2>
        <hr className="n-rule" />

        <div className="n-body n-body-narrow mt-5">
          <p>
            If a distinct Epstein aesthetic exists, it should be predictable
            &mdash; identifiable from the design alone, without knowledge of the
            homeowner&rsquo;s identity or their documented connections. To test
            this hypothesis, a blind classification experiment was designed: an
            AI model was shown aesthetic profiles of AD homes without any
            identifying information and asked to predict whether the homeowner
            appeared in Epstein records.
          </p>
          <p>
            The results of this experiment are preliminary but suggestive. When
            a home scores high on Classical Grandeur, Formal decorative
            philosophy, and Euro-Centric cultural orientation simultaneously,
            the likelihood of an Epstein connection rises measurably above the
            base rate. This does not mean every classical home belongs to an
            Epstein associate &mdash; but it does indicate that the aesthetic
            signal is real and statistically distinguishable.
          </p>
          <p>
            The diagrams below present the blind test results alongside
            confidence scores for each prediction dimension. These findings
            should be interpreted with appropriate caution &mdash; the confirmed
            sample size is 33 homes, and broader patterns will become clearer as
            the investigation continues. What they establish is a direction: the
            aesthetic of Epstein&rsquo;s orbit is not just visible. It is
            measurable.
          </p>
        </div>

        {/* Diagram Placeholders */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <DiagramPlaceholder label="Blind Test Results" />
          <DiagramPlaceholder label="Prediction Confidence Scores" />
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
