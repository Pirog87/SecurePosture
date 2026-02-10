import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { OverdueRisk } from "../types";

export default function ReviewsPage() {
  const [overdue, setOverdue] = useState<OverdueRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<OverdueRisk[]>("/api/v1/risk-reviews/overdue")
      .then(setOverdue)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="grid-3">
        <div className="card kpi">
          <div className="value" style={{ color: "var(--red)" }}>{overdue.length || "—"}</div>
          <div className="label">Przeterminowane przeglądy</div>
        </div>
        <div className="card kpi">
          <div className="value" style={{ color: "var(--yellow)" }}>—</div>
          <div className="label">Do przeglądu w tym miesiącu</div>
        </div>
        <div className="card kpi">
          <div className="value" style={{ color: "var(--green)" }}>—</div>
          <div className="label">Aktualne</div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">
          Ryzyka Wymagające Przeglądu <span style={{ color: "var(--red)" }}>(przeterminowane &gt;90 dni)</span>
        </div>
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Ładowanie...</p>
        ) : overdue.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak przeterminowanych przeglądów lub brak połączenia z API.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Aktywo</th><th>Pion</th>
                <th>Ostatni przegląd</th><th>Dni od przeglądu</th><th>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((r) => (
                <tr key={r.risk_id}>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.code}</td>
                  <td>{r.asset_name}</td>
                  <td>{r.org_unit_name}</td>
                  <td>{r.last_review_at ?? "Nigdy"}</td>
                  <td>
                    <span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)" }}>
                      {r.days_since_review} dni
                    </span>
                  </td>
                  <td><button className="btn btn-sm">✓ Przejrzyj</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
