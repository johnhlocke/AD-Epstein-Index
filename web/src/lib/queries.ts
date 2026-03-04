import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getSupabase } from "./supabase";
import type {
  StatsResponse,
  Feature,
  Dossier,
  DossierWithContext,
  FeatureImage,
  FeatureReport,
  WealthProfile,
  FameMetrics,
  CrossReference,
  PaginatedResponse,
  AestheticRadarData,
  MosaicTile,
} from "./types";

// ── Stats ──────────────────────────────────────────────────

// Cache stats for 5 minutes server-side — avoids hitting Supabase on every page load
// while keeping force-dynamic on the page (no build-time generation)
export const getStats = unstable_cache(async (): Promise<StatsResponse> => {
  const sb = getSupabase();
  const PAGE = 1000;

  const featureFields = "id, issue_id, homeowner_name, design_style, location_city, location_state, location_country, year_built, subject_category";
  const dossierFields = "id, editor_verdict, subject_name, feature_id, connection_strength, combined_verdict";

  // ── Phase 1: Fire ALL independent count + lightweight queries in parallel ──
  const [
    { data: issues },
    { count: featuresCount },
    { count: dossiersCount },
    { count: xrefCount },
    { count: anonymousCount },
  ] = await Promise.all([
    sb.from("issues").select("id, status, month, year"),
    sb.from("features").select("id", { count: "exact", head: true }),
    sb.from("dossiers").select("id", { count: "exact", head: true }),
    sb.from("cross_references").select("id", { count: "exact", head: true }),
    sb.from("features").select("id", { count: "exact", head: true }).eq("homeowner_name", "Anonymous"),
  ]);

  // ── Phase 2: Fetch all feature + dossier rows in parallel batches ──
  const featureBatches = Array.from(
    { length: Math.ceil((featuresCount ?? 0) / PAGE) },
    (_, i) => sb.from("features").select(featureFields).range(i * PAGE, (i + 1) * PAGE - 1)
  );
  const dossierBatches = Array.from(
    { length: Math.ceil((dossiersCount ?? 0) / PAGE) },
    (_, i) => sb.from("dossiers").select(dossierFields).range(i * PAGE, (i + 1) * PAGE - 1)
  );

  const batchResults = await Promise.all([...featureBatches, ...dossierBatches]);

  const allFeatures: Record<string, unknown>[] = [];
  const allDossiers: Record<string, unknown>[] = [];
  const featureBatchCount = featureBatches.length;
  for (let i = 0; i < batchResults.length; i++) {
    const { data } = batchResults[i];
    if (!data) continue;
    if (i < featureBatchCount) allFeatures.push(...data);
    else allDossiers.push(...data);
  }

  const allIssues = issues ?? [];

  // Build issue lookup map (eliminates O(n²) .find() calls)
  const issueMap = new Map(allIssues.map((i) => [i.id, i]));

  // Issue counts
  const statusCounts: Record<string, number> = {};
  for (const i of allIssues) {
    const s = i.status ?? "discovered";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  // Features by year
  const yearMap = new Map<number, number>();
  for (const f of allFeatures) {
    const issue = issueMap.get(f.issue_id as number);
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

  // Build feature lookup map (eliminates O(n²) .find() calls)
  const featureMap = new Map(allFeatures.map((f) => [f.id, f]));

  // Confirmed timeline — place each confirmed dossier on the year axis
  const confirmedTimeline = allDossiers
    .filter((d) => d.editor_verdict === "CONFIRMED")
    .map((d) => {
      const feature = featureMap.get(d.feature_id as number) ?? null;
      const issue = feature
        ? issueMap.get(feature.issue_id as number) ?? null
        : null;
      return {
        dossierId: d.id as number,
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
        ? parseFloat(((baselineCatCounts.get(cat) ?? 0) / baselineTotal * 100).toFixed(1))
        : 0,
      epsteinPct: epsteinTotal > 0
        ? parseFloat(((epsteinCatCounts.get(cat) ?? 0) / epsteinTotal * 100).toFixed(1))
        : 0,
    }))
    .filter((c) => c.baselinePct > 0 || c.epsteinPct > 0);

  // Date range from issues (earliest and latest month/year)
  let earliestYear = Infinity, earliestMonth = 1;
  let latestYear = 0, latestMonth = 1;
  for (const i of allIssues) {
    const y = i.year as number;
    const m = (i.month as number) ?? 1;
    if (y < earliestYear || (y === earliestYear && m < earliestMonth)) {
      earliestYear = y; earliestMonth = m;
    }
    if (y > latestYear || (y === latestYear && m > latestMonth)) {
      latestYear = y; latestMonth = m;
    }
  }

  return {
    issues: {
      total: allIssues.length,
      extracted: statusCounts["extracted"] ?? 0,
      downloaded: statusCounts["downloaded"] ?? 0,
      discovered: statusCounts["discovered"] ?? 0,
      skipped: statusCounts["skipped_pre1988"] ?? 0,
      target: 456,
      dateRange: {
        earliestYear, earliestMonth,
        latestYear, latestMonth,
      },
    },
    features: {
      total: featuresCount ?? allFeatures.length,
      anonymous: anonymousCount ?? 0,
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

// Only fetch columns the table actually renders (not SELECT *)
const FEATURE_TABLE_COLS = "id, homeowner_name, designer_name, design_style, subject_category, location_city, location_state, issue_id";

type FeatureResult = Feature & { issue_month: number | null; issue_year: number; dossier_id: number | null; editor_verdict: string | null };

/** Apply shared text filters to a Supabase query builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTextFilters(q: any, filters: FeatureFilters) {
  if (filters.style) q = q.ilike("design_style", `%${filters.style}%`);
  if (filters.designer) q = q.ilike("designer_name", `%${filters.designer}%`);
  if (filters.category) q = q.ilike("subject_category", `%${filters.category}%`);
  if (filters.location) {
    q = q.or(
      `location_city.ilike.%${filters.location}%,location_state.ilike.%${filters.location}%,location_country.ilike.%${filters.location}%`
    );
  }
  if (filters.search) {
    q = q.or(
      `homeowner_name.ilike.%${filters.search}%,designer_name.ilike.%${filters.search}%,article_title.ilike.%${filters.search}%`
    );
  }
  return q;
}

export async function getFeatures(
  filters: FeatureFilters = {}
): Promise<PaginatedResponse<FeatureResult>> {
  const sb = getSupabase();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Determine dossier join type:
  // - confirmedOnly → !inner join filtered to CONFIRMED (eliminates pre-query)
  // - hasDossier → !inner join (any dossier exists)
  // - default → left join (dossier may not exist)
  const dossierJoin = filters.confirmedOnly
    ? "dossiers!inner(id, editor_verdict)"
    : filters.hasDossier
      ? "dossiers!inner(id, editor_verdict)"
      : "dossiers(id, editor_verdict)";

  const selectCols = `${FEATURE_TABLE_COLS}, issues!inner(month, year), ${dossierJoin}`;

  // Build query
  let query = sb.from("features").select(selectCols, { count: "exact" });

  // Apply dossier-level filters via the join
  if (filters.confirmedOnly) {
    query = query.eq("dossiers.editor_verdict", "CONFIRMED");
  }

  if (filters.year) {
    query = query.eq("issues.year", filters.year);
  }
  query = applyTextFilters(query, filters);

  // Sorting — map frontend column names to DB columns
  const sortMap: Record<string, string> = {
    homeowner: "homeowner_name",
    designer: "designer_name",
    category: "subject_category",
    location: "location_city",
  };
  const ascending = filters.order === "asc";

  // Year sort: PostgREST can't sort parent rows by joined columns.
  // Strategy: fetch all matching IDs with year/month in one query, sort in JS, paginate.
  if (filters.sort === "year") {
    let idQuery = sb
      .from("features")
      .select(`id, issues!inner(year, month), ${dossierJoin}`);

    if (filters.confirmedOnly) {
      idQuery = idQuery.eq("dossiers.editor_verdict", "CONFIRMED");
    }
    if (filters.year) idQuery = idQuery.eq("issues.year", filters.year);
    idQuery = applyTextFilters(idQuery, filters);

    // Fetch all matching IDs (paginate past PostgREST 1000-row cap)
    const allRows: Array<{ id: number; issues: { year: number; month: number | null } }> = [];
    let batchOffset = 0;
    const BATCH_SIZE = 1000;
    while (true) {
      const { data: batch } = await idQuery.range(batchOffset, batchOffset + BATCH_SIZE - 1);
      const typedBatch = (batch ?? []) as unknown as Array<{ id: number; issues: { year: number; month: number | null } }>;
      allRows.push(...typedBatch);
      if (typedBatch.length < BATCH_SIZE) break;
      batchOffset += BATCH_SIZE;
    }

    // Sort in JS by year, then month
    allRows.sort((a, b) => {
      const yearDiff = (a.issues.year ?? 0) - (b.issues.year ?? 0);
      if (yearDiff !== 0) return ascending ? yearDiff : -yearDiff;
      const monthDiff = (a.issues.month ?? 0) - (b.issues.month ?? 0);
      return ascending ? monthDiff : -monthDiff;
    });

    const total = allRows.length;
    const pageIds = allRows.slice(offset, offset + pageSize).map((r) => r.id);

    if (pageIds.length === 0) {
      return { data: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    // Fetch full data for just this page
    const { data: pageData } = await sb
      .from("features")
      .select(`${FEATURE_TABLE_COLS}, issues!inner(month, year), ${dossierJoin}`)
      .in("id", pageIds);

    // Re-sort to match our sorted order
    const idOrder = new Map(pageIds.map((id, i) => [id, i]));
    const sorted = (pageData ?? []).sort((a, b) =>
      (idOrder.get((a as { id: number }).id) ?? 0) - (idOrder.get((b as { id: number }).id) ?? 0)
    );

    return {
      data: mapFeatureRows(sorted),
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

  const total = count ?? 0;

  return {
    data: mapFeatureRows(data ?? []),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Map raw Supabase rows to the flat shape the frontend expects. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeatureRows(rows: any[]): FeatureResult[] {
  return rows.map((row) => {
    const { issues: issueData, dossiers: dossierData, ...feature } = row as Record<string, unknown> & {
      issues: { month: number | null; year: number };
      dossiers: { id: number; editor_verdict: string | null } | { id: number; editor_verdict: string | null }[] | null;
    };
    // dossiers can be object (1:1 unique FK) or array (1:many) depending on join type
    const dossier = Array.isArray(dossierData) ? dossierData[0] ?? null : dossierData;
    return {
      ...feature,
      issue_month: issueData?.month ?? null,
      issue_year: issueData?.year ?? 0,
      dossier_id: dossier?.id ?? null,
      editor_verdict: dossier?.editor_verdict ?? null,
    };
  }) as FeatureResult[];
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

    // Fetch features with aesthetic_profile AND confirmed dossiers in parallel
    const [{ data: features }, { data: confirmedDossiers }] = await Promise.all([
      sb.from("features").select("id, aesthetic_profile").not("aesthetic_profile", "is", null),
      sb.from("dossiers").select("feature_id").eq("editor_verdict", "CONFIRMED"),
    ]);

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

// React.cache deduplicates within a single request — generateMetadata + page
// component both call this, but only one Supabase round-trip set actually fires.
export const getDossier = cache(async function getDossier(id: number): Promise<DossierWithContext | null> {
  const sb = getSupabase();

  const { data: dossier } = await sb
    .from("dossiers")
    .select("*")
    .eq("id", id)
    .single();

  if (!dossier) return null;

  const fid = dossier.feature_id;
  const wealthCols = "forbes_score, forbes_confidence, classification, wealth_source, background, trajectory, rationale, education, museum_boards, elite_boards, generational_wealth, cultural_capital_notes, social_capital_notes, bio_summary, profession_category";
  const fameCols = "fame_score, wikipedia_page, wikipedia_edit_count, wikipedia_pageviews, nyt_article_count";

  // Fetch feature + everything that depends only on feature_id in parallel
  const [featureResult, imagesResult, wpResult, fmResult, xrefResult] = await Promise.all([
    sb.from("features").select("*").eq("id", fid).single(),
    sb.from("feature_images").select("id, feature_id, page_number, public_url, created_at").eq("feature_id", fid).order("page_number"),
    sb.from("wealth_profiles").select(wealthCols).eq("feature_id", fid).maybeSingle(),
    sb.from("fame_metrics").select(fameCols).eq("feature_id", fid).maybeSingle(),
    sb.from("cross_references").select("black_book_status, doj_status, doj_results, combined_verdict, confidence_score, verdict_rationale").eq("feature_id", fid).maybeSingle(),
  ]);

  const feature = featureResult.data;

  // Issue depends on feature.issue_id — but can run in parallel with name fallbacks
  let wealth = wpResult.data as WealthProfile | null;
  let fame = fmResult.data as FameMetrics | null;
  const needsNameFallback = (!wealth || !fame) && dossier.subject_name;
  const needsIssue = feature?.issue_id;

  const [issueResult, wpFallback, fmFallback] = await Promise.all([
    needsIssue ? sb.from("issues").select("*").eq("id", feature!.issue_id).single() : Promise.resolve({ data: null }),
    needsNameFallback && !wealth ? sb.from("wealth_profiles").select(wealthCols).eq("homeowner_name", dossier.subject_name).maybeSingle() : Promise.resolve({ data: null }),
    needsNameFallback && !fame ? sb.from("fame_metrics").select(fameCols).eq("homeowner_name", dossier.subject_name).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  if (!wealth) wealth = wpFallback.data as WealthProfile | null;
  if (!fame) fame = fmFallback.data as FameMetrics | null;

  return {
    ...dossier,
    feature,
    issue: issueResult.data,
    images: (imagesResult.data ?? []) as FeatureImage[],
    wealth,
    fame,
    crossRef: xrefResult.data as CrossReference | null,
  } as DossierWithContext;
});

// ── Feature Report (all features) ──────────────────────────

export const getFeatureReport = cache(async function getFeatureReport(featureId: number): Promise<FeatureReport | null> {
  const sb = getSupabase();

  // Step 1: fetch feature (needed for issue_id and homeowner_name)
  const { data: feature } = await sb
    .from("features")
    .select("*")
    .eq("id", featureId)
    .single();

  if (!feature) return null;

  // Step 2: everything else in parallel — no query depends on another
  const wealthCols = "forbes_score, forbes_confidence, classification, wealth_source, background, trajectory, rationale, education, museum_boards, elite_boards, generational_wealth, cultural_capital_notes, social_capital_notes, bio_summary, profession_category";
  const fameCols = "fame_score, wikipedia_page, wikipedia_edit_count, wikipedia_pageviews, nyt_article_count";

  const [issueResult, imagesResult, dossierResult, wpResult, fmResult, xrefResult] = await Promise.all([
    feature.issue_id
      ? sb.from("issues").select("*").eq("id", feature.issue_id).single()
      : Promise.resolve({ data: null }),
    sb.from("feature_images").select("id, feature_id, page_number, public_url, created_at").eq("feature_id", featureId).order("page_number"),
    sb.from("dossiers").select("*").eq("feature_id", featureId).maybeSingle(),
    sb.from("wealth_profiles").select(wealthCols).eq("feature_id", featureId).maybeSingle(),
    sb.from("fame_metrics").select(fameCols).eq("feature_id", featureId).maybeSingle(),
    sb.from("cross_references").select("black_book_status, doj_status, doj_results, combined_verdict, confidence_score, verdict_rationale").eq("feature_id", featureId).maybeSingle(),
  ]);

  // Fallback lookups by name for multi-home people (only if feature_id lookup missed)
  let wealth = wpResult.data as WealthProfile | null;
  let fame = fmResult.data as FameMetrics | null;
  if ((!wealth || !fame) && feature.homeowner_name) {
    const [wpFallback, fmFallback] = await Promise.all([
      !wealth ? sb.from("wealth_profiles").select(wealthCols).eq("homeowner_name", feature.homeowner_name).maybeSingle() : Promise.resolve({ data: null }),
      !fame ? sb.from("fame_metrics").select(fameCols).eq("homeowner_name", feature.homeowner_name).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!wealth) wealth = wpFallback.data as WealthProfile | null;
    if (!fame) fame = fmFallback.data as FameMetrics | null;
  }

  return {
    feature: feature as Feature,
    issue: issueResult.data,
    images: (imagesResult.data ?? []) as FeatureImage[],
    dossier: dossierResult.data as Dossier | null,
    wealth,
    fame,
    crossRef: xrefResult.data as CrossReference | null,
  };
});

// ── Category Breakdown Data (Fig. 2 source) ────────────────

export interface CategoryConfirmedRow {
  name: string;
  category: string;
  connectionStrength: string | null;
  featureId: number;
}

export interface CategorySummaryRow {
  category: string;
  epsteinCount: number;
  epsteinPct: number;
  baselineCount: number;
  baselinePct: number;
  multiplier: number;
}

export async function getCategoryBreakdownData(): Promise<{
  confirmedNames: CategoryConfirmedRow[];
  categorySummary: CategorySummaryRow[];
}> {
  const sb = getSupabase();

  // Fetch confirmed dossiers
  const { data: dossiers } = await sb
    .from("dossiers")
    .select("feature_id, subject_name, connection_strength")
    .eq("editor_verdict", "CONFIRMED");

  const confirmedDossiers = dossiers ?? [];
  const confirmedFeatureIds = new Set(
    confirmedDossiers.map((d) => d.feature_id).filter(Boolean)
  );

  // Fetch all features with subject_category — paginate past 1000-row limit
  const { count: featuresCount } = await sb
    .from("features")
    .select("id", { count: "exact", head: true });
  const allFeatures: { id: number; subject_category: string | null }[] = [];
  const PAGE = 1000;
  for (let offset = 0; offset < (featuresCount ?? 0); offset += PAGE) {
    const { data } = await sb
      .from("features")
      .select("id, subject_category")
      .range(offset, offset + PAGE - 1);
    if (data) allFeatures.push(...(data as { id: number; subject_category: string | null }[]));
  }

  // Build feature → category map
  const featureCategoryMap = new Map<number, string>();
  for (const f of allFeatures) {
    featureCategoryMap.set(f.id, f.subject_category ?? "Other");
  }

  // Build confirmed names list
  const confirmedNames: CategoryConfirmedRow[] = confirmedDossiers
    .filter((d) => d.feature_id)
    .map((d) => ({
      name: (d.subject_name as string) ?? "Unknown",
      category: featureCategoryMap.get(d.feature_id as number) ?? "Other",
      connectionStrength: (d.connection_strength as string) ?? null,
      featureId: d.feature_id as number,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  // Build category summary
  const CATEGORIES = ["Business", "Celebrity", "Design", "Art", "Media", "Politician", "Private", "Royalty", "Socialite", "Other"];
  const epsteinCounts = new Map<string, number>();
  const baselineCounts = new Map<string, number>();
  let epsteinTotal = 0;
  let baselineTotal = 0;

  for (const f of allFeatures) {
    const cat = f.subject_category && CATEGORIES.includes(f.subject_category) ? f.subject_category : "Other";
    if (confirmedFeatureIds.has(f.id)) {
      epsteinCounts.set(cat, (epsteinCounts.get(cat) ?? 0) + 1);
      epsteinTotal++;
    } else {
      baselineCounts.set(cat, (baselineCounts.get(cat) ?? 0) + 1);
      baselineTotal++;
    }
  }

  const categorySummary: CategorySummaryRow[] = CATEGORIES
    .map((cat) => {
      const ec = epsteinCounts.get(cat) ?? 0;
      const bc = baselineCounts.get(cat) ?? 0;
      const ePct = epsteinTotal > 0 ? parseFloat(((ec / epsteinTotal) * 100).toFixed(1)) : 0;
      const bPct = baselineTotal > 0 ? parseFloat(((bc / baselineTotal) * 100).toFixed(1)) : 0;
      return {
        category: cat,
        epsteinCount: ec,
        epsteinPct: ePct,
        baselineCount: bc,
        baselinePct: bPct,
        multiplier: bPct > 0 ? parseFloat((ePct / bPct).toFixed(2)) : 0,
      };
    })
    .filter((c) => c.epsteinCount > 0 || c.baselineCount > 0);

  return { confirmedNames, categorySummary };
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
 * Build Supabase Storage URL for a feature's mosaic thumbnail.
 * Thumbnails are 123x164 JPEG Q60, hosted in the mosaic-thumbnails bucket.
 */
function buildThumbnailUrl(featureId: number): string {
  const base = process.env.SUPABASE_URL;
  return `${base}/storage/v1/object/public/mosaic-thumbnails/${featureId}.jpg`;
}

export const getHeroMosaicData = unstable_cache(
  async (): Promise<MosaicTile[]> => {
    const sb = getSupabase();

    // Fetch features + confirmed dossiers in parallel (no issue join needed — thumbnails keyed by feature ID)
    const [{ data: features }, { data: confirmedDossiers }] = await Promise.all([
      sb
        .from("features")
        .select("id, page_number")
        .not("page_number", "is", null)
        .range(0, 4999),
      sb
        .from("dossiers")
        .select("feature_id, connection_strength")
        .eq("editor_verdict", "CONFIRMED"),
    ]);

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
      if (!f.page_number) continue;

      const url = buildThumbnailUrl(f.id);
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
  ["hero-mosaic-v3"],
  { revalidate: 3600 }
);
