import Link from "next/link";
import { VerdictSankey } from "@/components/charts/VerdictSankey";
import { CategorySkewChart } from "@/components/charts/CategorySkewChart";

import { WealthOriginDelta } from "@/components/charts/WealthOriginDelta";
import { ForbesHeatmap } from "@/components/charts/ForbesHeatmap";
import type { StatsResponse } from "@/lib/types";

interface KeyFindingProps {
  stats: StatsResponse;
}

/**
 * B: Who Are They? — Key Finding 01
 * Full-width investigation funnel Sankey + editorial prose below.
 */
export function KeyFinding({ stats }: KeyFindingProps) {
  return (
    <section
      className="narrative bg-background pb-6 pt-6"
      id="key-finding"
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        {/* Section Header */}
        <p className="n-label">Key Finding 01</p>
        <h2 className="n-title">1.1 Who Are They?</h2>
        <hr className="n-rule" />

        {/* ── Sankey — full width ── */}
        <div className="mt-5">
          <div
            className="overflow-hidden border"
            style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
          >
            <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
              <p
                className="text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
              >
                Investigation Funnel &mdash; Live Data
              </p>
            </div>
            <VerdictSankey
              featuresTotal={stats.features.total}
              crossRefsTotal={stats.crossReferences.total}
              dossiersTotal={stats.dossiers.total}
              confirmed={stats.dossiers.confirmed}
              rejected={stats.dossiers.rejected}
              tierToConfirmed={stats.dossiers.tierToConfirmed}
              tierToRejected={stats.dossiers.tierToRejected}
              strengthCounts={stats.dossiers.strengthCounts}
              variant="light"
            />
          </div>
          <p className="n-caption">
            Fig. 1 &mdash; How {stats.features.total.toLocaleString()} features
            are filtered through cross-referencing, name matching,
            dossier investigation, and editorial review to
            yield {stats.dossiers.confirmed.toLocaleString()} confirmed
            connections.
          </p>
        </div>

        {/* ── Category Skew — who are they? ── */}
        <div className="s-note-row mt-10">
          <div style={{ maxWidth: "var(--content-narrow)" }}>
            <div className="n-body">
              <p>
                The confirmed names span socialites, media executives, fashion
                empire founders, real estate developers, financiers, and at least
                two heads of state. Socialites are overrepresented at 1.5&times;
                their baseline rate in AD&rsquo;s general coverage&mdash;a
                demographic whose social function is, by definition, the
                cultivation of networks. These are not fringe figures. They are
                museum board members, Met Gala hosts, and philanthropy circuit
                regulars.
              </p>

            {/* Floated chart — 2 minor cols wide, after first paragraph */}
            <div
              className="float-left mt-6 mb-4 mr-6 hidden md:block"
              style={{ width: "calc((100% - 3 * 24px) / 4 * 2 + 24px)" }}
            >
              <div
                className="overflow-hidden border"
                style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
              >
                <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
                  >
                    What Do They Do?<br />
                    <span style={{ fontWeight: 400, color: "#666" }}>Epstein Orbit vs. AD Baseline</span>
                  </p>
                </div>
                <CategorySkewChart data={stats.categoryBreakdown} />
              </div>
              <p className="n-caption">
                Fig. 2 &mdash; Overrepresentation multiplier: Epstein orbit
                vs.&nbsp;AD baseline by category. Media leads at
                1.8&times;, Business and Socialites at 1.5&times;.{" "}
                <Link href="/data/category-breakdown" className="underline underline-offset-2" style={{ color: "#B87333" }}>
                  View source data&nbsp;&rarr;
                </Link>
              </p>
            </div>

            {/* Mobile-only chart (no float) */}
            <div className="mb-6 md:hidden">
              <div
                className="overflow-hidden border"
                style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
              >
                <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
                  >
                    What Do They Do?<br />
                    <span style={{ fontWeight: 400, color: "#666" }}>Epstein Orbit vs. AD Baseline</span>
                  </p>
                </div>
                <CategorySkewChart data={stats.categoryBreakdown} />
              </div>
              <p className="n-caption">
                Fig. 2 &mdash; Overrepresentation multiplier by category.{" "}
                <Link href="/data/category-breakdown" className="underline underline-offset-2" style={{ color: "#B87333" }}>
                  View source data&nbsp;&rarr;
                </Link>
              </p>
            </div>
              <p className="mt-6">
                The multiplier chart makes the pattern legible. Business
                dominates in raw numbers&mdash;65 of 199 confirmed
                connections, or 32.7% of the orbit versus 21.8% of
                AD&rsquo;s baseline&mdash;but Media shows the sharpest skew
                at 1.8&times;, appearing nearly twice as often in
                Epstein&rsquo;s circle as in the magazine&rsquo;s general
                coverage. The most telling category, however, is Private:
                a quarter of all AD features profile homeowners with no
                public persona, yet they account for just 3.5% of confirmed
                connections&mdash;a 7&times; underrepresentation. Epstein&rsquo;s
                network was not built on domestic privacy. It was built on
                access, visibility, and the social capital that comes with
                both.
              </p>
              <div style={{ clear: "both" }} />

              {/* ── Wealth Origin — floated chart ── */}
              {/* Floated chart — 2 minor cols wide */}
              <div
                className="float-left mt-1 mb-4 mr-6 hidden md:block"
                style={{ width: "calc((100% - 3 * 24px) / 4 * 2 + 24px)" }}
              >
                <div
                  className="overflow-hidden border"
                  style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
                >
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
                    <p
                      className="text-[9px] font-bold uppercase tracking-[0.12em]"
                      style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
                    >
                      How Are They Wealthy?<br />
                      <span style={{ fontWeight: 400, color: "#666" }}>Epstein Orbit Wealth Origin vs. AD Baseline</span>
                    </p>
                  </div>
                  <WealthOriginDelta />
                </div>
                <p className="n-caption">
                  Fig. 3 &mdash; Percentage-point difference between Epstein
                  orbit and AD baseline wealth origin. The shift from Self-Made
                  to Mixed is nearly 1:1.{" "}
                  <Link href="/data/wealth-origin" className="underline underline-offset-2" style={{ color: "#B87333" }}>
                    View source data&nbsp;&rarr;
                  </Link>
                </p>

                {/* ── Fig. 4: Forbes Heatmap (desktop, floated under Fig. 3) ── */}
                <div
                  className="mt-4 overflow-hidden border"
                  style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
                >
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
                    <p
                      className="text-[9px] font-bold uppercase tracking-[0.12em]"
                      style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
                    >
                      How Self-Made Are They?<br />
                      <span style={{ fontWeight: 400, color: "#666" }}>Forbes Score by Group &amp; Confidence</span>
                    </p>
                  </div>
                  <ForbesHeatmap />
                </div>
                <p className="n-caption">
                  Fig. 4 &mdash; Forbes Self-Made Score (1=inherited, 10=from poverty)
                  by group and confidence.{" "}
                  <Link href="/data/forbes-scores" className="underline underline-offset-2" style={{ color: "#B87333" }}>
                    View source data&nbsp;&rarr;
                  </Link>
                </p>
              </div>

              {/* Mobile-only charts (no float) */}
              <div className="mb-6 md:hidden">
                <div
                  className="overflow-hidden border"
                  style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
                >
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
                    <p
                      className="text-[9px] font-bold uppercase tracking-[0.12em]"
                      style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
                    >
                      How Are They Wealthy?<br />
                      <span style={{ fontWeight: 400, color: "#666" }}>Epstein Orbit Wealth Origin vs. AD Baseline</span>
                    </p>
                  </div>
                  <WealthOriginDelta />
                </div>
                <p className="n-caption">
                  Fig. 3 &mdash; Percentage-point difference between Epstein
                  orbit and AD baseline wealth origin.{" "}
                  <Link href="/data/wealth-origin" className="underline underline-offset-2" style={{ color: "#B87333" }}>
                    View source data&nbsp;&rarr;
                  </Link>
                </p>

                {/* Fig. 4 mobile */}
                <div
                  className="mt-4 overflow-hidden border"
                  style={{ backgroundColor: "#FAFAFA", borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}
                >
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid #000", backgroundColor: "#EDEDED" }}>
                    <p
                      className="text-[9px] font-bold uppercase tracking-[0.12em]"
                      style={{ fontFamily: "futura-pt, sans-serif", color: "#000" }}
                    >
                      How Self-Made Are They?<br />
                      <span style={{ fontWeight: 400, color: "#666" }}>Forbes Score by Group &amp; Confidence</span>
                    </p>
                  </div>
                  <ForbesHeatmap />
                </div>
                <p className="n-caption">
                  Fig. 4 &mdash; Forbes Self-Made Score (1=inherited, 10=from poverty)
                  by group and confidence.{" "}
                  <Link href="/data/forbes-scores" className="underline underline-offset-2" style={{ color: "#B87333" }}>
                    View source data&nbsp;&rarr;
                  </Link>
                </p>
              </div>

              <p>
                The category data tells us <em>what</em> these people do. The
                wealth origin data tells us <em>where they come from</em>&mdash;and
                the answer is not what you might expect. The Epstein orbit is not
                dominated by self-made disruptors or old-money dynasties. Its
                distinguishing feature is a category we label &ldquo;Mixed&rdquo;:
                people who inherited a platform&mdash;a family name, a business, a
                social network&mdash;and amplified it aggressively into something
                larger.
              </p>
              <p>
                Key examples: Donny Deutsch&mdash;inherited his dad&rsquo;s ad
                agency, grew it into a $265M sale. Steve Tisch&mdash;Loews
                fortune heir, Oscar-winning producer, Giants co-owner. Malcolm
                Forbes&mdash;inherited <em>Forbes</em> magazine, built it into
                an empire plus a flamboyant personal brand. William
                Koch&mdash;$470M Koch buyout, built Oxbow Group. Charles S.
                Cohen&mdash;inherited a real estate firm, expanded into film
                distribution. Nat Rothschild&mdash;banking dynasty heir,
                co-founded his own hedge fund. DVF&mdash;married a prince for
                the title, built a fashion empire, married a media billionaire.
                Lynn Forester de Rothschild&mdash;built a telecom career,
                married into the Rothschild dynasty.
              </p>
              <p>
                These are operators. Not pure old money (quietly managing
                trusts), not pure self-made (starting from nothing).
                They&rsquo;re people who leveraged inherited advantages into
                something bigger&mdash;exactly the personality type that would
                need their home to perform for a diverse audience.
              </p>
              <p>
                At 25.9% of the Epstein orbit versus 13.3% of the AD baseline,
                Mixed is nearly twice as prevalent among confirmed connections.
                Self-Made, meanwhile, <em>drops</em> 13.5 percentage points. The
                displacement is almost exactly 1:1: what the orbit loses in
                bootstrapped entrepreneurs, it gains in inherited-platform
                operators. Old Money and Married Into barely move.
              </p>
              <p>
                The pattern maps directly onto the status signaling taxonomy
                proposed by Han, Nunes &amp; Dr&egrave;ze (2010). Their
                &ldquo;Parvenu&rdquo; quadrant&mdash;high wealth, high need for
                status&mdash;describes exactly the profile we see: people with
                real resources who nonetheless need their consumption to be
                legible, who deploy the Old Master, the name-brand architect, and
                the AD feature itself as instruments of social positioning. The AD
                baseline, by contrast, skews Patrician: quiet wealth that
                doesn&rsquo;t need to broadcast. The home of a Patrician signals
                to peers. The home of a Parvenu signals to <em>targets</em>.
              </p>
              <p>
                This distinction matters because it connects the &ldquo;who&rdquo;
                of Section 1 to the &ldquo;how&rdquo; of Section 2. If
                Epstein&rsquo;s orbit over-indexes on people whose social
                position depends on visible consumption, we should expect their
                homes to look different&mdash;more theatrical, more curated, more
                formally staged. That is precisely what the aesthetic data shows.
              </p>
            </div>
            <div style={{ clear: "both" }} />

            {/* ── Epstein as Parvenu Archetype ── */}
            <h3
              className="mt-12 text-[20px] font-bold"
              style={{ fontFamily: "var(--font-lora), serif", color: "#000" }}
            >
              Epstein as Parvenu Archetype
            </h3>
            <hr className="n-rule" />

            <div className="n-body mt-4">
              <p>
                The documentary record is unambiguous. Epstein was a
                working-class kid from Coney Island&mdash;son of a Parks
                Department groundskeeper and a homemaker, grandson of Jewish
                immigrants. A college dropout who talked his way into Bear
                Stearns through a parent-teacher conference. <em>The New York
                Times</em> called him &ldquo;one of the most disturbingly
                skilled social climbers of this century.&rdquo; His
                fortune&mdash;ultimately ~$600M&mdash;was built almost entirely
                from fees paid by two billionaire clients (Les Wexner and Leon
                Black), plus a Virgin Islands tax shelter. He was not old money.
                He was not generational wealth. He was a first-generation
                financial services operator who manufactured a social position
                through name-dropping, favor-trading, and access-brokering.
              </p>
              <p>
                <em>Vanity Fair</em>&rsquo;s analysis of Epstein&rsquo;s
                address book found it contained &ldquo;locations renowned for
                catering exclusively to a wealthy elite intent on being seen in
                high society&rdquo;&mdash;Four Seasons, Mr. Chow&rsquo;s, The
                Mark, the Corviglia Ski Club. The emphasis is on <em>being
                seen</em>. The article&rsquo;s most telling detail: among the
                rare antiques and museum-grade art in his estate, investigators
                photographed a shower shelf holding both Fr&eacute;d&eacute;ric
                Fekkai luxury haircare and a bottle of Head &amp; Shoulders.
                The parvenu performance cracked at the margins.
              </p>
              <p>
                The Patriotic Millionaires analysis concluded that
                Epstein&rsquo;s &ldquo;genius&rdquo; was in &ldquo;recognizing
                how to capitalize on the ways that the ultra-rich help each
                other maintain and grow their fortunes and insulate themselves
                from negative consequences.&rdquo; His network consisted of
                people who needed access&mdash;to other wealthy people, to
                institutions, to introductions&mdash;which is definitionally a
                network of social climbers, not patricians. Patricians already
                have access by birthright.
              </p>

              <h4
                className="mt-8 text-[16px] font-bold"
                style={{ fontFamily: "var(--font-lora), serif", color: "#000" }}
              >
                Han et al.: Key Findings
              </h4>
              <p>
                Parvenus &ldquo;crave status&rdquo; even though they can afford
                quieter goods. They use loud signals to dissociate from
                have-nots. They are &ldquo;unlikely to recognize the subtle
                details of a Herm&egrave;s bag or Vacheron Constantin
                watch&rdquo;&mdash;they lack the cultural capital to read quiet
                signals. Patricians, by contrast, pay a premium for subtly
                branded products only other patricians recognize. This maps to
                the AD baseline: high Material Warmth (tactile, legible to
                touch), low Theatricality (not performing for outsiders). The
                parvenu home should score higher on the Stage dimensions because
                parvenus need their status signals to be &ldquo;easily
                decipherable, even to the uninitiated.&rdquo; That&rsquo;s
                Theatricality. That&rsquo;s Formality. That&rsquo;s the Old
                Master above the mantel where you can&rsquo;t miss it.
              </p>

              <h4
                className="mt-8 text-[16px] font-bold"
                style={{ fontFamily: "var(--font-lora), serif", color: "#000" }}
              >
                Costa &amp; Belk (1990): How the Nouveau Riche Learn Taste
              </h4>
              <p>
                This foundational ethnographic study&mdash;&ldquo;Nouveaux
                Riches as Quintessential Americans&rdquo;&mdash;found that
                newly wealthy Americans learn their consumption culture from
                magazines. Specifically: &ldquo;It is apparent that such
                magazines provide lessons in how to decorate, dress, drink,
                eat, travel.&rdquo; The nouveau riche use publications
                like <em>Town &amp; Country</em> and <em>Travel +
                Leisure</em> as instruction manuals for performing a class
                identity they didn&rsquo;t grow up with. AD is the interior
                design equivalent. This finding directly supports the claim
                that AD&rsquo;s pipeline has particular power over people who
                need to learn taste rather than those who absorbed it through
                habitus.
              </p>

              <h4
                className="mt-8 text-[16px] font-bold"
                style={{ fontFamily: "var(--font-lora), serif", color: "#000" }}
              >
                Currid-Halkett (2017): The Aspirational Class
              </h4>
              <p>
                Currid-Halkett&rsquo;s <em>The Sum of Small Things</em> argues
                that the modern elite signals status through inconspicuous
                consumption&mdash;organic food, curated experiences, elite
                education&mdash;rather than visible luxury goods. The AD
                baseline (low Theatricality, low Formality, high Curation)
                conforms to this aspirational-class pattern. If
                Epstein-connected homes diverge upward on Theatricality and
                Formality, they&rsquo;re diverging away from the
                aspirational-class norm and toward the parvenu/nouveau riche
                pattern. This is the theoretical contrast: the AD baseline is
                Currid-Halkett&rsquo;s aspirational class; the Epstein
                divergence is Veblen&rsquo;s conspicuous consumption.
              </p>

              <h4
                className="mt-8 text-[16px] font-bold"
                style={{ fontFamily: "var(--font-lora), serif", color: "#000" }}
              >
                Bourdieu: The Cultural Capital Deficit
              </h4>
              <p>
                Bourdieu&rsquo;s framework explains why the Epstein network
                homes would look different. Embodied cultural
                capital&mdash;the internalized dispositions, tastes, and
                aesthetic sensibilities acquired through upbringing&mdash;cannot
                be purchased. It takes generational immersion. People with high
                economic capital but low cultural capital
                (Bourdieu&rsquo;s &ldquo;industrial and commercial
                elite&rdquo;) compensate with objectified cultural
                capital&mdash;buying art, commissioning famous architects,
                hiring prestigious designers&mdash;but their choices betray the
                deficit. They over-signal. They curate too deliberately. They
                perform too hard. The Anna Sorokin/Delvey case is the extreme
                version: &ldquo;By mimicking the behaviours, speech, and tastes
                of the wealthy, she was able to convince people she
                belonged.&rdquo; The Epstein network is the subtler
                version&mdash;they had real money, but they were performing
                patrician rather than being patrician.
              </p>
            </div>
          </div>

          {/* ── Sidenotes — right margin (2 cols) ── */}
          <div
            className="s-note-margin hidden md:block"
            style={{ zIndex: 10, borderLeft: "none", paddingLeft: 0 }}
          >
            {/* ── Han et al. Taxonomy ── */}
            <div style={{ borderLeft: "2px solid rgba(192, 57, 43, 0.9)", paddingLeft: "1rem" }}>
            <p className="s-note-title">Status Signaling Taxonomy</p>
            <p className="s-note-body" style={{ marginTop: "0.25rem" }}>
              Han, Nunes &amp; Dr&egrave;ze (2010) classify consumers by wealth
              and need for status. The Epstein orbit maps
              to <strong>Parvenu</strong>; the AD baseline
              to <strong>Patrician</strong>.
            </p>
            <table
              className="mt-2 w-full border-collapse text-[10px]"
              style={{ fontFamily: "var(--font-jetbrains-mono), monospace", color: "#666" }}
            >
              <thead>
                <tr>
                  {["Type", "Wealth", "Need for Status"].map((h, i) => (
                    <th
                      key={h}
                      className="border-b px-2 py-1.5 text-left text-[8px] font-bold uppercase tracking-[0.1em]"
                      style={{
                        borderColor: "rgba(192, 57, 43, 0.2)",
                        color: "#999",
                        borderRight: i < 2 ? "1px solid rgba(192, 57, 43, 0.2)" : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  ["Patrician", "High", "Low"],
                  ["Parvenu", "High", "High"],
                  ["Poseur", "Low", "High"],
                  ["Proletarian", "Low", "Low"],
                ] as const).map((row, ri, arr) => (
                  <tr key={row[0]}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-2 py-1"
                        style={{
                          borderBottom: ri < arr.length - 1 ? "1px solid rgba(192, 57, 43, 0.2)" : undefined,
                          borderRight: ci < 2 ? "1px solid rgba(192, 57, 43, 0.2)" : undefined,
                          fontWeight: ci === 0 ? 700 : 400,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <a
              href="https://doi.org/10.1509/jmkg.74.4.15"
              target="_blank"
              rel="noopener noreferrer"
              className="s-note-link"
              style={{ color: "rgba(192, 57, 43, 0.7)" }}
            >
              Han, Nunes &amp; Dr&egrave;ze (2010) &rarr;
            </a>
            </div>

            <div style={{ height: "2rem" }} />

            {/* ── Forbes Self-Made Score ── */}
            <div style={{ borderLeft: "2px solid rgba(192, 57, 43, 0.9)", paddingLeft: "1rem" }}>
            <p className="s-note-title">Forbes Self-Made Score</p>
            <p className="s-note-body" style={{ marginTop: "0.25rem" }}>
              A 1&ndash;10 scale created by <em>Forbes</em> magazine to
              classify billionaires by how much of their wealth was inherited
              versus earned. Introduced because net worth alone obscures a
              critical distinction: a person worth $2&nbsp;billion who built it
              from nothing is fundamentally different from one who inherited it.
              The scale runs from 1 (inherited fortune, passively held) to
              10 (self-made from poverty).
            </p>
            <table
              className="mt-2 w-full border-collapse text-[10px]"
              style={{ fontFamily: "var(--font-jetbrains-mono), monospace", color: "#666" }}
            >
              <thead>
                <tr>
                  {["Score", "Origin"].map((h, i) => (
                    <th
                      key={h}
                      className="border-b px-2 py-1.5 text-left text-[8px] font-bold uppercase tracking-[0.1em]"
                      style={{
                        borderColor: "rgba(192, 57, 43, 0.2)",
                        color: "#999",
                        borderRight: i < 1 ? "1px solid rgba(192, 57, 43, 0.2)" : undefined,
                        width: i === 0 ? "36px" : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["1", "Inherited, passive"],
                  ["2", "Inherited, steward"],
                  ["3", "Inherited, grew it"],
                  ["4", "Inherited, grew it big"],
                  ["5", "Small inheritance \u2192 fortune"],
                  ["6", "Self-made, upper-class start"],
                  ["7", "Self-made, upper-middle"],
                  ["8", "Self-made, middle-class"],
                  ["9", "Self-made, working-class"],
                  ["10", "Self-made, from poverty"],
                ].map((row, ri, arr) => (
                  <tr key={row[0]}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-2 py-1"
                        style={{
                          borderBottom: ri < arr.length - 1 ? "1px solid rgba(192, 57, 43, 0.2)" : undefined,
                          borderRight: ci < 1 ? "1px solid rgba(192, 57, 43, 0.2)" : undefined,
                          fontWeight: ci === 0 ? 700 : 400,
                          color: ri <= 4 ? "#C0392B" : "#666",
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <a
              href="https://www.forbes.com/sites/gigizamora/2024/10/01/the-2024-forbes-400-self-made-billionaire-score-from-bootstrappers-to-silver-spooners/"
              target="_blank"
              rel="noopener noreferrer"
              className="s-note-link"
              style={{ color: "rgba(192, 57, 43, 0.7)" }}
            >
              Forbes 400 (2024) &rarr;
            </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
