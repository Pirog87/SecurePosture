import { useEffect, useState } from "react";
import type { DictionaryEntry, OrgUnit } from "../types";

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

const API = import.meta.env.VITE_API_URL ?? "";

export default function AwarenessPage() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, ResultRecord[]>>({});
  const [types, setTypes] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);

  const [form, setForm] = useState({
    title: "", description: "",
    campaign_type_id: null as number | null,
    org_unit_id: null as number | null,
    target_audience_count: 0,
    start_date: "", end_date: "",
    status_id: null as number | null,
    owner: "", content_url: "",
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/awareness-campaigns`);
      if (r.ok) setCampaigns(await r.json());
      for (const [code, setter] of [
        ["campaign_type", setTypes],
        ["campaign_status", setStatuses],
      ] as const) {
        const dr = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (dr.ok) { const d = await dr.json(); (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []); }
      }
      const or = await fetch(`${API}/api/v1/org-units`);
      if (or.ok) setOrgUnits(await or.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadResults(campId: number) {
    if (results[campId]) { setExpandedId(expandedId === campId ? null : campId); return; }
    const r = await fetch(`${API}/api/v1/awareness-campaigns/${campId}/results`);
    if (r.ok) {
      const data = await r.json();
      setResults(prev => ({ ...prev, [campId]: data }));
    }
    setExpandedId(campId);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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
    if (r.ok) { setShowForm(false); loadAll(); }
  }

  function statusColor(name: string | null): string | undefined {
    if (!name) return undefined;
    if (name === "Planowana") return "#6b7280";
    if (name === "W trakcie") return "#2563eb";
    if (name === "Zakończona") return "#16a34a";
    return undefined;
  }

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Security Awareness</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Anuluj" : "+ Nowa kampania"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label>Tytuł *</label><input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div><label>Typ kampanii</label>
              <select value={form.campaign_type_id ?? ""} onChange={e => setForm({...form, campaign_type_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{types.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Jednostka org.</label>
              <select value={form.org_unit_id ?? ""} onChange={e => setForm({...form, org_unit_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- cała org. --</option>{orgUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div><label>Właściciel</label><input value={form.owner} onChange={e => setForm({...form, owner: e.target.value})} /></div>
            <div><label>Liczba uczestników</label><input type="number" min={0} value={form.target_audience_count} onChange={e => setForm({...form, target_audience_count: Number(e.target.value)})} /></div>
            <div><label>Status</label>
              <select value={form.status_id ?? ""} onChange={e => setForm({...form, status_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Data rozpoczęcia</label><input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
            <div><label>Data końca</label><input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            <div><label>URL materiałów</label><input value={form.content_url} onChange={e => setForm({...form, content_url: e.target.value})} /></div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Utwórz</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr>
          <th>Ref</th><th>Tytuł</th><th>Typ</th><th>Jednostka</th><th>Status</th>
          <th>Uczestnicy</th><th>Start</th><th>Koniec</th><th>Właściciel</th><th>Wyniki</th>
        </tr></thead>
        <tbody>
          {campaigns.map(c => (
            <>
              <tr key={c.id}>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.ref_id}</td>
                <td>{c.title}</td>
                <td>{c.campaign_type_name ?? "—"}</td>
                <td>{c.org_unit_name ?? "Cała org."}</td>
                <td style={{ color: statusColor(c.status_name) }}>{c.status_name ?? "—"}</td>
                <td>{c.target_audience_count}</td>
                <td>{c.start_date ?? "—"}</td>
                <td>{c.end_date ?? "—"}</td>
                <td>{c.owner ?? "—"}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => loadResults(c.id)} style={{ fontSize: 11 }}>
                    {expandedId === c.id ? "Zwiń" : "Pokaż"}
                  </button>
                </td>
              </tr>
              {expandedId === c.id && results[c.id] && (
                <tr key={`res-${c.id}`}>
                  <td colSpan={10} style={{ padding: 0 }}>
                    <table className="data-table" style={{ margin: 8, width: "calc(100% - 16px)" }}>
                      <thead><tr>
                        <th>Jednostka</th><th>Uczestnicy</th><th>Ukończono</th><th>Nie zdało</th>
                        <th>Zgłosiło</th><th>Ukończenie %</th><th>Click rate %</th><th>Report rate %</th><th>Śr. wynik</th>
                      </tr></thead>
                      <tbody>
                        {results[c.id].map(r => (
                          <tr key={r.id}>
                            <td>{r.org_unit_name ?? "—"}</td>
                            <td>{r.participants_count}</td>
                            <td>{r.completed_count}</td>
                            <td>{r.failed_count}</td>
                            <td>{r.reported_count}</td>
                            <td>{r.completion_rate != null ? `${r.completion_rate}%` : "—"}</td>
                            <td style={{ color: r.click_rate != null && r.click_rate > 20 ? "#dc2626" : undefined }}>
                              {r.click_rate != null ? `${r.click_rate}%` : "—"}
                            </td>
                            <td>{r.report_rate != null ? `${r.report_rate}%` : "—"}</td>
                            <td>{r.avg_score != null ? `${r.avg_score}` : "—"}</td>
                          </tr>
                        ))}
                        {results[c.id].length === 0 && (
                          <tr><td colSpan={9} style={{ textAlign: "center", color: "#9ca3af" }}>Brak wyników</td></tr>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
          {campaigns.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#9ca3af" }}>Brak kampanii</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
