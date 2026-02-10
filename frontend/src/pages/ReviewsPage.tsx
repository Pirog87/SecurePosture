import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { OverdueRisk, RiskReview } from "../types";
import Modal from "../components/Modal";

export default function ReviewsPage() {
  const [overdue, setOverdue] = useState<OverdueRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [reviewRisk, setReviewRisk] = useState<OverdueRisk | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOverdue = () => {
    api.get<OverdueRisk[]>("/api/v1/risk-reviews/overdue")
      .then(setOverdue)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOverdue(); }, []);

  const openReview = (risk: OverdueRisk) => {
    setReviewRisk(risk);
    setShowReview(true);
  };

  const handleSubmitReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reviewRisk) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      risk_id: reviewRisk.risk_id,
      notes: (fd.get("notes") as string) || null,
    };
    try {
      await api.post<RiskReview>("/api/v1/risk-reviews", body);
      setShowReview(false);
      setLoading(true);
      loadOverdue();
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

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
                  <td><button className="btn btn-sm" onClick={() => openReview(r)}>✓ Przejrzyj</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showReview} onClose={() => setShowReview(false)} title={`Przegląd: ${reviewRisk?.asset_name ?? ""}`}>
        {reviewRisk && (
          <form onSubmit={handleSubmitReview}>
            <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
              <p>Ryzyko: <strong>{reviewRisk.code}</strong> — {reviewRisk.asset_name}</p>
              <p>Pion: {reviewRisk.org_unit_name}</p>
              <p>Ostatni przegląd: {reviewRisk.last_review_at ?? "Nigdy"} ({reviewRisk.days_since_review} dni temu)</p>
            </div>
            <div className="form-group">
              <label>Notatki z przeglądu</label>
              <textarea name="notes" className="form-control" rows={4} placeholder="Opisz wynik przeglądu ryzyka..." />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setShowReview(false)}>Anuluj</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Zapisywanie..." : "Zarejestruj przegląd"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
