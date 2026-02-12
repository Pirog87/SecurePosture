import { useState, useRef, useEffect, type ReactNode } from "react";
import type { ColumnDef } from "./TableToolbar";
import Pagination from "./Pagination";
import type { SortDir } from "../hooks/useTableFeatures";

/* ═══════════════════════════════════════════════════════════
   DataTable — sortable headers with per-column filter inputs
   in a collapsible second header row, plus pagination footer.
   ═══════════════════════════════════════════════════════════ */

interface Props<T> {
  columns: ColumnDef<T>[];
  visibleColumns: Set<string>;
  /** Current page of data (paginated slice) */
  data: T[];
  /** Render a custom cell; return undefined to use default format */
  renderCell?: (row: T, colKey: string) => ReactNode | undefined;
  /** Row click */
  onRowClick?: (row: T) => void;
  /** Row key extractor */
  rowKey: (row: T) => string | number;
  /** Currently selected row key */
  selectedKey?: string | number | null;
  /** Row left border color (e.g. risk score indicator) */
  rowBorderColor?: (row: T) => string | undefined;

  /* ── Sort ── */
  sortField: string;
  sortDir: SortDir;
  onSort: (field: string) => void;

  /* ── Column filters ── */
  columnFilters: Record<string, string>;
  onColumnFilter: (key: string, value: string) => void;
  showFilters: boolean;

  /* ── Pagination ── */
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  filteredItems: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;

  /* ── State ── */
  loading?: boolean;
  emptyMessage?: string;
  emptyFilteredMessage?: string;
}

export default function DataTable<T>(props: Props<T>) {
  const {
    columns, visibleColumns, data,
    renderCell, onRowClick, rowKey, selectedKey, rowBorderColor,
    sortField, sortDir, onSort,
    columnFilters, onColumnFilter, showFilters,
    page, totalPages, pageSize, totalItems, filteredItems,
    onPageChange, onPageSizeChange,
    loading, emptyMessage = "Brak danych.", emptyFilteredMessage = "Brak wyników dla wybranych filtrów.",
  } = props;

  const visCols = columns.filter(c => visibleColumns.has(c.key));

  // Track which column's filter popup is open
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeFilter) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setActiveFilter(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeFilter]);

  if (loading) {
    return (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Ładowanie danych...
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {data.length === 0 && !loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {filteredItems === 0 && totalItems > 0 ? emptyFilteredMessage : emptyMessage}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                {/* Row 1: Column names + sort arrows */}
                <tr>
                  {visCols.map(col => {
                    const isSorted = sortField === col.key;
                    const hasFilter = !!columnFilters[col.key];
                    return (
                      <th key={col.key} style={{ position: "relative", userSelect: "none", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {/* Column name — clicking toggles filter popup */}
                          <span
                            style={{
                              cursor: "pointer", flex: 1,
                              color: hasFilter ? "var(--blue)" : undefined,
                              textDecoration: hasFilter ? "underline" : undefined,
                              textDecorationStyle: hasFilter ? "dotted" as any : undefined,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilter(prev => prev === col.key ? null : col.key);
                            }}
                            title={`Filtruj: ${col.header}`}
                          >
                            {col.header}
                          </span>

                          {/* Sort arrows — always visible, clickable */}
                          <span
                            style={{ display: "inline-flex", flexDirection: "column", cursor: "pointer", lineHeight: 0, marginLeft: 2 }}
                            onClick={(e) => { e.stopPropagation(); onSort(col.key); }}
                            title="Sortuj"
                          >
                            <span style={{
                              fontSize: 8, lineHeight: "9px",
                              color: isSorted && sortDir === "asc" ? "var(--blue)" : "var(--text-muted)",
                              opacity: isSorted && sortDir === "asc" ? 1 : 0.4,
                            }}>▲</span>
                            <span style={{
                              fontSize: 8, lineHeight: "9px",
                              color: isSorted && sortDir === "desc" ? "var(--blue)" : "var(--text-muted)",
                              opacity: isSorted && sortDir === "desc" ? 1 : 0.4,
                            }}>▼</span>
                          </span>
                        </div>

                        {/* Filter popup — appears when header name is clicked */}
                        {activeFilter === col.key && (
                          <div
                            ref={filterRef}
                            style={{
                              position: "absolute", left: 0, top: "100%", zIndex: 120,
                              background: "var(--bg-secondary)", border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)", padding: 6, minWidth: 160,
                              boxShadow: "var(--shadow)",
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              className="form-control"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder={`Filtruj ${col.header}...`}
                              value={columnFilters[col.key] ?? ""}
                              onChange={e => onColumnFilter(col.key, e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Escape") setActiveFilter(null);
                                if (e.key === "Enter") setActiveFilter(null);
                              }}
                            />
                            {columnFilters[col.key] && (
                              <button
                                className="btn btn-sm"
                                style={{ marginTop: 4, fontSize: 10, width: "100%", color: "var(--red)" }}
                                onClick={() => { onColumnFilter(col.key, ""); setActiveFilter(null); }}
                              >
                                Wyczyść
                              </button>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>

                {/* Row 2: inline filter inputs (when showFilters is on) */}
                {showFilters && (
                  <tr>
                    {visCols.map(col => (
                      <th key={`f-${col.key}`} style={{ padding: "4px 6px", background: "var(--bg-tertiary, var(--bg-secondary))" }}>
                        <input
                          className="form-control"
                          style={{ width: "100%", padding: "3px 6px", fontSize: 10, minWidth: 60 }}
                          placeholder="..."
                          value={columnFilters[col.key] ?? ""}
                          onChange={e => onColumnFilter(col.key, e.target.value)}
                        />
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {data.map(row => {
                  const key = rowKey(row);
                  const borderColor = rowBorderColor?.(row);
                  return (
                    <tr
                      key={key}
                      style={{
                        cursor: onRowClick ? "pointer" : undefined,
                        background: selectedKey === key ? "var(--bg-card-hover)" : undefined,
                        borderLeft: borderColor ? `3px solid ${borderColor}` : undefined,
                      }}
                      onClick={() => onRowClick?.(row)}
                    >
                      {visCols.map(col => {
                        const custom = renderCell?.(row, col.key);
                        if (custom !== undefined) return <td key={col.key}>{custom}</td>;
                        const val = col.format ? col.format(row) : (row as any)[col.key];
                        return <td key={col.key}>{val ?? "\u2014"}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            filteredItems={filteredItems}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
    </div>
  );
}
