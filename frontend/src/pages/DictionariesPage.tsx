import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { DictionaryTypeWithEntries } from "../types";

export default function DictionariesPage() {
  const [dicts, setDicts] = useState<DictionaryTypeWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await api.get<DictionaryTypeWithEntries[]>(
          "/api/v1/dictionaries"
        );
        if (!cancelled) { setDicts(types); setError(null); }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ładowanie słowników...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>
          Nie udało się załadować słowników
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-all" }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="grid-3">
      {dicts.map((d) => (
        <div key={d.id} className="card" style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>{d.name}</div>
            <span className="badge-blue" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8 }}>
              {d.entries.length}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {d.entries
              .filter((e) => e.is_active)
              .map((entry) => (
                <span
                  key={entry.id}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {entry.label}
                </span>
              ))}
          </div>
          {d.is_system && (
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>
              Słownik systemowy
            </div>
          )}
        </div>
      ))}
      {dicts.length === 0 && (
        <div style={{ gridColumn: "span 3", textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "48px 0" }}>
          Brak słowników w systemie.
        </div>
      )}
    </div>
  );
}
