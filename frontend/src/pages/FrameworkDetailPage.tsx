import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { FrameworkDetail, FrameworkNodeTree, Dimension, FrameworkVersionHistory } from "../types";

const LIFECYCLE_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Szkic", cls: "badge-gray" },
  review: { label: "Przeglad", cls: "badge-yellow" },
  published: { label: "Opublikowany", cls: "badge-green" },
  deprecated: { label: "Wycofany", cls: "badge-red" },
  archived: { label: "Zarchiwizowany", cls: "badge-gray" },
};

const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  draft: ["review", "published"],
  review: ["draft", "published"],
  published: ["deprecated", "draft"],
  deprecated: ["archived", "draft"],
  archived: ["draft"],
};

export default function FrameworkDetailPage() {
  const { fwId } = useParams<{ fwId: string }>();
  const navigate = useNavigate();
  const [fw, setFw] = useState<FrameworkDetail | null>(null);
  const [tree, setTree] = useState<FrameworkNodeTree[]>([]);
  const [versions, setVersions] = useState<FrameworkVersionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tree" | "dimensions" | "versions" | "edit">("tree");
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selectedNode, setSelectedNode] = useState<FrameworkNodeTree | null>(null);
  const [showAddNode, setShowAddNode] = useState<{ parentId: number | null } | null>(null);

  const loadData = () => {
    if (!fwId) return;
    setLoading(true);
    Promise.all([
      api.get<FrameworkDetail>(`/api/v1/frameworks/${fwId}`),
      api.get<FrameworkNodeTree[]>(`/api/v1/frameworks/${fwId}/tree`),
      api.get<FrameworkVersionHistory[]>(`/api/v1/frameworks/${fwId}/versions`),
    ])
      .then(([fwData, treeData, versionsData]) => {
        setFw(fwData);
        setTree(treeData);
        setVersions(versionsData);
        // Expand first two levels by default
        const toExpand = new Set<number>();
        for (const n of treeData) {
          toExpand.add(n.id);
          for (const c of n.children) toExpand.add(c.id);
        }
        setExpandedNodes(toExpand);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [fwId]);

  const toggleNode = (id: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<number>();
    const walk = (nodes: FrameworkNodeTree[]) => {
      for (const n of nodes) { all.add(n.id); walk(n.children); }
    };
    walk(tree);
    setExpandedNodes(all);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  const handleLifecycleChange = async (newStatus: string) => {
    if (!fw) return;
    const summary = prompt("Opis zmiany statusu (opcjonalnie):");
    try {
      await api.put(`/api/v1/frameworks/${fw.id}/lifecycle`, { status: newStatus, change_summary: summary || undefined });
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad zmiany statusu");
    }
  };

  const handleAddNode = async (data: { name: string; ref_id: string; description: string; assessable: boolean; parent_id: number | null }) => {
    if (!fw) return;
    try {
      await api.post(`/api/v1/frameworks/${fw.id}/nodes`, data);
      setShowAddNode(null);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad dodawania wezla");
    }
  };

  const handleDeleteNode = async (nodeId: number) => {
    if (!fw || !confirm("Usunac ten wezel? Elementy podrzedne zostana przeniesione poziom wyzej.")) return;
    try {
      await api.delete(`/api/v1/frameworks/${fw.id}/nodes/${nodeId}`);
      setSelectedNode(null);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad usuwania");
    }
  };

  const handleUpdateNode = async (nodeId: number, data: Record<string, unknown>) => {
    if (!fw) return;
    try {
      await api.put(`/api/v1/frameworks/${fw.id}/nodes/${nodeId}`, data);
      setSelectedNode(null);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad edycji");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ladowanie frameworka...</div>;
  }
  if (!fw) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Framework nie znaleziony</div>;
  }

  const lc = LIFECYCLE_LABELS[fw.lifecycle_status] || { label: fw.lifecycle_status, cls: "badge-gray" };
  const transitions = LIFECYCLE_TRANSITIONS[fw.lifecycle_status] || [];

  return (
    <div>
      {/* Header */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-sm" onClick={() => navigate("/frameworks")} style={{ marginRight: 8 }}>
            &larr; Wstecz
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{fw.name}</h2>
            <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {fw.published_version && <span>Publ. v{fw.published_version}</span>}
              {fw.version && !fw.published_version && <span>v{fw.version}</span>}
              {fw.provider && <span>| {fw.provider}</span>}
              <span>| {fw.total_nodes} wezlow | {fw.total_assessable} ocenialnych</span>
              <span>| Edycja v{fw.edit_version}</span>
              <span className={`badge ${lc.cls}`} style={{ fontSize: 9 }}>{lc.label}</span>
            </div>
          </div>
        </div>
        <div className="toolbar-right" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Lifecycle transitions */}
          {transitions.map(status => {
            const t = LIFECYCLE_LABELS[status];
            return (
              <button key={status} className="btn btn-sm" onClick={() => handleLifecycleChange(status)}
                      title={`Zmien na: ${t?.label || status}`}>
                {t?.label || status}
              </button>
            );
          })}
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/assessments/new?framework_id=${fw.id}`)}>
            Nowa ocena
          </button>
        </div>
      </div>

      {fw.description && (
        <div className="card" style={{ padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
          {fw.description}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button className={`btn btn-sm ${tab === "tree" ? "btn-primary" : ""}`} onClick={() => setTab("tree")}>
          Drzewo
        </button>
        <button className={`btn btn-sm ${tab === "dimensions" ? "btn-primary" : ""}`} onClick={() => setTab("dimensions")}>
          Wymiary ({fw.dimensions.length})
        </button>
        <button className={`btn btn-sm ${tab === "versions" ? "btn-primary" : ""}`} onClick={() => setTab("versions")}>
          Historia wersji ({versions.length})
        </button>
        <button className={`btn btn-sm ${tab === "edit" ? "btn-primary" : ""}`} onClick={() => setTab("edit")}>
          Edycja metadanych
        </button>
      </div>

      {/* Tree Tab */}
      {tab === "tree" && (
        <div style={{ display: "grid", gridTemplateColumns: selectedNode ? "1fr 350px" : "1fr", gap: 12 }}>
          <div className="card" style={{ padding: 0, overflow: "auto" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={expandAll}>Rozwin wszystko</button>
              <button className="btn btn-sm" onClick={collapseAll}>Zwin wszystko</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm btn-primary" onClick={() => setShowAddNode({ parentId: null })}>
                + Dodaj wezel glowny
              </button>
            </div>
            {tree.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                Brak wezlow. Dodaj pierwszy wezel lub zaimportuj framework.
              </div>
            ) : (
              <div style={{ padding: "4px 0" }}>
                {tree.map(node => (
                  <TreeNode key={node.id} node={node} expanded={expandedNodes} onToggle={toggleNode}
                            selectedId={selectedNode?.id ?? null}
                            onSelect={setSelectedNode}
                            onAddChild={(parentId) => setShowAddNode({ parentId })} />
                ))}
              </div>
            )}
          </div>

          {/* Node detail sidebar */}
          {selectedNode && (
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onDelete={() => handleDeleteNode(selectedNode.id)}
              onSave={(data) => handleUpdateNode(selectedNode.id, data)}
              onAddChild={() => setShowAddNode({ parentId: selectedNode.id })}
            />
          )}
        </div>
      )}

      {/* Dimensions Tab */}
      {tab === "dimensions" && (
        <DimensionsPanel dimensions={fw.dimensions} />
      )}

      {/* Version History Tab */}
      {tab === "versions" && (
        <VersionHistoryPanel versions={versions} />
      )}

      {/* Edit Metadata Tab */}
      {tab === "edit" && (
        <EditMetadataPanel fw={fw} onSaved={loadData} />
      )}

      {/* Add Node Modal */}
      {showAddNode && (
        <AddNodeModal
          parentId={showAddNode.parentId}
          onClose={() => setShowAddNode(null)}
          onCreate={handleAddNode}
        />
      )}
    </div>
  );
}

/* --- Tree Node Component (enhanced) --- */
function TreeNode({ node, expanded, onToggle, selectedId, onSelect, onAddChild }: {
  node: FrameworkNodeTree;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  selectedId: number | null;
  onSelect: (node: FrameworkNodeTree) => void;
  onAddChild: (parentId: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const indent = (node.depth - 1) * 24;

  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 6,
          padding: "5px 12px", paddingLeft: indent + 12,
          fontSize: 12,
          background: isSelected ? "var(--blue-dim, rgba(59,130,246,0.1))" : undefined,
          borderBottom: "1px solid rgba(42,53,84,0.06)",
          cursor: "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {/* Expand/collapse toggle */}
        <span
          style={{ width: 18, textAlign: "center", fontSize: 10, color: "var(--text-muted)", flexShrink: 0, cursor: hasChildren ? "pointer" : "default", lineHeight: "18px", userSelect: "none" }}
          onClick={(e) => { e.stopPropagation(); hasChildren && onToggle(node.id); }}
        >
          {hasChildren ? (isExpanded ? "\u25BE" : "\u25B8") : "\u00B7"}
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {node.ref_id && (
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--blue)", fontWeight: 600, flexShrink: 0 }}>
                {node.ref_id}
              </span>
            )}
            <span style={{ fontWeight: node.depth <= 2 ? 600 : 400 }}>
              {node.name_pl || node.name}
            </span>
            {node.assessable && (
              <span className="badge badge-green" style={{ fontSize: 8, padding: "1px 5px" }}>ocenialny</span>
            )}
            {node.implementation_groups && (
              <span className="badge badge-gray" style={{ fontSize: 8, padding: "1px 5px" }}>{node.implementation_groups}</span>
            )}
          </div>
          {/* Show description for expanded nodes or leaf nodes */}
          {node.description && (isExpanded || !hasChildren) && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.3, maxHeight: 40, overflow: "hidden" }}>
              {node.description}
            </div>
          )}
        </div>

        {/* Quick add child button */}
        <span
          style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer", padding: "0 4px", flexShrink: 0, lineHeight: "18px" }}
          title="Dodaj podwezel"
          onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
        >
          +
        </span>
      </div>

      {isExpanded && node.children.map(child => (
        <TreeNode key={child.id} node={child} expanded={expanded} onToggle={onToggle}
                  selectedId={selectedId} onSelect={onSelect} onAddChild={onAddChild} />
      ))}
    </>
  );
}

/* --- Node Detail Panel (sidebar) --- */
function NodeDetailPanel({ node, onClose, onDelete, onSave, onAddChild }: {
  node: FrameworkNodeTree;
  onClose: () => void;
  onDelete: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onAddChild: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [refId, setRefId] = useState(node.ref_id || "");
  const [description, setDescription] = useState(node.description || "");
  const [assessable, setAssessable] = useState(node.assessable);
  const [annotation, setAnnotation] = useState(node.annotation || "");

  useEffect(() => {
    setName(node.name);
    setRefId(node.ref_id || "");
    setDescription(node.description || "");
    setAssessable(node.assessable);
    setAnnotation(node.annotation || "");
    setEditing(false);
  }, [node.id]);

  return (
    <div className="card" style={{ padding: "12px 16px", fontSize: 12, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ fontSize: 13 }}>Szczegoly wezla</strong>
        <button className="btn btn-sm" onClick={onClose} style={{ fontSize: 10 }}>X</button>
      </div>

      {!editing ? (
        <>
          {node.ref_id && (
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)", fontWeight: 600, marginBottom: 4 }}>
              {node.ref_id}
            </div>
          )}
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{node.name_pl || node.name}</div>

          {node.description && (
            <div style={{ marginBottom: 8, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              {node.description}
            </div>
          )}

          {node.annotation && (
            <div style={{ marginBottom: 8, padding: "6px 8px", background: "var(--surface-hover)", borderRadius: 4, fontSize: 11 }}>
              <strong>Adnotacja:</strong><br />{node.annotation}
            </div>
          )}

          {node.typical_evidence && (
            <div style={{ marginBottom: 8, padding: "6px 8px", background: "var(--surface-hover)", borderRadius: 4, fontSize: 11 }}>
              <strong>Typowe dowody:</strong><br />{node.typical_evidence}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {node.assessable && <span className="badge badge-green" style={{ fontSize: 9 }}>Ocenialny</span>}
            {node.implementation_groups && <span className="badge badge-gray" style={{ fontSize: 9 }}>IG: {node.implementation_groups}</span>}
            {node.importance && <span className="badge badge-gray" style={{ fontSize: 9 }}>{node.importance}</span>}
            <span className="badge badge-gray" style={{ fontSize: 9 }}>Glebokosc: {node.depth}</span>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>Edytuj</button>
            <button className="btn btn-sm" onClick={onAddChild}>+ Podwezel</button>
            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={onDelete}>Usun</button>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 11 }}>
            Nazwa
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", marginTop: 2 }} />
          </label>
          <label style={{ fontSize: 11 }}>
            ID referencyjny
            <input type="text" value={refId} onChange={e => setRefId(e.target.value)} style={{ width: "100%", marginTop: 2 }} />
          </label>
          <label style={{ fontSize: 11 }}>
            Opis
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={{ width: "100%", marginTop: 2 }} />
          </label>
          <label style={{ fontSize: 11 }}>
            Adnotacja
            <textarea value={annotation} onChange={e => setAnnotation(e.target.value)} rows={2} style={{ width: "100%", marginTop: 2 }} />
          </label>
          <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={assessable} onChange={e => setAssessable(e.target.checked)} />
            Ocenialny (lisc drzewa do oceny)
          </label>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button className="btn btn-sm btn-primary" onClick={() => {
              onSave({ name, ref_id: refId || null, description: description || null, assessable, annotation: annotation || null });
            }}>Zapisz</button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Add Node Modal --- */
function AddNodeModal({ parentId, onClose, onCreate }: {
  parentId: number | null;
  onClose: () => void;
  onCreate: (data: { name: string; ref_id: string; description: string; assessable: boolean; parent_id: number | null }) => void;
}) {
  const [name, setName] = useState("");
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [assessable, setAssessable] = useState(false);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div className="card" style={{ width: 450, maxWidth: "90vw", padding: 24 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
          {parentId ? "Dodaj podwezel" : "Dodaj wezel glowny"}
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            Nazwa *
            <input type="text" value={name} onChange={e => setName(e.target.value)}
                   style={{ width: "100%", marginTop: 4 }} placeholder="Nazwa wezla" autoFocus />
          </label>
          <label style={{ fontSize: 12 }}>
            ID referencyjny
            <input type="text" value={refId} onChange={e => setRefId(e.target.value)}
                   style={{ width: "100%", marginTop: 4 }} placeholder="np. A.5.1" />
          </label>
          <label style={{ fontSize: 12 }}>
            Opis
            <textarea value={description} onChange={e => setDescription(e.target.value)}
                      rows={3} style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={assessable} onChange={e => setAssessable(e.target.checked)} />
            Ocenialny (lisc drzewa do oceny)
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Anuluj</button>
          <button className="btn btn-primary" disabled={!name.trim()}
                  onClick={() => onCreate({ name, ref_id: refId, description, assessable, parent_id: parentId })}>
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Dimensions Panel --- */
function DimensionsPanel({ dimensions }: { dimensions: Dimension[] }) {
  if (dimensions.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Ten framework nie ma zdefiniowanych wymiarow oceny.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {dimensions.map(dim => (
        <div key={dim.id} className="card" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{dim.name_pl || dim.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                Klucz: {dim.dimension_key} | Waga: {dim.weight}
              </div>
            </div>
          </div>
          {dim.description && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{dim.description}</div>}
          {dim.levels.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {dim.levels.map(lv => (
                <div key={lv.id} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11,
                  background: lv.color ? `${lv.color}20` : "var(--surface-hover)",
                  color: lv.color ?? "var(--text-primary)",
                  border: `1px solid ${lv.color ?? "var(--border)"}`,
                }}>
                  <strong>{lv.value}</strong> -- {lv.label_pl || lv.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* --- Version History Panel --- */
function VersionHistoryPanel({ versions }: { versions: FrameworkVersionHistory[] }) {
  if (versions.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Brak historii wersji.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Wersja</th>
            <th>Status</th>
            <th>Opis zmian</th>
            <th>Zmienione przez</th>
            <th>Data</th>
            <th style={{ textAlign: "right" }}>Wezly</th>
            <th style={{ textAlign: "right" }}>Ocenialne</th>
          </tr>
        </thead>
        <tbody>
          {versions.map(v => {
            const lc = LIFECYCLE_LABELS[v.lifecycle_status] || { label: v.lifecycle_status, cls: "badge-gray" };
            return (
              <tr key={v.id}>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>v{v.edit_version}</td>
                <td><span className={`badge ${lc.cls}`} style={{ fontSize: 9 }}>{lc.label}</span></td>
                <td style={{ fontSize: 11, maxWidth: 300 }}>{v.change_summary || "--"}</td>
                <td style={{ fontSize: 11 }}>{v.changed_by || "--"}</td>
                <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {v.changed_at ? new Date(v.changed_at).toLocaleString("pl-PL") : "--"}
                </td>
                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  {v.snapshot_nodes_count ?? "--"}
                </td>
                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  {v.snapshot_assessable_count ?? "--"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --- Edit Metadata Panel --- */
function EditMetadataPanel({ fw, onSaved }: { fw: FrameworkDetail; onSaved: () => void }) {
  const [name, setName] = useState(fw.name);
  const [refId, setRefId] = useState(fw.ref_id || "");
  const [description, setDescription] = useState(fw.description || "");
  const [version, setVersion] = useState(fw.version || "");
  const [provider, setProvider] = useState(fw.provider || "");
  const [publishedVersion, setPublishedVersion] = useState(fw.published_version || "");
  const [changeSummary, setChangeSummary] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/v1/frameworks/${fw.id}`, {
        name: name || undefined,
        ref_id: refId || undefined,
        description: description || undefined,
        version: version || undefined,
        provider: provider || undefined,
        published_version: publishedVersion || undefined,
        change_summary: changeSummary || undefined,
      });
      setChangeSummary("");
      onSaved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad zapisu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Edycja metadanych frameworka</h3>

      <div style={{ display: "grid", gap: 12, maxWidth: 600 }}>
        <label style={{ fontSize: 12 }}>
          Nazwa
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12 }}>
          ID referencyjny
          <input type="text" value={refId} onChange={e => setRefId(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: 12 }}>
            Wersja zrodlowa
            <input type="text" value={version} onChange={e => setVersion(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            Wersja publikacji (w naszym systemie)
            <input type="text" value={publishedVersion} onChange={e => setPublishedVersion(e.target.value)}
                   style={{ width: "100%", marginTop: 4 }} placeholder="np. 1.0" />
          </label>
          <label style={{ fontSize: 12 }}>
            Dostawca
            <input type="text" value={provider} onChange={e => setProvider(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
          </label>
        </div>
        <label style={{ fontSize: 12 }}>
          Opis
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={{ width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12 }}>
          Opis zmian (do historii wersji)
          <input type="text" value={changeSummary} onChange={e => setChangeSummary(e.target.value)}
                 style={{ width: "100%", marginTop: 4 }} placeholder="Co zostalo zmienione?" />
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
        </div>

        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
          Kazda edycja tworzy nowa wersje w historii. Wersja publikacji (np. "8.0" benchmarku CIS)
          jest niezalezna od wersji edycji w systemie (v{fw.edit_version}).
        </div>
      </div>
    </div>
  );
}
