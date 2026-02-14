/** Database row types matching docs/schema.sql */

export interface Issue {
  id: number;
  month: number | null;
  year: number;
  cover_description: string | null;
  identifier: string | null;
  title: string | null;
  status: string;
  pdf_path: string | null;
  source: string | null;
  source_url: string | null;
  date_confidence: string | null;
  verified_month: number | null;
  verified_year: number | null;
  needs_review: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface Feature {
  id: number;
  issue_id: number;
  article_title: string | null;
  article_author: string | null;
  homeowner_name: string | null;
  designer_name: string | null;
  architecture_firm: string | null;
  year_built: number | null;
  square_footage: number | null;
  cost: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  design_style: string | null;
  page_number: number | null;
  notes: string | null;
  created_at: string;
}

export interface Dossier {
  id: number;
  feature_id: number;
  subject_name: string;
  combined_verdict: string | null;
  confidence_score: number | null;
  connection_strength: "HIGH" | "MEDIUM" | "LOW" | "COINCIDENCE" | null;
  strength_rationale: string | null;
  triage_result: "investigate" | "coincidence" | null;
  triage_reasoning: string | null;
  ad_appearance: Record<string, unknown> | null;
  home_analysis: Record<string, unknown> | null;
  visual_analysis: Record<string, unknown> | null;
  epstein_connections: Record<string, unknown> | null;
  pattern_analysis: Record<string, unknown> | null;
  key_findings: Record<string, unknown> | null;
  investigation_depth: string | null;
  needs_manual_review: boolean;
  review_reason: string | null;
  editor_verdict: "CONFIRMED" | "REJECTED" | "PENDING_REVIEW";
  editor_reasoning: string | null;
  editor_reviewed_at: string | null;
  investigated_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DossierImage {
  id: number;
  dossier_id: number;
  feature_id: number;
  page_number: number | null;
  storage_path: string | null;
  public_url: string | null;
  image_type: string;
  created_at: string;
}

/** Enriched feature with joined issue data */
export interface FeatureWithIssue extends Feature {
  issue_month: number | null;
  issue_year: number;
}

/** Enriched dossier with feature + issue context */
export interface DossierWithContext extends Dossier {
  feature: Feature | null;
  issue: Issue | null;
  images: DossierImage[];
}

/** Stats API response */
export interface StatsResponse {
  issues: {
    total: number;
    extracted: number;
    downloaded: number;
    discovered: number;
    skipped: number;
    target: number;
  };
  features: {
    total: number;
    withHomeowner: number;
    byYear: { year: number; count: number }[];
    topStyles: { style: string; count: number }[];
    topLocations: { location: string; count: number }[];
  };
  dossiers: {
    total: number;
    confirmed: number;
    rejected: number;
    pending: number;
  };
  confirmedTimeline: {
    personName: string;
    year: number;
    month: number | null;
    connectionStrength: string | null;
    locationCity: string | null;
    locationState: string | null;
    locationCountry: string | null;
  }[];
  crossReferences: {
    total: number;
  };
  coverage: {
    year: number;
    months: (string | null)[];
  }[];
}

/** Aesthetic radar chart axis data */
export interface RadarAxisData {
  dimension: string;
  epstein: number; // percentage 0-100
  baseline: number; // percentage 0-100
}

/** Aesthetic radar response with metadata */
export interface AestheticRadarData {
  axes: RadarAxisData[];
  epsteinCount: number;
  baselineCount: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
