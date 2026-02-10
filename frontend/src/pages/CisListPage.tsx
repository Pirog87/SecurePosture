import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { CisAssessment, CisDashboard } from "../types";

function pctColor(v: number) { return v >= 75 ? "var(--green)" : v >= 50 ? "var(--yellow)" : v >= 25 ? "var(--orange)" : "var(--red)"; }
function pctBg(v: number) { return v >= 75 ? "var(--green-dim)" : v >= 50 ? "var(--yellow-dim)" : v >= 25 ? "var(--orange-dim)" : "var(--red-dim)"; }
function matColor(v: number) { return v >= 4 ? "var(--green)" : v >= 3 ? "var(--cyan)" : v >= 2 ? "var(--yellow)" : v >= 1 ? "var(--orange)" : "var(--red)"; }

export default function CisListPage() {
  const [assessments, setAssessments] = useState<CisAssessment[]>([]);
  const [cisDash, setCisDash] = useState<CisDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get<CisAssessment[]>("/api/v1/cis/assessments").catch(() => []),
      api.get<CisDashboard>("/api/v1/dashboard/cis").catch(() => null),
    ]).then(([a, d]) => {
      setAssessments(a); setCisDash(d);
    }).finally(() => setLoading(false));
  }, []);

  const dims = cisDash?.overall_dimensions;
  const ig = cisDash?.ig_scores;

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>CIS Controls v8 — Ocena dojrzałości</span>
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
