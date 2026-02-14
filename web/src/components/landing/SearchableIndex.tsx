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
  const location = searchParams.get("location") ?? "";
  const dossierOnly = searchParams.get("dossier") === "true";
  const confirmedOnly = searchParams.get("confirmed") !== "false";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "8");
    if (search) params.set("search", search);
    if (year) params.set("year", year);
    if (style) params.set("style", style);
    if (location) params.set("location", location);
    if (dossierOnly) params.set("dossier", "true");
    if (confirmedOnly) params.set("confirmed", "true");

    try {
      const res = await fetch(`/api/features?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch {
      console.error("Failed to fetch features");
    } finally {
      setLoading(false);
    }
  }, [page, search, year, style, location, dossierOnly, confirmedOnly]);

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
    <SectionContainer width="wide" className="pt-0 pb-20" id="index">
      {/* Subhead */}
      <p className="mb-6 max-w-[620px] font-serif text-[15px] italic leading-[1.75] text-foreground/45">
        Browse all cataloged homes below. Filter by name, year, style, or
        location. Confirmed connections are highlighted by default.
      </p>

      {/* Filters — snapped to 6-column design grid */}
      <div className="mb-6 grid grid-cols-6 gap-x-6 gap-y-3">
        {/* Row 1: inputs */}
        <Input
          placeholder="Search names, designers, titles..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="col-span-2"
        />
        <Input
          placeholder="Year"
          type="number"
          value={year}
          onChange={(e) => updateParam("year", e.target.value)}
        />
        <Input
          placeholder="Style"
          value={style}
          onChange={(e) => updateParam("style", e.target.value)}
        />
        <Input
          placeholder="Location"
          value={location}
          onChange={(e) => updateParam("location", e.target.value)}
        />
        <div className="flex items-center justify-end">
          {(search || year || style || location || dossierOnly || !confirmedOnly) && (
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
        {/* Row 2: checkboxes */}
        <div className="col-span-6 flex gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={dossierOnly}
              onChange={(e) => updateParam("dossier", e.target.checked ? "true" : "")}
              className="h-3.5 w-3.5 rounded border-border accent-[#B87333]"
            />
            Full dossier created
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={confirmedOnly}
              onChange={(e) => updateParam("confirmed", e.target.checked ? "" : "false")}
              className="h-3.5 w-3.5 rounded border-border accent-[#B87333]"
            />
            Confirmed connections only
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[8%] font-serif">Issue</TableHead>
              <TableHead className="w-[25.33%] font-serif">Homeowner</TableHead>
              <TableHead className="w-[33.34%] font-serif">Designer</TableHead>
              <TableHead className="w-[16.67%] font-serif">Location</TableHead>
              <TableHead className="w-[16.66%] font-serif">Style</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length ? (
              data.data.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="truncate font-serif text-sm">
                    {f.issue_month ? `${MONTH_ABBR[f.issue_month]} ` : ""}
                    {f.issue_year}
                  </TableCell>
                  <TableCell className="truncate font-serif font-bold text-foreground">
                    {f.homeowner_name ?? (
                      <span className="font-normal text-muted-foreground italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="truncate font-serif">{f.designer_name ?? "\u2014"}</TableCell>
                  <TableCell className="truncate font-serif">
                    {[f.location_city, f.location_state].filter(Boolean).join(", ") || "\u2014"}
                  </TableCell>
                  <TableCell className="truncate font-serif">
                    {f.design_style ? (
                      <Badge variant="secondary" className="truncate text-xs font-normal">
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
