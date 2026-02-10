import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { OrgUnitTreeNode } from "../types";

function TreeNode({ node, depth, selected, onSelect }: {
  node: OrgUnitTreeNode; depth: number;
  selected: number | null; onSelect: (n: OrgUnitTreeNode) => void;
}) {
  const icons = ["🏢", "💻", "📁", "👥"];
  const icon = icons[Math.min(depth, icons.length - 1)];

  return (
    <>
      <div
        className={`tree-item${depth === 0 ? " root" : ""}`}
        style={{ marginLeft: depth * 20, borderLeftColor: selected === node.id ? "var(--blue)" : undefined, background: selected === node.id ? "var(--bg-card-hover)" : undefined }}
        onClick={() => onSelect(node)}
      >
        {icon} {node.name}
        <span className="tree-badge" style={{ background: node.is_active ? "var(--green-dim)" : "var(--red-dim)", color: node.is_active ? "var(--green)" : "var(--red)" }}>
          {node.is_active ? "Aktywna" : "Nieaktywna"}
        </span>
        <div className="tree-meta">{node.level_name} · {node.symbol} {node.owner ? `· ${node.owner}` : ""}</div>
      </div>
      {node.children.map((ch) => (
        <TreeNode key={ch.id} node={ch} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

export default function OrgStructurePage() {
  const [tree, setTree] = useState<OrgUnitTreeNode[]>([]);
  const [selected, setSelected] = useState<OrgUnitTreeNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree")
      .then(setTree)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Hierarchia: Organizacja → Pion → Dział → Zespół
          </span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm">+ Dodaj jednostkę</button>
        </div>
      </div>
      <div className="grid-1-2">
        <div className="card">
          <div className="card-title">Drzewo Struktury</div>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Ładowanie...</p>
          ) : tree.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak jednostek lub brak połączenia z API.</p>
          ) : (
            tree.map((n) => (
              <TreeNode key={n.id} node={n} depth={0} selected={selected?.id ?? null} onSelect={setSelected} />
            ))
          )}
        </div>
        <div className="card">
          <div className="card-title">Szczegóły Jednostki</div>
          {selected ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group"><label>Nazwa</label><input className="form-control" defaultValue={selected.name} /></div>
              <div className="form-group"><label>Symbol</label><input className="form-control" defaultValue={selected.symbol} /></div>
              <div className="form-group"><label>Właściciel biznesowy</label><input className="form-control" defaultValue={selected.owner ?? ""} /></div>
              <div className="form-group"><label>Security Contact</label><input className="form-control" defaultValue={selected.security_contact ?? ""} /></div>
              <div className="form-group"><label>Status</label>
                <select className="form-control" defaultValue={selected.is_active ? "active" : "inactive"}>
                  <option value="active">Aktywna</option>
                  <option value="inactive">Nieaktywna</option>
                </select>
              </div>
              <div className="form-group"><label>Poziom</label><input className="form-control" value={selected.level_name} disabled /></div>
              <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button className="btn btn-sm btn-danger">Dezaktywuj</button>
                <button className="btn btn-primary btn-sm">💾 Zapisz zmiany</button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Wybierz jednostkę z drzewa, aby zobaczyć szczegóły.</p>
          )}
        </div>
      </div>
    </div>
  );
}
