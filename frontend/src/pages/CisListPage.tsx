import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { CisAssessment, CisDashboard, CisTrend, OrgUnitTreeNode } from "../types";

function pctColor(v: number) { return v >= 75 ? "var(--green)" : v >= 50 ? "var(--yellow)" : v >= 25 ? "var(--orange)" : "var(--red)"; }
function pctBg(v: number) { return v >= 75 ? "var(--green-dim)" : v >= 50 ? "var(--yellow-dim)" : v >= 25 ? "var(--orange-dim)" : "var(--red-dim)"; }
function matColor(v: number) { return v >= 4 ? "var(--green)" : v >= 3 ? "var(--cyan)" : v >= 2 ? "var(--yellow)" : v >= 1 ? "var(--orange)" : "var(--red)"; }

function flattenTree(nodes: OrgUnitTreeNode[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

export default function CisListPage() {
  const [assessments, setAssessments] = useState<CisAssessment[]>([]);
  const [cisDash, setCisDash] = useState<CisDashboard | null>(null);
  const [cisTrend, setCisTrend] = useState<CisTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgUnits, setOrgUnits] = useState<{ id: number; name: string; depth: number }[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const navigate = useNavigate();

  const loadData = (orgUnitId?: string) => {
    setLoading(true);
    const qs = orgUnitId ? `?org_unit_id=${orgUnitId}` : "";
    Promise.all([
      api.get<CisAssessment[]>(`/api/v1/cis/assessments${qs}`).catch(() => []),
      api.get<CisDashboard>(`/api/v1/dashboard/cis${qs}`).catch(() => null),
      api.get<CisTrend>(`/api/v1/dashboard/cis/trend${qs}`).catch(() => null),
    ]).then(([a, d, t]) => {
      setAssessments(a); setCisDash(d); setCisTrend(t);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(t => setOrgUnits(flattenTree(t))).catch(() => {});
    loadData();
  }, []);

  const handleOrgChange = (val: string) => {
    setOrgFilter(val);
    loadData(val || undefined);
  };

  const dims = cisDash?.overall_dimensions;
  const ig = cisDash?.ig_scores;
  const trendPts = cisTrend?.points ?? [];

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 220 }} value={orgFilter} onChange={e => handleOrgChange(e.target.value)}>
            <option value="">Cała organizacja</option>
            {orgUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>CIS Controls v8</span>
          {loading && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odświeżanie...</span>}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/cis/assess")}>+ Nowa ocena</button>
        </div>
      </div>

      {/* CIS Dashboard KPIs */}
      {cisDash && (
        <>
          <div className="grid-4">
            <div className="card kpi">
              <div className="value" style={{ color: matColor(cisDash.maturity_rating ?? 0) }}>
                {cisDash.maturity_rating?.toFixed(2) ?? "—"}
              </div>
              <div className="label">Maturity Rating</div>
              <div className="trend" style={{ background: "var(--yellow-dim)", color: "var(--yellow)" }}>/ 5.0</div>
            </div>
            <div className="card kpi">
              <div className="value" style={{ color: pctColor(cisDash.risk_addressed_pct ?? 0) }}>
                {cisDash.risk_addressed_pct != null ? `${Math.round(cisDash.risk_addressed_pct)}%` : "—"}
              </div>
              <div className="label">% Risk Addressed</div>
            </div>
            <div className="card kpi">
              <div className="value" style={{ color: "var(--blue)" }}>{cisDash.controls.length}</div>
              <div className="label">Kontroli CIS</div>
            </div>
            <div className="card kpi">
              <div className="value" style={{ color: "var(--purple)" }}>{assessments.length}</div>
              <div className="label">Ocen w systemie</div>
            </div>
          </div>

          <div className="grid-2">
            {/* IG Progress */}
            <div className="card">
              <div className="card-title">Implementation Groups (IG)</div>
              {[
                { label: "IG1 — Basic Cyber Hygiene", score: ig?.ig1 ?? 0, color: "var(--green)" },
                { label: "IG2 — Enhanced", score: ig?.ig2 ?? 0, color: "var(--cyan)" },
                { label: "IG3 — Advanced", score: ig?.ig3 ?? 0, color: "var(--purple)" },
              ].map(g => (
                <div key={g.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{g.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: g.color }}>
                      {g.score != null ? `${Math.round(g.score)}%` : "—"}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${g.score}%`, background: g.color }} data-value={`${Math.round(g.score)}%`} />
                  </div>
                </div>
              ))}
            </div>

            {/* 4 Dimensions */}
            <div className="card">
              <div className="card-title">4 Wymiary Oceny</div>
              {[
                { label: "Policy (Polityka)", pct: dims?.policy_pct ?? 0, color: "var(--blue)" },
                { label: "Implementation (Wdrożenie)", pct: dims?.implementation_pct ?? 0, color: "var(--green)" },
                { label: "Automation (Automatyzacja)", pct: dims?.automation_pct ?? 0, color: "var(--purple)" },
                { label: "Reporting (Raportowanie)", pct: dims?.reporting_pct ?? 0, color: "var(--cyan)" },
              ].map(d => (
                <div key={d.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{d.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: d.color }}>
                      {d.pct != null ? `${Math.round(d.pct)}%` : "—"}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${d.pct}%`, background: d.color }} data-value={`${Math.round(d.pct)}%`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CIS MATURITY TREND */}
          {trendPts.length > 1 && (
            <div className="card">
              <div className="card-title">Trend Dojrzałości CIS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Maturity Rating trend */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10 }}>
                    Maturity Rating
                  </div>
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 100 }}>
                    {trendPts.map((pt, i) => {
                      const val = pt.maturity_rating ?? 0;
                      const h = (val / 5) * 100;
                      return (
                        <div key={pt.assessment_id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: matColor(val) }}>{val.toFixed(1)}</div>
                          <div style={{
                            width: "100%", maxWidth: 32, height: `${Math.max(h, 4)}%`, borderRadius: "4px 4px 0 0",
                            background: matColor(val),
                            opacity: i === trendPts.length - 1 ? 1 : 0.6,
                          }} />
                          <div style={{ fontSize: 8, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{pt.assessment_date?.slice(5, 10)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* IG scores trend */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10 }}>
                    IG Scores (%)
                  </div>
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 100 }}>
                    {trendPts.map((pt, i) => {
                      const ig1 = pt.ig1 ?? 0;
                      const ig2 = pt.ig2 ?? 0;
                      const ig3 = pt.ig3 ?? 0;
                      const isLast = i === trendPts.length - 1;
                      return (
                        <div key={pt.assessment_id} style={{ flex: 1, display: "flex", gap: 1, alignItems: "flex-end", height: "100%" }}>
                          <div style={{ flex: 1, height: `${Math.max(ig1, 2)}%`, background: "var(--green)", borderRadius: "3px 3px 0 0", opacity: isLast ? 1 : 0.5 }} title={`IG1: ${Math.round(ig1)}%`} />
                          <div style={{ flex: 1, height: `${Math.max(ig2, 2)}%`, background: "var(--cyan)", borderRadius: "3px 3px 0 0", opacity: isLast ? 1 : 0.5 }} title={`IG2: ${Math.round(ig2)}%`} />
                          <div style={{ flex: 1, height: `${Math.max(ig3, 2)}%`, background: "var(--purple)", borderRadius: "3px 3px 0 0", opacity: isLast ? 1 : 0.5 }} title={`IG3: ${Math.round(ig3)}%`} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
                    {[{ label: "IG1", color: "var(--green)" }, { label: "IG2", color: "var(--cyan)" }, { label: "IG3", color: "var(--purple)" }].map(l => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "var(--text-muted)" }}>
                        <div style={{ width: 6, height: 6, borderRadius: 1, background: l.color }} /> {l.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Per-control maturity bars */}
          {cisDash.controls.length > 0 && (
            <div className="card">
              <div className="card-title">Dojrzałość per Kontrola CIS</div>
              {cisDash.controls.map(c => {
                const pct = c.risk_addressed_pct ?? 0;
                return (
                  <div key={c.control_number} className="bar-row">
                    <div className="bar-label">
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)", marginRight: 6 }}>
                        CSC {c.control_number}
                      </span>
                      {c.name_pl}
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: pctColor(pct) }} data-value={`${Math.round(pct)}%`} />
                    </div>
                    <div className="bar-score" style={{ color: pctColor(pct) }}>{Math.round(pct)}%</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ATT&CK capabilities */}
          {cisDash.attack_capabilities.length > 0 && (
            <div className="card">
              <div className="card-title">MITRE ATT&CK — Zdolności Obronne</div>
              <table className="data-table">
                <thead>
                  <tr><th>Aktywność</th><th>Prewencja</th><th>Detekcja</th></tr>
                </thead>
                <tbody>
                  {cisDash.attack_capabilities.map(a => (
                    <tr key={a.activity}>
                      <td style={{ fontSize: 12 }}>{a.activity}</td>
                      <td>
                        <span className="score-badge" style={{
                          background: a.preventive_level === "High" ? "var(--green-dim)" : a.preventive_level === "Moderate" ? "var(--yellow-dim)" : "var(--red-dim)",
                          color: a.preventive_level === "High" ? "var(--green)" : a.preventive_level === "Moderate" ? "var(--yellow)" : "var(--red)",
                        }}>
                          {a.preventive_score != null ? `${Math.round(a.preventive_score)}%` : a.preventive_level}
                        </span>
                      </td>
                      <td>
                        <span className="score-badge" style={{
                          background: a.detective_level === "High" ? "var(--green-dim)" : a.detective_level === "Moderate" ? "var(--yellow-dim)" : "var(--red-dim)",
                          color: a.detective_level === "High" ? "var(--green)" : a.detective_level === "Moderate" ? "var(--yellow)" : "var(--red)",
                        }}>
                          {a.detective_score != null ? `${Math.round(a.detective_score)}%` : a.detective_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Assessment List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <div className="card-title">Historia Ocen CIS</div>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie...</div>
        ) : assessments.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Brak ocen CIS. Kliknij "+ Nowa ocena" aby rozpocząć.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Data oceny</th><th>Jednostka</th><th>Oceniający</th>
                <th>Maturity</th><th>% Risk Addr.</th><th>IG1</th><th>IG2</th><th>IG3</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const pct = a.risk_addressed_pct ?? 0;
                return (
                  <tr key={a.id}>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.id}</td>
                    <td>{a.assessment_date?.slice(0, 10)}</td>
                    <td>{a.org_unit_name ?? "Cała org."}</td>
                    <td>{a.assessor_name ?? "—"}</td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: matColor(a.maturity_rating ?? 0) }}>
                        {a.maturity_rating?.toFixed(2) ?? "—"}
                      </span>
                    </td>
                    <td><span className="score-badge" style={{ background: pctBg(pct), color: pctColor(pct) }}>{Math.round(pct)}%</span></td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.ig1_score != null ? `${Math.round(a.ig1_score)}%` : "—"}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.ig2_score != null ? `${Math.round(a.ig2_score)}%` : "—"}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.ig3_score != null ? `${Math.round(a.ig3_score)}%` : "—"}</td>
                    <td><span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>{a.status_name ?? "—"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
