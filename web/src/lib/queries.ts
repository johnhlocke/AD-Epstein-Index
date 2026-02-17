import { unstable_cache } from "next/cache";
import { getSupabase } from "./supabase";
import type {
  StatsResponse,
  Feature,
  Dossier,
  DossierWithContext,
  DossierImage,
  FeatureImage,
  FeatureReport,
  PaginatedResponse,
  AestheticRadarData,
} from "./types";

// ── Stats ──────────────────────────────────────────────────

// Cache stats for 5 minutes server-side — avoids hitting Supabase on every page load
// while keeping force-dynamic on the page (no build-time generation)
export const getStats = unstable_cache(async (): Promise<StatsResponse> => {
  const sb = getSupabase();

  // Fetch all issues (lightweight — id, status, month, year)
  const { data: issues } = await sb
    .from("issues")
    .select("id, status, month, year");

  // Fetch features with homeowner presence
  const { data: features } = await sb
    .from("features")
    .select("id, issue_id, homeowner_name, design_style, location_city, location_state, location_country, year_built, subject_category");

  // Fetch dossiers verdict counts + confirmed timeline data
  const { data: dossiers } = await sb
    .from("dossiers")
    .select("id, editor_verdict, subject_name, feature_id, connection_strength");

  // Fetch cross-reference count
  const { count: xrefCount } = await sb
    .from("cross_references")
    .select("id", { count: "exact", head: true });

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

  // Confirmed timeline — place each confirmed dossier on the year axis
  const confirmedTimeline = allDossiers
    .filter((d) => d.editor_verdict === "CONFIRMED")
    .map((d) => {
      const feature = allFeatures.find((f) => f.id === d.feature_id);
      const issue = feature
        ? allIssues.find((i) => i.id === feature.issue_id)
        : null;
      return {
        personName: d.subject_name ?? "Unknown",
        year: issue?.year ?? 0,
        month: issue?.month ?? null,
        connectionStrength: d.connection_strength ?? null,
        locationCity: feature?.location_city ?? null,
        locationState: feature?.location_state ?? null,
        locationCountry: feature?.location_country ?? null,
        category: feature?.subject_category ?? null,
      };
    })
    .filter((d) => d.year > 0)
    .sort((a, b) => a.year - b.year || (a.month ?? 6) - (b.month ?? 6));

  // Category breakdown — baseline vs Epstein orbit percentages
  const confirmedFeatureIds = new Set(
    allDossiers
      .filter((d) => d.editor_verdict === "CONFIRMED")
      .map((d) => d.feature_id)
      .filter(Boolean)
  );

  const CATEGORIES = ["Business", "Celebrity", "Designer", "Politician", "Private", "Royalty", "Socialite", "Other"];
  const baselineCatCounts = new Map<string, number>();
  const epsteinCatCounts = new Map<string, number>();
  let baselineTotal = 0;
  let epsteinTotal = 0;

  for (const f of allFeatures) {
    const cat = f.subject_category && CATEGORIES.includes(f.subject_category)
      ? f.subject_category
      : "Other";
    if (confirmedFeatureIds.has(f.id)) {
      epsteinCatCounts.set(cat, (epsteinCatCounts.get(cat) ?? 0) + 1);
      epsteinTotal++;
    } else {
      baselineCatCounts.set(cat, (baselineCatCounts.get(cat) ?? 0) + 1);
      baselineTotal++;
    }
  }

  const categoryBreakdown = CATEGORIES
    .map((cat) => ({
      category: cat,
      baselinePct: baselineTotal > 0
        ? Math.round(((baselineCatCounts.get(cat) ?? 0) / baselineTotal) * 100)
        : 0,
      epsteinPct: epsteinTotal > 0
        ? Math.round(((epsteinCatCounts.get(cat) ?? 0) / epsteinTotal) * 100)
        : 0,
    }))
    .filter((c) => c.baselinePct > 0 || c.epsteinPct > 0);

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
    confirmedTimeline,
    categoryBreakdown,
    crossReferences: {
      total: xrefCount ?? 0,
    },
    coverage,
  };
}, ["stats"], { revalidate: 300 });

// ── Features ───────────────────────────────────────────────

interface FeatureFilters {
  page?: number;
  pageSize?: number;
  year?: number;
  location?: string;
  designer?: string;
  style?: string;
  category?: string;
  search?: string;
  hasDossier?: boolean;
  confirmedOnly?: boolean;
}

export async function getFeatures(
  filters: FeatureFilters = {}
): Promise<PaginatedResponse<Feature & { issue_month: number | null; issue_year: number; dossier_id: number | null }>> {
  const sb = getSupabase();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Build query — join with issues for month/year, and dossiers for link
  let query = sb
    .from("features")
    .select("*, issues!inner(month, year), dossiers(id)", { count: "exact" });

  if (filters.year) {
    query = query.eq("issues.year", filters.year);
  }
  if (filters.style) {
    query = query.ilike("design_style", `%${filters.style}%`);
  }
  if (filters.designer) {
    query = query.ilike("designer_name", `%${filters.designer}%`);
  }
  if (filters.category) {
    query = query.ilike("subject_category", `%${filters.category}%`);
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
  if (filters.confirmedOnly) {
    // Get feature IDs with confirmed dossiers, then filter
    const { data: confirmed } = await sb
      .from("dossiers")
      .select("feature_id")
      .eq("editor_verdict", "CONFIRMED");
    const confirmedIds = (confirmed ?? [])
      .map((d: { feature_id: string | null }) => d.feature_id)
      .filter(Boolean) as string[];
    if (confirmedIds.length > 0) {
      query = query.in("id", confirmedIds);
    } else {
      // No confirmed connections — return empty
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }
  if (filters.hasDossier) {
    // Get feature IDs that have any dossier (regardless of verdict)
    const { data: withDossier } = await sb
      .from("dossiers")
      .select("feature_id");
    const dossierIds = (withDossier ?? [])
      .map((d: { feature_id: string | null }) => d.feature_id)
      .filter(Boolean) as string[];
    if (dossierIds.length > 0) {
      query = query.in("id", dossierIds);
    } else {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const features = (data ?? []).map((row: Record<string, unknown>) => {
    const { issues: issueData, dossiers: dossierData, ...feature } = row as Record<string, unknown> & {
      issues: { month: number | null; year: number };
      dossiers: { id: number } | null;
    };
    return {
      ...feature,
      issue_month: issueData?.month ?? null,
      issue_year: issueData?.year ?? 0,
      dossier_id: dossierData?.id ?? null,
    };
  });

  const total = count ?? 0;

  return {
    data: features as (Feature & { issue_month: number | null; issue_year: number; dossier_id: number | null })[],
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

// ── Aesthetic Radar ─────────────────────────────────────────

interface AestheticProfile {
  envelope?: string | null;
  atmosphere?: string | null;
  materiality?: string | null;
  power_status?: string | null;
  cultural_orientation?: string | null;
  art_collection?: string[] | null;
  named_artists?: string[] | null;
  source?: string;
}

export const getAestheticRadarData = unstable_cache(
  async (): Promise<AestheticRadarData> => {
    const sb = getSupabase();

    // Fetch all features that have aesthetic_profile
    const { data: features } = await sb
      .from("features")
      .select("id, aesthetic_profile")
      .not("aesthetic_profile", "is", null);

    // Fetch confirmed dossier feature IDs
    const { data: confirmedDossiers } = await sb
      .from("dossiers")
      .select("feature_id")
      .eq("editor_verdict", "CONFIRMED");

    const confirmedFeatureIds = new Set(
      (confirmedDossiers ?? [])
        .map((d: { feature_id: number | null }) => d.feature_id)
        .filter(Boolean)
    );

    // Split features into Epstein orbit vs baseline
    const allFeatures = features ?? [];
    const epstein: AestheticProfile[] = [];
    const baseline: AestheticProfile[] = [];

    for (const f of allFeatures) {
      let profile = f.aesthetic_profile as AestheticProfile | string | null;
      if (!profile) continue;
      if (typeof profile === "string") {
        try {
          profile = JSON.parse(profile) as AestheticProfile;
        } catch {
          continue;
        }
      }

      if (confirmedFeatureIds.has(f.id)) {
        epstein.push(profile);
      } else {
        baseline.push(profile);
      }
    }

    // Compute the 6 composite axes as percentages
    function pct(
      profiles: AestheticProfile[],
      test: (p: AestheticProfile) => boolean
    ): number {
      if (profiles.length === 0) return 0;
      const count = profiles.filter(test).length;
      return Math.round((count / profiles.length) * 100);
    }

    const axes = [
      {
        dimension: "Classical Grandeur",
        epstein: pct(epstein, (p) => {
          const classicalEnvelope =
            p.envelope === "Classical/Neoclassical" ||
            p.envelope === "Historic Revival";
          const formalAtmosphere = p.atmosphere === "Formal/Antiquarian";
          return classicalEnvelope && formalAtmosphere;
        }),
        baseline: pct(baseline, (p) => {
          const classicalEnvelope =
            p.envelope === "Classical/Neoclassical" ||
            p.envelope === "Historic Revival";
          const formalAtmosphere = p.atmosphere === "Formal/Antiquarian";
          return classicalEnvelope && formalAtmosphere;
        }),
      },
      {
        dimension: "Old Masters\n& Antiques",
        epstein: pct(epstein, (p) => {
          const arts = p.art_collection ?? [];
          return arts.some((a) =>
            ["Old Masters", "Impressionist/Post-Impressionist", "Decorative/Antique Objects"].includes(a)
          );
        }),
        baseline: pct(baseline, (p) => {
          const arts = p.art_collection ?? [];
          return arts.some((a) =>
            ["Old Masters", "Impressionist/Post-Impressionist", "Decorative/Antique Objects"].includes(a)
          );
        }),
      },
      {
        dimension: "Maximalism",
        epstein: pct(epstein, (p) =>
          ["Formal/Antiquarian", "Maximalist/Eclectic", "Glamour/Theatrical"].includes(
            p.atmosphere ?? ""
          )
        ),
        baseline: pct(baseline, (p) =>
          ["Formal/Antiquarian", "Maximalist/Eclectic", "Glamour/Theatrical"].includes(
            p.atmosphere ?? ""
          )
        ),
      },
      {
        dimension: "Euro-Centric",
        epstein: pct(
          epstein,
          (p) => p.cultural_orientation === "Euro-Centric/Old World"
        ),
        baseline: pct(
          baseline,
          (p) => p.cultural_orientation === "Euro-Centric/Old World"
        ),
      },
      {
        dimension: "Gallery &\nInstitutional",
        epstein: pct(epstein, (p) =>
          ["Institutional/Monumental", "Gallery/Curatorial"].includes(
            p.power_status ?? ""
          )
        ),
        baseline: pct(baseline, (p) =>
          ["Institutional/Monumental", "Gallery/Curatorial"].includes(
            p.power_status ?? ""
          )
        ),
      },
      {
        dimension: "Minimalism",
        epstein: pct(
          epstein,
          (p) => p.atmosphere === "Minimalist/Reductive"
        ),
        baseline: pct(
          baseline,
          (p) => p.atmosphere === "Minimalist/Reductive"
        ),
      },
    ];

    return {
      axes,
      epsteinCount: epstein.length,
      baselineCount: baseline.length,
    };
  },
  ["aesthetic-radar"],
  { revalidate: 300 }
);

// ── Dossier Detail ──────────────────────────────────────────

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

// ── Feature Report (all features) ──────────────────────────

export async function getFeatureReport(featureId: number): Promise<FeatureReport | null> {
  const sb = getSupabase();

  // Fetch feature
  const { data: feature } = await sb
    .from("features")
    .select("*")
    .eq("id", featureId)
    .single();

  if (!feature) return null;

  // Fetch issue
  let issue = null;
  if (feature.issue_id) {
    const { data: issueData } = await sb
      .from("issues")
      .select("*")
      .eq("id", feature.issue_id)
      .single();
    issue = issueData;
  }

  // Fetch article images from feature_images
  const { data: images } = await sb
    .from("feature_images")
    .select("id, feature_id, page_number, public_url, created_at")
    .eq("feature_id", featureId)
    .order("page_number");

  // Fetch optional dossier (may not exist)
  const { data: dossier } = await sb
    .from("dossiers")
    .select("*")
    .eq("feature_id", featureId)
    .maybeSingle();

  return {
    feature: feature as Feature,
    issue,
    images: (images ?? []) as FeatureImage[],
    dossier: dossier as Dossier | null,
  };
}
