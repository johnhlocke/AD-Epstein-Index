import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/methodology-data
 *
 * Serves the raw structured data behind the methodology visualizations
 * (SOM component planes, PCA, baseline statistics) so anyone can
 * download and recreate the charts independently.
 *
 * Query params:
 *   ?dataset=som        — SOM grid data (component planes, u-matrix, clusters, hit map, decade maps)
 *   ?dataset=pca        — PCA results (correlation matrix, eigenvalues, loadings)
 *   ?dataset=baseline   — Baseline axis statistics (means, distributions, Cronbach's alpha)
 *   ?dataset=all        — Everything bundled together (default)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get("dataset") || "all";

  try {
    const result: Record<string, unknown> = {};

    if (dataset === "som" || dataset === "all") {
      // SOM data is bundled in the web source (it's the same file the charts read)
      const somPath = join(
        process.cwd(),
        "src/components/landing/som-data.json"
      );
      result.som = JSON.parse(readFileSync(somPath, "utf-8"));
    }

    if (dataset === "pca" || dataset === "all") {
      const pcaPath = join(process.cwd(), "..", "data", "pca_results.json");
      result.pca = JSON.parse(readFileSync(pcaPath, "utf-8"));
    }

    if (dataset === "baseline" || dataset === "all") {
      const basePath = join(
        process.cwd(),
        "..",
        "data",
        "baseline_analysis.json"
      );
      result.baseline = JSON.parse(readFileSync(basePath, "utf-8"));
    }

    if (Object.keys(result).length === 0) {
      return NextResponse.json(
        {
          error: `Unknown dataset "${dataset}". Use: som, pca, baseline, or all.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      _meta: {
        description:
          "Raw data behind the AD-Epstein Index methodology visualizations. Use this to independently verify or recreate any chart on the site.",
        datasets: Object.keys(result),
        project: "https://www.wheretheylive.world",
        axes: [
          "Grandeur",
          "Material Warmth",
          "Maximalism",
          "Historicism",
          "Provenance",
          "Hospitality",
          "Formality",
          "Curation",
          "Theatricality",
        ],
        groups: { SPACE: [0, 1, 2], STORY: [3, 4, 5], STAGE: [6, 7, 8] },
        n_features: 3763,
      },
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load methodology data", detail: message },
      { status: 500 }
    );
  }
}
