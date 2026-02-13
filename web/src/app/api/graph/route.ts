import { NextRequest, NextResponse } from "next/server";
import {
  getEgoNetwork,
  getShortestPath,
  getSharedDesignerNetwork,
  getMostConnectedHubs,
  getEpsteinSubgraph,
  getFullGraph,
  getConfirmedNetwork,
  searchNodes,
} from "@/lib/graph-queries";

export const runtime = "nodejs";

// In-memory cache for graph queries (5 min TTL)
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const preset = searchParams.get("preset") ?? "full";

  try {
    switch (preset) {
      case "ego": {
        const name = searchParams.get("name");
        if (!name) {
          return NextResponse.json(
            { error: "Missing 'name' parameter for ego preset" },
            { status: 400 }
          );
        }
        const depth = Number(searchParams.get("depth") ?? "2");
        const data = await getEgoNetwork(name, depth);
        return NextResponse.json(data);
      }

      case "shortest": {
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        if (!from || !to) {
          return NextResponse.json(
            { error: "Missing 'from' and 'to' parameters for shortest preset" },
            { status: 400 }
          );
        }
        const data = await getShortestPath(from, to);
        return NextResponse.json(data);
      }

      case "shared-designers": {
        const data = await getSharedDesignerNetwork();
        return NextResponse.json(data);
      }

      case "hubs": {
        const limit = Number(searchParams.get("limit") ?? "20");
        const data = await getMostConnectedHubs(limit);
        return NextResponse.json(data);
      }

      case "epstein": {
        const data = await getEpsteinSubgraph();
        return NextResponse.json(data);
      }

      case "full": {
        const cached = getCached("full");
        if (cached) return NextResponse.json(cached);
        const data = await getFullGraph();
        setCache("full", data);
        return NextResponse.json(data);
      }

      case "confirmed": {
        const cached = getCached("confirmed");
        if (cached) return NextResponse.json(cached);
        const data = await getConfirmedNetwork();
        setCache("confirmed", data);
        return NextResponse.json(data);
      }

      case "search": {
        const q = searchParams.get("q");
        if (!q) {
          return NextResponse.json(
            { error: "Missing 'q' parameter for search preset" },
            { status: 400 }
          );
        }
        const results = await searchNodes(q);
        return NextResponse.json({ results });
      }

      default:
        return NextResponse.json(
          { error: `Unknown preset: ${preset}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Graph API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to query graph";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
