import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { OrgUnitTreeNode, OrgLevel } from "../types";
import Modal from "../components/Modal";

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

function flattenTree(nodes: OrgUnitTreeNode[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

export default function OrgStructurePage() {
  const [tree, setTree] = useState<OrgUnitTreeNode[]>([]);
  const [selected, setSelected] = useState<OrgUnitTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [levels, setLevels] = useState<OrgLevel[]>([]);
  const [saving, setSaving] = useState(false);

  const loadTree = () => {
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree")
      .then(setTree)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTree(); }, []);

  const openAddForm = async () => {
    if (levels.length === 0) {
      try {
        const lvls = await api.get<OrgLevel[]>("/api/v1/org-levels");
        setLevels(lvls);
      } catch { /* ignore */ }
    }
    setShowAddForm(true);
  };

  const handleAddUnit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      parent_id: fd.get("parent_id") ? Number(fd.get("parent_id")) : null,
      level_id: Number(fd.get("level_id")),
      name: fd.get("name") as string,
      symbol: fd.get("symbol") as string,
      owner: (fd.get("owner") as string) || null,
      security_contact: (fd.get("security_contact") as string) || null,
      description: (fd.get("description") as string) || null,
    };
    try {
      await api.post("/api/v1/org-units", body);
      setShowAddForm(false);
      setLoading(true);
      loadTree();
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selected) return;
    const nameInput = document.querySelector<HTMLInputElement>('input[data-field="name"]');
    const symbolInput = document.querySelector<HTMLInputElement>('input[data-field="symbol"]');
    const ownerInput = document.querySelector<HTMLInputElement>('input[data-field="owner"]');
    const contactInput = document.querySelector<HTMLInputElement>('input[data-field="security_contact"]');
    const statusSelect = document.querySelector<HTMLSelectElement>('select[data-field="is_active"]');
    if (!nameInput || !symbolInput) return;
    setSaving(true);
    const body = {
      name: nameInput.value,
      symbol: symbolInput.value,
      owner: ownerInput?.value || null,
      security_contact: contactInput?.value || null,
      is_active: statusSelect?.value === "active",
    };
    try {
      await api.put(`/api/v1/org-units/${selected.id}`, body);
      setLoading(true);
      setSelected(null);
      loadTree();
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    if (!confirm(`Dezaktywować jednostkę "${selected.name}"?`)) return;
    try {
      await api.delete(`/api/v1/org-units/${selected.id}`);
      setSelected(null);
      setLoading(true);
      loadTree();
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  const flatUnits = flattenTree(tree);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Hierarchia: Organizacja → Pion → Dział → Zespół
          </span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={openAddForm}>+ Dodaj jednostkę</button>
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
              <div className="form-group"><label>Nazwa</label><input data-field="name" className="form-control" defaultValue={selected.name} key={selected.id + "-name"} /></div>
              <div className="form-group"><label>Symbol</label><input data-field="symbol" className="form-control" defaultValue={selected.symbol} key={selected.id + "-sym"} /></div>
              <div className="form-group"><label>Właściciel biznesowy</label><input data-field="owner" className="form-control" defaultValue={selected.owner ?? ""} key={selected.id + "-own"} /></div>
              <div className="form-group"><label>Security Contact</label><input data-field="security_contact" className="form-control" defaultValue={selected.security_contact ?? ""} key={selected.id + "-sec"} /></div>
              <div className="form-group"><label>Status</label>
                <select data-field="is_active" className="form-control" defaultValue={selected.is_active ? "active" : "inactive"} key={selected.id + "-stat"}>
                  <option value="active">Aktywna</option>
                  <option value="inactive">Nieaktywna</option>
                </select>
              </div>
              <div className="form-group"><label>Poziom</label><input className="form-control" value={selected.level_name} disabled /></div>
              <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button className="btn btn-sm btn-danger" onClick={handleDeactivate}>Dezaktywuj</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveChanges} disabled={saving}>
                  {saving ? "Zapisywanie..." : "💾 Zapisz zmiany"}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Wybierz jednostkę z drzewa, aby zobaczyć szczegóły.</p>
          )}
        </div>
      </div>

      <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Dodaj jednostkę organizacyjną">
        <form onSubmit={handleAddUnit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Jednostka nadrzędna</label>
              <select name="parent_id" className="form-control">
                <option value="">Brak (najwyższy poziom)</option>
                {flatUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Poziom *</label>
              <select name="level_id" className="form-control" required>
                <option value="">Wybierz...</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nazwa *</label>
              <input name="name" className="form-control" required placeholder="np. Dział IT" />
            </div>
            <div className="form-group">
              <label>Symbol *</label>
              <input name="symbol" className="form-control" required placeholder="np. DIT" />
            </div>
            <div className="form-group">
              <label>Właściciel biznesowy</label>
              <input name="owner" className="form-control" placeholder="np. Jan Kowalski" />
            </div>
            <div className="form-group">
              <label>Security Contact</label>
              <input name="security_contact" className="form-control" placeholder="np. Anna Nowak" />
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Opis</label>
              <textarea name="description" className="form-control" placeholder="Opis jednostki..." />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setShowAddForm(false)}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Zapisywanie..." : "Dodaj jednostkę"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
