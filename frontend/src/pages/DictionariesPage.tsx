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
        if (!cancelled) {
          setDicts(types);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted text-sm">Ładowanie słowników...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-card border border-border rounded-[10px] p-5">
        <div className="text-accent-red text-sm mb-2">
          Nie udało się załadować słowników
        </div>
        <div className="text-xs text-text-muted font-mono break-all">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3.5">
      {dicts.map((d) => (
        <div
          key={d.id}
          className="bg-bg-card border border-border rounded-[10px] p-5 cursor-pointer hover:border-border-light transition-colors"
        >
          <div className="flex justify-between items-center mb-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {d.name}
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-dim text-accent-blue font-mono">
              {d.entries.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {d.entries
              .filter((e) => e.is_active)
              .map((entry) => (
                <span
                  key={entry.id}
                  className="text-[11px] px-2 py-0.5 rounded bg-white/[0.04] text-text-secondary"
                >
                  {entry.label}
                </span>
              ))}
          </div>
          {d.is_system && (
            <div className="mt-2 text-[10px] text-text-muted">
              Słownik systemowy
            </div>
          )}
        </div>
      ))}
      {dicts.length === 0 && (
        <div className="col-span-3 text-center text-text-muted text-sm py-12">
          Brak słowników w systemie.
        </div>
      )}
    </div>
  );
}
