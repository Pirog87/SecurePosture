import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { DictionaryType, DictionaryTypeWithEntries, DictionaryEntry } from "../types";
import Modal from "../components/Modal";

export default function DictionariesPage() {
  const [dicts, setDicts] = useState<DictionaryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDict, setOpenDict] = useState<DictionaryTypeWithEntries | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editEntry, setEditEntry] = useState<DictionaryEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDicts = async () => {
    try {
      const types = await api.get<DictionaryType[]>("/api/v1/dictionaries");
      setDicts(types);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDicts(); }, []);

  const openDictModal = async (d: DictionaryType) => {
    setLoadingEntries(true);
    setShowAddEntry(false);
    setEditEntry(null);
    try {
      const full = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${d.code}/entries?include_archived=true`);
      setOpenDict(full);
    } catch {
      setOpenDict({ id: d.id, code: d.code, name: d.name, description: d.description, is_system: d.is_system, entries: [] });
    } finally {
      setLoadingEntries(false);
    }
  };

  const refreshOpenDict = async (code: string) => {
    try {
      const updated = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${code}/entries?include_archived=true`);
      setOpenDict(updated);
      loadDicts();
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
      color: (fd.get("color") as string) || undefined,
      sort_order: fd.get("sort_order") ? Number(fd.get("sort_order")) : 0,
    };
    try {
      await api.post(`/api/v1/dictionaries/${openDict.code}/entries`, body);
      setShowAddEntry(false);
      await refreshOpenDict(openDict.code);
    } catch (err) {
      alert("Blad zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!openDict || !editEntry) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      label: fd.get("label") as string,
      code: (fd.get("code") as string) || null,
      description: (fd.get("description") as string) || null,
      numeric_value: fd.get("numeric_value") ? Number(fd.get("numeric_value")) : null,
      color: (fd.get("color") as string) || null,
      sort_order: fd.get("sort_order") ? Number(fd.get("sort_order")) : 0,
    };
    try {
      await api.put(`/api/v1/dictionaries/entries/${editEntry.id}`, body);
      setEditEntry(null);
      await refreshOpenDict(openDict.code);
    } catch (err) {
      alert("Blad zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const archiveEntry = async (entry: DictionaryEntry) => {
    if (!openDict) return;
    if (!confirm(`Archiwizowac "${entry.label}"?`)) return;
    try {
      await api.patch(`/api/v1/dictionaries/entries/${entry.id}/archive`, {});
      await refreshOpenDict(openDict.code);
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  const restoreEntry = async (entry: DictionaryEntry) => {
    if (!openDict) return;
    try {
      await api.put(`/api/v1/dictionaries/entries/${entry.id}`, { is_active: true });
      await refreshOpenDict(openDict.code);
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  const moveEntry = async (entry: DictionaryEntry, direction: "up" | "down") => {
    if (!openDict) return;
    const active = openDict.entries.filter(e => e.is_active).sort((a, b) => a.sort_order - b.sort_order);
    const idx = active.findIndex(e => e.id === entry.id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= active.length) return;

    const items = active.map((e, i) => {
      if (i === idx) return { id: e.id, sort_order: active[swapIdx].sort_order };
      if (i === swapIdx) return { id: e.id, sort_order: active[idx].sort_order };
      return { id: e.id, sort_order: e.sort_order };
    });

    try {
      await api.put("/api/v1/dictionaries/entries/reorder", { items });
      await refreshOpenDict(openDict.code);
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ladowanie slownikow...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>Nie udalo sie zaladowac slownikow</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-all" }}>{error}</div>
      </div>
    );
  }

  const activeEntries = openDict?.entries.filter(e => e.is_active).sort((a, b) => a.sort_order - b.sort_order) ?? [];
  const archivedEntries = openDict?.entries.filter(e => !e.is_active) ?? [];

  return (
    <div>
      <div className="grid-3">
        {dicts.map((d) => (
          <div key={d.id} className="card clickable" onClick={() => openDictModal(d)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>{d.name}</div>
              <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{d.entry_count}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Kod: <code style={{ color: "var(--text-muted)" }}>{d.code}</code>
            </div>
            {d.is_system && <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>Slownik systemowy</div>}
          </div>
        ))}
        {dicts.length === 0 && (
          <div style={{ gridColumn: "span 3", textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "48px 0" }}>
            Brak slownikow w systemie.
          </div>
        )}
      </div>

      <Modal open={!!openDict} onClose={() => { setOpenDict(null); setEditEntry(null); }} title={openDict?.name ?? "Slownik"} wide>
        {loadingEntries ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie pozycji...</div>
        ) : openDict && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Kod: <code style={{ color: "var(--blue)" }}>{openDict.code}</code> · {activeEntries.length} aktywnych
                {archivedEntries.length > 0 && <span> · {archivedEntries.length} archiwalnych</span>}
              </span>
              {!openDict.is_system && (
                <button className="btn btn-primary btn-sm" onClick={() => { setShowAddEntry(!showAddEntry); setEditEntry(null); }}>
                  {showAddEntry ? "Anuluj" : "+ Dodaj pozycje"}
                </button>
              )}
            </div>

            {/* Add Form */}
            {showAddEntry && (
              <EntryForm onSubmit={handleAddEntry} saving={saving} onCancel={() => setShowAddEntry(false)} />
            )}

            {/* Edit Form */}
            {editEntry && (
              <EntryForm entry={editEntry} onSubmit={handleEditEntry} saving={saving} onCancel={() => setEditEntry(null)} />
            )}

            {/* Active entries table */}
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Kol.</th>
                  <th>Etykieta</th>
                  <th>Kod</th>
                  <th>Wartosc</th>
                  <th>Kolor</th>
                  <th>Status</th>
                  <th style={{ width: 200 }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {activeEntries.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 24 }}>Brak pozycji w slowniku</td></tr>
                ) : (
                  activeEntries.map((entry, idx) => (
                    <tr key={entry.id} style={{ background: editEntry?.id === entry.id ? "rgba(59,130,246,0.08)" : undefined }}>
                      <td>
                        <div style={{ display: "flex", gap: 2 }}>
                          <button className="btn btn-sm" style={{ padding: "1px 6px", fontSize: 10 }}
                            disabled={idx === 0}
                            onClick={() => moveEntry(entry, "up")}
                            title="W gore">&#9650;</button>
                          <button className="btn btn-sm" style={{ padding: "1px 6px", fontSize: 10 }}
                            disabled={idx === activeEntries.length - 1}
                            onClick={() => moveEntry(entry, "down")}
                            title="W dol">&#9660;</button>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>{entry.sort_order}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{entry.label}</td>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{entry.code ?? "—"}</td>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{entry.numeric_value ?? "—"}</td>
                      <td>
                        {entry.color ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 14, height: 14, borderRadius: 3, background: entry.color, display: "inline-block", border: "1px solid rgba(255,255,255,0.1)" }} />
                            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{entry.color}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>Aktywny</span>
                      </td>
                      <td>
                        {!openDict.is_system && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-sm" onClick={() => { setEditEntry(entry); setShowAddEntry(false); }}>Edytuj</button>
                            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => archiveEntry(entry)}>Archiwizuj</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Archived entries */}
            {archivedEntries.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Archiwalne pozycje</div>
                <table className="data-table">
                  <tbody>
                    {archivedEntries.map(entry => (
                      <tr key={entry.id} style={{ opacity: 0.5 }}>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{entry.id}</td>
                        <td>{entry.label}</td>
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{entry.code ?? "—"}</td>
                        <td>
                          <span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)" }}>Archiwalny</span>
                        </td>
                        <td>
                          <button className="btn btn-sm" onClick={() => restoreEntry(entry)}>Przywroc</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* Reusable entry form for add/edit */
function EntryForm({ entry, onSubmit, saving, onCancel }: {
  entry?: DictionaryEntry;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid rgba(42,53,84,0.3)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
        {entry ? `Edycja: ${entry.label}` : "Nowa pozycja"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-group">
          <label>Etykieta *</label>
          <input name="label" className="form-control" required defaultValue={entry?.label ?? ""} placeholder="np. Wysoki" />
        </div>
        <div className="form-group">
          <label>Kod</label>
          <input name="code" className="form-control" defaultValue={entry?.code ?? ""} placeholder="np. high" />
        </div>
        <div className="form-group">
          <label>Wartosc numeryczna</label>
          <input name="numeric_value" type="number" step="any" className="form-control" defaultValue={entry?.numeric_value ?? ""} placeholder="np. 3" />
        </div>
        <div className="form-group">
          <label>Kolor</label>
          <input name="color" className="form-control" defaultValue={entry?.color ?? ""} placeholder="np. #ff0000" />
        </div>
        <div className="form-group">
          <label>Kolejnosc sortowania</label>
          <input name="sort_order" type="number" className="form-control" defaultValue={entry?.sort_order ?? 0} />
        </div>
        <div className="form-group">
          <label>Opis</label>
          <input name="description" className="form-control" defaultValue={entry?.description ?? ""} placeholder="Opcjonalny opis" />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Anuluj</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Zapisywanie..." : entry ? "Zapisz zmiany" : "Dodaj"}
        </button>
      </div>
    </form>
  );
}
