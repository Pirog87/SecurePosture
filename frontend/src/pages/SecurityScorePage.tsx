import { useEffect, useState } from "react";

interface PillarDetail {
  name: string;
  score: number;
  weight: number;
  weighted_contribution: number;
}

interface ScoreData {
  total_score: number;
  rating: string;
  color: string;
  pillars: PillarDetail[];
  config_version: number;
  calculated_at: string;
}

interface SnapshotRecord {
  id: number;
  snapshot_date: string;
  total_score: number;
  risk_score: number | null;
  vulnerability_score: number | null;
  incident_score: number | null;
  exception_score: number | null;
  maturity_score: number | null;
  audit_score: number | null;
  asset_score: number | null;
  tprm_score: number | null;
  policy_score: number | null;
  awareness_score: number | null;
  triggered_by: string | null;
}

interface MethodologyPillar {
  name: string;
  weight: number;
  description: string;
  data_source: string;
  formula: string;
  current_score: number;
}

interface Methodology {
  title: string;
  config_version: number;
  scale_description: string;
  pillars: MethodologyPillar[];
  total_score: number;
  rating: string;
}

const API = import.meta.env.VITE_API_URL ?? "";

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#ca8a04";
  if (score >= 40) return "#ea580c";
  return "#dc2626";
}

function scoreBg(score: number): string {
  if (score >= 80) return "#dcfce7";
  if (score >= 60) return "#fef9c3";
  if (score >= 40) return "#fed7aa";
  return "#fecaca";
}

export default function SecurityScorePage() {
  const [score, setScore] = useState<ScoreData | null>(null);
  const [history, setHistory] = useState<SnapshotRecord[]>([]);
  const [methodology, setMethodology] = useState<Methodology | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "methodology" | "history">("dashboard");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [sr, hr, mr] = await Promise.all([
        fetch(`${API}/api/v1/security-score`),
        fetch(`${API}/api/v1/security-score/history?limit=30`),
        fetch(`${API}/api/v1/security-score/methodology`),
      ]);
      if (sr.ok) setScore(await sr.json());
      if (hr.ok) setHistory(await hr.json());
      if (mr.ok) setMethodology(await mr.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function forceSnapshot() {
    const r = await fetch(`${API}/api/v1/security-score/snapshot`, { method: "POST" });
    if (r.ok) loadAll();
  }

  if (loading) return <div className="page-container"><p>Ładowanie...</p></div>;

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Security Score</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${activeTab === "dashboard" ? "btn-primary" : ""}`} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
          <button className={`btn ${activeTab === "methodology" ? "btn-primary" : ""}`} onClick={() => setActiveTab("methodology")}>Metodologia</button>
          <button className={`btn ${activeTab === "history" ? "btn-primary" : ""}`} onClick={() => setActiveTab("history")}>Historia</button>
          <button className="btn" onClick={forceSnapshot} title="Wymuś snapshot">Snapshot</button>
        </div>
      </div>

      {activeTab === "dashboard" && score && (
        <>
          {/* Gauge */}
          <div className="card" style={{ padding: 24, textAlign: "center", marginBottom: 16 }}>
            <div style={{
              display: "inline-block", width: 180, height: 180, borderRadius: "50%",
              border: `8px solid ${score.color}`,
              backgroundColor: scoreBg(score.total_score),
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              margin: "0 auto",
            }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: score.color }}>{score.total_score}</div>
              <div style={{ fontSize: 14, color: score.color, fontWeight: 600 }}>{score.rating}</div>
            </div>
            <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
              Config v{score.config_version}
            </div>
          </div>

          {/* Pillar Breakdown */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Rozbicie na filary</h3>
            {score.pillars
              .sort((a, b) => b.weight - a.weight)
              .map(p => (
                <div key={p.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span><strong>{p.name}</strong> ({p.weight}%)</span>
                    <span style={{ color: scoreColor(p.score), fontWeight: 600 }}>{p.score}</span>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 4, height: 20, overflow: "hidden" }}>
                    <div style={{
                      width: `${p.score}%`, height: "100%",
                      background: scoreColor(p.score), borderRadius: 4,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
              ))}
          </div>

          {/* Worst 3 pillars */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Najsłabsze filary</h3>
            {score.pillars
              .sort((a, b) => a.score - b.score)
              .slice(0, 3)
              .map((p, i) => (
                <div key={p.name} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "8px 12px", marginBottom: 4,
                  background: i === 0 ? "#fef2f2" : i === 1 ? "#fffbeb" : "#f0f9ff",
                  borderRadius: 6, alignItems: "center",
                }}>
                  <span>
                    <strong>#{i + 1}</strong> {p.name}
                    <span style={{ color: "#9ca3af", marginLeft: 8, fontSize: 12 }}>waga: {p.weight}%</span>
                  </span>
                  <span style={{ color: scoreColor(p.score), fontWeight: 700, fontSize: 18 }}>{p.score}</span>
                </div>
              ))}
          </div>
        </>
      )}

      {activeTab === "methodology" && methodology && (
        <div className="card" style={{ padding: 16 }}>
          <h3>{methodology.title}</h3>
          <p style={{ color: "#6b7280", marginBottom: 16 }}>
            {methodology.scale_description}<br />
            Config v{methodology.config_version} | Wynik: <strong style={{ color: scoreColor(methodology.total_score) }}>{methodology.total_score}</strong> ({methodology.rating})
          </p>
          {methodology.pillars.map(p => (
            <div key={p.name} className="card" style={{ padding: 12, marginBottom: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong>{p.name}</strong>
                <span style={{ color: scoreColor(p.current_score), fontWeight: 600 }}>
                  {p.current_score} ({p.weight}%)
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{p.description}</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                Źródło: {p.data_source}<br />
                Formuła: <code>{p.formula}</code>
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "history" && (
        <table className="data-table">
          <thead><tr>
            <th>Data</th><th>Wynik</th><th>Risk</th><th>Vuln</th><th>Inc</th><th>Exc</th>
            <th>Matur.</th><th>Audit</th><th>Asset</th><th>TPRM</th><th>Policy</th><th>Aware.</th><th>Trigger</th>
          </tr></thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id}>
                <td style={{ fontSize: 12 }}>{new Date(h.snapshot_date).toLocaleString("pl-PL")}</td>
                <td style={{ color: scoreColor(h.total_score), fontWeight: 700 }}>{h.total_score}</td>
                <td>{h.risk_score ?? "—"}</td>
                <td>{h.vulnerability_score ?? "—"}</td>
                <td>{h.incident_score ?? "—"}</td>
                <td>{h.exception_score ?? "—"}</td>
                <td>{h.maturity_score ?? "—"}</td>
                <td>{h.audit_score ?? "—"}</td>
                <td>{h.asset_score ?? "—"}</td>
                <td>{h.tprm_score ?? "—"}</td>
                <td>{h.policy_score ?? "—"}</td>
                <td>{h.awareness_score ?? "—"}</td>
                <td style={{ fontSize: 11 }}>{h.triggered_by ?? "—"}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center", color: "#9ca3af" }}>Brak snapshotów</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
