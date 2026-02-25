import type { StatsResponse } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { IntroSection } from "@/components/landing/IntroSection";

interface HeroSectionProps {
  stats: StatsResponse;
  mosaic?: React.ReactNode;
}

/* ── NASA-style TOC components ── */

/* Shared 3-column grid: section title | dot leaders + sub labels | page number
 * First column matches 1/3 of the abstract's md:grid-cols-3 gap-6 layout
 * so sub-item text aligns with the abstract's second column left edge. */
/* First column = abstract col1 width + gap, so column 2 left edge
 * aligns exactly with the abstract's middle column left edge. */
const TOC_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "calc((100% - 48px) / 3 + 24px) 1fr auto",
  columnGap: 0,
  alignItems: "baseline",
};

function TocSection({
  num,
  title,
  href,
  children,
  firstSub,
  noBorder,
}: {
  num: string;
  title: string;
  href: string;
  children?: React.ReactNode;
  firstSub?: { label: string; num: string; href: string };
  noBorder?: boolean;
}) {
  return (
    <div className={`pt-4 pb-3 ${noBorder ? "" : "border-t border-black"}`}>
      {/* Major section row — title on left, first sub-item aligned on same baseline */}
      <div style={TOC_GRID_STYLE}>
        <a href={href} className="text-[19px] font-black transition-colors hover:text-[#B87333]" style={{ fontFamily: "futura-pt, sans-serif" }}>
          {num && <span className="mr-3 font-mono text-[14px]">{num}</span>}
          {title}
        </a>
        {firstSub ? (
          <a href={firstSub.href} className="flex items-end overflow-hidden text-[15px] font-medium text-[#333] transition-colors hover:text-[#B87333]">
            <span className="shrink-0">{firstSub.label}</span>
            <span className="ml-1 flex-1 overflow-hidden whitespace-nowrap leading-[1] text-black">
              {"· ".repeat(120)}
            </span>
          </a>
        ) : (
          <span />
        )}
        {firstSub ? (
          <a href={firstSub.href} className="font-mono text-[14px] font-bold transition-colors hover:text-[#B87333]">
            {firstSub.num}
          </a>
        ) : (
          <span />
        )}
      </div>
      {/* Remaining sub-items */}
      {children && <div>{children}</div>}
    </div>
  );
}

function TocSub({
  label,
  num,
  href,
}: {
  label: string;
  num: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="py-[2px] transition-colors hover:text-[#B87333]"
      style={TOC_GRID_STYLE}
    >
      {/* Empty first column — keeps sub-labels aligned to column 2 */}
      <span />
      <span className="flex items-end overflow-hidden text-[15px] font-medium text-[#333]">
        <span className="shrink-0">{label}</span>
        <span className="ml-1 flex-1 overflow-hidden whitespace-nowrap leading-[1] text-black">
          {"· ".repeat(120)}
        </span>
      </span>
      <span className="self-end font-mono text-[14px] font-bold">{num}</span>
    </a>
  );
}

/**
 * Hero section — "They Live" editorial layout.
 *
 * Futura PT Black headline, Playfair serif body, centered epigraph,
 * 6-column stats grid with copper anchor stat for confirmed connections.
 */
export function HeroSection({ stats, mosaic }: HeroSectionProps) {
  return (
    <section className="relative bg-background">
      <div
        className="mx-auto flex w-full flex-col"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
          paddingTop: "72px",
          paddingBottom: "96px",
        }}
      >
        {/* ── Epigraph ── */}
        <div className="mb-24 flex flex-col items-center text-center">
          <blockquote className="max-w-[520px] font-serif text-[14px] italic leading-[1.8] text-[#B7B7B7] md:text-[15px]">
            &ldquo;While civilization has been improving our houses, it has not
            equally improved the men who are to inhabit them. It has created
            palaces, but it was not so easy to create noblemen and
            kings.&rdquo;
          </blockquote>
          <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-[#999]">
            Henry David Thoreau
          </p>
        </div>

        {/* ── Headline + Subhead ── */}
        <div className="mb-10 text-center md:mb-12">
          <h1
            className="text-[48px] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-[64px] md:text-[80px] lg:text-[96px]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Where They Live
          </h1>
          <p
            className="mt-3 text-[22px] font-bold leading-[1.0] text-foreground md:mt-4 md:text-[28px]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Do Featured Homes in Architectural Digest Reveal an &ldquo;Epstein Aesthetic?&rdquo;
          </p>
        </div>

        {/* ── Scrolling Mosaic (between subhead and abstract) ── */}
        {mosaic && (
          <div className="-mx-[var(--grid-margin)] mt-10 mb-10" style={{ marginLeft: `calc(-1 * var(--grid-margin))`, marginRight: `calc(-1 * var(--grid-margin))` }}>
            {mosaic}
          </div>
        )}

        {/* ── Abstract ── */}
        <div className="mt-16 flex flex-col">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Abstract
          </p>

          <Separator className="mt-2" />

          <div className="mt-5 grid gap-6 md:grid-cols-3" style={{ fontFamily: "'Lora', serif" }}>
            <p className="text-[16px] font-medium leading-[1.65] text-[#333]">
              <span style={{ float: "left", fontFamily: "futura-pt, sans-serif", fontWeight: 900, fontSize: "5.5em", lineHeight: 0.8, marginRight: "0.08em", marginTop: "0.05em", color: "#1A1A1A" }}>T</span><strong>his project cross-references every homeowner featured in{" "}
              <em>Architectural Digest</em> (AD) between 1988 and 2025 against the
              Department of Justice&rsquo;s Epstein files.</strong> AD functions as
              what <em>Bourdieu (1984)</em> termed a &ldquo;cultural
              intermediary:&rdquo; an institution that mediates between elite
              taste production and the consumption aspirations of the
              professional managerial class. Through <em>Simmel&rsquo;s (1904)</em>{" "}
              trickle-down cascade and <em>McCracken&rsquo;s (1986)</em> meaning
              transfer model, the interior design aesthetics that AD chooses
              to celebrate propagate downstream through social media,
              shoppable content, and lower-cost, mass-market reproductions.
              They shape mainstream interior design norms&mdash;not just color
              palettes and furniture silhouettes, but the underlying grammar
              telling us what a successful home is supposed to look like and
              who it should impress. <em>Bertrand and Morse (2016)</em> provide
              economic evidence: non-rich households allocate a larger share
              of their budget to visible goods when exposed to wealthy
              consumption levels. But how is elite aesthetic consensus
              determined, and how susceptible is that process to contamination
              by criminal actors operating within the same social milieu?
            </p>
            <p className="text-[16px] font-medium leading-[1.65] text-[#333]">
              Using a vision-capable LLM calibrated through iterative dialogue
              with a licensed design architect (me),{" "}
              <span className="font-mono text-[14px] font-semibold">{stats.features.total.toLocaleString()}</span>{" "}
              home features were scored along nine aesthetic
              axes&mdash;Grandeur, Material Warmth, Maximalism,
              Historicism, Provenance, Hospitality, Formality, Curation,
              Theatricality&mdash;grouped
              into three categories: <span className="px-1" style={{ backgroundColor: "rgba(160, 120, 92, 0.15)" }}>Space</span>,{" "}
              <span className="px-1" style={{ backgroundColor: "rgba(133, 129, 69, 0.15)" }}>Story</span>, and{" "}
              <span className="px-1" style={{ backgroundColor: "rgba(149, 144, 168, 0.15)" }}>Stage</span>. Each answering: how does the room physically feel,
              what narrative does it carry, and who is it performing for. This
              scoring data confirmed an AD baseline aesthetic that largely
              conformed to <em>Han, Nunes, and Dr&egrave;ze&rsquo;s (2010)</em>
              &ldquo;patrician&rdquo; profile: materially warm, richly
              layered, designer-directed, and strikingly un-theatrical. These
              are homes whose strongest signal (<span className="font-mono text-[14px] font-semibold">Material Warmth: 4.12</span>)
              translates through surface-level aesthetics on a photographed
              magazine spread, while their quietest (<span className="font-mono text-[14px] font-semibold">Provenance: 3.34</span>) is only
              legible to class peers. Another unexpected finding that emerged
              from the scoring data is that six persistent interior design
              typologies remain stable across four decades of AD features.
              These distinct typologies span from warm minimalism to
              theatrical maximalism, cut across decades, designers, and
              geographies, suggesting that the AD curatorial eye pulls from a
              stable and remarkably narrow aesthetic vocabulary.
            </p>
            <p className="text-[16px] font-medium leading-[1.65] text-[#333]">
              Of{" "}
              <span className="font-mono text-[14px] font-semibold">{stats.features.uniqueHomeowners.toLocaleString()}</span>{" "}
              named homeowners,{" "}
              <span className="font-mono text-[14px] font-semibold">{stats.dossiers.confirmed.toLocaleString()}</span>{" "}
              are confirmed as directly connected to Epstein through verified
              contextual evidence in the DOJ records. These homes exhibit
              their own statistically distinguishable aesthetic profile,
              diverging from the AD baseline particularly along the Stage
              dimensions (Theatricality, Curation, Formality), the axes that
              measure how deliberately a space has been composed for an
              audience. Where the baseline home might whisper to peers,
              Epstein-orbit homes need to more explicitly shout at an
              audience. This network ran on access and impression. The homes
              were instruments of social power engineered to communicate class
              status through immediately legible signals: the{" "}
              <a href="/report/6130" className="underline underline-offset-4 transition-colors hover:text-[#B87333]">Old Master above the mantel</a>,
              the{" "}
              <a href="/report/6086" className="underline underline-offset-4 transition-colors hover:text-[#B87333]">museum-grade furniture</a>,
              the{" "}
              <a href="/report/4873" className="underline underline-offset-4 transition-colors hover:text-[#B87333]">rooms that announce themselves before anyone speaks</a>.
              This aesthetic signature entered the same editorial pipeline
              that defines mainstream taste. Every shoppable link, every
              &ldquo;get the look&rdquo; feature, every CB2 reproduction
              carries downstream an aesthetic vocabulary shaped in part by
              these homes.{" "}
              <strong>The cultural machine that converts elite aesthetics
              into middle-class aspirations has been, blindly, amplifying the
              interior design vernacular of a criminal social network.</strong>
            </p>
          </div>
        </div>

        {/* ── Contents ── */}
        <div className="mt-28 flex flex-col">
          <p
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            Contents
          </p>

          <div className="border border-black p-8 text-black" style={{ fontFamily: "'Lora', serif" }}>
            {/* ── How to Read ── */}
            <p className="mb-6 text-[13px] italic leading-[1.7] text-[#666]">
              <span className="underline">Sections 1&ndash;3:</span> presents the overall findings and conclusion.
              <br />
              <span className="underline">Sections 4&ndash;5:</span> detail the methodology and are available
              for further verification.
            </p>

            {/* ── Introduction ── */}
            <TocSection num="" title="Introduction" href="#introduction" noBorder firstSub={{ label: "Why this project?", num: "i", href: "#introduction" }} />

            {/* ── Finding 01: The Names ── */}
            <TocSection num="1" title="Finding 01: The Names" href="#key-finding" firstSub={{ label: "Who Are They?", num: "1.1", href: "#key-finding" }}>
              <TocSub label="What, When and Where Are They" num="1.2" href="#timeline" />
              <TocSub label="What a Confirmed Connection Looks Like" num="1.3" href="#dossier-example" />
            </TocSection>

            {/* ── Finding 02: The Aesthetic ── */}
            <TocSection num="2" title="Finding 02: The Aesthetic" href="#baseline" firstSub={{ label: "The AD Baseline Aesthetic", num: "2.1", href: "#baseline" }}>
              <TocSub label="Is There an Epstein Aesthetic?" num="2.2" href="#epstein-aesthetic" />
              <TocSub label="Why These Homes Perform" num="2.3" href="#aesthetic-analysis" />
              <TocSub label="Testing: 9 East 71st Street" num="2.4" href="#testing" />
            </TocSection>

            {/* ── Conclusion ── */}
            <TocSection num="3" title="Conclusion" href="#conclusion" firstSub={{ label: "What\u2019s Next", num: "3.1", href: "#whats-next" }} />

            {/* ── Methodology: Agent AI Pipeline ── */}
            <TocSection num="4" title="Methodology: Agent AI Pipeline" href="#agent-methodology" firstSub={{ label: "The Pipeline", num: "4.1", href: "#section-1" }}>
              <TocSub label="Multi-Agent System" num="4.2" href="#section-2" />
              <TocSub label="Personality as Architecture" num="4.3" href="#section-3" />
              <TocSub label="Investigation Methodology" num="4.4" href="#section-4" />
            </TocSection>

            {/* ── Methodology: Aesthetic Scoring ── */}
            <TocSection num="5" title="Methodology: Aesthetic Scoring" href="#aesthetic-methodology" firstSub={{ label: "The Instrument", num: "5.1", href: "#aesthetic-methodology" }}>
              <TocSub label="Scoring Methodology" num="5.2" href="#aesthetic-methodology" />
              <TocSub label="Scoring Reliability" num="5.3" href="#aesthetic-methodology" />
              <TocSub label="Human Validation" num="5.4" href="#aesthetic-methodology" />
              <TocSub label="Construct Validation" num="5.5" href="#aesthetic-methodology" />
              <TocSub label="The AD Baseline" num="5.6" href="#aesthetic-methodology" />
              <TocSub label="Comparative Analysis" num="5.7" href="#aesthetic-methodology" />
              <TocSub label="The Epstein Signature" num="5.8" href="#aesthetic-methodology" />
            </TocSection>

            {/* ── Appendix ── */}
            <TocSection num="6" title="Appendix" href="#appendix" firstSub={{ label: "Knowledge Graph Explorer", num: "6.1", href: "/explorer" }}>
              <TocSub label="Searchable Index" num="6.2" href="#index" />
              <TocSub label="Aesthetic Score Index" num="6.3" href="/aestheticscores" />
            </TocSection>
          </div>
        </div>

        {/* ── Intro Section ── */}
        <div id="introduction" className="mt-28 flex flex-col">
          <h2
            className="text-[28px] font-black leading-[0.95] tracking-[0.01em]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            i. Introduction
          </h2>

          <hr className="mt-3 border-t-2 border-black" />

          <div className="mt-5">
            <IntroSection stats={stats} />
          </div>
        </div>

      </div>
    </section>
  );
}
