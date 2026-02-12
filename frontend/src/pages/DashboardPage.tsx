import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { ExecutiveSummary, RiskDashboard, PostureScoreResponse, RiskMatrixCell, OrgUnitTreeNode } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";

function gradeColor(g: string | null) {
  if (!g) return "var(--text-muted)";
  return g === "A" ? "var(--green)" : g === "B" ? "var(--cyan)" : g === "C" ? "var(--yellow)" : g === "D" ? "var(--orange)" : "var(--red)";
}
function riskColor(lv: string) { return lv === "high" ? "var(--red)" : lv === "medium" ? "var(--orange)" : "var(--green)"; }
function riskBg(lv: string) { return lv === "high" ? "var(--red-dim)" : lv === "medium" ? "var(--orange-dim)" : "var(--green-dim)"; }
function pctColor(v: number) { return v >= 75 ? "var(--green)" : v >= 50 ? "var(--yellow)" : v >= 25 ? "var(--orange)" : "var(--red)"; }

function matrixBg(impact: number, prob: number): string {
  const score = impact * prob;
  if (score >= 6) return "var(--red)";
  if (score >= 3) return "var(--orange)";
  return "var(--green)";
}

function matrixCount(matrix: RiskMatrixCell[], impact: number, prob: number): number {
  return matrix.find(c => c.impact === impact && c.probability === prob)?.count ?? 0;
}

export default function DashboardPage() {
  const [exec, setExec] = useState<ExecutiveSummary | null>(null);
  const [riskDash, setRiskDash] = useState<RiskDashboard | null>(null);
  const [posture, setPosture] = useState<PostureScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const navigate = useNavigate();

  const loadData = (orgUnitId?: string) => {
    setLoading(true);
    const qs = orgUnitId ? `?org_unit_id=${orgUnitId}` : "";
    Promise.all([
      api.get<ExecutiveSummary>(`/api/v1/dashboard/executive-summary${qs}`).catch(() => null),
      api.get<RiskDashboard>(`/api/v1/dashboard/risks${qs}`).catch(() => null),
      api.get<PostureScoreResponse>(`/api/v1/dashboard/posture-score${qs}`).catch(() => null),
    ]).then(([e, r, p]) => {
      setExec(e); setRiskDash(r); setPosture(p);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
    loadData();
  }, []);

  const handleOrgChange = (val: string) => {
    setOrgFilter(val);
    loadData(val || undefined);
  };

  if (loading && !exec) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ładowanie dashboardu...</span>
    </div>;
  }

  const score = posture?.score ?? exec?.posture_score ?? 0;
  const grade = posture?.grade ?? exec?.posture_grade ?? null;
  const circ = 2 * Math.PI * 50;
  const offset = circ - (score / 100) * circ;
  const rc = exec?.risk_counts ?? riskDash?.risk_counts ?? { high: 0, medium: 0, low: 0, total: 0 };

  return (
    <div>
      {/* Org Unit Filter */}
      <div className="toolbar">
        <div className="toolbar-left">
          <OrgUnitTreeSelect
            tree={orgTree}
            value={orgFilter ? Number(orgFilter) : null}
            onChange={id => handleOrgChange(id ? String(id) : "")}
            placeholder="Cała organizacja"
            allowClear
            style={{ width: 300 }}
          />
          {loading && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odświeżanie...</span>}
        </div>
        <div className="toolbar-right">
          {posture?.benchmark_avg != null && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Benchmark avg: <strong style={{ color: pctColor(posture.benchmark_avg) }}>{Math.round(posture.benchmark_avg)}%</strong>
            </span>
          )}
        </div>
      </div>

      {/* KPI ROW */}
      <div className="grid-4">
        <div className="card kpi clickable" onClick={() => {}}>
          <div className="value" style={{ color: gradeColor(grade) }}>{score ? Math.round(score) : "—"}</div>
          <div className="label">Security Posture Score</div>
          {grade && <div className="trend" style={{ background: `${gradeColor(grade)}20`, color: gradeColor(grade) }}>Ocena: {grade}</div>}
        </div>
        <div className="card kpi clickable" onClick={() => navigate("/risks?level=high")}>
          <div className="value" style={{ color: "var(--red)" }}>{rc.high || "—"}</div>
          <div className="label">Ryzyka Wysokie</div>
          <div className="trend" style={{ background: "var(--red-dim)", color: "var(--red)" }}>z {rc.total} wszystkich</div>
        </div>
        <div className="card kpi clickable" onClick={() => navigate("/cis")}>
          <div className="value" style={{ color: "var(--yellow)" }}>
            {exec?.cis_maturity_rating != null ? exec.cis_maturity_rating.toFixed(2) : "—"}
          </div>
          <div className="label">CIS Maturity</div>
          <div className="trend" style={{ background: "var(--yellow-dim)", color: "var(--yellow)" }}>Skala 0–5</div>
        </div>
        <div className="card kpi clickable" onClick={() => navigate("/reviews")}>
          <div className="value" style={{ color: exec?.overdue_reviews_count ? "var(--orange)" : "var(--green)" }}>
            {exec?.overdue_reviews_count ?? "—"}
          </div>
          <div className="label">Przeterminowane przeglądy</div>
          {(exec?.overdue_reviews_count ?? 0) > 0 ? (
            <div className="trend" style={{ background: "var(--orange-dim)", color: "var(--orange)" }}>Wymaga akcji</div>
          ) : null}
        </div>
      </div>

      {/* MAIN: Risk Matrix + Posture Score */}
      <div className="grid-2-1">
        <div className="card">
          <div className="card-title">Macierz Ryzyka (Wpływ x Prawdopodobieństwo)</div>
          <div style={{ padding: "8px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(3, 1fr)", gap: 6, maxWidth: 400 }}>
              <div />
              {["W=1 Niski", "W=2 Średni", "W=3 Wysoki"].map(h => (
                <div key={h} className="heatmap-header">{h}</div>
              ))}
              {[3, 2, 1].map(prob => (
                <div key={`row-${prob}`} style={{ display: "contents" }}>
                  <div className="heatmap-label" style={{ lineHeight: "40px" }}>P={prob}</div>
                  {[1, 2, 3].map(impact => {
                    const cnt = riskDash ? matrixCount(riskDash.matrix, impact, prob) : 0;
                    return (
                      <div key={`${impact}-${prob}`} className="heatmap-cell"
                        style={{
                          background: cnt > 0 ? matrixBg(impact, prob) : "rgba(255,255,255,0.03)",
                          color: cnt > 0 ? "#fff" : "var(--text-muted)",
                          height: 40,
                          opacity: cnt > 0 ? 1 : 0.5,
                          cursor: cnt > 0 ? "pointer" : "default",
                        }}
                        onClick={() => cnt > 0 && navigate(`/risks?impact=${impact}&prob=${prob}`)}
                      >
                        {cnt > 0 ? cnt : "—"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
              R = EXP(W) &times; P / Z &nbsp;|&nbsp; Wysoki &ge;221 &nbsp; Średni 31–220 &nbsp; Niski &lt;31
            </div>
          </div>

          {/* Risk by Area breakdown */}
          {riskDash && riskDash.by_area.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Ryzyka wg Obszarów</div>
              {riskDash.by_area.map(a => (
                <div key={a.area_id} className="bar-row">
                  <div className="bar-label">{a.area_name}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${Math.min(100, (a.total / Math.max(1, rc.total)) * 100)}%`,
                      background: `linear-gradient(90deg, var(--red) ${(a.high / Math.max(1, a.total)) * 100}%, var(--orange) ${(a.high / Math.max(1, a.total)) * 100}%, var(--orange) ${((a.high + a.medium) / Math.max(1, a.total)) * 100}%, var(--green) ${((a.high + a.medium) / Math.max(1, a.total)) * 100}%)`,
                    }} data-value={String(a.total)} />
                  </div>
                  <div className="bar-score" style={{ color: a.high > 0 ? "var(--red)" : "var(--text-secondary)" }}>{a.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="card-title">Security Posture</div>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <div className="score-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle className="ring-bg" cx="60" cy="60" r="50" />
                  <circle className="ring-fill" cx="60" cy="60" r="50"
                    stroke={gradeColor(grade)}
                    strokeDasharray={circ}
                    strokeDashoffset={offset} />
                </svg>
                <div className="ring-label">
                  <div className="num" style={{ color: gradeColor(grade) }}>{score ? Math.round(score) : "—"}</div>
                  <div className="of">/ 100</div>
                </div>
              </div>
            </div>
            {grade && <div style={{ fontSize: 20, fontWeight: 700, color: gradeColor(grade), margin: "4px 0" }}>Ocena: {grade}</div>}
          </div>

          {/* Posture Dimensions */}
          {posture && posture.dimensions.length > 0 && (
            <div className="card">
              <div className="card-title">Wymiary Bezpieczeństwa</div>
              {posture.dimensions.map(d => (
                <div key={d.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: pctColor(d.score) }}>
                      {Math.round(d.score)}%
                      <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>({Math.round(d.weight * 100)}%)</span>
                    </span>
                  </div>
                  <div className="bar-track" style={{ height: 8 }}>
                    <div className="bar-fill" style={{ width: `${d.score}%`, background: d.color ?? pctColor(d.score), height: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-title">CIS Maturity</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 28, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "var(--yellow)" }}>
                {exec?.cis_maturity_rating?.toFixed(2) ?? "—"}
              </div>
              <div>
                <div style={{ fontSize: 12 }}>Maturity Rating</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Skala 0–5</div>
              </div>
            </div>
            {exec?.cis_risk_addressed_pct != null && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "var(--text-secondary)" }}>% Risk Addressed</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: pctColor(exec.cis_risk_addressed_pct) }}>{Math.round(exec.cis_risk_addressed_pct)}%</span>
                </div>
                <div className="bar-track" style={{ height: 8 }}>
                  <div className="bar-fill" style={{ width: `${exec.cis_risk_addressed_pct}%`, background: pctColor(exec.cis_risk_addressed_pct), height: 8 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TOP RISKS + DISTRIBUTION */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Top 5 Ryzyk Krytycznych</div>
          {exec?.top_risks && exec.top_risks.length > 0 ? (
            <table className="data-table">
              <thead><tr><th>Aktywo</th><th>Pion</th><th>Ocena</th><th>Status</th></tr></thead>
              <tbody>
                {exec.top_risks.slice(0, 5).map(r => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/risks?highlight=${r.id}`)}>
                    <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                    <td style={{ fontSize: 12 }}>{r.org_unit}</td>
                    <td><span className="score-badge" style={{ background: riskBg(r.risk_level), color: riskColor(r.risk_level) }}>{r.risk_score.toFixed(1)}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak danych o ryzykach.</p>
          )}
        </div>

        <div className="card">
          <div className="card-title">Rozkład Ryzyk</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Wysokie", count: rc.high, color: "var(--red)", bg: "var(--red-dim)", level: "high" },
              { label: "Średnie", count: rc.medium, color: "var(--orange)", bg: "var(--orange-dim)", level: "medium" },
              { label: "Niskie", count: rc.low, color: "var(--green)", bg: "var(--green-dim)", level: "low" },
            ].map(r => (
              <div key={r.label} style={{ flex: 1, textAlign: "center", background: r.bg, borderRadius: 8, padding: "12px 8px", cursor: "pointer" }}
                onClick={() => navigate(`/risks?level=${r.level}`)}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: r.color }}>{r.count}</div>
                <div style={{ fontSize: 11, color: r.color }}>{r.label}</div>
              </div>
            ))}
          </div>
          {riskDash && riskDash.by_org_unit.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Ryzyka wg Pionów</div>
              {riskDash.by_org_unit.map(u => (
                <div key={u.org_unit_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(42,53,84,0.25)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{u.org_unit_name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {u.high > 0 && <span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)" }}>{u.high}</span>}
                    {u.medium > 0 && <span className="score-badge" style={{ background: "var(--orange-dim)", color: "var(--orange)" }}>{u.medium}</span>}
                    {u.low > 0 && <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>{u.low}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RISK BY STATUS */}
      {riskDash && riskDash.by_status.length > 0 && (
        <div className="card">
          <div className="card-title">Status Ryzyk</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {riskDash.by_status.map(s => (
              <div key={s.status} style={{
                background: s.status_color ? `${s.status_color}20` : "var(--bg-card)",
                border: `1px solid ${s.status_color ?? "var(--border)"}`,
                borderRadius: 8, padding: "10px 16px", textAlign: "center", minWidth: 100,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: s.status_color ?? "var(--text)" }}>{s.count}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RISK TREND */}
      {riskDash && riskDash.trend.length > 1 && (
        <div className="card">
          <div className="card-title">Trend Ryzyk (12 mies.)</div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 120 }}>
            {riskDash.trend.map(t => {
              const maxTotal = Math.max(...riskDash.trend.map(p => p.total), 1);
              const h = (t.total / maxTotal) * 100;
              const highPct = (t.high / Math.max(t.total, 1)) * 100;
              const medPct = (t.medium / Math.max(t.total, 1)) * 100;
              return (
                <div key={t.period} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)" }}>{t.total}</div>
                  <div style={{ width: "100%", maxWidth: 40, height: `${h}%`, minHeight: 2, borderRadius: "4px 4px 0 0", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: "100%", background: "var(--green)" }} />
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${highPct + medPct}%`, background: "var(--orange)" }} />
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${highPct}%`, background: "var(--red)" }} />
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.period}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 10 }}>
            {[{ label: "Wysokie", color: "var(--red)" }, { label: "Średnie", color: "var(--orange)" }, { label: "Niskie", color: "var(--green)" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} /> {l.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OVERDUE REVIEWS */}
      {riskDash && riskDash.overdue_reviews.length > 0 && (
        <div className="card">
          <div className="card-title">
            Przeterminowane Przeglądy
            <span style={{ fontSize: 11, color: "var(--red)", marginLeft: 8 }}>({riskDash.overdue_reviews.length})</span>
          </div>
          <table className="data-table">
            <thead><tr><th>Aktywo</th><th>Pion</th><th>Ocena</th><th>Dni od przeglądu</th><th>Właściciel</th></tr></thead>
            <tbody>
              {riskDash.overdue_reviews.slice(0, 10).map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                  <td style={{ fontSize: 12 }}>{r.org_unit}</td>
                  <td><span className="score-badge" style={{ background: riskBg(r.risk_level), color: riskColor(r.risk_level) }}>{r.risk_score.toFixed(1)}</span></td>
                  <td><span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)" }}>{r.days_since_review} dni</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.owner ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
