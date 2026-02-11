import { useEffect, useState } from "react";
import type { IncidentRecord, DictionaryEntry, OrgUnit } from "../types";
import Modal from "../components/Modal";

const API = import.meta.env.VITE_API_URL ?? "";

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

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [severities, setSeverities] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [impacts, setImpacts] = useState<DictionaryEntry[]>([]);
  const [selected, setSelected] = useState<IncidentRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");

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

  const resetForm = () => setForm({
    title: "", description: "",
    category_id: null, severity_id: null, org_unit_id: null,
    reported_by: "", assigned_to: "", status_id: null,
    reported_at: new Date().toISOString().slice(0, 16),
    impact_id: null, personal_data_breach: false, authority_notification: false,
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [iRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/incidents`),
        fetch(`${API}/api/v1/org-units/flat`),
      ]);
      if (iRes.ok) setIncidents(await iRes.json());
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
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleCreate() {
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
      if (r.ok) { setShowForm(false); resetForm(); loadAll(); }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleArchive(id: number) {
    if (!confirm("Archiwizowac incydent?")) return;
    await fetch(`${API}/api/v1/incidents/${id}`, { method: "DELETE" });
    loadAll();
  }

  const filtered = incidents.filter((i) => {
    if (filterStatus && i.status_id !== Number(filterStatus)) return false;
    if (filterSeverity && i.severity_id !== Number(filterSeverity)) return false;
    return true;
  });

  const canSubmit = form.title && form.org_unit_id && form.reported_by && form.assigned_to && form.description && form.reported_at;

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Wszystkie statusy</option>
            {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select className="form-control" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
            value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            <option value="">Wszystkie waznosci</option>
            {severities.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>
            {filtered.length} / {incidents.length} incydentow
          </span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Nowy incydent</button>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Brak incydentow.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Tytul</th>
                  <th>Kategoria</th>
                  <th>Waznosc</th>
                  <th>Status</th>
                  <th>Jednostka</th>
                  <th>Przypisany</th>
                  <th>Zgloszono</th>
                  <th>TTR</th>
                  <th>RODO</th>
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
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{i.ref_id}</td>
                    <td style={{ fontWeight: 500 }}>{i.title}</td>
                    <td style={{ fontSize: 12 }}>{i.category_name ?? "\u2014"}</td>
                    <td>
                      {i.severity_name ? (
                        <span className="score-badge" style={{ background: severityBg(i.severity_name), color: severityColor(i.severity_name) }}>
                          {i.severity_name}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td>
                      <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
                        {i.status_name ?? "\u2014"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{i.org_unit_name}</td>
                    <td style={{ fontSize: 12 }}>{i.assigned_to}</td>
                    <td style={{ fontSize: 12 }}>{i.reported_at?.slice(0, 16).replace("T", " ")}</td>
                    <td style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{formatTTR(i.ttr_minutes)}</td>
                    <td>{i.personal_data_breach ? <span style={{ color: "var(--red)", fontWeight: 600 }}>TAK</span> : "\u2014"}</td>
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
            <input className="form-control" required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              placeholder="Krotki opis incydentu" />
          </div>
          <div className="form-group">
            <label>Jednostka organizacyjna *</label>
            <select className="form-control" required value={form.org_unit_id ?? ""} onChange={e => setForm({...form, org_unit_id: Number(e.target.value)})}>
              <option value="">Wybierz...</option>
              {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.name}</option>)}
            </select>
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
            <input className="form-control" required value={form.reported_by} onChange={e => setForm({...form, reported_by: e.target.value})}
              placeholder="Imie i nazwisko" />
          </div>
          <div className="form-group">
            <label>Przypisany do *</label>
            <input className="form-control" required value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}
              placeholder="Imie i nazwisko" />
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
            <input className="form-control" type="datetime-local" required value={form.reported_at} onChange={e => setForm({...form, reported_at: e.target.value})} />
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
          <textarea className="form-control" rows={3} required value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Szczegolowy opis incydentu, okolicznosci, przebieg..." />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !canSubmit}
            onClick={handleCreate}
          >
            {saving ? "Zapisywanie..." : "Zapisz incydent"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
