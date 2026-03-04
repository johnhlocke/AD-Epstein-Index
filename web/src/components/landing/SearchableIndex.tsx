"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
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

/** Sync local filter state to the URL via replaceState (no Next.js navigation). */
function syncUrl(params: URLSearchParams) {
  const qs = params.toString();
  // Preserve whatever hash the browser currently has (e.g. #agent-methodology)
  const hash = window.location.hash || "";
  const url = qs ? `?${qs}${hash}` : `${window.location.pathname}${hash}`;
  window.history.replaceState(null, "", url);
}

export function SearchableIndex({
  pageSize = 8,
  defaultConfirmedOnly = true,
  defaultSort = "",
  defaultOrder,
}: SearchableIndexProps = {}) {
  // Read initial values from URL on mount — then manage locally
  const initParams = useSearchParams();

  const [data, setData] = useState<PaginatedResponse<FeatureRow> | null>(null);
  const [loading, setLoading] = useState(true);

  // All filter state is local — no router.push()
  const [page, setPage] = useState(Number(initParams.get("page") ?? "1"));
  const [search, setSearch] = useState(initParams.get("search") ?? "");
  const [searchInput, setSearchInput] = useState(initParams.get("search") ?? "");
  const [year, setYear] = useState(initParams.get("year") ?? "");
  const [category, setCategory] = useState(initParams.get("category") ?? "");
  const [style, setStyle] = useState(initParams.get("style") ?? "");
  const [location, setLocation] = useState(initParams.get("location") ?? "");
  const [sort, setSort] = useState(initParams.get("sort") ?? defaultSort);
  const [order, setOrder] = useState<"" | "asc" | "desc">((initParams.get("order") ?? defaultOrder ?? "") as "" | "asc" | "desc");
  const [dossierOnly, setDossierOnly] = useState(initParams.get("dossier") === "true");
  const [confirmedOnly, setConfirmedOnly] = useState(
    defaultConfirmedOnly
      ? initParams.get("confirmed") !== "false"
      : initParams.get("confirmed") === "true"
  );

  // Client-side page cache — keyed by query string
  const pageCache = useRef(new Map<string, PaginatedResponse<FeatureRow>>());

  function toggleSort(column: string) {
    let newSort = column;
    let newOrder: "" | "asc" | "desc" = "asc";
    if (sort === column && order === "asc") {
      newOrder = "desc";
    } else if (sort === column && order === "desc") {
      newSort = "";
      newOrder = "";
    }
    setSort(newSort);
    setOrder(newOrder);
    setPage(1);
  }

  function SortCaret({ column }: { column: string }) {
    if (sort !== column) return <span className="ml-0.5 text-[9px] text-muted-foreground/25">&#9650;</span>;
    return (
      <span className="ml-0.5 text-[9px]" style={{ color: "#8B5E2B" }}>
        {order === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  }

  /** Build the API query string for a given page number. */
  const buildParams = useCallback((p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
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
    return params.toString();
  }, [pageSize, search, year, category, style, location, sort, order, dossierOnly, confirmedOnly]);

  /** Build URL params for browser URL bar (excludes defaults). */
  const buildUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (search) params.set("search", search);
    if (year) params.set("year", year);
    if (category) params.set("category", category);
    if (style) params.set("style", style);
    if (location) params.set("location", location);
    if (sort && sort !== defaultSort) params.set("sort", sort);
    if (order && order !== (defaultOrder ?? "")) params.set("order", order);
    if (dossierOnly) params.set("dossier", "true");
    if (defaultConfirmedOnly) {
      if (!confirmedOnly) params.set("confirmed", "false");
    } else {
      if (confirmedOnly) params.set("confirmed", "true");
    }
    return params;
  }, [page, search, year, category, style, location, sort, order, dossierOnly, confirmedOnly, defaultSort, defaultOrder, defaultConfirmedOnly]);

  // Sync URL whenever filter state changes (replaceState — no navigation)
  useEffect(() => {
    syncUrl(buildUrlParams());
  }, [buildUrlParams]);

  const fetchData = useCallback(async () => {
    const qs = buildParams(page);

    // Check client cache first — instant return for previously visited pages
    const cached = pageCache.current.get(qs);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/features?${qs}`);
      const json = await res.json();
      pageCache.current.set(qs, json);
      setData(json);
    } catch {
      console.error("Failed to fetch features");
    } finally {
      setLoading(false);
    }
  }, [page, buildParams]);

  // Delay the very first fetch so the hero mosaic loads uncontested.
  // Subsequent fetches (pagination, filter changes) fire immediately.
  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) {
      fetchData();
      return;
    }
    const t = setTimeout(() => { hasFetched.current = true; fetchData(); }, 1000);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Pre-fetch next page in background after current page loads
  useEffect(() => {
    if (!data || loading) return;
    const nextPage = page + 1;
    if (nextPage > data.totalPages) return;
    const nextQs = buildParams(nextPage);
    if (pageCache.current.has(nextQs)) return;
    // Fire and forget — populate cache for instant next-page navigation
    fetch(`/api/features?${nextQs}`)
      .then((r) => r.json())
      .then((json) => pageCache.current.set(nextQs, json))
      .catch(() => {});
  }, [data, loading, page, buildParams]);

  // Clear cache when filters change (not just page)
  useEffect(() => {
    pageCache.current.clear();
  }, [search, year, category, style, location, sort, order, dossierOnly, confirmedOnly]);

  // Debounced search — update local search state (triggers fetch via effect chain)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  function updateParam(key: string, value: string) {
    const setters: Record<string, (v: string) => void> = {
      year: setYear,
      category: setCategory,
      style: setStyle,
      location: setLocation,
    };
    if (key === "dossier") {
      setDossierOnly(value === "true");
    } else if (key === "confirmed") {
      if (defaultConfirmedOnly) {
        setConfirmedOnly(value !== "false");
      } else {
        setConfirmedOnly(value === "true");
      }
    } else if (setters[key]) {
      setters[key](value);
    }
    setPage(1);
  }

  function goToPage(p: number) {
    setPage(p);
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
                  setConfirmedOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-3.5 w-3.5 rounded border-border accent-[#8B5E2B]"
              />
              Confirmed connections only
            </label>
          </div>
          {(search || year || category || style || location || (sort && sort !== defaultSort) || dossierOnly || (defaultConfirmedOnly ? !confirmedOnly : confirmedOnly)) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setYear("");
                setCategory("");
                setStyle("");
                setLocation("");
                setSort(defaultSort);
                setOrder((defaultOrder ?? "") as "" | "asc" | "desc");
                setDossierOnly(false);
                setConfirmedOnly(defaultConfirmedOnly);
                setPage(1);
                pageCache.current.clear();
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
          <TableBody className={loading && data ? "opacity-40 transition-opacity duration-150" : ""}>
            {loading && !data ? (
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
                          ? { backgroundColor: "#B91C1C", color: "#FFF" }
                          : f.dossier_id
                            ? { backgroundColor: "#4A4A4A", color: "#D4D4D4" }
                            : { backgroundColor: "#E8E4DF", color: "#6B6560" }
                      }
                    >
                      {f.dossier_id ? "Dossier" : "Report"}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                        <path d="M3 1.5H8.5V7M8.5 1.5L1.5 8.5" stroke={f.editor_verdict === "CONFIRMED" ? "#FCA5A5" : f.dossier_id ? "#9A9A9A" : "#8B8580"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
