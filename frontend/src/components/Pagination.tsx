/* ═══════════════════════════════════════════════════════════
   Pagination — page navigation + page-size selector
   ═══════════════════════════════════════════════════════════ */

interface Props {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  filteredItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [25, 50, 100, 200, 500];

export default function Pagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  filteredItems,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const from = filteredItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filteredItems);

  /** Build page-number list with ellipsis */
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 14px", fontSize: 12, color: "var(--text-muted)",
      borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8,
    }}>
      {/* Left: showing info */}
      <span>
        {filteredItems === 0 ? "Brak wyników" : (
          <>
            {from}–{to} z {filteredItems}
            {filteredItems !== totalItems && <span style={{ opacity: 0.6 }}> (filtr. z {totalItems})</span>}
          </>
        )}
      </span>

      {/* Center: page buttons */}
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        <button
          className="btn btn-sm"
          style={{ padding: "2px 6px", fontSize: 11, minWidth: 28 }}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Poprzednia strona"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} style={{ padding: "0 4px" }}>…</span>
          ) : (
            <button
              key={p}
              className="btn btn-sm"
              style={{
                padding: "2px 8px", fontSize: 11, minWidth: 28,
                background: p === page ? "var(--blue)" : undefined,
                color: p === page ? "#fff" : undefined,
                fontWeight: p === page ? 600 : undefined,
              }}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="btn btn-sm"
          style={{ padding: "2px 6px", fontSize: 11, minWidth: 28 }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="Następna strona"
        >
          ›
        </button>
      </div>

      {/* Right: page size selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span>Pokaż</span>
        <select
          className="form-control"
          style={{ width: 64, padding: "2px 4px", fontSize: 11 }}
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>na str.</span>
      </div>
    </div>
  );
}
