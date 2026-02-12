import { useEffect, useMemo, useState } from "react";
import type { DictionaryEntry, OrgUnitTreeNode } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";

const API = import.meta.env.VITE_API_URL ?? "";

/* ── interfaces ── */
interface CampaignRecord {
  id: number;
  ref_id: string | null;
  title: string;
  campaign_type_name: string | null;
  org_unit_name: string | null;
  target_audience_count: number;
  start_date: string | null;
  end_date: string | null;
  status_name: string | null;
  owner: string | null;
  is_active: boolean;
}

interface ResultRecord {
  id: number;
  campaign_id: number;
  org_unit_name: string | null;
  participants_count: number;
  completed_count: number;
  failed_count: number;
  reported_count: number;
  completion_rate: number | null;
  click_rate: number | null;
  report_rate: number | null;
  avg_score: number | null;
}

/* ── helpers ── */
function statusColor(name: string | null): string {
  if (!name) return "var(--text-muted)";
  const n = name.toLowerCase();
  if (n.includes("planowana") || n.includes("planned")) return "#6b7280";
  if (n.includes("w trakcie") || n.includes("in_progress") || n.includes("in progress")) return "#2563eb";
  if (n.includes("zakonczona") || n.includes("zakończona") || n.includes("completed")) return "#16a34a";
  return "var(--text-muted)";
}

function statusBg(name: string | null): string {
  if (!name) return "transparent";
  const n = name.toLowerCase();
  if (n.includes("planowana") || n.includes("planned")) return "rgba(107,114,128,0.15)";
  if (n.includes("w trakcie") || n.includes("in_progress") || n.includes("in progress")) return "var(--blue-dim)";
  if (n.includes("zakonczona") || n.includes("zakończona") || n.includes("completed")) return "var(--green-dim)";
  return "transparent";
}

function isActiveStatus(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes("w trakcie") || n.includes("in_progress") || n.includes("in progress");
}

function isCompletedStatus(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes("zakonczona") || n.includes("zakończona") || n.includes("completed");
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

/* ── sorting ── */
type SortField = "ref_id" | "title" | "campaign_type_name" | "org_unit_name" | "status_name" | "target_audience_count" | "start_date" | "end_date" | "owner";
type SortDir = "asc" | "desc";

/* ── column definitions ── */
const COLUMNS: ColumnDef<CampaignRecord>[] = [
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytul", format: (r) => r.title },
  { key: "campaign_type_name", header: "Typ", format: (r) => r.campaign_type_name ?? "" },
  { key: "org_unit_name", header: "Jednostka", format: (r) => r.org_unit_name ?? "Cala org." },
  { key: "status_name", header: "Status", format: (r) => r.status_name ?? "" },
  { key: "target_audience_count", header: "Uczestnicy", format: (r) => r.target_audience_count },
  { key: "start_date", header: "Start", format: (r) => r.start_date ?? "" },
  { key: "end_date", header: "Koniec", format: (r) => r.end_date ?? "" },
  { key: "owner", header: "Wlasciciel", format: (r) => r.owner ?? "" },
];

export default function AwarenessPage() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, ResultRecord[]>>({});
  const [selected, setSelected] = useState<CampaignRecord | null>(null);

  // Dictionaries & org units
  const [types, setTypes] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitTreeNode[]>([]);

  // Search, sort, filter
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("start_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "awareness");

  // Form state
  const emptyForm = {
    title: "", description: "",
    campaign_type_id: null as number | null,
    org_unit_id: null as number | null,
    target_audience_count: 0,
    start_date: "", end_date: "",
    status_id: null as number | null,
    owner: "", content_url: "",
  };
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => { setForm({ ...emptyForm }); setTried(false); };

  /* ── data loading ── */
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/awareness-campaigns`),
        fetch(`${API}/api/v1/org-units/tree`),
      ]);
      if (cRes.ok) setCampaigns(await cRes.json()); else setError(`API ${cRes.status}`);
      if (ouRes.ok) setOrgUnits(await ouRes.json());
      for (const [code, setter] of [
        ["campaign_type", setTypes],
        ["campaign_status", setStatuses],
      ] as const) {
        const dr = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (dr.ok) { const d = await dr.json(); (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []); }
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  async function loadResults(campId: number) {
    if (results[campId]) { setExpandedId(expandedId === campId ? null : campId); return; }
    try {
      const r = await fetch(`${API}/api/v1/awareness-campaigns/${campId}/results`);
      if (r.ok) {
        const data = await r.json();
        setResults(prev => ({ ...prev, [campId]: data }));
      }
    } catch { /* ignore */ }
    setExpandedId(campId);
  }

  async function handleCreate() {
    setTried(true);
    if (!form.title) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        content_url: form.content_url || null,
        owner: form.owner || null,
      };
      const r = await fetch(`${API}/api/v1/awareness-campaigns`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (r.ok) { setShowForm(false); resetForm(); loadAll(); } else alert("Blad zapisu: " + (await r.text()));
    } catch (e) { alert("Blad: " + e); }
    setSaving(false);
  }

  /* ── sorting ── */
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const hasFilters = !!filterStatus || !!filterType;
  const clearFilters = () => { setFilterStatus(""); setFilterType(""); };

  /* ── filtering + sorting ── */
  const filtered = useMemo(() => {
    let result = [...campaigns];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        (c.title ?? "").toLowerCase().includes(s) ||
        (c.ref_id ?? "").toLowerCase().includes(s) ||
        (c.owner ?? "").toLowerCase().includes(s) ||
        (c.campaign_type_name ?? "").toLowerCase().includes(s) ||
        (c.org_unit_name ?? "").toLowerCase().includes(s)
      );
    }
    if (filterStatus) result = result.filter(c => {
      const entry = statuses.find(d => String(d.id) === filterStatus);
      return entry ? c.status_name === entry.label : false;
    });
    if (filterType) result = result.filter(c => {
      const entry = types.find(d => String(d.id) === filterType);
      return entry ? c.campaign_type_name === entry.label : false;
    });

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
  }, [campaigns, search, filterStatus, filterType, statuses, types, sortField, sortDir]);

  /* ── statistics ── */
  const stats = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter(c => isActiveStatus(c.status_name)).length;
    const completed = campaigns.filter(c => isCompletedStatus(c.status_name)).length;

    // Average completion rate from loaded results
    const allResults = Object.values(results).flat();
    const ratesWithValues = allResults.filter(r => r.completion_rate != null);
    const avgCompletion = ratesWithValues.length > 0
      ? (ratesWithValues.reduce((s, r) => s + (r.completion_rate ?? 0), 0) / ratesWithValues.length).toFixed(1)
      : "\u2014";

    return { total, active, completed, avgCompletion };
  }, [campaigns, results]);

  /* ── sort header component ── */
  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => handleSort(field)}>
      {label}
      {sortField === field && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  return (
    <div>
      {/* ── Statistics Cards ── */}
      <div className="grid-4">
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)" }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Kampanii ogolnie</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.active > 0 ? "#2563eb" : "var(--text-muted)" }}>{stats.active}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Aktywnych / W trakcie</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.completed > 0 ? "#16a34a" : "var(--text-muted)" }}>{stats.completed}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zakonczonych</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{stats.avgCompletion}{stats.avgCompletion !== "\u2014" ? "%" : ""}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sredni % ukonczenia</div>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      {/* ── Toolbar ── */}
      <TableToolbar
        filteredCount={filtered.length} totalCount={campaigns.length} unitLabel="kampanii"
        search={search} onSearchChange={setSearch} searchPlaceholder="Szukaj (tytul, ref, wlasciciel)..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={hasFilters} onClearFilters={clearFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={filtered} exportFilename="awareness_campaigns"
        primaryLabel="Nowa kampania" onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* ── Collapsible filters ── */}
      {showFilters && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Wszystkie statusy</option>
            {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Wszystkie typy</option>
            {types.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      )}

      {/* ── Main grid with detail panel ── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {campaigns.length === 0 ? "Brak kampanii w systemie." : "Brak kampanii pasujacych do filtrow."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {visibleCols.has("ref_id") && <SortTh field="ref_id" label="Ref" />}
                  {visibleCols.has("title") && <SortTh field="title" label="Tytul" />}
                  {visibleCols.has("campaign_type_name") && <SortTh field="campaign_type_name" label="Typ" />}
                  {visibleCols.has("org_unit_name") && <SortTh field="org_unit_name" label="Jednostka" />}
                  {visibleCols.has("status_name") && <SortTh field="status_name" label="Status" />}
                  {visibleCols.has("target_audience_count") && <SortTh field="target_audience_count" label="Uczestnicy" />}
                  {visibleCols.has("start_date") && <SortTh field="start_date" label="Start" />}
                  {visibleCols.has("end_date") && <SortTh field="end_date" label="Koniec" />}
                  {visibleCols.has("owner") && <SortTh field="owner" label="Wlasciciel" />}
                  <th style={{ width: 70 }}>Wyniki</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <>
                    <tr key={c.id}
                      style={{
                        cursor: "pointer",
                        borderLeft: `3px solid ${statusColor(c.status_name)}`,
                        background: selected?.id === c.id ? "var(--bg-card-hover)" : undefined,
                      }}
                      onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    >
                      {visibleCols.has("ref_id") && (
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{c.ref_id ?? "\u2014"}</td>
                      )}
                      {visibleCols.has("title") && (
                        <td style={{ fontWeight: 500 }}>{c.title}</td>
                      )}
                      {visibleCols.has("campaign_type_name") && (
                        <td style={{ fontSize: 12 }}>{c.campaign_type_name ?? "\u2014"}</td>
                      )}
                      {visibleCols.has("org_unit_name") && (
                        <td style={{ fontSize: 12 }}>{c.org_unit_name ?? "Cala org."}</td>
                      )}
                      {visibleCols.has("status_name") && (
                        <td>
                          {c.status_name ? (
                            <span className="score-badge" style={{ background: statusBg(c.status_name), color: statusColor(c.status_name) }}>
                              {c.status_name}
                            </span>
                          ) : "\u2014"}
                        </td>
                      )}
                      {visibleCols.has("target_audience_count") && (
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{c.target_audience_count}</td>
                      )}
                      {visibleCols.has("start_date") && (
                        <td style={{ fontSize: 12 }}>{c.start_date ?? "\u2014"}</td>
                      )}
                      {visibleCols.has("end_date") && (
                        <td style={{ fontSize: 12 }}>{c.end_date ?? "\u2014"}</td>
                      )}
                      {visibleCols.has("owner") && (
                        <td style={{ fontSize: 12 }}>{c.owner ?? "\u2014"}</td>
                      )}
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => loadResults(c.id)} style={{ fontSize: 11 }}>
                          {expandedId === c.id ? "Zwin" : "Pokaz"}
                        </button>
                      </td>
                    </tr>

                    {/* ── Expandable results sub-table ── */}
                    {expandedId === c.id && results[c.id] && (
                      <tr key={`res-${c.id}`}>
                        <td colSpan={COLUMNS.length + 1} style={{ padding: 0 }}>
                          <div style={{ margin: "8px 12px 12px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
                            <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--blue)", background: "rgba(59,130,246,0.06)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Wyniki kampanii: {c.title}
                            </div>
                            {results[c.id].length === 0 ? (
                              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Brak wynikow</div>
                            ) : (
                              <table className="data-table" style={{ margin: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Jednostka</th>
                                    <th>Uczestnicy</th>
                                    <th>Ukonczone</th>
                                    <th>Nie zdalo</th>
                                    <th>Zglosilo</th>
                                    <th>Ukonczenie %</th>
                                    <th>Click rate %</th>
                                    <th>Report rate %</th>
                                    <th>Sr. wynik</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {results[c.id].map(r => (
                                    <tr key={r.id}>
                                      <td style={{ fontSize: 12 }}>{r.org_unit_name ?? "\u2014"}</td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{r.participants_count}</td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{r.completed_count}</td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: r.failed_count > 0 ? "var(--red)" : undefined }}>{r.failed_count}</td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{r.reported_count}</td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                                        {r.completion_rate != null ? (
                                          <span style={{ color: r.completion_rate >= 80 ? "#16a34a" : r.completion_rate >= 50 ? "#ca8a04" : "var(--red)" }}>
                                            {r.completion_rate}%
                                          </span>
                                        ) : "\u2014"}
                                      </td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: r.click_rate != null && r.click_rate > 20 ? "#dc2626" : undefined }}>
                                        {r.click_rate != null ? `${r.click_rate}%` : "\u2014"}
                                      </td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                                        {r.report_rate != null ? `${r.report_rate}%` : "\u2014"}
                                      </td>
                                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>
                                        {r.avg_score != null ? r.avg_score : "\u2014"}
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
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Detail Panel ── */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly kampanii</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            {selected.status_name && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span className="score-badge" style={{ background: statusBg(selected.status_name), color: statusColor(selected.status_name), fontSize: 14, padding: "6px 16px" }}>
                  {selected.status_name}
                </span>
              </div>
            )}

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={"\u2460"} label="Dane kampanii" />
              <DetailRow label="Ref" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.ref_id}</span>} />
              <DetailRow label="Tytul" value={<strong>{selected.title}</strong>} />
              <DetailRow label="Typ" value={selected.campaign_type_name} />
              <DetailRow label="Jednostka" value={selected.org_unit_name ?? "Cala org."} />

              <SectionHeader number={"\u2461"} label="Uczestnicy i daty" />
              <DetailRow label="Uczestnicy" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.target_audience_count}</span>} />
              <DetailRow label="Data startu" value={selected.start_date} />
              <DetailRow label="Data konca" value={selected.end_date} />
              <DetailRow label="Wlasciciel" value={selected.owner} />

              <SectionHeader number={"\u2462"} label="Status" />
              <DetailRow
                label="Status"
                value={selected.status_name ? <span className="score-badge" style={{ background: statusBg(selected.status_name), color: statusColor(selected.status_name) }}>{selected.status_name}</span> : "\u2014"}
              />
              <DetailRow label="Aktywna" value={selected.is_active ? "Tak" : "Nie"} color={selected.is_active ? "#16a34a" : "var(--text-muted)"} />

              {/* Show results summary in detail panel */}
              {results[selected.id] && results[selected.id].length > 0 && (
                <>
                  <SectionHeader number={"\u2463"} label="Podsumowanie wynikow" />
                  {results[selected.id].map(r => (
                    <div key={r.id} style={{ marginBottom: 8, padding: "6px 8px", borderRadius: 6, background: "var(--bg-inset)" }}>
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>{r.org_unit_name ?? "Cala org."}</div>
                      <DetailRow label="Ukonczenie" value={r.completion_rate != null ? `${r.completion_rate}%` : "\u2014"} color={r.completion_rate != null && r.completion_rate >= 80 ? "#16a34a" : r.completion_rate != null && r.completion_rate < 50 ? "var(--red)" : undefined} />
                      <DetailRow label="Click rate" value={r.click_rate != null ? `${r.click_rate}%` : "\u2014"} color={r.click_rate != null && r.click_rate > 20 ? "#dc2626" : undefined} />
                      <DetailRow label="Sr. wynik" value={r.avg_score != null ? String(r.avg_score) : "\u2014"} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowa kampania awareness" wide>
        <SectionHeader number={"\u2460"} label="Dane podstawowe" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "span 3" }}>
            <label>Tytul *</label>
            <input className="form-control" style={fieldErr(!!form.title)} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Nazwa kampanii" />
            {tried && !form.title && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Typ kampanii</label>
            <select className="form-control" value={form.campaign_type_id ?? ""} onChange={e => setForm({ ...form, campaign_type_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">-- brak --</option>
              {types.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Jednostka org.</label>
            <OrgUnitTreeSelect
              tree={orgUnits}
              value={form.org_unit_id}
              onChange={id => setForm({ ...form, org_unit_id: id })}
              placeholder="-- cala org. --"
              allowClear
            />
          </div>
          <div className="form-group">
            <label>Wlasciciel</label>
            <input className="form-control" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="Osoba odpowiedzialna" />
          </div>
        </div>

        <SectionHeader number={"\u2461"} label="Uczestnicy i terminy" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Liczba uczestnikow</label>
            <input className="form-control" type="number" min={0} value={form.target_audience_count} onChange={e => setForm({ ...form, target_audience_count: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>Data rozpoczecia</label>
            <input className="form-control" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Data konca</label>
            <input className="form-control" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={form.status_id ?? ""} onChange={e => setForm({ ...form, status_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">-- brak --</option>
              {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>URL materialow</label>
            <input className="form-control" value={form.content_url} onChange={e => setForm({ ...form, content_url: e.target.value })} placeholder="https://..." />
          </div>
        </div>

        <SectionHeader number={"\u2462"} label="Opis" />
        <div className="form-group">
          <label>Opis kampanii</label>
          <textarea className="form-control" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Opcjonalny opis kampanii..." />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleCreate}>
            {saving ? "Zapisywanie..." : "Utworz kampanie"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
