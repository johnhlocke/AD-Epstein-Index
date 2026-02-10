import { getSupabase } from "./supabase";
import type {
  StatsResponse,
  Feature,
  Dossier,
  DossierWithContext,
  DossierImage,
  PaginatedResponse,
} from "./types";

// ── Stats ──────────────────────────────────────────────────

export async function getStats(): Promise<StatsResponse> {
  const sb = getSupabase();

  // Fetch all issues (lightweight — id, status, month, year)
  const { data: issues } = await sb
    .from("issues")
    .select("id, status, month, year");

  // Fetch features with homeowner presence
  const { data: features } = await sb
    .from("features")
    .select("id, issue_id, homeowner_name, design_style, location_city, location_state, location_country, year_built");

  // Fetch dossiers verdict counts
  const { data: dossiers } = await sb
    .from("dossiers")
    .select("id, editor_verdict");

  const allIssues = issues ?? [];
  const allFeatures = features ?? [];
  const allDossiers = dossiers ?? [];

  // Issue counts
  const statusCounts: Record<string, number> = {};
  for (const i of allIssues) {
    const s = i.status ?? "discovered";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  // Features by year
  const yearMap = new Map<number, number>();
  for (const f of allFeatures) {
    // Get the issue year for this feature
    const issue = allIssues.find((i) => i.id === f.issue_id);
    const year = issue?.year;
    if (year) {
      yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
    }
  }
  const byYear = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // Top styles
  const styleMap = new Map<string, number>();
  for (const f of allFeatures) {
    const style = f.design_style;
    if (style) styleMap.set(style, (styleMap.get(style) ?? 0) + 1);
  }
  const topStyles = Array.from(styleMap.entries())
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Top locations
  const locMap = new Map<string, number>();
  for (const f of allFeatures) {
    const parts = [f.location_city, f.location_state, f.location_country].filter(Boolean);
    const loc = parts.join(", ");
    if (loc) locMap.set(loc, (locMap.get(loc) ?? 0) + 1);
  }
  const topLocations = Array.from(locMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Dossier verdicts
  let confirmed = 0, rejected = 0, pending = 0;
  for (const d of allDossiers) {
    if (d.editor_verdict === "CONFIRMED") confirmed++;
    else if (d.editor_verdict === "REJECTED") rejected++;
    else pending++;
  }

  // Coverage heatmap: year → month statuses
  const coverageMap = new Map<number, (string | null)[]>();
  for (const i of allIssues) {
    const year = i.year;
    if (!year || year < 1988) continue;
    if (!coverageMap.has(year)) {
      coverageMap.set(year, new Array(12).fill(null));
    }
    const months = coverageMap.get(year)!;
    const monthIdx = i.month ? i.month - 1 : null;
    if (monthIdx !== null && monthIdx >= 0 && monthIdx < 12) {
      months[monthIdx] = i.status ?? "discovered";
    }
  }
  const coverage = Array.from(coverageMap.entries())
    .map(([year, months]) => ({ year, months }))
    .sort((a, b) => a.year - b.year);

  return {
    issues: {
      total: allIssues.length,
      extracted: statusCounts["extracted"] ?? 0,
      downloaded: statusCounts["downloaded"] ?? 0,
      discovered: statusCounts["discovered"] ?? 0,
      skipped: statusCounts["skipped_pre1988"] ?? 0,
      target: 456,
    },
    features: {
      total: allFeatures.length,
      withHomeowner: allFeatures.filter((f) => f.homeowner_name).length,
      byYear,
      topStyles,
      topLocations,
    },
    dossiers: {
      total: allDossiers.length,
      confirmed,
      rejected,
      pending,
    },
    coverage,
  };
}

// ── Features ───────────────────────────────────────────────

interface FeatureFilters {
  page?: number;
  pageSize?: number;
  year?: number;
  location?: string;
  designer?: string;
  style?: string;
  search?: string;
  hasDossier?: boolean;
}

export async function getFeatures(
  filters: FeatureFilters = {}
): Promise<PaginatedResponse<Feature & { issue_month: number | null; issue_year: number }>> {
  const sb = getSupabase();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Build query — join with issues for month/year
  let query = sb
    .from("features")
    .select("*, issues!inner(month, year)", { count: "exact" });

  if (filters.year) {
    query = query.eq("issues.year", filters.year);
  }
  if (filters.style) {
    query = query.ilike("design_style", `%${filters.style}%`);
  }
  if (filters.designer) {
    query = query.ilike("designer_name", `%${filters.designer}%`);
  }
  if (filters.location) {
    query = query.or(
      `location_city.ilike.%${filters.location}%,location_state.ilike.%${filters.location}%,location_country.ilike.%${filters.location}%`
    );
  }
  if (filters.search) {
    query = query.or(
      `homeowner_name.ilike.%${filters.search}%,designer_name.ilike.%${filters.search}%,article_title.ilike.%${filters.search}%`
    );
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const features = (data ?? []).map((row: Record<string, unknown>) => {
    const { issues: issueData, ...feature } = row as Record<string, unknown> & {
      issues: { month: number | null; year: number };
    };
    return {
      ...feature,
      issue_month: issueData?.month ?? null,
      issue_year: issueData?.year ?? 0,
    };
  });

  const total = count ?? 0;

  return {
    data: features as (Feature & { issue_month: number | null; issue_year: number })[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ── Dossiers ───────────────────────────────────────────────

export async function getDossiers(
  verdict?: string
): Promise<Dossier[]> {
  const sb = getSupabase();
  let query = sb.from("dossiers").select("*");

  if (verdict) {
    query = query.eq("editor_verdict", verdict);
  }

  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []) as Dossier[];
}

export async function getDossier(id: number): Promise<DossierWithContext | null> {
  const sb = getSupabase();

  const { data: dossier } = await sb
    .from("dossiers")
    .select("*")
    .eq("id", id)
    .single();

  if (!dossier) return null;

  // Fetch related feature
  const { data: feature } = await sb
    .from("features")
    .select("*")
    .eq("id", dossier.feature_id)
    .single();

  // Fetch related issue
  let issue = null;
  if (feature) {
    const { data: issueData } = await sb
      .from("issues")
      .select("*")
      .eq("id", feature.issue_id)
      .single();
    issue = issueData;
  }

  // Fetch images
  const { data: images } = await sb
    .from("dossier_images")
    .select("*")
    .eq("dossier_id", dossier.id)
    .order("page_number");

  return {
    ...dossier,
    feature,
    issue,
    images: (images ?? []) as DossierImage[],
  } as DossierWithContext;
}
