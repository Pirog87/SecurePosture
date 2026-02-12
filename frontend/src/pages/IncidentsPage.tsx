import { useEffect, useMemo, useState } from "react";
import type { IncidentRecord, DictionaryEntry, OrgUnitTreeNode } from "../types";
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

function formatTTR(minutes: number | null) {
  if (minutes === null) return "\u2014";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

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

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "\u2014"}</span>
    </div>
  );
}

const errorBorder = "1px solid var(--red)";
const errorShadow = "0 0 0 3px var(--red-dim)";

type SortField = "ref_id" | "title" | "category_name" | "severity_name" | "status_name" | "org_unit_name" | "assigned_to" | "reported_at" | "ttr_minutes" | "personal_data_breach";
type SortDir = "asc" | "desc";

const COLUMNS: ColumnDef<IncidentRecord>[] = [
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytul", format: (r) => r.title },
  { key: "category_name", header: "Kategoria", format: (r) => r.category_name ?? "" },
  { key: "severity_name", header: "Waznosc", format: (r) => r.severity_name ?? "" },
  { key: "status_name", header: "Status", format: (r) => r.status_name ?? "" },
  { key: "org_unit_name", header: "Jednostka", format: (r) => r.org_unit_name ?? "" },
  { key: "assigned_to", header: "Przypisany", format: (r) => r.assigned_to ?? "" },
  { key: "reported_at", header: "Zgloszono", format: (r) => r.reported_at?.slice(0, 16).replace("T", " ") ?? "" },
  { key: "ttr_minutes", header: "TTR", format: (r) => formatTTR(r.ttr_minutes) },
  { key: "personal_data_breach", header: "RODO", format: (r) => r.personal_data_breach ? "TAK" : "NIE" },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<IncidentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const [orgUnits, setOrgUnits] = useState<OrgUnitTreeNode[]>([]);
  const [severities, setSeverities] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [impacts, setImpacts] = useState<DictionaryEntry[]>([]);

  // Search, sort, filter
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("reported_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterOrg, setFilterOrg] = useState("");

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "incidents");

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: null as number | null,
    severity_id: null as number | null,
    org_unit_id: null as number | null,
    reported_by: "",
    assigned_to: "",
    status_id: null as number | null,
    reported_at: new Date().toISOString().slice(0, 16),
    impact_id: null as number | null,
    personal_data_breach: false,
    authority_notification: false,
  });

  const resetForm = () => {
    setForm({
      title: "", description: "",
      category_id: null, severity_id: null, org_unit_id: null,
      reported_by: "", assigned_to: "", status_id: null,
      reported_at: new Date().toISOString().slice(0, 16),
      impact_id: null, personal_data_breach: false, authority_notification: false,
    });
    setTried(false);
  };

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [iRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/incidents`),
        fetch(`${API}/api/v1/org-units/tree`),
      ]);
      if (iRes.ok) setIncidents(await iRes.json()); else setError(`API ${iRes.status}`);
      if (ouRes.ok) setOrgUnits(await ouRes.json());

      for (const [code, setter] of [
        ["severity_universal", setSeverities],
        ["incident_status", setStatuses],
        ["incident_category", setCategories],
        ["incident_impact", setImpacts],
      ] as const) {
        const r = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (r.ok) {
          const data = await r.json();
          (setter as (v: DictionaryEntry[]) => void)(data.entries ?? []);
        }
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  async function handleCreate() {
    setTried(true);
    if (!form.title || !form.org_unit_id || !form.reported_by || !form.assigned_to || !form.description || !form.reported_at) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        reported_at: new Date(form.reported_at).toISOString(),
      };
      const r = await fetch(`${API}/api/v1/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) { setShowForm(false); resetForm(); loadAll(); } else alert("Blad zapisu: " + (await r.text()));
    } catch (e) { alert("Blad: " + e); }
    setSaving(false);
  }

  async function handleArchive(id: number) {
    if (!confirm("Archiwizowac incydent?")) return;
    await fetch(`${API}/api/v1/incidents/${id}`, { method: "DELETE" });
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
    let result = [...incidents];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i =>
        (i.title ?? "").toLowerCase().includes(s) ||
        (i.ref_id ?? "").toLowerCase().includes(s) ||
        (i.reported_by ?? "").toLowerCase().includes(s) ||
        (i.assigned_to ?? "").toLowerCase().includes(s)
      );
    }
    if (filterStatus) result = result.filter(i => i.status_id === Number(filterStatus));
    if (filterSeverity) result = result.filter(i => i.severity_id === Number(filterSeverity));
    if (filterOrg) result = result.filter(i => (i.org_unit_name ?? "").toLowerCase().includes(filterOrg.toLowerCase()));

    result.sort((a, b) => {
      const av = (a as any)[sortField];
      const bv = (b as any)[sortField];
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = 1;
      else if (bv == null) cmp = -1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else if (typeof av === "boolean" && typeof bv === "boolean") cmp = (av ? 1 : 0) - (bv ? 1 : 0);
      else cmp = String(av).localeCompare(String(bv), "pl");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [incidents, search, filterStatus, filterSeverity, filterOrg, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const total = incidents.length;
    const criticalHigh = incidents.filter(i => {
      const n = (i.severity_name ?? "").toLowerCase();
      return n.includes("krytyczny") || n.includes("critical") || n.includes("wysoki") || n.includes("high");
    }).length;
    const rodo = incidents.filter(i => i.personal_data_breach).length;
    const withTtr = incidents.filter(i => i.ttr_minutes != null);
    const avgTtr = withTtr.length > 0
      ? formatTTR(Math.round(withTtr.reduce((s, i) => s + (i.ttr_minutes ?? 0), 0) / withTtr.length))
      : "\u2014";
    return { total, criticalHigh, rodo, avgTtr };
  }, [incidents]);

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
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Aktywnych incydentow</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.criticalHigh > 0 ? "var(--red)" : "var(--green)" }}>{stats.criticalHigh}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Krytycznych / Wysokich</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.rodo > 0 ? "var(--red)" : "var(--green)" }}>{stats.rodo}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Naruszen RODO</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{stats.avgTtr}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sredni TTR</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      <TableToolbar
        filteredCount={filtered.length} totalCount={incidents.length} unitLabel="incydentow"
        search={search} onSearchChange={setSearch} searchPlaceholder="Szukaj (tytul, ref, osoba)..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={hasFilters} onClearFilters={clearFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={filtered} exportFilename="incydenty"
        primaryLabel="Nowy incydent" onPrimaryAction={() => { resetForm(); setShowForm(true); }}
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
        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {incidents.length === 0 ? "Brak incydentow w systemie." : "Brak incydentow pasujacych do filtrow."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {visibleCols.has("ref_id") && <SortTh field="ref_id" label="Ref" />}
                  {visibleCols.has("title") && <SortTh field="title" label="Tytul" />}
                  {visibleCols.has("category_name") && <SortTh field="category_name" label="Kategoria" />}
                  {visibleCols.has("severity_name") && <SortTh field="severity_name" label="Waznosc" />}
                  {visibleCols.has("status_name") && <SortTh field="status_name" label="Status" />}
                  {visibleCols.has("org_unit_name") && <SortTh field="org_unit_name" label="Jednostka" />}
                  {visibleCols.has("assigned_to") && <SortTh field="assigned_to" label="Przypisany" />}
                  {visibleCols.has("reported_at") && <SortTh field="reported_at" label="Zgloszono" />}
                  {visibleCols.has("ttr_minutes") && <SortTh field="ttr_minutes" label="TTR" />}
                  {visibleCols.has("personal_data_breach") && <SortTh field="personal_data_breach" label="RODO" />}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr
                    key={i.id}
                    style={{
                      cursor: "pointer",
                      borderLeft: i.severity_name ? `3px solid ${severityColor(i.severity_name)}` : undefined,
                      background: selected?.id === i.id ? "var(--bg-card-hover)" : undefined,
                    }}
                    onClick={() => setSelected(selected?.id === i.id ? null : i)}
                  >
                    {visibleCols.has("ref_id") && <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{i.ref_id}</td>}
                    {visibleCols.has("title") && <td style={{ fontWeight: 500 }}>{i.title}</td>}
                    {visibleCols.has("category_name") && <td style={{ fontSize: 12 }}>{i.category_name ?? "\u2014"}</td>}
                    {visibleCols.has("severity_name") && (
                      <td>
                        {i.severity_name ? (
                          <span className="score-badge" style={{ background: severityBg(i.severity_name), color: severityColor(i.severity_name) }}>
                            {i.severity_name}
                          </span>
                        ) : "\u2014"}
                      </td>
                    )}
                    {visibleCols.has("status_name") && (
                      <td>
                        <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
                          {i.status_name ?? "\u2014"}
                        </span>
                      </td>
                    )}
                    {visibleCols.has("org_unit_name") && <td style={{ fontSize: 12 }}>{i.org_unit_name}</td>}
                    {visibleCols.has("assigned_to") && <td style={{ fontSize: 12 }}>{i.assigned_to}</td>}
                    {visibleCols.has("reported_at") && <td style={{ fontSize: 12 }}>{i.reported_at?.slice(0, 16).replace("T", " ")}</td>}
                    {visibleCols.has("ttr_minutes") && <td style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{formatTTR(i.ttr_minutes)}</td>}
                    {visibleCols.has("personal_data_breach") && (
                      <td>{i.personal_data_breach ? <span style={{ color: "var(--red)", fontWeight: 600 }}>TAK</span> : "\u2014"}</td>
                    )}
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm btn-danger" onClick={() => handleArchive(i.id)} title="Archiwizuj" style={{ fontSize: 11 }}>
                        Archiwizuj
                      </button>
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
              <div className="card-title" style={{ margin: 0 }}>Szczegoly Incydentu</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            {/* Severity display */}
            {selected.severity_name && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Waznosc
                </div>
                <span className="score-badge" style={{
                  background: severityBg(selected.severity_name),
                  color: severityColor(selected.severity_name),
                  fontSize: 14, padding: "6px 16px",
                }}>
                  {selected.severity_name}
                </span>
              </div>
            )}

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={"\u2460"} label="Dane incydentu" />
              <DetailRow label="Ref" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.ref_id}</span>} />
              <DetailRow label="Tytul" value={<strong>{selected.title}</strong>} />
              <DetailRow label="Kategoria" value={selected.category_name} />
              <DetailRow label="Jednostka" value={selected.org_unit_name} />
              <DetailRow label="Zglaszajacy" value={selected.reported_by} />
              <DetailRow label="Przypisany" value={selected.assigned_to} />

              <SectionHeader number={"\u2461"} label="Status i wplyw" />
              <DetailRow label="Status" value={
                selected.status_name ? (
                  <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{selected.status_name}</span>
                ) : "\u2014"
              } />
              <DetailRow label="Wplyw" value={selected.impact_name} />
              <DetailRow label="TTR" value={formatTTR(selected.ttr_minutes)} />
              <DetailRow label="RODO" value={selected.personal_data_breach ? <span style={{ color: "var(--red)", fontWeight: 600 }}>TAK</span> : "NIE"} />
              <DetailRow label="UODO/CERT" value={selected.authority_notification ? <span style={{ color: "var(--orange)", fontWeight: 600 }}>TAK</span> : "NIE"} />

              <SectionHeader number={"\u2462"} label="Daty" />
              <DetailRow label="Zgloszono" value={selected.reported_at?.slice(0, 16).replace("T", " ")} />
              {selected.detected_at && <DetailRow label="Wykryto" value={selected.detected_at.slice(0, 16).replace("T", " ")} />}
              {selected.closed_at && <DetailRow label="Zamknieto" value={selected.closed_at.slice(0, 16).replace("T", " ")} />}

              {selected.description && (
                <>
                  <SectionHeader number={"\u2463"} label="Opis" />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.description}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid rgba(42,53,84,0.25)", paddingTop: 12 }}>
              <button
                className="btn btn-sm"
                style={{ flex: 1, color: "var(--red)" }}
                onClick={() => { handleArchive(selected.id); setSelected(null); }}
              >
                Archiwizuj
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowy incydent bezpieczenstwa" wide>
        <SectionHeader number={"\u2460"} label="Dane podstawowe" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Tytul incydentu *</label>
            <input className="form-control" style={fieldErr(!!form.title)} value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              placeholder="Krotki opis incydentu" />
            {tried && !form.title && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Jednostka organizacyjna *</label>
            <OrgUnitTreeSelect
              tree={orgUnits}
              value={form.org_unit_id}
              onChange={id => setForm({...form, org_unit_id: id})}
              placeholder="Wybierz..."
              allowClear={false}
              style={fieldErr(!!form.org_unit_id)}
            />
            {tried && !form.org_unit_id && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Kategoria</label>
            <select className="form-control" value={form.category_id ?? ""} onChange={e => setForm({...form, category_id: e.target.value ? Number(e.target.value) : null})}>
              <option value="">Brak</option>
              {categories.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Zglaszajacy *</label>
            <input className="form-control" style={fieldErr(!!form.reported_by)} value={form.reported_by} onChange={e => setForm({...form, reported_by: e.target.value})}
              placeholder="Imie i nazwisko" />
            {tried && !form.reported_by && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Przypisany do *</label>
            <input className="form-control" style={fieldErr(!!form.assigned_to)} value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}
              placeholder="Imie i nazwisko" />
            {tried && !form.assigned_to && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
        </div>

        <SectionHeader number={"\u2461"} label="Klasyfikacja" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Waznosc</label>
            <select className="form-control" value={form.severity_id ?? ""} onChange={e => setForm({...form, severity_id: e.target.value ? Number(e.target.value) : null})}>
              <option value="">Brak</option>
              {severities.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={form.status_id ?? ""} onChange={e => setForm({...form, status_id: e.target.value ? Number(e.target.value) : null})}>
              <option value="">Brak</option>
              {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Wplyw</label>
            <select className="form-control" value={form.impact_id ?? ""} onChange={e => setForm({...form, impact_id: e.target.value ? Number(e.target.value) : null})}>
              <option value="">Brak</option>
              {impacts.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <SectionHeader number={"\u2462"} label="Data i RODO" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Data zgloszenia *</label>
            <input className="form-control" type="datetime-local" style={fieldErr(!!form.reported_at)} value={form.reported_at} onChange={e => setForm({...form, reported_at: e.target.value})} />
            {tried && !form.reported_at && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group" style={{ display: "flex", gap: 20, alignItems: "flex-end", paddingBottom: 16 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={form.personal_data_breach} onChange={e => setForm({...form, personal_data_breach: e.target.checked})}
                style={{ width: 16, height: 16, accentColor: "var(--red)" }} />
              <span style={{ fontSize: 12, color: form.personal_data_breach ? "var(--red)" : "var(--text-secondary)", fontWeight: form.personal_data_breach ? 600 : 400 }}>RODO</span>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={form.authority_notification} onChange={e => setForm({...form, authority_notification: e.target.checked})}
                style={{ width: 16, height: 16, accentColor: "var(--orange)" }} />
              <span style={{ fontSize: 12, color: form.authority_notification ? "var(--orange)" : "var(--text-secondary)", fontWeight: form.authority_notification ? 600 : 400 }}>Zgloszenie UODO/CERT</span>
            </label>
          </div>
        </div>

        <SectionHeader number={"\u2463"} label="Opis" />
        <div className="form-group">
          <label>Opis incydentu *</label>
          <textarea className="form-control" rows={3} style={fieldErr(!!form.description)} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Szczegolowy opis incydentu, okolicznosci, przebieg..." />
          {tried && !form.description && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={handleCreate}
          >
            {saving ? "Zapisywanie..." : "Zapisz incydent"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
