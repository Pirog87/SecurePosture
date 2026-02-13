import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";

interface ComplianceAssessment {
  id: number;
  framework_id: number;
  framework_name: string;
  scope_type: string;
  scope_name: string | null;
  assessment_type: string;
  status: string;
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

interface AuditEngagement {
  id: number;
  ref_id: string;
  name: string;
  framework_name: string;
  status: string;
  lead_auditor: string;
  priority: string;
  planned_start: string | null;
  planned_end: string | null;
  tests_count: number;
  findings_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  archived: "#6b7280",
};

const ENGAGEMENT_STATUS_COLORS: Record<string, string> = {
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

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-muted)";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export default function ComplianceDashboardPage() {
  const [assessments, setAssessments] = useState<ComplianceAssessment[]>([]);
  const [engagements, setEngagements] = useState<AuditEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get<ComplianceAssessment[]>("/api/v1/compliance-assessments/"),
      api.get<AuditEngagement[]>("/api/v1/audit-engagements/"),
    ])
      .then(([ca, ae]) => {
        setAssessments(ca);
        setEngagements(ae);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeAssessments = assessments.filter((a) => a.status !== "archived");
  const avgScore =
    activeAssessments.filter((a) => a.compliance_score != null).length > 0
      ? activeAssessments
          .filter((a) => a.compliance_score != null)
          .reduce((sum, a) => sum + (a.compliance_score ?? 0), 0) /
        activeAssessments.filter((a) => a.compliance_score != null).length
      : null;
  const openEngagements = engagements.filter(
    (e) => !["completed", "closed", "cancelled"].includes(e.status),
  );
  const totalFindings = engagements.reduce((s, e) => s + e.findings_count, 0);

  const stats: StatCard[] = [
    {
      label: "Aktywne oceny",
      value: activeAssessments.length,
      color: "#3b82f6",
    },
    {
      label: "Średni % zgodności",
      value: avgScore != null ? `${avgScore.toFixed(1)}%` : "—",
      color: scoreColor(avgScore),
    },
    {
      label: "Otwarte audyty",
      value: openEngagements.length,
      color: "#f59e0b",
    },
    {
      label: "Ustalenia audytowe",
      value: totalFindings,
      color: totalFindings > 0 ? "#ef4444" : "#22c55e",
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
        Wczytywanie...
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Compliance & Audit Dashboard</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate("/compliance/assessments")}>
            + Nowa ocena
          </button>
          <button className="btn" onClick={() => navigate("/audit-engagements")}>
            + Nowy audyt
          </button>
        </div>
      </div>

      <StatsCards cards={stats} />

      {/* Compliance Assessments */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Oceny zgodności</h3>
          <button className="btn btn-xs" onClick={() => navigate("/compliance/assessments")}>
            Zobacz wszystkie
          </button>
        </div>
        {activeAssessments.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            Brak ocen zgodności. Utwórz pierwszą ocenę dla wybranego frameworka.
          </div>
        ) : (
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Framework</th>
                <th>Scope</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Zgodność %</th>
                <th style={{ textAlign: "right" }}>Postęp</th>
                <th style={{ textAlign: "right" }}>Wymagania</th>
              </tr>
            </thead>
            <tbody>
              {activeAssessments.map((a) => {
                const progress =
                  a.total_requirements > 0
                    ? Math.round((a.assessed_count / a.total_requirements) * 100)
                    : 0;
                return (
                  <tr
                    key={a.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/compliance/assessments/${a.id}`)}
                  >
                    <td style={{ fontWeight: 600 }}>{a.framework_name}</td>
                    <td>{a.scope_name || a.scope_type}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: `${STATUS_COLORS[a.status] || "#94a3b8"}20`,
                          color: STATUS_COLORS[a.status] || "#94a3b8",
                        }}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: scoreColor(a.compliance_score) }}>
                      {a.compliance_score != null ? `${a.compliance_score}%` : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <div
                          style={{
                            width: 60,
                            height: 6,
                            backgroundColor: "var(--border)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${progress}%`,
                              height: "100%",
                              backgroundColor: progress >= 80 ? "#22c55e" : progress >= 50 ? "#f59e0b" : "#ef4444",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{progress}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontSize: 12 }}>
                      {a.compliant_count}
                      <span style={{ color: "#22c55e" }}> ✓</span>
                      {" / "}
                      {a.total_requirements}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Active Audit Engagements */}
      <div className="card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Aktywne zadania audytowe</h3>
          <button className="btn btn-xs" onClick={() => navigate("/audit-engagements")}>
            Zobacz wszystkie
          </button>
        </div>
        {openEngagements.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            Brak aktywnych zadań audytowych.
          </div>
        ) : (
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Nazwa</th>
                <th>Framework</th>
                <th>Status</th>
                <th>Priorytet</th>
                <th>Lead Auditor</th>
                <th style={{ textAlign: "right" }}>Testy</th>
                <th style={{ textAlign: "right" }}>Ustalenia</th>
              </tr>
            </thead>
            <tbody>
              {openEngagements.map((e) => (
                <tr
                  key={e.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/audit-engagements/${e.id}`)}
                >
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{e.ref_id}</td>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td>{e.framework_name}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${ENGAGEMENT_STATUS_COLORS[e.status] || "#94a3b8"}20`,
                        color: ENGAGEMENT_STATUS_COLORS[e.status] || "#94a3b8",
                      }}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: PRIORITY_COLORS[e.priority] || "inherit", fontWeight: 600, fontSize: 12 }}>
                      {e.priority}
                    </span>
                  </td>
                  <td>{e.lead_auditor}</td>
                  <td style={{ textAlign: "right" }}>{e.tests_count}</td>
                  <td style={{ textAlign: "right", color: e.findings_count > 0 ? "#ef4444" : "inherit", fontWeight: e.findings_count > 0 ? 600 : 400 }}>
                    {e.findings_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
