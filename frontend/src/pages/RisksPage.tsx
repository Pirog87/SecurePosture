import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Risk } from "../types";
import { useNavigate } from "react-router-dom";

function riskColor(R: number) { return R >= 221 ? "var(--red)" : R >= 31 ? "var(--orange)" : "var(--green)"; }
function riskBg(R: number) { return R >= 221 ? "var(--red-dim)" : R >= 31 ? "var(--orange-dim)" : "var(--green-dim)"; }
function riskLabel(R: number) { return R >= 221 ? "Wysokie" : R >= 31 ? "Średnie" : "Niskie"; }

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Risk[]>("/api/v1/risks")
      .then(setRisks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 160 }}>
            <option>Wszystkie piony</option>
          </select>
          <select className="form-control" style={{ width: 160 }}>
            <option>Wszystkie statusy</option>
            <option>Zidentyfikowane</option>
            <option>W analizie</option>
            <option>W mitygacji</option>
            <option>Zaakceptowane</option>
            <option>Zamknięte</option>
          </select>
          <select className="form-control" style={{ width: 140 }}>
            <option>Poziom ryzyka</option>
            <option>Wysokie</option>
            <option>Średnie</option>
            <option>Niskie</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-sm">📥 Eksport</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/risks")}>
            + Dodaj ryzyko
          </button>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Ładowanie ryzyk...
          </div>
        ) : risks.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Brak ryzyk w systemie lub nie udało się połączyć z API.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Aktywo</th><th>Pion</th><th>Obszar</th>
                <th>W</th><th>P</th><th>Z</th><th>Ocena (R)</th>
                <th>Status</th><th>Właściciel</th>
              </tr>
            </thead>
            <tbody>
              {risks.sort((a, b) => b.risk_score - a.risk_score).map((r) => (
                <tr key={r.id} style={{ borderLeft: `3px solid ${riskColor(r.risk_score)}` }}>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{r.code}</td>
                  <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                  <td>{r.org_unit_name}</td>
                  <td>{r.security_area_name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.impact_w}</td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.probability_p}</td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.safeguard_rating_z}</td>
                  <td>
                    <span className="score-badge" style={{ background: riskBg(r.risk_score), color: riskColor(r.risk_score) }}>
                      {r.risk_score.toFixed(1)} {riskLabel(r.risk_score)}
                    </span>
                  </td>
                  <td>
                    <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
                      {r.status_name ?? "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.owner ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
