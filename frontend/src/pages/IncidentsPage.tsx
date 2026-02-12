import { useEffect, useMemo, useState } from "react";
import type { IncidentRecord, DictionaryEntry, OrgUnitTreeNode } from "../types";
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

const COLUMNS: ColumnDef<IncidentRecord>[] = [
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytuł", format: (r) => r.title },
  { key: "category_name", header: "Kategoria", format: (r) => r.category_name ?? "" },
  { key: "severity_name", header: "Ważność", format: (r) => r.severity_name ?? "" },
  { key: "status_name", header: "Status", format: (r) => r.status_name ?? "" },
  { key: "org_unit_name", header: "Jednostka", format: (r) => r.org_unit_name ?? "" },
  { key: "assigned_to", header: "Przypisany", format: (r) => r.assigned_to ?? "" },
  { key: "reported_at", header: "Zgłoszono", format: (r) => r.reported_at?.slice(0, 16).replace("T", " ") ?? "" },
  { key: "ttr_minutes", header: "TTR", format: (r) => formatTTR(r.ttr_minutes) },
  { key: "personal_data_breach", header: "RODO", format: (r) => r.personal_data_breach ? "TAK" : "NIE" },
  { key: "asset_name", header: "Aktywo", format: (r) => r.asset_name ?? "", defaultVisible: false },
  { key: "reported_by", header: "Zgłosił", format: (r) => r.reported_by ?? "", defaultVisible: false },
  { key: "impact_name", header: "Wpływ", format: (r) => r.impact_name ?? "", defaultVisible: false },
  { key: "detected_at", header: "Wykryto", format: (r) => r.detected_at?.slice(0, 16).replace("T", " ") ?? "", defaultVisible: false },
  { key: "closed_at", header: "Zamknięto", format: (r) => r.closed_at?.slice(0, 16).replace("T", " ") ?? "", defaultVisible: false },
  { key: "authority_notification", header: "Powiad. organ", format: (r) => r.authority_notification ? "TAK" : "NIE", defaultVisible: false },
  { key: "created_at", header: "Utworzono", format: (r) => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
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

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "incidents");

  const [showFilters, setShowFilters] = useState(false);

  const table = useTableFeatures<IncidentRecord>({
    data: incidents,
    storageKey: "incidents",
    defaultSort: "reported_at",
    defaultSortDir: "desc",
  });

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

  // Stats
  const statsCards = useMemo((): StatCard[] => {
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

    const filteredData = table.filtered;
    const fTotal = filteredData.length;
    const fCriticalHigh = filteredData.filter(i => {
      const n = (i.severity_name ?? "").toLowerCase();
      return n.includes("krytyczny") || n.includes("critical") || n.includes("wysoki") || n.includes("high");
    }).length;
    const fRodo = filteredData.filter(i => i.personal_data_breach).length;
    const fWithTtr = filteredData.filter(i => i.ttr_minutes != null);
    const fAvgTtr = fWithTtr.length > 0
      ? formatTTR(Math.round(fWithTtr.reduce((s, i) => s + (i.ttr_minutes ?? 0), 0) / fWithTtr.length))
      : "\u2014";

    return [
      { label: "Aktywnych incydentów", value: fTotal, total: total, color: "var(--blue)" },
      { label: "Krytycznych / Wysokich", value: fCriticalHigh, total: criticalHigh, color: criticalHigh > 0 ? "var(--red)" : "var(--green)" },
      { label: "Naruszeń RODO", value: fRodo, total: rodo, color: rodo > 0 ? "var(--red)" : "var(--green)" },
      { label: "Średni TTR", value: fAvgTtr, total: avgTtr, color: "var(--purple)" },
    ];
  }, [incidents, table.filtered]);

  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  const renderCell = (row: IncidentRecord, colKey: string) => {
    if (colKey === "severity_name") {
      return row.severity_name ? (
        <span className="score-badge" style={{ background: severityBg(row.severity_name), color: severityColor(row.severity_name) }}>
          {row.severity_name}
        </span>
      ) : "\u2014";
    }
    if (colKey === "status_name") {
      return (
        <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
          {row.status_name ?? "\u2014"}
        </span>
      );
    }
    if (colKey === "ref_id") {
      return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{row.ref_id}</span>;
    }
    if (colKey === "title") {
      return <span style={{ fontWeight: 500 }}>{row.title}</span>;
    }
    if (colKey === "ttr_minutes") {
      return <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{formatTTR(row.ttr_minutes)}</span>;
    }
    if (colKey === "personal_data_breach") {
      return row.personal_data_breach ? <span style={{ color: "var(--red)", fontWeight: 600 }}>TAK</span> : "\u2014";
    }
    return undefined;
  };

  return (
    <div>
      {/* Stats */}
      <StatsCards cards={statsCards} isFiltered={table.hasActiveFilters || !!table.search} />

      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      <TableToolbar
        filteredCount={table.filteredCount} totalCount={table.totalCount} unitLabel="incydentów"
        search={table.search} onSearchChange={table.setSearch} searchPlaceholder="Szukaj (tytuł, ref, osoba)..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters} onClearFilters={table.clearAllFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={table.filtered} exportFilename="incydenty"
        primaryLabel="Nowy incydent" onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        {/* Table */}
        <DataTable<IncidentRecord>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          renderCell={renderCell}
          onRowClick={(row) => setSelected(selected?.id === row.id ? null : row)}
          rowKey={(row) => row.id}
          selectedKey={selected?.id ?? null}
          rowBorderColor={(row) => row.severity_name ? severityColor(row.severity_name) : undefined}
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
          emptyMessage="Brak incydentów w systemie."
          emptyFilteredMessage="Brak incydentów pasujących do filtrów."
        />

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
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset)", borderRadius: 6, padding: 8 }}>
                    {selected.description}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
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
