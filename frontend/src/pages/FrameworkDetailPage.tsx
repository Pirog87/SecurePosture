import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import Modal from "../components/Modal";
import type { FrameworkDetail, FrameworkNodeTree, Dimension, FrameworkVersionHistory } from "../types";

/* ─── Lifecycle helpers ─── */
const LIFECYCLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: "Szkic",          color: "var(--text-muted)", bg: "var(--bg-inset)" },
  review:     { label: "Przegląd",       color: "var(--orange)",     bg: "var(--orange-dim)" },
  published:  { label: "Opublikowany",   color: "var(--green)",      bg: "var(--green-dim)" },
  deprecated: { label: "Wycofany",       color: "var(--red)",        bg: "var(--red-dim)" },
  archived:   { label: "Zarchiwizowany", color: "var(--text-muted)", bg: "var(--bg-inset)" },
};

const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  draft: ["review", "published"],
  review: ["draft", "published"],
  published: ["deprecated", "draft"],
  deprecated: ["archived", "draft"],
  archived: ["draft"],
};

function lcColor(s: string) { return LIFECYCLE_LABELS[s]?.color ?? "var(--text-muted)"; }
function lcBg(s: string) { return LIFECYCLE_LABELS[s]?.bg ?? "var(--bg-inset)"; }
function lcLabel(s: string) { return LIFECYCLE_LABELS[s]?.label ?? s; }

/* ─── Detail panel rows ─── */
function SectionHeader({ number, label }: { number: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: "var(--blue)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>{number}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{label}</div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "—"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   FrameworkDetailPage
   ═══════════════════════════════════════════════════ */
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

  /* ── Tree stats ── */
  const treeStats = useMemo(() => {
    let total = 0;
    let assessable = 0;
    let maxDepth = 0;
    const walk = (nodes: FrameworkNodeTree[]) => {
      for (const n of nodes) {
        total++;
        if (n.assessable) assessable++;
        if (n.depth > maxDepth) maxDepth = n.depth;
        walk(n.children);
      }
    };
    walk(tree);
    return { total, assessable, maxDepth };
  }, [tree]);

  const handleLifecycleChange = async (newStatus: string) => {
    if (!fw) return;
    const summary = prompt("Opis zmiany statusu (opcjonalnie):");
    try {
      await api.put(`/api/v1/frameworks/${fw.id}/lifecycle`, { status: newStatus, change_summary: summary || undefined });
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd zmiany statusu");
    }
  };

  const handleAddNode = async (data: { name: string; ref_id: string; description: string; assessable: boolean; parent_id: number | null }) => {
    if (!fw) return;
    try {
      await api.post(`/api/v1/frameworks/${fw.id}/nodes`, data);
      setShowAddNode(null);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd dodawania węzła");
    }
  };

  const handleDeleteNode = async (nodeId: number) => {
    if (!fw || !confirm("Usunąć ten węzeł? Elementy podrzędne zostaną przeniesione poziom wyżej.")) return;
    try {
      await api.delete(`/api/v1/frameworks/${fw.id}/nodes/${nodeId}`);
      setSelectedNode(null);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd usuwania");
    }
  };

  const handleUpdateNode = async (nodeId: number, data: Record<string, unknown>) => {
    if (!fw) return;
    try {
      await api.put(`/api/v1/frameworks/${fw.id}/nodes/${nodeId}`, data);
      setSelectedNode(null);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd edycji");
    }
  };

  const handleDelete = async () => {
    if (!fw) return;
    const action = fw.lifecycle_status === "published" ? "zarchiwizować" : "trwale usunąć";
    if (!confirm(`Czy na pewno chcesz ${action} framework "${fw.name}"?`)) return;
    try {
      await api.delete(`/api/v1/frameworks/${fw.id}`);
      navigate("/frameworks");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd usuwania");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ładowanie frameworka...</div>;
  }
  if (!fw) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Framework nie znaleziony</div>;
  }

  const transitions = LIFECYCLE_TRANSITIONS[fw.lifecycle_status] || [];

  return (
    <div>
      {/* ── Header toolbar ── */}
      <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="toolbar-left" style={{ alignItems: "center" }}>
          <button className="btn btn-sm" onClick={() => navigate("/frameworks")} style={{ marginRight: 8 }}>
            &larr; Wstecz
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{fw.name}</h2>
              <span className="score-badge" style={{ background: lcBg(fw.lifecycle_status), color: lcColor(fw.lifecycle_status), fontSize: 11 }}>
                {lcLabel(fw.lifecycle_status)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
              {fw.provider && <span>{fw.provider}</span>}
              {(fw.published_version || fw.version) && <span>| v{fw.published_version || fw.version}</span>}
              <span>| {fw.total_nodes} węzłów</span>
              <span>| {fw.total_assessable} ocenialnych</span>
              <span>| Edycja v{fw.edit_version}</span>
            </div>
          </div>
        </div>
        <div className="toolbar-right" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {transitions.map(status => (
            <button key={status} className="btn btn-sm" onClick={() => handleLifecycleChange(status)}
                    title={`Zmień na: ${lcLabel(status)}`}>
              {lcLabel(status)}
            </button>
          ))}
          <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={handleDelete}>
            {fw.lifecycle_status === "published" ? "Archiwizuj" : "Usuń"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/assessments/new?framework_id=${fw.id}`)}>
            Nowa ocena
          </button>
        </div>
      </div>

      {/* ── Description ── */}
      {fw.description && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset)", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
          {fw.description}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {([
          { key: "tree", label: `Drzewo (${treeStats.total})` },
          { key: "dimensions", label: `Wymiary (${fw.dimensions.length})` },
          { key: "versions", label: `Historia wersji (${versions.length})` },
          { key: "edit", label: "Edycja metadanych" },
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button key={t.key}
            style={{
              padding: "8px 16px", fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
              background: tab === t.key ? "var(--blue-dim)" : "transparent",
              borderBottom: tab === t.key ? "2px solid var(--blue)" : "2px solid transparent",
              color: tab === t.key ? "var(--blue)" : "var(--text-muted)",
              border: "none", borderBottomWidth: 2, borderBottomStyle: "solid",
              cursor: "pointer",
            }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Tree Tab ═══ */}
      {tab === "tree" && (
        <div style={{ display: "grid", gridTemplateColumns: selectedNode ? "1fr 420px" : "1fr", gap: 14 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Tree toolbar */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={expandAll}>Rozwiń wszystko</button>
              <button className="btn btn-sm" onClick={collapseAll}>Zwiń wszystko</button>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {treeStats.total} węzłów | {treeStats.assessable} ocenialnych | głęb. {treeStats.maxDepth}
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm btn-primary" onClick={() => setShowAddNode({ parentId: null })}>
                + Dodaj węzeł główny
              </button>
            </div>

            {tree.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Brak węzłów. Dodaj pierwszy węzeł lub zaimportuj framework.
              </div>
            ) : (
              <div style={{ padding: "4px 0", maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
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
            <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onDelete={() => handleDeleteNode(selectedNode.id)}
                onSave={(data) => handleUpdateNode(selectedNode.id, data)}
                onAddChild={() => setShowAddNode({ parentId: selectedNode.id })}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══ Dimensions Tab ═══ */}
      {tab === "dimensions" && <DimensionsPanel dimensions={fw.dimensions} />}

      {/* ═══ Version History Tab ═══ */}
      {tab === "versions" && <VersionHistoryPanel versions={versions} />}

      {/* ═══ Edit Metadata Tab ═══ */}
      {tab === "edit" && <EditMetadataPanel fw={fw} onSaved={loadData} />}

      {/* Add Node Modal */}
      <Modal open={!!showAddNode} onClose={() => setShowAddNode(null)}
             title={showAddNode?.parentId ? "Dodaj podwęzeł" : "Dodaj węzeł główny"}>
        {showAddNode && (
          <AddNodeForm
            parentId={showAddNode.parentId}
            onClose={() => setShowAddNode(null)}
            onCreate={handleAddNode}
          />
        )}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TreeNode Component
   ═══════════════════════════════════════════════════ */
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
          background: isSelected ? "var(--bg-card-hover)" : undefined,
          borderLeft: isSelected ? "3px solid var(--blue)" : "3px solid transparent",
          cursor: "pointer",
          transition: "background 0.1s",
        }}
        onClick={(e) => { e.stopPropagation(); onSelect(node); }}
      >
        {/* Expand/collapse */}
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
              <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)", fontSize: 8, padding: "1px 5px" }}>ocenialny</span>
            )}
            {node.implementation_groups && (
              <span className="score-badge" style={{ background: "var(--bg-inset)", color: "var(--text-muted)", fontSize: 8, padding: "1px 5px" }}>{node.implementation_groups}</span>
            )}
          </div>
          {node.description && (isExpanded || !hasChildren) && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.3, maxHeight: 40, overflow: "hidden" }}>
              {node.description}
            </div>
          )}
        </div>

        {/* Quick add child */}
        <span
          style={{ fontSize: 14, color: "var(--text-muted)", cursor: "pointer", padding: "0 4px", flexShrink: 0, lineHeight: "18px", opacity: 0.5 }}
          title="Dodaj podwęzeł"
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

/* ═══════════════════════════════════════════════════
   NodeDetailPanel (right sidebar)
   ═══════════════════════════════════════════════════ */
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
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>Szczegóły węzła</div>
        <div style={{ display: "flex", gap: 4 }}>
          {!editing && <button className="btn btn-sm" onClick={() => setEditing(true)}>Edytuj</button>}
          <button className="btn btn-sm" onClick={onClose}>&#10005;</button>
        </div>
      </div>

      {!editing ? (
        <>
          {node.ref_id && (
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)", fontWeight: 600, marginBottom: 4 }}>
              {node.ref_id}
            </div>
          )}
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{node.name_pl || node.name}</div>

          {node.description && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset)", borderRadius: 6, padding: 8, marginBottom: 8, lineHeight: 1.5 }}>
              {node.description}
            </div>
          )}

          {node.annotation && (
            <div style={{ marginBottom: 8, padding: "6px 8px", background: "var(--bg-inset)", borderRadius: 6, fontSize: 11 }}>
              <strong>Adnotacja:</strong><br />{node.annotation}
            </div>
          )}

          {node.typical_evidence && (
            <div style={{ marginBottom: 8, padding: "6px 8px", background: "var(--bg-inset)", borderRadius: 6, fontSize: 11 }}>
              <strong>Typowe dowody:</strong><br />{node.typical_evidence}
            </div>
          )}

          <div style={{ lineHeight: 2 }}>
            <DetailRow label="Głębokość" value={node.depth} />
            <DetailRow label="Ocenialny" value={
              node.assessable
                ? <span style={{ color: "var(--green)", fontWeight: 500 }}>Tak</span>
                : <span style={{ color: "var(--text-muted)" }}>Nie</span>
            } />
            {node.implementation_groups && <DetailRow label="Gr. implementacji" value={node.implementation_groups} />}
            {node.importance && <DetailRow label="Ważność" value={node.importance} />}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => setEditing(true)}>Edytuj</button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={onAddChild}>+ Podwęzeł</button>
            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={onDelete}>Usuń</button>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="form-group">
            <label>Nazwa</label>
            <input className="form-control" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>ID referencyjny</label>
            <input className="form-control" value={refId} onChange={e => setRefId(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Opis</label>
            <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="form-group">
            <label>Adnotacja</label>
            <textarea className="form-control" value={annotation} onChange={e => setAnnotation(e.target.value)} rows={2} />
          </div>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={assessable} onChange={e => setAssessable(e.target.checked)} />
            Ocenialny (liść drzewa do oceny)
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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

/* ═══════════════════════════════════════════════════
   AddNodeForm
   ═══════════════════════════════════════════════════ */
function AddNodeForm({ parentId, onClose, onCreate }: {
  parentId: number | null;
  onClose: () => void;
  onCreate: (data: { name: string; ref_id: string; description: string; assessable: boolean; parent_id: number | null }) => void;
}) {
  const [name, setName] = useState("");
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [assessable, setAssessable] = useState(false);

  return (
    <div>
      <div style={{ display: "grid", gap: 12 }}>
        <div className="form-group">
          <label>Nazwa *</label>
          <input className="form-control" value={name} onChange={e => setName(e.target.value)}
                 placeholder="Nazwa węzła" autoFocus />
        </div>
        <div className="form-group">
          <label>ID referencyjny</label>
          <input className="form-control" value={refId} onChange={e => setRefId(e.target.value)}
                 placeholder="np. A.5.1" />
        </div>
        <div className="form-group">
          <label>Opis</label>
          <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={assessable} onChange={e => setAssessable(e.target.checked)} />
          Ocenialny (liść drzewa do oceny)
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
  );
}

/* ═══════════════════════════════════════════════════
   DimensionsPanel
   ═══════════════════════════════════════════════════ */
function DimensionsPanel({ dimensions }: { dimensions: Dimension[] }) {
  if (dimensions.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Ten framework nie ma zdefiniowanych wymiarów oceny.
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
                  background: lv.color ? `${lv.color}20` : "var(--bg-inset)",
                  color: lv.color ?? "var(--text)",
                  border: `1px solid ${lv.color ?? "var(--border)"}`,
                }}>
                  <strong>{lv.value}</strong> — {lv.label_pl || lv.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VersionHistoryPanel
   ═══════════════════════════════════════════════════ */
function VersionHistoryPanel({ versions }: { versions: FrameworkVersionHistory[] }) {
  if (versions.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Brak historii wersji.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Wersja</th>
              <th>Status</th>
              <th>Opis zmian</th>
              <th>Zmienione przez</th>
              <th>Data</th>
              <th style={{ textAlign: "right" }}>Węzły</th>
              <th style={{ textAlign: "right" }}>Ocenialne</th>
            </tr>
          </thead>
          <tbody>
            {versions.map(v => (
              <tr key={v.id}>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>v{v.edit_version}</td>
                <td>
                  <span className="score-badge" style={{ background: lcBg(v.lifecycle_status), color: lcColor(v.lifecycle_status), fontSize: 10 }}>
                    {lcLabel(v.lifecycle_status)}
                  </span>
                </td>
                <td style={{ fontSize: 11, maxWidth: 300 }}>{v.change_summary || "—"}</td>
                <td style={{ fontSize: 11 }}>{v.changed_by || "—"}</td>
                <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {v.changed_at ? new Date(v.changed_at).toLocaleString("pl-PL") : "—"}
                </td>
                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  {v.snapshot_nodes_count ?? "—"}
                </td>
                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  {v.snapshot_assessable_count ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   EditMetadataPanel
   ═══════════════════════════════════════════════════ */
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
      alert(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ maxWidth: 600 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="form-group">
            <label>Nazwa</label>
            <input className="form-control" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>ID referencyjny</label>
            <input className="form-control" value={refId} onChange={e => setRefId(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Wersja źródłowa</label>
              <input className="form-control" value={version} onChange={e => setVersion(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Wersja publikacji</label>
              <input className="form-control" value={publishedVersion} onChange={e => setPublishedVersion(e.target.value)} placeholder="np. 1.0" />
            </div>
            <div className="form-group">
              <label>Dostawca</label>
              <input className="form-control" value={provider} onChange={e => setProvider(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Opis</label>
            <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="form-group">
            <label>Opis zmian (do historii wersji)</label>
            <input className="form-control" value={changeSummary} onChange={e => setChangeSummary(e.target.value)}
                   placeholder="Co zostało zmienione?" />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Zapisywanie..." : "Zapisz zmiany"}
            </button>
          </div>

          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            Każda edycja tworzy nową wersję w historii. Wersja publikacji (np. "8.0" benchmarku CIS)
            jest niezależna od wersji edycji w systemie (v{fw.edit_version}).
          </div>
        </div>
      </div>
    </div>
  );
}
