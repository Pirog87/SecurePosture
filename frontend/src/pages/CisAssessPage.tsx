import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { CisControl } from "../types";

function cisColor(s: number) { return s >= 0.7 ? "var(--green)" : s >= 0.4 ? "var(--yellow)" : s > 0 ? "var(--orange)" : "var(--red)"; }

export default function CisAssessPage() {
  const [controls, setControls] = useState<CisControl[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CisControl[]>("/api/v1/cis/controls")
      .then(setControls)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left" style={{ alignItems: "center" }}>
          <select className="form-control" style={{ width: 200 }}>
            <option>Cała organizacja</option>
          </select>
          <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>Robocza</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-sm">💾 Zapisz roboczą</button>
          <button className="btn btn-primary btn-sm">✅ Zatwierdź</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie kontroli CIS...</div>
      ) : controls.length === 0 ? (
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak kontroli CIS lub brak połączenia z API.</p>
        </div>
      ) : (
        <div>
          {controls.map((c) => {
            const isExpanded = expanded.has(c.id);
            return (
              <div key={c.id} className={`cis-control-card${isExpanded ? " expanded" : ""}`}>
                <div className="cis-control-header" onClick={() => toggle(c.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)", minWidth: 50 }}>
                      CSC #{c.number}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name_pl}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "0 18px 16px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                      {c.name_en} — {c.sub_controls.length} sub-kontroli
                    </div>
                    {c.sub_controls.map((sc) => (
                      <div key={sc.id} style={{
                        display: "grid",
                        gridTemplateColumns: "60px 1fr repeat(4, 110px)",
                        gap: 8, alignItems: "center", padding: "8px 0",
                        borderBottom: "1px solid rgba(42,53,84,0.25)", fontSize: 12,
                      }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)", fontSize: 11 }}>
                          {sc.number}
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.3 }}>
                          {sc.name_pl || sc.name_en || `Sub-kontrola ${sc.number}`}
                        </div>
                        {["Policy", "Implemented", "Automated", "Reported"].map((dim) => (
                          <select key={dim} className="cis-select">
                            <option>Wybierz...</option>
                            <option>0</option>
                            <option>1</option>
                            <option>2</option>
                            <option>3</option>
                            <option>4</option>
                            <option>5</option>
                            <option>N/A</option>
                          </select>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
