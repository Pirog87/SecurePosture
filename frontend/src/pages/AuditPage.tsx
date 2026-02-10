import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { AuditLogPage } from "../types";

const modules = ["", "risks", "cis", "org_units", "dictionaries", "security_areas", "threats", "vulnerabilities", "safeguards"];
const moduleLabels: Record<string, string> = {
  "": "Wszystkie moduły", risks: "Analiza Ryzyka", cis: "CIS Benchmark",
  org_units: "Struktura Org.", dictionaries: "Słowniki", security_areas: "Obszary bezp.",
  threats: "Zagrożenia", vulnerabilities: "Podatności", safeguards: "Zabezpieczenia",
};

const actionColors: Record<string, { bg: string; fg: string }> = {
  create: { bg: "var(--green-dim)", fg: "var(--green)" },
  update: { bg: "var(--blue-dim)", fg: "var(--blue)" },
  delete: { bg: "var(--red-dim)", fg: "var(--red)" },
  review: { bg: "var(--yellow-dim)", fg: "var(--yellow)" },
  approve: { bg: "var(--purple-dim)", fg: "var(--purple)" },
};

export default function AuditPage() {
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const loadAudit = (mod: string, act: string, pg: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (mod) params.set("module", mod);
    if (act) params.set("action", act);
    params.set("page", String(pg));
    params.set("per_page", "50");
    const qs = params.toString();
    api.get<AuditLogPage>(`/api/v1/audit-log?${qs}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAudit(module, action, page); }, [module, action, page]);

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 180 }} value={module} onChange={e => { setModule(e.target.value); setPage(1); }}>
            {modules.map(m => <option key={m} value={m}>{moduleLabels[m] ?? m}</option>)}
          </select>
          <select className="form-control" style={{ width: 140 }} value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
            <option value="">Wszystkie akcje</option>
            <option value="create">Utworzenie</option>
            <option value="update">Zmiana</option>
            <option value="delete">Usunięcie</option>
            <option value="review">Przegląd</option>
            <option value="approve">Zatwierdzenie</option>
          </select>
          {(module || action) && (
            <button className="btn btn-sm" onClick={() => { setModule(""); setAction(""); setPage(1); }}>Wyczyść filtry</button>
          )}
        </div>
        <div className="toolbar-right">
          {data && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {data.total} wpisów · Strona {data.page} / {totalPages || 1}
            </span>
          )}
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie...</div>
        ) : !data || data.items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Brak wpisów w audit trail.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th><th>Akcja</th><th>Moduł</th>
                <th>Obiekt</th><th>Pole</th><th>Stara wartość</th><th>Nowa wartość</th><th>Użytkownik</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => {
                const ac = actionColors[a.action] ?? { bg: "var(--blue-dim)", fg: "var(--blue)" };
                return (
                  <tr key={a.id}>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {a.created_at?.replace("T", " ").slice(0, 19)}
                    </td>
                    <td><span className="score-badge" style={{ background: ac.bg, color: ac.fg }}>{a.action}</span></td>
                    <td><span className="score-badge" style={{ background: "var(--purple-dim)", color: "var(--purple)" }}>{a.module}</span></td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.entity_type}#{a.entity_id}</td>
                    <td style={{ fontSize: 12 }}>{a.field_name ?? "—"}</td>
                    <td style={{ color: "var(--red)", fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.old_value ?? "—"}</td>
                    <td style={{ color: "var(--green)", fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.new_value ?? "—"}</td>
                    <td style={{ fontSize: 12 }}>{a.user_name ?? "system"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Poprzednia</button>
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{page} / {totalPages}</span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Następna</button>
        </div>
      )}
    </div>
  );
}
