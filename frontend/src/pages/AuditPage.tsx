import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { AuditLogPage } from "../types";

export default function AuditPage() {
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AuditLogPage>("/api/v1/audit-log")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 160 }}>
            <option>Wszystkie moduły</option>
            <option>Analiza Ryzyka</option>
            <option>CIS Benchmark</option>
            <option>Struktura Org.</option>
            <option>Słowniki</option>
          </select>
          <input type="date" className="form-control" style={{ width: 160 }} defaultValue="2026-01-01" />
          <input type="date" className="form-control" style={{ width: 160 }} defaultValue="2026-02-10" />
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie...</div>
        ) : !data || data.items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Brak wpisów w audit trail lub brak połączenia z API.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th><th>Użytkownik</th><th>Moduł</th>
                <th>Obiekt</th><th>Pole</th><th>Stara wartość</th><th>Nowa wartość</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{a.created_at}</td>
                  <td>{a.user_name ?? "system"}</td>
                  <td>
                    <span className="score-badge" style={{ background: "var(--purple-dim)", color: "var(--purple)" }}>{a.module}</span>
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.entity_type}#{a.entity_id}</td>
                  <td>{a.field_name ?? "—"}</td>
                  <td style={{ color: "var(--red)", fontSize: 12 }}>{a.old_value ?? "—"}</td>
                  <td style={{ color: "var(--green)", fontSize: 12 }}>{a.new_value ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
