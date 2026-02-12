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

/**
 * Spacing scale — every value on the 8px baseline grid.
 */
export const spacing = {
  /** 8px baseline atom */
  baseline: 8,
  /** 24px base unit (3 × baseline) — the system's fundamental unit */
  unit: 24,
  /** Scale: 8, 16, 24, 32, 48, 64, 80, 96 */
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  "2xl": 64,
  "3xl": 80,
  "4xl": 96,
  sectionGap: "5rem", // 80px = 10 × baseline
} as const;

/**
 * The Grid — 6 slices, 3 major columns, proportional margins.
 *
 * Base unit: 24px (3 × 8px baseline). Everything derives from this.
 * Margin progression: 1u → 2u → 4u (geometric ratio of 2).
 *
 * Desktop layout at 1440px reference:
 * | 96px | S1:188 | 24 | S2:188 | 24 | S3:188 | 24 | S4:188 | 24 | S5:188 | 24 | S6:188 | 96px |
 *
 * Content area = 1440 - 192 = 1248px
 * Gutters = 5 × 24px = 120px
 * 6 slices = (1248 - 120) / 6 = 188px each
 * Major column = 2 slices + 1 gutter = 400px
 * Half grid = 3 slices + 2 gutters = 612px
 */
export const grid = {
  /** Base unit in px — everything derives from this */
  unit: 24,
  /** Gutter width between slices in px — constant across all breakpoints */
  gutter: 24,
  /** Maximum content width in px */
  maxWidth: 1440,

  /** Responsive margins (in px) */
  margin: {
    mobile: 24,   // 1 unit
    tablet: 48,   // 2 units
    desktop: 96,  // 4 units
  },

  /** Responsive slice counts */
  slices: {
    mobile: 2,
    tablet: 4,
    desktop: 6,
  },

  /** Responsive column counts */
  columns: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },

  /** Breakpoints in px */
  breakpoints: {
    tablet: 768,
    desktop: 1024,
  },

  /**
   * Content width tiers (at 1440px reference width).
   * narrow = 3 slices (half), medium = 4 slices (⅔), wide = 6 slices (full).
   */
  tiers: {
    narrow: 612,   // 3 × 188 + 2 × 24 = 612px — body text, prose
    medium: 824,   // 4 × 188 + 3 × 24 = 824px — charts with legends, tables
    wide: 1248,    // 6 × 188 + 5 × 24 = 1248px — full content width
  },

  /** CSS grid-template-columns for the 6-slice grid */
  templateSlices: "repeat(6, 1fr)",
  /** CSS grid-template-columns for the 3-column grid */
  templateColumns: "repeat(3, 1fr)",
  /** CSS gap value */
  gap: "24px",
} as const;

export const verdictConfig = {
  CONFIRMED: { label: "Confirmed", color: colors.confirmed, bg: colors.confirmedBg },
  REJECTED: { label: "Rejected", color: colors.rejected, bg: colors.rejectedBg },
  PENDING_REVIEW: { label: "Pending Review", color: colors.pending, bg: colors.pendingBg },
} as const;
