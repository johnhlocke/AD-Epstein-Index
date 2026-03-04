/**
 * VerdictBadge — binary fill/outline classification stamp.
 *
 * Solid black circle = confirmed Epstein connection (the stamp).
 * Hatched circle = everything else (not investigated, rejected, pending).
 *
 * — Sable
 */

const strengthLabels: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  COINCIDENCE: "Coincidence",
};

type Verdict = "CONFIRMED" | "REJECTED" | "PENDING_REVIEW";

interface VerdictBadgeProps {
  /** null = no dossier (feature-only page) */
  verdict: Verdict | null;
  connectionStrength?: string | null;
  confidenceScore?: number | null;
  size?: "sm" | "lg";
  pageBg?: string;
}

export function VerdictBadge({
  verdict,
  connectionStrength,
  confidenceScore,
  size = "sm",
  pageBg = "#FAFAFA",
}: VerdictBadgeProps) {
  const isLg = size === "lg";
  const diameter = isLg ? 134 : 55;
  const isConfirmed = verdict === "CONFIRMED";

  // -- Label logic --
  let primaryLabel: string;
  let secondaryLabel: string | null = null;

  if (isConfirmed) {
    primaryLabel = "Yes";
    const parts: string[] = [];
    if (connectionStrength && strengthLabels[connectionStrength]) {
      parts.push(`${strengthLabels[connectionStrength]} Connection\nto Epstein`);
    }
    if (confidenceScore !== null && confidenceScore !== undefined) {
      parts.push(`${Math.round(confidenceScore * 100)}% Confidence`);
    }
    secondaryLabel = parts.length > 0 ? parts.join("\n") : null;
  } else if (verdict === "REJECTED") {
    primaryLabel = isLg ? "No Known\nEpstein\nConnection" : "None";
  } else if (verdict === "PENDING_REVIEW") {
    primaryLabel = isLg ? "No Known\nEpstein\nConnection" : "None";
  } else {
    // null — no dossier
    primaryLabel = isLg ? "No Known\nEpstein\nConnection" : "None";
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
              whiteSpace: "pre-line",
            }}
          >
            {secondaryLabel}
          </span>
        )}
      </div>
    );
  }

  // Hatched circle — diagonal lines with text knockout
  const r = diameter / 2;
  const stroke = isLg ? 3 : 2;
  const lineGap = isLg ? 6 : 4;
  const lines = primaryLabel.split("\n");
  const fontSize = isLg ? 12 : 5;
  const lineHeight = fontSize * 1.3;
  const textBlockHeight = lines.length * lineHeight;
  const textStartY = r - textBlockHeight / 2 + fontSize;
  // Generate diagonal hatch lines across the circle
  const hatchLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let offset = -diameter; offset < diameter * 2; offset += lineGap) {
    hatchLines.push({
      x1: offset,
      y1: 0,
      x2: offset + diameter,
      y2: diameter,
    });
  }

  return (
    <svg
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        <clipPath id={`circle-clip-${diameter}`}>
          <circle cx={r} cy={r} r={r - stroke / 2} />
        </clipPath>
      </defs>
      {/* Diagonal hatch lines clipped to circle */}
      <g clipPath={`url(#circle-clip-${diameter})`}>
        {hatchLines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#000"
            strokeWidth={isLg ? 1 : 0.5}
            strokeOpacity={0.25}
          />
        ))}
      </g>
      {/* Circle outline */}
      <circle
        cx={r}
        cy={r}
        r={r - stroke / 2}
        fill="none"
        stroke="#000"
        strokeWidth={stroke}
      />
      {/* Text with pageBg halo — paint-order renders stroke behind fill */}
      {lines.map((line, i) => (
        <text
          key={i}
          x={r}
          y={textStartY + i * lineHeight}
          textAnchor="middle"
          stroke={pageBg}
          strokeWidth={isLg ? 6 : 3}
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{
            fontFamily: "futura-pt, sans-serif",
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fill: "#000",
          }}
        >
          {line}
        </text>
      ))}
    </svg>
  );
}
