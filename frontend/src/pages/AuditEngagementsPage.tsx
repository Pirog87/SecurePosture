import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

/* ─── Types ─── */
interface Framework {
  id: number;
  name: string;
}

interface AuditEngagement {
  id: number;
  audit_program_id: number | null;
  program_name: string | null;
  ref_id: string;
  name: string;
  framework_id: number;
  framework_name: string;
  scope_type: string;
  scope_name: string | null;
  objective: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  lead_auditor: string;
  supervisor: string | null;
  status: string;
  priority: string;
  tests_count: number;
  findings_count: number;
  created_at: string;
}

/* ─── Helpers ─── */
const STATUS_COLORS: Record<string, string> = {
  planned: "#94a3b8",
  scoping: "var(--purple)",
  fieldwork: "var(--yellow)",
  reporting: "var(--blue)",
  review: "var(--cyan)",
  completed: "var(--green)",
  closed: "#6b7280",
  cancelled: "var(--red)",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Zaplanowane",
  scoping: "Scoping",
  fieldwork: "Fieldwork",
  reporting: "Raportowanie",
  review: "Review",
  completed: "Zakończone",
  closed: "Zamknięte",
  cancelled: "Anulowane",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--blue)",
  low: "var(--green)",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Krytyczny",
  high: "Wysoki",
  medium: "Średni",
  low: "Niski",
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
   AuditEngagementsPage
   ═══════════════════════════════════════════════════════════ */
export default function AuditEngagementsPage() {
  const COLUMNS: ColumnDef<AuditEngagement>[] = [
    { key: "ref_id", header: "Ref", format: r => r.ref_id },
    { key: "name", header: "Nazwa" },
    { key: "framework_name", header: "Framework" },
    { key: "status", header: "Status", format: r => STATUS_LABELS[r.status] || r.status },
    { key: "priority", header: "Priorytet", format: r => PRIORITY_LABELS[r.priority] || r.priority },
    { key: "lead_auditor", header: "Lead Auditor" },
    { key: "planned_start", header: "Plan start", format: r => r.planned_start ?? "" },
    { key: "planned_end", header: "Plan koniec", format: r => r.planned_end ?? "", defaultVisible: false },
    { key: "actual_start", header: "Faktyczny start", format: r => r.actual_start ?? "", defaultVisible: false },
    { key: "actual_end", header: "Faktyczny koniec", format: r => r.actual_end ?? "", defaultVisible: false },
    { key: "scope_type", header: "Scope", format: r => r.scope_type, defaultVisible: false },
    { key: "scope_name", header: "Scope nazwa", format: r => r.scope_name ?? "", defaultVisible: false },
    { key: "supervisor", header: "Supervisor", format: r => r.supervisor ?? "", defaultVisible: false },
    { key: "program_name", header: "Program", format: r => r.program_name ?? "", defaultVisible: false },
    { key: "tests_count", header: "Testy", format: r => String(r.tests_count) },
    { key: "findings_count", header: "Ustalenia", format: r => String(r.findings_count) },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "audit-engagements");

  const [engagements, setEngagements] = useState<AuditEngagement[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditEngagement | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams] = useSearchParams();
  const programId = searchParams.get("program_id");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    framework_id: 0,
    objective: "",
    lead_auditor: "",
    priority: "medium",
    scope_type: "organization",
    scope_name: "",
    planned_start: "",
    planned_end: "",
    audit_program_id: programId ? Number(programId) : null as number | null,
  });

  const table = useTableFeatures<AuditEngagement>({
    data: engagements,
    storageKey: "audit-engagements",
    defaultSort: "created_at",
    defaultSortDir: "desc",
  });

  const load = () => {
    setLoading(true);
    const url = programId
      ? `/api/v1/audit-engagements/?program_id=${programId}`
      : "/api/v1/audit-engagements/";
    Promise.all([
      api.get<AuditEngagement[]>(url),
      api.get<Framework[]>("/api/v1/frameworks/"),
    ])
      .then(([ae, fw]) => {
        setEngagements(ae);
        setFrameworks(fw.filter((f: any) => f.is_active !== false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [programId]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.framework_id || !form.objective.trim() || !form.lead_auditor.trim()) return;
    try {
      const result = await api.post<AuditEngagement>("/api/v1/audit-engagements/", {
        name: form.name,
        framework_id: form.framework_id,
        objective: form.objective,
        lead_auditor: form.lead_auditor,
        priority: form.priority,
        scope_type: form.scope_type,
        scope_name: form.scope_name || null,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        audit_program_id: form.audit_program_id,
      });
      setShowModal(false);
      navigate(`/audit-engagements/${result.id}`);
    } catch {
      alert("Błąd tworzenia zadania");
    }
  };

  /* ── Stats ── */
  const src = table.filtered;
  const active = src.filter(e => !["completed", "closed", "cancelled"].includes(e.status));
  const totalFindings = src.reduce((s, e) => s + e.findings_count, 0);
  const totalTests = src.reduce((s, e) => s + e.tests_count, 0);

  const allActive = engagements.filter(e => !["completed", "closed", "cancelled"].includes(e.status));
  const allFindings = engagements.reduce((s, e) => s + e.findings_count, 0);
  const allTests = engagements.reduce((s, e) => s + e.tests_count, 0);

  const isFiltered = table.filteredCount !== table.totalCount;

  const stats: StatCard[] = [
    { label: "Zadania ogółem", value: src.length, total: engagements.length, color: "var(--blue)" },
    { label: "W toku", value: active.length, total: allActive.length, color: "var(--orange)" },
    { label: "Testy", value: totalTests, total: allTests, color: "var(--purple)" },
    { label: "Ustalenia", value: totalFindings, total: allFindings, color: totalFindings > 0 ? "var(--red)" : "var(--green)" },
  ];

  const sel = selected;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <h2 style={{ margin: "0 0 16px" }}>Zadania Audytowe</h2>

      {programId && (
        <div style={{
          background: "var(--blue-dim)", border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: "var(--radius-sm)", padding: "8px 14px", marginBottom: 12,
          fontSize: 12, color: "var(--blue)", display: "flex", alignItems: "center", gap: 8,
        }}>
          Filtr programu: ID {programId}
          <button className="btn btn-xs" onClick={() => navigate("/audit-engagements")} style={{ marginLeft: "auto" }}>
            Pokaż wszystkie
          </button>
        </div>
      )}

      <StatsCards cards={stats} isFiltered={isFiltered} />

      <TableToolbar<AuditEngagement>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="zadań"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj zadań audytowych..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="audit_engagements"
        primaryLabel="Nowe zadanie"
        onPrimaryAction={() => setShowModal(true)}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14, marginTop: 2 }}>
        <DataTable<AuditEngagement>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
          rowBorderColor={r => {
            return PRIORITY_COLORS[r.priority] || undefined;
          }}
          renderCell={(row, colKey) => {
            if (colKey === "ref_id") {
              return (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>
                  {row.ref_id}
                </span>
              );
            }
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
            if (colKey === "priority") {
              const c = PRIORITY_COLORS[row.priority] || "inherit";
              return <span style={{ color: c, fontWeight: 600, fontSize: 12 }}>{PRIORITY_LABELS[row.priority] || row.priority}</span>;
            }
            if (colKey === "findings_count") {
              return (
                <span style={{
                  color: row.findings_count > 0 ? "var(--red)" : "inherit",
                  fontWeight: row.findings_count > 0 ? 600 : 400,
                }}>
                  {row.findings_count}
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
          emptyMessage="Brak zadań audytowych. Utwórz pierwsze zadanie."
        />

        {/* ── Detail panel ── */}
        {sel && (
          <div className="card" style={{ padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  {sel.ref_id}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{sel.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="badge" style={{
                    backgroundColor: `${STATUS_COLORS[sel.status] || "#94a3b8"}20`,
                    color: STATUS_COLORS[sel.status] || "#94a3b8",
                  }}>
                    {STATUS_LABELS[sel.status] || sel.status}
                  </span>
                  <span className="badge" style={{
                    backgroundColor: `${PRIORITY_COLORS[sel.priority]}20`,
                    color: PRIORITY_COLORS[sel.priority],
                  }}>
                    {PRIORITY_LABELS[sel.priority] || sel.priority}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-xs btn-primary" onClick={() => navigate(`/audit-engagements/${sel.id}`)}>
                  Otwórz
                </button>
                <button className="btn btn-xs" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              <div className="card" style={{ textAlign: "center", padding: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--purple)", fontFamily: "'JetBrains Mono', monospace" }}>{sel.tests_count}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Testów</div>
              </div>
              <div className="card" style={{ textAlign: "center", padding: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: sel.findings_count > 0 ? "var(--red)" : "var(--green)", fontFamily: "'JetBrains Mono', monospace" }}>{sel.findings_count}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Ustaleń</div>
              </div>
            </div>

            <SectionHeader number="1" label="Informacje" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Framework" value={sel.framework_name} />
              <DetailRow label="Scope" value={sel.scope_name || sel.scope_type} />
              <DetailRow label="Lead auditor" value={sel.lead_auditor} />
              {sel.supervisor && <DetailRow label="Supervisor" value={sel.supervisor} />}
              {sel.program_name && <DetailRow label="Program" value={sel.program_name} />}
            </div>

            <SectionHeader number="2" label="Cel audytu" />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
              {sel.objective}
            </div>

            <SectionHeader number="3" label="Harmonogram" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <DetailRow label="Plan start" value={sel.planned_start} />
              <DetailRow label="Plan koniec" value={sel.planned_end} />
              <DetailRow label="Faktyczny start" value={sel.actual_start} />
              <DetailRow label="Faktyczny koniec" value={sel.actual_end} />
            </div>
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      {showModal && (
        <Modal title="Nowe zadanie audytowe" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>Nazwa * <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="np. Audyt ISO 27001 — Dział IT" /></label>
            <label>Framework *
              <select className="form-control" value={form.framework_id} onChange={e => setForm({ ...form, framework_id: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
              </select>
            </label>
            <label>Cel audytu * <textarea className="form-control" value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} rows={2} placeholder="Cel i zakres audytu..." /></label>
            <label>Lead Auditor * <input className="form-control" value={form.lead_auditor} onChange={e => setForm({ ...form, lead_auditor: e.target.value })} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>Priorytet
                <select className="form-control" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Niski</option>
                  <option value="medium">Średni</option>
                  <option value="high">Wysoki</option>
                  <option value="critical">Krytyczny</option>
                </select>
              </label>
              <label>Scope
                <select className="form-control" value={form.scope_type} onChange={e => setForm({ ...form, scope_type: e.target.value })}>
                  <option value="organization">Cała organizacja</option>
                  <option value="org_unit">Jednostka org.</option>
                  <option value="service">Usługa</option>
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>Planowany start <input className="form-control" type="date" value={form.planned_start} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></label>
              <label>Planowany koniec <input className="form-control" type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim() || !form.framework_id || !form.objective.trim() || !form.lead_auditor.trim()}>Utwórz</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
