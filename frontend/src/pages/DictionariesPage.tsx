import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { DictionaryTypeWithEntries, DictionaryEntry } from "../types";
import Modal from "../components/Modal";

export default function DictionariesPage() {
  const [dicts, setDicts] = useState<DictionaryTypeWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDict, setOpenDict] = useState<DictionaryTypeWithEntries | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDicts = async () => {
    try {
      const types = await api.get<DictionaryTypeWithEntries[]>("/api/v1/dictionaries");
      setDicts(types);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDicts(); }, []);

  const openDictModal = (d: DictionaryTypeWithEntries) => {
    setOpenDict(d);
    setShowAddEntry(false);
  };

  const refreshOpenDict = async (code: string) => {
    try {
      const updated = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${code}/entries`);
      setOpenDict(updated);
      setDicts(prev => prev.map(d => d.code === code ? updated : d));
    } catch { /* ignore */ }
  };

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!openDict) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      label: fd.get("label") as string,
      code: (fd.get("code") as string) || undefined,
      description: (fd.get("description") as string) || undefined,
      numeric_value: fd.get("numeric_value") ? Number(fd.get("numeric_value")) : undefined,
      sort_order: fd.get("sort_order") ? Number(fd.get("sort_order")) : 0,
    };
    try {
      await api.post(`/api/v1/dictionaries/${openDict.code}/entries`, body);
      setShowAddEntry(false);
      await refreshOpenDict(openDict.code);
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const archiveEntry = async (entry: DictionaryEntry) => {
    if (!openDict) return;
    if (!confirm(`Archiwizować "${entry.label}"?`)) return;
    try {
      await api.patch(`/api/v1/dictionaries/entries/${entry.id}/archive`, {});
      await refreshOpenDict(openDict.code);
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

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
        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>Nie udało się załadować słowników</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-all" }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid-3">
        {dicts.map((d) => (
          <div key={d.id} className="card" style={{ cursor: "pointer" }} onClick={() => openDictModal(d)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>{d.name}</div>
              <span className="badge-blue" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8 }}>{d.entries.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {d.entries.filter(e => e.is_active).map((entry) => (
                <span key={entry.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)" }}>
                  {entry.label}
                </span>
              ))}
            </div>
            {d.is_system && <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>Słownik systemowy</div>}
          </div>
        ))}
        {dicts.length === 0 && (
          <div style={{ gridColumn: "span 3", textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "48px 0" }}>
            Brak słowników w systemie.
          </div>
        )}
      </div>

      <Modal open={!!openDict} onClose={() => setOpenDict(null)} title={openDict?.name ?? "Słownik"} wide>
        {openDict && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Kod: <code style={{ color: "var(--blue)" }}>{openDict.code}</code> · {openDict.entries.filter(e => e.is_active).length} aktywnych pozycji
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddEntry(!showAddEntry)}>
                {showAddEntry ? "Anuluj" : "+ Dodaj pozycję"}
              </button>
            </div>

            {showAddEntry && (
              <form onSubmit={handleAddEntry} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label>Etykieta *</label>
                    <input name="label" className="form-control" required placeholder="np. Wysoki" />
                  </div>
                  <div className="form-group">
                    <label>Kod</label>
                    <input name="code" className="form-control" placeholder="np. high" />
                  </div>
                  <div className="form-group">
                    <label>Wartość numeryczna</label>
                    <input name="numeric_value" type="number" step="any" className="form-control" placeholder="np. 3" />
                  </div>
                  <div className="form-group">
                    <label>Kolejność sortowania</label>
                    <input name="sort_order" type="number" className="form-control" defaultValue="0" />
                  </div>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label>Opis</label>
                    <input name="description" className="form-control" placeholder="Opcjonalny opis" />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? "Zapisywanie..." : "Dodaj"}
                  </button>
                </div>
              </form>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Etykieta</th><th>Wartość</th><th>Kolejność</th><th>Status</th><th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {openDict.entries.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 24 }}>Brak pozycji w słowniku</td></tr>
                ) : (
                  openDict.entries.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{entry.id}</td>
                      <td style={{ fontWeight: 500 }}>{entry.label}</td>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{entry.numeric_value ?? "—"}</td>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{entry.sort_order}</td>
                      <td>
                        <span className="score-badge" style={{
                          background: entry.is_active ? "var(--green-dim)" : "var(--red-dim)",
                          color: entry.is_active ? "var(--green)" : "var(--red)",
                        }}>
                          {entry.is_active ? "Aktywny" : "Archiwalny"}
                        </span>
                      </td>
                      <td>
                        {entry.is_active && (
                          <button className="btn btn-sm" onClick={() => archiveEntry(entry)}>Archiwizuj</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
