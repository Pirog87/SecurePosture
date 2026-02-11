import { useEffect, useState } from "react";
import type { VulnerabilityRecord, DictionaryEntry, OrgUnit } from "../types";

const API = import.meta.env.VITE_API_URL ?? "";

export default function VulnerabilitiesPage() {
  const [vulns, setVulns] = useState<VulnerabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [severities, setSeverities] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [sources, setSources] = useState<DictionaryEntry[]>([]);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [priorities, setPriorities] = useState<DictionaryEntry[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    source_id: null as number | null,
    org_unit_id: null as number | null,
    category_id: null as number | null,
    severity_id: null as number | null,
    cvss_score: null as number | null,
    cve_id: "",
    status_id: null as number | null,
    remediation_priority_id: null as number | null,
    owner: "",
    detected_at: new Date().toISOString().slice(0, 10),
    sla_deadline: "",
    created_by: "",
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [vRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/vulnerabilities`),
        fetch(`${API}/api/v1/org-units/flat`),
      ]);
      if (vRes.ok) setVulns(await vRes.json());
      if (ouRes.ok) setOrgUnits(await ouRes.json());

      // Load dictionaries
      for (const [code, setter] of [
        ["severity_universal", setSeverities],
        ["vuln_status", setStatuses],
        ["vuln_source", setSources],
        ["vuln_category", setCategories],
        ["remediation_priority", setPriorities],
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
      cvss_score: form.cvss_score || null,
      cve_id: form.cve_id || null,
      sla_deadline: form.sla_deadline || null,
      created_by: form.created_by || null,
    };
    const r = await fetch(`${API}/api/v1/vulnerabilities`, {
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
    if (!confirm("Archiwizować podatność?")) return;
    await fetch(`${API}/api/v1/vulnerabilities/${id}`, { method: "DELETE" });
    loadAll();
  }

  const filtered = vulns.filter((v) => {
    if (filterStatus && v.status_id !== Number(filterStatus)) return false;
    if (filterSeverity && v.severity_id !== Number(filterSeverity)) return false;
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

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Rejestr Podatności</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Anuluj" : "+ Nowa podatność"}
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
              <label>Właściciel remediacji *</label>
              <input required value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </div>
            <div>
              <label>Źródło</label>
              <select value={form.source_id ?? ""} onChange={(e) => setForm({ ...form, source_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-- brak --</option>
                {sources.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
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
              <label>CVSS</label>
              <input type="number" step="0.1" min="0" max="10" value={form.cvss_score ?? ""} onChange={(e) => setForm({ ...form, cvss_score: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <label>CVE ID</label>
              <input value={form.cve_id} onChange={(e) => setForm({ ...form, cve_id: e.target.value })} placeholder="CVE-20XX-XXXXX" />
            </div>
            <div>
              <label>Status</label>
              <select value={form.status_id ?? ""} onChange={(e) => setForm({ ...form, status_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-- brak --</option>
                {statuses.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label>Priorytet</label>
              <select value={form.remediation_priority_id ?? ""} onChange={(e) => setForm({ ...form, remediation_priority_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-- brak --</option>
                {priorities.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label>Data wykrycia *</label>
              <input type="date" required value={form.detected_at} onChange={(e) => setForm({ ...form, detected_at: e.target.value })} />
            </div>
            <div>
              <label>Termin SLA</label>
              <input type="date" value={form.sla_deadline} onChange={(e) => setForm({ ...form, sla_deadline: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Opis</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
          {filtered.length} / {vulns.length} podatności
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Tytuł</th>
            <th>Ważność</th>
            <th>CVSS</th>
            <th>Status</th>
            <th>CVE</th>
            <th>Jednostka</th>
            <th>Właściciel</th>
            <th>Wykryto</th>
            <th>SLA</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => (
            <tr key={v.id}>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{v.ref_id}</td>
              <td>{v.title}</td>
              <td><span style={{ cssText: severityColor(v.severity_name) }}>{v.severity_name ?? "—"}</span></td>
              <td>{v.cvss_score != null ? v.cvss_score.toFixed(1) : "—"}</td>
              <td>{v.status_name ?? "—"}</td>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{v.cve_id ?? "—"}</td>
              <td>{v.org_unit_name}</td>
              <td>{v.owner}</td>
              <td>{v.detected_at}</td>
              <td style={{ color: v.sla_deadline && new Date(v.sla_deadline) < new Date() ? "#dc2626" : undefined }}>
                {v.sla_deadline ?? "—"}
              </td>
              <td>
                <button className="btn btn-sm" onClick={() => handleArchive(v.id)} title="Archiwizuj">🗑</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={11} style={{ textAlign: "center", color: "#9ca3af" }}>Brak podatności</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
