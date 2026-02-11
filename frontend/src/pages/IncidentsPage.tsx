import { useEffect, useState } from "react";
import type { IncidentRecord, DictionaryEntry, OrgUnit } from "../types";

const API = import.meta.env.VITE_API_URL ?? "";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [severities, setSeverities] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [impacts, setImpacts] = useState<DictionaryEntry[]>([]);

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

  useEffect(() => {
    loadAll();
  }, []);

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
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...form,
      reported_at: new Date(form.reported_at).toISOString(),
    };
    const r = await fetch(`${API}/api/v1/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      setShowForm(false);
      loadAll();
    }
  }

  async function handleArchive(id: number) {
    if (!confirm("Archiwizować incydent?")) return;
    await fetch(`${API}/api/v1/incidents/${id}`, { method: "DELETE" });
    loadAll();
  }

  const filtered = incidents.filter((i) => {
    if (filterStatus && i.status_id !== Number(filterStatus)) return false;
    if (filterSeverity && i.severity_id !== Number(filterSeverity)) return false;
    return true;
  });

  const severityColor = (name: string | null) => {
    if (!name) return "";
    const n = name.toLowerCase();
    if (n.includes("krytyczny") || n.includes("critical")) return "color: #dc2626; font-weight: bold";
    if (n.includes("wysoki") || n.includes("high")) return "color: #ea580c; font-weight: bold";
    if (n.includes("średni") || n.includes("medium")) return "color: #d97706";
    if (n.includes("niski") || n.includes("low")) return "color: #65a30d";
    return "color: #6b7280";
  };

  function formatTTR(minutes: number | null) {
    if (minutes === null) return "—";
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  }

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Rejestr Incydentów</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Anuluj" : "+ Nowy incydent"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label>Tytuł *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label>Jednostka org. *</label>
              <select required value={form.org_unit_id ?? ""} onChange={(e) => setForm({ ...form, org_unit_id: Number(e.target.value) })}>
                <option value="">-- wybierz --</option>
                {orgUnits.map((ou) => <option key={ou.id} value={ou.id}>{ou.name}</option>)}
              </select>
            </div>
            <div>
              <label>Zgłaszający *</label>
              <input required value={form.reported_by} onChange={(e) => setForm({ ...form, reported_by: e.target.value })} />
            </div>
            <div>
              <label>Przypisany do *</label>
              <input required value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
            </div>
            <div>
              <label>Kategoria</label>
              <select value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-- brak --</option>
                {categories.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label>Ważność</label>
              <select value={form.severity_id ?? ""} onChange={(e) => setForm({ ...form, severity_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-- brak --</option>
                {severities.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={form.status_id ?? ""} onChange={(e) => setForm({ ...form, status_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-- brak --</option>
                {statuses.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label>Wpływ</label>
              <select value={form.impact_id ?? ""} onChange={(e) => setForm({ ...form, impact_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-- brak --</option>
                {impacts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label>Data zgłoszenia *</label>
              <input type="datetime-local" required value={form.reported_at} onChange={(e) => setForm({ ...form, reported_at: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="checkbox" checked={form.personal_data_breach} onChange={(e) => setForm({ ...form, personal_data_breach: e.target.checked })} />
                RODO
              </label>
              <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="checkbox" checked={form.authority_notification} onChange={(e) => setForm({ ...form, authority_notification: e.target.checked })} />
                Zgłoszenie UODO/CERT
              </label>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Opis *</label>
            <textarea rows={2} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Utwórz</button>
        </form>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Wszystkie statusy</option>
          {statuses.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
          <option value="">Wszystkie ważności</option>
          {severities.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <span style={{ color: "#9ca3af", alignSelf: "center" }}>
          {filtered.length} / {incidents.length} incydentów
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Tytuł</th>
            <th>Kategoria</th>
            <th>Ważność</th>
            <th>Status</th>
            <th>Jednostka</th>
            <th>Przypisany</th>
            <th>Zgłoszono</th>
            <th>TTR</th>
            <th>RODO</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((i) => (
            <tr key={i.id}>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{i.ref_id}</td>
              <td>{i.title}</td>
              <td>{i.category_name ?? "—"}</td>
              <td><span style={{ cssText: severityColor(i.severity_name) }}>{i.severity_name ?? "—"}</span></td>
              <td>{i.status_name ?? "—"}</td>
              <td>{i.org_unit_name}</td>
              <td>{i.assigned_to}</td>
              <td>{i.reported_at?.slice(0, 16).replace("T", " ")}</td>
              <td>{formatTTR(i.ttr_minutes)}</td>
              <td>{i.personal_data_breach ? "⚠️" : "—"}</td>
              <td>
                <button className="btn btn-sm" onClick={() => handleArchive(i.id)} title="Archiwizuj">🗑</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={11} style={{ textAlign: "center", color: "#9ca3af" }}>Brak incydentów</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
