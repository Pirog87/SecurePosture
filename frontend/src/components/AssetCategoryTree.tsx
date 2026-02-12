import { useState, useEffect } from "react";
import type { AssetCategoryTreeNode } from "../types";

/* ── Icon map: Lucide-style names → simple emoji/unicode ── */
const ICON_MAP: Record<string, string> = {
  HardDrive: "🖥️", Server: "🖥️", Monitor: "🖥️", Laptop: "💻",
  Smartphone: "📱", Printer: "🖨️", Database: "🗄️",
  Network: "🌐", Globe: "🌐", Router: "🔌", Shield: "🛡️",
  Code: "💻", Layers: "📚", AppWindow: "📱", Cloud: "☁️", Settings: "⚙️",
  Users: "👥", User: "👤", UsersGroup: "👥", Briefcase: "💼",
  FileText: "📄", File: "📄", Table: "📊", Key: "🔑",
  Building: "🏢", MapPin: "📍", Door: "🚪",
  Workflow: "⚙️", GitBranch: "🔀", Headphones: "🎧",
};

function getIcon(iconName: string | null): string {
  if (!iconName) return "📁";
  return ICON_MAP[iconName] ?? "📁";
}

/* ── Tree node component ── */
function TreeNode({ node, depth, selectedId, onSelect, expandedIds, toggleExpand }: {
  node: AssetCategoryTreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (cat: AssetCategoryTreeNode) => void;
  expandedIds: Set<number>;
  toggleExpand: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isAbstract = node.is_abstract;

  return (
    <>
      <div
        onClick={() => {
          if (hasChildren) toggleExpand(node.id);
          onSelect(node);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          paddingLeft: depth * 16 + 8,
          cursor: "pointer",
          background: isSelected ? "var(--blue-dim)" : "transparent",
          borderLeft: isSelected ? "3px solid var(--blue)" : "3px solid transparent",
          fontSize: 12,
          transition: "all 0.15s",
          color: isSelected ? "var(--blue)" : "var(--text-primary)",
          fontWeight: isSelected ? 600 : isAbstract ? 600 : 400,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
      >
        {hasChildren ? (
          <span style={{
            fontSize: 8, width: 12, textAlign: "center",
            color: "var(--text-muted)", userSelect: "none", flexShrink: 0,
            transition: "transform 0.15s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            ▶
          </span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        <span style={{ flexShrink: 0, fontSize: 13 }}>{getIcon(node.icon)}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
          {node.name}
        </span>
        {node.asset_count > 0 && (
          <span style={{
            fontSize: 10, color: "var(--text-muted)",
            background: "rgba(255,255,255,0.05)", borderRadius: 8,
            padding: "1px 6px", flexShrink: 0,
            fontFamily: "'JetBrains Mono',monospace",
          }}>
            {node.asset_count}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && node.children.map(ch => (
        <TreeNode
          key={ch.id}
          node={ch}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════
   AssetCategoryTree — Main Component
   ═══════════════════════════════════════════════ */
export default function AssetCategoryTree({ tree, selectedId, onSelect, loading }: {
  tree: AssetCategoryTreeNode[];
  selectedId: number | null;
  onSelect: (cat: AssetCategoryTreeNode | null) => void;
  loading?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() =>
    new Set(tree.map(n => n.id)),
  );
  const [search, setSearch] = useState("");

  // Expand top-level when tree changes
  useEffect(() => {
    setExpandedIds(new Set(tree.map(n => n.id)));
  }, [tree]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Filter tree by search
  const filteredTree = search
    ? filterByName(tree, search.toLowerCase())
    : tree;

  // Total asset count across all categories
  const totalCount = countAll(tree);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      borderRight: "1px solid var(--border)",
      background: "var(--bg-card)",
      minWidth: 220, maxWidth: 280, width: 250,
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 12px 8px",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 8 }}>
          Kategorie Aktywow
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj kategorii..."
          style={{
            width: "100%", padding: "5px 8px", fontSize: 11,
            background: "var(--bg-input, var(--bg-main))",
            border: "1px solid var(--border)", borderRadius: 5,
            color: "var(--text-primary)", outline: "none",
          }}
        />
      </div>

      {/* "All assets" option */}
      <div
        onClick={() => onSelect(null)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 12px", cursor: "pointer", fontSize: 12,
          background: selectedId === null ? "var(--blue-dim)" : "transparent",
          borderLeft: selectedId === null ? "3px solid var(--blue)" : "3px solid transparent",
          color: selectedId === null ? "var(--blue)" : "var(--text-primary)",
          fontWeight: selectedId === null ? 600 : 500,
          borderBottom: "1px solid var(--border)",
        }}
        onMouseEnter={e => { if (selectedId !== null) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={e => { if (selectedId !== null) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ fontSize: 13 }}>📋</span>
        <span style={{ flex: 1 }}>Wszystkie aktywa</span>
        <span style={{
          fontSize: 10, color: "var(--text-muted)",
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          {totalCount}
        </span>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            Ladowanie kategorii...
          </div>
        ) : filteredTree.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            {search ? `Brak wynikow dla "${search}"` : "Brak kategorii"}
          </div>
        ) : (
          filteredTree.map(n => (
            <TreeNode
              key={n.id}
              node={n}
              depth={0}
              selectedId={selectedId}
              onSelect={cat => onSelect(cat)}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function filterByName(nodes: AssetCategoryTreeNode[], query: string): AssetCategoryTreeNode[] {
  const result: AssetCategoryTreeNode[] = [];
  for (const node of nodes) {
    const childMatches = filterByName(node.children, query);
    if (node.name.toLowerCase().includes(query) || childMatches.length > 0) {
      result.push({ ...node, children: childMatches.length > 0 ? childMatches : node.children });
    }
  }
  return result;
}

function countAll(nodes: AssetCategoryTreeNode[]): number {
  let total = 0;
  for (const n of nodes) {
    total += n.asset_count;
    total += countAll(n.children);
  }
  return total;
}
