import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";

/* ─── Types ─── */
interface AuditFinding {
  id: number;
  audit_engagement_id: number;
  ref_id: string;
  title: string;
  severity: string;
  status: string;
  condition_text: string;
  criteria_text: string;
  cause_text: string | null;
  effect_text: string | null;
  recommendation: string | null;
  management_response: string | null;
  management_response_by: string | null;
  management_response_at: string | null;
  agreed: boolean | null;
  status_changed_at: string | null;
  target_date: string | null;
  actual_close_date: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── Helpers ─── */
const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--yellow)",
  low: "var(--green)",
  informational: "#94a3b8",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Krytyczne",
  high: "Wysokie",
  medium: "Średnie",
  low: "Niskie",
  informational: "Informacyjne",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  open: "var(--red)",
  in_progress: "var(--blue)",
  resolved: "var(--green)",
  closed: "#6b7280",
  accepted: "var(--purple)",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  open: "Otwarte",
  in_progress: "W realizacji",
  resolved: "Rozwiązane",
  closed: "Zamknięte",
  accepted: "Zaakceptowane",
};

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: "var(--blue)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>{number}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "\u2014"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AuditFindingsPage — standalone findings register
   ═══════════════════════════════════════════════════════════ */
export default function AuditFindingsPage() {
  const COLUMNS: ColumnDef<AuditFinding>[] = [
    { key: "ref_id", header: "Ref", format: r => r.ref_id },
    { key: "title", header: "Tytuł" },
    { key: "audit_engagement_id", header: "Zadanie ID", format: r => String(r.audit_engagement_id) },
    { key: "severity", header: "Istotność", format: r => SEVERITY_LABELS[r.severity] || r.severity },
    { key: "status", header: "Status", format: r => STATUS_LABELS[r.status] || r.status },
    { key: "target_date", header: "Termin", format: r => r.target_date ?? "" },
    { key: "actual_close_date", header: "Zamknięto", format: r => r.actual_close_date ?? "", defaultVisible: false },
    { key: "management_response_by", header: "Odp. kierownictwo", format: r => r.management_response_by ?? "", defaultVisible: false },
    { key: "verified_by", header: "Zweryfikował", format: r => r.verified_by ?? "", defaultVisible: false },
    { key: "condition_text", header: "Stan (Condition)", format: r => r.condition_text ?? "", defaultVisible: false },
    { key: "criteria_text", header: "Kryterium", format: r => r.criteria_text ?? "", defaultVisible: false },
    { key: "cause_text", header: "Przyczyna", format: r => r.cause_text ?? "", defaultVisible: false },
    { key: "effect_text", header: "Skutek", format: r => r.effect_text ?? "", defaultVisible: false },
    { key: "created_by", header: "Autor", format: r => r.created_by ?? "", defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "audit-findings");

  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditFinding | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams] = useSearchParams();
  const engId = searchParams.get("engagement_id");
  const navigate = useNavigate();

  const table = useTableFeatures<AuditFinding>({
    data: findings,
    storageKey: "audit-findings",
    defaultSort: "created_at",
    defaultSortDir: "desc",
  });

  const load = () => {
    setLoading(true);
    const url = engId
      ? `/api/v1/audit-engagements/${engId}/findings`
      : "/api/v1/audit-findings/";
    api.get<AuditFinding[]>(url)
      .then(setFindings)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [engId]);

  /* ── Stats ── */
  const src = table.filtered;
  const open = src.filter(f => ["open", "in_progress"].includes(f.status)).length;
  const critical = src.filter(f => f.severity === "critical" || f.severity === "high").length;
  const overdue = src.filter(f => {
    if (!f.target_date || ["resolved", "closed"].includes(f.status)) return false;
    return new Date(f.target_date) < new Date();
  }).length;
  const _resolved = src.filter(f => ["resolved", "closed"].includes(f.status)).length;
  void _resolved;

  const allOpen = findings.filter(f => ["open", "in_progress"].includes(f.status)).length;
  const allCritical = findings.filter(f => f.severity === "critical" || f.severity === "high").length;
  const allOverdue = findings.filter(f => {
    if (!f.target_date || ["resolved", "closed"].includes(f.status)) return false;
    return new Date(f.target_date) < new Date();
  }).length;
  const _allResolved = findings.filter(f => ["resolved", "closed"].includes(f.status)).length;
  void _allResolved;

  const isFiltered = table.filteredCount !== table.totalCount;

  const stats: StatCard[] = [
    { label: "Ustalenia ogółem", value: src.length, total: findings.length, color: "var(--blue)" },
    { label: "Otwarte", value: open, total: allOpen, color: "var(--orange)" },
    { label: "Krytyczne/Wysokie", value: critical, total: allCritical, color: "var(--red)" },
    { label: "Przeterminowane", value: overdue, total: allOverdue, color: overdue > 0 ? "var(--red)" : "var(--green)" },
  ];

  const sel = selected;
  const today = new Date();
  const isOverdue = sel?.target_date && !["resolved", "closed"].includes(sel.status) && new Date(sel.target_date) < today;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <h2 style={{ margin: "0 0 16px" }}>Ustalenia Audytowe (Findings)</h2>

      {engId && (
        <div style={{
          background: "var(--blue-dim)", border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: "var(--radius-sm)", padding: "8px 14px", marginBottom: 12,
          fontSize: 12, color: "var(--blue)", display: "flex", alignItems: "center", gap: 8,
        }}>
          Filtr zadania: ID {engId}
          <button className="btn btn-xs" onClick={() => navigate("/audit-findings")} style={{ marginLeft: "auto" }}>
            Pokaż wszystkie
          </button>
        </div>
      )}

      <StatsCards cards={stats} isFiltered={isFiltered} />

      <TableToolbar<AuditFinding>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="ustaleń"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj ustaleń..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="audit_findings"
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14, marginTop: 2 }}>
        <DataTable<AuditFinding>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
          rowBorderColor={r => SEVERITY_COLORS[r.severity] || undefined}
          renderCell={(row, colKey) => {
            if (colKey === "ref_id") {
              return <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>{row.ref_id}</span>;
            }
            if (colKey === "title") {
              return <span style={{ fontWeight: 600 }}>{row.title}</span>;
            }
            if (colKey === "severity") {
              const c = SEVERITY_COLORS[row.severity] || "#94a3b8";
              return <span className="badge" style={{ backgroundColor: `${c}20`, color: c }}>{SEVERITY_LABELS[row.severity] || row.severity}</span>;
            }
            if (colKey === "status") {
              const c = STATUS_COLORS[row.status] || "#94a3b8";
              return <span className="badge" style={{ backgroundColor: `${c}20`, color: c }}>{STATUS_LABELS[row.status] || row.status}</span>;
            }
            if (colKey === "target_date") {
              if (!row.target_date) return <span style={{ color: "var(--text-muted)" }}>—</span>;
              const isOd = !["resolved", "closed"].includes(row.status) && new Date(row.target_date) < today;
              return <span style={{ color: isOd ? "var(--red)" : undefined, fontWeight: isOd ? 600 : undefined }}>{row.target_date}</span>;
            }
            return undefined;
          }}
          sortField={table.sortField}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          columnFilters={table.columnFilters}
          onColumnFilter={table.setColumnFilter}
          showFilters={showFilters}
          page={table.page}
          totalPages={table.totalPages}
          pageSize={table.pageSize}
          totalItems={table.totalCount}
          filteredItems={table.filteredCount}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          loading={loading}
          emptyMessage="Brak ustaleń audytowych."
        />

        {/* ── Detail panel ── */}
        {sel && (
          <div className="card" style={{ padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  {sel.ref_id}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{sel.title}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="badge" style={{
                    backgroundColor: `${SEVERITY_COLORS[sel.severity] || "#94a3b8"}20`,
                    color: SEVERITY_COLORS[sel.severity] || "#94a3b8",
                  }}>
                    {SEVERITY_LABELS[sel.severity] || sel.severity}
                  </span>
                  <span className="badge" style={{
                    backgroundColor: `${STATUS_COLORS[sel.status] || "#94a3b8"}20`,
                    color: STATUS_COLORS[sel.status] || "#94a3b8",
                  }}>
                    {STATUS_LABELS[sel.status] || sel.status}
                  </span>
                </div>
              </div>
              <button className="btn btn-xs" onClick={() => setSelected(null)}>✕</button>
            </div>

            <SectionHeader number="1" label="Informacje" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Zadanie ID" value={sel.audit_engagement_id} />
              <DetailRow label="Autor" value={sel.created_by} />
              <DetailRow label="Termin" value={sel.target_date} color={isOverdue ? "var(--red)" : undefined} />
              <DetailRow label="Zamknięto" value={sel.actual_close_date} color={sel.actual_close_date ? "var(--green)" : undefined} />
              <DetailRow label="Zweryfikował" value={sel.verified_by} />
            </div>

            <SectionHeader number="2" label="IIA — Stan (Condition)" />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              {sel.condition_text || <span style={{ color: "var(--text-muted)" }}>Brak opisu stanu</span>}
            </div>

            <SectionHeader number="3" label="IIA — Kryterium (Criteria)" />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              {sel.criteria_text || <span style={{ color: "var(--text-muted)" }}>Brak kryterium</span>}
            </div>

            <SectionHeader number="4" label="IIA — Przyczyna (Cause)" />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              {sel.cause_text || <span style={{ color: "var(--text-muted)" }}>Brak przyczyny</span>}
            </div>

            <SectionHeader number="5" label="IIA — Skutek (Effect)" />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              {sel.effect_text || <span style={{ color: "var(--text-muted)" }}>Brak skutku</span>}
            </div>

            {sel.recommendation && (
              <>
                <SectionHeader number="6" label="Rekomendacja" />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
                  {sel.recommendation}
                </div>
              </>
            )}

            {sel.management_response && (
              <>
                <SectionHeader number="7" label="Odpowiedź kierownictwa" />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {sel.management_response}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
