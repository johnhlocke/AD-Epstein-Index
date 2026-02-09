"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Feature, PaginatedResponse } from "@/lib/types";

type FeatureRow = Feature & { issue_month: number | null; issue_year: number };

const MONTH_ABBR = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function SearchableIndex() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<PaginatedResponse<FeatureRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const year = searchParams.get("year") ?? "";
  const style = searchParams.get("style") ?? "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "15");
    if (search) params.set("search", search);
    if (year) params.set("year", year);
    if (style) params.set("style", style);

    try {
      const res = await fetch(`/api/features?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch {
      console.error("Failed to fetch features");
    } finally {
      setLoading(false);
    }
  }, [page, search, year, style]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        const params = new URLSearchParams(searchParams.toString());
        if (searchInput) {
          params.set("search", searchInput);
        } else {
          params.delete("search");
        }
        params.set("page", "1");
        router.push(`?${params.toString()}#index`, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, search, searchParams, router]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`?${params.toString()}#index`, { scroll: false });
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}#index`, { scroll: false });
  }

  return (
    <SectionContainer width="viz" className="py-20" id="index">
      <h2 className="font-serif text-3xl font-bold">Searchable Index</h2>
      <p className="mt-2 mb-6 text-muted-foreground">
        Browse all extracted features. Search by homeowner, designer, or article title.
      </p>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          placeholder="Search names, designers, titles..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Year"
          type="number"
          value={year}
          onChange={(e) => updateParam("year", e.target.value)}
          className="w-24"
        />
        <Input
          placeholder="Style"
          value={style}
          onChange={(e) => updateParam("style", e.target.value)}
          className="max-w-[200px]"
        />
        {(search || year || style) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              router.push("?#index", { scroll: false });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Results count */}
      {data && !loading && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing {data.data.length} of {data.total} results
          {data.totalPages > 1 && ` (page ${data.page} of ${data.totalPages})`}
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Homeowner</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Designer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Style</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length ? (
              data.data.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    {f.homeowner_name ?? (
                      <span className="text-muted-foreground italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {f.issue_month ? `${MONTH_ABBR[f.issue_month]} ` : ""}
                    {f.issue_year}
                  </TableCell>
                  <TableCell>{f.designer_name ?? "\u2014"}</TableCell>
                  <TableCell>
                    {[f.location_city, f.location_state].filter(Boolean).join(", ") || "\u2014"}
                  </TableCell>
                  <TableCell>
                    {f.design_style ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {f.design_style}
                      </Badge>
                    ) : (
                      "\u2014"
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No features found matching your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </SectionContainer>
  );
}
