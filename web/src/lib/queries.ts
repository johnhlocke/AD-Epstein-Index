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
  MosaicTile,
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

  // Fetch all features — paginate to bypass Supabase 1000-row default limit
  const featureFields = "id, issue_id, homeowner_name, design_style, location_city, location_state, location_country, year_built, subject_category";
  const { count: featuresCount } = await sb
    .from("features")
    .select("id", { count: "exact", head: true });
  const allFeatures: Record<string, unknown>[] = [];
  const PAGE = 1000;
  for (let offset = 0; offset < (featuresCount ?? 0); offset += PAGE) {
    const { data } = await sb
      .from("features")
      .select(featureFields)
      .range(offset, offset + PAGE - 1);
    if (data) allFeatures.push(...data);
  }

  // Fetch all dossiers — paginate to bypass 1000-row limit
  const dossierFields = "id, editor_verdict, subject_name, feature_id, connection_strength, combined_verdict";
  const { count: dossiersCount } = await sb
    .from("dossiers")
    .select("id", { count: "exact", head: true });
  const allDossiers: Record<string, unknown>[] = [];
  for (let offset = 0; offset < (dossiersCount ?? 0); offset += PAGE) {
    const { data } = await sb
      .from("dossiers")
      .select(dossierFields)
      .range(offset, offset + PAGE - 1);
    if (data) allDossiers.push(...data);
  }

  // Fetch cross-reference count
  const { count: xrefCount } = await sb
    .from("cross_references")
    .select("id", { count: "exact", head: true });

  const allIssues = issues ?? [];

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
    const style = f.design_style as string | null;
    if (style) styleMap.set(style, (styleMap.get(style) ?? 0) + 1);
  }
  const topStyles = Array.from(styleMap.entries())
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Top locations
  const locMap = new Map<string, number>();
  for (const f of allFeatures) {
    const parts = [f.location_city as string | null, f.location_state as string | null, f.location_country as string | null].filter(Boolean);
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

  // Detective tier breakdown (combined_verdict → editor_verdict counts)
  const tierToConfirmed: Record<string, number> = {};
  const tierToRejected: Record<string, number> = {};
  const strengthCounts: Record<string, number> = {};
  for (const d of allDossiers) {
    const tier = (d.combined_verdict as string) ?? "unknown";
    const ev = d.editor_verdict as string;
    if (ev === "CONFIRMED") {
      tierToConfirmed[tier] = (tierToConfirmed[tier] ?? 0) + 1;
      const cs = (d.connection_strength as string) ?? "unknown";
      strengthCounts[cs] = (strengthCounts[cs] ?? 0) + 1;
    } else if (ev === "REJECTED") {
      tierToRejected[tier] = (tierToRejected[tier] ?? 0) + 1;
    }
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
        personName: (d.subject_name as string) ?? "Unknown",
        year: issue?.year ?? 0,
        month: issue?.month ?? null,
        connectionStrength: (d.connection_strength as string) ?? null,
        locationCity: (feature?.location_city as string) ?? null,
        locationState: (feature?.location_state as string) ?? null,
        locationCountry: (feature?.location_country as string) ?? null,
        category: (feature?.subject_category as string) ?? null,
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

  const CATEGORIES = ["Business", "Celebrity", "Design", "Art", "Media", "Politician", "Private", "Royalty", "Socialite", "Other"];
  const baselineCatCounts = new Map<string, number>();
  const epsteinCatCounts = new Map<string, number>();
  let baselineTotal = 0;
  let epsteinTotal = 0;

  for (const f of allFeatures) {
    const sc = f.subject_category as string | null;
    const cat = sc && CATEGORIES.includes(sc) ? sc : "Other";
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
      total: featuresCount ?? allFeatures.length,
      withHomeowner: allFeatures.filter((f) => f.homeowner_name).length,
      uniqueHomeowners: new Set(allFeatures.map((f) => f.homeowner_name).filter(Boolean)).size,
      byYear,
      topStyles,
      topLocations,
    },
    dossiers: {
      total: allDossiers.length,
      confirmed,
      rejected,
      pending,
      tierToConfirmed,
      tierToRejected,
      strengthCounts,
    },
    confirmedTimeline,
    categoryBreakdown,
    crossReferences: {
      total: xrefCount ?? 0,
    },
    coverage,
  };
}, ["stats-v2"], { revalidate: 300 });

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
  sort?: string;
  order?: "asc" | "desc";
}

export async function getFeatures(
  filters: FeatureFilters = {}
): Promise<PaginatedResponse<Feature & { issue_month: number | null; issue_year: number; dossier_id: number | null; editor_verdict: string | null }>> {
  const sb = getSupabase();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Build query — join with issues for month/year, and dossiers for link
  let query = sb
    .from("features")
    .select("*, issues!inner(month, year), dossiers(id, editor_verdict)", { count: "exact" });

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
  // Hoist filter ID lists so they're available for both main query and year-sort idQuery
  let confirmedIds: string[] | undefined;
  let dossierIds: string[] | undefined;

  if (filters.confirmedOnly) {
    const { data: confirmed } = await sb
      .from("dossiers")
      .select("feature_id")
      .eq("editor_verdict", "CONFIRMED");
    confirmedIds = (confirmed ?? [])
      .map((d: { feature_id: string | null }) => d.feature_id)
      .filter(Boolean) as string[];
    if (confirmedIds.length > 0) {
      query = query.in("id", confirmedIds);
    } else {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }
  if (filters.hasDossier) {
    const { data: withDossier } = await sb
      .from("dossiers")
      .select("feature_id");
    dossierIds = (withDossier ?? [])
      .map((d: { feature_id: string | null }) => d.feature_id)
      .filter(Boolean) as string[];
    if (dossierIds.length > 0) {
      query = query.in("id", dossierIds);
    } else {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  // Sorting — map frontend column names to DB columns
  const sortMap: Record<string, string> = {
    homeowner: "homeowner_name",
    designer: "designer_name",
    category: "subject_category",
    location: "location_city",
  };
  const ascending = filters.order === "asc";

  // Year sort requires a two-step approach: PostgREST can't sort parent rows
  // by joined table columns, so we fetch sorted issue IDs first, then paginate.
  if (filters.sort === "year") {
    // Step 1: Get total count (query already has .select with count: "exact")
    const { count: totalCount } = await query.limit(0);

    // Step 2: Fetch ALL matching feature IDs with issue year/month (lightweight)
    // PostgREST caps at 1000 rows per request, so we paginate in batches.
    let idQuery = sb
      .from("features")
      .select("id, issue_id, issues!inner(year, month)");

    // Re-apply ALL filters to the ID query
    if (filters.year) idQuery = idQuery.eq("issues.year", filters.year);
    if (filters.style) idQuery = idQuery.ilike("design_style", `%${filters.style}%`);
    if (filters.designer) idQuery = idQuery.ilike("designer_name", `%${filters.designer}%`);
    if (filters.category) idQuery = idQuery.ilike("subject_category", `%${filters.category}%`);
    if (filters.location) {
      idQuery = idQuery.or(
        `location_city.ilike.%${filters.location}%,location_state.ilike.%${filters.location}%,location_country.ilike.%${filters.location}%`
      );
    }
    if (filters.search) {
      idQuery = idQuery.or(
        `homeowner_name.ilike.%${filters.search}%,designer_name.ilike.%${filters.search}%,article_title.ilike.%${filters.search}%`
      );
    }
    if (filters.confirmedOnly && confirmedIds) {
      idQuery = idQuery.in("id", confirmedIds);
    }
    if (filters.hasDossier && dossierIds) {
      idQuery = idQuery.in("id", dossierIds);
    }

    // Paginate through all results (PostgREST caps at 1000 per request)
    const allRows: Array<{ id: number; issue_id: number; issues: { year: number; month: number | null } }> = [];
    let batchOffset = 0;
    const BATCH_SIZE = 1000;
    while (true) {
      const { data: batch } = await idQuery.range(batchOffset, batchOffset + BATCH_SIZE - 1);
      const typedBatch = (batch ?? []) as unknown as Array<{ id: number; issue_id: number; issues: { year: number; month: number | null } }>;
      allRows.push(...typedBatch);
      if (typedBatch.length < BATCH_SIZE) break;
      batchOffset += BATCH_SIZE;
    }
    const rows = allRows;

    // Sort in JS by year, then month
    rows.sort((a, b) => {
      const yearDiff = (a.issues.year ?? 0) - (b.issues.year ?? 0);
      if (yearDiff !== 0) return ascending ? yearDiff : -yearDiff;
      const monthDiff = (a.issues.month ?? 0) - (b.issues.month ?? 0);
      return ascending ? monthDiff : -monthDiff;
    });

    // Paginate the sorted IDs
    const pageIds = rows.slice(offset, offset + pageSize).map((r) => r.id);

    if (pageIds.length === 0) {
      return { data: [], total: totalCount ?? 0, page, pageSize, totalPages: Math.ceil((totalCount ?? 0) / pageSize) };
    }

    // Step 3: Fetch full feature data for just this page
    const { data: pageData } = await sb
      .from("features")
      .select("*, issues!inner(month, year), dossiers(id)")
      .in("id", pageIds);

    // Re-sort to match our sorted order
    const idOrder = new Map(pageIds.map((id, i) => [id, i]));
    const sorted = (pageData ?? []).sort((a, b) =>
      (idOrder.get((a as { id: number }).id) ?? 0) - (idOrder.get((b as { id: number }).id) ?? 0)
    );

    const features = sorted.map((row: Record<string, unknown>) => {
      const { issues: issueData, dossiers: dossierData, ...feature } = row as Record<string, unknown> & {
        issues: { month: number | null; year: number };
        dossiers: { id: number; editor_verdict: string | null } | null;
      };
      return {
        ...feature,
        issue_month: issueData?.month ?? null,
        issue_year: issueData?.year ?? 0,
        dossier_id: dossierData?.id ?? null,
        editor_verdict: dossierData?.editor_verdict ?? null,
      };
    });

    const total = totalCount ?? rows.length;

    return {
      data: features as (Feature & { issue_month: number | null; issue_year: number; dossier_id: number | null; editor_verdict: string | null })[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Non-year sorting — straightforward DB sort
  const sortCol = sortMap[filters.sort ?? ""] ?? "created_at";
  query = query.order(sortCol, { ascending: filters.sort ? ascending : false });

  const { data, count } = await query
    .range(offset, offset + pageSize - 1);

  const features = (data ?? []).map((row: Record<string, unknown>) => {
    const { issues: issueData, dossiers: dossierData, ...feature } = row as Record<string, unknown> & {
      issues: { month: number | null; year: number };
      dossiers: { id: number; editor_verdict: string | null } | null;
    };
    return {
      ...feature,
      issue_month: issueData?.month ?? null,
      issue_year: issueData?.year ?? 0,
      dossier_id: dossierData?.id ?? null,
      editor_verdict: dossierData?.editor_verdict ?? null,
    };
  });

  const total = count ?? 0;

  return {
    data: features as (Feature & { issue_month: number | null; issue_year: number; dossier_id: number | null; editor_verdict: string | null })[],
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

// ── Hero Mosaic ──────────────────────────────────────────────

const MOSAIC_TILE_COUNT = 192;

/**
 * Full Fisher-Yates shuffle, then one pass to separate any adjacent confirmed tiles.
 * Avoids interval-based placement which creates diagonal patterns in a grid.
 */
function distributedShuffle(tiles: MosaicTile[]): MosaicTile[] {
  const arr = [...tiles];

  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // De-cluster pass: if two confirmed tiles are adjacent, swap the second
  // with the next unconfirmed tile at least 5 positions away
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].confirmed && arr[i - 1].confirmed) {
      for (let swap = i + 5; swap < arr.length; swap++) {
        if (!arr[swap].confirmed) {
          [arr[i], arr[swap]] = [arr[swap], arr[i]];
          break;
        }
      }
    }
  }

  return arr;
}

/**
 * Build Azure Blob thumbnail URL for a feature's page image.
 * Pattern: architecturaldigest{YYYYMMDD}thumbnails/Pages/0x600/{page}.jpg
 */
function buildAzureUrl(year: number, month: number | null, page: number): string {
  const mm = String(month ?? 1).padStart(2, "0");
  const dd = "01";
  return `https://architecturaldigest.blob.core.windows.net/architecturaldigest${year}${mm}${dd}thumbnails/Pages/0x600/${page}.jpg`;
}

export const getHeroMosaicData = unstable_cache(
  async (): Promise<MosaicTile[]> => {
    const sb = getSupabase();

    // Fetch features that have page_number + joined issue date
    const { data: features } = await sb
      .from("features")
      .select("id, page_number, issue_id, issues!inner(year, month)")
      .not("page_number", "is", null)
      .range(0, 4999);

    // Fetch confirmed dossiers with connection_strength
    const { data: confirmedDossiers } = await sb
      .from("dossiers")
      .select("feature_id, connection_strength")
      .eq("editor_verdict", "CONFIRMED");

    const confirmedMap = new Map<number, string | null>();
    for (const d of confirmedDossiers ?? []) {
      if (d.feature_id) {
        confirmedMap.set(
          d.feature_id as number,
          d.connection_strength as string | null
        );
      }
    }

    // Build tile objects
    const allTiles: MosaicTile[] = [];
    for (const f of features ?? []) {
      const issue = (f as Record<string, unknown>).issues as {
        year: number;
        month: number | null;
      };
      if (!issue?.year || !f.page_number) continue;

      const url = buildAzureUrl(issue.year, issue.month, f.page_number);
      const isConfirmed = confirmedMap.has(f.id);
      allTiles.push({
        id: f.id,
        url,
        confirmed: isConfirmed,
        strength: isConfirmed
          ? (confirmedMap.get(f.id) as MosaicTile["strength"])
          : null,
      });
    }

    // Distribute and sample
    const shuffled = distributedShuffle(allTiles);
    return shuffled.slice(0, MOSAIC_TILE_COUNT);
  },
  ["hero-mosaic-v2"],
  { revalidate: 3600 }
);
