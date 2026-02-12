import { useEffect, useMemo, useState } from "react";
import type { VulnerabilityRecord, DictionaryEntry, OrgUnitTreeNode } from "../types";
import Modal from "../components/Modal";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

const API = import.meta.env.VITE_API_URL ?? "";

/* ── helpers ── */
function severityColor(name: string | null): string {
  if (!name) return "var(--text-muted)";
  const n = name.toLowerCase();
  if (n.includes("krytyczny") || n.includes("critical")) return "var(--red)";
  if (n.includes("wysoki") || n.includes("high")) return "var(--orange)";
  if (n.includes("średni") || n.includes("medium") || n.includes("sredni")) return "var(--yellow)";
  if (n.includes("niski") || n.includes("low")) return "var(--green)";
  return "var(--text-muted)";
}
function severityBg(name: string | null): string {
  if (!name) return "transparent";
  const n = name.toLowerCase();
  if (n.includes("krytyczny") || n.includes("critical")) return "var(--red-dim)";
  if (n.includes("wysoki") || n.includes("high")) return "var(--orange-dim)";
  if (n.includes("średni") || n.includes("medium") || n.includes("sredni")) return "var(--yellow-dim)";
  if (n.includes("niski") || n.includes("low")) return "var(--green-dim)";
  return "transparent";
}

function isCriticalOrHigh(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes("krytyczny") || n.includes("critical") || n.includes("wysoki") || n.includes("high");
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "\u2014"}</span>
    </div>
  );
}

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid rgba(59,130,246,0.2)" }}>
      {number} {label}
    </div>
  );
}

const errorBorder = "1px solid var(--red)";
const errorShadow = "0 0 0 3px var(--red-dim)";

const COLUMNS: ColumnDef<VulnerabilityRecord>[] = [
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytuł", format: (r) => r.title },
  { key: "severity_name", header: "Ważność", format: (r) => r.severity_name ?? "" },
  { key: "cvss_score", header: "CVSS", format: (r) => r.cvss_score ?? "" },
  { key: "status_name", header: "Status", format: (r) => r.status_name ?? "" },
  { key: "cve_id", header: "CVE", format: (r) => r.cve_id ?? "" },
  { key: "org_unit_name", header: "Jednostka", format: (r) => r.org_unit_name ?? "" },
  { key: "owner", header: "Właściciel", format: (r) => r.owner ?? "" },
  { key: "detected_at", header: "Wykryto", format: (r) => r.detected_at?.slice(0, 10) ?? "" },
  { key: "sla_deadline", header: "SLA", format: (r) => r.sla_deadline?.slice(0, 10) ?? "" },
  { key: "source_name", header: "Źródło", format: (r) => r.source_name ?? "", defaultVisible: false },
  { key: "asset_name", header: "Aktywo", format: (r) => r.asset_name ?? "", defaultVisible: false },
  { key: "category_name", header: "Kategoria", format: (r) => r.category_name ?? "", defaultVisible: false },
  { key: "remediation_priority_name", header: "Priorytet naprawy", format: (r) => r.remediation_priority_name ?? "", defaultVisible: false },
  { key: "cvss_vector", header: "Wektor CVSS", format: (r) => r.cvss_vector ?? "", defaultVisible: false },
  { key: "closed_at", header: "Zamknięto", format: (r) => r.closed_at?.slice(0, 10) ?? "", defaultVisible: false },
  { key: "created_by", header: "Utworzył", format: (r) => r.created_by ?? "", defaultVisible: false },
  { key: "created_at", header: "Utworzono", format: (r) => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
];

export default function VulnerabilitiesPage() {
  const [vulns, setVulns] = useState<VulnerabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<VulnerabilityRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const [orgUnits, setOrgUnits] = useState<OrgUnitTreeNode[]>([]);
  const [severities, setSeverities] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [sources, setSources] = useState<DictionaryEntry[]>([]);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [priorities, setPriorities] = useState<DictionaryEntry[]>([]);

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "vulns");

  const [showFilters, setShowFilters] = useState(false);

  const table = useTableFeatures<VulnerabilityRecord>({
    data: vulns,
    storageKey: "vulns",
    defaultSort: "detected_at",
    defaultSortDir: "desc",
  });

  // Form
  const [form, setForm] = useState({
    title: "", description: "",
    source_id: null as number | null, org_unit_id: null as number | null,
    category_id: null as number | null, severity_id: null as number | null,
    cvss_score: null as number | null, cve_id: "",
    status_id: null as number | null, remediation_priority_id: null as number | null,
    owner: "", detected_at: new Date().toISOString().slice(0, 10), sla_deadline: "",
    created_by: "",
  });

  const resetForm = () => { setForm({ title: "", description: "", source_id: null, org_unit_id: null, category_id: null, severity_id: null, cvss_score: null, cve_id: "", status_id: null, remediation_priority_id: null, owner: "", detected_at: new Date().toISOString().slice(0, 10), sla_deadline: "", created_by: "" }); setTried(false); };

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [vRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/vulnerabilities`),
        fetch(`${API}/api/v1/org-units/tree`),
      ]);
      if (vRes.ok) setVulns(await vRes.json()); else setError(`API ${vRes.status}`);
      if (ouRes.ok) setOrgUnits(await ouRes.json());
      for (const [code, setter] of [
        ["severity_universal", setSeverities], ["vuln_status", setStatuses],
        ["vuln_source", setSources], ["vuln_category", setCategories],
        ["remediation_priority", setPriorities],
      ] as const) {
        const r = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (r.ok) { const d = await r.json(); (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []); }
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  async function handleCreate() {
    setTried(true);
    if (!form.title || !form.org_unit_id || !form.owner || !form.detected_at) return;
    setSaving(true);
    try {
      const body = { ...form, cvss_score: form.cvss_score || null, cve_id: form.cve_id || null, sla_deadline: form.sla_deadline || null, created_by: form.created_by || null };
      const r = await fetch(`${API}/api/v1/vulnerabilities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { setShowForm(false); resetForm(); loadAll(); } else alert("Blad zapisu: " + (await r.text()));
    } catch (e) { alert("Blad: " + e); }
    setSaving(false);
  }

  async function handleArchive(id: number) {
    if (!confirm("Archiwizowac podatnosc?")) return;
    await fetch(`${API}/api/v1/vulnerabilities/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    loadAll();
  }

  // Stats — computed from both filtered and total data
  const statsCards = useMemo((): StatCard[] => {
    const countCritHigh = (list: VulnerabilityRecord[]) =>
      list.filter(v => isCriticalOrHigh(v.severity_name)).length;
    const countOpen = (list: VulnerabilityRecord[]) =>
      list.filter(v => !v.closed_at).length;
    const avgCvss = (list: VulnerabilityRecord[]) => {
      const withScore = list.filter(v => v.cvss_score != null);
      if (withScore.length === 0) return "\u2014";
      return (withScore.reduce((s, v) => s + (v.cvss_score ?? 0), 0) / withScore.length).toFixed(1);
    };

    return [
      {
        label: "Podatności",
        value: table.filteredCount,
        total: table.totalCount,
        color: "var(--blue)",
      },
      {
        label: "Krytycznych / Wysokich",
        value: countCritHigh(table.filtered),
        total: countCritHigh(vulns),
        color: countCritHigh(table.filtered) > 0 ? "var(--red)" : "var(--green)",
      },
      {
        label: "Otwartych",
        value: countOpen(table.filtered),
        total: countOpen(vulns),
        color: countOpen(table.filtered) > 0 ? "var(--orange)" : "var(--green)",
      },
      {
        label: "Średni CVSS",
        value: avgCvss(table.filtered),
        total: avgCvss(vulns),
        color: "var(--purple)",
      },
    ];
  }, [vulns, table.filtered, table.filteredCount, table.totalCount]);

  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  const isFiltered = table.filteredCount !== table.totalCount;

  return (
    <div>
      {/* Stats */}
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      <TableToolbar
        filteredCount={table.filteredCount} totalCount={table.totalCount} unitLabel="podatnosci"
        search={table.search} onSearchChange={table.setSearch} searchPlaceholder="Szukaj (tytul, CVE, ref)..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters} onClearFilters={table.clearAllFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={table.filtered} exportFilename="podatnosci"
        primaryLabel="Nowa podatnosc" onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        <DataTable<VulnerabilityRecord>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={(r) => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={(r) => setSelected(selected?.id === r.id ? null : r)}
          rowBorderColor={(r) => severityColor(r.severity_name)}
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
          emptyMessage="Brak podatnosci w systemie."
          emptyFilteredMessage="Brak podatnosci pasujacych do filtrow."
          renderCell={(row, colKey) => {
            if (colKey === "ref_id") {
              return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{row.ref_id}</span>;
            }
            if (colKey === "title") {
              return <span style={{ fontWeight: 500 }}>{row.title}</span>;
            }
            if (colKey === "severity_name") {
              return row.severity_name
                ? <span className="score-badge" style={{ background: severityBg(row.severity_name), color: severityColor(row.severity_name) }}>{row.severity_name}</span>
                : "\u2014";
            }
            if (colKey === "cvss_score") {
              return <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{row.cvss_score != null ? row.cvss_score.toFixed(1) : "\u2014"}</span>;
            }
            if (colKey === "status_name") {
              return <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{row.status_name ?? "\u2014"}</span>;
            }
            if (colKey === "cve_id") {
              return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{row.cve_id ?? "\u2014"}</span>;
            }
            if (colKey === "sla_deadline") {
              const overdue = row.sla_deadline && new Date(row.sla_deadline) < new Date();
              return (
                <span style={{ fontSize: 12, color: overdue ? "var(--red)" : undefined, fontWeight: overdue ? 600 : undefined }}>
                  {row.sla_deadline?.slice(0, 10) ?? "\u2014"}{overdue ? " !" : ""}
                </span>
              );
            }
            return undefined;
          }}
        />

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly Podatnosci</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>
            {selected.severity_name && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span className="score-badge" style={{ background: severityBg(selected.severity_name), color: severityColor(selected.severity_name), fontSize: 14, padding: "6px 16px" }}>{selected.severity_name}</span>
                {selected.cvss_score != null && <div style={{ marginTop: 4, fontSize: 20, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: severityColor(selected.severity_name) }}>CVSS {selected.cvss_score.toFixed(1)}</div>}
              </div>
            )}
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={"\u2460"} label="Dane podatnosci" />
              <DetailRow label="Ref" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.ref_id}</span>} />
              <DetailRow label="Tytul" value={<strong>{selected.title}</strong>} />
              <DetailRow label="CVE" value={selected.cve_id} />
              <DetailRow label="Kategoria" value={selected.category_name} />
              <DetailRow label="Zrodlo" value={selected.source_name} />
              <SectionHeader number={"\u2461"} label="Przypisanie" />
              <DetailRow label="Jednostka" value={selected.org_unit_name} />
              <DetailRow label="Wlasciciel" value={selected.owner} />
              <DetailRow label="Priorytet" value={selected.remediation_priority_name} />
              <SectionHeader number={"\u2462"} label="Status i daty" />
              <DetailRow label="Status" value={selected.status_name ? <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{selected.status_name}</span> : "\u2014"} />
              <DetailRow label="Wykryto" value={selected.detected_at} />
              <DetailRow label="SLA" value={selected.sla_deadline} color={selected.sla_deadline && new Date(selected.sla_deadline) < new Date() ? "var(--red)" : undefined} />
              {selected.description && (
                <>
                  <SectionHeader number={"\u2463"} label="Opis" />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset)", borderRadius: 6, padding: 8 }}>{selected.description}</div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <button className="btn btn-sm" style={{ flex: 1, color: "var(--red)" }} onClick={() => { handleArchive(selected.id); setSelected(null); }}>Archiwizuj</button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowa podatnosc" wide>
        <SectionHeader number={"\u2460"} label="Dane podstawowe" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "span 3" }}>
            <label>Tytul *</label>
            <input className="form-control" style={fieldErr(!!form.title)} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Nazwa podatnosci" />
            {tried && !form.title && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Jednostka org. *</label>
            <OrgUnitTreeSelect
              tree={orgUnits}
              value={form.org_unit_id}
              onChange={id => setForm({ ...form, org_unit_id: id })}
              placeholder="-- wybierz --"
              allowClear={false}
              style={fieldErr(!!form.org_unit_id)}
            />
            {tried && !form.org_unit_id && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Wlasciciel remediacji *</label>
            <input className="form-control" style={fieldErr(!!form.owner)} value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
            {tried && !form.owner && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Data wykrycia *</label>
            <input className="form-control" type="date" style={fieldErr(!!form.detected_at)} value={form.detected_at} onChange={e => setForm({ ...form, detected_at: e.target.value })} />
            {tried && !form.detected_at && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
        </div>

        <SectionHeader number={"\u2461"} label="Klasyfikacja" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Zrodlo</label>
            <select className="form-control" value={form.source_id ?? ""} onChange={e => setForm({ ...form, source_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">-- brak --</option>
              {sources.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Kategoria</label>
            <select className="form-control" value={form.category_id ?? ""} onChange={e => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">-- brak --</option>
              {categories.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Waznosc</label>
            <select className="form-control" value={form.severity_id ?? ""} onChange={e => setForm({ ...form, severity_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">-- brak --</option>
              {severities.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>CVSS</label>
            <input className="form-control" type="number" step="0.1" min="0" max="10" value={form.cvss_score ?? ""} onChange={e => setForm({ ...form, cvss_score: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="form-group">
            <label>CVE ID</label>
            <input className="form-control" value={form.cve_id} onChange={e => setForm({ ...form, cve_id: e.target.value })} placeholder="CVE-20XX-XXXXX" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={form.status_id ?? ""} onChange={e => setForm({ ...form, status_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">-- brak --</option>
              {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Priorytet</label>
            <select className="form-control" value={form.remediation_priority_id ?? ""} onChange={e => setForm({ ...form, remediation_priority_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">-- brak --</option>
              {priorities.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Termin SLA</label>
            <input className="form-control" type="date" value={form.sla_deadline} onChange={e => setForm({ ...form, sla_deadline: e.target.value })} />
          </div>
        </div>

        <SectionHeader number={"\u2462"} label="Opis" />
        <div className="form-group">
          <label>Opis</label>
          <textarea className="form-control" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleCreate}>
            {saving ? "Zapisywanie..." : "Zapisz podatnosc"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
