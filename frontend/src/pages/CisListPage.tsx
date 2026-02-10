import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { CisAssessment } from "../types";

function getColor(s: number) { return s >= 75 ? "var(--green)" : s >= 50 ? "var(--yellow)" : s >= 25 ? "var(--orange)" : "var(--red)"; }
function getBg(s: number) { return s >= 75 ? "var(--green-dim)" : s >= 50 ? "var(--yellow-dim)" : s >= 25 ? "var(--orange-dim)" : "var(--red-dim)"; }

export default function CisListPage() {
  const [assessments, setAssessments] = useState<CisAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<CisAssessment[]>("/api/v1/cis/assessments")
      .then(setAssessments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 180 }}>
            <option>Wszystkie jednostki</option>
            <option>Cała organizacja</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/cis/assess")}>
            + Nowa ocena
          </button>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie...</div>
        ) : assessments.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Brak ocen CIS lub brak połączenia z API.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Data oceny</th><th>Jednostka</th><th>Oceniający</th>
                <th>Maturity Rating</th><th>% Risk Addressed</th><th>Status</th><th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const pct = a.risk_addressed_pct ?? 0;
                return (
                  <tr key={a.id}>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.id}</td>
                    <td>{a.assessment_date}</td>
                    <td>{a.org_unit_name ?? "Cała organizacja"}</td>
                    <td>{a.assessor ?? "—"}</td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "var(--yellow)" }}>
                        {a.maturity_rating?.toFixed(2) ?? "—"}
                      </span> / 5.0
                    </td>
                    <td>
                      <span className="score-badge" style={{ background: getBg(pct), color: getColor(pct) }}>
                        {pct}%
                      </span>
                    </td>
                    <td>
                      <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm">👁 Podgląd</button>
                    </td>
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
