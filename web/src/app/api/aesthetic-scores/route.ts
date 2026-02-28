import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sb = getSupabase();

    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const pageSize = searchParams.get("limit") ? Number(searchParams.get("limit")) : 10;
    const offset = (page - 1) * pageSize;

    const homeowner = searchParams.get("homeowner") ?? undefined;
    const designer = searchParams.get("designer") ?? undefined;
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
    const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const headline = searchParams.get("headline") ?? undefined;

    // Build query — only aesthetic-relevant fields, no dossier/verdict data
    let query = sb
      .from("features")
      .select(
        `id, article_title, homeowner_name, designer_name, location_city,
         location_state, location_country, design_style, page_number,
         score_grandeur, score_material_warmth, score_maximalism,
         score_historicism, score_provenance, score_hospitality,
         score_formality, score_curation, score_theatricality,
         scoring_version, scoring_rationale, aesthetic_profile,
         issues!inner(month, year)`,
        { count: "exact" }
      );

    // Require at least one scored axis to exist
    query = query.not("score_grandeur", "is", null);

    if (homeowner) {
      query = query.ilike("homeowner_name", `%${homeowner}%`);
    }
    if (designer) {
      query = query.ilike("designer_name", `%${designer}%`);
    }
    if (month) {
      query = query.eq("issues.month", month);
    }
    if (year) {
      query = query.eq("issues.year", year);
    }
    if (headline) {
      query = query.ilike("article_title", `%${headline}%`);
    }

    query = query
      .order("homeowner_name", { ascending: true, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    const { data: features, count, error } = await query;
    if (error) throw error;

    const total = count ?? 0;

    // Batch-fetch images for all returned feature IDs
    const featureIds = (features ?? []).map((f: { id: number }) => f.id);
    let images: { feature_id: number; page_number: number; public_url: string }[] = [];
    if (featureIds.length > 0) {
      const { data: imgData } = await sb
        .from("feature_images")
        .select("feature_id, page_number, public_url")
        .in("feature_id", featureIds)
        .order("page_number", { ascending: true });
      images = (imgData ?? []) as typeof images;
    }

    // Group images by feature_id
    const imagesByFeature: Record<number, typeof images> = {};
    for (const img of images) {
      if (!imagesByFeature[img.feature_id]) imagesByFeature[img.feature_id] = [];
      imagesByFeature[img.feature_id].push(img);
    }

    // Merge images into features
    const results = (features ?? []).map((f: Record<string, unknown>) => ({
      ...f,
      images: imagesByFeature[(f as { id: number }).id] ?? [],
    }));

    return NextResponse.json({
      data: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Aesthetic scores API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch aesthetic scores" },
      { status: 500 }
    );
  }
}
