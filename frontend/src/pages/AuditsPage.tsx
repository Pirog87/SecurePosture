import { useEffect, useState } from "react";
import type { DictionaryEntry, OrgUnit } from "../types";

interface AuditRecord {
  id: number;
  ref_id: string | null;
  title: string;
  audit_type_name: string | null;
  framework: string | null;
  auditor: string;
  org_unit_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  overall_rating_name: string | null;
  findings_count: number;
}

interface FindingRecord {
  id: number;
  ref_id: string | null;
  title: string;
  finding_type_name: string | null;
  severity_name: string | null;
  status_name: string | null;
  remediation_owner: string | null;
  sla_deadline: string | null;
}

const API = import.meta.env.VITE_API_URL ?? "";

export default function AuditsPage() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [auditTypes, setAuditTypes] = useState<DictionaryEntry[]>([]);
  const [, setRatings] = useState<DictionaryEntry[]>([]);

  const [selectedAudit, setSelectedAudit] = useState<number | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);

  const [form, setForm] = useState({
    title: "", auditor: "", framework: "",
    audit_type_id: null as number | null,
    org_unit_id: null as number | null,
    status: "planned",
    start_date: "", end_date: "",
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/audits`);
      if (r.ok) setAudits(await r.json());
      const ouR = await fetch(`${API}/api/v1/org-units/flat`);
      if (ouR.ok) setOrgUnits(await ouR.json());
      for (const [code, setter] of [
        ["audit_type", setAuditTypes],
        ["audit_rating", setRatings],
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
      framework: form.framework || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    const r = await fetch(`${API}/api/v1/audits`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) { setShowForm(false); loadAll(); }
  }

  async function loadFindings(auditId: number) {
    if (selectedAudit === auditId) { setSelectedAudit(null); return; }
    setSelectedAudit(auditId);
    const r = await fetch(`${API}/api/v1/audits/${auditId}/findings`);
    if (r.ok) setFindings(await r.json());
  }

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Rejestr Audytów i Kontroli</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Anuluj" : "+ Nowy audyt"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label>Tytuł *</label><input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div><label>Audytor *</label><input required value={form.auditor} onChange={e => setForm({...form, auditor: e.target.value})} /></div>
            <div><label>Typ audytu</label>
              <select value={form.audit_type_id ?? ""} onChange={e => setForm({...form, audit_type_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{auditTypes.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div><label>Framework</label><input value={form.framework} onChange={e => setForm({...form, framework: e.target.value})} placeholder="np. ISO 27001" /></div>
            <div><label>Jednostka org.</label>
              <select value={form.org_unit_id ?? ""} onChange={e => setForm({...form, org_unit_id: e.target.value ? Number(e.target.value) : null})}>
                <option value="">-- brak --</option>{orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.name}</option>)}
              </select>
            </div>
            <div><label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="planned">Planowany</option>
                <option value="in_progress">W trakcie</option>
                <option value="completed">Zakończony</option>
                <option value="cancelled">Anulowany</option>
              </select>
            </div>
            <div><label>Data rozpoczęcia</label><input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
            <div><label>Data zakończenia</label><input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Utwórz</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr>
          <th>Ref</th><th>Tytuł</th><th>Typ</th><th>Framework</th><th>Audytor</th>
          <th>Jednostka</th><th>Status</th><th>Rozpoczęcie</th><th>Ocena</th><th>Findings</th>
        </tr></thead>
        <tbody>
          {audits.map(a => (
            <>
              <tr key={a.id} onClick={() => loadFindings(a.id)} style={{ cursor: "pointer" }}>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{a.ref_id}</td>
                <td>{a.title}</td>
                <td>{a.audit_type_name ?? "—"}</td>
                <td>{a.framework ?? "—"}</td>
                <td>{a.auditor}</td>
                <td>{a.org_unit_name ?? "—"}</td>
                <td>{a.status}</td>
                <td>{a.start_date ?? "—"}</td>
                <td>{a.overall_rating_name ?? "—"}</td>
                <td style={{ fontWeight: a.findings_count > 0 ? "bold" : undefined }}>{a.findings_count}</td>
              </tr>
              {selectedAudit === a.id && (
                <tr key={`findings-${a.id}`}>
                  <td colSpan={10} style={{ padding: 0 }}>
                    <div style={{ padding: "8px 16px", background: "#f9fafb" }}>
                      <strong>Findings ({findings.length}):</strong>
                      {findings.length === 0 && <p style={{ color: "#9ca3af", margin: "4px 0" }}>Brak findingów</p>}
                      {findings.length > 0 && (
                        <table className="data-table" style={{ marginTop: 8 }}>
                          <thead><tr><th>Ref</th><th>Tytuł</th><th>Typ</th><th>Ważność</th><th>Status</th><th>Właściciel</th><th>SLA</th></tr></thead>
                          <tbody>
                            {findings.map(f => (
                              <tr key={f.id}>
                                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{f.ref_id}</td>
                                <td>{f.title}</td>
                                <td>{f.finding_type_name ?? "—"}</td>
                                <td>{f.severity_name ?? "—"}</td>
                                <td>{f.status_name ?? "—"}</td>
                                <td>{f.remediation_owner ?? "—"}</td>
                                <td style={{ color: f.sla_deadline && new Date(f.sla_deadline) < new Date() ? "#dc2626" : undefined }}>
                                  {f.sla_deadline ?? "—"}
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
          {audits.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#9ca3af" }}>Brak audytów</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
