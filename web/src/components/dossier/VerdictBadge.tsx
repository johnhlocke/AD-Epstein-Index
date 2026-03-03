/**
 * VerdictBadge — binary fill/outline classification stamp.
 *
 * Solid black circle = confirmed Epstein connection (the stamp).
 * Outline circle = everything else (not investigated, rejected, pending).
 *
 * — Sable
 */

const strengthLabels: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Med",
  LOW: "Low",
  COINCIDENCE: "Coinc.",
};

type Verdict = "CONFIRMED" | "REJECTED" | "PENDING_REVIEW";

interface VerdictBadgeProps {
  /** null = no dossier (feature-only page) */
  verdict: Verdict | null;
  connectionStrength?: string | null;
  confidenceScore?: number | null;
  size?: "sm" | "lg";
}

export function VerdictBadge({
  verdict,
  connectionStrength,
  confidenceScore,
  size = "sm",
}: VerdictBadgeProps) {
  const isLg = size === "lg";
  const diameter = isLg ? 128 : 52;
  const isConfirmed = verdict === "CONFIRMED";

  // -- Label logic --
  let primaryLabel: string;
  let secondaryLabel: string | null = null;

  if (isConfirmed) {
    primaryLabel = "Yes";
    const parts: string[] = [];
    if (connectionStrength && strengthLabels[connectionStrength]) {
      parts.push(`${strengthLabels[connectionStrength]} Connection`);
    }
    if (confidenceScore !== null && confidenceScore !== undefined) {
      parts.push(`${Math.round(confidenceScore * 100)}%`);
    }
    secondaryLabel = parts.length > 0 ? parts.join(" — ") : null;
  } else if (verdict === "REJECTED") {
    primaryLabel = isLg ? "No\nConnection" : "None";
  } else if (verdict === "PENDING_REVIEW") {
    primaryLabel = isLg ? "Pending\nReview" : "Pending";
  } else {
    // null — no dossier
    primaryLabel = isLg ? "Not\nInvestigated" : "N/I";
  }

  if (isConfirmed) {
    // Solid black fill — the stamp
    return (
      <div
        style={{
          width: diameter,
          height: diameter,
          borderRadius: "50%",
          backgroundColor: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "futura-pt, sans-serif",
            fontSize: isLg ? "24px" : "7px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#FFF",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {primaryLabel}
        </span>
        {secondaryLabel && (
          <span
            style={{
              fontFamily: "futura-pt, sans-serif",
              fontSize: isLg ? "11px" : "6px",
              fontWeight: 400,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.6)",
              textAlign: "center",
              marginTop: isLg ? 3 : 1,
            }}
          >
            {secondaryLabel}
          </span>
        )}
      </div>
    );
  }

  // Outline only — classification without alarm
  return (
    <div
      style={{
        width: diameter,
        height: diameter,
        borderRadius: "50%",
        border: "1px solid #000",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: "futura-pt, sans-serif",
          fontSize: isLg ? "16px" : "6px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#000",
          textAlign: "center",
          lineHeight: 1.2,
          whiteSpace: "pre-line",
        }}
      >
        {primaryLabel}
      </span>
    </div>
  );
}
