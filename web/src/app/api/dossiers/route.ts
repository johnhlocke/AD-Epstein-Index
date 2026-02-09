import { NextRequest, NextResponse } from "next/server";
import { getDossiers } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const verdict = request.nextUrl.searchParams.get("verdict") ?? undefined;
    const dossiers = await getDossiers(verdict);
    return NextResponse.json(dossiers);
  } catch (error) {
    console.error("Dossiers API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dossiers" },
      { status: 500 }
    );
  }
}
