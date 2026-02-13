import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { FrameworkBrief, FrameworkImportResult } from "../types";

const LIFECYCLE_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Szkic", cls: "badge-gray" },
  review: { label: "Przeglad", cls: "badge-yellow" },
  published: { label: "Opublikowany", cls: "badge-green" },
  deprecated: { label: "Wycofany", cls: "badge-red" },
  archived: { label: "Zarchiwizowany", cls: "badge-gray" },
};

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState<FrameworkBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<FrameworkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      const res = await api.postFormData<FrameworkImportResult>(endpoint, formData);
      setImportResult(res);
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

  const handleCreate = async (data: { name: string; ref_id: string; description: string; version: string; provider: string }) => {
    try {
      const fw = await api.post<{ id: number }>("/api/v1/frameworks", data);
      setShowCreateModal(false);
      navigate(`/frameworks/${fw.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad tworzenia");
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Frameworki i dokumenty referencyjne</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Pokaz zarchiwizowane
          </label>
        </div>
        <div className="toolbar-right" style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.yaml,.yml"
            style={{ display: "none" }}
            onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Importowanie..." : "Import z pliku"}
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + Nowy framework
          </button>
        </div>
      </div>

      {/* Import result/error */}
      {importResult && (
        <div className="card" style={{ background: "var(--green-dim)", borderLeft: "3px solid var(--green)", marginBottom: 12, padding: "10px 14px" }}>
          <strong>Import zakonczony:</strong> {importResult.name} -- {importResult.total_nodes} wezlow, {importResult.total_assessable} ocenialnych, {importResult.dimensions_created} wymiarow
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
          Brak frameworkow. Zaimportuj framework z pliku lub utworz recznie.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Wersja publ.</th>
                <th>Dostawca</th>
                <th>Zrodlo</th>
                <th style={{ textAlign: "right" }}>Wezly</th>
                <th style={{ textAlign: "right" }}>Ocenialne</th>
                <th>Status cyklu</th>
                <th>Edycja</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map(fw => {
                const lc = LIFECYCLE_LABELS[fw.lifecycle_status] || { label: fw.lifecycle_status, cls: "badge-gray" };
                return (
                  <tr key={fw.id} style={{ cursor: "pointer", opacity: fw.is_active ? 1 : 0.5 }}
                      onClick={() => navigate(`/frameworks/${fw.id}`)}>
                    <td style={{ fontWeight: 600 }}>{fw.name}</td>
                    <td>{fw.published_version || fw.version || "--"}</td>
                    <td>{fw.provider ?? "--"}</td>
                    <td style={{ fontSize: 10 }}>
                      {fw.source_format === "manual" ? "Reczny" :
                       fw.source_format === "ciso_assistant_yaml" ? "YAML" :
                       fw.source_format === "ciso_assistant_excel" ? "Excel" : fw.source_format || "--"}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fw.total_nodes}</td>
                    <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fw.total_assessable}</td>
                    <td>
                      <span className={`badge ${lc.cls}`}>{lc.label}</span>
                    </td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                      v{fw.edit_version}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateFrameworkModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

/* --- Create Framework Modal --- */
function CreateFrameworkModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { name: string; ref_id: string; description: string; version: string; provider: string }) => void;
}) {
  const [name, setName] = useState("");
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [provider, setProvider] = useState("");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div className="card" style={{ width: 500, maxWidth: "90vw", padding: 24 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Nowy framework</h3>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ fontSize: 12 }}>
            Nazwa *
            <input type="text" value={name} onChange={e => setName(e.target.value)}
                   style={{ width: "100%", marginTop: 4 }} placeholder="np. ISO 27001:2022" />
          </label>
          <label style={{ fontSize: 12 }}>
            ID referencyjny
            <input type="text" value={refId} onChange={e => setRefId(e.target.value)}
                   style={{ width: "100%", marginTop: 4 }} placeholder="np. ISO-27001-2022" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ fontSize: 12 }}>
              Wersja publikacji
              <input type="text" value={version} onChange={e => setVersion(e.target.value)}
                     style={{ width: "100%", marginTop: 4 }} placeholder="np. 2022" />
            </label>
            <label style={{ fontSize: 12 }}>
              Dostawca
              <input type="text" value={provider} onChange={e => setProvider(e.target.value)}
                     style={{ width: "100%", marginTop: 4 }} placeholder="np. ISO" />
            </label>
          </div>
          <label style={{ fontSize: 12 }}>
            Opis
            <textarea value={description} onChange={e => setDescription(e.target.value)}
                      rows={3} style={{ width: "100%", marginTop: 4 }} placeholder="Opis frameworka..." />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Anuluj</button>
          <button className="btn btn-primary" disabled={!name.trim()}
                  onClick={() => onCreate({ name, ref_id: refId, description, version, provider })}>
            Utworz
          </button>
        </div>
      </div>
    </div>
  );
}
