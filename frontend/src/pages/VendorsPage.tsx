import { useEffect, useState } from "react";
import type { DictionaryEntry, OrgUnit } from "../types";

interface VendorRecord {
  id: number;
  ref_id: string | null;
  name: string;
  category_name: string | null;
  criticality_name: string | null;
  status_name: string | null;
  risk_rating_name: string | null;
  risk_score: number | null;
  contract_owner: string | null;
  contract_end: string | null;
  last_assessment_date: string | null;
  next_assessment_date: string | null;
  questionnaire_completed: boolean;
  is_active: boolean;
}

const API = import.meta.env.VITE_API_URL ?? "";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [criticalities, setCriticalities] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [dataAccessLevels, setDataAccessLevels] = useState<DictionaryEntry[]>([]);

  const [form, setForm] = useState({
    name: "", category_id: null as number | null,
    criticality_id: null as number | null, services_provided: "",
    data_access_level_id: null as number | null,
    contract_owner: "", security_contact: "",
    contract_start: "", contract_end: "",
    sla_description: "", status_id: null as number | null,
    certifications: "",
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/vendors`);
      if (r.ok) setVendors(await r.json());
      for (const [code, setter] of [
        ["vendor_category", setCategories],
        ["vendor_status", setStatuses],
        ["asset_criticality", setCriticalities],
        ["vendor_data_access", setDataAccessLevels],
      ] as const) {
        const dr = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (dr.ok) { const d = await dr.json(); (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []); }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...form,
      services_provided: form.services_provided || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      sla_description: form.sla_description || null,
      certifications: form.certifications || null,
    };
    const r = await fetch(`${API}/api/v1/vendors`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) { setShowForm(false); loadAll(); }
  }

  function ratingColor(name: string | null): string | undefined {
    if (!name) return undefined;
    if (name.startsWith("A")) return "#16a34a";
    if (name.startsWith("B")) return "#ca8a04";
    if (name.startsWith("C")) return "#ea580c";
    if (name.startsWith("D")) return "#dc2626";
    return undefined;
  }

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Zarządzanie Dostawcami (TPRM)</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Anuluj" : "+ Nowy dostawca"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label>Nazwa *</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><label>Kategoria</label>
              <select value={form.category_id ?? ""} onChange={e => setForm({...form, category_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{categories.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Krytyczność</label>
              <select value={form.criticality_id ?? ""} onChange={e => setForm({...form, criticality_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{criticalities.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Poziom dostępu do danych</label>
              <select value={form.data_access_level_id ?? ""} onChange={e => setForm({...form, data_access_level_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{dataAccessLevels.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Właściciel umowy</label><input value={form.contract_owner} onChange={e => setForm({...form, contract_owner: e.target.value})} /></div>
            <div><label>Kontakt bezpieczeństwa</label><input value={form.security_contact} onChange={e => setForm({...form, security_contact: e.target.value})} /></div>
            <div><label>Data rozpoczęcia</label><input type="date" value={form.contract_start} onChange={e => setForm({...form, contract_start: e.target.value})} /></div>
            <div><label>Data końca umowy</label><input type="date" value={form.contract_end} onChange={e => setForm({...form, contract_end: e.target.value})} /></div>
            <div><label>Status</label>
              <select value={form.status_id ?? ""} onChange={e => setForm({...form, status_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Opis usług</label>
            <textarea rows={2} value={form.services_provided} onChange={e => setForm({...form, services_provided: e.target.value})} style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Utwórz</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr>
          <th>Ref</th><th>Nazwa</th><th>Kategoria</th><th>Krytyczność</th><th>Status</th>
          <th>Rating</th><th>Wynik</th><th>Koniec umowy</th><th>Ostatnia ocena</th><th>Następna ocena</th>
        </tr></thead>
        <tbody>
          {vendors.map(v => (
            <tr key={v.id}>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{v.ref_id}</td>
              <td>{v.name}</td>
              <td>{v.category_name ?? "—"}</td>
              <td>{v.criticality_name ?? "—"}</td>
              <td>{v.status_name ?? "—"}</td>
              <td style={{ color: ratingColor(v.risk_rating_name), fontWeight: 600 }}>
                {v.risk_rating_name ?? "—"}
              </td>
              <td>{v.risk_score != null ? `${v.risk_score}%` : "—"}</td>
              <td style={{ color: v.contract_end && new Date(v.contract_end) < new Date() ? "#dc2626" : undefined }}>
                {v.contract_end ?? "—"}
              </td>
              <td>{v.last_assessment_date ?? "—"}</td>
              <td style={{ color: v.next_assessment_date && new Date(v.next_assessment_date) < new Date() ? "#dc2626" : undefined }}>
                {v.next_assessment_date ?? "—"}
              </td>
            </tr>
          ))}
          {vendors.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#9ca3af" }}>Brak dostawców</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
