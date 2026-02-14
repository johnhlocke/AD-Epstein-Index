"use client";

import Image from "next/image";
import { AestheticRadar } from "@/components/charts/AestheticRadar";

// ── Shared style constants ──────────────────────────────────────────────────
const MONO = "JetBrains Mono, monospace";
const BG = "#1a1a28";
const CARD_BG = "#1a0e2e";
const BORDER = "#2a2a3a";
const TEXT_LIGHT = "#E0E0E5";
const TEXT_MID = "#A0A0B0";
const TEXT_DIM = "rgba(160, 160, 176, 0.6)";
const GREEN = "rgba(46, 204, 113, 0.7)";
const GREEN_BG = "rgba(46, 204, 113, 0.1)";
const GOLD = "rgba(245, 200, 66, 0.8)";
const GOLD_DIM = "rgba(245, 200, 66, 0.7)";
const COPPER_DIM = "rgba(184, 115, 51, 0.25)";

// ── Data ────────────────────────────────────────────────────────────────────

const phases = [
  {
    num: "01",
    title: "BUILD THE AD DATABASE",
    description:
      "An autonomous multi-agent system discovers, downloads, and extracts data from every issue of Architectural Digest available on archive.org (1988\u20132025). A vision AI reads each issue\u2019s table of contents, then extracts homeowner names, designers, locations, styles, and other metrics from each featured home.",
    agents: ["Arthur (Scout)", "Casey (Courier)", "Elias (Reader)"],
  },
  {
    num: "02",
    title: "CROSS-REFERENCE EPSTEIN RECORDS",
    description:
      "Every extracted name is automatically cross-referenced against Epstein\u2019s Little Black Book (~1,500 names) and the DOJ\u2019s Full Epstein Library. A Detective agent searches both sources, and a Researcher agent builds dossiers on potential matches.",
    agents: ["Silas (Detective)", "Elena (Researcher)"],
  },
  {
    num: "03",
    title: "REVIEW & VISUALIZE",
    description:
      "An Editor agent reviews every dossier before confirming or rejecting. All data is served from a Supabase database via server-side queries. No client-side API keys are exposed. The searchable index, charts, and dossier pages are generated from live pipeline data.",
    agents: ["Miranda (Editor)", "Sable (Designer)"],
  },
];

const pipelineStats = [
  { label: "AGENTS DEPLOYED", value: "7" },
  { label: "MODELS USED", value: "4" },
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
    description: "Discovers and catalogues every AD issue on archive.org. Manages the download queue and prioritizes undiscovered issues.",
  },
  {
    name: "Casey",
    role: "Courier",
    sprite: "/agents/courier_front_trans.png",
    description: "Downloads PDFs and extracts page images. Handles archive.org rate limiting and JWT-based article parsing.",
  },
  {
    name: "Elias",
    role: "Reader",
    sprite: "/agents/reader_front_trans.png",
    description: "Vision AI specialist. Reads magazine pages and extracts homeowner names, designers, locations, styles, and metrics from each feature.",
  },
  {
    name: "Silas",
    role: "Detective",
    sprite: "/agents/detective_front_trans.png",
    description: "Cross-references every name against the Little Black Book and DOJ Epstein Library. Produces match verdicts with confidence tiers.",
  },
  {
    name: "Elena",
    role: "Researcher",
    sprite: "/agents/researcher_front_trans.png",
    description: "Builds investigative dossiers on flagged names. Synthesizes evidence from multiple sources into structured reports.",
  },
  {
    name: "Sable",
    role: "Designer",
    sprite: "/agents/designer_front_trans.png",
    description: "Designs and builds the public-facing website. Translates pipeline data into interactive visualizations, charts, and searchable interfaces.",
  },
];

const taxonomyDimensions = [
  { label: "FORMALITY", description: "How formal vs. casual is the interior? Think ballrooms vs. lofts." },
  { label: "SCALE", description: "Square footage, room count, property acreage. The sheer size of the space." },
  { label: "ORNAMENTATION", description: "Level of decorative detail — gilding, moldings, custom millwork, museum-quality art." },
  { label: "COLOR PALETTE", description: "Warm earth tones, cool neutrals, bold accents, or the absence of color entirely." },
  { label: "MATERIAL COST", description: "Marble vs. concrete. Custom bespoke vs. catalog. A proxy for budget." },
  { label: "HISTORICAL REF.", description: "Degree of historical citation — Art Deco, Neoclassical, Modernist, or none." },
];

const dataSources = [
  {
    title: "Archive.org",
    description: "Full archive of Architectural Digest magazine issues (1988\u20132025). PDFs and page images extracted programmatically.",
    url: "https://archive.org",
    tag: "PRIMARY",
  },
  {
    title: "DOJ Epstein Library",
    description: "The U.S. Department of Justice\u2019s complete public release of Epstein-related documents, searchable via OCR.",
    url: "https://www.justice.gov/epstein",
    tag: "PRIMARY",
  },
  {
    title: "Epstein\u2019s Little Black Book",
    description: "~1,500 names and contact details from Epstein\u2019s personal address book, released as part of civil litigation.",
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
}: {
  num: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] tracking-widest"
        style={{ fontFamily: MONO, color: GOLD }}
      >
        SECTION {num}
      </p>
      <h3
        className="mt-2 text-[32px] font-bold leading-[1.1] tracking-tight"
        style={{ fontFamily: MONO, color: TEXT_LIGHT }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-[13px] leading-[1.6]"
        style={{ fontFamily: MONO, color: TEXT_MID }}
      >
        {subtitle}
      </p>
      <div className="mt-5" style={{ borderTop: `1px solid ${BORDER}` }} />
    </div>
  );
}

function DiagramPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="flex h-[400px] items-center justify-center rounded"
      style={{
        border: `1px dashed ${BORDER}`,
        backgroundColor: "rgba(26, 14, 46, 0.3)",
      }}
    >
      <div className="text-center">
        <p
          className="text-[11px] tracking-widest"
          style={{ fontFamily: MONO, color: TEXT_DIM }}
        >
          {label}
        </p>
        <p
          className="mt-2 text-[9px] tracking-wider"
          style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.35)" }}
        >
          DIAGRAM PLACEHOLDER
        </p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

/**
 * Methodology — five-section dark tech editorial.
 *
 * Deep purple background (#1a1a28) with JetBrains Mono throughout.
 * Five numbered sections: Pipeline, Aesthetic Analysis, Multi-Agent System,
 * Limitations, and Data Sources.
 *
 * Clean. Minimal. As it should be. — Sable
 */
export function MethodologySection() {
  return (
    <section
      className="relative overflow-hidden"
      id="methodology"
      style={{ backgroundColor: BG }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{
          background:
            "linear-gradient(180deg, rgba(26,14,46,0.4) 0%, transparent 100%)",
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
          className="mt-2 text-sm"
          style={{ fontFamily: MONO, color: TEXT_MID }}
        >
          An autonomous multi-agent pipeline. No manual data entry.
        </p>

        <div className="mt-6" style={{ borderTop: `1px solid ${BORDER}` }} />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: THE PIPELINE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-16">
          <SectionHeader
            num="1"
            title="THE PIPELINE"
            subtitle="Three phases. Seven agents. Zero manual data entry."
          />

          {/* Pipeline stats — moved here from bottom */}
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {pipelineStats.map((stat) => (
              <div key={stat.label}>
                <p
                  className="text-[28px] font-bold leading-none"
                  style={{ fontFamily: MONO, color: GOLD }}
                >
                  {stat.value}
                </p>
                <p
                  className="mt-2 text-[9px] tracking-widest"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Phase cards */}
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {phases.map((phase) => (
              <div
                key={phase.num}
                className="relative flex flex-col rounded border p-6"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
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
                  className="mt-3 flex-1 text-[11px] leading-[1.65]"
                  style={{ fontFamily: MONO, color: TEXT_MID }}
                >
                  {phase.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {phase.agents.map((agent) => (
                    <span
                      key={agent}
                      className="rounded-sm px-2 py-1 text-[9px]"
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

          {/* Architecture diagrams — full-width below phase cards */}
          <div className="mt-10 flex flex-col gap-6">
            {/* Phase 01 — live SVG from Figma */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pipeline-phase01.svg"
              alt="Phase 01 Architecture — Hub-and-spoke pipeline showing Scout, Courier, and Reader agents feeding data through the Editor to Supabase"
              className="w-full rounded"
              style={{ backgroundColor: CARD_BG }}
            />

            {/* Phase 02 & 03 — placeholders until designed */}
            <DiagramPlaceholder label="PHASE 02 ARCHITECTURE" />
            <DiagramPlaceholder label="PHASE 03 ARCHITECTURE" />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: AESTHETIC ANALYSIS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="2"
            title="AESTHETIC ANALYSIS"
            subtitle="A six-dimension taxonomy of design. Is there an Epstein aesthetic?"
          />

          <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
            {/* Left: editorial text */}
            <div className="flex flex-col gap-6">
              <p
                className="text-[11px] leading-[1.7]"
                style={{ fontFamily: MONO, color: TEXT_MID }}
              >
                Every featured home is scored across six aesthetic dimensions,
                creating a fingerprint of design taste. By comparing the profiles
                of Epstein-connected homes against the full AD baseline, patterns
                emerge — or don&rsquo;t. The data speaks.
              </p>

              {/* Taxonomy dimensions list */}
              <div className="flex flex-col gap-3">
                {taxonomyDimensions.map((dim, i) => (
                  <div
                    key={dim.label}
                    className="rounded border px-4 py-3"
                    style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-[10px] font-bold"
                        style={{ fontFamily: MONO, color: GOLD }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="text-[10px] font-bold tracking-wider"
                        style={{ fontFamily: MONO, color: TEXT_LIGHT }}
                      >
                        {dim.label}
                      </span>
                    </div>
                    <p
                      className="mt-1 text-[10px] leading-[1.5]"
                      style={{
                        fontFamily: MONO,
                        color: TEXT_DIM,
                        paddingLeft: "34px",
                      }}
                    >
                      {dim.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Center + Right: radar chart spanning 2 columns */}
            <div className="md:col-span-2">
              <AestheticRadar />

              <div className="mt-4 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-6 rounded-sm"
                    style={{ backgroundColor: "#B87333" }}
                  />
                  <span
                    className="text-[9px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    EPSTEIN-LINKED HOMES
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-6 rounded-sm"
                    style={{
                      backgroundColor: "rgba(46, 204, 113, 0.5)",
                    }}
                  />
                  <span
                    className="text-[9px] tracking-wider"
                    style={{ fontFamily: MONO, color: TEXT_DIM }}
                  >
                    AD BASELINE
                  </span>
                </div>
              </div>

              {/* Findings placeholder */}
              <div
                className="mt-6 rounded border p-6"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
              >
                <p
                  className="text-[11px] font-bold tracking-wider"
                  style={{ fontFamily: MONO, color: GOLD_DIM }}
                >
                  {"// KEY FINDINGS"}
                </p>
                <p
                  className="mt-3 text-[11px] leading-[1.7]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  Placeholder for aesthetic analysis findings. Does the
                  Epstein-linked portfolio skew toward formality and scale? Do
                  material costs diverge significantly from the baseline? The
                  taxonomy will reveal whether these homes share a coherent
                  aesthetic identity — or whether the overlap is stylistically
                  random.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: MULTI-AGENT SYSTEM
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="3"
            title="MULTI-AGENT SYSTEM"
            subtitle="A hub-and-spoke architecture. Seven autonomous agents, one editor, zero humans in the loop."
          />

          {/* Hub-and-spoke diagram placeholder */}
          <div className="mt-10">
            <DiagramPlaceholder label="HUB-AND-SPOKE ARCHITECTURE DIAGRAM" />
          </div>

          {/* ── Miranda — Editor (hero row) ── */}
          <div
            className="mt-10 flex flex-col items-center gap-6 rounded border p-8 md:flex-row md:items-start"
            style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
          >
            <div className="relative h-[180px] w-[130px] flex-shrink-0">
              <Image
                src={editorAgent.sprite}
                alt={`${editorAgent.name} — ${editorAgent.role}`}
                fill
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="flex flex-col text-center md:text-left">
              <p
                className="text-[15px] font-bold"
                style={{ fontFamily: MONO, color: TEXT_LIGHT }}
              >
                {editorAgent.name}
              </p>
              <p
                className="text-[10px] tracking-wider"
                style={{ fontFamily: MONO, color: "#B87333" }}
              >
                {editorAgent.role.toUpperCase()} — THE HUB
              </p>
              <p
                className="mt-3 max-w-[720px] text-[11px] leading-[1.8]"
                style={{ fontFamily: MONO, color: TEXT_MID }}
              >
                {editorAgent.description}
              </p>
            </div>
          </div>

          {/* ── Sub-agents — 6 spokes ── */}
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-6">
            {subAgents.map((agent) => (
              <div
                key={agent.name}
                className="flex flex-col items-center rounded border p-4"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
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
                  className="text-[9px] tracking-wider"
                  style={{ fontFamily: MONO, color: GREEN }}
                >
                  {agent.role.toUpperCase()}
                </p>
                <p
                  className="mt-2 text-center text-[9px] leading-[1.5]"
                  style={{ fontFamily: MONO, color: TEXT_DIM }}
                >
                  {agent.description}
                </p>
              </div>
            ))}
          </div>

          {/* Agent Office showcase */}
          <div className="mt-10">
            <p
              className="text-[11px] font-bold tracking-wider"
              style={{ fontFamily: MONO, color: GOLD_DIM }}
            >
              {"// THE AGENT OFFICE"}
            </p>
            <p
              className="mt-2 text-[11px] leading-[1.7]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              A real-time pixel-art dashboard showing all seven agents at work.
              Each agent has a desk, speech bubbles for status updates, and
              visual indicators for their current task. The office runs on live
              pipeline data — when an agent processes a task, you see it happen.
            </p>

            {/* Video / interactive embed placeholder */}
            <div
              className="mt-4 flex h-[480px] flex-col items-center justify-center overflow-hidden rounded border"
              style={{
                backgroundColor: "rgba(17, 17, 24, 0.8)",
                borderColor: BORDER,
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full border"
                style={{ borderColor: "#B87333" }}
              >
                <div
                  className="ml-0.5 h-0 w-0"
                  style={{
                    borderLeft: "8px solid #B87333",
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                  }}
                />
              </div>
              <p
                className="mt-4 text-[11px] tracking-widest"
                style={{ fontFamily: MONO, color: TEXT_DIM }}
              >
                AGENT OFFICE — SCREEN RECORDING
              </p>
              <p
                className="mt-1 text-[9px] tracking-wider"
                style={{
                  fontFamily: MONO,
                  color: "rgba(160, 160, 176, 0.35)",
                }}
              >
                VIDEO EMBED PLACEHOLDER
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: LIMITATIONS AND DISCLAIMERS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="4"
            title="LIMITATIONS"
            subtitle="What this project can and cannot tell you."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Disclaimer — code comment style */}
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
                legal filings for entirely innocuous reasons. This project
                identifies name matches in public records — it does not make
                accusations. Every match is reviewed and categorized by
                confidence level.
              </p>
            </div>

            {/* Methodology limitations */}
            <div
              className="rounded border p-6"
              style={{ backgroundColor: "#111118", borderColor: BORDER }}
            >
              <p
                className="text-[11px] font-bold"
                style={{ fontFamily: MONO, color: GOLD_DIM }}
              >
                {"// METHODOLOGY LIMITATIONS"}
              </p>
              <p
                className="mt-3 text-[11px] leading-[1.7]"
                style={{ fontFamily: MONO, color: "rgba(160, 160, 176, 0.7)" }}
              >
                Placeholder for methodology limitations. OCR accuracy on
                handwritten documents, name disambiguation challenges, temporal
                gaps in the archive, the inherent limitations of automated
                cross-referencing. What the pipeline catches and what it
                necessarily misses.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: DATA SOURCES
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="5"
            title="DATA SOURCES"
            subtitle="Primary sources, infrastructure, and the full codebase."
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
                  className="self-start rounded-sm px-2 py-0.5 text-[8px] tracking-widest"
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
                    className="mt-3 truncate text-[9px]"
                    style={{ fontFamily: MONO, color: "rgba(184, 115, 51, 0.5)" }}
                  >
                    {src.url}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
