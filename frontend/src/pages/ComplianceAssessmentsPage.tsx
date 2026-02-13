import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import Modal from "../components/Modal";

interface Framework {
  id: number;
  name: string;
  total_assessable: number;
}

interface ComplianceAssessment {
  id: number;
  framework_id: number;
  framework_name: string;
  scope_type: string;
  scope_name: string | null;
  assessment_type: string;
  status: string;
  name: string | null;
  compliance_score: number | null;
  total_requirements: number;
  assessed_count: number;
  compliant_count: number;
  partially_count: number;
  non_compliant_count: number;
  not_applicable_count: number;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  archived: "#6b7280",
};

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-muted)";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export default function ComplianceAssessmentsPage() {
  const [assessments, setAssessments] = useState<ComplianceAssessment[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    framework_id: 0,
    scope_type: "organization",
    scope_name: "",
    name: "",
  });
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<ComplianceAssessment[]>("/api/v1/compliance-assessments/"),
      api.get<Framework[]>("/api/v1/frameworks/"),
    ])
      .then(([ca, fw]) => {
        setAssessments(ca);
        setFrameworks(fw.filter((f: any) => f.is_active !== false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.framework_id) return;
    try {
      const result = await api.post<ComplianceAssessment>("/api/v1/compliance-assessments/", {
        framework_id: form.framework_id,
        scope_type: form.scope_type,
        scope_name: form.scope_name || null,
        name: form.name || null,
      });
      setShowModal(false);
      navigate(`/compliance/assessments/${result.id}`);
    } catch (e) {
      alert("Błąd tworzenia oceny");
    }
  };

  const active = assessments.filter((a) => a.status !== "archived");
  const completed = assessments.filter((a) => a.status === "completed").length;
  const avgScore =
    active.filter((a) => a.compliance_score != null).length > 0
      ? active.filter((a) => a.compliance_score != null).reduce((s, a) => s + (a.compliance_score ?? 0), 0) /
        active.filter((a) => a.compliance_score != null).length
      : null;

  const stats: StatCard[] = [
    { label: "Oceny ogółem", value: assessments.length, color: "#3b82f6" },
    { label: "W toku", value: active.filter((a) => a.status === "in_progress").length, color: "#f59e0b" },
    { label: "Zakończone", value: completed, color: "#22c55e" },
    { label: "Średni % zgodności", value: avgScore != null ? `${avgScore.toFixed(1)}%` : "—", color: scoreColor(avgScore) },
  ];

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Oceny Zgodności</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nowa ocena
        </button>
      </div>

      <StatsCards cards={stats} />

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>
      ) : assessments.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          Brak ocen zgodności. Utwórz pierwszą ocenę, wybierając framework.
        </div>
      ) : (
        <div className="card">
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Framework</th>
                <th>Scope</th>
                <th>Typ</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Zgodność %</th>
                <th style={{ textAlign: "right" }}>Ocenione</th>
                <th style={{ textAlign: "right" }}>Zgodne</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/compliance/assessments/${a.id}`)}>
                  <td style={{ fontWeight: 600 }}>{a.name || `#${a.id}`}</td>
                  <td>{a.framework_name}</td>
                  <td>{a.scope_name || a.scope_type}</td>
                  <td>
                    <span className="badge" style={{ fontSize: 11 }}>
                      {a.assessment_type === "continuous" ? "Bieżąca" : "Snapshot"}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: `${STATUS_COLORS[a.status]}20`, color: STATUS_COLORS[a.status] }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: scoreColor(a.compliance_score) }}>
                    {a.compliance_score != null ? `${a.compliance_score}%` : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {a.assessed_count} / {a.total_requirements}
                  </td>
                  <td style={{ textAlign: "right", color: "#22c55e" }}>{a.compliant_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Nowa ocena zgodności" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Framework *
              <select
                className="form-control"
                value={form.framework_id}
                onChange={(e) => setForm({ ...form, framework_id: Number(e.target.value) })}
              >
                <option value={0}>— wybierz —</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.name} ({fw.total_assessable} wymagań)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scope
              <select className="form-control" value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })}>
                <option value="organization">Cała organizacja</option>
                <option value="org_unit">Jednostka organizacyjna</option>
                <option value="service">Usługa</option>
                <option value="process">Proces</option>
              </select>
            </label>
            <label>
              Nazwa scope
              <input className="form-control" value={form.scope_name} onChange={(e) => setForm({ ...form, scope_name: e.target.value })} placeholder="np. Dział IT" />
            </label>
            <label>
              Nazwa oceny (opcjonalna)
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. ISO 27001 — IT — 2026" />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.framework_id}>
                Utwórz
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
