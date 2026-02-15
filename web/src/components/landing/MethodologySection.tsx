"use client";

import Image from "next/image";

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
      "An autonomous multi-agent system discovers, downloads, and extracts every issue of Architectural Digest from 1988 to 2025. A Courier agent scrapes each one, decoding the magazine\u2019s digital article catalog and fetching page images from the archive. A Reader agent then extracts the people featured, their designers, locations, architectural styles, and other details from every home. Where structured data is unavailable, a vision model reads the actual magazine pages to fill gaps.",
    agents: ["Arthur (Scout)", "Casey (Courier)", "Elias (Reader)"],
  },
  {
    num: "02",
    title: "CROSS-REFERENCE EPSTEIN RECORDS",
    description:
      "A Detective agent checks every extracted name against two sources: Epstein\u2019s Little Black Book (approximately 1,500 contacts) and the Department of Justice\u2019s Full Epstein Library (millions of pages of released documents). Names that surface as potential matches are handed to a Researcher agent, which builds a dossier for each one \u2014 pulling public records, graph analytics, and documentary evidence to assess the strength of connection.",
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
 * Agent AI Methodology — four-section dark tech editorial.
 *
 * Deep purple background (#1a1a28) with JetBrains Mono throughout.
 * Four numbered sections: Pipeline, Multi-Agent System,
 * Limitations, and Data Sources.
 *
 * Clean. Minimal. As it should be. — Sable
 */
export function AgentMethodologySection() {
  return (
    <section
      className="relative overflow-hidden"
      id="agent-methodology"
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
          Mapping the Names that Appear in both Architectural Digest and the Epstein Files.
        </p>

        {/* Methodology intro — synced from Figma node 32:2702 */}
        <p
          className="mt-4 max-w-[620px] text-[13px] leading-[1.8]"
          style={{ fontFamily: MONO, color: TEXT_MID }}
        >
          This investigation was conducted entirely by autonomous AI agents
          &mdash; seven specialized workers coordinated by an editor agent,
          with zero manual data entry. Every name, date, location, and
          connection documented on this site was discovered, extracted,
          cross-referenced, and verified through a three-phase pipeline. The
          methodology below describes each phase in detail, from initial
          magazine discovery through Epstein record cross-referencing to final
          editorial review.
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

          {/* Pipeline body text — 4 minor columns wide */}
          <div
            className="mt-4 flex flex-col gap-4 text-[11px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
            style={{ fontFamily: MONO, color: TEXT_MID }}
          >
            <p>
              The entire investigation is run by seven autonomous AI agents
              coordinated through a hub-and-spoke architecture. No human
              touches the data. An editor agent &mdash; Miranda &mdash;
              sits at the center, assigning tasks, reviewing results, and
              making every final call on whether a connection is confirmed
              or rejected. The other six agents report to her.
            </p>
            <p>
              The pipeline operates in three sequential phases. First, the
              AD archive is scraped and every featured home is cataloged
              with its homeowner, designer, location, and style. Second,
              every extracted name is cross-referenced against two Epstein
              sources: the Little Black Book (~1,500 contacts) and the DOJ
              Epstein Library (millions of pages of released documents).
              Third, flagged names receive full investigative dossiers,
              editorial review, and aesthetic scoring before being
              published to this site.
            </p>
            <p>
              The system uses four different AI models, each chosen for
              cost and capability: Opus for editorial judgment, Sonnet for
              research synthesis, Haiku for bulk classification, and Gemini
              for vision tasks like reading magazine pages. Total API cost
              for the full run was approximately $55 over ~18 hours of
              wall-clock time.
            </p>
          </div>

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

          {/* Full 3-phase Architecture SVG — overlaps bottom of phase cards on desktop */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pipeline-architecture.svg"
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
            <div
              className="mt-2 flex flex-col gap-4 text-[11px] leading-[1.7] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
              style={{ fontFamily: MONO, color: TEXT_MID }}
            >
              <p>
                A real-time pixel-art dashboard showing all seven agents at work.
                Each agent has a desk, speech bubbles for status updates, and
                visual indicators for their current task. The office runs on live
                pipeline data &mdash; when an agent processes a task, you see it happen.
              </p>
              <p>
                The Agent Office was built as a monitoring tool during development
                &mdash; a way to watch the entire pipeline in real time without
                reading log files. Each of the seven agents occupies a desk in a
                shared office. When Miranda assigns a task, you see the speech
                bubble update. When Elias finishes reading a magazine page, his
                status changes. When Silas returns a verdict, it appears on screen.
              </p>
              <p>
                The result is a live visualization of autonomous AI coordination
                &mdash; seven agents working in parallel, communicating through a
                shared bulletin board, with Miranda orchestrating from the center.
                The video below captures a typical session.
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
            SECTION 3: LIMITATIONS AND DISCLAIMERS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="3"
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
            SECTION 4: DATA SOURCES
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-24">
          <SectionHeader
            num="4"
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
