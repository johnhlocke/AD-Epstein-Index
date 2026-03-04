import Image from "next/image";
import type { Dossier, CrossReference } from "@/lib/types";

// ── Types ──

interface EvidenceChainProps {
  crossRef: CrossReference | null;
  dossier: Dossier | null;
  pageBg?: string;
}

type AgentStatus = "active" | "inactive";
type ExitVerdict = "REJECT" | "CONFIRM" | null;

interface AgentNode {
  agent: "detective" | "researcher" | "editor";
  label: string;
  icon: string;
  status: AgentStatus;
  evidence: string | null;   // label between this node and the next
  exit: ExitVerdict;          // arrow breaking right
}

// ── Derive chain state from live data ──

function deriveChain(crossRef: CrossReference | null, dossier: Dossier | null): AgentNode[] {
  // Detective
  const hasXref = crossRef !== null;
  const bbMatch = crossRef?.black_book_status === "match";
  const dojSearched = crossRef?.doj_status === "searched";
  const dojHasResults = dojSearched && crossRef?.doj_results != null &&
    (Array.isArray(crossRef.doj_results) ? crossRef.doj_results.length > 0 : Object.keys(crossRef.doj_results).length > 0);

  const detectiveActive = hasXref;
  const hasDossier = dossier !== null;
  const detectivePromoted = hasXref && crossRef.combined_verdict !== "no_match" && crossRef.combined_verdict !== "pending" && hasDossier;
  const detectiveRejected = hasXref && (crossRef.combined_verdict === "no_match" || !hasDossier);

  // Evidence label: what did the detective find?
  let detectiveEvidence: string | null = null;
  if (detectivePromoted) {
    if (bbMatch && dojHasResults) detectiveEvidence = "BB + DOJ";
    else if (dojHasResults) detectiveEvidence = "DOJ Match";
    else if (bbMatch) detectiveEvidence = "BB Match";
    else detectiveEvidence = crossRef.combined_verdict?.replace("_", " ").toUpperCase() ?? null;
  }

  // Researcher
  const researcherActive = detectivePromoted && hasDossier;
  const triageInvestigate = dossier?.triage_result === "investigate";
  const researcherPromoted = researcherActive && triageInvestigate && dossier.connection_strength !== "COINCIDENCE";
  const researcherRejected = researcherActive && (dossier.triage_result === "coincidence" || dossier.connection_strength === "COINCIDENCE");

  // Evidence label: what strength did the researcher assign?
  let researcherEvidence: string | null = null;
  if (researcherPromoted && dossier?.connection_strength) {
    researcherEvidence = dossier.connection_strength;
  }

  // Editor
  const editorActive = researcherPromoted && dossier?.editor_verdict !== "PENDING_REVIEW";
  const editorConfirmed = editorActive && dossier?.editor_verdict === "CONFIRMED";
  const editorRejected = editorActive && dossier?.editor_verdict === "REJECTED";

  return [
    {
      agent: "detective",
      label: "DETECTIVE",
      icon: "/detective_icon.png",
      status: detectiveActive ? "active" : "inactive",
      evidence: detectiveEvidence,
      exit: detectiveRejected ? "REJECT" : null,
    },
    {
      agent: "researcher",
      label: "RESEARCHER",
      icon: "/researcher_icon.png",
      status: researcherActive ? "active" : "inactive",
      evidence: researcherEvidence,
      exit: researcherRejected ? "REJECT" : null,
    },
    {
      agent: "editor",
      label: "EDITOR",
      icon: "/editor_icon.png",
      status: editorActive ? "active" : "inactive",
      evidence: null,
      exit: editorConfirmed ? "CONFIRM" : editorRejected ? "REJECT" : null,
    },
  ];
}

// ── Styles ──

const ACTIVE_BOX: React.CSSProperties = {
  border: "2px solid #000",
  boxShadow: "2px 2px 0 0 #000",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "2px 10px",
};

const INACTIVE_BOX: React.CSSProperties = {
  border: "1px dashed #000",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "2px 10px",
  opacity: 0.65,
};

const AGENT_LABEL: React.CSSProperties = {
  fontFamily: "futura-pt, sans-serif",
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#000",
};

const EVIDENCE_LABEL: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "11px",
  fontWeight: 700,
  color: "#000",
  textAlign: "center",
};

const EXIT_LABEL: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: "0.08em",
};

// ── Arrow SVGs ──

function DownArrow({ dashed = false, height = 38 }: { dashed?: boolean; height?: number }) {
  const tipH = 6;
  const lineEnd = height - tipH;
  return (
    <svg width="16" height={height} viewBox={`0 0 16 ${height}`} fill="none" style={{ display: "block", margin: "0 auto" }}>
      <line x1="8" y1="0" x2="8" y2={lineEnd} stroke={dashed ? "rgba(0,0,0,0.65)" : "#000"} strokeWidth={dashed ? 1 : 2} strokeDasharray={dashed ? "4 3" : undefined} />
      <polygon points={`2,${lineEnd} 8,${height} 14,${lineEnd}`} fill={dashed ? "rgba(0,0,0,0.65)" : "#000"} />
    </svg>
  );
}

function ExitLabel({ label }: { label: string }) {
  return (
    <>
      {label === "REJECT" && (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          border: "1.5px solid #000",
          marginRight: 5,
          fontSize: "13px",
          lineHeight: 1,
          color: "#2E7D32",
          fontWeight: 900,
          verticalAlign: "middle",
        }}>✕</span>
      )}{label}
    </>
  );
}

function LShapedExitArrow({ label }: { label: string }) {
  // L-shaped: down 19px from bottom-center of box, then right 56px with arrowhead
  const downLen = 19;
  const rightLen = 56;
  const tipW = 6;
  const totalW = rightLen + tipW;
  const totalH = downLen + 5;
  return (
    <div style={{ position: "absolute", left: "50%", top: "100%", transform: "translateX(-1px)", zIndex: 2 }}>
      <svg width={totalW + 3} height={totalH} viewBox={`0 0 ${totalW + 3} ${totalH}`} fill="none" style={{ display: "block", marginLeft: -1 }}>
        <line x1="1" y1="0" x2="1" y2={downLen} stroke="#000" strokeWidth="2" />
        <line x1="1" y1={downLen} x2={rightLen + 1} y2={downLen} stroke="#000" strokeWidth="2" />
        <polygon points={`${rightLen + 1},${downLen - 4} ${rightLen + 1 + tipW},${downLen} ${rightLen + 1},${downLen + 4}`} fill="#000" />
      </svg>
      <span style={{ ...EXIT_LABEL, position: "absolute", left: rightLen + tipW + 13, top: downLen - 7, whiteSpace: "nowrap" }}>
        <ExitLabel label={label} />
      </span>
    </div>
  );
}

// ── Component ──

export function EvidenceChain({ crossRef, dossier, pageBg = "#FAFAFA" }: EvidenceChainProps) {
  const chain = deriveChain(crossRef, dossier);

  const SLOT_HEIGHT = 38; // fixed height for evidence label + arrow between boxes

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", position: "relative", width: "100%" }}>
      {chain.map((node, i) => (
        <div key={node.agent} style={{
          display: "flex", flexDirection: "column", alignItems: "flex-start", position: "relative", zIndex: chain.length - i,
          alignSelf: "stretch",
        }}>
          {/* Fixed-height slot between boxes: evidence label + arrow */}
          {i > 0 && (() => {
            const isActive = node.status === "active";
            const hasEvidence = isActive && !!chain[i - 1].evidence;
            const prevHasExit = !!chain[i - 1].exit;
            const exitOffset = prevHasExit ? 19 : 0;
            return (
              <div style={{ height: SLOT_HEIGHT, position: "relative", zIndex: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", width: 160 }}>
                <DownArrow dashed={!isActive} height={SLOT_HEIGHT - exitOffset} />
                {hasEvidence && (
                  <div style={{
                    ...EVIDENCE_LABEL,
                    lineHeight: 1,
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    whiteSpace: "nowrap",
                    backgroundColor: pageBg,
                    color: "#000",
                    padding: "2px 6px",
                  }}>
                    [{chain[i - 1].evidence}]
                  </div>
                )}
              </div>
            );
          })()}

          {/* Agent box */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              ...(node.status === "active" ? ACTIVE_BOX : INACTIVE_BOX),
              backgroundColor: node.status === "active" ? "rgba(0, 0, 0, 0.08)" : pageBg,
              minWidth: 160,
              position: "relative",
            }}>
              <Image
                src={node.icon}
                alt={node.label}
                width={24}
                height={24}
                style={{ imageRendering: "pixelated", flexShrink: 0 }}
              />
              <span style={{
                ...AGENT_LABEL,
                opacity: node.status === "active" ? 1 : 0.6,
                position: "absolute",
                left: 0,
                right: 0,
                textAlign: "center",
                pointerEvents: "none",
              }}>
                {node.label}
              </span>
              {/* L-shaped exit arrow (detective/researcher) */}
              {node.exit && node.agent !== "editor" && <LShapedExitArrow label={node.exit} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
