import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { FrameworkDetail, FrameworkNodeTree, Dimension } from "../types";

export default function FrameworkDetailPage() {
  const { fwId } = useParams<{ fwId: string }>();
  const navigate = useNavigate();
  const [fw, setFw] = useState<FrameworkDetail | null>(null);
  const [tree, setTree] = useState<FrameworkNodeTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tree" | "dimensions">("tree");
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!fwId) return;
    setLoading(true);
    Promise.all([
      api.get<FrameworkDetail>(`/api/v1/frameworks/${fwId}`),
      api.get<FrameworkNodeTree[]>(`/api/v1/frameworks/${fwId}/tree`),
    ])
      .then(([fwData, treeData]) => {
        setFw(fwData);
        setTree(treeData);
        // Expand first level by default
        const firstLevel = new Set(treeData.map(n => n.id));
        setExpandedNodes(firstLevel);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fwId]);

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

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ladowanie frameworka...</div>;
  }
  if (!fw) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Framework nie znaleziony</div>;
  }

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
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {fw.version && `v${fw.version}`} {fw.provider && `| ${fw.provider}`} | {fw.total_nodes} wezlow | {fw.total_assessable} ocenialnych
            </div>
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => navigate(`/assessments/new?framework_id=${fw.id}`)}>
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
          Drzewo kontroli
        </button>
        <button className={`btn btn-sm ${tab === "dimensions" ? "btn-primary" : ""}`} onClick={() => setTab("dimensions")}>
          Wymiary oceny ({fw.dimensions.length})
        </button>
      </div>

      {tab === "tree" && (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={expandAll}>Rozwin wszystko</button>
            <button className="btn btn-sm" onClick={collapseAll}>Zwin wszystko</button>
          </div>
          {tree.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Brak wezlow</div>
          ) : (
            <div style={{ padding: "8px 0" }}>
              {tree.map(node => (
                <TreeNode key={node.id} node={node} expanded={expandedNodes} onToggle={toggleNode} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "dimensions" && (
        <DimensionsPanel dimensions={fw.dimensions} />
      )}
    </div>
  );
}

/* ─── Tree Node Component ─── */
function TreeNode({ node, expanded, onToggle }: {
  node: FrameworkNodeTree;
  expanded: Set<number>;
  onToggle: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const indent = node.depth * 20;

  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 12px", paddingLeft: indent + 12,
          fontSize: 12, cursor: hasChildren ? "pointer" : "default",
          borderBottom: "1px solid rgba(42,53,84,0.08)",
        }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        <span style={{ width: 16, textAlign: "center", fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
          {hasChildren ? (isExpanded ? "v" : ">") : " "}
        </span>
        {node.ref_id && (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--blue)", fontWeight: 600, flexShrink: 0 }}>
            {node.ref_id}
          </span>
        )}
        <span style={{ fontWeight: node.depth <= 1 ? 600 : 400 }}>
          {node.name_pl || node.name}
        </span>
        {node.assessable && (
          <span className="badge badge-green" style={{ fontSize: 9, padding: "1px 6px" }}>ocenialny</span>
        )}
        {node.implementation_groups && (
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{node.implementation_groups}</span>
        )}
      </div>
      {isExpanded && node.children.map(child => (
        <TreeNode key={child.id} node={child} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  );
}

/* ─── Dimensions Panel ─── */
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
