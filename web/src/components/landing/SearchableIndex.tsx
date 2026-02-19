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
import Link from "next/link";
import type { Feature, PaginatedResponse } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/category-colors";

type FeatureRow = Feature & { issue_month: number | null; issue_year: number; dossier_id: number | null; editor_verdict: string | null };

const MONTH_ABBR = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface SearchableIndexProps {
  /** Default rows per page (default: 8) */
  pageSize?: number;
  /** Whether to default to confirmed-only (default: true) */
  defaultConfirmedOnly?: boolean;
  /** Default sort column (default: none) */
  defaultSort?: string;
  /** Default sort order (default: none) */
  defaultOrder?: "asc" | "desc";
}

export function SearchableIndex({
  pageSize = 8,
  defaultConfirmedOnly = true,
  defaultSort = "",
  defaultOrder,
}: SearchableIndexProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<PaginatedResponse<FeatureRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const year = searchParams.get("year") ?? "";
  const category = searchParams.get("category") ?? "";
  const style = searchParams.get("style") ?? "";
  const location = searchParams.get("location") ?? "";
  const sort = searchParams.get("sort") ?? defaultSort;
  const order = (searchParams.get("order") ?? defaultOrder ?? "") as "" | "asc" | "desc";
  const dossierOnly = searchParams.get("dossier") === "true";
  const confirmedOnly = defaultConfirmedOnly
    ? searchParams.get("confirmed") !== "false"
    : searchParams.get("confirmed") === "true";

  function toggleSort(column: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === column && order === "asc") {
      params.set("sort", column);
      params.set("order", "desc");
    } else if (sort === column && order === "desc") {
      params.delete("sort");
      params.delete("order");
    } else {
      params.set("sort", column);
      params.set("order", "asc");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}#index`, { scroll: false });
  }

  function SortCaret({ column }: { column: string }) {
    if (sort !== column) return <span className="ml-0.5 text-[9px] text-muted-foreground/25">&#9650;</span>;
    return (
      <span className="ml-0.5 text-[9px]" style={{ color: "#8B5E2B" }}>
        {order === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    if (search) params.set("search", search);
    if (year) params.set("year", year);
    if (category) params.set("category", category);
    if (style) params.set("style", style);
    if (location) params.set("location", location);
    if (sort) params.set("sort", sort);
    if (order) params.set("order", order);
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
  }, [page, pageSize, search, year, category, style, location, sort, order, dossierOnly, confirmedOnly]);

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
      {/* Filters — snapped to 6-column design grid */}
      <div className="mb-6 grid grid-cols-6 gap-x-6 gap-y-3">
        {/* Subhead — major column 1 only */}
        <p className="col-span-2 mb-2 font-serif text-[15px] italic leading-[1.75] text-foreground/45">
          Browse all cataloged homes below.
        </p>
        <div className="col-span-4" />

        {/* Row 1: checkboxes + clear */}
        <div className="col-span-6 flex items-center gap-6">
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={dossierOnly}
                onChange={(e) => updateParam("dossier", e.target.checked ? "true" : "")}
                className="h-3.5 w-3.5 rounded border-border accent-[#8B5E2B]"
              />
              Full dossier created
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={confirmedOnly}
                onChange={(e) => {
                  if (defaultConfirmedOnly) {
                    // Default is ON: unchecking sets confirmed=false, checking removes param
                    updateParam("confirmed", e.target.checked ? "" : "false");
                  } else {
                    // Default is OFF: checking sets confirmed=true, unchecking removes param
                    updateParam("confirmed", e.target.checked ? "true" : "");
                  }
                }}
                className="h-3.5 w-3.5 rounded border-border accent-[#8B5E2B]"
              />
              Confirmed connections only
            </label>
          </div>
          {(search || year || category || style || location || sort || dossierOnly || !confirmedOnly) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setSearchInput("");
                router.push("?#index", { scroll: false });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Row 2: inputs — Search(2), Year, Category, Location, Style */}
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
          placeholder="Category"
          value={category}
          onChange={(e) => updateParam("category", e.target.value)}
        />
        <Input
          placeholder="Location"
          value={location}
          onChange={(e) => updateParam("location", e.target.value)}
        />
        <Input
          placeholder="Style"
          value={style}
          onChange={(e) => updateParam("style", e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="scrollbar-visible rounded-lg border border-border">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "15%" }} />
            <col />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none whitespace-nowrap font-serif" onClick={() => toggleSort("year")}>
                Issue<SortCaret column="year" />
              </TableHead>
              <TableHead className="cursor-pointer select-none font-serif" onClick={() => toggleSort("homeowner")}>
                Homeowner<SortCaret column="homeowner" />
              </TableHead>
              <TableHead className="cursor-pointer select-none font-serif" onClick={() => toggleSort("designer")}>
                Designer<SortCaret column="designer" />
              </TableHead>
              <TableHead className="cursor-pointer select-none font-serif" onClick={() => toggleSort("category")}>
                Category<SortCaret column="category" />
              </TableHead>
              <TableHead className="cursor-pointer select-none font-serif" onClick={() => toggleSort("location")}>
                Location<SortCaret column="location" />
              </TableHead>
              <TableHead className="font-serif">Report</TableHead>
              <TableHead className="whitespace-nowrap font-serif">Style</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length ? (
              data.data.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="max-w-0 truncate font-serif text-sm">
                    {f.issue_month ? `${MONTH_ABBR[f.issue_month]} ` : ""}
                    {f.issue_year}
                  </TableCell>
                  <TableCell className="max-w-0 truncate font-serif font-bold text-foreground">
                    {!f.homeowner_name || f.homeowner_name === "Anonymous" ? (
                      <span className="font-normal text-muted-foreground/60 italic">Anonymous</span>
                    ) : (
                      f.homeowner_name
                    )}
                  </TableCell>
                  <TableCell className="max-w-0 truncate font-serif">{f.designer_name ?? "\u2014"}</TableCell>
                  <TableCell className="max-w-0 truncate font-serif">
                    {f.subject_category ? (() => {
                      const colors = CATEGORY_COLORS[f.subject_category] ?? CATEGORY_COLORS.Other;
                      return (
                        <span
                          className="inline-block rounded-sm px-2 py-0.5 text-[11px] font-medium leading-tight"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {f.subject_category}
                        </span>
                      );
                    })() : "\u2014"}
                  </TableCell>
                  <TableCell className="max-w-0 truncate font-serif">
                    {[f.location_city, f.location_state].filter(Boolean).join(", ") || "\u2014"}
                  </TableCell>
                  <TableCell className="max-w-0 truncate font-serif">
                    <Link
                      href={`/report/${f.id}`}
                      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-medium leading-tight no-underline transition-colors hover:opacity-80"
                      style={
                        f.editor_verdict === "CONFIRMED"
                          ? { backgroundColor: "#8B5E2B", color: "#FFF" }
                          : f.dossier_id
                            ? { backgroundColor: "#4A4A4A", color: "#D4D4D4" }
                            : { backgroundColor: "#E8E4DF", color: "#6B6560" }
                      }
                    >
                      {f.dossier_id ? "Dossier" : "Report"}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                        <path d="M3 1.5H8.5V7M8.5 1.5L1.5 8.5" stroke={f.editor_verdict === "CONFIRMED" ? "#FFD6A0" : f.dossier_id ? "#9A9A9A" : "#8B8580"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-serif">
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
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Page
            <input
              type="number"
              min={1}
              max={data.totalPages}
              defaultValue={page}
              key={page}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = Math.max(1, Math.min(data.totalPages, Number((e.target as HTMLInputElement).value) || 1));
                  goToPage(val);
                }
              }}
              onBlur={(e) => {
                const val = Math.max(1, Math.min(data.totalPages, Number(e.target.value) || 1));
                if (val !== page) goToPage(val);
              }}
              className="w-14 rounded border border-border bg-transparent px-1.5 py-0.5 text-center text-sm font-medium text-foreground"
            />
            of {data.totalPages}
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
