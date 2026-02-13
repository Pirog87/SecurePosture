import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import Modal from "../components/Modal";

interface Framework {
  id: number;
  name: string;
}

interface AuditEngagement {
  id: number;
  audit_program_id: number | null;
  program_name: string | null;
  ref_id: string;
  name: string;
  framework_id: number;
  framework_name: string;
  scope_type: string;
  scope_name: string | null;
  objective: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  lead_auditor: string;
  supervisor: string | null;
  status: string;
  priority: string;
  tests_count: number;
  findings_count: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  planned: "#94a3b8",
  scoping: "#8b5cf6",
  fieldwork: "#f59e0b",
  reporting: "#3b82f6",
  review: "#06b6d4",
  completed: "#22c55e",
  closed: "#6b7280",
  cancelled: "#ef4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#22c55e",
};

export default function AuditEngagementsPage() {
  const [engagements, setEngagements] = useState<AuditEngagement[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchParams] = useSearchParams();
  const programId = searchParams.get("program_id");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    framework_id: 0,
    objective: "",
    lead_auditor: "",
    priority: "medium",
    scope_type: "organization",
    scope_name: "",
    planned_start: "",
    planned_end: "",
    audit_program_id: programId ? Number(programId) : null as number | null,
  });

  const load = () => {
    setLoading(true);
    const url = programId
      ? `/api/v1/audit-engagements/?program_id=${programId}`
      : "/api/v1/audit-engagements/";
    Promise.all([
      api.get<AuditEngagement[]>(url),
      api.get<Framework[]>("/api/v1/frameworks/"),
    ])
      .then(([ae, fw]) => {
        setEngagements(ae);
        setFrameworks(fw.filter((f: any) => f.is_active !== false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [programId]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.framework_id || !form.objective.trim() || !form.lead_auditor.trim()) return;
    try {
      const result = await api.post<AuditEngagement>("/api/v1/audit-engagements/", {
        name: form.name,
        framework_id: form.framework_id,
        objective: form.objective,
        lead_auditor: form.lead_auditor,
        priority: form.priority,
        scope_type: form.scope_type,
        scope_name: form.scope_name || null,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        audit_program_id: form.audit_program_id,
      });
      setShowModal(false);
      navigate(`/audit-engagements/${result.id}`);
    } catch {
      alert("Błąd tworzenia zadania");
    }
  };

  const active = engagements.filter((e) => !["completed", "closed", "cancelled"].includes(e.status));
  const totalFindings = engagements.reduce((s, e) => s + e.findings_count, 0);
  const totalTests = engagements.reduce((s, e) => s + e.tests_count, 0);

  const stats: StatCard[] = [
    { label: "Zadania ogółem", value: engagements.length, color: "#3b82f6" },
    { label: "W toku", value: active.length, color: "#f59e0b" },
    { label: "Testy", value: totalTests, color: "#8b5cf6" },
    { label: "Ustalenia", value: totalFindings, color: totalFindings > 0 ? "#ef4444" : "#22c55e" },
  ];

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Zadania Audytowe</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nowe zadanie
        </button>
      </div>

      <StatsCards cards={stats} />

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>
      ) : engagements.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          Brak zadań audytowych. Utwórz pierwsze zadanie.
        </div>
      ) : (
        <div className="card">
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Nazwa</th>
                <th>Framework</th>
                <th>Status</th>
                <th>Priorytet</th>
                <th>Lead Auditor</th>
                <th>Plan start</th>
                <th style={{ textAlign: "right" }}>Testy</th>
                <th style={{ textAlign: "right" }}>Ustalenia</th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((e) => (
                <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/audit-engagements/${e.id}`)}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{e.ref_id}</td>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td>{e.framework_name}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: `${STATUS_COLORS[e.status]}20`, color: STATUS_COLORS[e.status] }}>
                      {e.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: PRIORITY_COLORS[e.priority], fontWeight: 600, fontSize: 12 }}>
                      {e.priority}
                    </span>
                  </td>
                  <td>{e.lead_auditor}</td>
                  <td style={{ fontSize: 12 }}>{e.planned_start || "—"}</td>
                  <td style={{ textAlign: "right" }}>{e.tests_count}</td>
                  <td style={{ textAlign: "right", color: e.findings_count > 0 ? "#ef4444" : "inherit", fontWeight: e.findings_count > 0 ? 600 : 400 }}>
                    {e.findings_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Nowe zadanie audytowe" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>Nazwa * <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. Audyt ISO 27001 — Dział IT" /></label>
            <label>Framework *
              <select className="form-control" value={form.framework_id} onChange={(e) => setForm({ ...form, framework_id: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {frameworks.map((fw) => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
              </select>
            </label>
            <label>Cel audytu * <textarea className="form-control" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} rows={2} placeholder="Cel i zakres audytu..." /></label>
            <label>Lead Auditor * <input className="form-control" value={form.lead_auditor} onChange={(e) => setForm({ ...form, lead_auditor: e.target.value })} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>Priorytet
                <select className="form-control" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label>Scope
                <select className="form-control" value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })}>
                  <option value="organization">Cała organizacja</option>
                  <option value="org_unit">Jednostka org.</option>
                  <option value="service">Usługa</option>
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>Planowany start <input className="form-control" type="date" value={form.planned_start} onChange={(e) => setForm({ ...form, planned_start: e.target.value })} /></label>
              <label>Planowany koniec <input className="form-control" type="date" value={form.planned_end} onChange={(e) => setForm({ ...form, planned_end: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim() || !form.framework_id || !form.objective.trim() || !form.lead_auditor.trim()}>Utwórz</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
