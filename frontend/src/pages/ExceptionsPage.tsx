import { useEffect, useState } from "react";
import type { DictionaryEntry, OrgUnit } from "../types";

interface ExceptionRecord {
  id: number;
  ref_id: string | null;
  title: string;
  policy_title: string | null;
  category_name: string | null;
  org_unit_name: string | null;
  requested_by: string;
  approved_by: string | null;
  risk_level_name: string | null;
  status_name: string | null;
  start_date: string;
  expiry_date: string;
  review_date: string | null;
  compensating_controls: string | null;
  is_active: boolean;
}

const API = import.meta.env.VITE_API_URL ?? "";

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [policies, setPolicies] = useState<{ id: number; title: string }[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [riskLevels, setRiskLevels] = useState<DictionaryEntry[]>([]);

  const [form, setForm] = useState({
    title: "", description: "",
    policy_id: null as number | null,
    category_id: null as number | null,
    org_unit_id: null as number | null,
    requested_by: "", approved_by: "",
    risk_level_id: null as number | null,
    status_id: null as number | null,
    compensating_controls: "",
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [eRes, pRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/exceptions`),
        fetch(`${API}/api/v1/policies`),
        fetch(`${API}/api/v1/org-units/flat`),
      ]);
      if (eRes.ok) setExceptions(await eRes.json());
      if (pRes.ok) { const ps = await pRes.json(); setPolicies(ps.map((p: any) => ({ id: p.id, title: p.title }))); }
      if (ouRes.ok) setOrgUnits(await ouRes.json());

      for (const [code, setter] of [
        ["exception_category", setCategories],
        ["exception_status", setStatuses],
        ["severity_universal", setRiskLevels],
      ] as const) {
        const r = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (r.ok) { const d = await r.json(); (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []); }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...form,
      compensating_controls: form.compensating_controls || null,
      approved_by: form.approved_by || null,
    };
    const r = await fetch(`${API}/api/v1/exceptions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) { setShowForm(false); loadAll(); }
  }

  const today = new Date();
  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 30;
  };
  const isExpired = (d: string | null) => d ? new Date(d) < today : false;

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Rejestr Wyjątków od Polityk</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Anuluj" : "+ Nowy wyjątek"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label>Tytuł *</label><input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div><label>Polityka *</label>
              <select required value={form.policy_id ?? ""} onChange={e => setForm({...form, policy_id: Number(e.target.value)})}>
                <option value="">-- wybierz --</option>{policies.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div><label>Jednostka org. *</label>
              <select required value={form.org_unit_id ?? ""} onChange={e => setForm({...form, org_unit_id: Number(e.target.value)})}>
                <option value="">-- wybierz --</option>{orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.name}</option>)}
              </select>
            </div>
            <div><label>Wnioskujący *</label><input required value={form.requested_by} onChange={e => setForm({...form, requested_by: e.target.value})} /></div>
            <div><label>Zatwierdzający</label><input value={form.approved_by} onChange={e => setForm({...form, approved_by: e.target.value})} /></div>
            <div><label>Kategoria</label>
              <select value={form.category_id ?? ""} onChange={e => setForm({...form, category_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{categories.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Poziom ryzyka</label>
              <select value={form.risk_level_id ?? ""} onChange={e => setForm({...form, risk_level_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{riskLevels.filter(d => d.code !== "info").map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Status</label>
              <select value={form.status_id ?? ""} onChange={e => setForm({...form, status_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Data rozpoczęcia *</label><input type="date" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
            <div><label>Data wygaśnięcia *</label><input type="date" required value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} /></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Uzasadnienie biznesowe *</label>
            <textarea rows={2} required value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Środki kompensacyjne</label>
            <textarea rows={2} value={form.compensating_controls} onChange={e => setForm({...form, compensating_controls: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Utwórz</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr>
          <th>Ref</th><th>Tytuł</th><th>Polityka</th><th>Kategoria</th><th>Ryzyko</th>
          <th>Status</th><th>Jednostka</th><th>Wygasa</th><th>Kompensacja</th>
        </tr></thead>
        <tbody>
          {exceptions.map(ex => (
            <tr key={ex.id}>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{ex.ref_id}</td>
              <td>{ex.title}</td>
              <td>{ex.policy_title ?? "—"}</td>
              <td>{ex.category_name ?? "—"}</td>
              <td>{ex.risk_level_name ?? "—"}</td>
              <td>{ex.status_name ?? "—"}</td>
              <td>{ex.org_unit_name}</td>
              <td style={{
                color: isExpired(ex.expiry_date) ? "#dc2626" : isExpiringSoon(ex.expiry_date) ? "#d97706" : undefined,
                fontWeight: isExpired(ex.expiry_date) || isExpiringSoon(ex.expiry_date) ? "bold" : undefined
              }}>
                {ex.expiry_date}
                {isExpired(ex.expiry_date) && " (WYGASŁY)"}
                {isExpiringSoon(ex.expiry_date) && " (do reoceny)"}
              </td>
              <td>{ex.compensating_controls ? "Tak" : "—"}</td>
            </tr>
          ))}
          {exceptions.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#9ca3af" }}>Brak wyjątków</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
