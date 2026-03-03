import Link from "next/link";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { VerdictBadge } from "@/components/dossier/VerdictBadge";
import { EvidenceSection } from "@/components/dossier/EvidenceSection";
import { DossierAestheticRadar } from "@/components/dossier/DossierAestheticRadar";
import { FitName } from "@/components/dossier/FitName";
import { ArticleImageGrid } from "@/components/dossier/ArticleImageGrid";
import { getDossierPageBackground } from "@/lib/design-tokens";
import type { FeatureReport } from "@/lib/types";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Feltron card container styles */
const CARD = {
  backgroundColor: "#FAFAFA",
  borderColor: "#000",
  borderWidth: "1px",
  boxShadow: "4px 4px 0 0 #000",
} as const;

/** Feltron card header bar */
const CARD_HEADER = {
  borderBottom: "1px solid #000",
  backgroundColor: "#EDEDED",
} as const;

/** futura-pt label (9px uppercase) */
const LABEL = {
  fontFamily: "futura-pt, sans-serif",
  fontSize: "9px",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  color: "#000",
};

interface ReportDetailProps {
  report: FeatureReport;
}

export function ReportDetail({ report }: ReportDetailProps) {
  const { feature, issue, images, dossier, wealth } = report;
  const hasDossier = dossier !== null;

  const issueDateStr = issue
    ? `${issue.month ? MONTH_NAMES[issue.month] + " " : ""}${issue.year}`
    : "Unknown issue";

  const displayName = dossier?.subject_name ?? feature.homeowner_name ?? "Unknown";

  const locationParts = [feature.location_city, feature.location_state, feature.location_country].filter(Boolean);
  const locationStr = locationParts.join(", ");

  const pageBg = getDossierPageBackground(dossier);

  const watermarkId = feature.id;

  return (
    <div style={{ backgroundColor: pageBg, minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Giant ID number — background watermark */}
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
        {watermarkId}
      </div>
      <SectionContainer width="wide" className="relative z-[1] pt-4 pb-12">
        {/* 1. Back link */}
        <Link
          href="/#index"
          className="inline-block text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/60 transition-colors hover:text-[#1A1A1A]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          &larr; Back to Index
        </Link>

        {/* 2. Section A header */}
        <div className="mt-16">
          <p style={{ fontFamily: "'Lora', serif", color: "#1A1A1A", lineHeight: 1.4 }}>
            <span style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Section A:</span>
            <br />
            <span style={{ fontSize: "14px", fontWeight: 700, backgroundColor: "#000", color: pageBg, padding: "2px 6px", display: "block", marginTop: "4px" }}>Homeowner Information</span>
          </p>
        </div>

        {/* 3. Name + badge + stat rows */}
        <div className="mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "24px" }}>
          {/* Row 1: Name (cols 1-4) + Connection/Badge (cols 5-7), bottoms aligned */}
          <div style={{ gridColumn: "1 / 5", gridRow: "1", display: "flex", flexDirection: "column" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "'Lora', serif", fontSize: "8px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: "#1A1A1A", marginTop: 0 }}>Homeowner Name</p>
            <div style={{ borderTop: "1px solid #000" }} />
            <div style={{ marginTop: "auto", transform: "translateY(calc(0.08em + 3px))" }}>
              <FitName name={displayName} />
            </div>
          </div>
          {/* Row 2: About (cols 1-4) + Property Details (cols 5-7), tops aligned */}
          <div style={{ gridColumn: "1 / 5", gridRow: "2", display: "flex", flexDirection: "column" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "'Lora', serif", fontSize: "8px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: "#1A1A1A", marginTop: 0 }}>About <span style={{ fontWeight: 400, fontStyle: "italic" }}>(information sourced from public biographical records)</span></p>
            <div style={{ borderTop: "1px solid #000", flexGrow: 1, paddingTop: "8px" }}>
              {wealth?.bio_summary && (
                <p style={{ fontFamily: "'Lora', serif", fontSize: "14px", lineHeight: 1.65, color: "#333" }}>
                  {wealth.bio_summary}
                </p>
              )}
            </div>
          </div>
          {/* Row 1 right: Connection badge */}
          <div style={{ gridColumn: "5 / 7", gridRow: "1" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "'Lora', serif", fontSize: "8px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: "#1A1A1A", marginTop: 0 }}>Epstein Connection?</p>
            <div className="flex justify-between px-1" style={{ borderTop: "1px solid #000", height: 28, alignItems: "center", fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Connected to Epstein</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{dossier?.editor_verdict === "CONFIRMED" ? "Confirmed" : dossier?.editor_verdict === "REJECTED" ? "No Connection" : dossier ? "Pending Review" : "Not Investigated"}</span>
            </div>
            <div style={{ paddingTop: "12px", display: "flex", justifyContent: "center" }}>
              <VerdictBadge
                verdict={dossier?.editor_verdict ?? null}
                connectionStrength={dossier?.connection_strength}
                confidenceScore={dossier?.confidence_score}
                size="lg"
              />
            </div>
          </div>
          {/* Row 2 right: Property Details */}
          <div style={{ gridColumn: "5 / 7", gridRow: "2", fontFamily: "futura-pt, sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            <p className="mb-1 px-1" style={{ fontFamily: "'Lora', serif", fontSize: "8px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: "#1A1A1A" }}>Property Details</p>
            <div className="flex justify-between px-1" style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", height: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Location</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{locationStr || "—"}</span>
            </div>
            <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", height: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Year Built</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature.year_built || "—"}</span>
            </div>
            <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", height: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Square Footage</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature.square_footage ? feature.square_footage.toLocaleString() : "—"}</span>
            </div>
            <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", height: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Issue</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{issueDateStr}</span>
            </div>
            {feature.designer_name && (
              <div className="flex justify-between px-1" style={{ borderBottom: "1px solid #000", height: 28, alignItems: "center" }}>
                <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Designer</span>
                <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature.designer_name}</span>
              </div>
            )}
            <div className="flex justify-between px-1" style={{ height: 28, alignItems: "center" }}>
              <span style={{ color: "#1A1A1A", fontWeight: 400 }}>Architect</span>
              <span style={{ color: "#1A1A1A", fontWeight: 700 }}>{feature.architecture_firm || "—"}</span>
            </div>
          </div>
        </div>
        {/* 3. AD Issue section — full width */}
        <div style={{ marginTop: "-16px" }}>
          <p className="mb-1 px-1" style={{ fontFamily: "'Lora', serif", fontSize: "8px", fontWeight: 700, textTransform: "none", letterSpacing: "0.02em", color: "#1A1A1A" }}>Architectural Digest Issue:</p>
          <div style={{ borderTop: "1px solid #000", paddingTop: "6px" }}>
            {feature.article_title && (
              <p style={{ fontFamily: "'Lora', serif", fontSize: "32px", fontWeight: 400, fontStyle: "italic", color: "#1A1A1A", lineHeight: 1.3, textTransform: "capitalize" }}>
                &ldquo;{feature.article_title.toLowerCase()}&rdquo;
              </p>
            )}
            {feature.article_author && (
              <p style={{ fontFamily: "'Lora', serif", fontSize: "18px", fontWeight: 400, color: "#1A1A1A", marginTop: "4px" }}>
                by {feature.article_author}
              </p>
            )}
            {images.length > 0 && (
              <ArticleImageGrid images={images} />
            )}
          </div>
        </div>

        {/* Section B header */}
        <div className="mt-24">
          <p style={{ fontFamily: "'Lora', serif", color: "#1A1A1A", lineHeight: 1.4 }}>
            <span style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Section B:</span>
            <br />
            <span style={{ fontSize: "14px", fontWeight: 700, backgroundColor: "#000", color: pageBg, padding: "2px 6px", display: "block", marginTop: "4px" }}>Epstein Connection</span>
          </p>
        </div>

        {/* 4. Editor review — prose width */}
        {hasDossier && dossier.editor_reasoning && (
          <div className="mt-12" style={{ maxWidth: "var(--content-narrow)" }}>
            <div className="overflow-hidden border" style={CARD}>
              <div className="px-4 py-2" style={CARD_HEADER}>
                <p style={LABEL}>Editor&rsquo;s Review</p>
              </div>
              <div className="px-4 py-4">
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ fontFamily: "'Lora', serif", color: "#333" }}
                >
                  {dossier.editor_reasoning}
                </p>
                {dossier.editor_reviewed_at && (
                  <p
                    className="mt-3 text-[10px] uppercase tracking-[0.1em]"
                    style={{ fontFamily: "futura-pt, sans-serif", color: "#999" }}
                  >
                    Reviewed {new Date(dossier.editor_reviewed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. Evidence — full width */}
        {hasDossier && (
          <div className="mt-12">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
            >
              Evidence
            </p>
            <h2
              className="mt-1 text-[28px] font-black leading-[0.95]"
              style={{ fontFamily: "futura-pt, sans-serif", color: "#1A1A1A" }}
            >
              Epstein Connections
            </h2>
            <hr className="mt-3" style={{ border: 0, borderTop: "2px solid #1A1A1A" }} />
            <div className="mt-5 space-y-4">
              <EvidenceSection
                title="Epstein Connections"
                data={dossier.epstein_connections}
                defaultOpen
              />
            </div>
          </div>
        )}

        {/* 6. Connection assessment — prose width */}
        {hasDossier && dossier.strength_rationale && (
          <div className="mt-12" style={{ maxWidth: "var(--content-narrow)" }}>
            <div className="overflow-hidden border" style={CARD}>
              <div className="px-4 py-2" style={CARD_HEADER}>
                <p style={LABEL}>Connection Assessment</p>
              </div>
              <div className="px-4 py-4">
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ fontFamily: "'Lora', serif", color: "#333" }}
                >
                  {dossier.strength_rationale}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 7. Aesthetic profile — full width */}
        <div className="mt-12">
          <DossierAestheticRadar feature={feature} />
        </div>

        {/* 8. Analysis — full width */}
        {hasDossier && (
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
              />
              <EvidenceSection title="Home Analysis" data={dossier.home_analysis} />
              <EvidenceSection title="Pattern Analysis" data={dossier.pattern_analysis} />
              <EvidenceSection title="Key Findings" data={dossier.key_findings} />
              <EvidenceSection title="Visual Analysis" data={dossier.visual_analysis} />
            </div>
          </div>
        )}

      </SectionContainer>
    </div>
  );
}
