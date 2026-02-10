import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { ExecutiveSummary } from "../types";

function getColor(s: number) { return s >= 75 ? "var(--green)" : s >= 50 ? "var(--yellow)" : s >= 25 ? "var(--orange)" : "var(--red)"; }
function getBg(s: number) { return s >= 75 ? "var(--green-dim)" : s >= 50 ? "var(--yellow-dim)" : s >= 25 ? "var(--orange-dim)" : "var(--red-dim)"; }

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<ExecutiveSummary>("/api/v1/dashboard/executive-summary")
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const overall = data?.overall_score ?? 0;
  const kpis = [
    { value: data ? String(overall) : "—", label: "Ogólny Wynik", color: getColor(overall), bg: getBg(overall), trend: "↑ aktualny" },
    { value: data ? String(data.high_risks) : "—", label: "Ryzyka Krytyczne", color: "var(--red)", bg: "var(--red-dim)", trend: "Wymaga akcji" },
    { value: data ? String(data.medium_risks) : "—", label: "Ryzyka Średnie", color: "var(--orange)", bg: "var(--orange-dim)", trend: "" },
    { value: data ? (data.cis_maturity_avg !== undefined ? Math.round(data.cis_maturity_avg * 100) + "%" : "—") : "—", label: "CIS Maturity Avg", color: "var(--yellow)", bg: "var(--yellow-dim)", trend: "" },
  ];

  const circ = 2 * Math.PI * 50;
  const offset = circ - (overall / 100) * circ;

  return (
    <div>
      <div className="grid-4">
        {kpis.map((k) => (
          <div key={k.label} className="card kpi">
            <div className="value" style={{ color: k.color }}>{k.value}</div>
            <div className="label">{k.label}</div>
            {k.trend && (
              <div className="trend" style={{ background: k.bg, color: k.color }}>{k.trend}</div>
            )}
          </div>
        ))}
      </div>
      <div className="grid-2-1">
        <div className="card">
          <div className="card-title">Heatmapa: Obszary Ryzyka x Piony Biznesowe</div>
          {error ? (
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Nie udało się pobrać danych z API. Upewnij się, że backend jest uruchomiony.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Heatmapa zostanie wypełniona danymi z API /api/v1/dashboard/risks
            </p>
          )}
        </div>
        <div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="card-title">Ogólny Wynik</div>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <div className="score-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle className="ring-bg" cx="60" cy="60" r="50" />
                  <circle className="ring-fill" cx="60" cy="60" r="50"
                    stroke={getColor(overall)}
                    strokeDasharray={circ}
                    strokeDashoffset={offset} />
                </svg>
                <div className="ring-label">
                  <div className="num" style={{ color: getColor(overall) }}>{overall || "—"}</div>
                  <div className="of">/ 100</div>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">CIS Maturity</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 28, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "var(--yellow)" }}>
                {data?.cis_maturity_avg?.toFixed(2) ?? "—"}
              </div>
              <div>
                <div style={{ fontSize: 12 }}>Maturity Rating</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Skala 0–5</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title">TOP 5 Ryzyk Krytycznych</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Dane z API</p>
        </div>
        <div className="card">
          <div className="card-title">Przeterminowane Przeglądy</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {data ? `${data.overdue_reviews} przeterminowanych` : "Dane z API"}
          </p>
        </div>
      </div>
    </div>
  );
}
