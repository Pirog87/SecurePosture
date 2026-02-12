import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { OrgUnitTreeNode } from "../types";

/* ─── Fuzzy search ─── */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[ąà]/g, "a").replace(/[ćč]/g, "c").replace(/[ęè]/g, "e")
    .replace(/[łl]/g, "l").replace(/[ńñ]/g, "n").replace(/[óò]/g, "o").replace(/[śš]/g, "s")
    .replace(/[źżž]/g, "z").replace(/[^\w\s]/g, "");
}

function bigrams(s: string): Set<string> {
  const b = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2));
  return b;
}

function fuzzyScore(query: string, target: string): number {
  const nq = normalize(query);
  const nt = normalize(target);
  // Exact substring match gets highest score
  if (nt.includes(nq)) return 1;
  // Word-start match
  const words = nt.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(nq)) return 0.95;
  }
  // Bigram similarity (Dice coefficient)
  if (nq.length < 2 || nt.length < 2) return 0;
  const qBigrams = bigrams(nq);
  const tBigrams = bigrams(nt);
  let intersection = 0;
  for (const b of qBigrams) {
    if (tBigrams.has(b)) intersection++;
  }
  return (2 * intersection) / (qBigrams.size + tBigrams.size);
}

function matchesNode(query: string, node: OrgUnitTreeNode): boolean {
  if (!query) return true;
  const nameScore = fuzzyScore(query, node.name);
  const symbolScore = fuzzyScore(query, node.symbol);
  return nameScore > 0.35 || symbolScore > 0.35;
}

function filterTree(nodes: OrgUnitTreeNode[], query: string): OrgUnitTreeNode[] {
  if (!query) return nodes;
  const result: OrgUnitTreeNode[] = [];
  for (const node of nodes) {
    const childMatches = filterTree(node.children, query);
    if (matchesNode(query, node) || childMatches.length > 0) {
      result.push({ ...node, children: childMatches.length > 0 ? childMatches : (matchesNode(query, node) ? node.children : []) });
    }
  }
  return result;
}

/* ─── Tree node in dropdown ─── */
function DropdownTreeNode({ node, depth, onSelect, expandedIds, toggleExpand, highlightId, query }: {
  node: OrgUnitTreeNode;
  depth: number;
  onSelect: (node: OrgUnitTreeNode) => void;
  expandedIds: Set<number>;
  toggleExpand: (id: number) => void;
  highlightId: number | null;
  query: string;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isHighlighted = highlightId === node.id;
  const depthIcons = ["🏢", "💻", "📁", "👥"];
  const icon = depthIcons[Math.min(depth, depthIcons.length - 1)];

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 8px",
          paddingLeft: depth * 18 + 8,
          cursor: "pointer",
          background: isHighlighted ? "var(--blue-dim)" : "transparent",
          fontSize: 13,
          transition: "background 0.1s",
          borderLeft: isHighlighted ? "2px solid var(--blue)" : "2px solid transparent",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { if (!isHighlighted) e.currentTarget.style.background = "var(--bg-card-hover)"; }}
        onMouseLeave={e => { if (!isHighlighted) e.currentTarget.style.background = "transparent"; }}
        onClick={(e) => { e.stopPropagation(); onSelect(node); }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
            style={{ cursor: "pointer", fontSize: 9, width: 14, textAlign: "center", color: "var(--text-muted)", userSelect: "none", flexShrink: 0 }}
          >
            {isExpanded ? "▼" : "▶"}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={{ flexShrink: 0 }}>{icon}</span>
        <span style={{ fontWeight: depth === 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4, flexShrink: 0 }}>{node.symbol}</span>
      </div>
      {isExpanded && hasChildren && node.children.map(ch => (
        <DropdownTreeNode
          key={ch.id}
          node={ch}
          depth={depth + 1}
          onSelect={onSelect}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          highlightId={highlightId}
          query={query}
        />
      ))}
    </>
  );
}

/* ─── Build path for display ─── */
function buildNodePath(nodes: OrgUnitTreeNode[], targetId: number, path: string[] = []): string[] | null {
  for (const n of nodes) {
    const currentPath = [...path, n.name];
    if (n.id === targetId) return currentPath;
    const found = buildNodePath(n.children, targetId, currentPath);
    if (found) return found;
  }
  return null;
}

/* ─── Collect all IDs recursively ─── */
function collectAllIds(nodes: OrgUnitTreeNode[]): Set<number> {
  const ids = new Set<number>();
  for (const n of nodes) {
    ids.add(n.id);
    for (const id of collectAllIds(n.children)) ids.add(id);
  }
  return ids;
}

/* ═══════════════════════════════════════════════════════
   OrgUnitTreeSelect — main component
   ═══════════════════════════════════════════════════════ */
export interface OrgUnitTreeSelectProps {
  tree: OrgUnitTreeNode[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function OrgUnitTreeSelect({
  tree, value, onChange, placeholder = "Wybierz jednostkę...", allowClear = true, className, style, disabled,
}: OrgUnitTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    // Default: expand only level-0 nodes
    return new Set(tree.map(n => n.id));
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update expanded when tree changes
  useEffect(() => {
    setExpandedIds(new Set(tree.map(n => n.id)));
  }, [tree]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Selected node path
  const selectedPath = useMemo(() => {
    if (!value) return null;
    const path = buildNodePath(tree, value);
    return path ? path.join(" → ") : null;
  }, [tree, value]);

  // Selected node name
  const selectedName = useMemo(() => {
    if (!value) return null;
    const path = buildNodePath(tree, value);
    return path ? path[path.length - 1] : null;
  }, [tree, value]);

  // Filtered tree
  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query]);

  // When searching, auto-expand all matched
  useEffect(() => {
    if (query) {
      setExpandedIds(collectAllIds(filteredTree));
    }
  }, [query, filteredTree]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((node: OrgUnitTreeNode) => {
    onChange(node.id);
    setOpen(false);
    setQuery("");
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery("");
  }, [onChange]);

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", ...style }}>
      {/* Trigger */}
      <div
        onClick={() => { if (!disabled) setOpen(!open); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "var(--bg-input, var(--bg-card))",
          border: "1px solid var(--border)",
          borderRadius: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 13,
          minHeight: 34,
          opacity: disabled ? 0.5 : 1,
        }}
        className="form-control"
      >
        {selectedName ? (
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedPath ?? undefined}>
            {selectedPath}
          </span>
        ) : (
          <span style={{ flex: 1, color: "var(--text-muted)" }}>{placeholder}</span>
        )}
        {allowClear && value && !disabled && (
          <span onClick={handleClear} style={{ cursor: "pointer", fontSize: 14, color: "var(--text-muted)", padding: "0 2px", lineHeight: 1 }} title="Wyczyść">✕</span>
        )}
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          zIndex: 1000,
          marginTop: 2,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          maxHeight: 360,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 320,
        }}>
          {/* Search input */}
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Szukaj jednostki... (fuzzy)"
              style={{
                width: "100%",
                padding: "6px 10px",
                background: "var(--bg-input, var(--bg-main))",
                border: "1px solid var(--border)",
                borderRadius: 5,
                fontSize: 13,
                color: "var(--text-primary, inherit)",
                outline: "none",
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Tree list */}
          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {allowClear && (
              <div
                onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
                style={{
                  padding: "5px 8px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {placeholder}
              </div>
            )}
            {filteredTree.length === 0 ? (
              <div style={{ padding: "16px 8px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Brak wyników dla „{query}"
              </div>
            ) : (
              filteredTree.map(n => (
                <DropdownTreeNode
                  key={n.id}
                  node={n}
                  depth={0}
                  onSelect={handleSelect}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  highlightId={value}
                  query={query}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
