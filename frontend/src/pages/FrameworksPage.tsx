import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { FrameworkBrief, FrameworkImportResult } from "../types";

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState<FrameworkBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<FrameworkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    const qs = showArchived ? "" : "?is_active=true";
    api.get<FrameworkBrief[]>(`/api/v1/frameworks${qs}`)
      .then(setFrameworks)
      .catch(() => setFrameworks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [showArchived]);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    setImportError(null);

    const formData = new FormData();
    formData.append("file", file);

    const isYaml = file.name.endsWith(".yaml") || file.name.endsWith(".yml");
    const endpoint = isYaml ? "/api/v1/frameworks/import/yaml" : "/api/v1/frameworks/import/excel";

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `HTTP ${res.status}`);
      }
      const result: FrameworkImportResult = await res.json();
      setImportResult(result);
      load();
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Blad importu");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleArchive = async (id: number) => {
    if (!confirm("Archiwizowac ten framework?")) return;
    await api.delete(`/api/v1/frameworks/${id}`);
    load();
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Frameworki</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Pokaz zarchiwizowane
          </label>
        </div>
        <div className="toolbar-right">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.yaml,.yml"
            style={{ display: "none" }}
            onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Importowanie..." : "Import z pliku"}
          </button>
        </div>
      </div>

      {/* Import result/error */}
      {importResult && (
        <div className="card" style={{ background: "var(--green-dim)", borderLeft: "3px solid var(--green)", marginBottom: 12, padding: "10px 14px" }}>
          <strong>Import zakonczony:</strong> {importResult.name} — {importResult.total_nodes} wezlow, {importResult.total_assessable} ocenialnych, {importResult.dimensions_created} wymiarow
        </div>
      )}
      {importError && (
        <div className="card" style={{ background: "var(--red-dim)", borderLeft: "3px solid var(--red)", marginBottom: 12, padding: "10px 14px" }}>
          <strong>Blad importu:</strong> {importError}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ladowanie...</div>
      ) : frameworks.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Brak frameworkow. Zaimportuj framework z pliku Excel lub YAML (CISO Assistant).
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Wersja</th>
                <th>Dostawca</th>
                <th style={{ textAlign: "right" }}>Wezly</th>
                <th style={{ textAlign: "right" }}>Ocenialne</th>
                <th>Status</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map(fw => (
                <tr key={fw.id} style={{ cursor: "pointer", opacity: fw.is_active ? 1 : 0.5 }}
                    onClick={() => navigate(`/frameworks/${fw.id}`)}>
                  <td style={{ fontWeight: 600 }}>{fw.name}</td>
                  <td>{fw.version ?? "—"}</td>
                  <td>{fw.provider ?? "—"}</td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fw.total_nodes}</td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fw.total_assessable}</td>
                  <td>
                    <span className={`badge ${fw.is_active ? "badge-green" : "badge-gray"}`}>
                      {fw.is_active ? "Aktywny" : "Zarchiwizowany"}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {fw.is_active && (
                      <button className="btn btn-sm" style={{ fontSize: 11 }}
                              onClick={() => handleArchive(fw.id)}>
                        Archiwizuj
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
