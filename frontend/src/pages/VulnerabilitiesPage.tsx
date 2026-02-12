import { useEffect, useMemo, useState } from "react";
import type { VulnerabilityRecord, DictionaryEntry, OrgUnitTreeNode } from "../types";
import Modal from "../components/Modal";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";

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

type SortField = "ref_id" | "title" | "severity_name" | "cvss_score" | "status_name" | "org_unit_name" | "owner" | "detected_at" | "sla_deadline";
type SortDir = "asc" | "desc";

const COLUMNS: ColumnDef<VulnerabilityRecord>[] = [
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytul", format: (r) => r.title },
  { key: "severity_name", header: "Waznosc", format: (r) => r.severity_name ?? "" },
  { key: "cvss_score", header: "CVSS", format: (r) => r.cvss_score ?? "" },
  { key: "status_name", header: "Status", format: (r) => r.status_name ?? "" },
  { key: "cve_id", header: "CVE", format: (r) => r.cve_id ?? "" },
  { key: "org_unit_name", header: "Jednostka", format: (r) => r.org_unit_name ?? "" },
  { key: "owner", header: "Wlasciciel", format: (r) => r.owner ?? "" },
  { key: "detected_at", header: "Wykryto", format: (r) => r.detected_at ?? "" },
  { key: "sla_deadline", header: "SLA", format: (r) => r.sla_deadline ?? "" },
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

  // Search, sort, filter
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("detected_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterOrg, setFilterOrg] = useState("");

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "vulns");

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

  // Sort helper
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const hasFilters = !!filterStatus || !!filterSeverity || !!filterOrg;
  const clearFilters = () => { setFilterStatus(""); setFilterSeverity(""); setFilterOrg(""); };

  const filtered = useMemo(() => {
    let result = [...vulns];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(v =>
        (v.title ?? "").toLowerCase().includes(s) ||
        (v.ref_id ?? "").toLowerCase().includes(s) ||
        (v.cve_id ?? "").toLowerCase().includes(s) ||
        (v.owner ?? "").toLowerCase().includes(s)
      );
    }
    if (filterStatus) result = result.filter(v => v.status_id === Number(filterStatus));
    if (filterSeverity) result = result.filter(v => v.severity_id === Number(filterSeverity));
    if (filterOrg) result = result.filter(v => (v.org_unit_name ?? "").toLowerCase().includes(filterOrg.toLowerCase()));

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
  }, [vulns, search, filterStatus, filterSeverity, filterOrg, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const total = vulns.length;
    const critical = vulns.filter(v => {
      const n = (v.severity_name ?? "").toLowerCase();
      return n.includes("krytyczny") || n.includes("critical");
    }).length;
    const overdueSla = vulns.filter(v => v.sla_deadline && new Date(v.sla_deadline) < new Date()).length;
    const avgCvss = vulns.filter(v => v.cvss_score != null).length > 0
      ? (vulns.reduce((s, v) => s + (v.cvss_score ?? 0), 0) / vulns.filter(v => v.cvss_score != null).length).toFixed(1)
      : "\u2014";
    return { total, critical, overdueSla, avgCvss };
  }, [vulns]);

  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => handleSort(field)}>
      {label}
      {sortField === field && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  return (
    <div>
      {/* Stats */}
      <div className="grid-4">
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)" }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Aktywnych podatnosci</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.critical > 0 ? "var(--red)" : "var(--green)" }}>{stats.critical}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Krytycznych</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.overdueSla > 0 ? "var(--red)" : "var(--green)" }}>{stats.overdueSla}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Przeterminowanych SLA</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{stats.avgCvss}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sredni CVSS</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      <TableToolbar
        filteredCount={filtered.length} totalCount={vulns.length} unitLabel="podatnosci"
        search={search} onSearchChange={setSearch} searchPlaceholder="Szukaj (tytul, CVE, ref)..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={hasFilters} onClearFilters={clearFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={filtered} exportFilename="podatnosci"
        primaryLabel="Nowa podatnosc" onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {showFilters && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Wszystkie statusy</option>
            {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
            <option value="">Wszystkie waznosci</option>
            {severities.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <input className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            placeholder="Jednostka org." value={filterOrg} onChange={e => setFilterOrg(e.target.value)} />
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {vulns.length === 0 ? "Brak podatnosci w systemie." : "Brak podatnosci pasujacych do filtrow."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {visibleCols.has("ref_id") && <SortTh field="ref_id" label="Ref" />}
                  {visibleCols.has("title") && <SortTh field="title" label="Tytul" />}
                  {visibleCols.has("severity_name") && <SortTh field="severity_name" label="Waznosc" />}
                  {visibleCols.has("cvss_score") && <SortTh field="cvss_score" label="CVSS" />}
                  {visibleCols.has("status_name") && <SortTh field="status_name" label="Status" />}
                  {visibleCols.has("cve_id") && <th>CVE</th>}
                  {visibleCols.has("org_unit_name") && <SortTh field="org_unit_name" label="Jednostka" />}
                  {visibleCols.has("owner") && <SortTh field="owner" label="Wlasciciel" />}
                  {visibleCols.has("detected_at") && <SortTh field="detected_at" label="Wykryto" />}
                  {visibleCols.has("sla_deadline") && <SortTh field="sla_deadline" label="SLA" />}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id}
                    style={{ cursor: "pointer", borderLeft: `3px solid ${severityColor(v.severity_name)}`, background: selected?.id === v.id ? "var(--bg-card-hover)" : undefined }}
                    onClick={() => setSelected(selected?.id === v.id ? null : v)}
                  >
                    {visibleCols.has("ref_id") && <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{v.ref_id}</td>}
                    {visibleCols.has("title") && <td style={{ fontWeight: 500 }}>{v.title}</td>}
                    {visibleCols.has("severity_name") && <td>{v.severity_name ? <span className="score-badge" style={{ background: severityBg(v.severity_name), color: severityColor(v.severity_name) }}>{v.severity_name}</span> : "\u2014"}</td>}
                    {visibleCols.has("cvss_score") && <td style={{ fontFamily: "'JetBrains Mono',monospace" }}>{v.cvss_score != null ? v.cvss_score.toFixed(1) : "\u2014"}</td>}
                    {visibleCols.has("status_name") && <td><span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{v.status_name ?? "\u2014"}</span></td>}
                    {visibleCols.has("cve_id") && <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{v.cve_id ?? "\u2014"}</td>}
                    {visibleCols.has("org_unit_name") && <td style={{ fontSize: 12 }}>{v.org_unit_name}</td>}
                    {visibleCols.has("owner") && <td style={{ fontSize: 12 }}>{v.owner}</td>}
                    {visibleCols.has("detected_at") && <td style={{ fontSize: 12 }}>{v.detected_at}</td>}
                    {visibleCols.has("sla_deadline") && <td style={{ fontSize: 12, color: v.sla_deadline && new Date(v.sla_deadline) < new Date() ? "var(--red)" : undefined, fontWeight: v.sla_deadline && new Date(v.sla_deadline) < new Date() ? 600 : undefined }}>{v.sla_deadline ?? "\u2014"}{v.sla_deadline && new Date(v.sla_deadline) < new Date() ? " !" : ""}</td>}
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm btn-danger" onClick={() => handleArchive(v.id)} style={{ fontSize: 11 }}>Archiwizuj</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>{selected.description}</div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid rgba(42,53,84,0.25)", paddingTop: 12 }}>
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
