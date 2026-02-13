import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";

interface Assessment {
  id: number;
  framework_id: number;
  framework_name: string;
  scope_name: string | null;
  scope_type: string;
  status: string;
  name: string | null;
  compliance_score: number | null;
  total_requirements: number;
  assessed_count: number;
  compliant_count: number;
  partially_count: number;
  non_compliant_count: number;
  not_applicable_count: number;
}

interface RequirementAssessment {
  id: number;
  requirement_node_id: number;
  node_ref_id: string | null;
  node_name: string | null;
  node_name_pl: string | null;
  node_depth: number | null;
  node_assessable: boolean | null;
  result: string;
  score: number | null;
  maturity_level: string | null;
  assessor_name: string | null;
  notes: string | null;
  justification: string | null;
  evidence_count: number;
}

const RESULT_OPTIONS = [
  { value: "not_assessed", label: "Nieocenione", color: "#94a3b8", icon: "○" },
  { value: "compliant", label: "Zgodne", color: "#22c55e", icon: "✓" },
  { value: "partially_compliant", label: "Częściowo zgodne", color: "#f59e0b", icon: "◐" },
  { value: "non_compliant", label: "Niezgodne", color: "#ef4444", icon: "✗" },
  { value: "not_applicable", label: "Nie dotyczy", color: "#6b7280", icon: "—" },
];

function resultInfo(result: string) {
  return RESULT_OPTIONS.find((o) => o.value === result) || RESULT_OPTIONS[0];
}

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-muted)";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export default function ComplianceAssessmentFormPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [requirements, setRequirements] = useState<RequirementAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!assessmentId) return;
    try {
      const [ca, reqs] = await Promise.all([
        api.get<Assessment>(`/api/v1/compliance-assessments/${assessmentId}`),
        api.get<RequirementAssessment[]>(`/api/v1/compliance-assessments/${assessmentId}/requirements?selected_only=false`),
      ]);
      setAssessment(ca);
      setRequirements(reqs);
      // Auto-expand top-level sections
      const topLevel = new Set(reqs.filter((r) => r.node_depth === 1).map((r) => r.requirement_node_id));
      setExpandedSections(topLevel);
    } catch {
      alert("Błąd wczytywania oceny");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => { load(); }, [load]);

  const updateResult = async (ra: RequirementAssessment, newResult: string) => {
    setSaving(ra.id);
    try {
      const updated = await api.put<RequirementAssessment>(
        `/api/v1/compliance-assessments/requirements/${ra.id}`,
        { result: newResult },
      );
      setRequirements((prev) => prev.map((r) => (r.id === ra.id ? { ...r, ...updated } : r)));
      // Refresh scores
      const ca = await api.get<Assessment>(`/api/v1/compliance-assessments/${assessmentId}`);
      setAssessment(ca);
    } catch {
      alert("Błąd zapisu");
    } finally {
      setSaving(null);
    }
  };

  const toggleSection = (nodeId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  if (loading || !assessment) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>;
  }

  const progress = assessment.total_requirements > 0
    ? Math.round((assessment.assessed_count / assessment.total_requirements) * 100)
    : 0;

  const stats: StatCard[] = [
    { label: "Zgodność", value: assessment.compliance_score != null ? `${assessment.compliance_score}%` : "—", color: scoreColor(assessment.compliance_score) },
    { label: "Postęp oceny", value: `${progress}%`, color: progress >= 80 ? "#22c55e" : "#f59e0b" },
    { label: "Zgodne", value: assessment.compliant_count, color: "#22c55e" },
    { label: "Niezgodne", value: assessment.non_compliant_count, color: "#ef4444" },
  ];

  // Build hierarchical view: sections (non-assessable) contain assessable items
  const _sections = requirements.filter((r) => r.node_assessable === false || r.node_depth === 1);
  void _sections;
  const _assessableItems = requirements.filter((r) => r.node_assessable === true);
  void _assessableItems;

  // Group assessable items by their parent section (approximate by depth)
  const getParentSectionId = (item: RequirementAssessment): number | null => {
    // Find the closest section above this item in the array
    const idx = requirements.indexOf(item);
    for (let i = idx - 1; i >= 0; i--) {
      const prev = requirements[i];
      if (prev.node_depth != null && item.node_depth != null && prev.node_depth < item.node_depth) {
        return prev.requirement_node_id;
      }
    }
    return null;
  };

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <button className="btn btn-xs" onClick={() => navigate("/compliance/assessments")} style={{ marginBottom: 8 }}>
            ← Powrót
          </button>
          <h2 style={{ margin: 0 }}>
            {assessment.name || assessment.framework_name}
          </h2>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {assessment.framework_name} | {assessment.scope_name || assessment.scope_type} | Status: {assessment.status}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {assessment.status === "draft" && (
            <button
              className="btn btn-primary"
              onClick={async () => {
                await api.put(`/api/v1/compliance-assessments/${assessmentId}`, { status: "in_progress" });
                load();
              }}
            >
              Rozpocznij ocenę
            </button>
          )}
          {assessment.status === "in_progress" && (
            <button
              className="btn btn-primary"
              onClick={async () => {
                await api.put(`/api/v1/compliance-assessments/${assessmentId}`, { status: "completed" });
                load();
              }}
            >
              Zakończ ocenę
            </button>
          )}
        </div>
      </div>

      <StatsCards cards={stats} />

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>
          <span>Postęp: {assessment.assessed_count} / {assessment.total_requirements} wymagań</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: 8, backgroundColor: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", backgroundColor: progress >= 80 ? "#22c55e" : progress >= 50 ? "#f59e0b" : "#3b82f6", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Requirement tree */}
      <div className="card">
        {requirements.map((req) => {
          const info = resultInfo(req.result);
          const isSection = req.node_assessable === false;
          const isAssessable = req.node_assessable === true;
          const depth = req.node_depth || 1;
          const isExpanded = expandedSections.has(req.requirement_node_id);

          // Skip non-section items that are under a collapsed section
          if (!isSection && depth > 1) {
            const parentId = getParentSectionId(req);
            if (parentId && !expandedSections.has(parentId)) return null;
          }

          if (isSection) {
            // Count assessable children
            const idx = requirements.indexOf(req);
            let childCount = 0;
            let childCompliant = 0;
            for (let i = idx + 1; i < requirements.length; i++) {
              const next = requirements[i];
              if (next.node_depth != null && next.node_depth <= depth) break;
              if (next.node_assessable) {
                childCount++;
                if (next.result === "compliant") childCompliant++;
              }
            }

            return (
              <div
                key={req.id}
                style={{
                  padding: "10px 16px",
                  paddingLeft: 16 + (depth - 1) * 20,
                  backgroundColor: depth === 1 ? "var(--bg-subtle)" : undefined,
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => toggleSection(req.requirement_node_id)}
              >
                <div>
                  <span style={{ marginRight: 8, fontSize: 12 }}>{isExpanded ? "▼" : "▶"}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {req.node_ref_id && <span style={{ color: "var(--text-muted)", marginRight: 6 }}>{req.node_ref_id}</span>}
                    {req.node_name_pl || req.node_name}
                  </span>
                </div>
                {childCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {childCompliant}/{childCount} ✓
                  </span>
                )}
              </div>
            );
          }

          if (isAssessable) {
            return (
              <div
                key={req.id}
                style={{
                  padding: "8px 16px",
                  paddingLeft: 16 + (depth - 1) * 20,
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  opacity: saving === req.id ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>
                    {req.node_ref_id && (
                      <span style={{ color: "var(--text-muted)", marginRight: 6, fontFamily: "monospace", fontSize: 11 }}>
                        {req.node_ref_id}
                      </span>
                    )}
                    {req.node_name_pl || req.node_name}
                  </div>
                  {req.notes && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{req.notes}</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {req.evidence_count > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }} title="Dowody">
                      📎{req.evidence_count}
                    </span>
                  )}
                  <select
                    className="form-control"
                    value={req.result}
                    onChange={(e) => updateResult(req, e.target.value)}
                    disabled={saving === req.id}
                    style={{
                      width: 180,
                      fontSize: 12,
                      color: info.color,
                      fontWeight: 600,
                      padding: "4px 8px",
                    }}
                  >
                    {RESULT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
