import { useEffect, useMemo, useState } from "react";
import type { DictionaryEntry, OrgUnitTreeNode } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

const API = import.meta.env.VITE_API_URL ?? "";

/* ── local types ── */

interface AuditRecord {
  id: number;
  ref_id: string | null;
  title: string;
  audit_type_name: string | null;
  framework: string | null;
  auditor: string;
  org_unit_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  overall_rating_name: string | null;
  findings_count: number;
}

interface FindingRecord {
  id: number;
  ref_id: string | null;
  title: string;
  finding_type_name: string | null;
  severity_name: string | null;
  status_name: string | null;
  remediation_owner: string | null;
  sla_deadline: string | null;
}

/* ── helpers ── */

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase",
      letterSpacing: "0.05em", marginTop: 16, marginBottom: 8, paddingBottom: 4,
      borderBottom: "1px solid rgba(59,130,246,0.2)",
    }}>
      {number} {label}
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "in_progress": return "var(--orange)";
    case "completed": return "var(--green)";
    case "cancelled": return "var(--text-muted)";
    default: return "var(--blue)";
  }
}

function statusBg(status: string): string {
  switch (status) {
    case "in_progress": return "var(--orange-dim)";
    case "completed": return "var(--green-dim)";
    case "cancelled": return "transparent";
    default: return "var(--blue-dim)";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "planned": return "Planowany";
    case "in_progress": return "W trakcie";
    case "completed": return "Zakończony";
    case "cancelled": return "Anulowany";
    default: return status;
  }
}

const errorBorder = "1px solid var(--red)";
const errorShadow = "0 0 0 3px var(--red-dim)";

/* ── column definitions ── */

const COLUMNS: ColumnDef<AuditRecord>[] = [
  { key: "id", header: "ID", format: r => String(r.id), defaultVisible: false },
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytul", format: (r) => r.title },
  { key: "audit_type_name", header: "Typ", format: (r) => r.audit_type_name ?? "" },
  { key: "framework", header: "Framework", format: (r) => r.framework ?? "" },
  { key: "auditor", header: "Audytor", format: (r) => r.auditor },
  { key: "org_unit_name", header: "Jednostka", format: (r) => r.org_unit_name ?? "" },
  { key: "status", header: "Status", format: (r) => statusLabel(r.status) },
  { key: "start_date", header: "Rozpoczecie", format: (r) => r.start_date ?? "" },
  { key: "end_date", header: "Zakończenie", format: (r) => r.end_date ?? "" },
  { key: "overall_rating_name", header: "Ocena", format: (r) => r.overall_rating_name ?? "" },
  { key: "findings_count", header: "Findings", format: (r) => r.findings_count },
];

/* ═══════════════════════════════════════════════════════════════════
   AuditsPage
   ═══════════════════════════════════════════════════════════════════ */

export default function AuditsPage() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const [orgUnits, setOrgUnits] = useState<OrgUnitTreeNode[]>([]);
  const [auditTypes, setAuditTypes] = useState<DictionaryEntry[]>([]);
  const [, setRatings] = useState<DictionaryEntry[]>([]);

  const [expandedAudit, setExpandedAudit] = useState<number | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "audits");

  const [showFilters, setShowFilters] = useState(false);

  const table = useTableFeatures<AuditRecord>({
    data: audits,
    storageKey: "audits",
    defaultSort: "start_date",
    defaultSortDir: "desc",
  });

  // Form state
  const [form, setForm] = useState({
    title: "",
    auditor: "",
    framework: "",
    audit_type_id: null as number | null,
    org_unit_id: null as number | null,
    status: "planned",
    start_date: "",
    end_date: "",
  });

  const resetForm = () => {
    setForm({
      title: "", auditor: "", framework: "",
      audit_type_id: null, org_unit_id: null,
      status: "planned", start_date: "", end_date: "",
    });
    setTried(false);
  };

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [aRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/audits`),
        fetch(`${API}/api/v1/org-units/tree`),
      ]);
      if (aRes.ok) setAudits(await aRes.json()); else setError(`API ${aRes.status}`);
      if (ouRes.ok) setOrgUnits(await ouRes.json());

      for (const [code, setter] of [
        ["audit_type", setAuditTypes],
        ["audit_rating", setRatings],
      ] as const) {
        const dr = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (dr.ok) {
          const d = await dr.json();
          (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []);
        }
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  async function handleCreate() {
    setTried(true);
    if (!form.title || !form.auditor) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        framework: form.framework || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      const r = await fetch(`${API}/api/v1/audits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setShowForm(false);
        resetForm();
        loadAll();
      } else {
        alert("Blad zapisu: " + (await r.text()));
      }
    } catch (e) {
      alert("Blad: " + e);
    }
    setSaving(false);
  }

  async function loadFindings(auditId: number) {
    if (expandedAudit === auditId) {
      setExpandedAudit(null);
      return;
    }
    setExpandedAudit(auditId);
    try {
      const r = await fetch(`${API}/api/v1/audits/${auditId}/findings`);
      if (r.ok) setFindings(await r.json());
      else setFindings([]);
    } catch {
      setFindings([]);
    }
  }

  // Validation helper
  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  /* ── Dynamic stats ── */
  const isFiltered = table.filteredCount !== table.totalCount;
  const statsCards: StatCard[] = useMemo(() => {
    const src = table.filtered;
    const inProgressF = src.filter(a => a.status === "in_progress").length;
    const completedF = src.filter(a => a.status === "completed").length;
    const avgFindingsF = src.length > 0 ? src.reduce((s, a) => s + a.findings_count, 0) / src.length : 0;
    const inProgressT = audits.filter(a => a.status === "in_progress").length;
    const completedT = audits.filter(a => a.status === "completed").length;
    const avgFindingsT = audits.length > 0 ? audits.reduce((s, a) => s + a.findings_count, 0) / audits.length : 0;
    return [
      { label: "Wszystkich audytów", value: src.length, total: audits.length, color: "var(--blue)" },
      { label: "W trakcie", value: inProgressF, total: inProgressT, color: "var(--orange)" },
      { label: "Zakończonych", value: completedF, total: completedT, color: "var(--green)" },
      { label: "Średnia findings", value: avgFindingsF.toFixed(1), total: avgFindingsT.toFixed(1), color: "var(--purple)" },
    ];
  }, [table.filtered, audits]);

  return (
    <div>
      {/* Error state */}
      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      {/* Statistics cards */}
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      {/* Toolbar: search, filters toggle, column picker, export, primary action */}
      <TableToolbar
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="audytow"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj (tytul, ref, audytor, framework)..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="audyty"
        primaryLabel="Nowy audyt"
        onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* Main table */}
      <DataTable<AuditRecord>
        columns={COLUMNS}
        visibleColumns={visibleCols}
        data={table.pageData}
        rowKey={r => r.id}
        selectedKey={expandedAudit}
        onRowClick={r => loadFindings(r.id)}
        rowBorderColor={r => statusColor(r.status)}
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
        emptyMessage="Brak audytow w systemie."
        emptyFilteredMessage="Brak audytow pasujacych do filtrow."
        renderCell={(r, key) => {
          if (key === "status") return (
            <span className="score-badge" style={{ background: statusBg(r.status), color: statusColor(r.status) }}>
              {statusLabel(r.status)}
            </span>
          );
          if (key === "findings_count") return (
            <span style={{
              fontWeight: r.findings_count > 0 ? 700 : undefined,
              fontFamily: "'JetBrains Mono',monospace",
              color: r.findings_count > 0 ? "var(--red)" : undefined,
            }}>
              {r.findings_count}
            </span>
          );
          if (key === "overall_rating_name") return r.overall_rating_name ? (
            <span style={{ color: "var(--blue)", fontWeight: 500 }}>{r.overall_rating_name}</span>
          ) : (
            <span>{"\u2014"}</span>
          );
          return undefined;
        }}
      />

      {/* Expanded findings sub-table */}
      {expandedAudit != null && (
        <div className="card" style={{ marginTop: 0, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: "8px 16px" }}>
          <strong style={{ fontSize: 12 }}>Findings ({findings.length}):</strong>
          {findings.length === 0 && (
            <p style={{ color: "var(--text-muted)", margin: "4px 0", fontSize: 12 }}>Brak findingów</p>
          )}
          {findings.length > 0 && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Tytul</th>
                  <th>Typ</th>
                  <th>Waznosc</th>
                  <th>Status</th>
                  <th>Wlasciciel</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {findings.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{f.ref_id ?? "\u2014"}</td>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{f.title}</td>
                    <td style={{ fontSize: 12 }}>{f.finding_type_name ?? "\u2014"}</td>
                    <td style={{ fontSize: 12 }}>{f.severity_name ?? "\u2014"}</td>
                    <td style={{ fontSize: 12 }}>{f.status_name ?? "\u2014"}</td>
                    <td style={{ fontSize: 12 }}>{f.remediation_owner ?? "\u2014"}</td>
                    <td style={{
                      fontSize: 12,
                      color: f.sla_deadline && new Date(f.sla_deadline) < new Date() ? "var(--red)" : undefined,
                      fontWeight: f.sla_deadline && new Date(f.sla_deadline) < new Date() ? 600 : undefined,
                    }}>
                      {f.sla_deadline ?? "\u2014"}
                      {f.sla_deadline && new Date(f.sla_deadline) < new Date() ? " !" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowy audyt" wide>
        <SectionHeader number={"\u2460"} label="Dane podstawowe" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Tytul *</label>
            <input
              className="form-control"
              style={fieldErr(!!form.title)}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Nazwa audytu"
            />
            {tried && !form.title && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Audytor *</label>
            <input
              className="form-control"
              style={fieldErr(!!form.auditor)}
              value={form.auditor}
              onChange={e => setForm({ ...form, auditor: e.target.value })}
              placeholder="Imie i nazwisko"
            />
            {tried && !form.auditor && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Typ audytu</label>
            <select
              className="form-control"
              value={form.audit_type_id ?? ""}
              onChange={e => setForm({ ...form, audit_type_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">-- brak --</option>
              {auditTypes.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Framework</label>
            <input
              className="form-control"
              value={form.framework}
              onChange={e => setForm({ ...form, framework: e.target.value })}
              placeholder="np. ISO 27001"
            />
          </div>
          <div className="form-group">
            <label>Jednostka org.</label>
            <OrgUnitTreeSelect
              tree={orgUnits}
              value={form.org_unit_id}
              onChange={id => setForm({ ...form, org_unit_id: id })}
              placeholder="-- brak --"
              allowClear
            />
          </div>
        </div>

        <SectionHeader number={"\u2461"} label="Status i daty" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Status</label>
            <select
              className="form-control"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              <option value="planned">Planowany</option>
              <option value="in_progress">W trakcie</option>
              <option value="completed">Zakończony</option>
              <option value="cancelled">Anulowany</option>
            </select>
          </div>
          <div className="form-group">
            <label>Data rozpoczecia</label>
            <input
              className="form-control"
              type="date"
              value={form.start_date}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Data zakonczenia</label>
            <input
              className="form-control"
              type="date"
              value={form.end_date}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleCreate}>
            {saving ? "Zapisywanie..." : "Utworz audyt"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
