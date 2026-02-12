import { useState, useMemo, useCallback } from "react";

/**
 * Generic hook that centralises:
 *   – per-column text filtering (stored as Record<string, string>)
 *   – global search
 *   – sorting (field + direction)
 *   – pagination (page + pageSize, persisted to localStorage)
 *
 * Each page only needs to provide data + column keys.
 */

export type SortDir = "asc" | "desc";

export interface UseTableFeaturesOpts<T> {
  /** Full (unfiltered) dataset */
  data: T[];
  /** Unique key for localStorage persistence (e.g. "risks", "assets") */
  storageKey: string;
  /** Default sort field */
  defaultSort: string;
  /** Default sort direction */
  defaultSortDir?: SortDir;
  /** Default page size */
  defaultPageSize?: number;
  /**
   * Custom getter for cell value by column key.
   * If omitted, falls back to (row as any)[key].
   */
  getValue?: (row: T, key: string) => unknown;
}

export interface UseTableFeaturesReturn<T> {
  /* ── Filtering ── */
  columnFilters: Record<string, string>;
  setColumnFilter: (key: string, value: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;

  /* ── Global search ── */
  search: string;
  setSearch: (v: string) => void;

  /* ── Sorting ── */
  sortField: string;
  sortDir: SortDir;
  toggleSort: (field: string) => void;

  /* ── Pagination ── */
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (ps: number) => void;
  totalPages: number;

  /* ── Results ── */
  /** All items after filtering + sorting (before pagination) */
  filtered: T[];
  /** Items on current page (after pagination) */
  pageData: T[];
  /** Counts */
  filteredCount: number;
  totalCount: number;
}

export function useTableFeatures<T>(opts: UseTableFeaturesOpts<T>): UseTableFeaturesReturn<T> {
  const {
    data,
    storageKey,
    defaultSort,
    defaultSortDir = "asc",
    defaultPageSize = 100,
    getValue,
  } = opts;

  // ── Column filters ──
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const setColumnFilter = useCallback((key: string, value: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, []);
  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setSearch("");
  }, []);
  const hasActiveFilters = Object.keys(columnFilters).length > 0;

  // ── Global search ──
  const [search, setSearch] = useState("");

  // ── Sorting ──
  const [sortField, setSortField] = useState(defaultSort);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const toggleSort = useCallback((field: string) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  // ── Pagination ──
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(() => {
    try {
      const saved = localStorage.getItem(`pageSize:${storageKey}`);
      if (saved) return Number(saved);
    } catch { /* ignore */ }
    return defaultPageSize;
  });
  const setPageSize = useCallback((ps: number) => {
    setPageSizeRaw(ps);
    setPageRaw(1);
    try { localStorage.setItem(`pageSize:${storageKey}`, String(ps)); } catch { /* ignore */ }
  }, [storageKey]);
  const setPage = useCallback((p: number) => setPageRaw(p), []);

  // ── Resolve cell value ──
  const cellVal = useCallback((row: T, key: string): unknown => {
    if (getValue) return getValue(row, key);
    return (row as any)[key];
  }, [getValue]);

  // ── Filtered + Sorted ──
  const filtered = useMemo(() => {
    let result = [...data];

    // Per-column filters
    const filterEntries = Object.entries(columnFilters);
    if (filterEntries.length > 0) {
      result = result.filter(row =>
        filterEntries.every(([key, filterVal]) => {
          const v = cellVal(row, key);
          if (v == null) return false;
          return String(v).toLowerCase().includes(filterVal.toLowerCase());
        }),
      );
    }

    // Global search (match any visible string field)
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(row => {
        const vals = Object.values(row as any);
        return vals.some(v => v != null && String(v).toLowerCase().includes(q));
      });
    }

    // Sort
    result.sort((a, b) => {
      const av = cellVal(a, sortField);
      const bv = cellVal(b, sortField);
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = 1;
      else if (bv == null) cmp = -1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else if (typeof av === "boolean" && typeof bv === "boolean") cmp = (av === bv ? 0 : av ? -1 : 1);
      else cmp = String(av).localeCompare(String(bv), "pl", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data, columnFilters, search, sortField, sortDir, cellVal]);

  // ── Pagination derived ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  // auto-correct page if it exceeds after filter change
  if (safePage !== page) setPageRaw(safePage);

  const pageData = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  return {
    columnFilters,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    search,
    setSearch,
    sortField,
    sortDir,
    toggleSort,
    page: safePage,
    pageSize,
    setPage,
    setPageSize,
    totalPages,
    filtered,
    pageData,
    filteredCount: filtered.length,
    totalCount: data.length,
  };
}
