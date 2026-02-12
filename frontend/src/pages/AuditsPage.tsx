import { useEffect, useMemo, useState, Fragment } from "react";
import type { DictionaryEntry, OrgUnitTreeNode } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";

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

/* ── sort types ── */

type SortField = "ref_id" | "title" | "audit_type_name" | "framework" | "auditor" | "org_unit_name" | "status" | "start_date" | "overall_rating_name" | "findings_count";
type SortDir = "asc" | "desc";

/* ── column definitions ── */

const COLUMNS: ColumnDef<AuditRecord>[] = [
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytul", format: (r) => r.title },
  { key: "audit_type_name", header: "Typ", format: (r) => r.audit_type_name ?? "" },
  { key: "framework", header: "Framework", format: (r) => r.framework ?? "" },
  { key: "auditor", header: "Audytor", format: (r) => r.auditor },
  { key: "org_unit_name", header: "Jednostka", format: (r) => r.org_unit_name ?? "" },
  { key: "status", header: "Status", format: (r) => statusLabel(r.status) },
  { key: "start_date", header: "Rozpoczecie", format: (r) => r.start_date ?? "" },
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

  // Search, sort, filter
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("ref_id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "audits");

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

  // Sort helper
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const hasFilters = !!filterStatus || !!filterType;
  const clearFilters = () => { setFilterStatus(""); setFilterType(""); };

  // Filtered & sorted
  const filtered = useMemo(() => {
    let result = [...audits];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(a =>
        (a.title ?? "").toLowerCase().includes(s) ||
        (a.ref_id ?? "").toLowerCase().includes(s) ||
        (a.auditor ?? "").toLowerCase().includes(s) ||
        (a.framework ?? "").toLowerCase().includes(s) ||
        (a.org_unit_name ?? "").toLowerCase().includes(s)
      );
    }

    if (filterStatus) result = result.filter(a => a.status === filterStatus);
    if (filterType) result = result.filter(a => (a.audit_type_name ?? "").toLowerCase().includes(filterType.toLowerCase()));

    result.sort((a, b) => {
      const av = (a as any)[sortField];
      const bv = (b as any)[sortField];
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = 1;
      else if (bv == null) cmp = -1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "pl");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [audits, search, filterStatus, filterType, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const total = audits.length;
    const inProgress = audits.filter(a => a.status === "in_progress").length;
    const completed = audits.filter(a => a.status === "completed").length;
    const totalFindings = audits.reduce((s, a) => s + a.findings_count, 0);
    return { total, inProgress, completed, totalFindings };
  }, [audits]);

  // Sortable header component
  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => handleSort(field)}>
      {label}
      {sortField === field && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  // Validation helper
  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  // Visible column count for colspan
  const visColCount = COLUMNS.filter(c => visibleCols.has(c.key)).length;

  return (
    <div>
      {/* Statistics cards */}
      <div className="grid-4">
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)" }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Wszystkich audytow</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.inProgress > 0 ? "var(--orange)" : "var(--green)" }}>{stats.inProgress}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>W trakcie</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--green)" }}>{stats.completed}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zakonczonych</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.totalFindings > 0 ? "var(--red)" : "var(--green)" }}>{stats.totalFindings}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Lacznie findings</div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      {/* Toolbar: search, filters toggle, column picker, export, primary action */}
      <TableToolbar
        filteredCount={filtered.length}
        totalCount={audits.length}
        unitLabel="audytow"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Szukaj (tytul, ref, audytor, framework)..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={hasFilters}
        onClearFilters={clearFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={filtered}
        exportFilename="audyty"
        primaryLabel="Nowy audyt"
        onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* Collapsible filters */}
      {showFilters && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Wszystkie statusy</option>
            <option value="planned">Planowany</option>
            <option value="in_progress">W trakcie</option>
            <option value="completed">Zakończony</option>
            <option value="cancelled">Anulowany</option>
          </select>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Wszystkie typy</option>
            {auditTypes.map(d => <option key={d.id} value={d.label}>{d.label}</option>)}
          </select>
        </div>
      )}

      {/* Main table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {audits.length === 0 ? "Brak audytow w systemie." : "Brak audytow pasujacych do filtrow."}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {visibleCols.has("ref_id") && <SortTh field="ref_id" label="Ref" />}
                {visibleCols.has("title") && <SortTh field="title" label="Tytul" />}
                {visibleCols.has("audit_type_name") && <SortTh field="audit_type_name" label="Typ" />}
                {visibleCols.has("framework") && <SortTh field="framework" label="Framework" />}
                {visibleCols.has("auditor") && <SortTh field="auditor" label="Audytor" />}
                {visibleCols.has("org_unit_name") && <SortTh field="org_unit_name" label="Jednostka" />}
                {visibleCols.has("status") && <SortTh field="status" label="Status" />}
                {visibleCols.has("start_date") && <SortTh field="start_date" label="Rozpoczecie" />}
                {visibleCols.has("overall_rating_name") && <SortTh field="overall_rating_name" label="Ocena" />}
                {visibleCols.has("findings_count") && <SortTh field="findings_count" label="Findings" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <Fragment key={a.id}>
                  <tr
                    onClick={() => loadFindings(a.id)}
                    style={{
                      cursor: "pointer",
                      borderLeft: `3px solid ${statusColor(a.status)}`,
                      background: expandedAudit === a.id ? "var(--bg-card-hover)" : undefined,
                    }}
                  >
                    {visibleCols.has("ref_id") && (
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{a.ref_id ?? "\u2014"}</td>
                    )}
                    {visibleCols.has("title") && (
                      <td style={{ fontWeight: 500 }}>{a.title}</td>
                    )}
                    {visibleCols.has("audit_type_name") && (
                      <td style={{ fontSize: 12 }}>{a.audit_type_name ?? "\u2014"}</td>
                    )}
                    {visibleCols.has("framework") && (
                      <td style={{ fontSize: 12 }}>{a.framework ?? "\u2014"}</td>
                    )}
                    {visibleCols.has("auditor") && (
                      <td style={{ fontSize: 12 }}>{a.auditor}</td>
                    )}
                    {visibleCols.has("org_unit_name") && (
                      <td style={{ fontSize: 12 }}>{a.org_unit_name ?? "\u2014"}</td>
                    )}
                    {visibleCols.has("status") && (
                      <td>
                        <span className="score-badge" style={{ background: statusBg(a.status), color: statusColor(a.status) }}>
                          {statusLabel(a.status)}
                        </span>
                      </td>
                    )}
                    {visibleCols.has("start_date") && (
                      <td style={{ fontSize: 12 }}>{a.start_date ?? "\u2014"}</td>
                    )}
                    {visibleCols.has("overall_rating_name") && (
                      <td style={{ fontSize: 12 }}>{a.overall_rating_name ?? "\u2014"}</td>
                    )}
                    {visibleCols.has("findings_count") && (
                      <td style={{ fontWeight: a.findings_count > 0 ? 700 : undefined, fontFamily: "'JetBrains Mono',monospace", color: a.findings_count > 0 ? "var(--red)" : undefined }}>
                        {a.findings_count}
                      </td>
                    )}
                  </tr>

                  {/* Expanded findings sub-table */}
                  {expandedAudit === a.id && (
                    <tr>
                      <td colSpan={visColCount} style={{ padding: 0 }}>
                        <div style={{ padding: "8px 16px", background: "rgba(255,255,255,0.02)" }}>
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
