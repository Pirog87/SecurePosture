import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import Modal from "../components/Modal";

interface Engagement {
  id: number;
  ref_id: string;
  name: string;
  framework_id: number;
  framework_name: string;
  scope_name: string | null;
  objective: string;
  methodology: string | null;
  lead_auditor: string;
  supervisor: string | null;
  status: string;
  priority: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  tests_count: number;
  findings_count: number;
}

interface AuditTest {
  id: number;
  ref_id: string | null;
  name: string;
  test_type: string;
  test_result: string;
  node_ref_id: string | null;
  node_name: string | null;
  auditor_name: string | null;
  tested_at: string | null;
  exceptions_count: number;
}

interface Finding {
  id: number;
  ref_id: string;
  title: string;
  severity: string;
  status: string;
  condition_text: string;
  criteria_text: string;
  target_date: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  planned: "#94a3b8", scoping: "#8b5cf6", fieldwork: "#f59e0b",
  reporting: "#3b82f6", review: "#06b6d4", completed: "#22c55e",
  closed: "#6b7280", cancelled: "#ef4444",
};

const TEST_RESULT_COLORS: Record<string, string> = {
  pass: "#22c55e", fail: "#ef4444", partial: "#f59e0b",
  not_tested: "#94a3b8", inconclusive: "#8b5cf6",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626", high: "#f59e0b", medium: "#3b82f6",
  low: "#22c55e", informational: "#6b7280",
};

const TABS = ["Przegląd", "Testy", "Ustalenia", "Raport"] as const;

export default function AuditEngagementDetailPage() {
  const { engId } = useParams<{ engId: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [tests, setTests] = useState<AuditTest[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Przegląd");
  const [loading, setLoading] = useState(true);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showFindingModal, setShowFindingModal] = useState(false);

  const [testForm, setTestForm] = useState({ name: "", test_type: "design", description: "" });
  const [findingForm, setFindingForm] = useState({
    title: "", condition_text: "", criteria_text: "", severity: "medium", recommendation: "",
  });

  const load = useCallback(async () => {
    if (!engId) return;
    try {
      const [eng, t, f] = await Promise.all([
        api.get<Engagement>(`/api/v1/audit-engagements/${engId}`),
        api.get<AuditTest[]>(`/api/v1/audit-engagements/${engId}/tests`),
        api.get<Finding[]>(`/api/v1/audit-engagements/${engId}/findings`),
      ]);
      setEngagement(eng);
      setTests(t);
      setFindings(f);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [engId]);

  useEffect(() => { load(); }, [load]);

  const transition = async (target: string) => {
    try {
      await api.post(`/api/v1/audit-engagements/${engId}/transition`, { target_status: target });
      load();
    } catch (e: any) {
      alert(e.message || "Błąd zmiany statusu");
    }
  };

  const createTest = async () => {
    if (!testForm.name.trim()) return;
    await api.post(`/api/v1/audit-engagements/${engId}/tests`, testForm);
    setShowTestModal(false);
    setTestForm({ name: "", test_type: "design", description: "" });
    load();
  };

  const createFinding = async () => {
    if (!findingForm.title.trim() || !findingForm.condition_text.trim() || !findingForm.criteria_text.trim()) return;
    await api.post(`/api/v1/audit-engagements/${engId}/findings`, findingForm);
    setShowFindingModal(false);
    setFindingForm({ title: "", condition_text: "", criteria_text: "", severity: "medium", recommendation: "" });
    load();
  };

  const updateTestResult = async (testId: number, result: string) => {
    await api.put(`/api/v1/audit-engagements/tests/${testId}`, { test_result: result });
    load();
  };

  if (loading || !engagement) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>;
  }

  const nextStatus = Object.entries({
    planned: "scoping", scoping: "fieldwork", fieldwork: "reporting",
    reporting: "review", review: "completed", completed: "closed",
  } as Record<string, string>)[
    Object.keys({ planned: 1, scoping: 1, fieldwork: 1, reporting: 1, review: 1, completed: 1 }).indexOf(engagement.status)
  ];

  const passCount = tests.filter((t) => t.test_result === "pass").length;
  const failCount = tests.filter((t) => t.test_result === "fail").length;

  return (
    <div style={{ padding: "0 0 32px" }}>
      {/* Header */}
      <button className="btn btn-xs" onClick={() => navigate("/audit-engagements")} style={{ marginBottom: 8 }}>
        ← Powrót
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>
            <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 16, marginRight: 8 }}>{engagement.ref_id}</span>
            {engagement.name}
          </h2>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 16, alignItems: "center" }}>
            <span>Framework: {engagement.framework_name}</span>
            <span>Lead: {engagement.lead_auditor}</span>
            <span className="badge" style={{ backgroundColor: `${STATUS_COLORS[engagement.status]}20`, color: STATUS_COLORS[engagement.status] }}>
              {engagement.status}
            </span>
          </div>
        </div>
        {nextStatus && (
          <button className="btn btn-primary" onClick={() => transition(nextStatus[1])}>
            → {nextStatus[1]}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--primary)" : "var(--text-muted)",
              borderBottom: activeTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "Przegląd" && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>Cel audytu</h4>
              <p style={{ margin: 0, fontSize: 14 }}>{engagement.objective}</p>
            </div>
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>Harmonogram</h4>
              <div style={{ fontSize: 13 }}>
                <div>Plan: {engagement.planned_start || "—"} → {engagement.planned_end || "—"}</div>
                <div>Faktycznie: {engagement.actual_start || "—"} → {engagement.actual_end || "—"}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
            <div className="card" style={{ textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{tests.length}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Testów</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>{passCount}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pass</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>{failCount}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Fail</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: findings.length > 0 ? "#ef4444" : "#22c55e" }}>{findings.length}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ustaleń</div>
            </div>
          </div>
        </div>
      )}

      {/* Tests Tab */}
      {activeTab === "Testy" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowTestModal(true)}>+ Dodaj test</button>
          </div>
          {tests.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Brak testów. Dodaj testy audytowe.
            </div>
          ) : (
            <div className="card">
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Nazwa</th>
                    <th>Wymaganie</th>
                    <th>Typ</th>
                    <th>Wynik</th>
                    <th>Audytor</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{t.ref_id}</td>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td style={{ fontSize: 12 }}>{t.node_ref_id || "—"}</td>
                      <td style={{ fontSize: 12 }}>{t.test_type}</td>
                      <td>
                        <select
                          className="form-control"
                          value={t.test_result}
                          onChange={(e) => updateTestResult(t.id, e.target.value)}
                          style={{ fontSize: 12, padding: "2px 6px", color: TEST_RESULT_COLORS[t.test_result], fontWeight: 600 }}
                        >
                          <option value="not_tested">Not tested</option>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                          <option value="partial">Partial</option>
                          <option value="inconclusive">Inconclusive</option>
                        </select>
                      </td>
                      <td style={{ fontSize: 12 }}>{t.auditor_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Findings Tab */}
      {activeTab === "Ustalenia" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowFindingModal(true)}>+ Nowe ustalenie</button>
          </div>
          {findings.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Brak ustaleń audytowych.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {findings.map((f) => (
                <div key={f.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", marginRight: 8 }}>{f.ref_id}</span>
                      <span style={{ fontWeight: 600 }}>{f.title}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="badge" style={{ backgroundColor: `${SEVERITY_COLORS[f.severity]}20`, color: SEVERITY_COLORS[f.severity] }}>{f.severity}</span>
                      <span className="badge">{f.status}</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                    <div>
                      <strong style={{ fontSize: 11, color: "var(--text-muted)" }}>Stan faktyczny:</strong>
                      <p style={{ margin: "4px 0 0" }}>{f.condition_text}</p>
                    </div>
                    <div>
                      <strong style={{ fontSize: 11, color: "var(--text-muted)" }}>Kryterium:</strong>
                      <p style={{ margin: "4px 0 0" }}>{f.criteria_text}</p>
                    </div>
                  </div>
                  {f.target_date && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                      Termin: {f.target_date}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report Tab */}
      {activeTab === "Raport" && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
          Raport audytowy — funkcjonalność w przygotowaniu.
          <br />
          Raport zostanie wygenerowany automatycznie na bazie ustaleń i wyników testów.
        </div>
      )}

      {/* Test Modal */}
      <Modal open={showTestModal} title="Dodaj test audytowy" onClose={() => setShowTestModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>Nazwa * <input className="form-control" value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })} /></label>
            <label>Typ
              <select className="form-control" value={testForm.test_type} onChange={(e) => setTestForm({ ...testForm, test_type: e.target.value })}>
                <option value="design">Design</option>
                <option value="operating">Operating</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label>Opis <textarea className="form-control" value={testForm.description} onChange={(e) => setTestForm({ ...testForm, description: e.target.value })} rows={3} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowTestModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={createTest} disabled={!testForm.name.trim()}>Dodaj</button>
            </div>
          </div>
        </Modal>

      {/* Finding Modal */}
      <Modal open={showFindingModal} title="Nowe ustalenie audytowe (format IIA)" onClose={() => setShowFindingModal(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>Tytuł * <input className="form-control" value={findingForm.title} onChange={(e) => setFindingForm({ ...findingForm, title: e.target.value })} /></label>
          <label>Stan faktyczny (Condition) * <textarea className="form-control" value={findingForm.condition_text} onChange={(e) => setFindingForm({ ...findingForm, condition_text: e.target.value })} rows={3} placeholder="Co jest — co faktycznie stwierdzono" /></label>
          <label>Kryterium (Criteria) * <textarea className="form-control" value={findingForm.criteria_text} onChange={(e) => setFindingForm({ ...findingForm, criteria_text: e.target.value })} rows={3} placeholder="Co powinno być — wymaganie" /></label>
          <label>Severity
            <select className="form-control" value={findingForm.severity} onChange={(e) => setFindingForm({ ...findingForm, severity: e.target.value })}>
              <option value="informational">Informational</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>Rekomendacja <textarea className="form-control" value={findingForm.recommendation} onChange={(e) => setFindingForm({ ...findingForm, recommendation: e.target.value })} rows={2} /></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setShowFindingModal(false)}>Anuluj</button>
            <button className="btn btn-primary" onClick={createFinding} disabled={!findingForm.title.trim() || !findingForm.condition_text.trim() || !findingForm.criteria_text.trim()}>Utwórz</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
