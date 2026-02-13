import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

/* ─── Types ─── */
interface AuditProgram {
  id: number;
  name: string;
  year: number;
  description: string | null;
  status: string;
  prepared_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  engagement_count: number;
  created_at: string;
}

/* ─── Helpers ─── */
const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  submitted: "var(--purple)",
  approved: "var(--green)",
  active: "var(--blue)",
  completed: "#6b7280",
  archived: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  submitted: "Zgłoszony",
  approved: "Zatwierdzony",
  active: "Aktywny",
  completed: "Zakończony",
  archived: "Archiwalny",
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
   AuditProgramsPage
   ═══════════════════════════════════════════════════════════ */
export default function AuditProgramsPage() {
  const COLUMNS: ColumnDef<AuditProgram>[] = [
    { key: "name", header: "Nazwa" },
    { key: "year", header: "Rok", format: r => String(r.year) },
    { key: "status", header: "Status", format: r => STATUS_LABELS[r.status] || r.status },
    { key: "engagement_count", header: "Zadania", format: r => String(r.engagement_count) },
    { key: "prepared_by", header: "Przygotował", format: r => r.prepared_by ?? "" },
    { key: "approved_by", header: "Zatwierdził", format: r => r.approved_by ?? "", defaultVisible: false },
    { key: "approved_at", header: "Data zatwierdzenia", format: r => r.approved_at?.slice(0, 10) ?? "", defaultVisible: false },
    { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "audit-programs");

  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditProgram | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    description: "",
    prepared_by: "",
  });

  const table = useTableFeatures<AuditProgram>({
    data: programs,
    storageKey: "audit-programs",
    defaultSort: "year",
    defaultSortDir: "desc",
  });

  const load = () => {
    setLoading(true);
    api.get<AuditProgram[]>("/api/v1/audit-programs/")
      .then(setPrograms)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post("/api/v1/audit-programs/", {
        name: form.name,
        year: form.year,
        description: form.description || null,
        prepared_by: form.prepared_by || null,
      });
      setShowModal(false);
      setForm({ name: "", year: new Date().getFullYear(), description: "", prepared_by: "" });
      load();
    } catch {
      alert("Błąd tworzenia programu");
    }
  };

  /* ── Stats ── */
  const src = table.filtered;
  const activeCount = src.filter(p => ["active", "approved"].includes(p.status)).length;
  const totalEngagements = src.reduce((s, p) => s + p.engagement_count, 0);
  const completedCount = src.filter(p => p.status === "completed").length;

  const allActive = programs.filter(p => ["active", "approved"].includes(p.status)).length;
  const allEngagements = programs.reduce((s, p) => s + p.engagement_count, 0);
  const allCompleted = programs.filter(p => p.status === "completed").length;

  const isFiltered = table.filteredCount !== table.totalCount;

  const stats: StatCard[] = [
    { label: "Programy ogółem", value: src.length, total: programs.length, color: "var(--blue)" },
    { label: "Aktywne", value: activeCount, total: allActive, color: "var(--green)" },
    { label: "Zakończone", value: completedCount, total: allCompleted, color: "#6b7280" },
    { label: "Zadania łącznie", value: totalEngagements, total: allEngagements, color: "var(--purple)" },
  ];

  const sel = selected;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <h2 style={{ margin: "0 0 16px" }}>Programy Audytów</h2>

      <StatsCards cards={stats} isFiltered={isFiltered} />

      <TableToolbar<AuditProgram>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="programów"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj programów..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="audit_programs"
        primaryLabel="Nowy program"
        onPrimaryAction={() => setShowModal(true)}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14, marginTop: 2 }}>
        <DataTable<AuditProgram>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
          renderCell={(row, colKey) => {
            if (colKey === "name") {
              return <span style={{ fontWeight: 600 }}>{row.name}</span>;
            }
            if (colKey === "status") {
              const c = STATUS_COLORS[row.status] || "#94a3b8";
              return (
                <span className="badge" style={{ backgroundColor: `${c}20`, color: c }}>
                  {STATUS_LABELS[row.status] || row.status}
                </span>
              );
            }
            if (colKey === "engagement_count") {
              return (
                <span style={{ fontWeight: 600, color: row.engagement_count > 0 ? "var(--blue)" : "var(--text-muted)" }}>
                  {row.engagement_count}
                </span>
              );
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
          emptyMessage="Brak programów audytów. Utwórz roczny plan audytów."
        />

        {/* ── Detail panel ── */}
        {sel && (
          <div className="card" style={{ padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{sel.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="badge" style={{
                    backgroundColor: `${STATUS_COLORS[sel.status] || "#94a3b8"}20`,
                    color: STATUS_COLORS[sel.status] || "#94a3b8",
                  }}>
                    {STATUS_LABELS[sel.status] || sel.status}
                  </span>
                  <span className="badge" style={{ backgroundColor: "var(--blue-dim)", color: "var(--blue)" }}>
                    {sel.year}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-xs btn-primary" onClick={() => navigate(`/audit-engagements?program_id=${sel.id}`)}>
                  Zadania
                </button>
                <button className="btn btn-xs" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>

            {/* Mini stat */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--blue)" }}>
                {sel.engagement_count}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zadań audytowych</div>
            </div>

            <SectionHeader number="1" label="Informacje" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Rok" value={sel.year} />
              <DetailRow label="Przygotował" value={sel.prepared_by} />
              <DetailRow label="Zatwierdził" value={sel.approved_by} />
              <DetailRow label="Data zatwierdzenia" value={sel.approved_at?.slice(0, 10)} />
            </div>

            {sel.description && (
              <>
                <SectionHeader number="2" label="Opis" />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {sel.description}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      <Modal open={showModal} title="Nowy program audytów" onClose={() => setShowModal(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>Nazwa * <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="np. Program Audytów IT 2026" /></label>
          <label>Rok <input className="form-control" type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} /></label>
          <label>Opis <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></label>
          <label>Przygotował <input className="form-control" value={form.prepared_by} onChange={e => setForm({ ...form, prepared_by: e.target.value })} /></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim()}>Utwórz</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
