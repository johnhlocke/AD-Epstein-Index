/**
 * Design tokens for the AD-Epstein Index website.
 * Derived from docs/design-rules.md + Designer agent knowledge base.
 *
 * Editorial/investigative journalism aesthetic (NYT, ProPublica, The Pudding).
 */

export const colors = {
  background: "#FAFAFA",
  foreground: "#1A1A1A",
  // Warm copper accent — authoritative but not aggressive
  accent: "#B87333",
  accentLight: "#D4A574",
  accentMuted: "#E8D5C0",
  // Verdict colors
  confirmed: "#2D6A4F",
  confirmedBg: "#D8F3DC",
  rejected: "#9B2226",
  rejectedBg: "#FDE8E8",
  pending: "#B8860B",
  pendingBg: "#FFF3CD",
  // Coverage heatmap
  heatmapEmpty: "#F0F0F0",
  heatmapLow: "#E8D5C0",
  heatmapMedium: "#D4A574",
  heatmapHigh: "#B87333",
  heatmapFull: "#8B5E3C",
  // Chart palette (warm editorial)
  chart1: "#B87333",
  chart2: "#2D6A4F",
  chart3: "#4A7C8F",
  chart4: "#9B7653",
  chart5: "#6B5B73",
  // Neutrals
  border: "#E5E5E5",
  muted: "#737373",
  mutedLight: "#A3A3A3",
  surface: "#FFFFFF",
} as const;

export const typography = {
  headline: "'Playfair Display', Georgia, serif",
  body: "'Inter', system-ui, -apple-system, sans-serif",
  data: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const spacing = {
  textMaxWidth: "720px",
  vizMaxWidth: "1200px",
  pageMaxWidth: "1400px",
  sectionGap: "5rem",
  contentPadding: "1.5rem",
} as const;

export const verdictConfig = {
  CONFIRMED: { label: "Confirmed", color: colors.confirmed, bg: colors.confirmedBg },
  REJECTED: { label: "Rejected", color: colors.rejected, bg: colors.rejectedBg },
  PENDING_REVIEW: { label: "Pending Review", color: colors.pending, bg: colors.pendingBg },
} as const;
