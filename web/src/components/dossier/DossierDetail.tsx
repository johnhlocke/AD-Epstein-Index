import Image from "next/image";
import Link from "next/link";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { VerdictBadge } from "./VerdictBadge";
import { EvidenceSection } from "./EvidenceSection";
import { DossierAestheticRadar, ScoringBreakdown } from "./DossierAestheticRadar";
import { FitName } from "./FitName";
import { ArticleImageGrid } from "./ArticleImageGrid";
import { ScatteredPages } from "./ScatteredPages";
import { EvidenceChain } from "./EvidenceChain";
import { CollapsibleSection } from "./CollapsibleSection";
import { getDossierPageBackground, GROUP_COLORS_DARK } from "@/lib/design-tokens";
import type { DossierWithContext } from "@/lib/types";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** futura-pt label (9px uppercase) */
const LABEL = {
  fontFamily: "futura-pt, sans-serif",
  fontSize: "9px",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  color: "#000",
};

interface DossierDetailProps {
  dossier: DossierWithContext;
}

export function DossierDetail({ dossier }: DossierDetailProps) {
  const feature = dossier.feature;
  const issue = dossier.issue;
  const wealth = dossier.wealth;
  const fame = dossier.fame;

  const issueDateStr = issue
    ? `${issue.month ? MONTH_NAMES[issue.month] + " " : ""}${issue.year}`
    : "Unknown issue";

  const keyFindings = Array.isArray(dossier.key_findings)
    ? dossier.key_findings as string[]
    : [];

  const pageBg = getDossierPageBackground(dossier);

  return (
    <div style={{ backgroundColor: pageBg, minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Giant dossier number — background watermark */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: "-0.2em",
          margin: 0,
          padding: 0,
          fontFamily: "futura-pt, sans-serif",
          fontWeight: 900,
          fontSize: "clamp(200px, 25vw, 400px)",
          lineHeight: 1,
          letterSpacing: "-0.08em",
          color: "rgba(0, 0, 0, 0.05)",
          pointerEvents: "none",
          zIndex: 0,
          userSelect: "none",
          writingMode: "vertical-lr",
          textOrientation: "sideways",
          transform: "rotate(180deg)",
          transformOrigin: "center center",
        }}
      >
        {dossier.id}
      </div>
      <SectionContainer width="wide" className="relative z-[1] pt-4 pb-12">
        {/* 1. Back link */}
        <Link
          href="/#verdicts"
          className="inline-block text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/60 transition-colors hover:text-[#1A1A1A]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          &larr; Back to Index
        </Link>

        {/* Section A — collapsible */}
        <CollapsibleSection label="Section A:" title="Homeowner Information" titleBg={pageBg} marginTop="64px">

        {/* 3. Name + badge + stat rows */}
        <div className="mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "24px" }}>
          {/* Row 1: Name (cols 1-4) + Connection/Badge (cols 5-7), bottoms aligned */}
          <div style={{ gridColumn: "1 / 5", gridRow: "1", display: "flex", flexDirection: "column" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A", marginTop: 0 }}>Homeowner Name</p>
            <div style={{ borderTop: "1px solid #000" }} />
            <div style={{ marginTop: "auto", transform: "translateY(calc(0.08em + 3px))" }}>
              <FitName name={dossier.subject_name} />
            </div>
          </div>
          {/* Row 2: About (cols 1-4) + Property Details (cols 5-7), tops aligned */}
          <div style={{ gridColumn: "1 / 5", gridRow: "2", display: "flex", flexDirection: "column" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A", marginTop: 0 }}>About <span style={{ fontWeight: 400, fontStyle: "italic", textTransform: "none" as const }}>(information sourced from public biographical records)</span></p>
            <div style={{ borderTop: "1px solid #000", flexGrow: 1, paddingTop: "8px", paddingBottom: "8px" }}>
              {wealth?.bio_summary && (
                <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "24px", fontWeight: 600, lineHeight: 1.35, color: "#1A1A1A" }}>
                  {wealth.bio_summary}
                </p>
              )}
            </div>
          </div>
          {/* Row 1 right: Connection badge */}
          <div style={{ gridColumn: "5 / 7", gridRow: "1" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A", marginTop: 0 }}>Epstein Connection?</p>
            <div className="px-1" style={{ borderTop: "1px solid #000", height: 28, display: "flex", alignItems: "center", fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>
              Evidence Pipeline
            </div>
            <div style={{ paddingTop: "12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
              <EvidenceChain crossRef={dossier.crossRef} dossier={dossier} pageBg={pageBg} />
              <div style={{ paddingRight: "12px", marginTop: -15 }}>
                <VerdictBadge verdict={dossier.editor_verdict} connectionStrength={dossier.connection_strength} confidenceScore={dossier.confidence_score} size="lg" pageBg={pageBg} />
              </div>
              {/* Editor verdict line + label */}
              {dossier.editor_verdict !== "PENDING_REVIEW" && (
                <div style={{
                  position: "absolute",
                  left: 160,
                  right: 0,
                  bottom: 7,
                  display: "flex",
                  alignItems: "center",
                }}>
                  <div style={{ flex: 1, height: 2, backgroundColor: "#000", minWidth: 10 }} />
                  <svg width={6} height={12} viewBox="0 0 6 12" fill="none" style={{ display: "block", flexShrink: 0 }}>
                    <polygon points="0,0 6,6 0,12" fill="#000" />
                  </svg>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "13px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                    marginLeft: 8,
                  }}>
                    {dossier.editor_verdict === "REJECTED" && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 14, height: 14, border: "1.5px solid #000", marginRight: 5,
                        fontSize: "13px", lineHeight: 1, color: "#2E7D32", fontWeight: 900, verticalAlign: "middle",
                      }}>✕</span>
                    )}
                    {dossier.editor_verdict === "CONFIRMED" && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 14, height: 14, border: "1.5px solid #000", marginRight: 5,
                        fontSize: "14px", lineHeight: 1, color: "#2E7D32", fontWeight: 900, verticalAlign: "middle",
                      }}>✓</span>
                    )}{dossier.editor_verdict === "CONFIRMED" ? "CONFIRM" : "REJECT"}
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Row 2 right: Property Details */}
          <div style={{ gridColumn: "5 / 7", gridRow: "2", fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", flexDirection: "column" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Property Details</p>
            <div className="flex justify-between px-1" style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", flex: 1, minHeight: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Location</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{[feature?.location_city, feature?.location_state].filter(Boolean).join(", ") || "—"}</span>
            </div>
            <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", flex: 1, minHeight: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Year Built</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature?.year_built || "—"}</span>
            </div>
            <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", flex: 1, minHeight: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Square Footage</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature?.square_footage ? feature.square_footage.toLocaleString() : "—"}</span>
            </div>
            <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", flex: 1, minHeight: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Issue</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{issueDateStr}</span>
            </div>
            {feature?.designer_name && (
              <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", flex: 1, minHeight: 28, alignItems: "center" }}>
                <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Designer</span>
                <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature.designer_name}</span>
              </div>
            )}
            <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", flex: 1, minHeight: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Architect</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature?.architecture_firm || "—"}</span>
            </div>
            <div className="flex justify-between px-1" style={{ flex: 1, minHeight: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Other AD Issues</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>
                {dossier.sibling_dossiers?.length > 0
                  ? dossier.sibling_dossiers.map((s, i) => (
                      <span key={s.dossier_id}>
                        {i > 0 && " "}
                        <a href={`/dossier/${s.dossier_id}`} className="font-bold hover:font-black" style={{ color: "#1A1A1A" }}>
                          {s.issue_date || "Unknown"}
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ display: "inline-block", marginLeft: 2, verticalAlign: "middle" }}>
                            <path d="M1 7L7 1M7 1H2.5M7 1V5.5" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      </span>
                    ))
                  : "—"}
              </span>
            </div>
          </div>
        </div>
        {/* 3. Six-column detail strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            borderTop: "1px solid #000",
            paddingTop: "15px",
            paddingBottom: "12px",
            gap: "24px",
          }}
        >
            <div>
              <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Wealth Score</p>
              <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
              <div style={{ minHeight: "104px", marginTop: "4px" }}>
                {wealth?.forbes_score != null ? (
                  <>
                    <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "28px", fontWeight: 900, color: "#1A1A1A", lineHeight: 1 }}>
                      {wealth.forbes_score.toFixed(1)}
                    </p>
                    <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginTop: "2px" }}>/ 10</p>
                  </>
                ) : (
                  <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>&mdash;</p>
                )}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Wealth Source</p>
              <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
              <div style={{ minHeight: "104px", marginTop: "4px" }}>
                {wealth?.classification ? (
                  <>
                    <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>
                      {wealth.classification.replace(/_/g, " ")}
                    </p>
                    {wealth.wealth_source && (
                      <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, color: "#666", marginTop: "4px", lineHeight: 1.4 }}>
                        {wealth.wealth_source.length > 80 ? wealth.wealth_source.slice(0, 80) + "\u2026" : wealth.wealth_source}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>&mdash;</p>
                )}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Professional Category</p>
              <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
              <div style={{ minHeight: "104px", marginTop: "4px" }}>
                <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>{wealth?.profession_category || feature?.subject_category || "\u2014"}</p>
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Fame Score</p>
              <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
              <div style={{ minHeight: "104px", marginTop: "4px" }}>
                {fame?.fame_score != null ? (
                  <>
                    <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "28px", fontWeight: 900, color: "#1A1A1A", lineHeight: 1 }}>
                      {Math.round(fame.fame_score).toLocaleString()}
                    </p>
                    {fame.wikipedia_pageviews != null && (
                      <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginTop: "2px" }}>
                        {fame.wikipedia_pageviews.toLocaleString()} wiki views
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>&mdash;</p>
                )}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Board Memberships</p>
              <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
              <div style={{ minHeight: "104px", marginTop: "4px" }}>
                {(wealth?.museum_boards || wealth?.elite_boards) ? (
                  <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, color: "#1A1A1A", lineHeight: 1.5 }}>
                    {[wealth?.museum_boards, wealth?.elite_boards].filter(Boolean).join("; ")}
                  </p>
                ) : (
                  <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>&mdash;</p>
                )}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Influence Score</p>
              <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
              <div style={{ minHeight: "104px", marginTop: "4px" }}>
                <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1A1A1A" }}>&mdash;</p>
              </div>
            </div>
        </div>

        {/* 4. AD Issue section — full width */}
        <div style={{ marginTop: "-16px" }}>
          <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Architectural Digest Issue:</p>
          <div style={{ borderTop: "1px solid #000", paddingTop: "6px" }}>
            {feature?.article_title && (
              <p style={{ fontFamily: "'Lora', serif", fontSize: "32px", fontWeight: 400, fontStyle: "italic", color: "#1A1A1A", lineHeight: 1.3, textTransform: "capitalize" }}>
                &ldquo;{feature.article_title.toLowerCase()}&rdquo;
              </p>
            )}
            {feature?.article_author && (
              <p style={{ fontFamily: "'Lora', serif", fontSize: "18px", fontWeight: 400, color: "#1A1A1A", marginTop: "4px" }}>
                by {feature.article_author}
              </p>
            )}
            {dossier.images.length > 0 && (
              <ArticleImageGrid images={dossier.images} />
            )}
          </div>
        </div>

        </CollapsibleSection>

        {/* Section B — collapsible */}
        <CollapsibleSection label="Section B:" title="Epstein Connection Evidence" titleBg={pageBg}>

        {/* Connection Summary (cols 1-4) + Agentic AI Reasoning (cols 5-6) */}
        {(dossier.connection_summary || dossier.editor_reasoning || dossier.strength_rationale) && (
          <div className="mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "24px" }}>
            {dossier.connection_summary && (
              <div style={{ gridColumn: "1 / 5" }}>
                <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Connection Summary <span style={{ fontWeight: 400, fontStyle: "italic", textTransform: "none" as const, color: "#999" }}>(Created by Opus 4.5 based on all evidence collected)</span></p>
                <div style={{ borderTop: "1px solid #000", paddingTop: "8px" }}>
                  <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "24px", fontWeight: 600, lineHeight: 1.35, color: "#1A1A1A" }}>
                    {dossier.connection_summary}
                  </p>
                </div>
                {(() => {
                  const dojResults = dossier.crossRef?.doj_results as Record<string, unknown> | null;
                  const dojDocCount = (dojResults?.total_results as number) ?? 0;
                  const bbMatch = dossier.crossRef?.black_book_status === "match";
                  const evidenceEntries = Array.isArray(dossier.epstein_connections) ? dossier.epstein_connections.length : 0;
                  const sources: string[] = [];
                  if (bbMatch) sources.push("Black Book");
                  if (dojDocCount > 0) sources.push("DOJ Library");
                  return (dojDocCount > 0 || bbMatch) ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", paddingTop: "15px", paddingBottom: "12px", gap: "24px", marginTop: "24px" }}>
                      <div>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>DOJ Documents</p>
                        <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "28px", fontWeight: 900, color: "#1A1A1A", lineHeight: 1, marginTop: "4px" }}>{dojDocCount.toLocaleString()}</p>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginTop: "2px" }}>results in Epstein Library</p>
                      </div>
                      <div>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Evidence Sources</p>
                        <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "28px", fontWeight: 900, color: "#1A1A1A", lineHeight: 1, marginTop: "4px" }}>{sources.length}</p>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginTop: "2px" }}>{sources.join(" + ") || "None"}</p>
                      </div>
                      <div>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Evidence Entries</p>
                        <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "28px", fontWeight: 900, color: "#1A1A1A", lineHeight: 1, marginTop: "4px" }}>{evidenceEntries}</p>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginTop: "2px" }}>distinct pieces</p>
                      </div>
                      <div>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Confidence</p>
                        <div style={{ borderTop: "1px solid #000", marginTop: "4px" }} />
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "28px", fontWeight: 900, color: "#1A1A1A", lineHeight: 1, marginTop: "4px" }}>{dossier.confidence_score != null ? `${Math.round(dossier.confidence_score * 100)}%` : "\u2014"}</p>
                        <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "9px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginTop: "2px" }}>pipeline certainty</p>
                      </div>
                    </div>
                  ) : null;
                })()}
                <div style={{ marginTop: "24px" }}>
                  <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Connection Evidence</p>
                  <div style={{ borderTop: "1px solid #000" }} />
                  <p style={{ fontFamily: "'Lora', serif", fontSize: "16px", lineHeight: 1.55, color: "#1A1A1A", marginTop: "10px" }}>
                    The following documents were used as direct evidence of a possible connection for the Researcher and Editor to make an assessment:
                  </p>
                  {Array.isArray(dossier.epstein_connections) && dossier.epstein_connections.length > 0 && (
                    <ul style={{ marginTop: "12px", paddingLeft: 0, listStyle: "none" }}>
                      {(dossier.epstein_connections as Array<{ source?: string; evidence?: string; context?: string; match_type?: string; document_urls?: string[] }>).map((item, i) => (
                        <li key={i} style={{ marginTop: i === 0 ? 0 : "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ fontFamily: "futura-pt, sans-serif", fontSize: "14px", fontWeight: 700, color: "#000", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                            {item.source && (
                              <span style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#000", border: "1px solid #000", padding: "1px 6px" }}>
                                {item.source === "doj_library" ? "DOJ Library" : item.source === "black_book" ? "Black Book" : item.source === "flight_logs" ? "Flight Logs" : item.source}
                              </span>
                            )}
                            {item.match_type && (
                              <span style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#000", border: "1px solid #000", padding: "1px 6px" }}>
                                {item.match_type === "exact" ? "Exact Name" : item.match_type.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          {item.evidence && (
                            <p style={{ fontFamily: "'Lora', serif", fontSize: "14px", lineHeight: 1.65, color: "#333", marginTop: "6px", paddingLeft: "20px" }}>
                              {item.evidence}
                            </p>
                          )}
                          {item.context && (
                            <div style={{ marginTop: "4px", marginLeft: "20px", paddingLeft: "16px", borderLeft: "1px solid #000" }}>
                              <div style={{ display: "flex" }}>
                                <div style={{ width: "16px", borderBottom: "1px solid #000", flexShrink: 0, marginBottom: "auto", marginTop: "8px" }} />
                                <div style={{ paddingLeft: "8px" }}>
                                  <p style={{ fontFamily: "'Lora', serif", fontSize: "14px", lineHeight: 1.65, color: "#1A1A1A" }}>
                                    {item.context}
                                  </p>
                                  {item.document_urls && item.document_urls.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                                      {item.document_urls.map((url: string, j: number) => {
                                        const filename = url.split("/").pop() || url;
                                        return (
                                          <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="doc-link">
                                            {filename} <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ display: "inline-block", marginLeft: 2, verticalAlign: "middle" }}><path d="M1 7L7 1M7 1H2.5M7 1V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {(dossier.strength_rationale || dossier.editor_reasoning) && (
              <div style={{ gridColumn: "5 / 7", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Agentic AI Reasoning Logic</p>
                  <div style={{ borderTop: "1px solid #000" }} />
                </div>
                {dossier.strength_rationale && (
                  <div className="overflow-hidden border" style={{ borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}>
                    <div className="px-3 py-3" style={{ borderBottom: "1px solid #000", backgroundColor: "rgba(0, 0, 0, 0.08)", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Image src="/researcher_icon.png" alt="" width={28} height={28} style={{ imageRendering: "pixelated" }} />
                      <p style={{ ...LABEL, fontSize: "8px" }}>Researcher&rsquo;s Assessment: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, letterSpacing: "0.05em" }}>{dossier.connection_strength || "PENDING"}</span></p>
                    </div>
                    <div className="px-3 py-3">
                      <p style={{ fontFamily: "'Lora', serif", fontSize: "11px", lineHeight: 1.65, color: "#333" }}>
                        {dossier.strength_rationale}
                      </p>
                      {dossier.investigated_at && (
                        <p className="mt-3" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>
                          Reviewed {new Date(dossier.investigated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {dossier.editor_reasoning && (
                  <div className="overflow-hidden border" style={{ borderColor: "#000", borderWidth: "1px", boxShadow: "4px 4px 0 0 #000" }}>
                    <div className="px-3 py-3" style={{ borderBottom: "1px solid #000", backgroundColor: "rgba(0, 0, 0, 0.08)", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Image src="/editor_icon.png" alt="" width={28} height={28} style={{ imageRendering: "pixelated" }} />
                      <p style={{ ...LABEL, fontSize: "8px" }}>Editor&rsquo;s Final Judgement: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, letterSpacing: "0.05em" }}>{dossier.editor_verdict === "CONFIRMED" ? "CONFIRMED" : dossier.editor_verdict === "REJECTED" ? "REJECTED" : "PENDING"}</span></p>
                    </div>
                    <div className="px-3 py-3">
                      <p style={{ fontFamily: "'Lora', serif", fontSize: "11px", lineHeight: 1.65, color: "#333" }}>
                        {dossier.editor_reasoning}
                      </p>
                      {dossier.editor_reviewed_at && (
                        <p className="mt-3" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>
                          Reviewed {new Date(dossier.editor_reviewed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Key Findings — prose width */}
        {keyFindings.length > 0 && (
          <div className="mt-12" style={{ maxWidth: "var(--content-narrow)" }}>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              Key Findings
            </p>
            <hr className="mt-2" style={{ border: 0, borderTop: "2px solid #1A1A1A" }} />
            <ul className="mt-4 space-y-3">
              {keyFindings.map((finding: string, i: number) => (
                <li
                  key={i}
                  className="flex gap-3 text-[14px] leading-[1.65]"
                  style={{ fontFamily: "'Lora', serif", color: "#333" }}
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[12px] text-[#999]">{String(i + 1).padStart(2, "0")}</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}


        </CollapsibleSection>

        {/* Section C — collapsible */}
        <CollapsibleSection label="Section C:" title="Aesthetic Profile" titleBg={pageBg}>

        {/* Home Score — 4 columns wide */}
        <div className="mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "24px" }}>
          <div style={{ gridColumn: "1 / 5" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Home Score Summary <span style={{ fontWeight: 400, fontStyle: "italic", textTransform: "none" as const }}>(Custom Aesthetic Scoring Instrument v2.3)</span></p>
            <div style={{ borderTop: "1px solid #000", paddingTop: "8px" }}>
              {feature?.aesthetic_profile && (
                <p style={{ fontFamily: "futura-pt, sans-serif", fontSize: "24px", fontWeight: 600, lineHeight: 1.35, color: "#1A1A1A" }}>
                  {feature.aesthetic_profile}
                </p>
              )}
            </div>
          </div>
          <div style={{ gridColumn: "5 / 7" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Feature Pages</p>
            <div style={{ borderTop: "1px solid #000" }} />
            {dossier.images.length > 0 && <ScatteredPages images={dossier.images} />}
          </div>
        </div>

        {/* Aesthetic Scoring — full-width header + rule */}
        <div className="mt-8">
          <p className="mb-1 px-1" style={{ fontFamily: "'Lora', serif", fontSize: "14px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: "#1A1A1A" }}>Home Score</p>
          <div style={{ borderTop: "2px solid #000" }} />
        </div>

        {/* Chart left 3 cols, breakdown right 3 cols */}
        <div className="mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "24px" }}>
          <div style={{ gridColumn: "1 / 4" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Radial Graph</p>
            <div style={{ borderTop: "1px solid #000" }} />
            {feature?.radar_summary && (
              <p style={{ fontFamily: "'Lora', serif", fontSize: "14px", lineHeight: 1.55, color: "#1A1A1A", marginTop: "8px" }}>
                {feature.radar_summary}
              </p>
            )}
            {feature && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <DossierAestheticRadar feature={feature} groupColors={GROUP_COLORS_DARK} />
              </div>
            )}
          </div>
          <div style={{ gridColumn: "4 / 7" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "futura-pt, sans-serif", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#1A1A1A" }}>Scoring Explanations</p>
            <div style={{ borderTop: "1px solid #000" }} />
            {feature && (
              <div className="mt-4">
                <ScoringBreakdown feature={feature} groupColors={GROUP_COLORS_DARK} />
              </div>
            )}
          </div>
        </div>

        {/* 9. Analysis sections — full width */}
        <div className="mt-12">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
          >
            Analysis
          </p>
          <hr className="mt-2" style={{ border: 0, borderTop: "2px solid #1A1A1A" }} />
          <div className="mt-5 space-y-4">
            <EvidenceSection
              title="AD Appearance"
              data={dossier.ad_appearance}
              defaultOpen
              pageBg={pageBg}
            />
            <EvidenceSection title="Home Analysis" data={dossier.home_analysis} pageBg={pageBg} />
            <EvidenceSection title="Pattern Analysis" data={dossier.pattern_analysis} pageBg={pageBg} />
          </div>
        </div>

        {/* Article images — full width (color originals) */}
        {false && dossier.images.length > 0 && (
          <div className="mt-12">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              Article Pages
            </p>
            <hr className="mt-2" style={{ border: 0, borderTop: "2px solid #1A1A1A" }} />
            <div className="mt-5 grid grid-cols-2 gap-4">
              {dossier.images.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden border"
                  style={{ borderColor: "#000", borderWidth: "1px" }}
                >
                  {img.public_url && (
                    <Image
                      src={img.public_url}
                      alt={`Article page ${img.page_number}`}
                      width={600}
                      height={800}
                      className="w-full object-cover"
                    />
                  )}
                  {img.page_number && (
                    <div className="px-3 py-1.5" style={{ borderTop: "1px solid #000", backgroundColor: "#EDEDED" }}>
                      <p style={{ ...LABEL, fontSize: "8px" }}>Page {img.page_number}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </CollapsibleSection>
      </SectionContainer>
    </div>
  );
}
