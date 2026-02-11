import { useEffect, useState } from "react";
import type { DictionaryEntry, OrgUnit } from "../types";

interface PolicyRecord {
  id: number;
  ref_id: string | null;
  title: string;
  category_name: string | null;
  owner: string;
  approver: string | null;
  status_name: string | null;
  current_version: string | null;
  effective_date: string | null;
  review_date: string | null;
  target_audience_count: number;
  acknowledgment_count: number;
  acknowledgment_rate: number | null;
  is_active: boolean;
}

const API = import.meta.env.VITE_API_URL ?? "";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);

  const [form, setForm] = useState({
    title: "", owner: "", approver: "",
    category_id: null as number | null,
    status_id: null as number | null,
    current_version: "1.0",
    effective_date: "", review_date: "",
    document_url: "", target_audience_count: 0,
    description: "",
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/policies`);
      if (r.ok) setPolicies(await r.json());
      for (const [code, setter] of [
        ["policy_category", setCategories],
        ["policy_status", setStatuses],
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
      effective_date: form.effective_date || null,
      review_date: form.review_date || null,
      document_url: form.document_url || null,
      description: form.description || null,
    };
    const r = await fetch(`${API}/api/v1/policies`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) { setShowForm(false); loadAll(); }
  }

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Rejestr Polityk Bezpieczeństwa</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Anuluj" : "+ Nowa polityka"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label>Tytuł *</label><input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div><label>Właściciel *</label><input required value={form.owner} onChange={e => setForm({...form, owner: e.target.value})} /></div>
            <div><label>Zatwierdzający</label><input value={form.approver} onChange={e => setForm({...form, approver: e.target.value})} /></div>
            <div><label>Kategoria</label>
              <select value={form.category_id ?? ""} onChange={e => setForm({...form, category_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{categories.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Status</label>
              <select value={form.status_id ?? ""} onChange={e => setForm({...form, status_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Wersja</label><input value={form.current_version} onChange={e => setForm({...form, current_version: e.target.value})} /></div>
            <div><label>Data obowiązywania</label><input type="date" value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})} /></div>
            <div><label>Data przeglądu</label><input type="date" value={form.review_date} onChange={e => setForm({...form, review_date: e.target.value})} /></div>
            <div><label>Liczba odbiorców</label><input type="number" min={0} value={form.target_audience_count} onChange={e => setForm({...form, target_audience_count: Number(e.target.value)})} /></div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Utwórz</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr>
          <th>Ref</th><th>Tytuł</th><th>Kategoria</th><th>Właściciel</th><th>Status</th>
          <th>Wersja</th><th>Obowiązuje od</th><th>Przegląd</th><th>Potwierdz.</th>
        </tr></thead>
        <tbody>
          {policies.map(p => (
            <tr key={p.id}>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.ref_id}</td>
              <td>{p.title}</td>
              <td>{p.category_name ?? "—"}</td>
              <td>{p.owner}</td>
              <td>{p.status_name ?? "—"}</td>
              <td>{p.current_version ?? "—"}</td>
              <td>{p.effective_date ?? "—"}</td>
              <td style={{ color: p.review_date && new Date(p.review_date) < new Date() ? "#dc2626" : undefined }}>
                {p.review_date ?? "—"}
              </td>
              <td>{p.acknowledgment_rate != null ? `${p.acknowledgment_rate}%` : "—"} ({p.acknowledgment_count}/{p.target_audience_count})</td>
            </tr>
          ))}
          {policies.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#9ca3af" }}>Brak polityk</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
