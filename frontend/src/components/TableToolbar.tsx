import { useState, useRef, useEffect } from "react";
import { exportCSV, exportXLSX, type ExportColumn } from "../utils/tableExport";

/* ═══════════════════════════════════════════════════════════
   Reusable toolbar: search, filters toggle, column picker,
   export (CSV / XLSX), count display, and primary action.
   ═══════════════════════════════════════════════════════════ */

export interface ColumnDef<T> {
  key: string;
  header: string;
  defaultVisible?: boolean; // default true
  format?: (row: T) => string | number;
}

interface Props<T> {
  /** Total displayed / total records label */
  filteredCount: number;
  totalCount: number;
  unitLabel?: string; // e.g. "ryzyk", "aktywow"

  /** Search */
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;

  /** Filters toggle */
  showFilters?: boolean;
  onToggleFilters?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;

  /** Column visibility */
  columns: ColumnDef<T>[];
  visibleColumns: Set<string>;
  onToggleColumn: (key: string) => void;

  /** Export data (already filtered & sorted) */
  data: T[];
  exportFilename?: string;

  /** Primary action button */
  primaryLabel?: string;
  onPrimaryAction?: () => void;
}

export default function TableToolbar<T>(props: Props<T>) {
  const {
    filteredCount, totalCount, unitLabel = "rekordow",
    search, onSearchChange, searchPlaceholder = "Szukaj...",
    showFilters, onToggleFilters, hasActiveFilters, onClearFilters,
    columns, visibleColumns, onToggleColumn,
    data, exportFilename = "export",
    primaryLabel, onPrimaryAction,
  } = props;

  const [showColPicker, setShowColPicker] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);
  const expRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colRef.current && !colRef.current.contains(e.target as Node)) setShowColPicker(false);
      if (expRef.current && !expRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exportCols: ExportColumn<T>[] = columns
    .filter((c) => visibleColumns.has(c.key))
    .map((c) => ({ key: c.key, header: c.header, format: c.format }));

  return (
    <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
      <div className="toolbar-left" style={{ alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {filteredCount !== totalCount ? `${filteredCount} / ${totalCount}` : totalCount} {unitLabel}
        </span>

        <input
          className="form-control"
          style={{ width: 200, padding: "5px 10px", fontSize: 12 }}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {onToggleFilters && (
          <button
            className="btn btn-sm"
            style={{
              fontSize: 11,
              color: showFilters || hasActiveFilters ? "var(--blue)" : undefined,
              fontWeight: hasActiveFilters ? 600 : undefined,
            }}
            onClick={onToggleFilters}
          >
            Filtry kolumn {showFilters ? "\u25B2" : "\u25BC"}
            {hasActiveFilters && (
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                background: "var(--blue)", marginLeft: 4, verticalAlign: "middle",
              }} />
            )}
          </button>
        )}

        {hasActiveFilters && onClearFilters && (
          <button className="btn btn-sm" style={{ fontSize: 11, color: "var(--red)" }} onClick={onClearFilters}>
            Wyczysc filtry
          </button>
        )}
      </div>

      <div className="toolbar-right" style={{ alignItems: "center" }}>
        {/* Column visibility picker */}
        <div ref={colRef} style={{ position: "relative" }}>
          <button className="btn btn-sm" onClick={() => setShowColPicker((v) => !v)} title="Kolumny">
            Kolumny
          </button>
          {showColPicker && (
            <div style={{
              position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", padding: 8, minWidth: 220, maxHeight: 400, overflowY: "auto",
              boxShadow: "var(--shadow)",
            }}>
              {columns.map((c) => (
                <label key={c.key} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                  fontSize: 12, cursor: "pointer", borderRadius: 4,
                }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(c.key)}
                    onChange={() => onToggleColumn(c.key)}
                  />
                  {c.header}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Export dropdown */}
        <div ref={expRef} style={{ position: "relative" }}>
          <button className="btn btn-sm" onClick={() => setShowExport((v) => !v)} title="Eksport">
            Eksport
          </button>
          {showExport && (
            <div style={{
              position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", padding: 4, minWidth: 130,
              boxShadow: "var(--shadow)",
            }}>
              <button
                className="btn btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                onClick={() => { exportCSV(data, exportCols, exportFilename); setShowExport(false); }}
              >
                CSV
              </button>
              <button
                className="btn btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                onClick={() => { exportXLSX(data, exportCols, exportFilename); setShowExport(false); }}
              >
                Excel (XLSX)
              </button>
            </div>
          )}
        </div>

        {primaryLabel && onPrimaryAction && (
          <button className="btn btn-primary btn-sm" onClick={onPrimaryAction}>
            + {primaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
