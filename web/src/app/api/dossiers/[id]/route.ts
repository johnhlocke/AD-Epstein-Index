import { NextRequest, NextResponse } from "next/server";
import { getDossier } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dossierData = await getDossier(Number(id));

    if (!dossierData) {
      return NextResponse.json(
        { error: "Dossier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(dossierData);
  } catch (error) {
    console.error("Dossier detail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dossier" },
      { status: 500 }
    );
  }
}
