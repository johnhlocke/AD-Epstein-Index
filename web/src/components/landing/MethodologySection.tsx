"use client";

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
    accent: "#5B8DEF",
    description: "Soft-spoken and deferential, but with granite-like stubbornness. Thinks in grids and patterns, methodically filling gaps in the archive with obsessive precision. He outlasts every obstacle.",
    quote: "There\u2019s a gap in the grid and it shouldn\u2019t be there.",
  },
  {
    name: "Casey",
    role: "Courier",
    sprite: "/agents/courier_front_trans.png",
    accent: "#9B7EDB",
    description: "Chose peace in logistics over chaos. Speaks in manifests and delivery metrics with dry humor, moving packages and the whole pipeline with quiet, unshakeable competence.",
    quote: "Package delivered.",
  },
  {
    name: "Elias",
    role: "Reader",
    sprite: "/agents/reader_front_trans.png",
    accent: "#4ECDC4",
    description: "A coiled spring of fierce intensity who reads PDFs like a discipline. Seeks euphoria through resistance \u2014 fighting cursed scans and broken layouts until every null is zero and every page is conquered.",
    quote: "Did you SEE that? Zero nulls. ZERO.",
  },
  {
    name: "Silas",
    role: "Detective",
    sprite: "/agents/detective_front_trans.png",
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
      <p
        className="text-[11px] tracking-widest"
        style={{ fontFamily: MONO, color: "#B87333" }}
      >
        SECTION {num}
      </p>
      <h3
        className="mt-3 text-[24px] font-bold leading-[1.1] tracking-tight"
        style={{
          fontFamily: MONO,
          color: TEXT_LIGHT,
          maxWidth: CONTENT_NARROW,
        }}
      >
        {title}
      </h3>
      <p
        className="mt-3 text-[15px] leading-[1.4]"
        style={{
          fontFamily: MONO,
          color: TEXT_MID,
          maxWidth: CONTENT_NARROW,
        }}
      >
        {subtitle}
      </p>
      <div className="mt-8" style={{ borderTop: `1px solid ${BORDER}` }} />

      {/* Intro paragraphs — 4 grid columns wide */}
      <div
        className="mt-10 flex flex-col gap-5 text-[14px] leading-[1.7]"
        style={{
          fontFamily: MONO,
          color: TEXT_MID,
          maxWidth: CONTENT_NARROW,
        }}
      >
        {intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p
          className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ fontFamily: MONO, color: "#B87333" }}
        >
          Summary
        </p>
        <p className="-mt-2">{summary}</p>
      </div>

      <div className="mt-10" style={{ borderTop: `1px solid ${BORDER}` }} />
    </div>
  );
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

export function AgentMethodologySection({ stats }: MethodologyProps) {
  return (
    <section
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

          {/* Abstract body — per-paragraph sidenotes via relative/absolute */}
          <div
            className="mt-6 flex flex-col gap-6 text-[15px] leading-[1.8]"
            style={{
              fontFamily: "var(--font-inter), Inter, sans-serif",
              color: TEXT_MID,
            }}
          >
            {/* Paragraph 1 + DOJ Library */}
            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>
                This project began with a simple enough question: &ldquo;How many
                of the high-profile people gracing the glossy pages of
                Architectural Digest are also named in the xeroxed,
                Justice-Department-cataloged, unredacted public records of Jeffrey
                Epstein&apos;s social network?&rdquo;<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
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
                  The DOJ Epstein Library
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Millions of pages of depositions, correspondence, flight logs, and contact records released by the U.S. Department of Justice. Searchable via OCR &mdash; handwritten documents are not indexed.
                </p>
                <a href="https://www.justice.gov/epstein" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  justice.gov/epstein &rarr;
                </a>
              </div>
            </div>

            {/* Paragraph 2 + Pipeline Cost */}
            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>
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
                it wasn&apos;t even worth attempting to quantify.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
              </p>
              <div
                className="absolute z-10 hidden pl-4 md:block"
                style={{
                  top: "5em",
                  left: "calc(var(--content-narrow) + 24px)",
                  width: "calc(100% - var(--content-narrow) - 24px)",
                  borderLeft: `2px solid ${COPPER}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  Pipeline Cost
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  480 issues, 2,180 features, 476 cross-references, 185 dossiers &mdash; approximately $55 in API calls and ~18 hours of wall-clock time. The marginal cost of asking a new question is near zero.
                </p>
              </div>
            </div>

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
            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>
                Again, AI is a tool. And a tool was needed to technically answer
                important questions that would otherwise be too impractical to ask,
                at scale, and at great speed. It&apos;s not feasible by a single
                researcher. Yet that doesn&apos;t make AI smarter than the
                researcher. It makes the researcher capable of asking bigger
                questions. In fact, that is what happened, as you can see if you
                take a look at the &ldquo;Aesthetic Methodology&rdquo; section.
                Working through the technical challenges of making this work, I
                experienced firsthand what is challenging with &ldquo;vibe
                coding&rdquo;<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>, what&apos;s actually, you know, pretty amazing, and
                what at first blush seemed like it should be really easy but
                actually took hours of frustrating detail to get right, all
                enhanced my creativity. I questioned some of my initial
                assumptions, thought deeper about &ldquo;how&rdquo; data flows
                through a pipeline, and moved in scale and scope that I
                didn&apos;t think possible before I started.
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
                  &ldquo;Vibe Coding&rdquo;
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  Term coined by Andrej Karpathy (Feb 2025). A style of programming where you describe what you want to an AI and iterate on the output rather than writing every line. The human steers; the AI executes.
                </p>
              </div>
            </div>

            {/* Paragraph 4 + ICIJ — min-height ensures room for tall sidenote before para 5 */}
            <div className="relative md:min-h-[280px]">
              <p style={{ maxWidth: CONTENT_NARROW }}>
                What follows is a detailed account of this modular, multi-agent
                workflow that processes document corpora, extracts structured
                entities, cross-references them against external records,
                investigates flagged matches, and produces an auditable trail of
                documentation for every conclusion. This specific case study here
                concerns a design magazine and a global criminal network. But
                structurally, the system could be aimed at campaign finance records,
                nonprofit boards, corporate directorships, university trustees, and
                cultural institutions gala attendees. That initial question can
                change; the pipeline remains.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
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
                  src="/sidenotes/icij-graph.jpg"
                  alt="ICIJ entity-relationship graph showing persons, companies, and addresses linked by directorship and shareholder relationships"
                  className="mb-2 grayscale"
                  style={{
                    border: `1px solid ${BORDER}`,
                    maxWidth: "calc(50% - 12px)",
                    maxHeight: 120,
                    objectFit: "cover",
                    filter: "grayscale(1) contrast(1.1)",
                  }}
                />
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                  Precedent: ICIJ Panama Papers
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  The ICIJ&apos;s Panama Papers investigation (2016) used Neo4j, Apache Tika, Tesseract OCR, and NLP entity recognition to process 11.5 million leaked documents across 400 journalists in 80 countries.
                </p>
                <a href="https://neo4j.com/case-studies/the-international-consortium-of-investigative-journalists-icij/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                  neo4j.com/case-studies/icij &rarr;
                </a>
              </div>
            </div>

            {/* Paragraph 5 + Confirmed ≠ Guilty */}
            <div className="relative">
              <p style={{ maxWidth: CONTENT_NARROW }}>
                This document explains how that pipeline works, where it succeeds,
                where it fails, and where the borders between human judgment and
                machine autonomy are still being drawn.<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
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
                  Confirmed &ne; Guilty
                </p>
                <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                  &ldquo;Confirmed connection&rdquo; means documented proximity &mdash; contact entries, dining records, guest lists, correspondence. It does not imply wrongdoing or a personal relationship with Epstein.
                </p>
              </div>
            </div>
          </div>

          {/* Research Questions */}
          <div className="mt-10">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ fontFamily: MONO, color: "#B87333", maxWidth: CONTENT_NARROW }}
            >
              Research Questions
            </p>
            <p
              className="mt-4 text-[15px] leading-[1.8]"
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                color: TEXT_LIGHT,
                maxWidth: CONTENT_NARROW,
              }}
            >
              Can an autonomous AI pipeline read, interpret, and evaluate
              thousands of documents with enough semantic and contextual
              understanding to make rapid, defensible investigative judgements at
              scale, while preserving a transparent, auditable chain of
              reasoning?
            </p>
            <p
              className="mt-4 text-[15px] leading-[1.8]"
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                color: TEXT_MID,
                maxWidth: CONTENT_NARROW,
              }}
            >
              From that flowed more difficult design problems:
            </p>
            <div
              className="mt-3 flex flex-col gap-2 text-[15px] leading-[1.8]"
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                color: TEXT_MID,
              }}
            >
              {/* Q1 + Society of Mind note */}
              <div className="relative">
                <p className="pl-5" style={{ maxWidth: CONTENT_NARROW }}>
                  <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                  How do you decompose an open-ended investigation into discrete stages with clean handoffs?<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
                </p>
                <div
                  className="absolute z-10 hidden pl-4 md:block"
                  style={{
                    top: "-3em",
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    Minsky, &ldquo;The Society of Mind&rdquo;
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Marvin Minsky&apos;s 1986 thesis that intelligence emerges from communities of simple, specialized agents &mdash; not monolithic reasoning. The direct intellectual ancestor of multi-agent pipelines.
                  </p>
                  <a href="https://www.simonandschuster.com/books/Society-Of-Mind/Marvin-Minsky/9780671657130" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    Simon &amp; Schuster &rarr;
                  </a>
                </div>
              </div>

              {/* Q2 — no sidenote */}
              <p className="pl-5" style={{ maxWidth: CONTENT_NARROW }}>
                <span style={{ marginLeft: "-1.25rem", marginRight: "0.55rem", color: TEXT_MID }}>&bull;</span>
                Can you build an autonomous system, without a human in the loop, that handles ambiguity in names responsibly and avoids false positives?
              </p>

              {/* Q3 + Heuer note */}
              <div className="relative">
                <p className="pl-5" style={{ maxWidth: CONTENT_NARROW }}>
                  <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                  How do you encode evidentiary standards so the system distinguishes coincidence from confirmation?<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
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
                    Heuer, &ldquo;Psychology of Intelligence Analysis&rdquo;
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    The CIA&apos;s 1999 manual on cognitive bias in evidence evaluation. Heuer&apos;s &ldquo;Analysis of Competing Hypotheses&rdquo; framework is essentially what the Detective&apos;s verdict tiers encode in code.
                  </p>
                  <a href="https://www.cia.gov/resources/csi/static/Pyschology-of-Intelligence-Analysis.pdf" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    CIA.gov (PDF) &rarr;
                  </a>
                </div>
              </div>

              {/* Q4 — no sidenote */}
              <p className="pl-5" style={{ maxWidth: CONTENT_NARROW }}>
                <span style={{ marginLeft: "-1.25rem", marginRight: "0.55rem", color: TEXT_MID }}>&bull;</span>
                What infrastructure do agents need beyond a system prompt (things like memory, communication, reflection) to sustain quality over thousands of sequential decisions?
              </p>

              {/* Q5 + Shneiderman note */}
              <div className="relative pb-16 md:pb-0">
                <p className="pl-5" style={{ maxWidth: CONTENT_NARROW }}>
                  <span className="absolute" style={{ left: "0.35em", color: TEXT_MID }}>&bull;</span>
                  What does a purpose-built interface give you that a terminal can&apos;t &mdash; and does making the system visible change how much you trust it?<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
                </p>
                <div
                  className="absolute z-10 hidden pl-4 md:block"
                  style={{
                    top: "2.5em",
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    Shneiderman, &ldquo;Human-Centered AI&rdquo;
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Ben Shneiderman&apos;s 2022 argument that AI systems need oversight dashboards, not terminal logs. His two-dimensional framework plots human control against computer automation.
                  </p>
                  <a href="https://global.oup.com/academic/product/human-centered-ai-9780192845290" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    Oxford University Press &rarr;
                  </a>
                </div>
              </div>
            </div>
            <p
              className="mt-4 pb-20 text-[15px] leading-[1.8] md:pb-24"
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                color: TEXT_MID,
                maxWidth: CONTENT_NARROW,
              }}
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
              num: "1",
              title: "The Pipeline",
              body: "The system operates as a five-stage sequential pipeline: data acquisition, feature extraction, cross-referencing, investigation, and editorial review. Each stage has a defined input, output, and a specialized agent. The pipeline processed 1,396 magazines and 4,081 features.",
            },
            {
              num: "2",
              title: "Multi-Agent Architecture",
              body: "Seven specialized agents coordinated through a central Editor. This hub-and-spoke architecture prevents contradictory updates, ensures a single auditable decision trail, and makes it possible to swap out any agent without affecting the others.",
            },
            {
              num: "3",
              title: "Personality as Architecture",
              body: "Why do these agents have names, archetypes, and voices? Does it matter? The short answer: it depends on the task, and the academic literature is genuinely split. For judgment calls, carefully designed personas measurably shift behavior in useful ways.",
            },
            {
              num: "4",
              title: "Investigation Methodology",
              body: "Can an AI differentiate between what is genuine and what is digital noise? The investigation stage is the most sensitive part of the system \u2014 each dossier records what was consulted and why the conclusion followed.",
            },
            {
              num: "5",
              title: "Intelligence Infrastructure",
              body: "Behind the agents sits shared infrastructure: a knowledge graph mapping all connections, episodic memory allowing agents to recall prior decisions, and reflection loops where the Editor reviews patterns in past outcomes.",
            },
            {
              num: "6",
              title: "UI Interface and Transparency",
              body: "In many ways an AI system is a black box. Two front-ends were built: an internal dashboard monitoring pipeline state and cost, and a public-facing site where every feature and every verdict can be browsed.",
            },
            {
              num: "7",
              title: "Key Challenges and Limitations",
              body: "No system built on language models is immune to failure. Surname collisions, OCR limitations in handwritten documents, and calibrating autonomy remain open problems. Approximately 20% of confirmed cases are routed for manual review.",
            },
            {
              num: "8",
              title: "Data Sources",
              body: "Three primary sources: the Cond\u00e9 Nast digital archive (JWT-encoded metadata + Azure page images), Epstein\u2019s Little Black Book (local regex matching), and the DOJ Epstein document library (browser-automated OCR search).",
            },
            {
              num: "9",
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
                href={`#section-${sec.num}`}
                className="mt-auto inline-block pt-3 text-[9px] uppercase tracking-[0.12em] no-underline transition-opacity hover:opacity-70"
                style={{ fontFamily: MONO, color: "rgba(120, 140, 155, 0.8)" }}
              >
                Jump to section &darr;
              </a>
            </div>
          ))}
        </div>

        {/* ── Pull Quote: Knuth ── */}
        <div className="mt-28 mb-20 flex flex-col items-center px-4 md:mt-36 md:mb-28">
          <div
            className="relative w-full max-w-2xl"
            style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}
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

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: THE PIPELINE
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-1" className="mt-24 scroll-mt-24">
          {/* Section 1 header — inline so intro text sits beside pipeline flow */}
          <p
            className="text-[11px] tracking-widest"
            style={{ fontFamily: MONO, color: "#B87333" }}
          >
            SECTION 1
          </p>
          <h3
            className="mt-3 text-[24px] font-bold leading-[1.1] tracking-tight"
            style={{
              fontFamily: MONO,
              color: TEXT_LIGHT,
              maxWidth: CONTENT_NARROW,
            }}
          >
            THE PIPELINE
          </h3>
          <p
            className="mt-3 text-[15px] leading-[1.4]"
            style={{
              fontFamily: MONO,
              color: TEXT_MID,
              maxWidth: CONTENT_NARROW,
            }}
          >
            How a magazine URL becomes a confirmed or rejected connection with a full evidentiary trail
          </p>
          <div className="mt-8" style={{ borderTop: `1px solid ${BORDER}` }} />

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
                  JWT-encoded article catalog, a structured JSON object containing
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
                    className="mb-2 rounded"
                    style={{
                      maxWidth: "calc(50% - 12px)",
                      maxHeight: 140,
                      filter: "grayscale(1) contrast(1.1)",
                    }}
                  />
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    The AD Archive
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Cond&eacute; Nast&apos;s complete digital archive. Each issue page embeds a JWT-encoded article catalog &mdash; structured JSON with title, teaser, designer credit, and page range. No OCR required.
                  </p>
                  <a href="https://archive.architecturaldigest.com/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    archive.architecturaldigest.com &rarr;
                  </a>
                </div>
              </div>

              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: COPPER, maxWidth: CONTENT_NARROW }}
              >
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
                  { label: "Data acquisition", agent: "Scout", agentColor: GREEN },
                  { label: "Feature extraction", agent: "Courier", agentColor: "#4ECDC4" },
                  { label: "Cross-referencing", agent: "Detective", agentColor: "#CC4040" },
                  { label: "Investigation", agent: "Researcher", agentColor: "#D97EC4" },
                  { label: "Editorial review", agent: "Editor", agentColor: COPPER },
                  { label: "Report design", agent: "Designer", agentColor: SLATE },
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
                    style={{ width: "calc((100% - 5 * 24px) / 6)", height: 500 }}
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
                            className="text-[9px] tracking-[0.08em] leading-tight text-center"
                            style={{ fontFamily: MONO, color: TEXT_LIGHT, maxWidth: "80%" }}
                          >
                            {node.label}
                          </span>
                          <span
                            className="mt-0.5 text-[7px] tracking-wider text-center"
                            style={{ fontFamily: MONO, color: node.agentColor }}
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
                itself. A Reader agent was originally designed to
                &ldquo;read&rdquo; or extract data from scanned PDFs, but this
                process proved cumbersome and ultimately unnecessary after
                discovering the embedded metadata source.
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
                  Detective&apos;s inbox. There, he runs two checks in rapid
                  succession. First, an instant search of Jeffrey Epstein&apos;s
                  Little Black Book<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> &mdash; a 95-page contact directory seized
                  during the original 2008 investigation. The Black Book contains
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
                      {" "}<a href="/fullgraph" style={{ color: "rgba(184, 115, 51, 0.6)" }}>Full graph &rarr;</a>
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
                    className="mb-2 rounded"
                    style={{
                      maxWidth: "calc(50% - 12px)",
                      maxHeight: 140,
                      filter: "grayscale(1) contrast(1.1)",
                    }}
                  />
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    The Zuckerman Dossier
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Lesley Groff, Epstein&apos;s chief scheduler, coordinated meetings at 9 E. 71st St. Henry Kissinger &mdash; also confirmed in the Black Book &mdash; appears in the same AD feature as a personal friend of Zuckerman.
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

              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: COPPER, maxWidth: CONTENT_NARROW }}
              >
                False Positives
              </p>
              <div className="relative">
                <p style={{ maxWidth: CONTENT_NARROW }}>
                  Now consider a false positive. The system checks every name,
                  including &ldquo;Francis Ford Coppola,&rdquo; who was featured
                  in a September 1995 issue where the director shared his jungle
                  retreat in Belize with AD. The DOJ library <em>does</em> return
                  results for &ldquo;Coppola.&rdquo; However, by reading the
                  context of the individual PDFs, the Detective understands that
                  this is actually Donato Coppola excitedly reaching out to
                  Jeffrey Epstein to set up a meeting. And then there is also
                  Scott Coppola,<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> who was shown emailing Jeffrey Epstein&apos;s
                  girlfriend Karina Shuliak in a Facebook message in 2011. Same
                  last name, but very different people. The Detective&apos;s
                  verdict: no match. The pipeline flags the name, investigates it
                  with the same rigor, and moves on. No human had to intervene to
                  catch the false positive. The system&apos;s evidence standards
                  caught it automatically, while a careless system would have
                  stopped at the surname.
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
                    src="/sidenotes/coppola-fb.png"
                    alt="Scott Coppola Facebook message to Karina Shuliak, June 2011"
                    className="mb-2 rounded"
                    style={{
                      maxWidth: "calc(50% - 12px)",
                      maxHeight: 140,
                      filter: "grayscale(1) contrast(1.1)",
                    }}
                  />
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    DOJ Source Document
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    The actual DOJ document showing Scott Coppola&apos;s Facebook message to Karina Shuliak &mdash; not Francis Ford Coppola.
                  </p>
                  <a href="https://www.justice.gov/epstein/files/DataSet%209/EFTA00575663.pdf" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    EFTA00575663.pdf &rarr;
                  </a>
                </div>
              </div>

              {/* ── Fig. 3: Coppola rejection tree ── */}
              <div style={{ maxWidth: CONTENT_NARROW }}>
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
                      AD Feature: <span style={{ color: TEXT_LIGHT }}>&ldquo;Francis Ford Coppola&apos;s Jungle Retreat in Belize&rdquo;</span> <span style={{ color: TEXT_DIM }}>&mdash; Sep 1995</span>
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
                          <div className="flex items-baseline gap-2 py-1 pl-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                            <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_MID }}>├</span>
                            <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Donato Coppola</span>
                            <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>&rarr; email to Epstein</span>
                            <span className="ml-auto text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, color: "#CC4040" }}>REJECT</span>
                          </div>
                          <div className="flex items-baseline gap-2 py-1 pl-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                            <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_MID }}>├</span>
                            <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Scott Coppola</span>
                            <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>&rarr; Facebook msg to Shuliak</span>
                            <span className="ml-auto text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, color: "#CC4040" }}>REJECT</span>
                          </div>
                          <div className="flex items-baseline gap-2 py-1 pl-3">
                            <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_MID }}>└</span>
                            <span className="text-[10px]" style={{ fontFamily: MONO, color: TEXT_LIGHT }}>Francis Ford Coppola</span>
                            <span className="text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>&rarr; no connection</span>
                            <span className="ml-auto text-[8px] font-bold tracking-wider" style={{ fontFamily: MONO, color: "#CC4040" }}>REJECT</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[9px]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                      Verdict: <span style={{ color: TEXT_MID }}>NO MATCH</span> &mdash; surname collision, three different individuals
                      {" "}<a href="https://www.wheretheylive.world/dossier/200" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(184, 115, 51, 0.6)" }}>View dossier &rarr;</a>
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
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: COPPER, maxWidth: CONTENT_NARROW }}
              >
                Architecture
              </p>
              <p style={{ maxWidth: CONTENT_NARROW }}>
                Separating each of the agents concerns means that an error in
                extraction doesn&apos;t corrupt the cross-reference, a false
                positive in the Detective stage doesn&apos;t bypass the
                Editor&apos;s review, and every stage produces an intermediate
                output that can be independently audited. If someone questions a
                particular finding, you can trace the exact path: here&apos;s
                the page the name was extracted from, here&apos;s the Black Book
                entry, here are the DOJ documents, here&apos;s the
                Researcher&apos;s analysis, here&apos;s the Editor&apos;s
                reasoning. The pipeline doesn&apos;t just produce a black-box
                conclusion, it produces detailed evidence for those conclusions.
              </p>
              <div className="relative">
                <p style={{ maxWidth: CONTENT_NARROW }}>
                  This is what the literature calls the ReAct pattern:<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span>
                  {" "}interleaving reasoning (&ldquo;this Black Book match is
                  surname-only &mdash; probably a coincidence&rdquo;) with actions
                  (search the DOJ library, query the knowledge graph), observing
                  the results, and reasoning again. This loop underlies most
                  modern LLM agent systems, and every agent in this pipeline
                  implements a version of it. The Detective doesn&apos;t just
                  pattern-match a name against a database. It reasons about the
                  quality of the match, decides what additional evidence to seek,
                  evaluates what it finds, and produces a verdict with its
                  reasoning attached.
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
                    src="/sidenotes/react-pattern.png"
                    alt="ReAct pattern diagram — Reason Only, Act Only, and combined Reasoning Traces + Actions loop"
                    className="mb-2 rounded"
                    style={{
                      maxWidth: "calc(50% - 12px)",
                      maxHeight: 140,
                      filter: "grayscale(1) contrast(1.1)",
                    }}
                  />
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    ReAct Pattern
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    Yao et al. (2022). &ldquo;ReAct: Synergizing Reasoning and Acting in Language Models.&rdquo; Agents interleave chain-of-thought reasoning with tool calls, observe results, then reason again.
                  </p>
                  <a href="https://arxiv.org/abs/2210.03629" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[9px]" style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.6)" }}>
                    arxiv.org/abs/2210.03629 &rarr;
                  </a>
                </div>
              </div>
              <div className="relative">
                <p style={{ maxWidth: CONTENT_NARROW }}>
                  It is important to resist the illusion of infallibility. The DOJ
                  search interface is OCR-based,<span className="hidden md:inline" style={{ color: COPPER, fontSize: "11px" }}>{" "}&#9656;</span> which means handwritten
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
                <div
                  className="absolute z-10 hidden pl-4 md:block"
                  style={{
                    top: "4em",
                    left: "calc(var(--content-narrow) + 24px)",
                    width: "calc(100% - var(--content-narrow) - 24px)",
                    borderLeft: `2px solid ${COPPER}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: COPPER }}>
                    OCR Limitations
                  </p>
                  <p className="mt-1.5 text-[10px] leading-[1.6]" style={{ fontFamily: MONO, color: TEXT_DIM }}>
                    The DOJ search engine indexes scanned pages via optical character recognition. Handwritten notes, marginalia, and address book entries with non-standard formatting are largely invisible. The system can only find what the OCR can read.
                  </p>
                </div>
              </div>
              <p style={{ maxWidth: CONTENT_NARROW }}>
                But what it can do is reliably transform ambiguity into
                structured, reviewable decisions at a scale no individual
                researcher could sustain alone. This same pipeline, pointed at a
                different data set, would run the same way. The question may
                change but the architecture stays the same.
              </p>
          </div>

          <div className="mt-10" style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* Full 3-phase Architecture SVG */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pipeline-architecture.svg?v=2"
            alt="System Architecture — Phase 01: Scout, Courier, and Reader agents feeding data through the Editor to Supabase. Phase 02: Detective and Researcher cross-referencing names against DOJ Epstein files and Black Book. Phase 03: Deep aesthetic extraction, Designer agent, Neo4j knowledge graph, and website deployment."
            className="mt-6 w-full rounded"
          />
          <p
            className="mt-3 text-[8px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            <span style={{ color: TEXT_MID }}>Fig. 4</span> — Three-phase system architecture showing data flow from archive discovery through Epstein cross-referencing to website deployment.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: MULTI-AGENT SYSTEM
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-2" className="mt-24 scroll-mt-24">
          <SectionHeader
            num="2"
            title="MULTI-AGENT SYSTEM"
            subtitle="A hub-and-spoke architecture with seven autonomous agents, one editor, zero humans in the loop."
            intro={[
              "The pipeline is powered by seven AI agents organized in a hub-and-spoke architecture. Miranda, the Editor, sits at the center — she assigns every task, reviews every result, and has final authority over every verdict. The six specialist agents (Scout, Courier, Reader, Detective, Researcher, and Designer) receive tasks from Miranda's outbox, execute them independently, and return results through their own outbox.",
              "Each agent runs on a different language model selected for its task profile. Miranda uses Claude Opus for editorial judgment and Sonnet for routine assessments. The Reader uses Gemini for vision tasks like reading magazine pages. The Detective and Researcher use Sonnet for synthesis. Bulk classification tasks use Haiku for cost efficiency. This model-splitting strategy keeps the total API cost under $55 for the entire pipeline.",
              "The agents communicate through asynchronous task queues — not direct messaging. Miranda pushes a Task object to an agent's inbox; the agent pushes a TaskResult to its outbox. This decoupled design means agents can work in parallel without blocking each other, and Miranda can redistribute work if an agent fails or stalls.",
            ]}
            summary="The hub-and-spoke architecture ensures that no data enters the final database without editorial review, while allowing all seven agents to work concurrently on different stages of the pipeline."
          />

          {/* Hub-and-spoke diagram (synced from Figma) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hub-and-spoke.svg?v=3"
            alt="Hub-and-spoke architecture diagram — Miranda (Editor) at center, connected to six agents: Scout, Courier, Reader, Detective, Researcher, and Designer. Shared systems: Supabase, Neo4j, Memory, and Bulletin Board."
            className="mt-10 w-full rounded"
          />
          <p
            className="mt-3 text-[8px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            <span style={{ color: TEXT_MID }}>Fig. 5</span> — Hub-and-spoke topology with Miranda at center coordinating six specialist agents via asynchronous task queues.
          </p>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: PERSONALITY AS ARCHITECTURE
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-3" className="mt-24 scroll-mt-24">
          {/* ── S3 Header (full width) ── */}
          <div>
            <p
              className="text-[11px] tracking-widest"
              style={{ fontFamily: MONO, color: "#B87333" }}
            >
              SECTION 3
            </p>
            <h3
              className="mt-3 text-[24px] font-bold leading-[1.1] tracking-tight"
              style={{
                fontFamily: MONO,
                color: TEXT_LIGHT,
                maxWidth: CONTENT_NARROW,
              }}
            >
              PERSONALITY AS ARCHITECTURE
            </h3>
            <p
              className="mt-3 text-[15px] leading-[1.4]"
              style={{
                fontFamily: MONO,
                color: TEXT_MID,
                maxWidth: CONTENT_NARROW,
              }}
            >
              Why do these autonomous AI agents have names, archetypes, and voices? Does it matter?
            </p>
            <div className="mt-8" style={{ borderTop: `1px solid ${BORDER}` }} />
          </div>

          {/* ── Two-column: Intro text (cols 1-4) + Miranda card (cols 5-6) ── */}
          <div
            className="mt-10 flex flex-col gap-10 md:flex-row md:items-stretch"
            style={{ gap: "24px" }}
          >
            {/* Left — Intro paragraphs (columns 1-4) */}
            <div
              className="flex flex-col gap-5 text-[14px] leading-[1.8] md:flex-[4]"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: TEXT_MID }}
            >
              <p>If we want to dig into this question, there are actually three layers to uncover. It&rsquo;s worth it to take a minute to unpack each because it speaks to the nature of how the agentic system works.</p>

              <p
                className="mt-4 text-[12px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                Layer 1: The System Prompt IS the Agent
              </p>
              <p>When you call an AI model in something like Claude, you are sending it a system prompt. That&rsquo;s just a set of instructions that tells it how to behave. Example: &ldquo;You are a research assistant. Read the following text, do a thorough academic code review, and add footnotes where applicable. Be thorough and precise.&rdquo; In turn, every response the model produces is shaped by that simple prompt.</p>

              <p>An &ldquo;agent&rdquo; in this pipeline is, at its core, just a system prompt plus a task queue. Silas the Detective doesn&rsquo;t exist somewhere as a separate piece of software. He&rsquo;s a set of instructions that get sent to Claude every time we need a given name checked against the Epstein records. Elena the Researcher is a whole different set of instructions sent to the same model, but for a different kind of task.</p>

              <p>So, when we say: &ldquo;the Detective checks a name,&rdquo; what&rsquo;s actually happening is:</p>
              <ol className="ml-6 list-decimal space-y-1">
                <li>The orchestrator pulls a homeowner&rsquo;s name from the queue</li>
                <li>It sends that name to Claude along with Silas&rsquo; system prompt, that includes his methodology, his evidence standards, his decision rules, etc.</li>
                <li>Claude responds as shaped by those instructions.</li>
                <li>Those results get written to a central database.</li>
              </ol>

              <p>Silas being anthropomorphized as a typical &ldquo;terse, sardonic, false positives offend him existentially&rdquo; kind-of-guy is actually not just an added sprinkling of decoration on top of a simple quantitative task. The persona becomes part of his system prompt&mdash;his instructions. This personality steers how this agent approaches ambiguous cases.</p>

              <p
                className="mt-4 text-[12px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                Layer 2: Why a Character Works Better than a Rulebook
              </p>
              <p>Here&rsquo;s the technical part: Does it matter that the Detective Agent is &ldquo;Silas, a Sam Spade archetype&rdquo; rather than just a &ldquo;cross-referencing machine with 14 clearly codified rules&rdquo;?</p>

              <p>It actually depends on the task, and the academic literature is split.</p>

              <p>A 2024 study tested 162 different personas across 2,410 factual questions and found that adding a persona generally does not improve factual accuracy, if anything it&rsquo;s the opposite.<sup><a href="#fn1" id="fnref1" style={{ color: COPPER, textDecoration: "none" }}>1</a></sup> If you ask a model &ldquo;What year was the Treaty of Versailles signed?&rdquo; it doesn&rsquo;t matter if you&rsquo;ve told it to be a plumber or a historian.</p>

              <p>A crucial difference is that here our agents aren&rsquo;t answering factual questions. They&rsquo;re making judgment calls: is this a real Epstein connection or just someone with the same last name? Is the interior design of this home more &ldquo;theatrical&rdquo; or &ldquo;restrained&rdquo;? Those are subjective assessments, and for subjective, domain-specific reasoning, expert personas do shift behavior in measurable ways. When researchers built multi-agent systems where specialized evaluators with distinct personas debated each other&rsquo;s assessments, they achieved around 16% higher correlation with human judgement as opposed to a single agent evaluation. And critically, this improvement disappeared when the persona diversity was removed.<sup><a href="#fn3" id="fnref3" style={{ color: COPPER, textDecoration: "none" }}>3</a></sup> The value came specifically from having different agent perspectives shaped by different roles.</p>

              <p>When Silas encounters the name &ldquo;Coppola&rdquo; that could be &ldquo;Donato Coppola&rdquo; obsequiously emailing Jeffrey Epstein back for the chance to meetup (<a href="https://www.justice.gov/epstein/files/DataSet%209/EFTA01187523.pdf" target="_blank" rel="noopener noreferrer" style={{ color: COPPER }}>DOJ source</a>), or it could be &ldquo;Francis Ford Coppola&rdquo; sharing his magnificent retreat in Belize in the September 1995 issue (<a href="https://archive.architecturaldigest.com/article/1995/9/francis-ford-coppola-in-belize" target="_blank" rel="noopener noreferrer" style={{ color: COPPER }}>AD archive</a>). The &ldquo;false positives offend him&rdquo; framing makes the model more likely to pause and disambiguate rather than rubber stamping &ldquo;Coppola&rdquo; as a connection match. It is not purely a binary factual, it&rsquo;s an evidence weighing judgment call, exactly where persona design matters.</p>

              <p>A related line of research has shown when multiple specialized personas start to interact&mdash;debating, reviewing each other&rsquo;s work&mdash;the results are significantly better than any single persona working alone.<sup><a href="#fn2" id="fnref2" style={{ color: COPPER, textDecoration: "none" }}>2</a></sup> This is closer to what our pipeline is doing: Silas flags a name, Elena investigates it, Miranda reviews both of their work. The value isn&rsquo;t in any one character. It&rsquo;s in the structured disagreement and collaboration between each of them.</p>

              <p
                className="mt-4 text-[12px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                Layer 3: What&rsquo;s Creative Expression vs Technical Function
              </p>
              <p>It&rsquo;s helpful to define the difference here:</p>

              <p
                className="mt-2 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ fontFamily: MONO, color: COPPER }}
              >
                Technically Functional:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Each agent has their own distinct methodology (Detective checks Black Book + DOJ, Researcher does a multi-step investigation, Editor applies editorial judgement). This is a separation of concerns, a basic software engineering principle applied to AI. Research on autonomous agent pipelines confirms that structured role-based collaboration outperforms single-agent approaches for complex multi-step tasks.<sup><a href="#fn4" id="fnref4" style={{ color: COPPER, textDecoration: "none" }}>4</a></sup></li>
                <li>Each agent has a personality that matches its task (the Detective is skeptical, the Researcher is thorough, the Editor is demanding). For evaluative tasks such as this one, carefully designed personas shape edge-case behavior, however, the key word is &ldquo;carefully&rdquo;. Generic or poorly matched personas can hurt more than help.<sup><a href="#fn7" id="fnref7" style={{ color: COPPER, textDecoration: "none" }}>7</a></sup></li>
                <li>Using different model tiers for different agents. The Editor uses a more powerful model (Opus) for quality-critical reviews and a faster one (Sonnet) for routine tasks. Research confirms that mixing model capabilities across agents outperforms using the same model everywhere by as much as 47% on certain tasks.<sup><a href="#fn5" id="fnref5" style={{ color: COPPER, textDecoration: "none" }}>5</a></sup></li>
                <li>Agents have reflection loops. The Editor periodically reviews her own past decisions and identifies patterns. Multi-agent systems with structured reflection mechanisms that generate targeted feedback for individual agents shows measurable reductions in cascading errors.<sup><a href="#fn6" id="fnref6" style={{ color: COPPER, textDecoration: "none" }}>6</a></sup></li>
              </ul>

              <p
                className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ fontFamily: MONO, color: GOLD }}
              >
                Primarily Creative (but Still Valuable!):
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>The specific archetypes (Sam Spade, Miranda Priestly, Andrew Neiman) are memorable shorthands for complex instruction sets. A different set of archetypes with the same underlying instructions would produce similar pipeline results.</li>
                <li>While the character sprites and backstories don&rsquo;t fundamentally change the AI&rsquo;s output, they do make the project more human.</li>
                <li>The in-character conversations where you can talk to Miranda as Miranda works as an interactive developer tool, not a pipeline component.</li>
              </ul>

              <p className="mt-4">The real insight is that in many ways the technical value isn&rsquo;t in the specific characters, rather, it is in the act of designing them carefully. It&rsquo;s a simple idea, but when we decided Miranda should be demanding and autocratic, we were really making engineering decisions about how strict to dial in the editorial review. When we made Silas terse and skeptical, we were trying to tune down the false-positive rate as much as possible. The character design process forced a deeper thinking about what each stage of the pipeline should optimize for. The personas therefore act as human-legible encoding of engineering decisions. This can be a valuable lesson as agents become more and more complex and unleashed on more complicated problems.</p>

              <p>Research backs this up. A 2024 study found that &ldquo;coarsely aligned&rdquo; or generic personas often hurt performance, but carefully designed, task-specific personas can measurably improve it.<sup><a href="#fn7b" id="fnref7b" style={{ color: COPPER, textDecoration: "none" }}>7</a></sup> In the future, as agentic workflows become more widespread, the quality of the persona design and storytelling could become a primary consideration.</p>

              <p
                className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: "#B87333" }}
              >
                Summary
              </p>
              <p className="-mt-2">Seven AI agents processed 4,081 magazine features, cross-referenced more than 3,000 names against federal records, investigated over 1,000 leads, and confirmed 100+ connections autonomously. The significance of these results is structural: this was not a manual audit but a reproducible investigative system operating at scale. The outcome did not depend on personas; it depended on architecture&mdash;task queues, deterministic database writes, retry logic, and calibrated evidence thresholds that disciplined false positives and defined what qualified as confirmation. The human role was upstream: asking the question, designing the framework, endlessly stress-testing the pipeline, and deploying it publicly on this site. The agents executed judgment, the codebase enforced standards, and the result is not just a set of findings but a scalable, auditable method.</p>

              {/* ── Footnotes ── */}
              <div className="mt-8" style={{ borderTop: `1px solid ${BORDER}` }} />
              <div
                className="mt-4 flex flex-col gap-2 text-[9px] leading-[1.6]"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                <p id="fn1"><sup><a href="#fnref1" style={{ color: COPPER, textDecoration: "none" }}>1</a></sup> Zheng et al., <a href="https://aclanthology.org/2024.findings-emnlp.888/" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_MID }}>&ldquo;Is Persona Prompting Effective?&rdquo;</a> Findings of EMNLP 2024. Tested 162 personas across 2,410 factual questions; persona prompting did not reliably improve correctness.</p>
                <p id="fn2"><sup><a href="#fnref2" style={{ color: COPPER, textDecoration: "none" }}>2</a></sup> Wang et al., <a href="https://aclanthology.org/2024.naacl-long.15/" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_MID }}>&ldquo;Multi-Persona Collaboration&rdquo;</a> NAACL 2024. Found that simulating collaboration between multiple expert personas effectively reduced hallucinations while maintaining reasoning capabilities&mdash;though notably only in GPT-4, not smaller models.</p>
                <p id="fn3"><sup><a href="#fnref3" style={{ color: COPPER, textDecoration: "none" }}>3</a></sup> Chan et al., <a href="https://openreview.net/forum?id=FQepisCUWu" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_MID }}>&ldquo;ChatEval&rdquo;</a> ICLR 2024. Demonstrated that specialized evaluator agents with diverse personas, debating sequentially, achieve ~16% higher correlation with human judgment than single-agent evaluation. The improvement disappeared when persona diversity was removed.</p>
                <p id="fn4"><sup><a href="#fnref4" style={{ color: COPPER, textDecoration: "none" }}>4</a></sup> Qian et al., <a href="https://aclanthology.org/2024.acl-long.810/" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_MID }}>&ldquo;ChatDev&rdquo;</a> ACL 2024. Showed that treating complex tasks as structured conversations between specialized agents (CEO, CTO, Programmer, Reviewer) enables autonomous completion of multi-step workflows.</p>
                <p id="fn5"><sup><a href="#fnref5" style={{ color: COPPER, textDecoration: "none" }}>5</a></sup> Ye et al., <a href="https://arxiv.org/abs/2505.16997" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_MID }}>&ldquo;Heterogeneous Multi-Agent LLM Systems&rdquo;</a> arXiv 2025. Demonstrated that assigning different LLMs to different agent roles outperforms homogeneous systems by up to 47% on mathematical reasoning tasks.</p>
                <p id="fn6"><sup><a href="#fnref6" style={{ color: COPPER, textDecoration: "none" }}>6</a></sup> Bo et al., <a href="https://openreview.net/forum?id=wWiAR5mqXq" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_MID }}>&ldquo;Reflective Multi-Agent Refinement&rdquo;</a> NeurIPS 2024. Introduced a shared reflector that generates targeted prompt refinements for individual agents using counterfactual reward signals, reducing cascading errors in multi-agent pipelines.</p>
                <p id="fn7"><sup><a href="#fnref7" style={{ color: COPPER, textDecoration: "none" }}>7</a></sup> Kim et al., <a href="https://arxiv.org/abs/2408.08631" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_MID }}>&ldquo;Persona-Aligned Reasoning&rdquo;</a> arXiv 2024. Found that poorly aligned personas degraded performance in 7 of 12 reasoning datasets tested on Llama 3, while their proposed ensemble method outperformed both persona and no-persona baselines.</p>
              </div>
            </div>

            {/* Right — Miranda card + caption (columns 5-6) */}
            <div className="flex flex-col md:flex-[2]">
              <div
                className="flex flex-col items-center rounded border p-6 pb-8"
                style={{
                  backgroundColor: CARD_BG,
                  borderColor: BORDER,
                  borderTop: "2px solid #B87333",
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
                  <source src="https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Editor_Sprite_2.mov" type='video/mp4; codecs="hvc1"' />
                  <source src="https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Editor_Sprite.webm?v=4" type="video/webm" />
                </video>
                <p
                  className="mt-4 text-[15px] font-bold"
                  style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                >
                  {editorAgent.name}
                </p>
                <p
                  className="text-[10px] tracking-wider"
                  style={{ fontFamily: MONO, color: "#B87333" }}
                >
                  {editorAgent.role.toUpperCase()} &mdash; THE HUB
                </p>
                <p
                  className="mt-3 text-center text-[11px] leading-[1.8]"
                  style={{ fontFamily: MONO, color: TEXT_MID }}
                >
                  {editorAgent.description}
                </p>
                <div
                  className="mt-4 w-full"
                  style={{ borderTop: `1px solid ${BORDER}` }}
                />
                <p
                  className="mt-4 text-[10px] leading-[1.7]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  Surgically precise and unyielding. Every decision is final &mdash; delivered with the same tonal register whether she&rsquo;s approving a lead or killing a story. She never raises her voice; the quieter she speaks, the more terrified everyone becomes.
                </p>
                <p
                  className="mt-3 text-[10px] leading-[1.7]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  Autocratic and unilateral. She delegates relentlessly without explanation. Her management runs on standards so high they function as fear. The announcement that Boss is reviewing the pipeline triggers building-wide quality checks.
                </p>
                <p
                  className="mt-3 text-[10px] leading-[1.7] italic"
                  style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.5)" }}
                >
                  &ldquo;Details of your incompetence do not interest me.&rdquo;
                </p>
              </div>
              <p
                className="mt-3 text-[8px] tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                <span style={{ color: TEXT_MID }}>Fig. 6</span> — Miranda, the Editor agent, serves as the central hub — every task, verdict, and database write passes through her review.
              </p>
            </div>
          </div>

          <div className="mt-14" style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* ── Sub-agents — 6 spokes ── */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {subAgents.map((agent) => (
              <div
                key={agent.name}
                className="flex flex-col items-center rounded border p-3"
                style={{
                  backgroundColor: CARD_BG,
                  borderColor: BORDER,
                  borderTop: `2px solid ${agent.accent}`,
                  boxShadow: `0 0 20px 2px ${agent.accent}22, inset 0 0 10px 0 ${agent.accent}0A`,
                }}
              >
                <div className="relative h-[120px] w-[80px]">
                  <Image
                    src={agent.sprite}
                    alt={`${agent.name} — ${agent.role}`}
                    fill
                    className="object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
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
          <p
            className="mt-3 text-[8px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            <span style={{ color: TEXT_MID }}>Fig. 7</span> — The six specialist agents, each with a dedicated language model, archetype, and behavioral constraints encoded through personality.
          </p>

          <div className="mt-14" style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* Agent Office — two-column: text (cols 1-2) + video (cols 3-6) */}
          <div
            className="mt-10 flex flex-col gap-6 md:flex-row md:items-start"
            style={{ gap: "24px" }}
          >
            {/* Left — description (minor columns 1-2) */}
            <div className="flex flex-col md:flex-[2]">
              <p
                className="text-[14px] font-bold leading-[1.3]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                The Agent Office
              </p>
              <p
                className="mt-4 text-[11px] leading-[1.7]"
                style={{ fontFamily: MONO, color: TEXT_MID }}
              >
                A real-time pixel-art dashboard built to make
                personality-as-architecture visible. Each of the seven agents
                occupies a desk in a shared office. When Miranda assigns a task, her
                speech bubble updates. When Silas returns a verdict, it appears on
                screen.
              </p>
              <p
                className="mt-3 text-[11px] leading-[1.7]"
                style={{ fontFamily: MONO, color: TEXT_MID }}
              >
                The office runs on live pipeline data &mdash; you watch
                autonomous AI coordination happen in real time.
              </p>
            </div>

            {/* Right — video (minor columns 3-6) */}
            <div className="flex flex-col md:flex-[4]">
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
              <p
                className="mt-3 text-[8px] tracking-wider"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                <span style={{ color: TEXT_MID }}>Fig. 8</span> — The Agent Office: a real-time pixel-art dashboard showing autonomous AI coordination as it happens.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: INVESTIGATION METHODOLOGY
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-4" className="mt-24 scroll-mt-24">
          {/* Section 4 header — inline so intro text sits beside pipeline flow */}
          <p
            className="text-[11px] tracking-widest"
            style={{ fontFamily: MONO, color: "#B87333" }}
          >
            SECTION 4
          </p>
          <h3
            className="mt-3 text-[24px] font-bold leading-[1.1] tracking-tight"
            style={{
              fontFamily: MONO,
              color: TEXT_LIGHT,
              maxWidth: CONTENT_NARROW,
            }}
          >
            INVESTIGATION METHODOLOGY
          </h3>
          <p
            className="mt-3 text-[15px] leading-[1.4]"
            style={{
              fontFamily: MONO,
              color: TEXT_MID,
              maxWidth: CONTENT_NARROW,
            }}
          >
            How a name match becomes a confirmed connection — or gets rejected.
          </p>
          <div className="mt-8" style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* ── Body text + Pipeline flow — side by side ── */}
          <div
            className="mt-10 grid items-start gap-6"
            style={{ gridTemplateColumns: "2fr 1fr" }}
          >
            {/* Left: Intro paragraphs + summary */}
            <div
              className="flex flex-col gap-5 text-[14px] leading-[1.7]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              <p>
                Finding a name in both Architectural Digest and the Epstein
                records is only the beginning. The system applies a rigorous
                multi-stage verification process before any connection is
                confirmed. Of the 476 cross-references identified by the
                Detective, only 33 survived the full pipeline to become
                confirmed connections — a rejection rate of over 93%.
              </p>
              <p>
                The process begins with automated cross-referencing using
                word-boundary matching and minimum name-length thresholds to
                reduce false positives. The Detective then assigns a confidence
                tier (confirmed, likely, possible, or no match) based on the
                quality of the match. Full first-and-last-name entries in the
                Black Book with phone numbers are treated as direct evidence.
                Surname-only collisions are investigated but expected to be
                false positives — and 97% of them are.
              </p>
              <p>
                Names that pass the Detective&apos;s threshold are handed to the
                Researcher, who builds an investigative dossier pulling public
                records, graph analytics, and documentary evidence. The dossier
                is then reviewed by Miranda, who makes the final call.
                &apos;Confirmed&apos; means documented proximity — contact
                entries, dining records, guest lists, correspondence — not
                implication of wrongdoing. This standard is enforced
                consistently across every decision.
              </p>
              <p
                className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: "#B87333" }}
              >
                Summary
              </p>
              <p className="-mt-2">
                The investigation methodology prioritizes precision over recall.
                Every confirmed connection has passed through automated
                cross-referencing, detective triage, deep research, and
                editorial review. The 93% rejection rate reflects the
                system&apos;s commitment to minimizing false positives.
              </p>
            </div>

            {/* Right: Vertical pipeline flow */}
            <div className="flex flex-col items-center justify-between">
              {/* Step 1: Name Extracted */}
              <div
                className="w-full rounded border px-3 py-2.5 text-center"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
              >
                <p
                  className="text-[9px] font-bold tracking-[0.12em]"
                  style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                >
                  NAME EXTRACTED
                </p>
                <p
                  className="mt-0.5 text-[7.5px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  from AD feature
                </p>
              </div>

              {/* Connector: circle → line → arrow */}
              <svg width="12" height="100%" viewBox="0 0 12 32" preserveAspectRatio="none" className="min-h-3 flex-1">
                <circle cx="6" cy="3" r="2.5" fill={BORDER} stroke={BORDER} strokeWidth="1" />
                <line x1="6" y1="6" x2="6" y2="26" stroke={BORDER} strokeWidth="1" />
                <polyline points="2,25 6,31 10,25" fill="none" stroke={BORDER} strokeWidth="1.2" strokeLinejoin="round" />
              </svg>

              {/* Step 2: Sources stacked */}
              <div className="flex w-full gap-1.5">
                <div
                  className="flex-1 rounded border px-2 py-1.5 text-center"
                  style={{ backgroundColor: CARD_BG, borderColor: COPPER_DIM }}
                >
                  <p
                    className="text-[8px] font-bold tracking-[0.1em]"
                    style={{ fontFamily: MONO, color: COPPER }}
                  >
                    BLACK BOOK
                  </p>
                </div>
                <div
                  className="flex-1 rounded border px-2 py-1.5 text-center"
                  style={{ backgroundColor: CARD_BG, borderColor: COPPER_DIM }}
                >
                  <p
                    className="text-[8px] font-bold tracking-[0.1em]"
                    style={{ fontFamily: MONO, color: COPPER }}
                  >
                    DOJ LIBRARY
                  </p>
                </div>
              </div>

              {/* Connector */}
              <svg width="12" height="100%" viewBox="0 0 12 32" preserveAspectRatio="none" className="min-h-3 flex-1">
                <circle cx="6" cy="3" r="2.5" fill={BORDER} stroke={BORDER} strokeWidth="1" />
                <line x1="6" y1="6" x2="6" y2="26" stroke={BORDER} strokeWidth="1" />
                <polyline points="2,25 6,31 10,25" fill="none" stroke={BORDER} strokeWidth="1.2" strokeLinejoin="round" />
              </svg>

              {/* Step 3: Detective */}
              <div
                className="w-full rounded border px-3 py-2.5 text-center"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
              >
                <p
                  className="text-[9px] font-bold tracking-[0.12em]"
                  style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                >
                  DETECTIVE VERDICT
                </p>
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  <span
                    className="rounded-sm px-1.5 py-px text-[7px] tracking-wider"
                    style={{ fontFamily: MONO, backgroundColor: "rgba(45,106,79,0.18)", color: GREEN }}
                  >
                    CONFIRMED
                  </span>
                  <span
                    className="rounded-sm px-1.5 py-px text-[7px] tracking-wider"
                    style={{ fontFamily: MONO, backgroundColor: COPPER_DIM, color: COPPER }}
                  >
                    LIKELY
                  </span>
                  <span
                    className="rounded-sm px-1.5 py-px text-[7px] tracking-wider"
                    style={{ fontFamily: MONO, backgroundColor: GOLD_DIM, color: GOLD }}
                  >
                    POSSIBLE
                  </span>
                  <span
                    className="rounded-sm px-1.5 py-px text-[7px] tracking-wider"
                    style={{ fontFamily: MONO, backgroundColor: SLATE_DIM, color: SLATE }}
                  >
                    NEEDS REVIEW
                  </span>
                  <span
                    className="rounded-sm px-1.5 py-px text-[7px] tracking-wider"
                    style={{ fontFamily: MONO, backgroundColor: RED_DIM, color: RED }}
                  >
                    NO MATCH
                  </span>
                </div>
              </div>

              {/* Connector */}
              <svg width="12" height="100%" viewBox="0 0 12 32" preserveAspectRatio="none" className="min-h-3 flex-1">
                <circle cx="6" cy="3" r="2.5" fill={BORDER} stroke={BORDER} strokeWidth="1" />
                <line x1="6" y1="6" x2="6" y2="26" stroke={BORDER} strokeWidth="1" />
                <polyline points="2,25 6,31 10,25" fill="none" stroke={BORDER} strokeWidth="1.2" strokeLinejoin="round" />
              </svg>

              {/* Step 4: Dossier */}
              <div
                className="w-full rounded border px-3 py-2.5 text-center"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
              >
                <p
                  className="text-[9px] font-bold tracking-[0.12em]"
                  style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                >
                  RESEARCHER DOSSIER
                </p>
                <p
                  className="mt-0.5 text-[7.5px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  deep investigation
                </p>
              </div>

              {/* Connector */}
              <svg width="12" height="100%" viewBox="0 0 12 32" preserveAspectRatio="none" className="min-h-3 flex-1">
                <circle cx="6" cy="3" r="2.5" fill={BORDER} stroke={BORDER} strokeWidth="1" />
                <line x1="6" y1="6" x2="6" y2="26" stroke={BORDER} strokeWidth="1" />
                <polyline points="2,25 6,31 10,25" fill="none" stroke={BORDER} strokeWidth="1.2" strokeLinejoin="round" />
              </svg>

              {/* Step 5: Editor Review */}
              <div
                className="w-full rounded border px-3 py-2.5 text-center"
                style={{ backgroundColor: CARD_BG, borderColor: "#B87333" }}
              >
                <p
                  className="text-[9px] font-bold tracking-[0.12em]"
                  style={{ fontFamily: MONO, color: "#B87333" }}
                >
                  EDITOR REVIEW
                </p>
                <p
                  className="mt-0.5 text-[7.5px] tracking-wider"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  final sign-off
                </p>
              </div>

              {/* Connector */}
              <svg width="12" height="100%" viewBox="0 0 12 32" preserveAspectRatio="none" className="min-h-3 flex-1">
                <circle cx="6" cy="3" r="2.5" fill={BORDER} stroke={BORDER} strokeWidth="1" />
                <line x1="6" y1="6" x2="6" y2="26" stroke={BORDER} strokeWidth="1" />
                <polyline points="2,25 6,31 10,25" fill="none" stroke={BORDER} strokeWidth="1.2" strokeLinejoin="round" />
              </svg>

              {/* Step 6: Outcomes */}
              <div className="flex w-full gap-1.5">
                <div
                  className="flex-1 rounded border px-2 py-2 text-center"
                  style={{ backgroundColor: "rgba(45,106,79,0.08)", borderColor: "rgba(45,106,79,0.35)" }}
                >
                  <p
                    className="text-[9px] font-bold tracking-[0.12em]"
                    style={{ fontFamily: MONO, color: GREEN }}
                  >
                    YES
                  </p>
                </div>
                <div
                  className="flex-1 rounded border px-2 py-2 text-center"
                  style={{ backgroundColor: "rgba(155,34,38,0.05)", borderColor: "rgba(155,34,38,0.3)" }}
                >
                  <p
                    className="text-[9px] font-bold tracking-[0.12em]"
                    style={{ fontFamily: MONO, color: RED }}
                  >
                    NO
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10" style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* ── Investigation Funnel — full width Sankey ── */}
          <div
            className="mt-10 overflow-hidden rounded border"
            style={{ backgroundColor: "#111118", borderColor: BORDER }}
          >
              <div
                className="px-3 py-2"
                style={{ borderBottom: `1px solid ${BORDER}` }}
              >
                <p
                  className="text-[9px] font-bold tracking-[0.12em]"
                  style={{ fontFamily: MONO, color: TEXT_MID }}
                >
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
                  <p
                    className="text-[10px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    LOADING PIPELINE DATA...
                  </p>
                </div>
              )}
          </div>
          <p
            className="mt-3 text-[8px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            <span style={{ color: TEXT_MID }}>Fig. 9</span> &mdash; Investigation funnel showing how extracted features are filtered through cross-referencing, detective triage, researcher dossiers, and editorial review.
          </p>

          {/* ── Evidence criteria — two columns ── */}
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {/* What counts */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <p
                className="text-[11px] font-bold"
                style={{ fontFamily: MONO, color: GREEN }}
              >
                {"// WHAT COUNTS AS A CONFIRMED CONNECTION"}
              </p>
              <div
                className="mt-3 flex flex-col gap-2.5 text-[10px] leading-[1.6]"
                style={{
                  fontFamily: MONO,
                  color: "rgba(160, 160, 176, 0.7)",
                }}
              >
                <p>
                  &rarr; [Full name (first + last) in Epstein&apos;s Black Book
                  with phone numbers — structured contact entry is direct evidence
                  of being in the network]
                </p>
                <p>
                  &rarr; [DOJ documents showing direct interaction: dining at
                  Epstein&apos;s properties, correspondence, guest lists,
                  appointments]
                </p>
                <p>
                  &rarr; [Flight logs, contact database entries, or scheduled
                  meetings documented in released records]
                </p>
                <p>
                  &rarr; [&quot;Confirmed&quot; means documented proximity — it
                  does not imply wrongdoing or a personal relationship]
                </p>
              </div>
            </div>

            {/* What doesn't count */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <p
                className="text-[11px] font-bold"
                style={{ fontFamily: MONO, color: RED }}
              >
                {"// WHAT DOES NOT COUNT"}
              </p>
              <div
                className="mt-3 flex flex-col gap-2.5 text-[10px] leading-[1.6]"
                style={{
                  fontFamily: MONO,
                  color: "rgba(160, 160, 176, 0.7)",
                }}
              >
                <p>
                  &rarr; [Surname-only collision — a different person with the same
                  last name. The system investigates these but expects most to be
                  false positives]
                </p>
                <p>
                  &rarr; [Mere mention in a DOJ document without evidence of actual
                  interaction — appearing in a list is not the same as dining
                  together]
                </p>
                <p>
                  &rarr; [Third party mentioning someone&apos;s name &ne; direct
                  connection. Hearsay is not evidence]
                </p>
                <p>
                  &rarr; [Family member in records does not confirm a different
                  family member. Separate individuals, separate assessments]
                </p>
                <p>
                  &rarr; [Adversarial or negative context — Epstein disliking
                  someone is not a social connection]
                </p>
              </div>
            </div>
          </div>
          <p
            className="mt-3 text-[8px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            <span style={{ color: TEXT_MID }}>Fig. 10</span> — Evidence standards defining what constitutes a confirmed connection versus what does not qualify.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: INTELLIGENCE INFRASTRUCTURE
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-5" className="mt-24 scroll-mt-24">
          <SectionHeader
            num="5"
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
                    titleColor="#B87333"
                    borderColor="#B87333"
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
              <span style={{ color: TEXT_MID }}>Fig. 11</span> &mdash; Agent internal architecture: the problem_solve() execution path from task intake through context assembly to episode storage.
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
                  <CodeBox title="EDITOR → review" titleColor="#B87333" borderColor="#B87333" lines={[
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
              <span style={{ color: TEXT_MID }}>Fig. 12</span> &mdash; Data pipeline: the three transformation stages from archive.org URL to confirmed/rejected verdict.
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
                  <CodeBox title="SELF-IMPROVEMENT (every 30 min)" titleColor="#B87333" borderColor="#B87333" lines={[
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
              <span style={{ color: TEXT_MID }}>Fig. 13</span> &mdash; Memory and learning architecture: four feedback loops operating at different timescales, from per-task episodes to persistent institutional knowledge.
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
                style={{ fontFamily: MONO, color: "#B87333" }}
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
            <span style={{ color: TEXT_MID }}>Fig. 14</span> — The six intelligence subsystems that enable agent coordination, learning, and self-improvement without human intervention.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6: UI DESIGN
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-6" className="mt-24 scroll-mt-24">
          <SectionHeader
            num="6"
            title="UI DESIGN"
            subtitle="Why an agentic system needs a visual interface — and how it was designed and built."
            intro={[
              "An agentic pipeline can run entirely in the terminal. So why build a website? Because this project serves three distinct audiences with fundamentally different needs. For the developer, the Agent Office dashboard and real-time status panels transform opaque log files into legible system behavior — you can see when Miranda rejects a dossier or when Silas returns a verdict without parsing thousands of lines of output. For the researcher, the searchable index, dossier pages, and interactive charts make the pipeline's findings explorable in ways that a JSON export never could. For the public reader, the site transforms raw data into a narrative about wealth, taste, and proximity to power.",
              "The website was designed in Figma by Sable, the seventh agent in the pipeline. Unlike the other six agents who operate autonomously, Sable works iteratively with the human user — proposing layouts, refining typography, and building components directly in a shared Figma file. The Figma Console MCP server enables direct read/write access to the Figma file from the development environment, bridging design and code in a single workflow. The design system was defined collaboratively: a 6-column proportional grid, JetBrains Mono for technical sections, Futura PT for the editorial voice, and a restrained palette of copper, gold, and deep purple.",
              "The site is built with Next.js, Tailwind CSS, and Shadcn UI components, deployed on Vercel. All data is fetched server-side from Supabase — no API keys are exposed to the client. The searchable index, dossier pages, and interactive charts all pull from the same live pipeline database. Every number on the page is real and current.",
            ]}
            summary="The UI exists because different audiences need different views into the same data. The developer needs observability, the researcher needs exploration, and the public reader needs narrative. A terminal can't serve all three."
          />

          {/* ── Agent Office UI — annotated screenshot in purple box ── */}
          <div
            className="mt-10 rounded-lg"
            style={{
              backgroundColor: "#1e1040",
              border: `1px solid ${BORDER}`,
              padding: "40px 32px",
            }}
          >
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// THE AGENT OFFICE"}
            </p>

            {/* 6-column grid: col01=annotations, cols02–05=image, col06=annotations */}
            <div className="mt-6 grid gap-4 md:grid-cols-6 md:gap-[24px]">
              {/* Left annotations (minor column 01) */}
              <div className="order-2 flex flex-col justify-between gap-6 md:order-1 md:col-span-1">
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{ fontFamily: MONO, color: GOLD }}
                  >
                    01
                  </p>
                  <p
                    className="mt-1 text-[10px] leading-[1.6]"
                    style={{ fontFamily: MONO, color: TEXT_MID }}
                  >
                    [Agent Network — hierarchical org chart showing all seven
                    agents and their real-time status]
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{ fontFamily: MONO, color: GOLD }}
                  >
                    02
                  </p>
                  <p
                    className="mt-1 text-[10px] leading-[1.6]"
                    style={{ fontFamily: MONO, color: TEXT_MID }}
                  >
                    [Editor Inbox — Miranda&apos;s real-time commentary on
                    pipeline state, errors, and editorial decisions]
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{ fontFamily: MONO, color: GOLD }}
                  >
                    03
                  </p>
                  <p
                    className="mt-1 text-[10px] leading-[1.6]"
                    style={{ fontFamily: MONO, color: TEXT_MID }}
                  >
                    [Newsroom Chatter — the bulletin board. Agents post
                    warnings, discoveries, and status updates visible to all]
                  </p>
                </div>
              </div>

              {/* Central image (minor columns 02–05) */}
              <div
                className="order-1 overflow-hidden rounded border md:order-2 md:col-span-4"
                style={{ borderColor: BORDER }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/agent-office-ui.png"
                  alt="Agent Office — real-time pixel-art dashboard showing seven AI agents at work, with live pipeline statistics, knowledge graph, activity log, and current investigation leads."
                  className="w-full"
                />
              </div>

              {/* Right annotations (minor column 06 ) */}
              <div className="order-3 flex flex-col justify-between gap-6 md:col-span-1">
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{ fontFamily: MONO, color: GOLD }}
                  >
                    04
                  </p>
                  <p
                    className="mt-1 text-[10px] leading-[1.6]"
                    style={{ fontFamily: MONO, color: TEXT_MID }}
                  >
                    [Knowledge Graph — live Neo4j visualization of suspected
                    connections and community clusters]
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{ fontFamily: MONO, color: GOLD }}
                  >
                    05
                  </p>
                  <p
                    className="mt-1 text-[10px] leading-[1.6]"
                    style={{ fontFamily: MONO, color: TEXT_MID }}
                  >
                    [Activity Log — per-agent filterable log of every action,
                    streaming in real time]
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{ fontFamily: MONO, color: GOLD }}
                  >
                    06
                  </p>
                  <p
                    className="mt-1 text-[10px] leading-[1.6]"
                    style={{ fontFamily: MONO, color: TEXT_MID }}
                  >
                    [Current Leads — active investigation queue with verdict
                    status badges and confidence scores]
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p
            className="mt-3 text-[8px] tracking-wider"
            style={{ fontFamily: MONO, color: TEXT_DIM }}
          >
            <span style={{ color: TEXT_MID }}>Fig. 15</span> &mdash; Agent Office UI: annotated screenshot of the real-time dashboard showing agent network, editor inbox, bulletin board, knowledge graph, activity log, and investigation queue.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 7: LIMITATIONS AND DISCLAIMERS
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-7" className="mt-24 scroll-mt-24">
          <SectionHeader
            num="7"
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

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 8: DATA SOURCES
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-8" className="mt-24 scroll-mt-24">
          <SectionHeader
            num="8"
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
                          ? "#B87333"
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

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 9: CONCLUSIONS
        ══════════════════════════════════════════════════════════════════ */}
        <div id="section-9" className="mt-24 scroll-mt-24">
          <SectionHeader
            num="9"
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
