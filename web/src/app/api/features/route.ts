import { NextRequest, NextResponse } from "next/server";
import { getFeatures } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const filters = {
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      pageSize: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
      year: searchParams.get("year") ? Number(searchParams.get("year")) : undefined,
      location: searchParams.get("location") ?? undefined,
      designer: searchParams.get("designer") ?? undefined,
      style: searchParams.get("style") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      confirmedOnly: searchParams.get("confirmed") === "true",
      hasDossier: searchParams.get("dossier") === "true" || undefined,
    };

    const result = await getFeatures(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Features API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 }
    );
  }
}
