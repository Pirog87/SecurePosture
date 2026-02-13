import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";

/* ─── Types ─── */
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

interface AuditEngagement {
  id: number;
  ref_id: string;
  name: string;
  framework_name: string;
  status: string;
  priority: string;
  lead_auditor: string;
  planned_start: string | null;
  planned_end: string | null;
  tests_count: number;
  findings_count: number;
}

interface AuditProgram {
  id: number;
  name: string;
  year: number;
  status: string;
  engagement_count: number;
}

/* ─── Helpers ─── */
const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  in_progress: "var(--blue)",
  completed: "var(--green)",
  archived: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  in_progress: "W toku",
  completed: "Zakończona",
  archived: "Archiwalna",
};

const ENG_STATUS_COLORS: Record<string, string> = {
  planned: "#94a3b8",
  scoping: "var(--purple)",
  fieldwork: "var(--yellow)",
  reporting: "var(--blue)",
  review: "var(--cyan)",
  completed: "var(--green)",
  closed: "#6b7280",
  cancelled: "var(--red)",
};

const ENG_STATUS_LABELS: Record<string, string> = {
  planned: "Zaplanowane",
  scoping: "Scoping",
  fieldwork: "Fieldwork",
  reporting: "Raportowanie",
  review: "Review",
  completed: "Zakończone",
  closed: "Zamknięte",
  cancelled: "Anulowane",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--blue)",
  low: "var(--green)",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Krytyczny",
  high: "Wysoki",
  medium: "Średni",
  low: "Niski",
};

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-muted)";
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--yellow)";
  return "var(--red)";
}

function scoreBg(score: number | null): string {
  if (score == null) return "transparent";
  if (score >= 80) return "var(--green-dim)";
  if (score >= 60) return "var(--yellow-dim)";
  return "var(--red-dim)";
}

/* ═══════════════════════════════════════════════════════════
   ComplianceDashboardPage — enriched overview
   ═══════════════════════════════════════════════════════════ */
export default function ComplianceDashboardPage() {
  const [assessments, setAssessments] = useState<ComplianceAssessment[]>([]);
  const [engagements, setEngagements] = useState<AuditEngagement[]>([]);
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get<ComplianceAssessment[]>("/api/v1/compliance-assessments/"),
      api.get<AuditEngagement[]>("/api/v1/audit-engagements/"),
      api.get<AuditProgram[]>("/api/v1/audit-programs/").catch(() => [] as AuditProgram[]),
    ])
      .then(([ca, ae, ap]) => {
        setAssessments(ca);
        setEngagements(ae);
        setPrograms(ap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeAssessments = assessments.filter(a => a.status !== "archived");
  const scored = activeAssessments.filter(a => a.compliance_score != null);
  const avgScore = scored.length > 0
    ? scored.reduce((s, a) => s + (a.compliance_score ?? 0), 0) / scored.length
    : null;
  const openEngagements = engagements.filter(e => !["completed", "closed", "cancelled"].includes(e.status));
  const totalFindings = engagements.reduce((s, e) => s + e.findings_count, 0);
  const activePrograms = programs.filter(p => ["active", "approved"].includes(p.status));

  const stats: StatCard[] = [
    { label: "Aktywne oceny", value: activeAssessments.length, color: "var(--blue)" },
    { label: "Średni % zgodności", value: avgScore != null ? `${avgScore.toFixed(1)}%` : "—", color: scoreColor(avgScore) },
    { label: "Otwarte audyty", value: openEngagements.length, color: "var(--orange)" },
    { label: "Ustalenia audytowe", value: totalFindings, color: totalFindings > 0 ? "var(--red)" : "var(--green)" },
  ];

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>;
  }

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Compliance & Audit Dashboard</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/compliance/assessments")}>+ Nowa ocena</button>
          <button className="btn btn-sm" onClick={() => navigate("/audit-engagements")}>+ Nowy audyt</button>
        </div>
      </div>

      <StatsCards cards={stats} />

      {/* Quick nav cards */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Oceny Zgodności", count: activeAssessments.length, to: "/compliance/assessments", color: "var(--blue)" },
          { label: "Programy Audytów", count: activePrograms.length, to: "/audit-programs", color: "var(--purple)" },
          { label: "Zadania Audytowe", count: openEngagements.length, to: "/audit-engagements", color: "var(--orange)" },
          { label: "Ustalenia", count: totalFindings, to: "/audit-findings", color: totalFindings > 0 ? "var(--red)" : "var(--green)" },
        ].map(item => (
          <div
            key={item.label}
            className="card"
            style={{ padding: "12px 16px", cursor: "pointer", borderLeft: `3px solid ${item.color}` }}
            onClick={() => navigate(item.to)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {item.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Compliance Assessments table ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Oceny zgodności</h3>
          <button className="btn btn-xs" onClick={() => navigate("/compliance/assessments")}>Zobacz wszystkie</button>
        </div>
        {activeAssessments.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            Brak ocen zgodności. Utwórz pierwszą ocenę dla wybranego frameworka.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                {activeAssessments.slice(0, 10).map(a => {
                  const progress = a.total_requirements > 0
                    ? Math.round((a.assessed_count / a.total_requirements) * 100)
                    : 0;
                  return (
                    <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/compliance/assessments/${a.id}`)}>
                      <td style={{ fontWeight: 600 }}>{a.framework_name}</td>
                      <td>{a.scope_name || a.scope_type}</td>
                      <td>
                        <span className="badge" style={{
                          backgroundColor: `${STATUS_COLORS[a.status] || "#94a3b8"}20`,
                          color: STATUS_COLORS[a.status] || "#94a3b8",
                        }}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {a.compliance_score != null ? (
                          <span style={{
                            background: scoreBg(a.compliance_score), color: scoreColor(a.compliance_score),
                            borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                          }}>
                            {a.compliance_score}%
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                          <div style={{ width: 60, height: 6, backgroundColor: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              width: `${progress}%`, height: "100%",
                              backgroundColor: progress >= 80 ? "var(--green)" : progress >= 50 ? "var(--yellow)" : "var(--red)",
                              borderRadius: 3,
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{progress}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontSize: 12 }}>
                        <span style={{ color: "var(--green)", fontWeight: 600 }}>{a.compliant_count}</span>
                        <span style={{ color: "var(--text-muted)" }}> / {a.total_requirements}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Active Audit Engagements table ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Aktywne zadania audytowe</h3>
          <button className="btn btn-xs" onClick={() => navigate("/audit-engagements")}>Zobacz wszystkie</button>
        </div>
        {openEngagements.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            Brak aktywnych zadań audytowych.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                {openEngagements.slice(0, 10).map(e => (
                  <tr key={e.id} style={{ cursor: "pointer", borderLeft: `3px solid ${PRIORITY_COLORS[e.priority] || "transparent"}` }} onClick={() => navigate(`/audit-engagements/${e.id}`)}>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>{e.ref_id}</td>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td>{e.framework_name}</td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: `${ENG_STATUS_COLORS[e.status] || "#94a3b8"}20`,
                        color: ENG_STATUS_COLORS[e.status] || "#94a3b8",
                      }}>
                        {ENG_STATUS_LABELS[e.status] || e.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: PRIORITY_COLORS[e.priority] || "inherit", fontWeight: 600, fontSize: 12 }}>
                        {PRIORITY_LABELS[e.priority] || e.priority}
                      </span>
                    </td>
                    <td>{e.lead_auditor}</td>
                    <td style={{ textAlign: "right" }}>{e.tests_count}</td>
                    <td style={{ textAlign: "right", color: e.findings_count > 0 ? "var(--red)" : "inherit", fontWeight: e.findings_count > 0 ? 600 : 400 }}>
                      {e.findings_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Programs section ── */}
      {programs.length > 0 && (
        <div className="card">
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Programy audytów</h3>
            <button className="btn btn-xs" onClick={() => navigate("/audit-programs")}>Zobacz wszystkie</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, padding: 16 }}>
            {programs.slice(0, 6).map(p => (
              <div
                key={p.id}
                className="card"
                style={{ padding: "12px 16px", cursor: "pointer" }}
                onClick={() => navigate(`/audit-engagements?program_id=${p.id}`)}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge" style={{
                    backgroundColor: p.status === "active" ? "var(--blue-dim)" : "var(--bg-subtle)",
                    color: p.status === "active" ? "var(--blue)" : "var(--text-muted)",
                  }}>
                    {p.status} — {p.year}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--blue)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {p.engagement_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
