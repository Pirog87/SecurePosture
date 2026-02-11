import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { AssessmentDetail, AssessmentAnswer, AssessmentScore, Dimension, FrameworkDetail } from "../types";

export default function AssessmentFormPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  const [score, setScore] = useState<AssessmentScore | null>(null);
  const [framework, setFramework] = useState<FrameworkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"answers" | "scores">("answers");

  useEffect(() => {
    if (!assessmentId) return;
    setLoading(true);
    api.get<AssessmentDetail>(`/api/v1/assessments/${assessmentId}`)
      .then(a => {
        setAssessment(a);
        return Promise.all([
          api.get<AssessmentAnswer[]>(`/api/v1/assessments/${assessmentId}/answers`),
          api.get<AssessmentScore>(`/api/v1/assessments/${assessmentId}/score`),
          api.get<FrameworkDetail>(`/api/v1/frameworks/${a.framework_id}`),
        ]);
      })
      .then(([ans, sc, fw]) => {
        setAnswers(ans);
        setScore(sc);
        setFramework(fw);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assessmentId]);

  // Group answers by node
  const nodeGroups = useMemo(() => {
    const groups: Map<number, { ref_id: string | null; name: string | null; answers: AssessmentAnswer[] }> = new Map();
    for (const a of answers) {
      if (!groups.has(a.framework_node_id)) {
        groups.set(a.framework_node_id, { ref_id: a.node_ref_id, name: a.node_name, answers: [] });
      }
      groups.get(a.framework_node_id)!.answers.push(a);
    }
    return Array.from(groups.entries());
  }, [answers]);

  // Get dimension levels from framework
  const dimensionLevels = useMemo(() => {
    if (!framework) return new Map<number, { id: number; value: number; label: string }[]>();
    const map = new Map<number, { id: number; value: number; label: string }[]>();
    for (const dim of framework.dimensions) {
      map.set(dim.id, dim.levels.map(l => ({ id: l.id, value: l.value, label: l.label_pl || l.label })));
    }
    return map;
  }, [framework]);

  const handleAnswerChange = async (answerId: number, levelId: number | null, notApplicable: boolean) => {
    setSaving(true);
    try {
      const qs = new URLSearchParams();
      if (levelId != null) qs.set("level_id", String(levelId));
      qs.set("not_applicable", String(notApplicable));
      const res = await api.patch<{ overall_score: number | null; completion_pct: number | null }>(
        `/api/v1/assessments/${assessmentId}/answers/${answerId}?${qs.toString()}`, {}
      );
      // Update local answer
      setAnswers(prev => prev.map(a =>
        a.id === answerId ? { ...a, level_id: levelId, not_applicable: notApplicable } : a
      ));
      // Update score display
      if (score) {
        setScore({ ...score, overall_score: res.overall_score, completion_pct: res.completion_pct });
      }
      if (assessment) {
        setAssessment({ ...assessment, overall_score: res.overall_score, completion_pct: res.completion_pct });
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!assessmentId || !confirm("Zatwierdzic ocene?")) return;
    const res = await api.post<AssessmentDetail>(`/api/v1/assessments/${assessmentId}/approve?approved_by=CISO`, {});
    setAssessment(res);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ladowanie oceny...</div>;
  }
  if (!assessment) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ocena nie znaleziona</div>;
  }

  const pct = assessment.completion_pct ?? 0;
  const scr = assessment.overall_score;

  return (
    <div>
      {/* Header */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-sm" onClick={() => navigate("/assessments")} style={{ marginRight: 8 }}>
            &larr; Wstecz
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {assessment.title || assessment.ref_id || `Ocena #${assessment.id}`}
            </h2>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {assessment.framework_name} | {assessment.assessment_date}
              {assessment.org_unit_name && ` | ${assessment.org_unit_name}`}
              {assessment.assessor && ` | ${assessment.assessor}`}
            </div>
          </div>
        </div>
        <div className="toolbar-right" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {saving && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Zapisywanie...</span>}
          {/* Score indicators */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Ukonczenie</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: pct >= 100 ? "var(--green)" : "var(--yellow)" }}>
              {pct.toFixed(0)}%
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Wynik</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: scr != null ? (scr >= 75 ? "var(--green)" : scr >= 50 ? "var(--yellow)" : "var(--red)") : "var(--text-muted)" }}>
              {scr != null ? `${scr.toFixed(1)}%` : "—"}
            </div>
          </div>
          {assessment.status !== "approved" && (
            <button className="btn btn-primary" onClick={handleApprove}>Zatwierdz</button>
          )}
          {assessment.status === "approved" && (
            <span className="badge badge-green" style={{ fontSize: 12, padding: "4px 12px" }}>Zatwierdzony</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ padding: "8px 12px", marginBottom: 12 }}>
        <div className="bar-track" style={{ height: 8 }}>
          <div className="bar-fill" style={{ width: `${pct}%`, height: 8, background: pct >= 100 ? "var(--green)" : "var(--blue)" }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button className={`btn btn-sm ${tab === "answers" ? "btn-primary" : ""}`} onClick={() => setTab("answers")}>
          Formularz odpowiedzi ({answers.length})
        </button>
        <button className={`btn btn-sm ${tab === "scores" ? "btn-primary" : ""}`} onClick={() => setTab("scores")}>
          Wyniki
        </button>
      </div>

      {tab === "answers" && (
        <div style={{ display: "grid", gap: 10 }}>
          {nodeGroups.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Brak pytan do oceny.
            </div>
          ) : nodeGroups.map(([nodeId, group]) => (
            <div key={nodeId} className="card" style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {group.ref_id && (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--blue)", fontWeight: 600 }}>
                    {group.ref_id}
                  </span>
                )}
                <span style={{ fontWeight: 600, fontSize: 13 }}>{group.name}</span>
              </div>
              {group.answers.map(ans => (
                <div key={ans.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "4px 0", borderTop: "1px solid rgba(42,53,84,0.08)", fontSize: 12,
                }}>
                  <span style={{ width: 100, flexShrink: 0, fontSize: 10, color: "var(--text-muted)" }}>
                    {ans.dimension_key}
                  </span>
                  <select
                    className="form-control"
                    style={{ flex: 1, maxWidth: 300 }}
                    value={ans.not_applicable ? "NA" : (ans.level_id ?? "")}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === "NA") {
                        handleAnswerChange(ans.id, null, true);
                      } else if (val === "") {
                        handleAnswerChange(ans.id, null, false);
                      } else {
                        handleAnswerChange(ans.id, Number(val), false);
                      }
                    }}
                    disabled={assessment.status === "approved"}
                  >
                    <option value="">-- Wybierz --</option>
                    {(dimensionLevels.get(ans.dimension_id) ?? []).map(lv => (
                      <option key={lv.id} value={lv.id}>{lv.value} — {lv.label}</option>
                    ))}
                    <option value="NA">N/A (nie dotyczy)</option>
                  </select>
                  {ans.level_label && !ans.not_applicable && (
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{ans.level_label}</span>
                  )}
                  {ans.not_applicable && (
                    <span className="badge badge-gray" style={{ fontSize: 9 }}>N/A</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "scores" && score && (
        <ScoresPanel score={score} dimensions={framework?.dimensions ?? []} />
      )}
    </div>
  );
}

/* ─── Scores Panel ─── */
function ScoresPanel({ score, dimensions }: { score: AssessmentScore; dimensions: Dimension[] }) {
  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <StatCard label="Wynik ogolny" value={score.overall_score != null ? `${score.overall_score.toFixed(1)}%` : "—"} color={score.overall_score != null && score.overall_score >= 75 ? "var(--green)" : "var(--yellow)"} />
        <StatCard label="Ukonczenie" value={`${(score.completion_pct ?? 0).toFixed(0)}%`} color="var(--blue)" />
        <StatCard label="Ocenialne" value={String(score.total_assessable)} color="var(--text-primary)" />
        <StatCard label="Odpowiedziane" value={String(score.answered_count)} color="var(--cyan)" />
        <StatCard label="N/A" value={String(score.na_count)} color="var(--text-muted)" />
      </div>

      {/* Dimension averages */}
      {Object.keys(score.dimension_averages).length > 0 && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Srednie wymiarow</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {Object.entries(score.dimension_averages).map(([key, val]) => {
              const dim = dimensions.find(d => d.dimension_key === key);
              return (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <span style={{ fontSize: 12 }}>{dim?.name_pl || dim?.name || key}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 13, color: val != null && val >= 75 ? "var(--green)" : val != null && val >= 50 ? "var(--yellow)" : "var(--red)" }}>
                    {val != null ? `${val.toFixed(1)}%` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IG scores */}
      {Object.keys(score.ig_scores).length > 0 && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Wyniki wg Implementation Groups</div>
          <div style={{ display: "flex", gap: 16 }}>
            {Object.entries(score.ig_scores).map(([ig, val]) => (
              <div key={ig} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{ig}</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: val != null && val >= 75 ? "var(--green)" : "var(--yellow)" }}>
                  {val != null ? `${val.toFixed(1)}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Node scores */}
      {score.node_scores.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Kontrola</th>
                <th style={{ textAlign: "right" }}>Wynik</th>
                {dimensions.map(d => <th key={d.id} style={{ textAlign: "right", fontSize: 10 }}>{d.dimension_key}</th>)}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {score.node_scores.map(ns => (
                <tr key={ns.framework_node_id} style={{ opacity: ns.not_applicable ? 0.5 : 1 }}>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--blue)" }}>{ns.ref_id}</td>
                  <td style={{ fontSize: 12 }}>{ns.name}</td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                    {ns.score != null ? `${ns.score.toFixed(1)}%` : "—"}
                  </td>
                  {dimensions.map(d => (
                    <td key={d.id} style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                      {ns.dimension_scores[d.dimension_key] != null
                        ? `${ns.dimension_scores[d.dimension_key]!.toFixed(0)}%`
                        : "—"}
                    </td>
                  ))}
                  <td>
                    {ns.not_applicable ? <span className="badge badge-gray" style={{ fontSize: 9 }}>N/A</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color }}>{value}</div>
    </div>
  );
}
