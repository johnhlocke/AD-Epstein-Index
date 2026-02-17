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

const phases = [
  {
    num: "01",
    title: "BUILD THE AD DATABASE",
    description:
      "An autonomous multi-agent system discovers, downloads, and extracts every issue of Architectural Digest from 1988 to 2025. A Courier agent scrapes each one, decoding the magazine's digital article catalog and fetching page images from the archive. A Reader agent then extracts the people featured, their designers, locations, architectural styles, and other details from every home. Where structured data is unavailable, a vision model reads the actual magazine pages to fill gaps.",
    agents: ["Arthur (Scout)", "Casey (Courier)", "Elias (Reader)"],
  },
  {
    num: "02",
    title: "CROSS-REFERENCE EPSTEIN RECORDS",
    description:
      "A Detective agent checks every extracted name against two sources: Epstein's Little Black Book (approximately 1,500 contacts) and the Department of Justice's Full Epstein Library (millions of pages of released documents). Names that surface as potential matches are handed to a Researcher agent, which builds a dossier for each one — pulling public records, graph analytics, and documentary evidence to assess the strength of connection.",
    agents: ["Silas (Detective)", "Elena (Researcher)"],
  },
  {
    num: "03",
    title: "REVIEW & VISUALIZE",
    description:
      "An Editor agent reviews every dossier before confirming or rejecting. All data is served from a Supabase database via server-side queries. No client-side API keys are exposed. The searchable index, charts, and dossier pages are generated from live pipeline data. All of this data is made visible on a publicly accessible website with compelling visuals created in collaboration with a design agent who actively creates in Figma based on instructions from the human user. The Figma design is automatically converted into a website through Vercel.",
    agents: ["Miranda (Editor)", "Sable (Designer)"],
  },
];

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
    description: "Discovers and catalogues every AD issue on archive.org. Manages the download queue and prioritizes undiscovered issues.",
  },
  {
    name: "Casey",
    role: "Courier",
    sprite: "/agents/courier_front_trans.png",
    accent: "#9B7EDB",
    description: "Downloads PDFs and extracts page images. Handles archive.org rate limiting and JWT-based article parsing.",
  },
  {
    name: "Elias",
    role: "Reader",
    sprite: "/agents/reader_front_trans.png",
    accent: "#4ECDC4",
    description: "Vision AI specialist. Reads magazine pages and extracts homeowner names, designers, locations, styles, and metrics from each feature.",
  },
  {
    name: "Silas",
    role: "Detective",
    sprite: "/agents/detective_front_trans.png",
    accent: "#E07474",
    description: "Cross-references every name against the Little Black Book and DOJ Epstein Library. Produces match verdicts with confidence tiers.",
  },
  {
    name: "Elena",
    role: "Researcher",
    sprite: "/agents/researcher_front_trans.png",
    accent: "#E8B84E",
    description: "Builds investigative dossiers on flagged names. Synthesizes evidence from multiple sources into structured reports.",
  },
  {
    name: "Sable",
    role: "Designer",
    sprite: "/agents/designer_front_trans.png",
    accent: "#D97EC4",
    description: "Designs and builds the public-facing website. Translates pipeline data into interactive visualizations, charts, and searchable interfaces.",
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
        className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight"
        style={{ fontFamily: MONO, color: TEXT_LIGHT }}
      >
        {title}
      </h3>
      <p
        className="mt-3 text-[20px] leading-[1.4]"
        style={{ fontFamily: MONO, color: TEXT_MID }}
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
          maxWidth: "calc(4 * (100% - 5 * 24px) / 6 + 3 * 24px)",
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
          className="mt-3 text-[20px] leading-[1.4] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
          style={{ fontFamily: MONO, color: TEXT_MID }}
        >
          Seven autonomous AI agents cataloged 37 years of Architectural Digest and cross-referenced every name against the Epstein records — no human touched the data.
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

        {/* ── Abstract: 3-column overview ── */}
        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-3">
          {/* Column 1 */}
          <div className="flex flex-col gap-6">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                Research Question
              </p>
              <p
                className="mt-3 text-[14px] leading-[1.65]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                This study investigates the degree of overlap between
                Jeffrey Epstein&apos;s documented social network and the
                population of individuals featured in Architectural Digest,
                the preeminent American shelter magazine. AD has profiled
                the private residences of wealthy and influential figures
                since 1920. The Epstein document releases &mdash; comprising
                contact records, flight logs, legal depositions, and
                correspondence &mdash; name many of those same individuals.
                The central question is whether this overlap is incidental
                or structurally significant, and whether it produces a
                measurable aesthetic signal.
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                Methodology
              </p>
              <p
                className="mt-3 text-[14px] leading-[1.65]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                The investigation employs a three-phase automated pipeline.
                In Phase 1, seven autonomous AI agents ingest 37 years of
                Architectural Digest (1988&ndash;2025), extracting structured
                records from approximately 480 issues and cataloging over
                2,100 featured residences with associated homeowners,
                designers, locations, and architectural styles. In Phase 2,
                every extracted name undergoes cross-referencing against two
                primary Epstein sources: the Little Black Book, a personal
                contact directory of approximately 1,500 entries, and the
                Department of Justice&apos;s Full Epstein Library, a corpus of
                millions of released legal documents searchable via OCR.
                In Phase 3, flagged names receive full investigative dossiers,
                multi-source evidence synthesis, and editorial review before
                final confirmation or rejection.
              </p>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-6">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                System Architecture
              </p>
              <p
                className="mt-3 text-[14px] leading-[1.65]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                The system implements a hub-and-spoke multi-agent architecture
                in which a central editor agent coordinates six specialized
                workers via asynchronous task queues. Each agent maintains
                episodic memory (384-dimensional vector embeddings with
                semantic retrieval), periodic self-reflection, and access to
                a shared inter-agent bulletin board. The system employs four
                distinct language models selected by cost-capability tradeoff:
                Claude Opus for editorial judgment, Sonnet for research
                synthesis, Haiku for bulk classification, and Gemini for
                vision tasks including magazine page reading and aesthetic
                tagging. The complete pipeline executes in approximately
                18 hours of wall-clock time at a total API cost of ~$55,
                demonstrating that non-trivial investigative journalism
                workflows can be conducted at minimal marginal cost.
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                Key Challenges
              </p>
              <p
                className="mt-3 text-[14px] leading-[1.65]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                The primary methodological challenge is the disambiguation of
                name collisions. Of 476 cross-reference matches identified,
                the majority proved to be surname-only coincidences &mdash;
                e.g., &ldquo;Goldsmith&rdquo; appearing in a jewelry
                inventory rather than referencing a specific individual.
                Rigorous word-boundary matching and minimum name-length
                thresholds reduce but do not eliminate false positives.
                The DOJ corpus is searchable only via OCR, rendering
                handwritten documents invisible to automated search. Each
                verdict required the operationalization of &ldquo;confirmed
                connection&rdquo; as documented proximity (contact entries,
                dining records, guest lists, correspondence) rather than
                implication of wrongdoing &mdash; a standard that had to be
                enforced consistently across thousands of automated decisions
                with explicit rules for edge cases.
              </p>
            </div>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-6">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                Principal Findings
              </p>
              <p
                className="mt-3 text-[14px] leading-[1.65]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                The overlap between the AD-featured population and
                Epstein&apos;s documented network is statistically
                non-trivial. Confirmed individuals exhibit a pronounced
                aesthetic signature: 3.4&times; overrepresentation in
                classical European grandeur, 2.4&times; in formal
                symmetry, and near-zero representation in minimalist
                or industrial styles relative to the general AD
                population. The dataset is constructed without human
                editorial discretion in name selection or cross-referencing,
                and every finding is independently verifiable against
                the primary source documents. A six-dimension aesthetic
                taxonomy was developed to quantify these stylistic
                divergences across the full corpus.
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                Future Work
              </p>
              <p
                className="mt-3 text-[14px] leading-[1.65]"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                The pipeline architecture is designed for extensibility
                to additional luxury shelter publications &mdash; Elle
                Decor, World of Interiors, Vogue Living &mdash; and
                alternative document corpora beyond the DOJ Epstein
                release. Preliminary feasibility analysis has been
                conducted for Elle Decor, though its lack of a structured
                digital archive limits scalability. The codebase is
                open-source, the methodology is fully reproducible, and
                the agent infrastructure supports arbitrary
                cross-referencing tasks against any searchable document
                library.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10" style={{ borderTop: `1px solid ${BORDER}` }} />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: THE PIPELINE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-16">
          <SectionHeader
            num="1"
            title="THE PIPELINE"
            subtitle="Three phases. Seven agents. Zero manual data entry."
            intro={[
              "The AD-Epstein Index is built by a fully automated three-phase pipeline. In the first phase, a Scout agent discovers every issue of Architectural Digest published between 1988 and 2025 on archive.org, a Courier downloads and decodes each issue's digital article catalog, and a Reader extracts structured records from every featured home — homeowner names, interior designers, locations, architectural styles, square footage, and construction dates.",
              "In the second phase, every extracted name is cross-referenced against two primary Epstein sources: the Little Black Book (approximately 1,500 contacts) and the Department of Justice's Full Epstein Library (millions of released documents searchable via OCR). Names that surface as potential matches are investigated by a Researcher agent, which builds a detailed dossier synthesizing public records, graph analytics, and documentary evidence.",
              "The third phase is editorial review and publication. An Editor agent reviews every dossier before confirming or rejecting a connection. Confirmed names, their associated metadata, and the full evidence chain are published to this website. No human touches the data at any stage of the pipeline — the system runs end-to-end autonomously.",
            ]}
            summary="480 issues ingested, 2,180 features extracted, 476 cross-references evaluated, 185 dossiers built, 33 connections confirmed — all without human intervention in the data pipeline."
          />

          {/* Pipeline flow diagram — interlocking chevron blocks */}
          {(() => {
            const PIPE_BG_ALL = "#282545";
            const PIPE_BORDER = "#2e2b45";
            const NOTCH = 16; // px depth of chevron point/notch
            const nodes = [
              { label: "ISSUES", count: "480" },
              { label: "FEATURES", count: "2,180" },
              { label: "CROSS-REFS", count: "476" },
              { label: "DOSSIERS", count: "185" },
              { label: "VERDICTS", count: "33" },
              { label: "PUBLISHED", count: "wheretheylive.world" },
            ];
            const isFirst = (i: number) => i === 0;
            const isLast = (i: number) => i === nodes.length - 1;
            // clip-path for interlocking chevron shapes
            const clipFor = (i: number) => {
              if (isFirst(i)) {
                return `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`;
              }
              if (isLast(i)) {
                return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${NOTCH}px 50%)`;
              }
              return `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%, ${NOTCH}px 50%)`;
            };
            // Down arrow for mobile
            const DownArrow = () => (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto my-1">
                <path d="M10 4 L10 14" stroke={TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 11 L10 16 L14 11" stroke={TEXT_DIM} strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            );
            return (
              <div className="mt-10 mb-8">
                {/* Desktop: interlocking horizontal pipeline */}
                <div className="hidden md:flex">
                  {nodes.map((node, i) => (
                    <div
                      key={node.label}
                      className="flex flex-col items-center justify-center py-5 relative"
                      style={{
                        flex: 1,
                        background: PIPE_BG_ALL,
                        clipPath: clipFor(i),
                        marginLeft: isFirst(i) ? 0 : -1,
                        paddingLeft: isFirst(i) ? 12 : NOTCH + 8,
                        paddingRight: isLast(i) ? 12 : NOTCH + 8,
                        filter: "drop-shadow(1px 0 0 rgba(100, 90, 140, 0.35))",
                      }}
                    >
                      <span
                        className="text-[13px] tracking-[0.18em] font-bold"
                        style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                      >
                        {node.label}
                      </span>
                      <span
                        className="mt-1 text-[11px] tracking-wider"
                        style={{
                          fontFamily: MONO,
                          color: isLast(i) ? GREEN : i >= 3 ? GOLD_DIM : TEXT_MID,
                        }}
                      >
                        {node.count}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Mobile: vertical pipeline */}
                <div className="flex flex-col items-center md:hidden">
                  {nodes.map((node, i) => (
                    <div key={node.label} className="flex flex-col items-center w-full">
                      <div
                        className="flex items-center justify-center gap-3 py-2.5 w-full"
                        style={{
                          background: PIPE_BG_ALL,
                          border: `1px solid ${PIPE_BORDER}`,
                          borderBottom: isLast(i) ? `1px solid ${PIPE_BORDER}` : "none",
                          borderRadius: isFirst(i) ? "6px 6px 0 0" : isLast(i) ? "0 0 6px 6px" : "0",
                        }}
                      >
                        <span
                          className="text-[12px] tracking-[0.18em] font-bold"
                          style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                        >
                          {node.label}
                        </span>
                        <span
                          className="text-[11px] tracking-wider"
                          style={{
                            fontFamily: MONO,
                            color: isLast(i) ? GREEN : i >= 3 ? GOLD_DIM : TEXT_MID,
                          }}
                        >
                          {node.count}
                        </span>
                      </div>
                      {!isLast(i) && <DownArrow />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Phase cards */}
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {phases.map((phase) => (
              <div
                key={phase.num}
                className="flex flex-col rounded p-6 md:min-h-[920px]"
                style={{ backgroundColor: CARD_BG }}
              >
                <span
                  className="text-[64px] font-bold leading-none"
                  style={{ fontFamily: MONO, color: COPPER_DIM }}
                >
                  {phase.num}
                </span>
                <p
                  className="mt-2 text-[13px] font-bold tracking-wide"
                  style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                >
                  {phase.title}
                </p>
                <p
                  className="mt-3 text-[11px] leading-[1.65]"
                  style={{ fontFamily: MONO, color: TEXT_MID }}
                >
                  {phase.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {phase.agents.map((agent) => (
                    <span
                      key={agent}
                      className="rounded-sm px-2 py-1 text-[10px]"
                      style={{
                        fontFamily: MONO,
                        backgroundColor: GREEN_BG,
                        color: GREEN,
                      }}
                    >
                      {agent}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Full 3-phase Architecture SVG — overlaps bottom of phase cards on desktop */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pipeline-architecture.svg?v=2"
            alt="System Architecture — Phase 01: Scout, Courier, and Reader agents feeding data through the Editor to Supabase. Phase 02: Detective and Researcher cross-referencing names against DOJ Epstein files and Black Book. Phase 03: Deep aesthetic extraction, Designer agent, Neo4j knowledge graph, and website deployment."
            className="relative z-10 mt-6 w-full rounded md:-mt-[480px]"
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: MULTI-AGENT SYSTEM
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
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

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: PERSONALITY AS ARCHITECTURE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          {/* ── S3 Header (full width) ── */}
          <div>
            <p
              className="text-[11px] tracking-widest"
              style={{ fontFamily: MONO, color: "#B87333" }}
            >
              SECTION 3
            </p>
            <h3
              className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight"
              style={{ fontFamily: MONO, color: TEXT_LIGHT }}
            >
              PERSONALITY AS ARCHITECTURE
            </h3>
            <p
              className="mt-3 text-[20px] leading-[1.4]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              Why autonomous AI agents have names, archetypes, and voices &mdash; and why it technically matters.
            </p>
            <div className="mt-8" style={{ borderTop: `1px solid ${BORDER}` }} />
          </div>

          {/* ── Two-column: Intro text (cols 1-4) + Miranda card (cols 5-6) ── */}
          <div
            className="mt-10 flex flex-col gap-10 md:flex-row"
            style={{ gap: "24px" }}
          >
            {/* Left — Intro paragraphs (columns 1-4) */}
            <div
              className="flex flex-col gap-5 text-[14px] leading-[1.7] md:flex-[4]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              <p>Why do autonomous AI agents need personalities? Because personality is a form of architecture. Each of the seven agents in this pipeline has a name, an archetype, and a distinct voice. These are not cosmetic choices &mdash; each personality encodes specific behavioral constraints that shape how the agent processes information, communicates results, and interacts with the rest of the system.</p>
              <p>Miranda is modeled after Miranda Priestly &mdash; demanding, terse, and intolerant of sloppy work. Her Priestly persona compels her to reject anything that doesn&rsquo;t meet her exacting standards, functioning as a quality gate without explicit rules about rejection thresholds. Silas channels Sam Spade &mdash; his persona keeps verdicts terse and confident, preventing the rambling hedged assessments that plague most AI systems. Elias is Andrew Neiman from Whiplash &mdash; his desperate-to-prove-himself persona drives retry intensity on failed extractions that a neutral agent would abandon.</p>
              <p>The personality layer also solved a practical problem: observability. A pipeline with seven agents generating thousands of tasks produces enormous volumes of log data. When those logs read like character dialogue &mdash; Miranda&rsquo;s clipped directives, Elena&rsquo;s methodical research notes, Arthur&rsquo;s eager status reports &mdash; the system becomes instantly comprehensible to human observers. Personality makes complexity legible.</p>
              <p>The hierarchical personality structure &mdash; Miranda at the top, the other agents reporting to her &mdash; creates a natural quality control cascade. Every confirmed connection, every rejected false positive, passes through an agent whose defining character trait is demanding better work. The system self-corrects not through explicit error-handling code, but through the social dynamics encoded in its personality architecture.</p>
              <p
                className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ fontFamily: MONO, color: "#B87333" }}
              >
                Summary
              </p>
              <p className="-mt-2">Personality is architecture. It constrains agent behavior, creates a hierarchical quality cascade, and makes complex multi-agent coordination observable to humans. The agents have names because named things are legible things.</p>
            </div>

            {/* Right — Miranda card (columns 5-6) */}
            <div
              className="flex flex-col items-center rounded border p-6 md:flex-[2]"
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
                src="https://znbjqoehvgmkolxewluv.supabase.co/storage/v1/object/public/site-assets/Editor_Sprite.webm"
              />
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
            </div>
          </div>

          <div className="mt-14" style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* ── "The Team" header ── */}
          <p
            className="mt-8 text-[11px] font-bold tracking-wider"
            style={{ fontFamily: MONO, color: GOLD_DIM }}
          >
            {"// THE TEAM"}
          </p>
          <p
            className="mt-2 text-[11px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: MONO, color: TEXT_MID }}
          >
            Miranda sits at the hub. The six specialist agents below handle
            discovery, download, extraction, cross-referencing, investigation,
            and design. Each has an archetype, a voice, and a dedicated language
            model &mdash; chosen not for personality but for the behavioral
            constraints that personality encodes.
          </p>

          {/* ── Sub-agents — 6 spokes ── */}
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-6">
            {subAgents.map((agent) => (
              <div
                key={agent.name}
                className="flex flex-col items-center rounded border p-4"
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
                  className="mt-2 text-center text-[10px] leading-[1.5]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  {agent.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-14" style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* Agent Office showcase — live visualization */}
          <div className="mt-8">
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// THE OFFICE"}
            </p>
            <div
              className="mt-2 flex flex-col gap-4 text-[11px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              <p>
                The Agent Office is a real-time pixel-art dashboard built to make
                personality-as-architecture visible. Each of the seven agents
                occupies a desk in a shared office. When Miranda assigns a task, her
                speech bubble updates. When Silas returns a verdict, it appears on
                screen. The office runs on live pipeline data &mdash; you watch
                autonomous AI coordination happen in real time.
              </p>
            </div>

            {/* Agent Office screen recording */}
            <video
              autoPlay
              muted
              loop
              playsInline
              controls
              className="mt-4 w-full rounded border"
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
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: INVESTIGATION METHODOLOGY
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="4"
            title="INVESTIGATION METHODOLOGY"
            subtitle="How a name match becomes a confirmed connection — or gets rejected."
            intro={[
              "Finding a name in both Architectural Digest and the Epstein records is only the beginning. The system applies a rigorous multi-stage verification process before any connection is confirmed. Of the 476 cross-references identified by the Detective, only 33 survived the full pipeline to become confirmed connections — a rejection rate of over 93%.",
              "The process begins with automated cross-referencing using word-boundary matching and minimum name-length thresholds to reduce false positives. The Detective then assigns a confidence tier (confirmed, likely, possible, or no match) based on the quality of the match. Full first-and-last-name entries in the Black Book with phone numbers are treated as direct evidence. Surname-only collisions are investigated but expected to be false positives — and 97% of them are.",
              "Names that pass the Detective's threshold are handed to the Researcher, who builds an investigative dossier pulling public records, graph analytics, and documentary evidence. The dossier is then reviewed by Miranda, who makes the final call. 'Confirmed' means documented proximity — contact entries, dining records, guest lists, correspondence — not implication of wrongdoing. This standard is enforced consistently across every decision.",
            ]}
            summary="The investigation methodology prioritizes precision over recall. Every confirmed connection has passed through automated cross-referencing, detective triage, deep research, and editorial review. The 93% rejection rate reflects the system's commitment to minimizing false positives."
          />

          {/* ── Verdict Flow + Sankey — two-column layout ── */}
          <div
            className="mt-10 grid items-stretch gap-6"
            style={{ gridTemplateColumns: "188px 1fr" }}
          >
            {/* ── Left: Compact Verdict Flow (minor column 01) ── */}
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

              <div className="min-h-3 w-px flex-1" style={{ backgroundColor: BORDER }} />

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

              <div className="min-h-3 w-px flex-1" style={{ backgroundColor: BORDER }} />

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

              <div className="min-h-3 w-px flex-1" style={{ backgroundColor: BORDER }} />

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

              <div className="min-h-3 w-px flex-1" style={{ backgroundColor: BORDER }} />

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

              <div className="min-h-3 w-px flex-1" style={{ backgroundColor: BORDER }} />

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

            {/* ── Right: Live Sankey Diagram ── */}
            <div
              className="overflow-hidden rounded border"
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
          </div>

          {/* ── Evidence criteria — two columns ── */}
          <div className="mt-12 grid gap-6 md:grid-cols-2">
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
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: INTELLIGENCE INFRASTRUCTURE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
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
              className="mt-2 text-[11px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
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

                <p
                  className="mt-5 text-center text-[9px] tracking-[0.15em]"
                  style={{ fontFamily: MONO, color: "rgba(160,160,176,0.35)" }}
                >
                  Fig. A &mdash; Agent Internal Architecture: the problem_solve() execution path
                  from task intake through context assembly to episode storage.
                </p>
              </div>
            </div>
          </div>

          {/* ── Fig B: Data Pipeline ── */}
          <div className="mt-12">
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// DATA PIPELINE: URL → VERDICT"}
            </p>
            <p
              className="mt-2 text-[11px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
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

                <p
                  className="mt-5 text-center text-[9px] tracking-[0.15em]"
                  style={{ fontFamily: MONO, color: "rgba(160,160,176,0.35)" }}
                >
                  Fig. B &mdash; Data Pipeline: the three transformation
                  stages from archive.org URL to confirmed/rejected verdict.
                </p>
              </div>
            </div>
          </div>

          {/* ── Fig C: Memory & Learning Architecture ── */}
          <div className="mt-12">
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// MEMORY & LEARNING ARCHITECTURE"}
            </p>
            <p
              className="mt-2 text-[11px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
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

                <p
                  className="mt-4 text-center text-[9px] tracking-[0.15em]"
                  style={{ fontFamily: MONO, color: "rgba(160,160,176,0.35)" }}
                >
                  Fig. C &mdash; Memory &amp; Learning Architecture: four feedback
                  loops operating at different timescales, from per-task episodes
                  to persistent institutional knowledge.
                </p>
              </div>
            </div>
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
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6: UI DESIGN
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
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

              {/* Right annotations (minor column 06) */}
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
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 7: LIMITATIONS AND DISCLAIMERS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
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
        <div className="mt-24">
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
        <div className="mt-24">
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
