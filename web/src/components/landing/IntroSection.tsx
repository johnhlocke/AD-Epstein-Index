"use client";

import { useEffect, useRef } from "react";

// ── Sidenote components (same pattern as MethodologySection) ─────────────────

const MARGIN_STYLE = { borderLeft: "2px solid rgba(184, 115, 51, 0.9)", zIndex: 10 } as const;

function SidenoteBlock({
  children,
  note,
  notes,
  noteOffset,
  className = "",
}: {
  children: React.ReactNode;
  /** Single sidenote (rendered as one margin block) */
  note?: React.ReactNode;
  /** Multiple independent sidenotes (each gets its own margin block the hook can separate) */
  notes?: React.ReactNode[];
  /** Pixel offset to nudge the first sidenote up (negative) or down (positive) */
  noteOffset?: number;
  className?: string;
}) {
  return (
    <div className={`s-note-row ${className}`}>
      <div style={{ maxWidth: "var(--content-narrow)" }}>{children}</div>
      {/* Single note */}
      {note && (
        <div
          className="s-note-margin hidden md:block"
          style={MARGIN_STYLE}
          data-note-offset={noteOffset ?? 0}
        >
          {note}
        </div>
      )}
      {/* Multiple independent notes — each its own margin block */}
      {notes?.map((n, i) => (
        <div
          key={i}
          className="s-note-margin hidden md:block"
          style={MARGIN_STYLE}
          data-note-offset={i === 0 ? (noteOffset ?? 0) : 0}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

function Sidenote({
  num,
  title,
  children,
  href,
  linkText,
  image,
  imageAlt,
}: {
  num?: number;
  title: string;
  children: React.ReactNode;
  href?: string;
  linkText?: string;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt={imageAlt || ""} className="s-note-img" />}
      <p className="s-note-title" style={{ color: "#1A1A1A" }}>
        {num != null && <span className="s-note-num" style={{ textTransform: "none" }}>i{num}.&nbsp;</span>}
        {title}
      </p>
      <div className="s-note-body">{children}</div>
      {href && linkText && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="s-note-link"
          style={{ color: "rgba(184, 115, 51, 0.7)" }}
        >
          {linkText} &rarr;
        </a>
      )}
    </>
  );
}

function NoteArrow({ num }: { num?: number }) {
  return (
    <span className="s-note-arrow hidden md:inline" style={{ color: "rgba(184, 115, 51, 0.9)" }}>
      {" "}&#9656;{num != null && <sup className="s-note-num-inline">i{num}</sup>}
    </span>
  );
}

// ── Overlap prevention hook ─────────────────────────────────────────────────

function usePreventSidenoteOverlap(
  ref: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const layout = () => {
      const sectionRect = el.getBoundingClientRect();
      const rows = Array.from(
        el.querySelectorAll<HTMLElement>(".s-note-row"),
      );

      // ── Phase 1: Reset all notes + section padding, then measure ──
      el.style.paddingBottom = "";
      const allMargins = Array.from(
        el.querySelectorAll<HTMLElement>(".s-note-margin"),
      );
      for (const m of allMargins) {
        m.style.top = "0px";
        m.style.transform = "";
      }

      // Force reflow so measurements are clean
      el.offsetHeight; // eslint-disable-line no-unused-expressions

      // ── Phase 2: Collect ideal Y + height for each note ──
      const entries: {
        margin: HTMLElement;
        idealY: number;
        height: number;
        rowTop: number;
      }[] = [];

      for (const row of rows) {
        const arrows = Array.from(row.querySelectorAll<HTMLElement>(".s-note-arrow"));
        const margins = Array.from(row.querySelectorAll<HTMLElement>(".s-note-margin"));
        if (margins.length === 0) continue;

        const rowTop = row.getBoundingClientRect().top - sectionRect.top;

        for (let i = 0; i < margins.length; i++) {
          const margin = margins[i];
          const height = margin.getBoundingClientRect().height;
          if (height === 0) continue; // hidden (mobile)

          const offset = Number(margin.dataset.noteOffset) || 0;
          const arrow = arrows[i] || null;
          let idealY: number;
          if (arrow) {
            idealY = arrow.getBoundingClientRect().top - sectionRect.top + offset;
          } else {
            idealY = rowTop + offset;
          }
          entries.push({ margin, idealY, height, rowTop });
        }
      }

      // ── Phase 3: Resolve positions with minimum gap (pure math, no DOM reads) ──
      const GAP = 20;
      const positions: { margin: HTMLElement; top: number }[] = [];
      let nextAllowedY = -Infinity;

      for (const { margin, idealY, height, rowTop } of entries) {
        const y = Math.max(idealY, nextAllowedY);
        positions.push({ margin, top: y - rowTop });
        nextAllowedY = y + height + GAP;
      }

      // ── Phase 4: Apply all positions in one batch (write-only) ──
      for (const { margin, top } of positions) {
        margin.style.top = `${top}px`;
      }

      // ── Phase 5: Extend section if last sidenote overflows past content ──
      // Re-measure after positions applied (padding was reset in Phase 1)
      if (positions.length > 0) {
        const freshSectionRect = el.getBoundingClientRect();
        const contentBottom = freshSectionRect.bottom; // bottom of section without extra padding
        let maxNoteBottom = 0;
        for (const { margin } of positions) {
          const r = margin.getBoundingClientRect();
          if (r.bottom > maxNoteBottom) maxNoteBottom = r.bottom;
        }
        const overflow = maxNoteBottom - contentBottom + 40; // 40px breathing room
        el.style.paddingBottom = overflow > 0 ? `${overflow}px` : "";
      }
    };

    // Run layout after fonts/images are ready, plus a fallback at 500ms
    requestAnimationFrame(() => requestAnimationFrame(layout));
    const fallback = setTimeout(layout, 500);

    // Re-run when any sidenote image loads (affects note height)
    const imgs = Array.from(el.querySelectorAll<HTMLImageElement>(".s-note-margin img"));
    for (const img of imgs) {
      if (img.complete) continue;
      img.addEventListener("load", layout);
    }

    // Also re-run on window load (catches late-loading webfonts)
    window.addEventListener("load", layout);
    window.addEventListener("resize", layout);
    return () => {
      clearTimeout(fallback);
      window.removeEventListener("load", layout);
      window.removeEventListener("resize", layout);
      for (const img of imgs) img.removeEventListener("load", layout);
    };
  }, [ref]);
}

// ── Main component ──────────────────────────────────────────────────────────

interface IntroSectionProps {
  stats: {
    features: { uniqueHomeowners: number };
    dossiers: { confirmed: number };
  };
}

export function IntroSection({ stats }: IntroSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  usePreventSidenoteOverlap(sectionRef);

  return (
    <div ref={sectionRef} className="text-[16px] font-medium leading-[1.65] text-[#333]" style={{ fontFamily: "'Lora', serif" }}>
      {/* ── Paragraph 1 ── */}
      <SidenoteBlock
        note={
          <Sidenote
            num={1}
            title="AD's Self-Image"
            href="https://www.architecturaldigest.com/about/about-ad"
            linkText="AD &mdash; About"
          >
            That is their official tagline.
          </Sidenote>
        }
      >
        <p className="mb-5">
          <em>Architectural Digest</em> (AD) is a leading arbiter of taste in interior
          design today. As the self-described &ldquo;international authority on
          design and architecture,&rdquo;
          <NoteArrow num={1} /> the magazine has been welcomed into the private homes of
          those in the most rarefied strata of wealth and power. This list has
          included: Kings, Presidents, Princes and Lords; Pulitzer Prize winners
          and blue-chip artists; media and entertainment moguls; fashion and
          luxury empire founders; real estate and finance CEOs; celebrity
          designers and actual A-list celebrities.
        </p>
      </SidenoteBlock>

      {/* ── Paragraph 2 ── */}
      <SidenoteBlock
        noteOffset={-160}
        note={
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sidenotes/veblen-conspicuous.jpg"
              alt="Gilded Age conspicuous consumption — couple at a society event, c. 1910"
              className="s-note-img"
              style={{ maxHeight: "none", objectFit: "contain" }}
            />
            <Sidenote
              num={2}
              title="Conspicuous Consumption"
              href="https://www.gutenberg.org/ebooks/833"
              linkText="Veblen (1899) &mdash; Project Gutenberg"
            >
            Thorstein Veblen&rsquo;s foundational concept: wealth doesn&rsquo;t
            count unless other people can see it. The home is the primary
            theater. Furniture, art, and architecture are evidence that you can
            afford not to work.
          </Sidenote>
          </>
        }
      >
        <p className="mb-5">
          By featuring these homeowners in glossy magazine spreads, the
          publication in turn bestows upon them a certain cachet. They are
          legitimized as sitting at the intersection of culturally visible wealth
          and tastemaking. They are the wealthy who collect art, build
          foundations, sit on museum boards, host Met Galas, and commission named
          architects. Their homes are meant to be seen. Their wealth performs
          through design. This has been true since Veblen coined the term
          &ldquo;<em>conspicuous consumption</em>&rdquo; in 1899.
          <NoteArrow num={2} /> For the home to serve as the primary theater of
          performative status, expenditure must be made prominent and visible to
          achieve its social purpose.
        </p>
      </SidenoteBlock>

      {/* ── Paragraph 3 ── */}
      <SidenoteBlock
        notes={[
          <Sidenote
            key="cultural-intermediaries"
            num={3}
            title="Cultural Intermediaries"
            href="https://www.hup.harvard.edu/books/9780674212770"
            linkText="Bourdieu (1984) &mdash; Harvard UP"
          >
            Bourdieu&rsquo;s term for institutions that sit between producers
            and consumers of culture. Magazine editors, gallery curators, design
            critics&mdash;they don&rsquo;t just report taste, they shape it.
            Their &ldquo;gentle manipulation&rdquo; converts subjective
            editorial preferences into seemingly objective cultural standards.
          </Sidenote>,
          <Sidenote
            key="taste-regimes"
            num={4}
            title="Taste Regimes"
            href="https://doi.org/10.1086/666595"
            linkText="Arsel & Bean (2013) &mdash; JCR"
          >
            Taste isn&rsquo;t purely individual&mdash;it&rsquo;s structured by
            market actors who define what &ldquo;good taste&rdquo; looks like
            and enforce it through editorial selection, retail curation, and
            social validation.
          </Sidenote>,
        ]}
      >
        <p className="mb-5">
          In sociological terms, AD functions as what Bourdieu (1984) called a
          <em>cultural intermediary</em>&mdash;an institution that mediates between the
          cultural production of the elite and the consumption aspirations of the
          professional managerial class.
          <NoteArrow num={3} /> To Bourdieu, these intermediaries were responsible for
          the subtle &ldquo;gentle manipulation&rdquo; of taste. They telegraph
          their own aesthetic judgments outward, and in the process transform
          them into seemingly immutable natural laws.
          This is AD&rsquo;s editorial staff. They select which homes are worthy
          of documentation and in the process define which combinations of
          materials, furnishings, and textures constitute the canon of
          aspirational design, and present those choices to a readership
          predisposed to accept that judgment as authoritative.
          <NoteArrow num={4} />
        </p>
      </SidenoteBlock>

      {/* ── Paragraph 4 — Habitus ── */}
      <SidenoteBlock
        note={
          <Sidenote num={5} title="Habitus">
            Bourdieu&rsquo;s concept: the unconscious dispositions that class
            position instills over a lifetime. Not what you choose to like, but
            what you&rsquo;re trained to recognize as valuable. It explains why
            people in the same social stratum independently converge on the same
            aesthetic preferences. (<em>Distinction</em>, 1984, pp. 170&ndash;175)
          </Sidenote>
        }
      >
        <p className="mb-5">
          The Department of Justice released more than three million files
          related to the investigation into deceased sex offender Jeffrey Epstein
          on January 30, 2026. Those publicly available documents included
          financial and property records, legal proceedings, and extensive social
          and logistic infrastructure. That social correspondence describes a
          very specific ecosystem: people who live on the Upper East Side,
          weekend in the Hamptons, winter in Palm Beach, keep a place in London.
          They sit on museum boards, teach at elite schools, attend the same
          galas, and hire the same architects and interior designers.
          They&rsquo;re rich, but they&rsquo;re <em>connected</em> rich.
        </p>
      </SidenoteBlock>

      {/* ── Paragraph 5 ── */}
      <SidenoteBlock
        note={
          <Sidenote
            num={6}
            title="Social Media Amplification"
            href="https://doi.org/10.1108/JRIM-09-2019-0145"
            linkText="Izogo & Mpinganjira (2020) &mdash; JRIM"
          >
            What magazines once disseminated over months, Instagram and TikTok
            distribute in hours. The &ldquo;Pinterest effect&rdquo; compressed
            the trickle-down cycle from years to weeks.
          </Sidenote>
        }
      >
        <p className="mb-5">
          This overlap between AD&rsquo;s editorial territory and
          Epstein&rsquo;s social network is not incidental. Both
          institutions&mdash;one cultural, one criminal&mdash;operate within the
          narrowest sliver of American wealth. What Bourdieu (1984) termed{" "}
          <em>habitus</em><NoteArrow num={5} />&mdash;the durable, transposable dispositions that
          class position produces&mdash;generates predictable patterns of taste
          and affiliation.
          <NoteArrow num={6} /> AD&rsquo;s editorial staff and Epstein&rsquo;s social
          network draw from the same habitus. AD didn&rsquo;t set out to
          document Epstein&rsquo;s social circle. It set out to document the
          most celebrated homes in the world. Class habitus dictates
          this as a foregone conclusion, not a conspiracy. The overlap was inevitable.
        </p>
      </SidenoteBlock>

      {/* ── Diagram 1: Venn Overlap ── */}
      <div
        className="float-left mb-4 mr-6 hidden md:block"
        style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
      >
        <svg
          viewBox="0 0 280 200"
          className="w-full"
          role="img"
          aria-label={`Venn diagram: ${stats.dossiers.confirmed} confirmed connections between AD homeowners and Epstein's social network`}
        >
          <title>Overlap between AD homeowners and Epstein&apos;s social network</title>
          <defs>
            {/* Halftone dot pattern — AD */}
            <pattern id="intro-dots" x="0" y="0" width="3.5" height="3.5" patternUnits="userSpaceOnUse">
              <circle cx="1.75" cy="1.75" r="0.8" fill="#333" fillOpacity={0.4} />
            </pattern>
            {/* Diagonal line hatching — Epstein */}
            <pattern id="intro-lines" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="3" stroke="#333" strokeWidth={0.7} strokeOpacity={0.55} />
            </pattern>
            {/* Clip paths for each circle */}
            <clipPath id="intro-clip-ad"><circle cx="108" cy="94" r="62" /></clipPath>
            <clipPath id="intro-clip-ep"><circle cx="172" cy="94" r="62" /></clipPath>
          </defs>

          {/* Title */}
          <text x="140" y="16" textAnchor="middle" style={{ fontSize: 9, fontFamily: "futura-pt, sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const }} fill="#999">The Narrowest Sliver</text>

          {/* AD circle — dots */}
          <rect x="0" y="0" width="280" height="200" fill="url(#intro-dots)" clipPath="url(#intro-clip-ad)" />

          {/* Epstein circle — diagonal lines */}
          <rect x="0" y="0" width="280" height="200" fill="url(#intro-lines)" clipPath="url(#intro-clip-ep)" />

          {/* Overlap count */}
          <text x="140" y="91" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 32, fontFamily: "'DM Mono', monospace", fontWeight: 600 }} fill="#333">
            {stats.dossiers.confirmed}
          </text>

          {/* AD label — below left */}
          <text x="68" y="172" textAnchor="middle" style={{ fontSize: 8.5, fontFamily: "futura-pt, sans-serif", fontWeight: 600, letterSpacing: "0.08em" }} fill="#555">AD HOMEOWNERS</text>
          <text x="68" y="186" textAnchor="middle" style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 600 }} fill="#555">
            {stats.features.uniqueHomeowners.toLocaleString()}
          </text>

          {/* Epstein label — below right */}
          <text x="212" y="172" textAnchor="middle" style={{ fontSize: 8.5, fontFamily: "futura-pt, sans-serif", fontWeight: 600, letterSpacing: "0.08em" }} fill="#555">EPSTEIN NETWORK</text>
        </svg>
        <p className="mt-1 text-[11px] italic text-[#aaa]" style={{ fontFamily: "'Lora', serif" }}>
          Fig. i &mdash; Both institutions draw from the same narrow pool of
          dominant-class habitus.
        </p>
      </div>

      {/* ── Paragraph 6 — Trickle-Down Fashion ── */}
      <SidenoteBlock
        note={
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sidenotes/simmel-trickle-down.jpg"
              alt="Trickle-down fashion: Saint Laurent A/W 2013 runway dress replicated by Primark and Zara"
              className="s-note-img"
            />
            <Sidenote
              num={7}
              title="Trickle-Down Fashion"
              href="https://doi.org/10.1086/222102"
              linkText="Simmel (1904) &mdash; AJS"
            >
              Georg Simmel, 1904: elites adopt a style to signal distinction
              &rarr; the middle class imitates &rarr; the style loses its
              signaling power &rarr; elites move on. Over a century later, still
              the dominant framework for how aesthetics cascade through social
              strata.
            </Sidenote>
          </>
        }
      >
        <p className="mb-5">
          Downstream, that editorially curated vision of &ldquo;taste&rdquo;
          becomes amplified and accelerated through social media virality.
          <NoteArrow num={7} /> Interior decoration follows the same cascading pattern Simmel (1904)
          ascribed to fashion trends: elites adopt a style to differentiate; the
          middle class imitates; elites abandon it and move on.
          <NoteArrow /> McCracken&rsquo;s <em>meaning transfer</em> model (1986) describes how cultural
          meaning moves first from the culturally constituted world to consumer
          goods (via media like AD) and then from goods to individual consumers
          through rituals of acquisition and display.
          <NoteArrow num={8} /> When a celebrity opens their home for an AD feature,
          meaning transfers from their cultural identity to the objects within
          it. Then, when a consumer purchases that object, meaning transfers
          again from the product to the consumer&rsquo;s own sense of self.
          &ldquo;I am Zooey Deschanel&rsquo;s $5,000 Palmette Cloche
          Lantern.&rdquo;
          <NoteArrow num={9} />
        </p>
      </SidenoteBlock>

      {/* ── Paragraph 7 — Lantern + Meaning Transfer ── */}
      <SidenoteBlock
        noteOffset={-200}
        notes={[
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key="lantern-img"
              src="/sidenotes/palmette-lantern.jpg"
              alt="Regency Palmette Cloche Lantern — $4,880 on 1stDibs"
              className="s-note-img"
              style={{ maxHeight: "none", objectFit: "contain" }}
            />
            <Sidenote
              key="lantern"
              num={9}
              title="The $5,000 Lantern"
              href="https://www.architecturaldigest.com/shopping/zooey-deschanel-and-jonathan-scott-open-door"
              linkText="AD &mdash; Open Door"
            >
              From AD&rsquo;s &ldquo;Open Door&rdquo; series. Every item in the
              video is shoppable. The pipeline from celebrity home &rarr; editorial
              content &rarr; consumer purchase is now a single click.
            </Sidenote>
          </>,
          <Sidenote
            key="meaning-transfer"
            num={8}
            title="Meaning Transfer"
            href="https://doi.org/10.1086/209048"
            linkText="McCracken (1986, 1989) &mdash; JCR"
          >
            Grant McCracken&rsquo;s two-step model: cultural meaning first moves
            from the world to consumer goods (through media like AD), then from
            goods to individuals through rituals of possession and display. The
            celebrity endorsement is the mechanism that accelerates the first
            transfer.
          </Sidenote>,
        ]}
      >
        <p className="mb-5">
          Retailers operationalize those demand signals through shoppable
          content, brand-celebrity collaborations, and look-alike ecosystems
          across price spectrums.
          <NoteArrow num={10} /> Celebrities leverage their own AD home tour to sell featured
          items&mdash;from an $8,000 chandelier through a specialty retailer to
          mid-market, mass-retail kitchen appliances.
          <NoteArrow num={11} /> Bertrand and Morse (2016) provide the economic evidence for this
          cascade: non-rich households allocate demonstrably larger budget shares
          to &ldquo;visible goods&rdquo;&mdash;a category in which Heffetz
          (2011) ranks furniture and household items among the most visible
          consumption categories, more visible even than housing
          itself&mdash;when exposed to higher top-income consumption levels in
          their area.
          <NoteArrow num={12} /> That interior aesthetic AD highlights in a Fifth Avenue
          penthouse eventually finds its way to your local West Elm.
        </p>
      </SidenoteBlock>

      {/* Clear float from diagram 1 */}
      <div style={{ clear: "both" }} />

      {/* ── Floated Diagram 2: Meaning Transfer Pipeline (placed in flow before paragraph 8) ── */}
      <div
        className="float-left mb-4 mr-6 hidden md:block"
        style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
      >
        <div className="flex h-[200px] w-full items-center justify-center border border-dashed border-[#999] bg-[#F5F5F0]">
          <div className="text-center">
            <p
              className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#999]"
              style={{ fontFamily: "futura-pt, sans-serif" }}
            >
              Diagram Placeholder
            </p>
            <p className="mt-2 text-[14px] italic text-[#666]">
              Pipeline: Elite Home &rarr; AD Feature &rarr; Social Media &rarr;
              Mass Market
            </p>
            <p className="mt-1 text-[12px] text-[#999]">
              McCracken&rsquo;s meaning transfer cascade through the editorial
              pipeline
            </p>
          </div>
        </div>
        <p className="mt-2 text-[12px] italic text-[#999]">
          Fig. ii &mdash; How aesthetic meaning cascades from elite homes to your
          local West Elm.
        </p>
      </div>

      {/* ── Paragraph 8 — Trickle-Round + Shoppable Content ── */}
      <SidenoteBlock
        notes={[
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sidenotes/trickle-round-dupes.jpg"
              alt="Ligne Roset Togo original vs. dupe — the trickle-round in action"
              className="s-note-img"
            />
            <Sidenote
              num={10}
              title="Trickle-Round"
              href="https://doi.org/10.1093/jcr/ucz049"
              linkText="Bellezza & Berger (2020) &mdash; JCR"
            >
              Updating Simmel for the dupe economy: in a world of look-alikes,
              low-status and high-status signals mix freely. The trickle
              doesn&rsquo;t just go down anymore&mdash;it goes sideways and loops
              back. See also: Mehdi (2025) on consumer motivations behind dupe
              purchases.
            </Sidenote>
          </>,
          <Sidenote
            key="shoppable"
            num={11}
            title="Shoppable Content"
            href="https://digiday.com/media/how-publishers-pull-youtube-viewers-to-shop-on-their-sites-with-architectural-digests-amy-astley/"
            linkText="Digiday (Feb 2025)"
          >
            AD editor Amy Astley describes a YouTube-to-commerce pipeline
            designed to turn viewers into shoppers, citing a 4x revenue
            increase from &ldquo;shopping out&rdquo; the <em>Open Door</em> series
            on AD&rsquo;s site. The home tour video is the storefront. The
            editorial authority is the sales pitch.
          </Sidenote>,
        ]}
      >
        <p className="mb-5">
          Of the{" "}
          <span className="font-mono font-semibold">
            {stats.features.uniqueHomeowners.toLocaleString()}
          </span>{" "}
          uniquely named homeowners featured in <em>Architectural Digest</em> since
          1988,{" "}
          <span className="font-mono font-semibold">
            {stats.dossiers.confirmed.toLocaleString()}
          </span>{" "}
          are confirmed as being directly connected to Jeffrey
          Epstein&mdash;nearly{" "}
          <span className="font-mono font-semibold">
            {(
              (stats.dossiers.confirmed / stats.features.uniqueHomeowners) *
              100
            ).toFixed(1)}
            %
          </span>
          . The burden of a &ldquo;confirmed&rdquo; label doesn&rsquo;t rest on
          a simple name match, but requires semantic understanding of the context
          around the match. It is attending a dinner with Epstein, soliciting him
          for a meeting, or appearing on a guest list for an event at his
          residence. It can be a single dinner party where both parties were
          confirmed in attendance, or 15 years of sustained direct
          correspondence. Both classify as a connection. A confirmed connection
          means documented proximity&mdash;not guilt.
        </p>
      </SidenoteBlock>

      {/* Clear float from diagram 2 */}
      <div style={{ clear: "both" }} />

      {/* ── Paragraph 9 — Visible Goods ── */}
      <SidenoteBlock
        note={
          <Sidenote
            num={12}
            title="Visible Goods"
            href="https://doi.org/10.1162/REST_a_00613"
            linkText="Bertrand & Morse (2016) &mdash; RES"
          >
            Non-rich households spend more on &ldquo;visible goods&rdquo; when
            exposed to wealthy consumption levels nearby. Heffetz (2011) ranked
            furniture and household items among the most socially visible
            consumption categories&mdash;more visible even than housing itself.
            The interior is the signal.
          </Sidenote>
        }
      >
        <p>
          The question is not whether the overlap is statistically
          anomalous&mdash;institutions that select for dominant-class habitus
          will independently converge on the same limited population. The
          question is whether the connected homes share a distinguishable design
          profile. To test that, this project developed a scoring instrument.
        </p>
      </SidenoteBlock>
    </div>
  );
}
