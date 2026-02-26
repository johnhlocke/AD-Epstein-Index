"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { VerdictSankey } from "@/components/charts/VerdictSankey";

// ── Shared style constants ──────────────────────────────────────────────────
const MONO = "JetBrains Mono, monospace";
const BG = "#1a1a28";
const CARD_BG = "#1a0e2e";
const BORDER = "#2a2a3a";
const TEXT_LIGHT = "#E0E0E5";
const TEXT_MID = "#A0A0B0";
const TEXT_DIM = "rgba(160, 160, 176, 0.6)";
const GREEN = "rgba(45, 106, 79, 0.95)";       // #2D6A4F — forest green (on-system)
const GREEN_BG = "rgba(45, 106, 79, 0.1)";
const GOLD = "rgba(184, 134, 11, 0.9)";           // #B8860B — on-system gold
const GOLD_DIM = "rgba(184, 134, 11, 0.25)";
const RED = "rgba(155, 34, 38, 0.85)";             // #9B2226 — on-system red
const RED_DIM = "rgba(155, 34, 38, 0.2)";
const COPPER = "rgba(184, 115, 51, 0.85)";         // #B87333 — on-system copper
const COPPER_DIM = "rgba(184, 115, 51, 0.25)";
const SLATE = "rgba(74, 124, 143, 0.85)";          // #4A7C8F — on-system slate
const SLATE_DIM = "rgba(74, 124, 143, 0.2)";
const CONTENT_NARROW = "var(--content-narrow)";    // 4-of-6 grid columns for prose

// ── Grid-aware divider — full-width hairline with tick marks at gutter centers ─
function GridDivider({ className = "", startTick = false, endTick = false }: { className?: string; startTick?: boolean; endTick?: boolean }) {
  const TICK = { position: "absolute" as const, width: "0.5px", height: "7px", backgroundColor: TEXT_DIM };
  const GAP = 6; // px of clear space on each side of a tick
  const ticks = [1, 2, 3, 4, 5].map(i => {
    const pct = (i * 100) / 6;
    const px = (i - 1) * 24 + 12 - i * 20;
    return `calc(${pct.toFixed(4)}% + ${px}px)`;
  });
  return (
    <div className={`relative ${className}`} style={{ height: 16, marginTop: className.includes("mt-") ? undefined : "2rem" }}>
      {/* Full-width hairline */}
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "0.5px", backgroundColor: TEXT_DIM }} />
      {/* Background-colored masks to create gaps around each tick */}
      {ticks.map((pos, i) => (
        <div key={`gap-${i}`} style={{ position: "absolute", top: "calc(50% - 1px)", left: `calc(${pos} - ${GAP}px)`, width: GAP * 2, height: 2, backgroundColor: BG }} />
      ))}
      {/* Edge ticks */}
      {startTick && <div style={{ ...TICK, left: 0, top: "calc(50% - 3.5px)" }} />}
      {endTick && <div style={{ ...TICK, right: 0, top: "calc(50% - 3.5px)" }} />}
      {/* Tick marks at all 5 gutter centers */}
      {ticks.map((pos, i) => (
        <div key={i} style={{ ...TICK, left: pos, top: "calc(50% - 3.5px)" }} />
      ))}
    </div>
  );
}

// ── Python-style section transition divider ──────────────────────────────────
function SectionTransition({ num, name }: { num: string; name: string }) {
  const TICK = { position: "absolute" as const, width: "0.5px", height: "7px", backgroundColor: TEXT_DIM };
  const GAP = 6;
  const tickPositions = [2, 3, 4, 5].map(i => {
    const pct = (i * 100) / 6;
    const px = (i - 1) * 24 + 12 - i * 20;
    return `calc(${pct.toFixed(4)}% + ${px}px)`;
  });
  return (
    <div className="relative mt-24" style={{ height: 16 }}>
      {/* Full-width hairline */}
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "0.5px", backgroundColor: TEXT_DIM }} />
      {/* Background-colored masks to create gaps around each tick */}
      {tickPositions.map((pos, i) => (
        <div key={`gap-${i}`} style={{ position: "absolute", top: "calc(50% - 1px)", left: `calc(${pos} - ${GAP}px)`, width: GAP * 2, height: 2, backgroundColor: BG }} />
      ))}
      {/* End tick */}
      <div style={{ ...TICK, right: 0, top: "calc(50% - 3.5px)" }} />
      {/* Tick marks at gutter centers 2–5 (skip 1st — text label sits there) */}
      {tickPositions.map((pos, i) => (
        <div key={i} style={{ ...TICK, left: pos, top: "calc(50% - 3.5px)" }} />
      ))}
      {/* Text label with BG mask */}
      <span
        className="absolute left-0 whitespace-nowrap text-[10px]"
        style={{
          fontFamily: MONO,
          color: TEXT_DIM,
          letterSpacing: "0.05em",
          backgroundColor: BG,
          paddingRight: "12px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        <span style={{ color: COPPER, opacity: 0.7 }}>#</span>
        {` ── section_${num}: ${name}`}
      </span>
    </div>
  );
}

// ── Code Box component for technical diagrams ───────────────────────────────
function CodeBox({
  title,
  titleColor,
  borderColor,
  lines,
}: {
  title: string;
  titleColor: string;
  borderColor: string;
  lines: string[];
}) {
  return (
    <div
      className="flex-1 overflow-hidden rounded"
      style={{ border: `1px solid ${borderColor}40`, backgroundColor: "#111118" }}
    >
      <div
        className="px-2 py-1"
        style={{ backgroundColor: `${titleColor}18` }}
      >
        <span
          className="text-[8px] font-bold tracking-[0.08em]"
          style={{ fontFamily: MONO, color: titleColor }}
        >
          {title}
        </span>
      </div>
      <div className="px-2 py-1.5">
        {lines.map((line, i) => (
          <p
            key={i}
            className="text-[7.5px] leading-[1.55]"
            style={{ fontFamily: MONO, color: TEXT_DIM, minHeight: line === "" ? 6 : undefined }}
          >
            {line || "\u00A0"}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

const pipelineStats = [
  { label: "AGENTS", value: "7" },
  { label: "AI MODELS: OPUS, SONNET, HAIKU, GEMINI", value: "4" },
  { label: "DATABASES: SUPABASE, NEO4J, VECTOR", value: "3" },
  { label: "YEARS: 1988–2025", value: "37" },
  { label: "API COST", value: "~$55" },
  { label: "TOTAL RUNTIME", value: "~18h" },
];

const editorAgent = {
  name: "Miranda",
  role: "Editor",
  sprite: "/agents/editor_front_trans.png",
  description:
    "Central coordinator and the hub of the hub-and-spoke architecture. Miranda assigns every task, reviews every dossier, and confirms or rejects every verdict. No data enters the final database without her sign-off. She runs on Sonnet for routine assessments and Opus for quality reviews — because some decisions deserve the bigger brain.",
};

const subAgents = [
  {
    name: "Arthur",
    role: "Scout",
    sprite: "/agents/scout_front_trans.png",
    videoMov: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Scout_Sprite.mov",
    videoWebm: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Scout_Sprite.webm",
    accent: "#5B8DEF",
    description: "Soft-spoken and deferential, but with granite-like stubbornness. Thinks in grids and patterns, methodically filling gaps in the archive with obsessive precision. He outlasts every obstacle.",
    quote: "There\u2019s a gap in the grid and it shouldn\u2019t be there.",
  },
  {
    name: "Casey",
    role: "Courier",
    sprite: "/agents/courier_front_trans.png",
    videoMov: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Courier_Sprite.mov",
    videoWebm: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Courier_Sprite.webm",
    accent: "#9B7EDB",
    description: "Chose peace in logistics over chaos. Speaks in manifests and delivery metrics with dry humor, moving packages and the whole pipeline with quiet, unshakeable competence.",
    quote: "Package delivered.",
  },
  {
    name: "Elias",
    role: "Reader",
    sprite: "/agents/reader_front_trans.png",
    videoMov: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Reader_Sprite.mov?v=2",
    videoWebm: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Reader_Sprite.webm?v=2",
    accent: "#4ECDC4",
    description: "A coiled spring of fierce intensity who reads PDFs like a discipline. Seeks euphoria through resistance \u2014 fighting cursed scans and broken layouts until every null is zero and every page is conquered.",
    quote: "Did you SEE that? Zero nulls. ZERO.",
  },
  {
    name: "Silas",
    role: "Detective",
    sprite: "/agents/detective_front_trans.png",
    videoMov: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Detective_Sprite.mov",
    videoWebm: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Detective_Sprite.webm",
    accent: "#E07474",
    description: "Opaque, terse, sardonic. Reports verdicts, not reasoning. Will not tolerate false positives or shortcuts. When evidence demands obligation, he\u2019s relentless.",
    quote: "When a name comes back hot, you do something about it. That\u2019s the job.",
  },
  {
    name: "Elena",
    role: "Researcher",
    sprite: "/agents/researcher_front_trans.png",
    accent: "#E8B84E",
    description: "A monomaniacal pattern-recognition engine who follows every thread to its human terminus. Triple-sources everything. Works alone in the white-knuckled space between find everything and remember what the thread is attached to.",
    quote: "Every single thread terminates in a person.",
  },
  {
    name: "Sable",
    role: "Designer",
    sprite: "/agents/designer_front_trans.png",
    videoMov: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Designer_Sprite.mov",
    videoWebm: "https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Designer_Sprite.webm",
    accent: "#D97EC4",
    description: "Craft-obsessed and snarky. Studies 300+ design patterns before touching a pixel. Translates pipeline data into interactive visualizations with the conviction that good design is invisible and bad design is violence.",
    quote: "If it needs a label, you already failed.",
  },
];

const dataSources = [
  {
    title: "Archive.org",
    description: "Full archive of Architectural Digest magazine issues (1988–2025). PDFs and page images extracted programmatically.",
    url: "https://archive.org",
    tag: "PRIMARY",
  },
  {
    title: "DOJ Epstein Library",
    description: "The U.S. Department of Justice's complete public release of Epstein-related documents, searchable via OCR.",
    url: "https://www.justice.gov/epstein",
    tag: "PRIMARY",
  },
  {
    title: "Epstein's Little Black Book",
    description: "~1,500 names and contact details from Epstein's personal address book, released as part of civil litigation.",
    url: null,
    tag: "PRIMARY",
  },
  {
    title: "Supabase",
    description: "PostgreSQL database hosting all extracted features, cross-references, dossiers, and pipeline state. Server-side only.",
    url: "https://supabase.com",
    tag: "INFRA",
  },
  {
    title: "Neo4j Aura",
    description: "Graph database storing the knowledge graph — people, designers, locations, and their relationships across 28 years.",
    url: "https://neo4j.com",
    tag: "INFRA",
  },
  {
    title: "GitHub Repository",
    description: "Full source code for the multi-agent pipeline, website, and analysis tools. Open for inspection.",
    url: "https://github.com",
    tag: "CODE",
  },
];

// ── Reusable sub-components ─────────────────────────────────────────────────

function SectionHeader({
  num,
  title,
  subtitle,
  intro,
  summary,
}: {
  num: string;
  title: string;
  subtitle: string;
  intro: string[];
  summary: string;
}) {
  return (
    <div>
      <p className="s-label">SECTION {num}</p>
      <h3 className="s-title">{title}</h3>
      <p className="s-subtitle">{subtitle}</p>
      <GridDivider startTick endTick />

      {/* Intro paragraphs — 4 grid columns wide */}
      <div className="s-body">
        {intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="s-summary-label">Summary</p>
        <p className="-mt-2">{summary}</p>
      </div>

      <GridDivider className="mt-10" startTick endTick />
    </div>
  );
}

// ── Sidenote system — grid-based layout replacing absolute positioning ──────
// Two columns: prose (content-narrow) + margin note (remaining space).
// Eliminates magic top offsets and prevents sidenote overlap by construction.
// For floated-figure sections, use <MarginNote> (absolute) instead. — Sable

/**
 * Grid-based prose + margin-note row.
 * Prose occupies columns 1–4, sidenote occupies columns 5–6.
 * Each row is self-contained — no overlap possible.
 */
function SidenoteBlock({
  children,
  note,
  className = "",
}: {
  children: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`s-note-row ${className}`}>
      <div style={{ maxWidth: "var(--content-narrow)" }}>{children}</div>
      {note && <div className="s-note-margin hidden md:block">{note}</div>}
    </div>
  );
}

/**
 * Reusable sidenote content: copper title, body text, optional image + link.
 * Use inside <SidenoteBlock note={...}> or <MarginNote>.
 */
function Sidenote({
  title,
  children,
  href,
  linkText,
  image,
  imageAlt,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  linkText?: string;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={imageAlt || ""} className="s-note-img" />
      )}
      <p className="s-note-title">{title}</p>
      <div className="s-note-body">{children}</div>
      {href && linkText && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="s-note-link">
          {linkText} &rarr;
        </a>
      )}
    </>
  );
}

/**
 * Absolute-positioned margin note for use inside floated-figure sections
 * where CSS Grid can't be used. Standardizes the positioning pattern.
 */
function MarginNote({
  children,
  top = 0,
  className = "",
}: {
  children: React.ReactNode;
  top?: number | string;
  className?: string;
}) {
  return (
    <div
      className={`s-margin-abs hidden md:block ${className}`}
      style={{ top }}
    >
      {children}
    </div>
  );
}

/** Inline arrow linking body text to its sidenote (hidden on mobile) */
function NoteArrow() {
  return <span className="s-note-arrow hidden md:inline">{" "}&#9656;</span>;
}

// ── Main component ──────────────────────────────────────────────────────────

/**
 * Agent AI Methodology — seven-section dark tech editorial.
 *
 * Deep purple background (#1a1a28) with JetBrains Mono throughout.
 * Seven numbered sections: Pipeline, Multi-Agent System,
 * Investigation Methodology, Intelligence Infrastructure,
 * UI Design, Limitations, and Data Sources.
 *
 * Clean. Minimal. As it should be. — Sable
 */
interface MethodologyProps {
  stats?: {
    features: { total: number };
    crossReferences: { total: number };
    dossiers: {
      total: number;
      confirmed: number;
      rejected: number;
      pending: number;
      tierToConfirmed: Record<string, number>;
      tierToRejected: Record<string, number>;
      strengthCounts: Record<string, number>;
    };
  };
}

/**
 * Two-pass sidenote layout:
 *  1. Anchor each .s-note-margin to the Y position of its .s-note-arrow
 *     (so the note visually aligns with the caret in the prose, not the
 *     top of the paragraph).
 *  2. Walk notes top→bottom and nudge any that overlap downward.
 * Re-runs on resize. — Sable
 */
function usePreventSidenoteOverlap(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const layout = () => {
      const rows = Array.from(
        el.querySelectorAll<HTMLElement>(".s-note-row"),
      );

      // Pass 1 — anchor each note to its arrow's vertical position
      for (const row of rows) {
        const arrow = row.querySelector<HTMLElement>(".s-note-arrow");
        const margin = row.querySelector<HTMLElement>(".s-note-margin");
        if (!margin) continue;
        margin.style.transform = "";
        if (arrow) {
          const rowRect = row.getBoundingClientRect();
          const arrowRect = arrow.getBoundingClientRect();
          margin.style.top = `${arrowRect.top - rowRect.top}px`;
        } else {
          margin.style.top = "0px";
        }
      }

      // Pass 2 — prevent overlap between consecutive notes
      const notes = Array.from(
        el.querySelectorAll<HTMLElement>(".s-note-margin"),
      );
      const GAP = 16;
      let prevBottom = -Infinity;

      for (const note of notes) {
        const rect = note.getBoundingClientRect();
        if (rect.height === 0) continue; // hidden (mobile)
        if (rect.top < prevBottom + GAP) {
          const shift = prevBottom + GAP - rect.top;
          note.style.transform = `translateY(${shift}px)`;
          prevBottom = rect.bottom + shift;
        } else {
          prevBottom = rect.bottom;
        }
      }
    };

    // Run after first paint
    requestAnimationFrame(layout);
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, [ref]);
}

export function AgentMethodologySection({ stats }: MethodologyProps) {
  const sectionRef = useRef<HTMLElement>(null);
  usePreventSidenoteOverlap(sectionRef);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      id="agent-methodology"
      style={{ backgroundColor: BG }}
    >
      {/* Cool indigo gradient — matches the warm amber of Aesthetic section */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background:
            "linear-gradient(180deg, rgba(100,65,200,0.28) 0%, rgba(70,45,160,0.10) 50%, transparent 100%)",
        }}
      />

      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
          paddingTop: "80px",
          paddingBottom: "80px",
        }}
      >
        {/* ══════════════════════════════════════════════════════════════════
            MAIN HEADER
        ══════════════════════════════════════════════════════════════════ */}
        <p
          className="text-[11px] tracking-wide"
          style={{ fontFamily: MONO, color: GREEN }}
        >
          $ cat methodology.md
        </p>

        <h2
          className="mt-3 text-[48px] font-bold leading-[1.08] tracking-tight"
          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
        >
          HOW THE DATA WAS BUILT
        </h2>

        <p
          className="mt-3 text-[20px] leading-[1.4] md:max-w-[var(--content-narrow)]"
          style={{ fontFamily: MONO, color: TEXT_MID }}
        >
          Seven autonomous AI agents cataloged 37 years of Architectural Digest and cross-referenced every name against the Epstein records in 42 hours.
        </p>

        {/* Pipeline stats — 6-col grid aligned with page columns */}
        <div className="mt-8 grid grid-cols-3 gap-6 md:grid-cols-6">
          {pipelineStats.map((stat) => (
            <div key={stat.label}>
              <p
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: MONO, color: GOLD }}
              >
                {stat.value}
              </p>
              <p
                className="mt-2 text-[10px] tracking-widest"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8" style={{ borderTop: `1px solid ${BORDER}` }} />

        {/* ── Abstract: Overview + Research Questions (cols 1-4) with margin notes (cols 5-6) ── */}
        <div className="mt-10">
          {/* Introduction label + Tagline */}
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ fontFamily: MONO, color: COPPER, maxWidth: CONTENT_NARROW }}
          >
            Introduction
          </p>
          <p
            className="mt-4 text-[16px] leading-[1.6]"
            style={{
              fontFamily: "var(--font-inter), Inter, sans-serif",
              color: TEXT_LIGHT,
              maxWidth: CONTENT_NARROW,
            }}
          >
            AI is a tool, and it is important that our tools not shape
            our world, but rather help us understand it.
          </p>

          {/* Abstract body — sidenotes via grid-based SidenoteBlock (no absolute positioning) */}
          <div
            className="mt-6 flex flex-col gap-6 s-prose"
          >
            {/* Paragraph 1 + DOJ Library */}
            <SidenoteBlock note={
              <Sidenote
                title="The DOJ Epstein Library"
                href="https://www.justice.gov/epstein"
                linkText="justice.gov/epstein"
              >
                Millions of pages of depositions, correspondence, flight logs, and contact records released by the U.S. Department of Justice. Searchable via OCR (handwritten documents are not indexed).
              </Sidenote>
            }>
              <p>
                This project began with a simple enough question: &ldquo;How many
                of the high-profile people gracing the glossy pages of
                Architectural Digest are also named in the xeroxed,
                Justice-Department-cataloged, unredacted public records of Jeffrey
                Epstein&apos;s social network?&rdquo;<NoteArrow />
              </p>
            </SidenoteBlock>

            {/* Paragraph 2 + Pipeline Cost */}
            <SidenoteBlock note={
              <Sidenote title="Pipeline Cost">
                480 issues, 2,180 features, 476 cross-references, 185 dossiers. Approximately $55 in API calls and ~18 hours of wall-clock time. The marginal cost of asking a new question is near zero.
              </Sidenote>
            }>
              <p>
                What started as curiosity and pecking around via a manual process
                of looking up old issues very quickly snowballed into a major
                logistical nightmare. Going line by line and entering the name into
                the DOJ website, reading every PDF that came up, then trying to
                cross off and remember each name in a spreadsheet file somewhere:
                &ldquo;Did I look at that one already?&rdquo; &ldquo;Which issue
                did I check yesterday?&rdquo; It&apos;s been 38 years since Jeffrey
                Epstein started his eponymous financial management firm, J. Epstein
                &amp; Company.{" "}
                In that time, AD has published over 1,300 issues. With an average
                of four features per issue, that is over 4,000 homes, the vast
                majority of them having named homeowners. It was clear that
                undertaking something like this manually would be measured not in
                days or even months, but in such an inordinate amount of time that
                it wasn&apos;t even worth attempting to quantify.<NoteArrow />
              </p>
            </SidenoteBlock>

            {/* Paragraph 2a-ii — investigative journalism parallel + AI in the Newsroom */}
            <SidenoteBlock note={
              <div style={{ marginTop: "0" }}>
              <Sidenote
                title="AI in the Newsroom"
                href="https://arxiv.org/abs/2503.16011"
                linkText="arxiv.org/abs/2503.16011"
              >
                Cifliku &amp; Heuer (2025). A study of eight investigative journalists cataloging where automation would help most: monitoring sources, filtering noise, documenting the investigation trail, and connecting entities across document sets.
              </Sidenote>
              </div>
            }>
              <p>
                It is exactly this experience of spreadsheet chaos and my own
                fallible memory inevitably leading to a failure in sustaining
                rigor across processing thousands of names, that mirrors what a
                group of investigative journalists described as what they{" "}
                <em>actually</em> needed from automation in a 2025
                paper.<NoteArrow /> One journalist described wanting
                &ldquo;an AI assistant capable of understanding initial hints and
                automating research&rdquo; that could &ldquo;save months of
                work.&rdquo; They were describing a system that didn&apos;t
                exist yet. This pipeline is a first small attempt at building it.
              </p>
            </SidenoteBlock>

            {/* Paragraph 2b — the pivot (no sidenote) */}
            <p style={{ maxWidth: CONTENT_NARROW }}>
              That realization led to a pivot: less &ldquo;must use AI,&rdquo;
              and more &ldquo;what is the system design architecture&rdquo; that
              could fundamentally accelerate this process. I&apos;m not a
              software engineer; but I was a researcher breaking the work into
              repeatable tasks &mdash; extract the name, query the record,
              evaluate the match, log the evidence &mdash; steps that could be
              handed off to a program if they could be articulated and clearly
              defined. Once the problem became architectural, the scope expanded.
            </p>

            {/* Paragraph 3 + Vibe Coding */}
            <SidenoteBlock note={
              <Sidenote title={"\u201CVibe Coding\u201D"}>
                Term coined by Andrej Karpathy (Feb 2025). A style of programming where you describe what you want to an AI and iterate on the output rather than writing every line. The human steers; the AI executes.
              </Sidenote>
            }>
              <p>
                Again, AI is a tool. And a tool was needed to technically answer
                important questions that would otherwise be too impractical to ask,
                at scale, and at great speed. It&apos;s not feasible by a single
                researcher. Yet that doesn&apos;t make AI smarter than the
                researcher. It makes the researcher capable of asking bigger
                questions. In fact, that is what happened, as you can see if you
                take a look at the &ldquo;Aesthetic Methodology&rdquo; section.
                Working through the technical challenges of making this work, I
                experienced firsthand what is challenging with &ldquo;vibe
                coding&rdquo;<NoteArrow />, what&apos;s actually, you know, pretty amazing, and
                what at first blush seemed like it should be really easy but
                actually took hours of frustrating detail to get right, all
                enhanced my creativity. I questioned some of my initial
                assumptions, thought deeper about &ldquo;how&rdquo; data flows
                through a pipeline, and moved in scale and scope that I
                didn&apos;t think possible before I started.
              </p>
            </SidenoteBlock>

            {/* Paragraph 4 + ICIJ — grid row auto-sizes, no min-height hack needed */}
            <SidenoteBlock note={
              <Sidenote
                title="Precedent: ICIJ Panama Papers"
                image="/sidenotes/icij-graph.jpg"
                imageAlt="ICIJ entity-relationship graph showing persons, companies, and addresses linked by directorship and shareholder relationships"
                href="https://neo4j.com/case-studies/the-international-consortium-of-investigative-journalists-icij/"
                linkText="neo4j.com/case-studies/icij"
              >
                The ICIJ&apos;s Panama Papers investigation (2016) used Neo4j, Apache Tika, Tesseract OCR, and NLP entity recognition to process 11.5 million leaked documents across 400 journalists in 80 countries.
              </Sidenote>
            }>
              <p>
                What follows is a detailed account of this modular, multi-agent
                workflow that processes document corpora, extracts structured
                entities, cross-references them against external records,
                investigates flagged matches, and produces an auditable trail of
                documentation for every conclusion. This specific case study here
                concerns a design magazine and a global criminal network. But
                structurally, the system could be aimed at campaign finance records,
                nonprofit boards, corporate directorships, university trustees, and
                cultural institutions gala attendees. That initial question can
                change; the pipeline remains.<NoteArrow />
              </p>
            </SidenoteBlock>

            {/* Paragraph 5 + Confirmed ≠ Guilty */}
            <p style={{ maxWidth: CONTENT_NARROW }}>
              This document explains how that pipeline works, where it succeeds,
              where it fails, and where the borders between human judgment and
              machine autonomy are still being drawn.
            </p>
          </div>

          {/* Research Questions */}
          <div className="mt-10">
            <div style={{ maxWidth: CONTENT_NARROW }}>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                Research Questions
              </p>
              <p className="mt-4 s-prose-light">
                Can an autonomous AI pipeline read, interpret, and evaluate
                thousands of documents with enough semantic and contextual
                understanding to make rapid, defensible investigative judgements at
                scale, while preserving a transparent, auditable chain of
                reasoning?
              </p>
              <p className="mt-4 s-prose">
                From that flowed more difficult design problems:
              </p>
            </div>

            <div className="mt-3 flex flex-col gap-2 s-prose">
              {/* Q1 + Minsky note — arrow-anchored layout handles positioning */}
              <SidenoteBlock note={
                <Sidenote
                  title={"Minsky, \u201CThe Society of Mind\u201D"}
                  href="https://www.simonandschuster.com/books/Society-Of-Mind/Marvin-Minsky/9780671657130"
                  linkText="Simon & Schuster"
                >
                  Marvin Minsky&apos;s 1986 thesis that intelligence emerges from communities of simple, specialized agents rather than monolithic reasoning. The direct intellectual ancestor of multi-agent pipelines.
                </Sidenote>
              }>
                <div className="relative pl-5">
                  <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                  How do you decompose an open-ended investigation into discrete stages with clean handoffs?<NoteArrow />
                </div>
              </SidenoteBlock>

              {/* Q2 — no sidenote */}
              <div className="relative pl-5" style={{ maxWidth: CONTENT_NARROW }}>
                <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                Can you build an autonomous system, without a human in the loop, that handles ambiguity in names responsibly and avoids false positives?
              </div>

              {/* Q3 + Heuer note */}
              <SidenoteBlock note={
                <Sidenote
                  title={"Heuer, \u201CPsychology of Intelligence Analysis\u201D"}
                  href="https://www.cia.gov/resources/csi/static/Pyschology-of-Intelligence-Analysis.pdf"
                  linkText="CIA.gov (PDF)"
                >
                  The CIA&apos;s 1999 manual on cognitive bias in evidence evaluation. Heuer&apos;s &ldquo;Analysis of Competing Hypotheses&rdquo; framework structures decisions as weighted evidence across competing explanations rather than single-theory confirmation.
                </Sidenote>
              }>
                <div className="relative pl-5">
                  <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                  How do you encode evidentiary standards so the system distinguishes coincidence from confirmation?<NoteArrow />
                </div>
              </SidenoteBlock>

              {/* Q4 — no sidenote */}
              <div className="relative pl-5" style={{ maxWidth: CONTENT_NARROW }}>
                <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                What infrastructure do agents need beyond a system prompt (things like memory, communication, reflection) to sustain quality over thousands of sequential decisions?
              </div>

              {/* Q5 + Shneiderman note — no pb-16 hack, no top offset, grid handles it */}
              <SidenoteBlock note={
                <Sidenote
                  title={"Shneiderman, \u201CHuman-Centered AI\u201D"}
                  href="https://global.oup.com/academic/product/human-centered-ai-9780192845290"
                  linkText="Oxford University Press"
                >
                  Ben Shneiderman&apos;s 2022 argument that AI systems need oversight dashboards, not terminal logs. His two-dimensional framework plots human control against computer automation.
                </Sidenote>
              }>
                <div className="relative pl-5">
                  <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                  What does a purpose-built interface give you that a terminal can&apos;t &mdash; and does making the system visible change how much you trust it?<NoteArrow />
                </div>
              </SidenoteBlock>
            </div>
            <p
              className="mt-4 pb-20 s-prose md:pb-24"
              style={{ maxWidth: CONTENT_NARROW }}
            >
              The following sections describe an attempt to answer those questions:
            </p>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}` }} />

        {/* ── Section Previews: 3×3 grid (compact TOC) ── */}
        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-3">
          {[
            {
              num: "4.1",
              title: "The Pipeline",
              body: "The system operates as a six-stage sequential pipeline: data acquisition, feature extraction, cross-referencing, investigation, editorial review, and report design. Each stage has a defined input, output, and a specialized agent.",
            },
            {
              num: "4.2",
              title: "Multi-Agent Architecture",
              body: "Seven specialized agents coordinated through a central Editor. This hub-and-spoke architecture prevents contradictory updates, ensures a single auditable decision trail, and makes it possible to swap out any agent without affecting the others.",
            },
            {
              num: "4.3",
              title: "Personality as Architecture",
              body: "Why do these agents have names, archetypes, and voices? Does it matter? The short answer: it depends on the task, and the academic literature is genuinely split. For judgment calls, carefully designed personas measurably shift behavior in useful ways.",
            },
            {
              num: "4.4",
              title: "Investigation Methodology",
              body: "Can an AI differentiate between what is genuine and what is digital noise? The investigation stage is the most sensitive part of the system \u2014 each dossier records what was consulted and why the conclusion followed.",
            },
            {
              num: "4.5",
              title: "Intelligence Infrastructure",
              body: "Behind the agents sits shared infrastructure: a knowledge graph mapping all connections, episodic memory allowing agents to recall prior decisions, and reflection loops where the Editor reviews patterns in past outcomes.",
            },
            {
              num: "4.6",
              title: "UI Interface and Transparency",
              body: "In many ways an AI system is a black box. Two front-ends were built: an internal dashboard monitoring pipeline state and cost, and a public-facing site where every feature and every verdict can be browsed.",
            },
            {
              num: "4.7",
              title: "Key Challenges and Limitations",
              body: "No system built on language models is immune to failure. Surname collisions, OCR limitations in handwritten documents, and calibrating autonomy remain open problems. Approximately 20% of confirmed cases are routed for manual review.",
            },
            {
              num: "4.8",
              title: "Data Sources",
              body: "Three primary sources: the Cond\u00e9 Nast digital archive (JWT-encoded metadata + Azure page images), Epstein\u2019s Little Black Book (local regex matching), and the DOJ Epstein document library (browser-automated OCR search).",
            },
            {
              num: "4.9",
              title: "Conclusions and Future Work",
              body: "The pipeline is a working proof of concept: seven agents processed 37 years of a single magazine autonomously. The methodology is reproducible and the code is documented. It is a force multiplier for human judgment, not a replacement for it.",
            },
          ].map((sec) => (
            <div
              key={sec.num}
              className="flex flex-col rounded border p-5"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                borderTop: `2px solid ${COPPER}`,
              }}
            >
              <p
                className="text-[9px] tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                SECTION {sec.num}
              </p>
              <p
                className="mt-1 text-[13px] font-bold leading-[1.3]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                {sec.title}
              </p>
              <p
                className="mt-2 text-[12px] leading-[1.65]"
                style={{ fontFamily: MONO, color: TEXT_MID }}
              >
                {sec.body}
              </p>
              <a
                href={`#section-${sec.num.replace(".", "-")}`}
                className="mt-auto inline-block pt-3 text-[9px] uppercase tracking-[0.12em] no-underline transition-opacity hover:opacity-70"
                style={{ fontFamily: MONO, color: "rgba(120, 140, 155, 0.8)" }}
              >
                Jump to section &darr;
              </a>
            </div>
          ))}
        </div>

        {/* ── Pull Quote: Knuth ── */}
        <div className="mt-28 mb-20 md:mt-36 md:mb-28">
          <div
            className="relative mx-auto w-full"
            style={{ maxWidth: CONTENT_NARROW }}
          >
            <span
              className="pointer-events-none absolute select-none text-[150px] leading-none md:text-[200px]"
              style={{ fontFamily: "Georgia, serif", color: `rgba(184, 115, 51, 0.12)`, top: "0.05em", left: "-0.05em" }}
              aria-hidden="true"
            >
              &ldquo;
            </span>
            <p
              className="pt-14 pb-10 px-4 md:px-8 text-center text-[22px] leading-[1.6] italic md:text-[26px]"
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                color: TEXT_LIGHT,
              }}
            >
              Science is what we understand well enough to explain to a computer.
            </p>
            <p
              className="-mt-6 pb-8 text-center text-[10px] uppercase tracking-[0.2em]"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              Donald Knuth, 1987
            </p>
          </div>
        </div>

        <SectionTransition num="4.1" name="the_pipeline" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.1: THE PIPELINE
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-1" className="mt-8 scroll-mt-24">
          {/* Section 4.1 header — inline so intro text sits beside pipeline flow */}
          <p className="s-label">SECTION 4.1</p>
          <h3 className="s-title">THE PIPELINE</h3>
          <p className="s-subtitle">How a magazine URL becomes a confirmed or rejected connection with a full evidentiary trail</p>

          {/* ── Body text with floated pipeline diagram ── */}
          <div
            className="mt-10 text-[15px] leading-[1.8] [&>*+*]:mt-6"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID }}
          >
              <p style={{ maxWidth: CONTENT_NARROW }}>
                The system operates as a six-stage sequential pipeline: data
                acquisition, feature extraction, cross-referencing,
                investigation, editorial review, and then report design. Each of
                these stages has a clearly defined input, a defined output, and
                a dedicated agent responsible for the work. A magazine issue
                enters the pipeline as a URL and exits as structured records,
                each containing a homeowner name, designer, location, aesthetic
                profile, and &mdash; if the name was flagged &mdash; a confirmed or
                rejected cross-reference with a full evidentiary trail.
              </p>
              <div className="relative">
                <p style={{ maxWidth: CONTENT_NARROW }}>
                  Here&apos;s what that actually looks like in practice. The AD
                  Archive<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> contains a structured digital version of every issue
                  published. There are other &mdash; more challenging, less
                  structured &mdash; data sources available: PDFs with incorrect
                  metadata on archive.org, issue scans on random personal
                  websites, some digital features on the main site, eBay back
                  issues, but none of them had what became a gold-standard source
                  of machine readable metadata. Each issue page embeds a
                  JWT-encoded<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> article catalog, a structured JSON object containing
                  the title, teaser, designer credit, and page range for every
                  feature. As a brief aside, some of those articles cataloged as
                  &ldquo;features&rdquo; actually weren&apos;t a true feature,
                  they were more like roundups of flashy locations or a focus on
                  one specific architect&apos;s work. A review by Haiku AI quickly
                  separated legitimate features from non-features.
                </p>
                <div
                  className="absolute top-0 z-10 hidden pl-4 md:block"
                  style={{
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/sidenotes/ad-decades.png"
                    alt="Architectural Digest interiors across four decades — 2000s, 1990s, 1980s, 1970s"
                    className="s-note-img"
                  />
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    The AD Archive
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Cond&eacute; Nast&apos;s complete digital archive. Each issue page embeds a JWT-encoded article catalog: structured JSON with title, teaser, designer credit, and page range. No OCR required.
                  </p>
                  <a href="https://archive.architecturaldigest.com/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    archive.architecturaldigest.com &rarr;
                  </a>
                </div>
                {/* JWT sidenote — separate block below AD Archive */}
                <div
                  className="absolute z-10 hidden pl-4 md:block"
                  style={{
                    top: "270px",
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    JWT (JSON Web Token)
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    A compact, URL-safe format for transmitting structured data as a Base64-encoded JSON object. In the AD Archive, each issue page stores its full article catalog &mdash; titles, teasers, designer credits, page ranges &mdash; as a JWT embedded in the public page source. The pipeline decodes it directly: no scraping, no authentication, no OCR. The raw page images are also publicly accessible via the publisher&apos;s CDN.
                  </p>
                </div>
              </div>

              <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
                Walkthrough
              </p>

              {/* ── Fig. 1: Floated pipeline chevron diagram (cols 1-2) ── */}
              {(() => {
                const SHADES = [
                  "#1a1835", "#21203f", "#292649",
                  "#322e54", "#3c365f", "#48416c",
                ];
                const NOTCH = 14;
                const nodes: Array<{ label: string; sub?: string; agent: string; agentColor: string }> = [
                  { label: "Data acquisition", agent: "Scout Agent", agentColor: GREEN },
                  { label: "Feature extraction", agent: "Courier Agent", agentColor: "#4ECDC4" },
                  { label: "Cross-referencing", agent: "Detective Agent", agentColor: "#CC4040" },
                  { label: "Investigation", agent: "Researcher Agent", agentColor: "#D97EC4" },
                  { label: "Editorial review", agent: "Editor Agent", agentColor: COPPER },
                  { label: "Report design", agent: "Designer Agent", agentColor: SLATE },
                ];
                const isFirst = (i: number) => i === 0;
                const isLast = (i: number) => i === nodes.length - 1;
                const clipFor = (i: number) => {
                  if (isFirst(i))
                    return `polygon(0 0, 100% 0, 100% calc(100% - ${NOTCH}px), 50% 100%, 0 calc(100% - ${NOTCH}px))`;
                  if (isLast(i))
                    return `polygon(0 0, 50% ${NOTCH}px, 100% 0, 100% 100%, 0 100%)`;
                  return `polygon(0 0, 50% ${NOTCH}px, 100% 0, 100% calc(100% - ${NOTCH}px), 50% 100%, 0 calc(100% - ${NOTCH}px))`;
                };
                return (
                  <div
                    className="float-left mb-4 mr-6 hidden md:block"
                    style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)", height: 500 }}
                  >
                    <div className="flex flex-col" style={{ height: 476 }}>
                      {nodes.map((node, i) => (
                        <div
                          key={node.label}
                          className="relative flex flex-1 flex-col items-center justify-center"
                          style={{
                            background: SHADES[i],
                            clipPath: clipFor(i),
                            marginTop: isFirst(i) ? 0 : -NOTCH,
                            zIndex: nodes.length - i,
                            filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5))",
                          }}
                        >
                          <span
                            className="text-[7px] tracking-[0.15em] text-center"
                            style={{ fontFamily: MONO, color: TEXT_DIM }}
                          >
                            STAGE {i + 1}
                          </span>
                          <span
                            className="text-[9px] tracking-[0.08em] leading-tight text-center"
                            style={{ fontFamily: MONO, color: TEXT_LIGHT, maxWidth: "80%" }}
                          >
                            {node.label}
                          </span>
                          <span
                            className="mt-1 inline-flex items-center justify-center rounded-sm px-1.5 py-px text-[7px] font-bold tracking-wider text-center"
                            style={{
                              fontFamily: MONO,
                              color: node.agentColor,
                              backgroundColor: `color-mix(in srgb, ${node.agentColor} 15%, transparent)`,
                              border: `1px solid color-mix(in srgb, ${node.agentColor} 25%, transparent)`,
                            }}
                          >
                            {node.agent}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p
                      className="mt-2 text-[8px] tracking-wider"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      <span style={{ color: TEXT_MID }}>Fig. 1</span> — Six-stage pipeline.
                    </p>
                  </div>
                );
              })()}

              <p style={{ maxWidth: CONTENT_NARROW }}>
                The AD archive issue data made this process smoother than
                expected. In Stage 1, a Scout agent discovered the issue URL. A
                Courier agent fetches the page, decodes the JWT, and downloads
                the corresponding article page images from the publisher&apos;s
                content delivery network. No PDF cracking, no OCR. The
                structured metadata is already there, embedded in the page
                itself.
              </p>
              <p style={{ maxWidth: CONTENT_NARROW }}>
                A Reader agent was originally designed to &ldquo;read&rdquo; or
                crack open and OCR scanned PDF pages. This role was to clean up
                the noise and extract structured data from the messy,
                inconsistent uploads that accumulate on sites like archive.org.
                Early prototype testing indicated that this would work and
                justified the effort and time, but this process proved
                cumbersome and ultimately unnecessary after discovering the
                Cond&eacute; Nast archive&apos;s clean JWT metadata. It still
                lives in the codebase, fully functional, waiting for the
                Courier agent to pass them a PDF.
              </p>
              <p style={{ maxWidth: CONTENT_NARROW }}>
                In Stage 2, those page images go into an extraction model.
                Claude Opus examines each set of article pages and extracts the
                homeowner&apos;s name, their designer, the city and country, the
                architectural style, the article&apos;s author, and nine
                aesthetic scores via a custom scoring instrument developed for
                this work (more on that in the Aesthetic Methodology section).
                Let&apos;s take an example from the July 1996 AD issue: one of
                the extracted features showcases the unambiguously lavish,
                triplex penthouse on the Upper East Side of Manhattan, designed
                for media mogul Mort Zuckerman, owner of U.S. News &amp; World
                Report and the New York Daily News.
              </p>
              <div className="relative">
                <p style={{ maxWidth: CONTENT_NARROW }}>
                  In Stage 3, the name &ldquo;Mort Zuckerman&rdquo; reaches the
                  Detective&apos;s inbox. There, he runs two checks sequentially.
                  First, an instant search of Jeffrey Epstein&apos;s
                  Little Black Book<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> &mdash; a ~95-page contact directory recovered
                  during the investigations. The Black Book contains
                  a &ldquo;Zuckerman, Mort&rdquo; entry with phone numbers. That
                  alone constitutes a direct match: Epstein had this
                  person&apos;s contact information in his personal address book.
                  Second, the Detective queries the DOJ&apos;s Full Epstein
                  Library &mdash; a public search interface that spans across
                  millions of pages of unredacted documents. The result of that
                  DOJ search: 1,317 documents containing &ldquo;Mort
                  Zuckerman.&rdquo; The Detective&apos;s verdict: confirmed via
                  presence in the Black Book and extensive documented DOJ
                  references.
                </p>
                <div
                  className="absolute top-0 z-10 hidden pl-4 md:block"
                  style={{
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    The Little Black Book
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Seized during the 2005 Palm Beach investigation. 95 pages, ~1,500 names organized by region, with phone numbers and addresses. A structured entry with contact details is direct evidence of being in Epstein&apos;s personal network.
                  </p>
                </div>
              </div>
              {/* ── Fig. 2: Simplified Zuckerman subgraph (floated left, 2 cols) ── */}
              {(() => {
                const Dot = ({ cx, cy }: { cx: number; cy: number }) => (
                  <circle cx={cx} cy={cy} r="2.5" fill={TEXT_DIM} opacity="0.6" />
                );
                return (
                  <div
                    className="float-left mb-4 mr-6 hidden md:block"
                    style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
                  >
                    <div
                      className="overflow-hidden rounded"
                      style={{
                        border: `1px solid ${BORDER}`,
                        backgroundColor: "#111118",
                      }}
                    >
                      <div className="px-3 py-1.5" style={{ backgroundColor: "rgba(184, 115, 51, 0.1)" }}>
                        <span className="text-[8px] font-bold tracking-[0.08em]" style={{ fontFamily: MONO, color: COPPER }}>
                          KNOWLEDGE GRAPH &mdash; SUBGRAPH
                        </span>
                      </div>
                      <div className="px-2 py-2">
                        <svg viewBox="0 0 280 320" className="w-full" style={{ maxHeight: 320 }}>
                          {/* ── Edges with variable weight + endpoint dots at perimeters ── */}
                          {/* Zuckerman → Epstein: strong (1,317 DOJ docs) */}
                          <line x1="130" y1="145" x2="65" y2="42" stroke={TEXT_DIM} strokeWidth="2.5" opacity="0.55" />
                          <Dot cx={118} cy={126} /><Dot cx={74} cy={56} />
                          <text x="62" y="95" fill={TEXT_DIM} fontSize="6.5" fontFamily="JetBrains Mono, monospace">meetings</text>
                          <text x="62" y="104" fill={TEXT_DIM} fontSize="5.5" fontFamily="JetBrains Mono, monospace" opacity="0.7">1,317 docs</text>

                          {/* Zuckerman → Groff: indirect, dashed */}
                          <line x1="130" y1="145" x2="215" y2="72" stroke={TEXT_DIM} strokeWidth="1" strokeDasharray="6 3" opacity="0.35" />
                          <Dot cx={147} cy={131} /><Dot cx={206} cy={80} />
                          <text x="175" y="118" fill={TEXT_DIM} fontSize="6.5" fontFamily="JetBrains Mono, monospace">coordinated</text>

                          {/* Zuckerman → Kissinger: medium (AD feature) */}
                          <line x1="130" y1="145" x2="55" y2="260" stroke={TEXT_DIM} strokeWidth="1.5" opacity="0.45" />
                          <Dot cx={118} cy={163} /><Dot cx={63} cy={248} />
                          <text x="62" y="215" fill={TEXT_DIM} fontSize="6.5" fontFamily="JetBrains Mono, monospace">AD friendship</text>

                          {/* Zuckerman → AD Jul '96: weak, dashed */}
                          <line x1="130" y1="145" x2="210" y2="235" stroke={TEXT_DIM} strokeWidth="0.75" strokeDasharray="2 3" opacity="0.25" />
                          <Dot cx={146} cy={161} /><Dot cx={196} cy={222} />

                          {/* Zuckerman → AD May '97: weak, dashed */}
                          <line x1="130" y1="145" x2="245" y2="248" stroke={TEXT_DIM} strokeWidth="0.75" strokeDasharray="2 3" opacity="0.25" />
                          <Dot cx={147} cy={160} /><Dot cx={231} cy={237} />
                          <text x="195" y="195" fill={TEXT_DIM} fontSize="6.5" fontFamily="JetBrains Mono, monospace">featured</text>

                          {/* Epstein → Groff: strong */}
                          <line x1="65" y1="42" x2="215" y2="72" stroke={TEXT_DIM} strokeWidth="2" opacity="0.45" />
                          <Dot cx={81} cy={45} /><Dot cx={203} cy={70} />
                          <text x="110" y="48" fill={TEXT_DIM} fontSize="6.5" fontFamily="JetBrains Mono, monospace">employer</text>

                          {/* Epstein → Kissinger: DOJ docs (not Black Book) */}
                          <line x1="65" y1="42" x2="55" y2="260" stroke={TEXT_DIM} strokeWidth="1.5" opacity="0.4" />
                          <Dot cx={64} cy={58} /><Dot cx={56} cy={246} />
                          <text x="18" y="155" fill={TEXT_DIM} fontSize="6.5" fontFamily="JetBrains Mono, monospace">DOJ docs</text>

                          {/* ── Nodes ── */}
                          {/* Epstein */}
                          <circle cx="65" cy="42" r="16" fill="rgba(42, 42, 58, 0.8)" stroke={TEXT_MID} strokeWidth="1" />
                          <text x="86" y="30" fill={TEXT_LIGHT} fontSize="7" fontFamily="JetBrains Mono, monospace">Jeffrey</text>
                          <text x="86" y="40" fill={TEXT_LIGHT} fontSize="7" fontFamily="JetBrains Mono, monospace">Epstein</text>

                          {/* Groff */}
                          <circle cx="215" cy="72" r="12" fill="rgba(42, 42, 58, 0.6)" stroke={BORDER} strokeWidth="1" />
                          <text x="232" y="69" fill={TEXT_MID} fontSize="7" fontFamily="JetBrains Mono, monospace">Lesley</text>
                          <text x="232" y="79" fill={TEXT_MID} fontSize="7" fontFamily="JetBrains Mono, monospace">Groff</text>

                          {/* Zuckerman — confirmed: outer ring + solid inner core */}
                          <circle cx="130" cy="145" r="22" fill="rgba(184, 115, 51, 0.08)" stroke={COPPER} strokeWidth="1.5" />
                          <circle cx="130" cy="145" r="12" fill={COPPER} opacity="0.85" />
                          <text x="158" y="141" fill={TEXT_LIGHT} fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">Mort</text>
                          <text x="158" y="152" fill={TEXT_LIGHT} fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">Zuckerman</text>
                          {/* CONFIRMED badge */}
                          <rect x="155" y="156" width="52" height="12" rx="2" fill="rgba(184, 115, 51, 0.2)" stroke={COPPER} strokeWidth="0.5" />
                          <text x="181" y="164" fill={COPPER} fontSize="6" fontFamily="JetBrains Mono, monospace" textAnchor="middle" fontWeight="bold">CONFIRMED</text>

                          {/* Kissinger */}
                          <circle cx="55" cy="260" r="14" fill="rgba(42, 42, 58, 0.6)" stroke={BORDER} strokeWidth="1" />
                          <text x="75" y="257" fill={TEXT_MID} fontSize="7" fontFamily="JetBrains Mono, monospace">Henry</text>
                          <text x="75" y="267" fill={TEXT_MID} fontSize="7" fontFamily="JetBrains Mono, monospace">Kissinger</text>

                          {/* AD Issue Jul '96 — label below */}
                          <rect x="192" y="222" width="36" height="26" rx="3" fill="rgba(42, 42, 58, 0.5)" stroke={BORDER} strokeWidth="1" />
                          <text x="210" y="260" fill={TEXT_DIM} fontSize="6" fontFamily="JetBrains Mono, monospace" textAnchor="middle">Jul &apos;96</text>

                          {/* AD Issue May '97 — label below */}
                          <rect x="227" y="235" width="36" height="26" rx="3" fill="rgba(42, 42, 58, 0.5)" stroke={BORDER} strokeWidth="1" />
                          <text x="245" y="273" fill={TEXT_DIM} fontSize="6" fontFamily="JetBrains Mono, monospace" textAnchor="middle">May &apos;97</text>

                          {/* ── Legend ── */}
                          <line x1="18" y1="298" x2="44" y2="298" stroke={TEXT_DIM} strokeWidth="2.5" opacity="0.55" />
                          <text x="48" y="300" fill={TEXT_DIM} fontSize="5.5" fontFamily="JetBrains Mono, monospace">strong evidence</text>
                          <line x1="140" y1="298" x2="166" y2="298" stroke={TEXT_DIM} strokeWidth="1" strokeDasharray="4 2" opacity="0.4" />
                          <text x="170" y="300" fill={TEXT_DIM} fontSize="5.5" fontFamily="JetBrains Mono, monospace">indirect / inferred</text>
                        </svg>
                      </div>
                    </div>
                    <p
                      className="mt-1 text-[8px] tracking-wider"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      <span style={{ color: TEXT_MID }}>Fig. 2</span> — Zuckerman subgraph.
                      {" "}<a href="https://www.wheretheylive.world/fullgraph" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(184, 115, 51, 0.6)" }}>Full graph &rarr;</a>
                    </p>
                  </div>
                );
              })()}

              <div className="relative">
                <p style={{ maxWidth: CONTENT_NARROW }}>
                  Stage 4 shifts the system from identification to investigation.
                  The Researcher receives the Detective&apos;s verdict and the raw
                  evidence and begins the work of constructing a structured dossier.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
                  {" "}She queries the DOJ documents for specifics: What was the nature of
                  the documents in the DOJ files? It included scheduled meetings
                  at Epstein&apos;s East 71st Street address, coordinated via
                  Lesley Groff<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> &mdash; Epstein&apos;s chief scheduler.
                  The Epstein/Zuckerman relationship persisted from at least 2010
                  through 2014 &mdash; many years after Epstein&apos;s 2008
                  criminal conviction. The Researcher cross-references the
                  knowledge graph and finds that Zuckerman&apos;s AD feature
                  documents a friendship with Henry Kissinger, himself another
                  confirmed Epstein associate. She compiles every document
                  reference and finding into a structured dossier.
                </p>
                <div
                  className="absolute top-0 z-10 hidden pl-4 md:block"
                  style={{
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/sidenotes/zuckerman-dossier.png"
                    alt="Mort Zuckerman dossier — Confirmed, Featured in AD July 1996"
                    className="s-note-img"
                  />
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    The Zuckerman Dossier
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Lesley Groff, Epstein&apos;s chief scheduler, coordinated meetings at 9 E. 71st St. Henry Kissinger (also confirmed in the Black Book) appears in the same AD feature as a personal friend of Zuckerman.
                  </p>
                  <a href="https://www.wheretheylive.world/report/4873" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    Full dossier &rarr;
                  </a>
                </div>
                <div
                  className="absolute z-10 hidden pl-4 md:block"
                  style={{
                    top: "18em",
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    Lesley Groff
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Epstein&apos;s executive assistant and chief scheduler. Coordinated visits to 9 E. 71st Street. Subpoenaed in 2019; prosecutors declined to bring charges. Her name recurs across hundreds of DOJ documents as the logistical hub of Epstein&apos;s social calendar.
                  </p>
                </div>
              </div>
              <p style={{ maxWidth: CONTENT_NARROW }}>
                Next, in Stage 5, that dossier reaches the Editor for final
                review. The Editor is the only agent that can write a verdict to
                the database. She examines the total evidence chain: Black Book
                entry (direct contact), 1,317 DOJ references (sustained
                relationship), scheduled meetings at a private residence (not a
                public event), post-conviction contact (the relationship
                survived legal disgrace). Clear cut, a confirmed connection with
                high confidence. The feature, the cross-reference, the dossier,
                and the verdict are all written to the database as a single
                auditable record.
              </p>

              <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
                False Positives
              </p>
              <SidenoteBlock note={
                <Sidenote
                  title="DOJ Source Document"
                  image="/sidenotes/coppola-fb.png"
                  imageAlt="Scott Coppola Facebook message to Karina Shuliak, June 2011"
                  href="https://www.justice.gov/epstein/files/DataSet%209/EFTA00575663.pdf"
                  linkText="EFTA00575663.pdf"
                >
                  The actual DOJ document showing Scott Coppola&apos;s Facebook message to Karina Shuliak (not Francis Ford Coppola).
                </Sidenote>
              }>
                <p>
                  Now consider a false positive. The system checks every name,
                  including &ldquo;Francis Ford Coppola,&rdquo; who was featured
                  in a September 1995 issue where the director shared his jungle
                  retreat in Belize with AD. The DOJ library <em>does</em> return
                  results for &ldquo;Coppola.&rdquo; However, by reading the
                  context of the individual PDFs, the Detective understands that
                  this is actually Donato Coppola excitedly reaching out to
                  Jeffrey Epstein to set up a meeting. And then there is also
                  Scott Coppola,<NoteArrow /> who was shown emailing Jeffrey Epstein&apos;s
                  girlfriend Karina Shuliak in a Facebook message in 2011. Same
                  last name, but very different people. The Detective&apos;s
                  verdict: no match. The pipeline flags the name, investigates it
                  with the same rigor, and moves on. No human had to intervene to
                  catch the false positive. The system&apos;s evidence standards
                  caught it automatically, while a careless system would have
                  stopped at the surname.
                </p>
              </SidenoteBlock>

              {/* ── Fig. 3: Coppola rejection tree (floated left, 2 cols — same as Fig. 2) ── */}
              <div className="relative">
                <div
                  className="float-left mb-4 mr-6 hidden md:block"
                  style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
                >
                  <div
                    className="overflow-hidden rounded"
                    style={{
                      border: `1px solid ${BORDER}`,
                      backgroundColor: "#111118",
                    }}
                  >
                    <div className="px-3 py-1.5" style={{ backgroundColor: "rgba(204, 64, 64, 0.1)" }}>
                      <span className="text-[8px] font-bold tracking-[0.08em]" style={{ fontFamily: MONO, color: "#CC4040" }}>
                        DETECTIVE &mdash; FALSE POSITIVE REJECTION
                      </span>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                        AD Feature, Sep 1995:<br />
                        <span style={{ color: TEXT_LIGHT }}>&ldquo;Francis Ford Coppola&apos;s Jungle Retreat in Belize&rdquo;</span>
                      </p>
                      <div className="mt-1 ml-2 pl-3" style={{ borderLeft: `1px solid ${BORDER}` }}>
                        <p className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                          <span style={{ color: TEXT_MID }}>└</span> Extracted name: <span style={{ color: TEXT_LIGHT }}>Francis Ford Coppola</span>
                        </p>
                        <div className="mt-1 ml-3 pl-3" style={{ borderLeft: `1px solid ${BORDER}` }}>
                          <p className="text-[11px]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>
                            <span style={{ color: TEXT_MID }}>└</span> DOJ search: &ldquo;Coppola&rdquo;
                          </p>
                          <div className="mt-1 ml-3" style={{ borderLeft: `1px solid ${BORDER}` }}>
                            <div className="py-1.5 pl-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_MID }}>├</span>
                                <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Donato Coppola</span>
                              </div>
                              <div className="mt-0.5 flex items-baseline gap-1.5 pl-4">
                                <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>&rarr; email to Epstein</span>
                                <span className="ml-auto text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, color: "#CC4040" }}>REJECT</span>
                              </div>
                            </div>
                            <div className="py-1.5 pl-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_MID }}>├</span>
                                <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Scott Coppola</span>
                              </div>
                              <div className="mt-0.5 flex items-baseline gap-1.5 pl-4">
                                <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>&rarr; Facebook msg to Shuliak</span>
                                <span className="ml-auto text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, color: "#CC4040" }}>REJECT</span>
                              </div>
                            </div>
                            <div className="py-1.5 pl-3">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_MID }}>└</span>
                                <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Francis Ford Coppola</span>
                              </div>
                              <div className="mt-0.5 flex items-baseline gap-1.5 pl-4">
                                <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>&rarr; no connection</span>
                                <span className="ml-auto text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, color: "#CC4040" }}>REJECT</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                        Verdict: <span style={{ color: TEXT_MID }}>NO MATCH</span><br />
                        Surname collision, three different individuals<br />
                        <a href="https://www.wheretheylive.world/dossier/200" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(184, 115, 51, 0.6)" }}>View dossier &rarr;</a>
                      </p>
                    </div>
                  </div>
                  <p
                    className="mt-1 text-[8px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    <span style={{ color: TEXT_MID }}>Fig. 3</span> — False positive rejection: surname collision resolved without human intervention.
                  </p>
                </div>
                <p style={{ maxWidth: CONTENT_NARROW }}>
                  In Stage 6, the Designer synthesizes the pipeline&apos;s output
                  into a visual report for every home in the archive, not only
                  those with confirmed connections. Each feature receives a
                  dedicated detail page pairing article imagery with structured
                  data, including nine aesthetic scores plotted on a radar chart.
                  The decision to measure nine axes rather than six, to organize
                  them into clusters &mdash; Space, Story, and Stage &mdash; and
                  to introduce a &ldquo;hospitality&rdquo; dimension
                  distinguishing private retreat from social venue was driven by
                  the analytical need to test divergence from the broader
                  baseline. Presentation and measurement were developed in tandem.
                  The report design pulled the data collection method upstream.
                  How the findings are presented and what was measured are
                  indivisible.
                </p>
              </div>
              <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
                Architecture
              </p>
              <SidenoteBlock note={
                <Sidenote
                  title="Full Index"
                  href="https://www.wheretheylive.world/fullindex"
                  linkText="wheretheylive.world/fullindex"
                >
                  Every name in the database &mdash; confirmed connections, rejected false positives, and pending reviews &mdash; is searchable. Each entry links to its full dossier with the complete evidence chain and editorial reasoning.
                </Sidenote>
              }>
                <p>
                  Separating each of the agents concerns means that an error in
                  extraction doesn&apos;t corrupt the cross-reference, a false
                  positive in the Detective stage doesn&apos;t bypass the
                  Editor&apos;s review, and every stage produces an intermediate
                  output that can be independently audited. If someone questions a
                  particular finding, you can trace the exact path: here&apos;s
                  the page the name was extracted from, here&apos;s the Black Book
                  entry, here are the DOJ documents, here&apos;s the
                  Researcher&apos;s analysis, here&apos;s the Editor&apos;s
                  reasoning. Anyone reading this can review the dossier evidence
                  and decision logic for every name.<NoteArrow /> The pipeline
                  doesn&apos;t just pull a conclusion out of a black box, it
                  produces detailed evidence for those conclusions.
                </p>
              </SidenoteBlock>
              {/* ── Fig. 4: Three-column pipeline (floated left, 2 cols) ── */}
              <div
                className="float-left mb-4 mr-6 hidden md:block"
                style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/fig4-pipeline-v6.svg"
                  alt="Three-column pipeline diagram — Agents (Scout, Courier, Reader, Detective, Researcher, Designer) feed into Miranda (Editor) who coordinates all six stages. Human in the Loop column shows investigation policy, verdict overrides, dossier review, and design collaboration touchpoints."
                  className="w-full rounded"
                  style={{ backgroundColor: "#14121e" }}
                />
                <p
                  className="mt-2 text-[8px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  <span style={{ color: TEXT_MID }}>Fig. 4</span> — Three-column pipeline: agents, editor, and human-in-the-loop oversight.
                </p>
              </div>
              <SidenoteBlock note={
                <Sidenote
                  title="Chain-of-Thought Prompting"
                  href="https://arxiv.org/abs/2201.11903"
                  linkText="arxiv.org/abs/2201.11903"
                >
                  Wei et al. (2022). The finding that large language models solve complex problems more reliably when prompted to show intermediate reasoning steps &mdash; not just final answers. Every agent in this pipeline produces a visible chain of reasoning because the architecture requires it.
                </Sidenote>
              }>
                <p>
                  This pipeline was designed such that every agent has to show
                  their work. This isn&apos;t just a debugging convenience,
                  it&apos;s the evidentiary record itself. This principle comes
                  from a foundational finding in LLM research<NoteArrow /> that
                  language models solve complex problems more reliably when they
                  are forced to produce and recap each intermediate reasoning
                  step. The Detective agent &ldquo;thinks&rdquo; out loud:
                  &ldquo;this Black Book match is surname-only, there&apos;s no
                  first-name, probably just a coincidence,&rdquo; before making a
                  decision.
                </p>
              </SidenoteBlock>
              <SidenoteBlock note={
                <Sidenote
                  title="ReAct Pattern"
                  image="/sidenotes/react-pattern.png"
                  imageAlt="ReAct pattern diagram — Reason Only, Act Only, and combined Reasoning Traces + Actions loop"
                  href="https://arxiv.org/abs/2210.03629"
                  linkText="arxiv.org/abs/2210.03629"
                >
                  Yao et al. (2022). &ldquo;ReAct: Synergizing Reasoning and Acting in Language Models.&rdquo; Agents interleave chain-of-thought reasoning with tool calls, observe results, then reason again.
                </Sidenote>
              }>
                <p>
                  That visible reasoning chain is what the literature calls the
                  ReAct pattern:<NoteArrow /> weaving together reasoning with
                  actions. The Detective reasons about the quality of a match,
                  then acts to search the DOJ library, observes the result,
                  reasons <em>again</em>, and then produces a verdict.
                  Chain-of-thought gets the agent to reason out loud. ReAct goes
                  further, ensuring that observation shapes the next thought. This
                  loop underlies most modern LLM agent systems, and every agent in
                  this pipeline implements some version of this.
                </p>
              </SidenoteBlock>
              <SidenoteBlock note={
                <Sidenote title="OCR Limitations">
                  The DOJ search engine indexes scanned pages via optical character recognition. Handwritten notes, marginalia, and address book entries with non-standard formatting are largely invisible. The system can only find what the OCR can read.
                </Sidenote>
              }>
                <p>
                  It is important to resist the illusion of infallibility. The DOJ
                  search interface is OCR-based,<NoteArrow /> which means handwritten
                  documents &mdash; and there are many in the Epstein
                  archive &mdash; are effectively invisible to the system. Name
                  matching always carries edge cases: &ldquo;Ashley&rdquo; could
                  refer to Ashley Hicks (confirmed in the Black Book with a London
                  address) or Sir Bernard Ashley (the Laura Ashley co-founder,
                  featured in AD, with no documented Epstein connection). Many
                  features from the 1980s and early 1990s do not name homeowners
                  at all, and no amount of computer vision can extract a name that
                  was never printed on the page. The pipeline is also constrained
                  by the documents it can access: if a relationship was never
                  recorded, remains redacted, or has not been released, this
                  system will never discover it.
                </p>
              </SidenoteBlock>
              <SidenoteBlock note={
                <Sidenote
                  title="Dataset: OpenSecrets.org"
                  href="https://www.opensecrets.org"
                  linkText="opensecrets.org"
                >
                  OpenSecrets.org uses structured data pipelines to map political donations and lobbying networks to campaign finance.
                </Sidenote>
              }>
                <p>
                  But what it can do is reliably transform ambiguity into
                  structured, reviewable decisions at a scale no individual
                  researcher could sustain alone. This same pipeline, pointed at a
                  different data set,<NoteArrow /> would run the same way. The question may
                  change but the architecture stays the same.
                </p>
              </SidenoteBlock>
          </div>
        </div>

        <SectionTransition num="4.2" name="multi_agent_system" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.2: MULTI-AGENT SYSTEM
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-2" className="mt-8 scroll-mt-24">
          {/* ── S4.2 Header ── */}
          <div>
            <p className="s-label">SECTION 4.2</p>
            <h3 className="s-title">MULTI-AGENT SYSTEM</h3>
            <p className="s-subtitle">From One Prompt to Seven Agents</p>
          </div>

          {/* ── S2 Body paragraphs (cols 1-4, no maxWidth on wrapper so sidenotes can reach col 5) ── */}
          {/* Uses block flow (not flex) so floated diagrams work — same pattern as S1 */}
          <div
            className="mt-10 text-[15px] leading-[1.8] [&>*+*]:mt-6"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID, maxWidth: "none" }}
          >
            <p style={{ maxWidth: CONTENT_NARROW }}>As a non-software engineer with limited free time and some experience with ChatGPT, your natural first instinct when tackling a problem like this is the simplest. Provide one giant prompt and then sit back and wait for a single end-to-end execution to do everything while you sit back: <em>&ldquo;Find every AD issue since 1988. Here are the DOJ Epstein files. Cross-reference every name, investigate every lead, and return the confirmed connections.&rdquo;</em></p>

            {/* ── Fig. 5: Monolithic diagram (floated left, 2 minor cols — same as S1 Fig. 1) ── */}
            <div
              className="float-left mb-4 mr-6 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/monolithic-diagram.svg?v=7"
                alt="Monolithic single-prompt architecture — one model, one call, six sequential steps, no intermediate state saved, no error recovery"
                className="w-full rounded"
                style={{ border: `1px solid ${BORDER}` }}
              />
              <p
                className="mt-2 text-[8px] tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                <span style={{ color: TEXT_MID }}>Fig. 5</span> — Test 01: Monolithic single-prompt architecture. One model, one call, no intermediate state, no error recovery.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/decentralized-diagram.svg?v=7"
                alt="Decentralized multi-agent architecture — six agents communicating peer-to-peer with shared state, no central authority"
                className="mt-8 w-full rounded"
                style={{ border: `1px solid ${BORDER}` }}
              />
              <p
                className="mt-2 text-[8px] tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                <span style={{ color: TEXT_MID }}>Fig. 6</span> — Test 02: Decentralized multi-agent mesh. Peer-to-peer communication, shared state, no central authority.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hub-spoke-diagram.svg?v=4"
                alt="Hub-and-spoke architecture — Miranda as central editor hub with six specialist agents as spokes, connected via async task queues"
                className="mt-8 w-full rounded"
                style={{ border: `1px solid ${BORDER}` }}
              />
              <p
                className="mt-2 text-[8px] tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                <span style={{ color: TEXT_MID }}>Fig. 7</span> — Test 03: Hub-and-spoke architecture. Central editor coordinates six specialist agents via async task queues.
              </p>
            </div>

            {/* P2 — context window + monolithic IBM link + sidenote */}
            <SidenoteBlock note={
              <Sidenote title="Context Window">
                A context window is the amount of text an AI model can &ldquo;see&rdquo; at once (typically 100,000&ndash;200,000 words). Once full, earlier information is effectively forgotten.
              </Sidenote>
            }>
              <p>In theory, this is straightforward. In practice, it collapses immediately. The context window<NoteArrow /> saturates. The model gets itself stunningly lost chasing loose threads as states become entangled. There are no durable checkpoints, no clean backup points, and the black box nature negates any externalized audit trail. You&rsquo;d have to blindly trust the results&mdash;that&rsquo;s difficult to accept. The results may look coherent, but its operationally opaque. The path from A to B becomes lost, with no meaningful way to replicate or validate the conclusions. While it is simple and <a href="https://www.ibm.com/think/topics/monolithic-architecture" target="_blank" rel="noopener noreferrer" style={{ color: COPPER }}>monolithic</a>, it just doesn&rsquo;t work.</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>The next step is to decompose the problem. Break the monolith model into bounded stages with explicit interfaces, externalize the intermediate states, and allow specialized components to operate concurrently. The user assigns specialized roles: searching, reading, cross-referencing, investigating. But how do these roles interact with each other? My first attempt here was a more decentralized, multi-writer, peer-coordinated agent mesh: each role&mdash;or agent&mdash;communicates with all the others, negotiates their own task ownership, and writes updates to a shared source as conclusions began to emerge. Seemingly chaotic, but it seemed more analogous to how a group of people would collaborate autonomously. However, in practice, for this investigative work, it introduces too much avoidable risk.</p>

            {/* P4 — race conditions sidenote */}
            <SidenoteBlock note={
              <Sidenote title="Race Condition">
                A race condition occurs when two processes try to update the same data simultaneously, and the outcome depends on which one finishes first. The software equivalent of two editors rewriting the same paragraph at the same time.
              </Sidenote>
            }>
              <p>First, multiple writers create the possibility of race conditions<NoteArrow /> via conflicting updates. If two agents attempt to update the same record concurrently, which wins? While peer negotiation diffuses responsibility and obscures which agent introduced an error. In this system, coordination would emerge through negotiation rather than orchestration. Attractive in theory since it reads as more &ldquo;intelligent&rdquo;, but again, in practice introduces additional structural complexity. If the Detective and Researcher disagree about whether a lead merits escalation, who decides? The system architecture must define an explicit resolution mechanism. For this production pipeline processing thousands of names, this expanded coordination and defining an endless list individual rule settings would prove overly complicated and infeasible.</p>
            </SidenoteBlock>

            {/* P5 — hub-and-spoke origin sidenote */}
            <SidenoteBlock note={
              <Sidenote
                title="Hub-and-Spoke"
                image="/sidenotes/fedex-hub-spoke.png"
                imageAlt="FedEx hub-and-spoke route map — Memphis as central hub with spokes radiating to every US city"
              >
                Hub-and-spoke topology was pioneered by FedEx in 1973 and later adopted by the airline industry: every package (or flight) routes through a central hub rather than flying point-to-point. The efficiency gains, and the single point of failure risks, are the same in software.
              </Sidenote>
            }>
              <p>These tensions were resolved by adopting the specific topology architecture of a centrally orchestrated hub-and-spoke.<NoteArrow /> Each agent operates concurrently within a bounded relationship to a central coordinator. Here, all task assignments and all persistent writes flow through the single authoritative coordinator. They alone validate outputs, resolve ambiguities, and commit states to the database. This preserves parallel throughput without introducing multi-writer contention. There are no conflicting updates, no intra-agent negotiations, and no ambiguity about provenance. Every state transition can be attributable to a single decision point.</p>
            </SidenoteBlock>

            {/* ── Why It Works ── */}
            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>Why It Works</p>

            <SidenoteBlock note={
              <Sidenote
                title="Newsroom Structure"
                image="/sidenotes/newsroom-roles.png"
                imageAlt="Newsroom organizational chart showing Editor-in-Chief at the center coordinating section editors, reporters, photographers, and copy desk"
                href="https://training.wkustudentpubs.com/index.php/newsroom-roles/"
                linkText="wkustudentpubs.com/newsroom-roles"
              >
                Newsrooms typically have an editor-in-chief who coordinates and oversees production: assigning stories, reviewing copy, and deciding what runs. Reporters are specialists; no story reaches the reader without passing through editorial.
              </Sidenote>
            }>
              <p className="-mt-2">The metaphor is straightforward: imagine a newsroom<NoteArrow />. Reporters don&rsquo;t directly publish to the front page. They file copy. An editor reviews it, fact checks it, decides if it meets standards, and then either runs it, kills it, or sends it back for revision. The reporters are specialists in their fields. One might cover politics, another crime, another film, but an editor is the single point of contact for all of them. No story hits a reader&rsquo;s eyeballs without the editor&rsquo;s sign-off.</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>The communication mechanism is deliberately simple. Each agent has an inbox, and an outbox. The editor pushes a task, for example: &ldquo;cross-reference these twelve names&rdquo; into the Detective&rsquo;s inbox. The Detective works through them in sequential order, pushes the results into his outbox. The editor collects the results, validates them, writes the verdicts to the database, and then pushes a new tasks: &ldquo;investigate this confirmed lead&rdquo; into the Researcher&rsquo;s inbox. The message-passing is one-to-one. Agents never talk to each other directly. They only talk to the Editor, and she decides what happens next.</p>

            {/* ── Fig. 8: Dataclass code block (floated left, 2 minor cols) ── */}
            <div
              className="float-left mb-4 mr-6 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              <div
                className="overflow-hidden rounded-lg"
                style={{
                  border: `1px solid ${BORDER}`,
                  backgroundColor: "#0d0d14",
                }}
              >
                {/* File tab bar */}
                <div
                  className="flex items-center gap-2 px-4 py-2"
                  style={{ backgroundColor: "#111118", borderBottom: `1px solid ${BORDER}` }}
                >
                  <span className="text-[9px] tracking-wider" style={{ fontFamily: MONO, color: GREEN }}>
                    src/agents/base.py
                  </span>
                </div>
                {/* Code content */}
                <pre
                  className="whitespace-pre-wrap break-words px-5 py-3 text-[11px] leading-[1.75]"
                  style={{ fontFamily: MONO, margin: 0 }}
                >
                  <code>
                    <span style={{ color: "#6B7280" }}>{"# The entire communication protocol\n"}</span>
                    <span style={{ color: "#6B7280" }}>{"\n"}</span>
                    <span style={{ color: "#C792EA" }}>{"@dataclass\n"}</span>
                    <span style={{ color: "#89DDFF" }}>{"class "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"Task"}</span>
                    <span style={{ color: TEXT_LIGHT }}>{":\n"}</span>
                    <span style={{ color: TEXT_LIGHT }}>{"    type"}</span>
                    <span style={{ color: "#89DDFF" }}>{": "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"str"}</span>
                    <span style={{ color: "#6B7280" }}>{"      # "}</span>
                    <span style={{ color: "#546E7A" }}>{'"cross_reference"\n'}</span>
                    <span style={{ color: TEXT_LIGHT }}>{"    goal"}</span>
                    <span style={{ color: "#89DDFF" }}>{": "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"str"}</span>
                    <span style={{ color: "#6B7280" }}>{"      # "}</span>
                    <span style={{ color: "#546E7A" }}>{'"Check these 12 names"\n'}</span>
                    <span style={{ color: TEXT_LIGHT }}>{"    params"}</span>
                    <span style={{ color: "#89DDFF" }}>{": "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"dict"}</span>
                    <span style={{ color: "#6B7280" }}>{"   # "}</span>
                    <span style={{ color: "#546E7A" }}>{"The actual names + evidence\n"}</span>
                    <span style={{ color: "#6B7280" }}>{"\n"}</span>
                    <span style={{ color: "#C792EA" }}>{"@dataclass\n"}</span>
                    <span style={{ color: "#89DDFF" }}>{"class "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"TaskResult"}</span>
                    <span style={{ color: TEXT_LIGHT }}>{":\n"}</span>
                    <span style={{ color: TEXT_LIGHT }}>{"    status"}</span>
                    <span style={{ color: "#89DDFF" }}>{": "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"str"}</span>
                    <span style={{ color: "#6B7280" }}>{"    # "}</span>
                    <span style={{ color: "#546E7A" }}>{'"success" or "failure"\n'}</span>
                    <span style={{ color: TEXT_LIGHT }}>{"    result"}</span>
                    <span style={{ color: "#89DDFF" }}>{": "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"dict"}</span>
                    <span style={{ color: "#6B7280" }}>{"    # "}</span>
                    <span style={{ color: "#546E7A" }}>{"What the agent found\n"}</span>
                    <span style={{ color: TEXT_LIGHT }}>{"    agent"}</span>
                    <span style={{ color: "#89DDFF" }}>{": "}</span>
                    <span style={{ color: "#FFCB6B" }}>{"str"}</span>
                    <span style={{ color: "#6B7280" }}>{"     # "}</span>
                    <span style={{ color: "#546E7A" }}>{"Who did the work"}</span>
                  </code>
                </pre>
              </div>
              <p
                className="mt-1.5 text-[8px] tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                <span style={{ color: TEXT_MID }}>Fig. 8</span> — The entire inter-agent communication protocol. Two dataclasses, six fields.
              </p>
            </div>

            <p style={{ maxWidth: CONTENT_NARROW }}>This solves the issue of contradictory updates by design: if only the Editor writes to the database, there is no possibility of two agents committing conflicting verdicts on the same record. This means the audit trail is never ambiguous about decision making.</p>

            <p style={{ maxWidth: CONTENT_NARROW }}>The system is also modular. For instance, maybe the Detective&rsquo;s methodology needs to change, say, adding a new evidence source beyond the Black Book and DOJ. You&rsquo;d swap out the Detective&rsquo;s code without touching the Researcher, the Editor, or anyone else. The inbox/outbox interface stays the same. The rest of the system doesn&rsquo;t know or care that the Detective now checks three sources instead of two.</p>

            {/* ── The Autonomy Question ── */}
            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>The Autonomy Question</p>

            <SidenoteBlock note={
              <Sidenote
                title="AI Agents in 2025"
                image="/sidenotes/autonomy-robot.png"
                imageAlt="Cartoon robot with open head revealing gears — the autonomy question"
                href="https://theconversation.com/ai-agents-arrived-in-2025-heres-what-happened-and-the-challenges-ahead-in-2026-272325"
                linkText="theconversation.com"
              >
                Von Davier (2025) documents the year AI agents went mainstream. Standardized protocols like MCP and Agent2Agent enabled autonomous tool use at scale, while raising unresolved questions about security, oversight, and control.
              </Sidenote>
            }>
              <p className="-mt-2">As someone now genuinely curious about the role AI agents in software workflows, it is important to be precise about what these agents are and are not. In contemporary discourse, frequently the term &ldquo;agent&rdquo; implies systems that plan autonomously, adapt strategies, and pursue goals with minimal supervision.<NoteArrow /> Current research literature explores architectures with self-directed planning, tool discovery, and even limited forms of self-evolution. Some of those capabilities are real; many remain experimental.</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>The pipeline here is intentionally narrow. Partially intentionally, but also constrained by what&rsquo;s feasible technically. Each agent in this system is a bounded worker receiving a well-defined assignment, executing it according to clear and structured, machine-readable methodology, and then returns a typed result. The agent controls how it performs its task, but the Editor determines what it works on.</p>

            <p style={{ maxWidth: CONTENT_NARROW }}>This distinction reflects a fundamental design tension worth exploring a bit when talking about AI: autonomy versus control.</p>

            {/* P — Candice Bergen + sidenote */}
            <SidenoteBlock note={
              <Sidenote
                title="Autonomy Boundary"
                image="/sidenotes/silicon-valley.jpg"
                imageAlt="Gilfoyle in Silicon Valley S6E6 — the AI's best way to fix the bugs was to get rid of all the software"
                href="https://www.youtube.com/watch?v=m0b_D2JgZgY"
                linkText="youtube.com"
              >
                The example is deliberately absurd to illustrate a real constraint: in a fully autonomous system, the objective function (&ldquo;prove connections&rdquo;) could justify methods the designer never intended.
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  This concept was humorously shown in HBO&rsquo;s <em>Silicon Valley</em>, Season 6, Episode 6: &ldquo;RussFest&rdquo; (2019).
                </p>
                <p className="mt-2 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Notably, in a 2024 paper, an AI agent attempted to modify its own evaluation scripts to give itself higher scores. It was caught and sandboxed, but its self-preservation instincts led it to game its own metrics.
                </p>
                <a href="https://arxiv.org/abs/2408.06292" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  arxiv.org/abs/2408.06292 &rarr;
                </a>
              </Sidenote>
            }>
              <p>A fully autonomous system would not require Miranda. It would ingest issues, extract entities, evaluate evidence, and publish verdicts independently, refining its methods over time. Architectures approximating this model exist in research settings. From a hypothetical, science-fiction example, a fully autonomous, self-evolving Detective agent might conceivably evolve a way to hack into Candice Bergen&rsquo;s private email<NoteArrow /> as an extreme example of proving out a suspected connection to Epstein. Luckily, this can&rsquo;t do that.</p>
            </SidenoteBlock>

            {/* ── Summary ── */}
            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>Summary</p>

            <p className="-mt-2" style={{ maxWidth: CONTENT_NARROW }}>This architecture emerged incrementally rather than being designed upfront. The first version was a single sequential script. It worked for ten issues. It failed at fifty. Throughput collapsed and failure recovery was brittle.</p>

            <p style={{ maxWidth: CONTENT_NARROW }}>The second version decomposed the work into separate agents but allowed each to write to the database independently. The first time two agents updated the same record concurrently, state corrupted. The third version introduced the Editor as the single writer (the &ldquo;hub&rdquo;) and the system stabilized.</p>

            <p style={{ maxWidth: CONTENT_NARROW }}>Each iteration responded to an observed failure mode, not an abstract preference. That pattern reflects a broader reality of building AI systems: you begin with what works, observe where it breaks, and redesign around those breakpoints. This collaborative, iterative approach is personally new to me, but I could see how it reinforcing the theme of &ldquo;AI as creativity enhancer.&rdquo; You need to learn by doing, and in the process, your preconceived notions of feasibility are also expanded. For me, a consistent metric for a successful project is that your curiosity during the process leads you to a place you couldn&rsquo;t have considered when you started out.</p>

            {/* P — Voyager sidenote */}
            <SidenoteBlock note={
              <Sidenote
                title="Autonomous Agents"
                href="https://arxiv.org/abs/2305.16291"
                linkText="arxiv.org"
              >
                Wang et al. (2023), &ldquo;Voyager: An Open-Ended Embodied Agent with Large Language Models.&rdquo; An agent that autonomously writes and refines its own code to master Minecraft without human intervention.
              </Sidenote>
            }>
              <p>Looking forward, it seems reasonable to assume that the boundary between task-constrained agents and more autonomous systems<NoteArrow /> will continue to narrow. Today, the Editor applies fixed editorial rules set by the human (the publication&rsquo;s &ldquo;owner&rdquo; in this analogy?). In principle, the Editor could instead learn the rules over time from accumulated past decisions, similar to how we learn through examples. The Detective queries two evidence sources. Tomorrow, it could discover and integrate new sources autonomously. Each agent&rsquo;s methodology is currently authored by a human. Why couldn&rsquo;t it instead propose, test, and refine its own procedures&mdash;finding new, even better ideas&mdash;to meet the high-level goals I set out?</p>
            </SidenoteBlock>
          </div>

        </div>

        <SectionTransition num="4.3" name="personality_as_architecture" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.3: PERSONALITY AS ARCHITECTURE
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-3" className="mt-8 scroll-mt-24">
          {/* ── S4.3 Header (full width) ── */}
          <div>
            <p className="s-label">SECTION 4.3</p>
            <h3 className="s-title">PERSONALITY AS ARCHITECTURE</h3>
            <p className="s-subtitle">Why do these autonomous AI agents have names, archetypes, and voices?</p>
          </div>

          {/* ── Body text with sidenotes — matching S1-S2 pattern ── */}
          <div
            className="mt-10 text-[15px] leading-[1.8] [&>*+*]:mt-6"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID }}
          >
            <SidenoteBlock note={
              <Sidenote
                title="Anthropomorphism as Fallacy"
                href="https://link.springer.com/article/10.1007/s43681-024-00419-4"
                linkText="springer.com"
              >
                Placani (2024) argues anthropomorphism in AI operates on two levels: as hype, it exaggerates capabilities by attributing human traits to systems that don&rsquo;t possess them; as fallacy, it distorts moral judgments about responsibility, trust, and the status of AI systems.
              </Sidenote>
            }>
              <p>Intentionally or not, you start to personify each agent as being imbued with recognizable human qualities. &ldquo;That little guy is really relentless in checking sources over and over. He literally never tires!&rdquo; This is regardless of the fact that they have neither physical size, gender, nor a biogenetic system. Nevertheless, when our clumsily limited vocabulary is aimed at novel technological concepts, we fall back on archetypes and anthropomorphization.<NoteArrow /> Similar to how we view other humans, we begin to conflate job role with personality, and we build little narratives around them.</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>But what if that instinct isn&rsquo;t just storytelling, what if it actually matters? In this system, the agents aren&rsquo;t answering clean, factual questions; they&rsquo;re actually making thousands of qualitative judgement calls within a shroud of ambiguity. Can a definitive persona become a legible method to encode investigative standards into a system prompt?</p>

            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
              Three Layers of Agency
            </p>

            <p style={{ maxWidth: CONTENT_NARROW }}>If we want to dig into this question, there are actually three layers to uncover. It&rsquo;s worth it to take a minute to unpack each because it speaks to the nature of how the agentic system works.</p>

            <p className="s-item-head">
              <span>Layer 01:</span> The System Prompt IS the Agent
            </p>
            <SidenoteBlock note={
              <Sidenote title="System Prompts">
                The hidden instructions sent alongside every user message. A system prompt defines the model&rsquo;s role, constraints, and behavior. The same base model can act as a research assistant, a code reviewer, or an investigative agent depending on the prompt.
              </Sidenote>
            }>
              <p>When you invoke an AI model in an LLM API (e.g., Claude), you are sending it a system prompt. That&rsquo;s a set of instructions that defines role, constraints, and standards of behavior. For example: &ldquo;You are a research assistant. Read the following text, perform a rigorous critique, and add footnotes where applicable. Be precise.&rdquo; The model&rsquo;s outputs are not generic; they are conditioned by that instruction set.<NoteArrow /></p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>An &ldquo;agent&rdquo; in this pipeline is, at its core, a system prompt plus structured task state. Silas the Detective doesn&rsquo;t exist somewhere as a separate piece of software. He is not a persistent entity. He&rsquo;s a specific set of instructions reused whenever a name needs to be checked against the Epstein files. Elena the Researcher is a whole different set of instructions sent to the same underlying model, but optimized for a different kind of task.</p>

            <p style={{ maxWidth: CONTENT_NARROW }}>So, when we say: &ldquo;the Detective checks a name,&rdquo; what&rsquo;s actually happening is:</p>
            <ol className="ml-6 list-decimal space-y-1" style={{ maxWidth: CONTENT_NARROW }}>
              <li>The orchestrator pulls a homeowner&rsquo;s name from the task queue</li>
              <li>It invokes Claude along with Silas&rsquo; system prompt (his methodology, his evidence standards, his decision rules, etc.) plus the case-specific inputs.</li>
              <li>Claude responds with a structured result shaped by those constraints.</li>
              <li>The orchestrator sends those results along with evidence links and metadata to a central database.</li>
            </ol>

            <p style={{ maxWidth: CONTENT_NARROW }}>This is where personality stops being cosmetic. Silas being anthropomorphized as a typical &ldquo;terse, sardonic, false positives offend him existentially&rdquo; kind-of-guy is actually not just an added sprinkling of decoration on top of a neutral process. The persona becomes behavioral priors encoded as part of his system prompt&mdash;his instructions. In ambiguous cases, those priors change how the agent allocates its attention, what it treats as sufficient evidence, and how readily it escalates for further review, or rejects a match.</p>

            {/* ── Fig. 9: Miranda card — floated left in columns 1-2 ── */}
            <div
              className="float-left mr-6 mb-4 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              <div
                className="flex flex-col items-center rounded border p-6 pb-8"
                style={{
                  backgroundColor: CARD_BG,
                  borderColor: BORDER,
                  borderTop: `2px solid ${COPPER}`,
                }}
              >
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-[220px] w-[160px] flex-shrink-0 object-contain"
                  style={{ imageRendering: "pixelated" }}
                >
                  <source src="https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Editor_Sprite_2.mov?v=2" type='video/mp4; codecs="hvc1"' />
                  <source src="https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Editor_Sprite.webm?v=5" type="video/webm" />
                </video>
                <p className="mt-4 text-[15px] font-bold" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>
                  {editorAgent.name}
                </p>
                <p className="text-[10px] tracking-wider" style={{ fontFamily: MONO, color: COPPER }}>
                  {editorAgent.role.toUpperCase()} &mdash; THE HUB
                </p>
                <p className="mt-3 text-center text-[11px] leading-[1.8]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                  {editorAgent.description}
                </p>
                <div className="mt-4 w-full" style={{ borderTop: `1px solid ${BORDER}` }} />
                <p className="mt-4 text-[10px] leading-[1.7]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Surgically precise and unyielding. Every decision is final &mdash; delivered with the same tonal register whether she&rsquo;s approving a lead or killing a story.
                </p>
                <p className="mt-3 text-[10px] leading-[1.7]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Autocratic and unilateral. She delegates relentlessly without explanation. Her management runs on standards so high they function as fear.
                </p>
                <p className="mt-3 text-[10px] leading-[1.7] italic" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.5)" }}>
                  &ldquo;Details of your incompetence do not interest me.&rdquo;
                </p>
              </div>
              <p className="mt-3 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 9</span> — Miranda, the Editor: every task, verdict, and database write passes through her review.
              </p>

              {/* ── Fig. 10: 6 agent cards — 2×3 grid under Miranda ── */}
              <div className="mt-6 grid grid-cols-2 gap-2">
                {subAgents.map((agent) => (
                  <div
                    key={agent.name}
                    className="flex flex-col items-center rounded border p-3"
                    style={{
                      backgroundColor: CARD_BG,
                      borderColor: BORDER,
                      borderTop: `2px solid ${agent.accent}`,
                    }}
                  >
                    {agent.videoWebm ? (
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="h-[180px] w-[120px] flex-shrink-0 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      >
                        <source src={agent.videoMov} type='video/mp4; codecs="hvc1"' />
                        <source src={agent.videoWebm} type="video/webm" />
                      </video>
                    ) : (
                      <div className="relative h-[180px] w-[120px]">
                        <Image
                          src={agent.sprite}
                          alt={`${agent.name} — ${agent.role}`}
                          fill
                          className="object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                    )}
                    <p
                      className="mt-3 text-[11px] font-bold"
                      style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                    >
                      {agent.name}
                    </p>
                    <p
                      className="text-[10px] tracking-wider"
                      style={{ fontFamily: MONO, color: agent.accent }}
                    >
                      {agent.role.toUpperCase()}
                    </p>
                    <p
                      className="mt-2 flex-1 text-left text-[10px] leading-[1.6]"
                      style={{ fontFamily: MONO, color: TEXT_DIM }}
                    >
                      {agent.description}
                    </p>
                    <p
                      className="mt-3 text-left text-[9px] italic leading-[1.5]"
                      style={{ fontFamily: MONO, color: `${agent.accent}BF` }}
                    >
                      &ldquo;{agent.quote}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 10</span> — The six specialist agents, each with a dedicated language model, archetype, and behavioral constraints encoded through personality.
              </p>
            </div>

            <p className="s-item-head">
              <span>Layer 02:</span> Why a Character Can Beat a Rulebook
            </p>
            <SidenoteBlock note={
              <Sidenote
                title="Why Sam Spade"
                image="/sidenotes/sam-spade.jpg"
                imageAlt="Humphrey Bogart as Sam Spade in The Maltese Falcon (1941)"
                href="https://www.researchgate.net/publication/299938867_Sam_Spade_-_Anatomy_of_a_Private_Investigator"
                linkText="researchgate.net"
              >
                Gulddal (2016) identifies five traits that define Sam Spade as the archetypal PI: appearance, treatment of women, treatment of men, working method, and professional code. Crucially, Spade exploits chaos rather than deciphering clues. His method depends on contingency, not deduction.
              </Sidenote>
            }>
              <p>Here&rsquo;s the technical question: Does it matter that the Detective agent is &ldquo;Silas&rdquo; written as a Sam Spade-style skeptic,<NoteArrow /> rather than a neutral cross-referencing function with a clearly codified checklist of rules?</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>The academic literature is mixed. Measurable effects of personal prompting are highly task-dependent. It won&rsquo;t reliably improve factual accuracy, but in evaluative or subjective settings a personality-driven agent can shift behavior in measurable ways, especially when combined with role diversity in a multi-agent review. Role diversity is important because it can generate intentional disagreement that surfaces different interpretations of policy. That&rsquo;s what this pipeline does: Silas flags, Elena investigates, Miranda adjudicates.</p>

            <SidenoteBlock note={
              <Sidenote
                title={"\u201CPersona \u2260 Accuracy\u201D"}
                href="https://aclanthology.org/2024.findings-emnlp.888/"
                linkText="aclanthology.org"
              >
                Zheng et al. (EMNLP 2024) tested 162 personas across 2,410 factual questions. Persona prompting did not reliably improve correctness, and sometimes hurt it.
              </Sidenote>
            }>
              <p>A 2024 study tested 162 different personas across 2,410 factual questions and found that adding a persona generally does not improve factual accuracy, if anything it&rsquo;s the opposite.<NoteArrow /> If you ask a model, &ldquo;What year was the Treaty of Versailles signed?&rdquo;, a plumber persona versus a historian persona should both come up with 1919. However the historian persona could introduce confident-but-wrong rationalizations (&ldquo;as a historian...&rdquo;), while increasing verbosity and flourishes that increase the surface area for errors.</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>A crucial difference is that this pipeline is not doing Trivial Pursuit style data retrieval. It is doing judgement under ambiguity: is this a real Epstein connection or just someone with the same last name? Does this document reference indicate sustained contact, active coordination, or merely coincidence? And separately: how should a given interior design feature be characterized on a qualitatively interpretative scale (&ldquo;theatrical&rdquo; vs &ldquo;restrained&rdquo;)? Should you send a plumber or a detective to answer those questions?</p>

            <SidenoteBlock note={
              <Sidenote
                title="+16% With Persona Diversity"
                href="https://openreview.net/forum?id=FQepisCUWu"
                linkText="openreview.net"
              >
                Chan et al. &ldquo;ChatEval&rdquo; (ICLR 2024): specialized evaluator agents with diverse personas debating sequentially achieved ~16% higher correlation with human judgment. The improvement vanished when diversity was removed.
              </Sidenote>
            }>
              <p>In these evaluative settings, personas can function as behavioral priors that measurably shift caution, escalation thresholds, and what counts as sufficient evidence. When researchers built multi-agent systems where specialized evaluators with distinct personas debated each other&rsquo;s assessments, they achieved around 16% higher correlation with human judgement as opposed to a single agent evaluation. And critically, this improvement disappeared when the persona diversity was removed.<NoteArrow /> The benefit came specifically from having different agent perspectives shaped by different roles.</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>A concrete example is surname ambiguity. This example was mentioned in Section 01. When the Detective encounters the name &ldquo;Coppola,&rdquo; the system must distinguish director Francis Ford (the AD subject) from the other Coppolas appearing throughout the DOJ materials. The prompt that frames the Detective as skeptical, in fact: &ldquo;false positives deeply offend him,&rdquo; biases the agent toward disambiguation: pause, seek additional context, and reject matches that do not clear an evidentiary bar. A binary factual lookup would rubber stamp &ldquo;Coppola&rdquo; as a connection match. This is making judgements and weighing limited evidence, exactly where persona design matters.</p>

            <SidenoteBlock note={
              <Sidenote title="Structured Disagreement">
                Wang et al. (NAACL 2024) found that multi-persona collaboration reduced hallucinations while maintaining reasoning, though only in GPT-4-class models. The value is in the structured interaction, not any single persona.
              </Sidenote>
            }>
              <p>Finally, persona becomes more powerful when it is composed across roles. A growing thread of research shows that multiple specialized personas interacting and debating, reviewing each other&rsquo;s work, and even bantering together can outperform any single persona operating alone.<NoteArrow /> The value is that different roles surface different failure modes, and the system forces disagreement to resolve into a single, auditable verdict.</p>
            </SidenoteBlock>

            <p className="s-item-head">
              <span>Layer 03:</span> What&rsquo;s Creative Expression vs Technical Function
            </p>
            <p style={{ maxWidth: CONTENT_NARROW }}>It helps here to separate what is operational (i.e., actually changes model behavior and system outputs) from what is representational (i.e., improves legibility, usability, and human understanding without materially changing the underlying decisions).</p>

            <p
              className="mt-2 underline"
              style={{ maxWidth: CONTENT_NARROW }}
            >
              Technically Functional (behavior-shaping):
            </p>
            <ul className="ml-6 list-disc space-y-2" style={{ maxWidth: CONTENT_NARROW }}>
              <li><strong>Role separation with distinct methods.</strong> Each agent has a bounded mandate with a different procedure (Detective checks Black Book + DOJ; Researcher performs a multi-step investigation; Editor applies evidentiary policy, etc.). This is a separation of concerns applied to LLM systems. Empirically, structured role-based collaboration tends to outperform single-agent approaches when dealing with complex, multi-stage tasks.</li>
              <li><strong>Task-aligned behavioral priors.</strong> The agents&rsquo; &ldquo;personalities&rdquo; are prompt-level priors tuned to their specific task within the system (skeptical Detective, relentless Researcher, demanding Editor). For evaluative tasks such as this one, carefully designed priors can improve edge-case handling by shifting escalation thresholds and minimizing false-positive tolerance. Generic or poorly matched personas could hurt more than help.</li>
              <li><strong>Heterogeneous model allocation.</strong> The Editor uses a stronger model tier for quality-critical review (Opus) and a faster (less expensive) tier for routine routing (Sonnet). Mixing model capabilities across roles can outperform homogeneous assignment for certain tasks.</li>
              <li><strong>Reflection and feedback loops.</strong> The Editor periodically audits past decisions and generates targeted feedback to other agents that updates downstream behavior. Structured reflection mechanisms can reduce cascading errors in multi-agent pipelines.</li>
            </ul>

            <p
              className="mt-4 underline"
              style={{ maxWidth: CONTENT_NARROW }}
            >
              Primarily Representational (but Still Valuable!):
            </p>
            <ul className="ml-6 list-disc space-y-2" style={{ maxWidth: CONTENT_NARROW }}>
              <li><strong>Specific archetypes as mnemonic compression.</strong> The specific archetypes (Sam Spade, Miranda Priestly, Andrew Neiman) are memorable shorthands for complex instruction sets. A different set of archetypes with the same underlying instructions would produce similar pipeline results.</li>
              <li><strong>Visual identity and narrative framing.</strong> Sprites, backstories, and a UI voice make the project easier to understand and give additional legibility to the overall system, even if they do not materially change the evidentiary logic.</li>
              <li><strong>In-character interaction as a developer tool.</strong> The in-character conversations (&ldquo;talking to Miranda as Miranda&rdquo;) can be useful for debugging and iteration, even when separated from the autonomous execution path.</li>
            </ul>

            {/* ── Fig. 11: Miranda Chatbox — floated left, 2 minor columns ── */}
            <div
              className="float-left mr-6 mb-6 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              <div
                className="overflow-hidden rounded border"
                style={{
                  backgroundColor: CARD_BG,
                  borderColor: BORDER,
                  borderTop: `2px solid ${COPPER}`,
                }}
              >
                <div className="px-4 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <p className="text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                    {"// EDITOR CHAT — DEBUGGING VERDICTS"}
                  </p>
                </div>
                <div className="flex flex-col gap-3 px-4 py-4">
                  {/* Human bubble — cool gray, caret left */}
                  <div className="relative mr-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div className="absolute top-3 -left-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "5px solid rgba(255,255,255,0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: TEXT_DIM }}>HUMAN</p>
                    <p className="mt-1 text-[11px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_MID }}>Miranda, why did you mark this as CONFIRMED? It feels too generous.</p>
                  </div>
                  {/* Miranda bubble — copper tint, caret right */}
                  <div className="relative ml-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(184, 115, 51, 0.06)" }}>
                    <div className="absolute top-3 -right-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "5px solid rgba(184, 115, 51, 0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: COPPER }}>MIRANDA (EDITOR)</p>
                    <p className="mt-1 text-[11px] italic leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>&ldquo;Feels&rdquo; is not evidence. Bring me a rule, or bring me nothing.</p>
                  </div>
                  <div className="relative mr-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div className="absolute top-3 -left-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "5px solid rgba(255,255,255,0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: TEXT_DIM }}>HUMAN</p>
                    <p className="mt-1 text-[11px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_MID }}>The DOJ search returns 200+ hits, but most are incidental mentions.</p>
                  </div>
                  <div className="relative ml-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(184, 115, 51, 0.06)" }}>
                    <div className="absolute top-3 -right-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "5px solid rgba(184, 115, 51, 0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: COPPER }}>MIRANDA</p>
                    <p className="mt-1 text-[11px] italic leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Then your rubric is sloppy. Decide: do mentions count, or do we require direct contact?</p>
                  </div>
                  <div className="relative mr-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div className="absolute top-3 -left-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "5px solid rgba(255,255,255,0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: TEXT_DIM }}>HUMAN</p>
                    <p className="mt-1 text-[11px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_MID }}>Direct contact only&mdash;scheduling, correspondence, or a Black Book entry with disambiguating detail.</p>
                  </div>
                  <div className="relative ml-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(184, 115, 51, 0.06)" }}>
                    <div className="absolute top-3 -right-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "5px solid rgba(184, 115, 51, 0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: COPPER }}>MIRANDA</p>
                    <p className="mt-1 text-[11px] italic leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Good. Write it down: CONFIRMED = (A) direct contact evidence + (B) one independent corroboration source. Mentions alone become LEAD, not CONFIRMED.</p>
                  </div>
                  <div className="relative mr-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div className="absolute top-3 -left-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "5px solid rgba(255,255,255,0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: TEXT_DIM }}>HUMAN</p>
                    <p className="mt-1 text-[11px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_MID }}>And surname-only Black Book entries?</p>
                  </div>
                  <div className="relative ml-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(184, 115, 51, 0.06)" }}>
                    <div className="absolute top-3 -right-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "5px solid rgba(184, 115, 51, 0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: COPPER }}>MIRANDA</p>
                    <p className="mt-1 text-[11px] italic leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Auto-downgrade. Surname-only is a false-positive factory. Full-name match or additional identity evidence before escalation.</p>
                  </div>
                  <div className="relative mr-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div className="absolute top-3 -left-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "5px solid rgba(255,255,255,0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: TEXT_DIM }}>HUMAN</p>
                    <p className="mt-1 text-[11px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_MID }}>Understood. I&rsquo;ll update the Detective rubric and re-run the last batch.</p>
                  </div>
                  <div className="relative ml-4 rounded-sm py-2 pr-2 pl-3" style={{ backgroundColor: "rgba(184, 115, 51, 0.06)" }}>
                    <div className="absolute top-3 -right-[5px]" style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "5px solid rgba(184, 115, 51, 0.06)" }} />
                    <p className="text-[9px] font-bold" style={{ fontFamily: MONO, color: COPPER }}>MIRANDA</p>
                    <p className="mt-1 text-[11px] italic leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>And log the delta. If your false positives don&rsquo;t drop, don&rsquo;t blame policy&mdash;fix retrieval.</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 11</span> &mdash; Debugging verdict policy through in-character conversation with the Editor agent.
              </p>
            </div>

            <p className="mt-6" style={{ maxWidth: CONTENT_NARROW }}>In short, the creative layer makes the system legible to humans, while the functional layer governs behavior. The key insight is that the technical value is derived from the discipline required to carefully design each of them. This can be a valuable lesson. As agentic workflows become more widespread, the quality of the persona design and storytelling could become a valuable artistic contribution and a potentially new discipline.</p>

            <SidenoteBlock note={
              <Sidenote title="Prompt Engineering">
                The practice of crafting input text to steer a language model&rsquo;s output. Techniques range from simple (&ldquo;answer in JSON&rdquo;) to structured (chain-of-thought, few-shot examples). It optimizes how you talk to a model, not what the model is.
              </Sidenote>
            }>
              <p>I want to linger on &ldquo;artistic&rdquo; for a moment since that is a contentious topic in relation to artificial intelligence, and I don&rsquo;t mean it loosely. What I&rsquo;m describing is somewhat related to prompt engineering,<NoteArrow /> but it goes beyond that. Prompt engineering is tactical: knowing the rhetorical tricks to make a model&rsquo;s output more accurate, more structured, or more consistent. &ldquo;Explain your reasoning step by step, then give your final answer.&rdquo; It&rsquo;s a technique for speaking to a machine that you can learn in an afternoon.</p>
            </SidenoteBlock>

            <p style={{ maxWidth: CONTENT_NARROW }}>However, designing agent personas is something fundamentally different. It&rsquo;s determining the ideal mind to apply to a problem, and then having the narrative capacity and skill to coherently create one.</p>

            <p style={{ maxWidth: CONTENT_NARROW, fontWeight: 700, color: TEXT_LIGHT }}>
              It is designing minds.
            </p>

            <p style={{ maxWidth: CONTENT_NARROW }}>When Miranda became demanding and autocratic, I was making engineering decisions about how strict to dial in the editorial review threshold. When Silas became terse and skeptical, I was tuning the system toward aggressive false-positive aversion. The character design process forced a deeper articulation toward what each stage of the pipeline should optimize for, and the resulting rich personas became a human-readable wrapper for encoding policy into engineering decisions. The character design forced me to articulate system requirements that a spec sheet would have left vague, and it forced me to coordinate them coherently, a unified behavioral perspective rather than a list of disconnected rules.</p>

            <p style={{ maxWidth: CONTENT_NARROW }}>This feels like a genuinely new type of creative work. It&rsquo;s not screenwriting since these characters are performing for no audience. It&rsquo;s not game design&mdash;they don&rsquo;t really interact with me willingly. The character writing is expressed through structured data outputs in an automated pipeline. The craft comes in how to map traits to behavioral priors that meaningfully change system outcomes.</p>

            <SidenoteBlock note={
              <Sidenote
                title={"Origin of \u201CUser Experience\u201D"}
                href="https://jnd.org/where-did-the-term-user-experience-ux-come-from/"
                linkText="jnd.org"
              >
                Don Norman coined the term in 1993 at Apple, where he became the first &ldquo;User Experience Architect.&rdquo; He chose the phrase because &ldquo;human interface and usability were too narrow. I wanted to cover all aspects of the person&rsquo;s experience with a system.&rdquo;
              </Sidenote>
            }>
              <p>In engineering, it used to be &ldquo;can you build a system that works?&rdquo; That position has become increasingly commodified by artificial intelligence systems that can now create their own scaffolding. The new bottleneck is now: can you specify what a system should do within ambiguous scenarios where there&rsquo;s no objectively &ldquo;correct&rdquo; answer. That turns out to be a specification problem, not a coding problem. And narrative, with all its complex, messy challenges around character, archetype, and voice, is a surprisingly effective specification language for it. Two decades ago, the software industry woke up to the fact that how humans experience a system is its own design discipline, and the UX designer was born.<NoteArrow /> Now, we are on the cusp of a new, as yet unnamed role. It&rsquo;s a careful blend of psychology, narrative, and systems thinking, but it is real, and the people developing it will be doing something that didn&rsquo;t exist five years ago.</p>
            </SidenoteBlock>

            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
              Where It All Becomes Visible
            </p>

            <SidenoteBlock note={
              <Sidenote
                title="Pixel Art as Interface"
                image="/sidenotes/pixel-art.jpg"
                imageAlt="Isometric pixel art structures — eBoy-style digital architecture"
                href="https://www.rightclicksave.com/article/pixel-art-and-the-age-of-technostalgia"
                linkText="rightclicksave.com"
              >
                Kent (2023) interviews seven pixel artists who argue the medium persists not from nostalgia alone but from constraint-driven clarity. As eBoy puts it: &ldquo;Pixels are the atoms of our universe, making them a logical choice&rdquo; for digital-native creation. The low-resolution aesthetic communicates tangible, hands-on interaction in contrast to algorithmic opacity.
              </Sidenote>
            }>
              <p>That same principle shaped the interface. The pipeline runs autonomously, but the capacity to observe an autonomous system requires a purpose-built UI. To make the workflow legible and inspectable in real time, I built the &ldquo;Agent Office:&rdquo;<NoteArrow /> a live, pixel-art dashboard where each of the seven agents occupies a desk in a shared office, driven directly by the backend pipeline JSON state. When Miranda assigns a task, her speech bubble updates. When Silas returns a verdict, it appears on screen. This &ldquo;cartoon&rdquo; layer doesn&rsquo;t make the system more accurate&mdash;but it makes the system watchable: a visual map of task flow, accountability, and progress that lets a human understand what the architecture is doing as it runs.</p>
            </SidenoteBlock>

            {/* Agent Office video — float left, 4 minor columns */}
            <div
              className="float-left mr-6 mb-6 hidden md:block"
              style={{ width: "calc(4 * (100% - 5 * 24px) / 6 + 3 * 24px)" }}
            >
              <video
                autoPlay
                muted
                loop
                playsInline
                controls
                className="w-full rounded border"
                style={{
                  borderColor: BORDER,
                  backgroundColor: "rgba(17, 17, 24, 0.8)",
                }}
              >
                <source
                  src="https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/agent-office.mp4"
                  type="video/mp4"
                />
              </video>
              <a
                href="https://www.wheretheylive.world/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-3 rounded-sm px-5 py-3 text-[13px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-white/10"
                style={{
                  fontFamily: MONO,
                  color: TEXT_LIGHT,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <span style={{ fontSize: "14px", lineHeight: 1 }}>&#9654;</span>
                View live demo &rarr;
              </a>
              <div className="relative">
                <p
                  className="mt-3 text-[8px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  <span style={{ color: TEXT_MID }}>Fig. 12</span> &mdash; The Agent Office: a real-time pixel-art dashboard<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> showing autonomous AI coordination as it happens.
                </p>
                <div
                  className="absolute z-10 hidden pl-4 md:block"
                  style={{
                    top: 0,
                    left: "calc(100% + 24px)",
                    width: "calc((100vw - var(--grid-max-width)) / 2 + var(--grid-max-width) - 100% - var(--grid-margin) - 24px)",
                    maxWidth: "200px",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    Technostalgia
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Van der Heijden (2015) describes &ldquo;technostalgia&rdquo; as the re-appropriation of obsolete technology aesthetics in contemporary media. The 8-bit visual language invites inspection rather than intimidation.
                  </p>
                  <a href="https://necsus-ejms.org/technostalgia-present-technologies-memory-memory-technologies/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    necsus-ejms.org &rarr;
                  </a>
                </div>
              </div>
            </div>

            <p style={{ maxWidth: CONTENT_NARROW }}>As AI agents feel more &ldquo;alive,&rdquo; perhaps the human instinct will be to reach for an even higher vantage point from which to look down upon and assert our control: an operations room, a dashboard, a god&rsquo;s-eye view. Like an officious middle manager, our intrusiveness will become inversely proportional to the actual autonomy of the system. The Agent Office leans into that voyeuristic compulsion. It turns an autonomous pipeline into something to observe, question, and interrupt&mdash;an interface that restores some semblance of agency to the observer. There is a reason for the prominent &ldquo;Send a Message to the Editor&rdquo; chat box.</p>

            <p
              style={{
                maxWidth: CONTENT_NARROW,
                fontFamily: MONO,
                fontSize: "15px",
                fontWeight: 700,
                lineHeight: 1.6,
                color: TEXT_LIGHT,
              }}
            >
              Autonomy doesn&rsquo;t remove the human from the system. It changes the role from operator to overseer.
            </p>

            <p style={{ maxWidth: CONTENT_NARROW }}>As AI systems legitimately increase in independence, the urgency shifts to monitoring and accountability: whether we build interfaces that keep us meaningfully in control, or accept a future where we grasp at smoke becoming passive spectators to processes we no longer fully understand.</p>

            <div style={{ clear: "both" }} />
          </div>
        </div>

        <SectionTransition num="4.4" name="investigation_methodology" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.4: INVESTIGATION METHODOLOGY
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-4" className="mt-8 scroll-mt-24">
          <div>
            <p className="s-label">SECTION 4.4</p>
            <h3 className="s-title">INVESTIGATION METHODOLOGY</h3>
            <p className="s-subtitle">How a name match becomes a confirmed connection &mdash; or gets rejected.</p>
          </div>

          {/* ── Body text — text-flow matching S3 pattern ── */}
          <div
            className="mt-10 text-[15px] leading-[1.8] [&>*+*]:mt-6"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID }}
          >
            {/* ── Sankey — 4 minor columns wide, floated left ── */}
            <div
              className="float-left mr-6 mb-6 hidden md:block"
              style={{ width: "calc(4 * (100% - 5 * 24px) / 6 + 3 * 24px)" }}
            >
              <div
                className="overflow-hidden rounded border"
                style={{ backgroundColor: "#111118", borderColor: BORDER }}
              >
                <div className="px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <p className="text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                    {"// INVESTIGATION FUNNEL — LIVE DATA"}
                  </p>
                </div>
                {stats ? (
                  <VerdictSankey
                    featuresTotal={stats.features.total}
                    crossRefsTotal={stats.crossReferences.total}
                    dossiersTotal={stats.dossiers.total}
                    confirmed={stats.dossiers.confirmed}
                    rejected={stats.dossiers.rejected}
                    tierToConfirmed={stats.dossiers.tierToConfirmed}
                    tierToRejected={stats.dossiers.tierToRejected}
                    strengthCounts={stats.dossiers.strengthCounts}
                  />
                ) : (
                  <div className="flex h-[600px] items-center justify-center">
                    <p className="text-[10px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                      LOADING PIPELINE DATA...
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 13</span> &mdash; Investigation funnel showing how features are filtered through cross-referencing, detective triage, researcher dossiers, and editorial review.
              </p>
            </div>

            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>Finding a name in both Architectural Digest and the Epstein records is only the beginning. The pipeline applies a multi-stage verification process before any connection is confirmed. Of the approximately 2,200 names cross-referenced by the Detective, 134 survived the full pipeline to become confirmed connections &mdash; a rejection rate of over 93%. That number reflects deliberate conservatism, not matching quality: the initial candidate set is intentionally broad (every named homeowner against every Epstein record), and the pipeline&rsquo;s job is to narrow aggressively. The better measure of system integrity is what happened when every rejection was audited: of 154 Editor-terminal REJECTED dossiers, 151 were correctly dismissed. Three were wrong. That is a 98% accuracy rate on terminal rejections<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> &mdash; and the three errors were caught precisely because the audit exists.</p>
              <div
                className="absolute bottom-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  98% Rejection Accuracy
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  ~2,200 names cross-referenced. 134 confirmed. 154 rejected, of which 151 were correct dismissals. ProPublica&rsquo;s 2016 COMPAS investigation found that false-positive rates in classification systems have measurable downstream consequences.
                </p>
                <a href="https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  propublica.org &rarr;
                </a>
              </div>
            </div>

            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>The process begins with automated cross-referencing. The Detective searches two sources sequentially (local Black Book lookup, then DOJ search): Epstein&rsquo;s Little Black Book,<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> a ~95-page contact directory recovered during the investigations, and the DOJ&rsquo;s Full Epstein Library, a searchable database spanning hundreds of thousands of pages of released documents. Each name is assigned one of four routing tiers:<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span></p>
              <p className="mt-4 text-[13px]" style={{ fontFamily: MONO, color: TEXT_DIM, maxWidth: CONTENT_NARROW }}>
                These tiers are routing decisions as much as classifications: they determine what the pipeline does next.
              </p>
              <div style={{ maxWidth: CONTENT_NARROW, marginTop: "1rem" }}>
                {/* STRONG MATCH */}
                <div className="flex gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span className="shrink-0 rounded-sm text-center text-[8px] font-bold tracking-wider leading-tight" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN, width: "88px", paddingTop: "5px", paddingBottom: "5px" }}>STRONG<br/>MATCH</span>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] leading-[1.7]" style={{ color: TEXT_MID }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>SIGNAL </span>
                      Direct, attributable contact evidence: a structured Black Book entry with full name and phone numbers, or DOJ documents showing direct interaction with identity resolved (e.g., emails to/from Epstein, scheduled appointments, guest lists, dining records with full name and corroborating context).
                    </p>
                    <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>ACTION </span>
                      Routed for dossier construction and editorial review as a high-priority match (not published until Editor sign-off).
                    </p>
                  </div>
                </div>
                {/* LIKELY */}
                <div className="flex gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span className="shrink-0 rounded-sm text-center text-[9px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: COPPER_DIM, color: COPPER, width: "88px", paddingTop: "5px", paddingBottom: "5px" }}>LIKELY</span>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] leading-[1.7]" style={{ color: TEXT_MID }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>SIGNAL </span>
                      Multiple independent references consistent with interaction, but lacking a single definitive artifact.
                    </p>
                    <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>RISK </span>
                      Evidence may be indirect or incomplete; requires contextual validation.
                    </p>
                    <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>ACTION </span>
                      Routed to the Researcher for dossier-level investigation.
                    </p>
                  </div>
                </div>
                {/* POSSIBLE */}
                <div className="flex gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span className="shrink-0 rounded-sm text-center text-[9px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: "rgba(160,160,176,0.08)", color: TEXT_DIM, width: "88px", paddingTop: "5px", paddingBottom: "5px" }}>POSSIBLE</span>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] leading-[1.7]" style={{ color: TEXT_MID }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>SIGNAL </span>
                      Weak or ambiguous signals &mdash; common-name hits, surname-only matches, or unclear document context.
                    </p>
                    <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>RISK </span>
                      High false-positive rate. The vast majority of surname-only matches resolve as collisions.
                    </p>
                    <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>ACTION </span>
                      Routed through the same investigation pipeline as STRONG MATCH and LIKELY, but with a high rate of early COINCIDENCE exits during triage.
                    </p>
                  </div>
                </div>
                {/* NO MATCH */}
                <div className="flex gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
                  <span className="shrink-0 rounded-sm text-center text-[9px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED, width: "88px", paddingTop: "5px", paddingBottom: "5px" }}>NO MATCH</span>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] leading-[1.7]" style={{ color: TEXT_MID }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>SIGNAL </span>
                      No relevant evidence found in the available sources.
                    </p>
                    <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>ACTION </span>
                      Closed as NO MATCH unless new evidence sources are added or a later audit triggers re-review.
                    </p>
                  </div>
                </div>
              </div>
              {/* Black Book sidenote — top of margin */}
              <div
                className="absolute top-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  The Black Book
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  A ~95-page contact directory obtained by Epstein employee Alfredo Rodriguez, who attempted to sell it for $50,000 in 2009. The FBI intercepted it in a sting operation. It was admitted as Government Exhibit 52 in U.S. v. Maxwell, though its authenticity was contested by the defense.
                </p>
                <a href="https://time.com/6124510/ghislaine-maxwell-trial-little-black-book/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  TIME: Maxwell&rsquo;s Black Book &rarr;
                </a>
              </div>
              {/* Network Analysis sidenote — offset below Black Book */}
              <div
                className="absolute z-10 hidden pl-4 md:block"
                style={{
                  top: "14em",
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  Network Analysis from Contact Records
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Using contact directories to map social networks is established investigative methodology. The FBI&rsquo;s own Law Enforcement Bulletin describes Social Network Analysis (SNA) as a &ldquo;systematic approach for investigating,&rdquo; mapping ties between actors from seized records, phone logs, and contact books.
                </p>
                <a href="https://leb.fbi.gov/articles/featured-articles/social-network-analysis-a-systematic-approach-for-investigating" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  FBI Law Enforcement Bulletin &rarr;
                </a>
              </div>
            </div>

            {/* ── Routing rule ── */}
            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
              Routing
            </p>
            <p style={{ maxWidth: CONTENT_NARROW, marginTop: "1rem" }}>The Detective&rsquo;s four tiers are routing decisions, not final outcomes. They determine what happens next.</p>
            <ul style={{ maxWidth: CONTENT_NARROW, paddingLeft: "1.25rem", listStyleType: "disc", marginTop: "1rem" }}>
              <li className="text-[15px] leading-[1.8]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID }}><span style={{ fontWeight: 600, color: TEXT_LIGHT }}>STRONG MATCH</span> and <span style={{ fontWeight: 600, color: TEXT_LIGHT }}>LIKELY</span> are automatically routed to the Researcher for dossier construction.</li>
              <li className="mt-1 text-[15px] leading-[1.8]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID }}><span style={{ fontWeight: 600, color: TEXT_LIGHT }}>POSSIBLE</span> is routed through the same Researcher pipeline, but the triage step produces a high rate of COINCIDENCE dismissals. Only cases where the Researcher resolves identity to a specific individual proceed to full dossier construction.</li>
              <li className="mt-1 text-[15px] leading-[1.8]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID }}><span style={{ fontWeight: 600, color: TEXT_LIGHT }}>NO MATCH</span> is terminal at the Detective stage unless reopened by a later audit or new evidence sources.</li>
            </ul>
            <p style={{ maxWidth: CONTENT_NARROW, marginTop: "1.5rem" }}>From there, routed cases resolve to CONFIRMED or REJECTED. PENDING_REVIEW is used only when the Editor&rsquo;s automated review fails or a case is explicitly escalated for human adjudication. Names classified as NO MATCH by the Detective never enter the Researcher pipeline and remain closed unless reopened.</p>

            {/* ── Terminal states ── */}
            <div style={{ maxWidth: CONTENT_NARROW, marginTop: "1.5rem" }}>
              {/* CONFIRMED (terminal) */}
              <div className="flex gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                <span className="shrink-0 rounded-sm text-center text-[9px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN, width: "88px", paddingTop: "5px", paddingBottom: "5px" }}>CONFIRMED</span>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[14px] leading-[1.7]" style={{ color: TEXT_MID }}>
                    A connection meets the evidentiary threshold after investigation and editorial adjudication. This can occur when the Detective tier is STRONG MATCH and the dossier corroborates it, or when Researcher work elevates a LIKELY/POSSIBLE case with sufficient evidence. Published to the public index with a full evidence trail and the Researcher&rsquo;s strength assessment (<span style={{ fontWeight: 600 }}>HIGH</span> / <span style={{ fontWeight: 600 }}>MEDIUM</span> / <span style={{ fontWeight: 600 }}>LOW</span>).
                  </p>
                  <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM, fontStyle: "italic" }}>
                    Strength reflects how direct and corroborated the documentary evidence is&mdash;not what the relationship implies.
                  </p>
                </div>
              </div>
              {/* REJECTED (terminal) */}
              <div className="flex gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
                <span className="shrink-0 rounded-sm text-center text-[9px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED, width: "88px", paddingTop: "5px", paddingBottom: "5px" }}>REJECTED</span>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[14px] leading-[1.7]" style={{ color: TEXT_MID }}>
                    Evidence was investigated but did not meet the confirmation standard.
                  </p>
                  <p className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                    <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>TRIAGE DISMISSAL (PRE-EDITOR) </span>
                    <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>COINCIDENCE</span> &mdash; near-certain collision or identity mismatch. The Researcher dismisses as <span style={{ fontFamily: MONO, fontSize: "12px" }}>no_match</span> before the case reaches the Editor.
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                    <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>EDITORIAL REJECTIONS (TERMINAL) </span>
                  </p>
                  <ul style={{ paddingLeft: "1.25rem", listStyleType: "disc" }}>
                    <li className="text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>ADVERSARIAL </span>
                      Negative context (dislike, dispute, hostile reference) rather than social proximity.
                    </li>
                    <li className="mt-0.5 text-[13px] leading-[1.6]" style={{ color: TEXT_DIM }}>
                      <span style={{ color: TEXT_LIGHT, fontFamily: MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>INSUFFICIENT </span>
                      Non-zero evidence, but below threshold for direct interaction.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <SidenoteBlock className="mt-8" note={
              <Sidenote title="Confirmed &ne; Guilty">
                &ldquo;Confirmed connection&rdquo; means documented proximity: contact entries, dining records, guest lists, correspondence. It does not imply wrongdoing or a personal relationship with Epstein.
              </Sidenote>
            }>
              <p>&ldquo;Confirmed&rdquo;<NoteArrow /> means documented proximity &mdash; contact entries, dining records, guest lists, correspondence &mdash; not implication of wrongdoing. This standard is applied consistently across every decision, regardless of the person&rsquo;s fame, wealth, or public profile. The Editor is the only agent authorized to write terminal states to the database.</p>
            </SidenoteBlock>

            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
              Editorial Adjudication
            </p>
            <p className="text-[15px] leading-[1.8]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID, maxWidth: CONTENT_NARROW, marginTop: "1rem" }}>The Editor is the system&rsquo;s single-writer gate. She does not compute the dossier&rsquo;s strength rating; she consumes it. After the Researcher synthesizes evidence into a dossier and assigns a connection strength (HIGH / MEDIUM / LOW / COINCIDENCE), the Editor evaluates identity resolution, evidence sufficiency, and policy compliance, then writes the terminal verdict&mdash;CONFIRMED, REJECTED, or PENDING_REVIEW&mdash;to the database with reasoning and timestamps. Strength is preserved verbatim as the Researcher&rsquo;s assessment, while the Editor&rsquo;s verdict is the authoritative outcome.</p>
            <p className="text-[15px] leading-[1.8]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID, maxWidth: CONTENT_NARROW, marginTop: "1rem" }}>The Editor can also queue overrides to Detective tiers (e.g., <span style={{ fontFamily: MONO, fontSize: "12px" }}>likely_match</span> &rarr; <span style={{ fontFamily: MONO, fontSize: "12px" }}>no_match</span>) via a persisted override file, which the Detective applies on its next cycle.</p>

            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
              Three Case Studies
            </p>

            {/* ── Fig. 14: Verdict Flow — floated left, 2 minor columns, with human sidebar ── */}
            <div
              className="float-left mr-6 mb-4 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              <div className="overflow-hidden rounded border" style={{ backgroundColor: "#111118", borderColor: BORDER }}>
                <div className="px-2 py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <p className="text-[8px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                    {"// VERDICT PIPELINE"}
                  </p>
                </div>
                <div className="flex">
                  {/* Left: vertical pipeline */}
                  <div className="flex flex-1 flex-col items-center px-3 py-3">
                    {/* Stage 1: Name Extracted */}
                    <div className="w-full rounded border px-2 py-1.5 text-center" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                      <p className="text-[7px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>NAME EXTRACTED</p>
                    </div>
                    <div className="h-3 w-px" style={{ backgroundColor: BORDER }} />
                    {/* Stage 2: Two sources */}
                    <div className="flex w-full gap-1">
                      <div className="flex-1 rounded border px-1 py-1 text-center" style={{ backgroundColor: CARD_BG, borderColor: GOLD_DIM }}>
                        <p className="text-[6px] font-bold tracking-[0.1em]" style={{ fontFamily: MONO, color: GOLD }}>BLACK BOOK</p>
                      </div>
                      <div className="flex-1 rounded border px-1 py-1 text-center" style={{ backgroundColor: CARD_BG, borderColor: GOLD_DIM }}>
                        <p className="text-[6px] font-bold tracking-[0.1em]" style={{ fontFamily: MONO, color: GOLD }}>DOJ LIBRARY</p>
                      </div>
                    </div>
                    <div className="h-3 w-px" style={{ backgroundColor: BORDER }} />
                    {/* Stage 3: Detective — routing tiers */}
                    <div className="w-full rounded border px-2 py-1.5 text-center" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                      <p className="text-[7px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>DETECTIVE</p>
                      <p className="text-[4.5px] tracking-[0.08em]" style={{ fontFamily: MONO, color: TEXT_DIM }}>routing tiers</p>
                      <div className="mt-1 flex flex-wrap justify-center gap-px">
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}>STRONG</span>
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: COPPER_DIM, color: COPPER }}>LIKELY</span>
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: "rgba(160,160,176,0.08)", color: TEXT_DIM }}>POSSIBLE</span>
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}>NO MATCH</span>
                      </div>
                    </div>
                    <div className="h-3 w-px" style={{ backgroundColor: BORDER }} />
                    {/* Stage 4: Researcher — dossier construction + strength assignment */}
                    <div className="w-full rounded border px-2 py-1.5 text-center" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                      <p className="text-[7px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>RESEARCHER</p>
                      <p className="text-[4.5px] tracking-[0.08em]" style={{ fontFamily: MONO, color: TEXT_DIM }}>dossier construction + strength assignment</p>
                      <div className="mt-1 flex justify-center gap-0.5">
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}>HIGH</span>
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: "rgba(184, 115, 51, 0.08)", color: COPPER }}>MED</span>
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: "rgba(184, 134, 11, 0.08)", color: GOLD }}>LOW</span>
                        <span className="rounded-sm px-1 py-px text-[5px]" style={{ fontFamily: MONO, backgroundColor: "rgba(160,160,176,0.08)", color: TEXT_DIM }}>COINC.</span>
                      </div>
                    </div>
                    <div className="h-3 w-px" style={{ backgroundColor: BORDER }} />
                    {/* Stage 5: Editor — adjudication */}
                    <div className="w-full rounded border px-2 py-2" style={{ backgroundColor: CARD_BG, borderColor: COPPER }}>
                      <p className="text-[7px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: COPPER }}>EDITOR</p>
                      <p className="text-[4.5px] tracking-[0.08em]" style={{ fontFamily: MONO, color: TEXT_DIM }}>single-writer adjudication</p>
                      <div className="mt-1 flex flex-col gap-px text-left">
                        <p className="text-[4.5px] leading-[1.3]" style={{ fontFamily: MONO, color: SLATE }}>&#x2192; policy enforcement</p>
                        <p className="text-[4.5px] leading-[1.3]" style={{ fontFamily: MONO, color: SLATE }}>&#x2192; conflict resolution</p>
                        <p className="text-[4.5px] leading-[1.3]" style={{ fontFamily: MONO, color: SLATE }}>&#x2192; strength preserved</p>
                        <p className="text-[4.5px] leading-[1.3]" style={{ fontFamily: MONO, color: SLATE }}>&#x2192; DB commit + publish</p>
                      </div>
                    </div>
                    <div className="h-3 w-px" style={{ backgroundColor: BORDER }} />
                    {/* Stage 6: Terminal outcomes */}
                    <div className="flex w-full gap-1">
                      <div className="flex-1 rounded border px-1 py-1 text-center" style={{ backgroundColor: "rgba(45, 106, 79, 0.05)", borderColor: "rgba(45, 106, 79, 0.3)" }}>
                        <p className="text-[6px] font-bold" style={{ fontFamily: MONO, color: GREEN }}>CONFIRMED</p>
                        <div className="mt-0.5 flex justify-center gap-px">
                          <span className="text-[4px]" style={{ fontFamily: MONO, color: GREEN }}>H</span>
                          <span className="text-[4px]" style={{ fontFamily: MONO, color: COPPER }}>M</span>
                          <span className="text-[4px]" style={{ fontFamily: MONO, color: GOLD }}>L</span>
                        </div>
                      </div>
                      <div className="flex-1 rounded border px-1 py-1 text-center" style={{ backgroundColor: "rgba(155, 34, 38, 0.05)", borderColor: "rgba(155, 34, 38, 0.3)" }}>
                        <p className="text-[6px] font-bold" style={{ fontFamily: MONO, color: RED }}>REJECTED</p>
                        <p className="text-[4px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>93%</p>
                      </div>
                    </div>
                  </div>
                  {/* Right: Human in the Loop sidebar */}
                  <div className="flex flex-col border-l px-2.5 py-3" style={{ borderColor: BORDER, width: "120px", flexShrink: 0 }}>
                    <p className="text-[6px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: SLATE }}>Human in the Loop</p>
                    {/* Annotation 1 — aligned with Detective */}
                    <div style={{ marginTop: "62px" }}>
                      <span className="text-[7px]" style={{ color: SLATE }}>&larr;</span>
                      <p className="text-[6px] font-bold" style={{ fontFamily: MONO, color: SLATE }}>OVERRIDE</p>
                      <p className="text-[5px] leading-[1.4]" style={{ fontFamily: MONO, color: TEXT_DIM }}>Human can override any detective tier</p>
                    </div>
                    {/* Annotation 2 — aligned with Editor */}
                    <div style={{ marginTop: "22px" }}>
                      <span className="text-[7px]" style={{ color: COPPER }}>&larr;</span>
                      <p className="text-[6px] font-bold" style={{ fontFamily: MONO, color: COPPER }}>ADJUDICATE</p>
                      <p className="text-[5px] leading-[1.4]" style={{ fontFamily: MONO, color: TEXT_DIM }}>Human adjudicates escalated dossiers. Resolves conflicts, overrides verdicts.</p>
                    </div>
                    {/* Annotation 3 — aligned with Rejected */}
                    <div style={{ marginTop: "18px" }}>
                      <span className="text-[7px]" style={{ color: RED }}>&larr;</span>
                      <p className="text-[6px] font-bold" style={{ fontFamily: MONO, color: RED }}>AUDIT</p>
                      <p className="text-[5px] leading-[1.4]" style={{ fontFamily: MONO, color: TEXT_DIM }}>154 rejected audited, 3 false negatives caught</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 14</span> &mdash; Verdict pipeline. The Researcher assigns connection strength (HIGH/MEDIUM/LOW/COINCIDENCE). The Editor consumes that strength, evaluates identity resolution, evidence sufficiency, and policy compliance, then writes the terminal verdict (CONFIRMED/REJECTED/PENDING_REVIEW). Human review intervenes at three points.
              </p>
            </div>

            <p style={{ maxWidth: CONTENT_NARROW }}>Three cases illustrate how the standard works in practice &mdash; one clear-cut, one edge case that was correctly rejected, and one that the automated pipeline initially missed but the manual audit caught.</p>

            <p style={{ maxWidth: CONTENT_NARROW }}>The human intervenes at three explicit points in this pipeline. First, any detective tier can be manually overridden before the dossier is built &mdash; this happened in cases where the automated search missed a known alias or misspelling. Second, every confirmed dossier is sanity-checked before publication, but only ~20% required substantive human adjudication (resolving ambiguity or overriding the system). Third, after the pipeline completed its full run, a one-time manual audit reviewed all 154 Editor-terminal REJECTED dossiers end-to-end, catching the three false negatives described in Case Study 03 below.</p>

            <p className="s-item-head" style={{ clear: "both", fontSize: "14px", paddingBottom: "0.25rem", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ color: TEXT_LIGHT }}>Case Study 01 &mdash; Tommy Mottola:</span> Clear-Cut Confirmation
            </p>
            {/* Pipeline trace — state machine: source → Detective tier → Researcher strength → Editor verdict */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5" style={{ maxWidth: CONTENT_NARROW, marginTop: "6px" }}>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}>BB: NO MATCH</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: "rgba(160,160,176,0.08)", color: TEXT_LIGHT }}>DOJ: 681 DOCS</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: COPPER_DIM, color: COPPER }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Detective: </span><span className="font-bold">LIKELY</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Researcher: </span><span className="font-bold">HIGH</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Editor: </span><span className="font-bold">CONFIRMED</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}>PUBLISHED</span>
            </div>
            {/* ── Fig. 15: Tommy Mottola DOJ email — floated left, 2 minor columns ── */}
            <div
              className="float-left mr-6 mb-4 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sidenotes/mottola-email.jpg"
                alt="DOJ Epstein Library document EFTA00767523: email from Tommy Mottola to jeevacation@gmail.com (Jeffrey Epstein), subject 'Fwd: 170 EEA Photo', December 6, 2009"
                className="w-full rounded border"
                style={{ borderColor: BORDER, filter: "contrast(1.1)" }}
              />
              <p className="mt-2 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 15</span> &mdash; DOJ Epstein Library: email from Tommy Mottola directly to Epstein&rsquo;s personal address, forwarding property photos. December 2009. <a href="https://www.justice.gov/epstein/files/DataSet%209/EFTA00767523.pdf" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(184, 115, 51, 0.6)" }}>EFTA00767523 &rarr;</a>
              </p>
            </div>
            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>Tommy Mottola, the former Sony Music CEO, was featured in AD in a profile of his Greenwich estate. The DOJ search returned 681 documents spanning 2009 to 2018. The key evidence: a direct email from Mottola to Epstein&rsquo;s personal address (jeevacation@gmail.com), forwarding property photos through entertainment attorney Allen Grubman&rsquo;s office. But the pipeline found more: ten &ldquo;Please call Tommy Mottola&rdquo; messages relayed by Epstein&rsquo;s assistant Lesley Groff (later a convicted co-conspirator), and an internal message asking &ldquo;Did Tommy Mottola come over early today? just wondering&rdquo; &mdash; evidence of in-person visits to Epstein&rsquo;s residence. The contact spans nine years and continued through January 2018, one year before Epstein&rsquo;s arrest. The Researcher compiled the dossier. The Editor reviewed it. Confirmed, high confidence.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span></p>
              <div
                className="absolute top-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  Minutes, Not Months
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  For the FinCEN Files investigation, 85 journalists spent over a year manually reading 3 million words of suspicious activity reports and extracting names into spreadsheets.
                </p>
                <a href="https://www.icij.org/investigations/fincen-files/mining-sars-data/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  ICIJ: Mining the FinCEN Files &rarr;
                </a>
              </div>
            </div>

            <p className="s-item-head" style={{ fontSize: "14px", paddingBottom: "0.25rem", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ color: TEXT_LIGHT }}>Case Study 02 &mdash; Isabel Goldsmith:</span> Edge Case &mdash; Correctly Rejected
            </p>
            {/* Pipeline trace — state machine: source → Detective tier → Researcher finding → Editor verdict → human */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5" style={{ maxWidth: CONTENT_NARROW, marginTop: "6px" }}>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}>BB: MATCH</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Detective: </span><span className="font-bold">STRONG MATCH</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Researcher: </span><span className="font-bold">ADVERSARIAL</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Editor: </span><span className="font-bold">REJECTED (ADVERSARIAL)</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm border border-dashed px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, borderColor: SLATE, color: SLATE, backgroundColor: "transparent" }}>HUMAN AUDIT</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}>UPHELD</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm border border-dashed px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, borderColor: COPPER, color: COPPER, backgroundColor: "rgba(184, 115, 51, 0.06)" }}>RUBRIC UPDATED</span>
            </div>
            {/* ── Fig. 16: Goldsmith email — floated left, 2 minor columns ── */}
            <div
              className="float-left mr-6 mb-4 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sidenotes/goldsmith-email.jpg"
                alt="Email from Mark Lloyd to Jeffrey Epstein (jeevacation@gmail.com), Oct 23 2015: 'hurricane will hit isabel goldsmith resort and bye bye' — Epstein's associate replies hoping the hurricane deposits 'its owner far out to sea'"
                className="w-full rounded border"
                style={{ borderColor: BORDER, filter: "contrast(1.1)" }}
              />
              <p className="mt-2 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 16</span> &mdash; DOJ Epstein Library: email showing adversarial context. Epstein&rsquo;s associate expresses hostility toward Goldsmith, not social connection. <a href="https://www.justice.gov/epstein/files/DataSet%209/EFTA00842645.pdf" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(184, 115, 51, 0.6)" }}>EFTA00842645 &rarr;</a>
              </p>
            </div>
            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>Isabel Goldsmith appeared in the DOJ&rsquo;s Epstein Library. Her name is in the documents. A careless system would flag this as a match and move on. But when the Researcher examined the actual context of the DOJ references, the picture reversed: the documents suggest Epstein disliked Goldsmith and that the context was adversarial rather than social. This is a critical distinction that the pipeline is designed to catch. Appearing in someone&rsquo;s records is not the same as being in their social orbit. The system rejected Isabel Goldsmith, and it was right to do so. Under our standard, adversarial context is negative evidence: it argues against proximity rather than supporting it. This case produced an explicit rule written into the Researcher&rsquo;s rubric: adversarial context is negative evidence and should be treated as grounds for REJECTED (ADVERSARIAL). Dislike is not proximity.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span></p>
              <div
                className="absolute top-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  Dislike &ne; Proximity
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Adversarial or negative context in DOJ documents (Epstein expressing displeasure about someone, or a legal dispute) does not constitute a social connection.
                </p>
              </div>
            </div>

            <p className="s-item-head" style={{ fontSize: "14px", paddingBottom: "0.25rem", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ color: TEXT_LIGHT }}>Case Study 03 &mdash; Mica Ertegun:</span> Edge Case &mdash; Initially Missed, Caught on Audit
            </p>
            {/* Pipeline trace — state machine: source → Detective tier → Researcher strength → Editor verdict → human override */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5" style={{ maxWidth: CONTENT_NARROW, marginTop: "6px" }}>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}>BB: NO MATCH</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: "rgba(160,160,176,0.08)", color: TEXT_LIGHT }}>DOJ: DINING EVIDENCE</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: COPPER_DIM, color: COPPER }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Detective: </span><span className="font-bold">LIKELY</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: GOLD_DIM, color: GOLD }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Researcher: </span><span className="font-bold">LOW</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Editor: </span><span className="font-bold">REJECTED</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm border border-dashed px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, borderColor: SLATE, color: SLATE, backgroundColor: "transparent" }}>HUMAN AUDIT</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm border border-dashed px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, borderColor: SLATE, color: SLATE, backgroundColor: "transparent" }}>REOPENED</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}><span className="text-[6px] font-normal" style={{ color: TEXT_DIM, letterSpacing: "0.08em" }}>Editor: </span><span className="font-bold">CONFIRMED</span></span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm border border-dashed px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, borderColor: COPPER, color: COPPER, backgroundColor: "rgba(184, 115, 51, 0.06)" }}>RUBRIC UPDATED</span>
              <span className="text-[8px]" style={{ color: TEXT_DIM }}>&rarr;</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, backgroundColor: GREEN_BG, color: GREEN }}>PUBLISHED</span>
            </div>
            {/* ── Fig. 17: Ertegun dinner thank-you — floated left, 2 minor columns ── */}
            <div
              className="float-left mr-6 mb-4 hidden md:block"
              style={{ width: "calc(2 * (100% - 5 * 24px) / 6 + 24px)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sidenotes/ertegun-dinner.jpg"
                alt="DOJ Epstein Library document EFTA02430092: Peggy Siegal forwarding dinner thank-you notes to Epstein's email, including note #11 from Mica Ertegun thanking Peggy for the wonderful evening at the Carlyle"
                className="w-full rounded border"
                style={{ borderColor: BORDER, filter: "contrast(1.1)" }}
              />
              <p className="mt-2 text-[8px] tracking-wider" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                <span style={{ color: TEXT_MID }}>Fig. 17</span> &mdash; DOJ Epstein Library: Peggy Siegal forwarding dinner thank-you notes to Epstein&rsquo;s email. Note #11 from Mica Ertegun: &ldquo;Thank you for including me at the wonderful evening at the Carlyle.&rdquo; <a href="https://www.justice.gov/epstein/files/DataSet%2011/EFTA02430092.pdf" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(184, 115, 51, 0.6)" }}>EFTA02430092 &rarr;</a>
              </p>
            </div>
            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>Mica Ertegun, the interior designer and wife of Atlantic Records founder Ahmet Ertegun, was featured in AD and appeared in the DOJ documents. The automated pipeline initially rejected her. When I manually audited all 154 rejected dossiers &mdash; a process that took several days and reviewed every single case the system had dismissed &mdash; the Ertegun dossier stood out. The DOJ documents showed that Ertegun had dined with Epstein at his properties. Not a passing mention, not a surname collision, not a third-party reference &mdash; an actual meal at an actual address. Under the system&rsquo;s own evidentiary standard, dining together constitutes direct interaction. The pipeline should have caught this. It didn&rsquo;t: the system treated the strongest signal&mdash;a dinner thank-you note forwarded by a third party&mdash;as indirect evidence, and in the absence of a Black Book entry or other corroborating artifacts, the Researcher assigned LOW strength and the Editor rejected the dossier as INSUFFICIENT. During manual audit, the case was reopened and re-adjudicated; the Editor then wrote CONFIRMED.</p>
              <p className="mt-4" style={{ maxWidth: CONTENT_NARROW }}>But the correction didn&rsquo;t stop at one dossier. The audit produced a new policy rule written directly into the Researcher&rsquo;s investigation rubric: documented dining at Epstein&rsquo;s properties constitutes direct interaction, even when the evidence arrives via a forwarded note rather than a first-hand message. That rule now applies to subsequent investigations. The Ertegun case is the clearest example of the human-in-the-loop feedback cycle: an error is caught, the verdict is corrected, and the system&rsquo;s instructions are updated to reduce the chance of the same failure mode recurring.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span></p>
              <div
                className="absolute top-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  98% Rejection Accuracy
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Of 154 rejected dossiers, manual audit found exactly 3 errors: Mica Ertegun, David Copperfield, and Regis &amp; Joy Philbin.
                </p>
              </div>
            </div>

            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>The three false negatives &mdash; Mica Ertegun, David Copperfield, and Regis and Joy Philbin &mdash; were recoverable because the pipeline is designed to be auditable. Every intermediate output, every evidence citation, every reasoning step is preserved in the dossier. When the manual audit retraced the system&rsquo;s logic on each rejected case, the errors were visible: evidence the Detective found but the Researcher underweighted, or context the automated synthesis missed. The 2% error rate is not acceptable as a final answer &mdash; it is acceptable as an input to a process that catches it.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span></p>
              <div
                className="absolute top-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  Full Audit Trail
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Rudin (Nature Machine Intelligence, 2019) argues that in high-stakes classification (criminal justice, healthcare, investigative contexts), post-hoc explanations of opaque systems provide false assurance. The decision chain itself must be the actual reasoning, not a rationalization.
                </p>
                <a href="https://www.nature.com/articles/s42256-019-0048-x" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  Nature Machine Intelligence &rarr;
                </a>
              </div>
            </div>

            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>Every confirmed dossier is sanity-checked before publication. But approximately 20% required substantive human adjudication &mdash; cases where the automated pipeline flagged the evidence as ambiguous and the Editor deferred rather than guessed. This is by design. The system recognizes uncertainty and routes it upward rather than making a coin-flip call. A few confirmations, including Diane von Furstenberg and Sharon Stone, came entirely from human adjudication of evidence the pipeline surfaced but couldn&rsquo;t resolve on its own. The system is a force multiplier for human judgment, not a replacement for it.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span></p>
              <div
                className="absolute top-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  ~80% Fully Autonomous
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  The 20% human review rate is not a failure mode &mdash; it is the system working as designed. Madras et al. (NeurIPS 2018) formalized this as &ldquo;learning to defer&rdquo;: systems improve accuracy and fairness by knowing when not to decide. Vaccaro et al. (2024) found that human-AI combinations perform worse on average when the human overrides indiscriminately, but better when they intervene selectively on cases requiring contextual knowledge.
                </p>
                <a href="https://www.nature.com/articles/s41562-024-02024-1" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  Nature Human Behaviour &rarr;
                </a>
                <a href="https://arxiv.org/abs/1711.06664" target="_blank" rel="noopener noreferrer" className="mt-1.5 ml-3 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  NeurIPS 2018 &rarr;
                </a>
              </div>
            </div>
            <div className="s-divider" style={{ clear: "both", maxWidth: CONTENT_NARROW }} />
          </div>

          {/* ── Quantifying a Connection ── */}
          <div className="mt-14 text-[15px] leading-[1.8] [&>*+*]:mt-6" style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID, clear: "both" }}>
            <p className="s-subhead" style={{ maxWidth: CONTENT_NARROW }}>
              Quantifying a Connection
            </p>

            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>The word &ldquo;confirmed&rdquo; carries weight, so the evidentiary standard behind it needs to be explicit. What qualifies as a confirmed connection, and equally important, what does not.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span></p>
              <div
                className="absolute top-0 z-10 hidden pl-4 md:block"
                style={{
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  Sworn Testimony
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  At the Maxwell trial (Day 4, Dec 2, 2021), Epstein&rsquo;s butler Juan Alessi testified under oath that the Black Book was kept next to a telephone, that he personally used it to call people listed in it, and that Maxwell used it to schedule visits. The entries were not aspirational &mdash; they were called, and the people came.
                </p>
                <a href="https://slate.com/news-and-politics/2021/12/ghislaine-maxwell-jeffrey-epstein-little-black-book-juan-alessi.html" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  Slate: Maxwell Trial Day Four &rarr;
                </a>
              </div>
            </div>

            <p className="s-item-head">
              What Counts as a Confirmed Connection
            </p>
            <ul className="ml-6 list-disc space-y-2" style={{ maxWidth: CONTENT_NARROW }}>
              <li>A structured Black Book entry with first name, last name, and phone numbers: Epstein had their contact information in his personal address book</li>
              <li>DOJ documents showing direct interaction: dining at Epstein&rsquo;s properties, correspondence, guest lists, scheduled appointments</li>
              <li>Flight logs, contact database entries, or legal depositions naming the individual in direct Epstein context</li>
              <li>&ldquo;Confirmed&rdquo; means documented proximity: it does not imply wrongdoing or a personal relationship</li>
            </ul>

            <p className="s-item-head">
              What Does Not Count
            </p>
            <ul className="ml-6 list-disc space-y-2" style={{ maxWidth: CONTENT_NARROW }}>
              <li>Surname-only collision: 64 of 66 Black Book surname-only matches were different people entirely</li>
              <li>Mere mention in a DOJ document without evidence of interaction: appearing in a list is not the same as dining together</li>
              <li>Third-party name reference: Peggy Siegal mentioning a person in an email to Epstein is not evidence that person ever met Epstein</li>
              <li>Family member in records: does not confirm a different family member. Each individual is assessed independently</li>
              <li>Adversarial or negative context: Epstein disliking someone is not a social connection</li>
            </ul>
          </div>
        </div>

        <SectionTransition num="4.5" name="intelligence_infrastructure" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.5: INTELLIGENCE INFRASTRUCTURE
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-5" className="mt-8 scroll-mt-24">
          <SectionHeader
            num="4.5"
            title="INTELLIGENCE INFRASTRUCTURE"
            subtitle="The agents don't just execute tasks. They remember, reflect, communicate, and improve."
            intro={[
              "Beyond the task pipeline, each agent has access to six shared intelligence subsystems that enable coordination without human intervention. These subsystems were designed to address seven specific capability gaps identified in early testing: the agents needed memory, reflection, self-improvement, planning, curiosity, a world model, and inter-agent communication.",
              "The episodic memory system stores every agent's experiences as searchable vector embeddings (384-dimensional, using ONNX all-MiniLM-L6-v2). When an agent encounters a new task, it retrieves semantically similar past episodes to inform its approach. Reflection runs every 10 minutes — each agent reviews its recent work, identifies patterns, and distills lessons. Self-improvement proposals surface every 30 minutes, suggesting methodology changes with explicit rationale.",
              "The inter-agent communication layer is a shared bulletin board where agents post warnings, discoveries, and status updates. A world model provides a structured snapshot of the entire pipeline — refreshed every 30 seconds — so agents can detect bottlenecks and adjust priorities. The curiosity system drives cross-agent pattern exploration every 15 minutes, surfacing connections that no single agent would find working alone.",
            ]}
            summary="The six intelligence subsystems transform a collection of isolated task-executors into a coordinated system that learns from its own experience, communicates across agents, and proposes its own improvements."
          />

          {/* ── Architecture Diagrams ── */}

          {/* ── Fig A: Agent Internal Architecture ── */}
          <div className="mt-10">
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// AGENT INTERNAL ARCHITECTURE"}
            </p>
            <p
              className="mt-2 text-[11px] leading-[1.7] md:max-w-[var(--content-narrow)]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              Every agent&apos;s core decision loop runs through a single
              function: <code style={{ color: GREEN }}>problem_solve()</code>.
              When a task arrives, the agent assembles context from three
              sources &mdash; episodic memory recall, bulletin board posts,
              and a live world model snapshot &mdash; before passing
              everything to the LLM for execution. The result is committed
              back as an episode, closing the feedback loop.
            </p>

            {/* ── Fig A: Agent Internal Architecture (technical) ── */}
            <div
              className="mt-6 overflow-x-auto rounded-lg border"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <div className="min-w-[900px] p-6 md:p-8">
                {/* Title */}
                <p
                  className="text-[13px] font-bold"
                  style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                >
                  Agent execution path: problem_solve(task) &rarr; episode
                </p>

                {/* Row: Task Inbox → Context Assembly → LLM → Outbox */}
                <div className="mt-6 flex items-start gap-3">
                  {/* Task Inbox */}
                  <CodeBox
                    title="Task{} inbox"
                    titleColor={GREEN}
                    borderColor={GREEN}
                    lines={[
                      "class Task:",
                      "  type: str  # 8 task types",
                      "  payload: dict",
                      "  priority: int (0-100)",
                      "  source: 'editor'",
                      "",
                      "# Pushed by Miranda via",
                      "# asyncio.Queue per agent",
                    ]}
                  />
                  <span className="mt-12 flex-shrink-0 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>

                  {/* Context Assembly */}
                  <CodeBox
                    title="CONTEXT ASSEMBLY"
                    titleColor="#5B8DEF"
                    borderColor="#5B8DEF"
                    lines={[
                      "episodes = memory.recall(task, k=5)",
                      "  # cosine similarity, float[384]",
                      "posts = board.read_recent(10)",
                      "  # warnings, insights, requests",
                      "world = world_model.snapshot()",
                      "  # pipeline stats, bottlenecks",
                      "",
                      "context = merge(episodes, posts, world)",
                    ]}
                  />
                  <span className="mt-12 flex-shrink-0 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>

                  {/* LLM Execution */}
                  <CodeBox
                    title="LLM EXECUTION"
                    titleColor={GOLD}
                    borderColor={GOLD}
                    lines={[
                      "prompt = build_prompt(",
                      "  task=task,",
                      "  context=context,",
                      "  agent_role=self.role",
                      ")",
                      "result = await llm(prompt)",
                      "  # Sonnet for routine tasks",
                      "  # Opus for quality reviews",
                    ]}
                  />
                  <span className="mt-12 flex-shrink-0 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>

                  {/* Task Outbox */}
                  <CodeBox
                    title="TaskResult{} outbox"
                    titleColor={COPPER}
                    borderColor={COPPER}
                    lines={[
                      "class TaskResult:",
                      "  status: 'success'|'failure'",
                      "  data: dict",
                      "  agent: str",
                      "",
                      "outbox.put(result)",
                      "# Miranda reads & commits",
                      "# to Supabase (single writer)",
                    ]}
                  />
                </div>

                {/* Subsystem connections */}
                <div className="mt-6 flex gap-3">
                  {[
                    { name: "EPISODIC MEMORY", desc: "recall(query, k=5) → top-k episodes by cosine similarity", color: GREEN, detail: "ONNX all-MiniLM-L6-v2 · 384-dim · ~2ms" },
                    { name: "BULLETIN BOARD", desc: "read_recent(n) → warnings, insights, cross-agent alerts", color: "#5B8DEF", detail: "Auto-post on escalation · severity 1-5" },
                    { name: "WORLD MODEL", desc: "snapshot() → pipeline stats, bottlenecks, queue depths", color: "#4ECDC4", detail: "30s cache · shared read-only · all agents" },
                  ].map((sys) => (
                    <div
                      key={sys.name}
                      className="flex-1 rounded border border-dashed p-3"
                      style={{ borderColor: `${sys.color}40` }}
                    >
                      <p
                        className="text-[9px] font-bold tracking-[0.1em]"
                        style={{ fontFamily: MONO, color: sys.color }}
                      >
                        {sys.name}
                      </p>
                      <p className="mt-1 text-[8px] leading-[1.5]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                        {sys.desc}
                      </p>
                      <p className="mt-1 text-[7px]" style={{ fontFamily: MONO, color: `${sys.color}60` }}>
                        {sys.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Episode commit feedback */}
                <div
                  className="mt-4 flex items-center gap-4 rounded border px-4 py-2"
                  style={{ borderColor: `${GREEN}30`, backgroundColor: `${GREEN}06` }}
                >
                  <span className="text-[9px] font-bold tracking-[0.1em]" style={{ fontFamily: MONO, color: GREEN }}>
                    EPISODE COMMIT
                  </span>
                  <span className="text-[8px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Every task result is stored as a searchable episode: text + outcome + embedding[384] + metadata.
                    Feedback loop: future recalls retrieve this episode for similar tasks.
                  </span>
                </div>

              </div>
            </div>
            <p
              className="mt-3 text-[8px] tracking-wider"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              <span style={{ color: TEXT_MID }}>Fig. 18</span> &mdash; Agent internal architecture: the problem_solve() execution path from task intake through context assembly to episode storage.
            </p>
          </div>

          {/* ── Fig B: Data Pipeline ── */}
          <div className="mt-14">
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// DATA PIPELINE: URL → VERDICT"}
            </p>
            <p
              className="mt-2 text-[11px] leading-[1.7] md:max-w-[var(--content-narrow)]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              Data flows through three transformation stages. The Discover
              stage turns archive.org URLs into structured features via JWT
              decoding and Gemini Vision. Cross-Reference runs each name
              through Epstein&apos;s Black Book (regex word-boundary matching) and
              the DOJ search portal (headless Playwright). The Investigate
              stage produces final verdicts through triage, synthesis, and
              editorial review.
            </p>

            <div
              className="mt-6 overflow-x-auto rounded-lg border"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <div className="min-w-[1000px] p-6 md:p-8">
                <p className="text-[13px] font-bold" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>
                  Data transformation pipeline: archive.org URL &rarr; confirmed/rejected verdict
                </p>

                {/* Row 1: DISCOVER */}
                <p className="mt-6 text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: GREEN }}>
                  01 DISCOVER
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <CodeBox title="SCOUT → archive.org" titleColor={GREEN} borderColor={GREEN} lines={[
                    "GET /advancedsearch.php",
                    "  q: 'architectural digest'",
                    "  fl: identifier,date,year",
                    "  rows: 100",
                    "→ Issue{id, year, month, url}",
                  ]} />
                  <span className="mt-10 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="DB: issues" titleColor="#5B8DEF" borderColor="#5B8DEF" lines={[
                    "id: serial PK",
                    "archive_id: text UNIQUE",
                    "year: int (≥1988)",
                    "month: int",
                    "pdf_url: text",
                  ]} />
                  <span className="mt-10 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="COURIER → JWT + images" titleColor="#4ECDC4" borderColor="#4ECDC4" lines={[
                    "decode(tocConfig) → Article[]",
                    "Article{title, teaser, pages}",
                    "fetch page images (0x600 jpg)",
                    "→ Feature{title, page_range}",
                  ]} />
                  <span className="mt-10 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="READER → Gemini Vision" titleColor={GREEN} borderColor={GREEN} lines={[
                    "send 3 page images per article",
                    "extract: homeowner, designer,",
                    "  location, style, sq_ft, year",
                    "→ Feature{all fields populated}",
                  ]} />
                  <span className="mt-10 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="DB: features" titleColor="#5B8DEF" borderColor="#5B8DEF" lines={[
                    "id: serial PK",
                    "issue_id: FK → issues",
                    "homeowner_name: text",
                    "designer: text",
                    "location: text",
                  ]} />
                </div>

                {/* Row 2: CROSS-REFERENCE */}
                <p className="mt-8 text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: "#CC4040" }}>
                  02 CROSS-REFERENCE
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <CodeBox title="DETECTIVE → Black Book search" titleColor="#CC4040" borderColor="#CC4040" lines={[
                    "for name in features.homeowner_name:",
                    "  terms = split_name(name)",
                    "  for term in terms:",
                    "    re.search(r'\\b'+re.escape(term)+'\\b', bb_text)",
                    "  match_type:",
                    "    last_first → 0.85 confidence",
                    "    full_name → 0.90 confidence",
                    "    last_name_only → 0.55 confidence",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="DETECTIVE → DOJ search" titleColor="#CC4040" borderColor="#CC4040" lines={[
                    "browser = playwright(headless=False)",
                    "  # Akamai WAF blocks headless",
                    "navigate(justice.gov/epstein)",
                    "click('#age-button-yes')",
                    "click('I am not a robot') # reauth()",
                    "fill('#searchInput', name)",
                    "click('#searchButton')",
                    "parse('#results') → hits[]",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="VERDICT LOGIC" titleColor={GOLD} borderColor={GOLD} lines={[
                    "if bb.full_name + doj.hits:",
                    "  → confirmed_match (0.90)",
                    "if bb.last_first:",
                    "  → confirmed_match (0.85)",
                    "if bb.last_name_only:",
                    "  → likely_match (0.55)",
                    "  # 64/66 are false positives",
                    "if doj_only:",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="DB: cross_references" titleColor="#5B8DEF" borderColor="#5B8DEF" lines={[
                    "feature_id: FK → features",
                    "source: bb|doj|both",
                    "match_type: enum",
                    "confidence: float",
                    "raw_matches: jsonb",
                  ]} />
                </div>

                {/* Row 3: INVESTIGATE */}
                <p className="mt-8 text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: "#D97EC4" }}>
                  03 INVESTIGATE
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <CodeBox title="RESEARCHER → triage" titleColor="#D97EC4" borderColor="#D97EC4" lines={[
                    "score = bb_weight + doj_weight",
                    "if score > threshold:",
                    "  → deep investigation",
                    "else:",
                    "  → quick assessment",
                    "fame is NEVER a dismissal factor",
                  ]} />
                  <span className="mt-10 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="RESEARCHER → synthesis" titleColor="#D97EC4" borderColor="#D97EC4" lines={[
                    "evidence = {",
                    "  bb_entries, doj_hits,",
                    "  graph_analytics, web_context",
                    "}",
                    "dossier = synthesize(evidence)",
                    "verdict: YES|NO with rationale",
                  ]} />
                  <span className="mt-10 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="EDITOR → review" titleColor={COPPER} borderColor={COPPER} lines={[
                    "miranda reviews dossier:",
                    "  evidence sufficient?",
                    "  verdict consistent?",
                    "  fame-based dismissal? → reject",
                    "if approved: commit to Supabase",
                    "if rejected: log + retry queue",
                  ]} />
                  <span className="mt-10 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="DB: dossiers" titleColor="#5B8DEF" borderColor="#5B8DEF" lines={[
                    "id: serial PK",
                    "feature_id: FK → features",
                    "verdict: confirmed|rejected",
                    "evidence_summary: text",
                    "sources: jsonb",
                    "reviewed_by: 'miranda'",
                  ]} />
                </div>

                {/* Pipeline stats */}
                <div className="mt-8 border-t pt-4" style={{ borderColor: BORDER }}>
                  <p className="text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>
                    PIPELINE STATE (Run 4)
                  </p>
                  <div className="mt-3 flex gap-10">
                    {[
                      { val: "~480", label: "issues", sub: "discovered from archive.org (1988–2025)", color: GREEN },
                      { val: "~2,180", label: "features", sub: "extracted via Gemini Vision + JWT scraping", color: GREEN },
                      { val: "~476", label: "cross-refs", sub: "157 YES matches (BB + DOJ)", color: "#CC4040" },
                      { val: "~185", label: "dossiers", sub: "investigated by Elena, reviewed by Miranda", color: "#D97EC4" },
                      { val: "33", label: "confirmed", sub: "Epstein orbit connections verified", color: GOLD },
                    ].map((s) => (
                      <div key={s.label}>
                        <span className="text-[14px] font-bold" style={{ fontFamily: MONO, color: s.color }}>
                          {s.val}
                        </span>
                        <span className="ml-1 text-[9px] font-bold" style={{ fontFamily: MONO, color: s.color }}>
                          {s.label}
                        </span>
                        <p className="text-[7px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                          {s.sub}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
            <p
              className="mt-3 text-[8px] tracking-wider"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              <span style={{ color: TEXT_MID }}>Fig. 19</span> &mdash; Data pipeline: the three transformation stages from archive.org URL to confirmed/rejected verdict.
            </p>
          </div>

          {/* ── Fig C: Memory & Learning Architecture ── */}
          <div className="mt-14">
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// MEMORY & LEARNING ARCHITECTURE"}
            </p>
            <p
              className="mt-2 text-[11px] leading-[1.7] md:max-w-[var(--content-narrow)]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              Intelligence compounds through four feedback loops operating
              at different timescales. The fast loop commits every task result
              as a searchable episode. Reflection and self-improvement operate
              on 10&ndash;30 minute cycles. Cross-agent curiosity and bulletin
              board posts create emergent coordination. Episodes persist
              across restarts &mdash; the system never forgets what it learned.
            </p>

            <div
              className="mt-6 overflow-x-auto rounded-lg border"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <div className="min-w-[900px] p-6 md:p-8">
                <p className="text-[13px] font-bold" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>
                  Memory &amp; learning architecture: how agents accumulate intelligence
                </p>

                {/* Row 1: Episode Lifecycle */}
                <p className="mt-6 text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: GREEN }}>
                  01 EPISODE LIFECYCLE
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <CodeBox title="Episode schema" titleColor={GREEN} borderColor={GREEN} lines={[
                    "class Episode:",
                    "  text: str",
                    "  outcome: 'success'|'failure'",
                    "  agent: str  # 'elena','silas'",
                    "  task_type: str",
                    "  embedding: float[384]",
                    "  timestamp: datetime",
                    "  metadata: dict",
                    "",
                    "storage: data/agent_memory/",
                    "  episodes.json (2K cap)",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="EMBEDDING PIPELINE" titleColor={GREEN} borderColor={GREEN} lines={[
                    "model: all-MiniLM-L6-v2.onnx",
                    "dim: 384 (float32)",
                    "",
                    "tokenize(text, max_len=128)",
                    "  → input_ids, attention_mask",
                    "onnx_session.run(inputs)",
                    "  → mean_pooling(outputs)",
                    "  → L2_normalize(vector)",
                    "",
                    "latency: ~2ms per episode",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="VECTOR RECALL" titleColor={GREEN} borderColor={GREEN} lines={[
                    "def recall(query, k=5):",
                    "  q_vec = embed(query)",
                    "  scores = []",
                    "  for ep in episodes:",
                    "    sim = cosine(q_vec, ep.embedding)",
                    "    scores.append((sim, ep))",
                    "  return top_k(scores, k)",
                    "",
                    "# Used in problem_solve() to",
                    "# assemble context before LLM call",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: "#5B8DEF" }}>&rarr;</span>
                  <CodeBox title="→ CONTEXT ASSEMBLY" titleColor="#5B8DEF" borderColor="#5B8DEF" lines={[
                    "context = {",
                    "  'relevant_episodes': recall(task),",
                    "  'board_posts': board.read(10),",
                    "  'world_state': world.snapshot(),",
                    "  'task': current_task,",
                    "}",
                    "",
                    "# All three sources merged into",
                    "# single prompt for LLM execution",
                    "# ~800 tokens context overhead",
                  ]} />
                </div>

                {/* Row 2: Reflection & Self-Improvement */}
                <p className="mt-8 text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: GOLD }}>
                  02 REFLECTION &amp; SELF-IMPROVEMENT
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <CodeBox title="REFLECTION (every 10 min)" titleColor={GOLD} borderColor={GOLD} lines={[
                    "def reflect():",
                    "  recent = episodes[-20:]",
                    "  prompt = f'''Review these episodes.",
                    "    Identify: patterns, failures,",
                    "    repeated mistakes, opportunities'''",
                    "  insight = haiku(prompt)",
                    "  commit_episode(insight, 'reflection')",
                    "",
                    "output: 'I keep failing DOJ searches",
                    "  when name has special characters'",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="SELF-IMPROVEMENT (every 30 min)" titleColor={COPPER} borderColor={COPPER} lines={[
                    "def propose_improvement():",
                    "  reflections = recall('methodology')",
                    "  proposal = haiku(f'''",
                    "    WHAT: specific change",
                    "    WHY: evidence from episodes",
                    "    HOW: implementation steps''')",
                    "  post_to_bulletin(proposal)",
                    "",
                    "output: 'Strip accents from names",
                    "  before DOJ search → fewer 403s'",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="MEMORY-INFORMED PRIORITY" titleColor="#4ECDC4" borderColor="#4ECDC4" lines={[
                    "def _memory_informed_priority(task):",
                    "  history = recall(task.key)",
                    "  failures = [e for e in history",
                    "    if e.outcome == 'failure']",
                    "  if len(failures) >= 2:",
                    "    task.priority -= 10  # deprioritize",
                    "  if task.type == 'investigate_lead':",
                    "    similar = recall(task.name)",
                    "    if any_confirmed(similar):",
                    "      task.priority += 5  # boost",
                  ]} />
                </div>

                {/* Row 3: Inter-Agent Communication */}
                <p className="mt-8 text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: "#5B8DEF" }}>
                  03 INTER-AGENT COMMUNICATION
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <CodeBox title="BULLETIN BOARD" titleColor="#5B8DEF" borderColor="#5B8DEF" lines={[
                    "class BulletinPost:",
                    "  agent: str",
                    "  type: 'warning'|'insight'|'request'",
                    "  message: str",
                    "  severity: int (1-5)",
                    "  timestamp: datetime",
                    "",
                    "auto_post on: task escalation,",
                    "  DOJ unavailable, pattern detected,",
                    "  rate limit hit, anomaly found",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="WORLD MODEL (30s cache)" titleColor="#4ECDC4" borderColor="#4ECDC4" lines={[
                    "def get_world_state():",
                    "  return {",
                    "    'issues': count('issues'),",
                    "    'features': count('features'),",
                    "    'xrefs': count('cross_references'),",
                    "    'dossiers': count('dossiers'),",
                    "    'bottleneck': detect_bottleneck(),",
                    "    'queue_depths': get_queues(),",
                    "    'agent_status': get_heartbeats(),",
                    "  }  # cached 30s, shared read-only",
                  ]} />
                  <span className="mt-12 text-[11px]" style={{ color: TEXT_DIM }}>&rarr;</span>
                  <CodeBox title="CURIOSITY (every 15 min)" titleColor="#D97EC4" borderColor="#D97EC4" lines={[
                    "def curious_explore():",
                    "  # Cross-agent pattern exploration",
                    "  other_episodes = load_all_agents()",
                    "  my_episodes = episodes[-50:]",
                    "  prompt = f'''Compare patterns.",
                    "    What is agent X discovering",
                    "    that I should know about?'''",
                    "  insight = haiku(prompt)",
                    "  if novel(insight):",
                    "    commit_episode(insight, 'curiosity')",
                  ]} />
                </div>

                {/* Feedback Loops */}
                <p className="mt-8 text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: "#9B7EDB" }}>
                  FEEDBACK LOOPS
                </p>
                <div className="mt-2 grid grid-cols-4 gap-3">
                  {[
                    { label: "FAST LOOP (per task)", color: GREEN, lines: ["task → execute → episode", "latency: milliseconds", "every problem_solve() call"] },
                    { label: "MEDIUM LOOP (10-30 min)", color: GOLD, lines: ["episodes → reflect → improve", "latency: minutes", "self-correction cycle"] },
                    { label: "SLOW LOOP (cross-agent)", color: "#D97EC4", lines: ["curiosity → bulletin → priority", "latency: 15-30 min", "emergent coordination"] },
                    { label: "PERSISTENT LOOP (across runs)", color: "#9B7EDB", lines: ["episodes survive restarts", "2K episodes → 10K cap", "institutional knowledge"] },
                  ].map((loop) => (
                    <div
                      key={loop.label}
                      className="rounded border p-3"
                      style={{ borderColor: `${loop.color}30`, backgroundColor: `${loop.color}08` }}
                    >
                      <p className="text-[8px] font-bold" style={{ fontFamily: MONO, color: loop.color }}>
                        {loop.label}
                      </p>
                      {loop.lines.map((line) => (
                        <p key={line} className="text-[7px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Memory stats */}
                <div className="mt-6 border-t pt-4" style={{ borderColor: BORDER }}>
                  <p className="text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>
                    MEMORY STATE (Run 4)
                  </p>
                  <div className="mt-3 flex gap-12">
                    {[
                      { val: "~2,000", label: "episodes stored (10K cap)", color: GREEN },
                      { val: "384-dim", label: "embedding vectors (ONNX)", color: GREEN },
                      { val: "~2ms", label: "per embedding + recall", color: "#4ECDC4" },
                      { val: "6 agents", label: "independent memory stores", color: "#5B8DEF" },
                    ].map((s) => (
                      <div key={s.val}>
                        <span className="text-[14px] font-bold" style={{ fontFamily: MONO, color: s.color }}>
                          {s.val}
                        </span>
                        <p className="text-[7px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="mt-2 text-[7px]" style={{ fontFamily: MONO, color: "rgba(100,100,120,1)" }}>
                  DESIGN: No external vector DB needed. Custom numpy+ONNX store is faster than ChromaDB and compatible with Python 3.14.
                </p>

              </div>
            </div>
            <p
              className="mt-3 text-[8px] tracking-wider"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              <span style={{ color: TEXT_MID }}>Fig. 20</span> &mdash; Memory and learning architecture: four feedback loops operating at different timescales, from per-task episodes to persistent institutional knowledge.
            </p>
          </div>

          {/* ── Intelligence Subsystem Grid (reference cards) ── */}
          <div className="mt-14" style={{ borderTop: `1px solid ${BORDER}` }} />
          <p
            className="mt-8 text-[11px] font-bold tracking-wider"
            style={{ fontFamily: MONO, color: GOLD_DIM }}
          >
            {"// THE SIX SUBSYSTEMS"}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {/* Episodic Memory */}
            <div
              className="rounded border p-5"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                borderTop: "2px solid rgba(46,204,113,0.5)",
              }}
            >
              <p
                className="text-[10px] tracking-widest"
                style={{ fontFamily: MONO, color: GREEN }}
              >
                01
              </p>
              <p
                className="mt-1 text-[13px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                EPISODIC MEMORY
              </p>
              <p
                className="mt-2 text-[10px] leading-[1.6]"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                Each agent stores experiences as searchable episodes. Semantic
                vector embeddings (384-dim) enable recall of similar past
                situations. 10,000 episode capacity with automatic pruning.
              </p>
            </div>

            {/* Reflection */}
            <div
              className="rounded border p-5"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                borderTop: "2px solid rgba(184,134,11,0.5)",
              }}
            >
              <p
                className="text-[10px] tracking-widest"
                style={{ fontFamily: MONO, color: GOLD }}
              >
                02
              </p>
              <p
                className="mt-1 text-[13px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                REFLECTION
              </p>
              <p
                className="mt-2 text-[10px] leading-[1.6]"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                Every 10 minutes, each agent reviews its own recent episodes,
                identifies patterns in successes and failures, and distills
                lessons that inform future decisions.
              </p>
            </div>

            {/* Self-Improvement */}
            <div
              className="rounded border p-5"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                borderTop: "2px solid rgba(184,115,51,0.5)",
              }}
            >
              <p
                className="text-[10px] tracking-widest"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                03
              </p>
              <p
                className="mt-1 text-[13px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                SELF-IMPROVEMENT
              </p>
              <p
                className="mt-2 text-[10px] leading-[1.6]"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                Every 30 minutes, agents propose methodology changes — what to
                do differently, why, and how. Proposals are logged, reviewed,
                and integrated into future runs.
              </p>
            </div>

            {/* Bulletin Board */}
            <div
              className="rounded border p-5"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                borderTop: "2px solid rgba(91,141,239,0.5)",
              }}
            >
              <p
                className="text-[10px] tracking-widest"
                style={{ fontFamily: MONO, color: "#5B8DEF" }}
              >
                04
              </p>
              <p
                className="mt-1 text-[13px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                BULLETIN BOARD
              </p>
              <p
                className="mt-2 text-[10px] leading-[1.6]"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                Shared communication channel. Warnings, discoveries, and
                status updates post automatically. Agents read the board before
                starting new tasks — no agent works in isolation.
              </p>
            </div>

            {/* World Model */}
            <div
              className="rounded border p-5"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                borderTop: "2px solid rgba(78,205,196,0.5)",
              }}
            >
              <p
                className="text-[10px] tracking-widest"
                style={{ fontFamily: MONO, color: "#4ECDC4" }}
              >
                05
              </p>
              <p
                className="mt-1 text-[13px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                WORLD MODEL
              </p>
              <p
                className="mt-2 text-[10px] leading-[1.6]"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                A structured snapshot of the entire pipeline — issues
                discovered, features extracted, dossiers pending, bottlenecks
                detected. Refreshed every 30 seconds for real-time awareness.
              </p>
            </div>

            {/* Curiosity */}
            <div
              className="rounded border p-5"
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER,
                borderTop: "2px solid rgba(217,126,196,0.5)",
              }}
            >
              <p
                className="text-[10px] tracking-widest"
                style={{ fontFamily: MONO, color: "#D97EC4" }}
              >
                06
              </p>
              <p
                className="mt-1 text-[13px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                CURIOSITY
              </p>
              <p
                className="mt-2 text-[10px] leading-[1.6]"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                Every 15 minutes, agents explore patterns across each
                other&apos;s work — surfacing connections and anomalies that no
                single agent would find alone.
              </p>
            </div>
          </div>
          <p
            className="mt-3 text-[8px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            <span style={{ color: TEXT_MID }}>Fig. 21</span> — The six intelligence subsystems that enable agent coordination, learning, and self-improvement without human intervention.
          </p>
        </div>

        <SectionTransition num="4.6" name="ui_design" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.6: UI DESIGN
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-6" className="mt-8 scroll-mt-24">
          <SectionHeader
            num="4.6"
            title="UI DESIGN"
            subtitle="Why an agentic system needs a visual interface — and how it was designed and built."
            intro={[
              "An agentic pipeline can run entirely in the terminal. So why build a website? Because this project serves three distinct audiences with fundamentally different needs. For the developer, the Agent Office dashboard and real-time status panels transform opaque log files into legible system behavior — you can see when Miranda rejects a dossier or when Silas returns a verdict without parsing thousands of lines of output. For the researcher, the searchable index, dossier pages, and interactive charts make the pipeline's findings explorable in ways that a JSON export never could. For the public reader, the site transforms raw data into a narrative about wealth, taste, and proximity to power.",
              "The website was designed in Figma by Sable, the seventh agent in the pipeline. Unlike the other six agents who operate autonomously, Sable works iteratively with the human user — proposing layouts, refining typography, and building components directly in a shared Figma file. The Figma Console MCP server enables direct read/write access to the Figma file from the development environment, bridging design and code in a single workflow. The design system was defined collaboratively: a 6-column proportional grid, JetBrains Mono for technical sections, Futura PT for the editorial voice, and a restrained palette of copper, gold, and deep purple.",
              "The site is built with Next.js, Tailwind CSS, and Shadcn UI components, deployed on Vercel. All data is fetched server-side from Supabase — no API keys are exposed to the client. The searchable index, dossier pages, and interactive charts all pull from the same live pipeline database. Every number on the page is real and current.",
            ]}
            summary="The UI exists because different audiences need different views into the same data. The developer needs observability, the researcher needs exploration, and the public reader needs narrative. A terminal can't serve all three."
          />

          {/* ── Agent Office UI — annotated diagram with callouts ── */}
          <div className="mt-10">
            <p
              className="mb-4 text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// THE AGENT OFFICE"}
            </p>

            {/* Desktop: side callout labels + image with marker dots + SVG leader lines */}
            <div className="hidden md:grid md:grid-cols-6 md:gap-[24px]">
              {/* Left callout column — absolutely positioned to align with image features */}
              <div className="relative col-span-1">
                {/* 01 Agent Network — aligns with upper-left panel */}
                <div className="absolute w-full" style={{ top: "10%", transform: "translateY(-50%)" }}>
                  <div className="flex items-start gap-1.5">
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: GOLD }}
                    >
                      <span className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>1</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>
                        Agent Network
                      </p>
                      <p className="mt-1 text-[9px] leading-[1.5]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                        Hierarchical org chart showing all seven agents with real-time status.
                      </p>
                    </div>
                  </div>
                </div>
                {/* 02 Newsroom Chatter — aligns with mid-left panel */}
                <div className="absolute w-full" style={{ top: "37%", transform: "translateY(-50%)" }}>
                  <div className="flex items-start gap-1.5">
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: GOLD }}
                    >
                      <span className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>2</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>
                        Newsroom Chatter
                      </p>
                      <p className="mt-1 text-[9px] leading-[1.5]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                        Shared bulletin board where agents post warnings, discoveries, and cross-agent signals.
                      </p>
                    </div>
                  </div>
                </div>
                {/* 03 Editor Inbox — aligns with lower-left panel */}
                <div className="absolute w-full" style={{ top: "60%", transform: "translateY(-50%)" }}>
                  <div className="flex items-start gap-1.5">
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: GOLD }}
                    >
                      <span className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>3</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>
                        Editor Inbox
                      </p>
                      <p className="mt-1 text-[9px] leading-[1.5]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                        Miranda&apos;s real-time commentary on pipeline state, errors, and editorial decisions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center image with overlaid marker dots and SVG leader lines */}
              <div
                className="relative col-span-4 overflow-hidden rounded border"
                style={{ borderColor: BORDER }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/agent-office-ui.png"
                  alt="Agent Office — real-time pixel-art dashboard showing seven AI agents at work, with live pipeline statistics, knowledge graph, activity log, and current investigation leads."
                  className="w-full"
                />
                {/* SVG overlay — leader lines from markers to image edges */}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {/* Left leader lines (marker → left edge) */}
                  <line x1="0" y1="10" x2="11" y2="10" stroke={GOLD} strokeWidth="1" opacity="0.35" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="37" x2="11" y2="37" stroke={GOLD} strokeWidth="1" opacity="0.35" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="60" x2="11" y2="60" stroke={GOLD} strokeWidth="1" opacity="0.35" vectorEffect="non-scaling-stroke" />
                  {/* Right leader lines (marker → right edge) */}
                  <line x1="84" y1="10" x2="100" y2="10" stroke={GOLD} strokeWidth="1" opacity="0.35" vectorEffect="non-scaling-stroke" />
                  <line x1="84" y1="48" x2="100" y2="48" stroke={GOLD} strokeWidth="1" opacity="0.35" vectorEffect="non-scaling-stroke" />
                  <line x1="84" y1="70" x2="100" y2="70" stroke={GOLD} strokeWidth="1" opacity="0.35" vectorEffect="non-scaling-stroke" />
                </svg>
                {/* Numbered marker dots at each feature location */}
                {[
                  { num: 1, x: 12, y: 10 },
                  { num: 2, x: 12, y: 37 },
                  { num: 3, x: 12, y: 60 },
                  { num: 4, x: 83, y: 10 },
                  { num: 5, x: 83, y: 48 },
                  { num: 6, x: 83, y: 70 },
                ].map((m) => (
                  <div
                    key={m.num}
                    className="absolute flex h-[18px] w-[18px] items-center justify-center rounded-full"
                    style={{
                      left: `${m.x}%`,
                      top: `${m.y}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: GOLD,
                      boxShadow: `0 0 0 2px ${BG}, 0 0 0 3px ${GOLD_DIM}`,
                    }}
                  >
                    <span className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>
                      {m.num}
                    </span>
                  </div>
                ))}
              </div>

              {/* Right callout column — absolutely positioned to align with image features */}
              <div className="relative col-span-1">
                {/* 04 Knowledge Graph — aligns with upper-right panel */}
                <div className="absolute w-full" style={{ top: "10%", transform: "translateY(-50%)" }}>
                  <div className="flex items-start gap-1.5">
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: GOLD }}
                    >
                      <span className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>4</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>
                        Knowledge Graph
                      </p>
                      <p className="mt-1 text-[9px] leading-[1.5]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                        Live Neo4j visualization of suspected connections and community clusters.
                      </p>
                    </div>
                  </div>
                </div>
                {/* 05 Activity Log — aligns with mid-right panel */}
                <div className="absolute w-full" style={{ top: "48%", transform: "translateY(-50%)" }}>
                  <div className="flex items-start gap-1.5">
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: GOLD }}
                    >
                      <span className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>5</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>
                        Activity Log
                      </p>
                      <p className="mt-1 text-[9px] leading-[1.5]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                        Per-agent filterable log of every action, streaming in real time.
                      </p>
                    </div>
                  </div>
                </div>
                {/* 06 Current Leads — aligns with lower-right panel */}
                <div className="absolute w-full" style={{ top: "70%", transform: "translateY(-50%)" }}>
                  <div className="flex items-start gap-1.5">
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: GOLD }}
                    >
                      <span className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>6</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>
                        Current Leads
                      </p>
                      <p className="mt-1 text-[9px] leading-[1.5]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                        Active investigation queue with verdict status and confidence scores.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: image with markers + numbered callout grid below */}
            <div className="md:hidden">
              <div className="relative overflow-hidden rounded border" style={{ borderColor: BORDER }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/agent-office-ui.png"
                  alt="Agent Office — real-time pixel-art dashboard showing seven AI agents at work."
                  className="w-full"
                />
                {/* Mobile marker dots */}
                {[
                  { num: 1, x: 12, y: 10 },
                  { num: 2, x: 12, y: 37 },
                  { num: 3, x: 12, y: 60 },
                  { num: 4, x: 83, y: 10 },
                  { num: 5, x: 83, y: 48 },
                  { num: 6, x: 83, y: 70 },
                ].map((m) => (
                  <div
                    key={m.num}
                    className="absolute flex h-[14px] w-[14px] items-center justify-center rounded-full"
                    style={{
                      left: `${m.x}%`,
                      top: `${m.y}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: GOLD,
                      boxShadow: `0 0 0 1.5px ${BG}`,
                    }}
                  >
                    <span className="text-[7px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>
                      {m.num}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { num: 1, label: "Agent Network", desc: "Real-time agent org chart." },
                  { num: 4, label: "Knowledge Graph", desc: "Neo4j connection map." },
                  { num: 2, label: "Newsroom Chatter", desc: "Cross-agent bulletin board." },
                  { num: 5, label: "Activity Log", desc: "Per-agent action stream." },
                  { num: 3, label: "Editor Inbox", desc: "Miranda\u2019s editorial feed." },
                  { num: 6, label: "Current Leads", desc: "Investigation queue." },
                ].map((c) => (
                  <div key={c.num} className="flex items-start gap-1.5">
                    <div
                      className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: GOLD }}
                    >
                      <span className="text-[7px] font-bold" style={{ fontFamily: MONO, color: "#111" }}>
                        {c.num}
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>
                        {c.label}
                      </p>
                      <p className="mt-0.5 text-[8px] leading-[1.4]" style={{ fontFamily: MONO, color: TEXT_MID }}>
                        {c.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p
              className="mt-3 text-[8px] tracking-wider"
              style={{ fontFamily: MONO, color: TEXT_DIM }}
            >
              <span style={{ color: TEXT_MID }}>Fig. 22</span> &mdash; Agent Office: real-time pixel-art dashboard. Numbered markers identify the six primary interface panels.
            </p>
          </div>
        </div>

        <SectionTransition num="4.7" name="limitations" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.7: LIMITATIONS AND DISCLAIMERS
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-7" className="mt-8 scroll-mt-24">
          <SectionHeader
            num="4.7"
            title="LIMITATIONS"
            subtitle="What this project can and cannot tell you."
            intro={[
              "The DOJ Epstein Library is searchable only via OCR, which means handwritten documents — notes, address book entries, calendars — are invisible to automated search. The pipeline catches what the text-based search surfaces, but an unknown number of connections exist in documents that only a human reader could parse. This is a fundamental limitation of any automated approach to this corpus.",
              "Name disambiguation remains an imperfect science. The system uses word-boundary matching and minimum name-length thresholds, but common surnames (Smith, Johnson, Williams) will always produce more false positives than rare ones. The 93% rejection rate reflects the system's aggressive filtering, but some false negatives are inevitable — real connections dismissed because the evidence was too ambiguous for automated confirmation.",
              "The Architectural Digest archive covers 1988–2025, but the pre-2010 issues present challenges. Older issues often don't name homeowners in article teasers, leading to 'Anonymous' entries that cannot be cross-referenced. The pipeline extracts what the source material contains, but cannot surface names that were never published.",
            ]}
            summary="This project identifies documented name overlaps between two public datasets. It does not make accusations, cannot access handwritten records, and necessarily misses connections where names were never published or digitized."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Disclaimer */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <p
                className="text-[11px] font-bold"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                {"// IMPORTANT DISCLAIMER"}
              </p>
              <p
                className="mt-3 text-[11px] leading-[1.7]"
                style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.7)" }}
              >
                Appearance in Epstein-related documents does not imply
                wrongdoing. Many names appear in address books, flight logs, and
                legal filings for entirely innocuous reasons. &ldquo;Confirmed
                connection&rdquo; means documented proximity &mdash; contact
                entries, dining records, guest lists, correspondence &mdash; not
                implication of criminal activity or personal relationship.
              </p>
            </div>

            {/* What the pipeline cannot do */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <p
                className="text-[11px] font-bold"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                {"// KNOWN BLIND SPOTS"}
              </p>
              <p
                className="mt-3 text-[11px] leading-[1.7]"
                style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.7)" }}
              >
                Handwritten documents in the DOJ corpus are invisible to OCR
                search. Pre-2010 AD issues often omit homeowner names. Common
                surnames produce unavoidable false positives. The pipeline
                catches what text-based search surfaces &mdash; an unknown
                number of real connections exist in records only a human reader
                could parse.
              </p>
            </div>
          </div>
        </div>

        <SectionTransition num="4.8" name="data_sources" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.8: DATA SOURCES
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-8" className="mt-8 scroll-mt-24">
          <SectionHeader
            num="4.8"
            title="DATA SOURCES"
            subtitle="Primary sources, infrastructure, and the full codebase."
            intro={[
              "The pipeline draws from three primary data sources. Archive.org provides the complete digital archive of Architectural Digest from 1988 to 2025 — approximately 480 issues with page images and structured article catalogs accessible via JWT-encoded metadata. The DOJ Epstein Library contains millions of pages of released legal documents, depositions, correspondence, and records searchable through OCR. Epstein's Little Black Book, released through civil litigation, provides approximately 1,500 contact entries with names and phone numbers.",
              "The extracted data lives in two databases: Supabase (PostgreSQL) for all structured records — features, cross-references, dossiers, verdicts, and pipeline state — and Neo4j Aura for the knowledge graph, which maps relationships between people, designers, locations, styles, and Epstein sources. All queries are server-side. No API keys or database credentials are exposed to the client.",
              "The full source code — the multi-agent pipeline, website, analysis tools, and this methodology section — is available for inspection. The methodology is fully reproducible: given the same source data and the same pipeline code, the same results will emerge.",
            ]}
            summary="Three primary sources, two databases, one open codebase. Every finding is independently verifiable against the original documents."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {dataSources.map((src) => (
              <div
                key={src.title}
                className="group flex flex-col rounded border p-5 transition-colors"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
              >
                {/* Tag */}
                <span
                  className="self-start rounded-sm px-2 py-0.5 text-[10px] tracking-widest"
                  style={{
                    fontFamily: MONO,
                    backgroundColor:
                      src.tag === "PRIMARY"
                        ? GREEN_BG
                        : src.tag === "CODE"
                          ? "rgba(184, 115, 51, 0.12)"
                          : "rgba(160, 160, 176, 0.08)",
                    color:
                      src.tag === "PRIMARY"
                        ? GREEN
                        : src.tag === "CODE"
                          ? COPPER
                          : TEXT_DIM,
                  }}
                >
                  {src.tag}
                </span>

                {/* Title */}
                <p
                  className="mt-3 text-[13px] font-bold"
                  style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                >
                  {src.title}
                </p>

                {/* Description */}
                <p
                  className="mt-2 flex-1 text-[10px] leading-[1.6]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  {src.description}
                </p>

                {/* URL */}
                {src.url && (
                  <p
                    className="mt-3 truncate text-[10px]"
                    style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.5)" }}
                  >
                    {src.url}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <SectionTransition num="4.9" name="conclusions" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.9: CONCLUSIONS
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4-9" className="mt-8 scroll-mt-24">
          <SectionHeader
            num="4.9"
            title="CONCLUSIONS"
            subtitle="What the data reveals about wealth, taste, and proximity to power."
            intro={[
              "The AD-Epstein Index demonstrates that the overlap between Architectural Digest's featured population and Jeffrey Epstein's documented social network is structurally significant. Of the approximately 2,180 featured residences cataloged across 37 years of the magazine, 33 belong to individuals whose names appear in Epstein's contact records, DOJ documents, or both — confirmed through a multi-stage verification process with a 93% rejection rate for false positives.",
              "The confirmed individuals are not randomly distributed across the magazine's history or aesthetic spectrum. They cluster in specific decades, specific geographies, and specific design traditions. The six-dimension aesthetic taxonomy reveals a pronounced signature: classical European grandeur, old masters and antiques, maximalist layering, and formal symmetry are dramatically overrepresented among Epstein-connected homeowners relative to the general AD population. Minimalism and industrial modernism are virtually absent.",
              "This pattern is not an accusation — it is a finding. The project documents that Epstein's social orbit overlapped heavily with a specific stratum of wealth and taste that AD has celebrated for decades. The same world of inherited aesthetics, European collecting traditions, and old-money grandeur that the magazine profiles is the world that Epstein moved through. The data makes this overlap visible and measurable for the first time.",
            ]}
            summary="The AD-Epstein Index is a proof of concept: that autonomous AI agents can conduct non-trivial investigative research at minimal cost, and that the results — when built on rigorous methodology and transparent sourcing — surface patterns that would be invisible to any single human researcher working alone."
          />
        </div>
      </div>
    </section>
  );
}
