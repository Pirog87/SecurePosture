import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../services/api";
import type { AssetGraph, AssetGraphNode, AssetGraphEdge, Asset, AssetRelationship } from "../types";
import Modal from "../components/Modal";

const REL_TYPES = [
  { value: "depends_on", label: "Zalezy od", color: "#f59e0b" },
  { value: "supports", label: "Wspiera", color: "#3b82f6" },
  { value: "connects_to", label: "Laczy sie z", color: "#8b5cf6" },
  { value: "contains", label: "Zawiera", color: "#10b981" },
  { value: "backup_of", label: "Kopia zapasowa", color: "#06b6d4" },
  { value: "replaces", label: "Zastepuje", color: "#ef4444" },
];

function relColor(type: string): string {
  return REL_TYPES.find(r => r.value === type)?.color ?? "#94a3b8";
}

function relLabel(type: string): string {
  return REL_TYPES.find(r => r.value === type)?.label ?? type;
}

function critNodeColor(name: string | null): string {
  if (!name) return "#475569";
  const l = name.toLowerCase();
  if (l.includes("wysok") || l.includes("krytycz")) return "#ef4444";
  if (l.includes("średni") || l.includes("medium")) return "#f59e0b";
  return "#22c55e";
}

interface NodePos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function AssetGraphPage() {
  const [graph, setGraph] = useState<AssetGraph | null>(null);
  const [relationships, setRelationships] = useState<AssetRelationship[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRel, setShowAddRel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AssetGraphNode | null>(null);
  const [view, setView] = useState<"graph" | "table">("graph");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<Map<number, NodePos>>(new Map());
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const graphRef = useRef<AssetGraph | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [g, rels, a] = await Promise.all([
        api.get<AssetGraph>("/api/v1/assets/graph/data"),
        api.get<AssetRelationship[]>("/api/v1/assets/relationships/all"),
        api.get<Asset[]>("/api/v1/assets"),
      ]);
      setGraph(g);
      graphRef.current = g;
      setRelationships(rels);
      setAssets(a);
      initPositions(g);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); return () => cancelAnimationFrame(animRef.current); }, []);

  const initPositions = (g: AssetGraph) => {
    const map = new Map<number, NodePos>();
    const cx = 400, cy = 300;
    g.nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(g.nodes.length, 1);
      const r = 120 + Math.random() * 80;
      map.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 });
    });
    positionsRef.current = map;
  };

  // Simple force-directed layout simulation
  const simulate = useCallback(() => {
    const g = graphRef.current;
    if (!g || g.nodes.length === 0) return;
    const pos = positionsRef.current;

    // Repulsion between all nodes
    for (let i = 0; i < g.nodes.length; i++) {
      for (let j = i + 1; j < g.nodes.length; j++) {
        const a = pos.get(g.nodes[i].id)!;
        const b = pos.get(g.nodes[j].id)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 8000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Attraction along edges
    for (const e of g.edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = (dist - 150) * 0.02;
      const fx = (dx / Math.max(dist, 1)) * force;
      const fy = (dy / Math.max(dist, 1)) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Center gravity
    for (const n of g.nodes) {
      const p = pos.get(n.id)!;
      p.vx += (400 - p.x) * 0.005;
      p.vy += (300 - p.y) * 0.005;
    }

    // Apply velocity with damping
    for (const n of g.nodes) {
      const p = pos.get(n.id)!;
      if (dragRef.current?.id === n.id) { p.vx = 0; p.vy = 0; continue; }
      p.vx *= 0.8;
      p.vy *= 0.8;
      p.x += p.vx;
      p.y += p.vy;
      p.x = Math.max(40, Math.min(760, p.x));
      p.y = Math.max(40, Math.min(560, p.y));
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const g = graphRef.current;
    if (!canvas || !g) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = positionsRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    for (const e of g.edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = relColor(e.type);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrow
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.beginPath();
      ctx.moveTo(mx + 8 * Math.cos(angle), my + 8 * Math.sin(angle));
      ctx.lineTo(mx - 5 * Math.cos(angle - 0.5), my - 5 * Math.sin(angle - 0.5));
      ctx.lineTo(mx - 5 * Math.cos(angle + 0.5), my - 5 * Math.sin(angle + 0.5));
      ctx.closePath();
      ctx.fillStyle = relColor(e.type);
      ctx.fill();

      // Edge label
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(relLabel(e.type), mx, my - 8);
    }

    // Draw nodes
    for (const n of g.nodes) {
      const p = pos.get(n.id);
      if (!p) continue;
      const r = 22 + (n.risk_count > 0 ? 4 : 0);
      const isSelected = selectedNode?.id === n.id;

      // Node circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#1e293b" : "#0f172a";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#3b82f6" : critNodeColor(n.criticality_name);
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Risk count badge
      if (n.risk_count > 0) {
        ctx.beginPath();
        ctx.arc(p.x + r - 4, p.y - r + 4, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.font = "bold 9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n.risk_count), p.x + r - 4, p.y - r + 4);
      }

      // Label
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = n.name.length > 18 ? n.name.slice(0, 16) + ".." : n.name;
      ctx.fillText(label, p.x, p.y + r + 4);

      // Type badge
      if (n.asset_type_name) {
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText(n.asset_type_name, p.x, p.y + r + 18);
      }
    }
  }, [selectedNode]);

  // Animation loop
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;
    let ticks = 0;
    const loop = () => {
      if (ticks < 200) simulate();
      draw();
      ticks++;
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [graph, simulate, draw]);

  // Canvas mouse events
  const findNode = (mx: number, my: number): AssetGraphNode | null => {
    const g = graphRef.current;
    if (!g) return null;
    const pos = positionsRef.current;
    for (const n of g.nodes) {
      const p = pos.get(n.id);
      if (!p) continue;
      const dx = mx - p.x, dy = my - p.y;
      if (dx * dx + dy * dy < 700) return n;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const n = findNode(mx, my);
    if (n) {
      const p = positionsRef.current.get(n.id);
      if (p) dragRef.current = { id: n.id, offsetX: mx - p.x, offsetY: my - p.y };
      setSelectedNode(n);
    } else {
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const p = positionsRef.current.get(dragRef.current.id);
    if (p) {
      p.x = mx - dragRef.current.offsetX;
      p.y = my - dragRef.current.offsetY;
    }
  };

  const handleMouseUp = () => { dragRef.current = null; };

  const handleAddRelationship = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      source_asset_id: Number(fd.get("source_asset_id")),
      target_asset_id: Number(fd.get("target_asset_id")),
      relationship_type: fd.get("relationship_type") as string,
      description: (fd.get("description") as string) || null,
    };
    try {
      await api.post("/api/v1/assets/relationships", body);
      setShowAddRel(false);
      await loadData();
    } catch (err) {
      alert("Blad: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRel = async (relId: number) => {
    if (!confirm("Usunac te relacje?")) return;
    try {
      await api.delete(`/api/v1/assets/relationships/${relId}`);
      await loadData();
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ladowanie grafu aktywow...</span>
      </div>
    );
  }

  return (
    <div>
      {/* KPI bar */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)" }}>{assets.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Aktywow</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{relationships.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Relacji</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--cyan)" }}>{graph?.nodes.length ?? 0}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Polaczonych</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--orange)" }}>{assets.filter(a => !graph?.nodes.find(n => n.id === a.id)).length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Izolowanych</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button className={`btn btn-sm ${view === "graph" ? "btn-primary" : ""}`} onClick={() => setView("graph")}>Diagram</button>
          <button className={`btn btn-sm ${view === "table" ? "btn-primary" : ""}`} onClick={() => setView("table")}>Tabela relacji</button>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddRel(true)}>+ Dodaj relacje</button>
        </div>
      </div>

      {view === "graph" ? (
        <div style={{ display: "grid", gridTemplateColumns: selectedNode ? "1fr 320px" : "1fr", gap: 14 }}>
          <div className="card" style={{ padding: 8, overflow: "hidden" }}>
            {graph && graph.nodes.length > 0 ? (
              <>
                {/* Legend */}
                <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  {REL_TYPES.map(r => (
                    <span key={r.value} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 10, height: 3, background: r.color, display: "inline-block", borderRadius: 2 }} />
                      <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                    </span>
                  ))}
                </div>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  style={{ width: "100%", height: "auto", borderRadius: 8, background: "#0a0e1a", cursor: dragRef.current ? "grabbing" : "grab" }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </>
            ) : (
              <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Brak relacji miedzy aktywami. Dodaj relacje aby zobaczyc diagram.
              </div>
            )}
          </div>

          {/* Selected node info */}
          {selectedNode && (
            <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start" }}>
              <div className="card-title">{selectedNode.name}</div>
              <div style={{ fontSize: 12, lineHeight: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Typ</span>
                  <span>{selectedNode.asset_type_name ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Krytycznosc</span>
                  <span style={{ color: critNodeColor(selectedNode.criticality_name) }}>{selectedNode.criticality_name ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Pion</span>
                  <span>{selectedNode.org_unit_name ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Ryzyka</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: selectedNode.risk_count > 0 ? "var(--red)" : "var(--text-muted)" }}>{selectedNode.risk_count}</span>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Relacje</div>
                {graph?.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map(e => {
                  const other = e.source === selectedNode.id
                    ? graph.nodes.find(n => n.id === e.target)
                    : graph.nodes.find(n => n.id === e.source);
                  const direction = e.source === selectedNode.id ? "→" : "←";
                  return (
                    <div key={e.id} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid rgba(42,53,84,0.15)" }}>
                      <span style={{ color: relColor(e.type) }}>{relLabel(e.type)}</span>
                      {" "}<span style={{ color: "var(--text-muted)" }}>{direction}</span>
                      {" "}<span style={{ color: "var(--text-primary)" }}>{other?.name ?? "?"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Table view */
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {relationships.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Brak relacji. Kliknij "+ Dodaj relacje" aby zdefiniowac powiazania.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zrodlowy aktyw</th>
                  <th>Typ relacji</th>
                  <th>Docelowy aktyw</th>
                  <th>Opis</th>
                  <th>Utworzono</th>
                  <th style={{ width: 80 }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.source_asset_name ?? `#${r.source_asset_id}`}</td>
                    <td>
                      <span style={{ fontSize: 12, color: relColor(r.relationship_type), fontWeight: 500 }}>
                        {relLabel(r.relationship_type)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{r.target_asset_name ?? `#${r.target_asset_id}`}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.description ?? "—"}</td>
                    <td style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)" }}>{r.created_at?.slice(0, 10)}</td>
                    <td>
                      <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleDeleteRel(r.id)}>Usun</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Relationship Modal */}
      <Modal open={showAddRel} onClose={() => setShowAddRel(false)} title="Dodaj relacje miedzy aktywami">
        <form onSubmit={handleAddRelationship}>
          <div className="form-group">
            <label>Aktyw zrodlowy *</label>
            <select name="source_asset_id" className="form-control" required>
              <option value="">Wybierz...</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Typ relacji *</label>
            <select name="relationship_type" className="form-control" required>
              <option value="">Wybierz...</option>
              {REL_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Aktyw docelowy *</label>
            <select name="target_asset_id" className="form-control" required>
              <option value="">Wybierz...</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Opis</label>
            <input name="description" className="form-control" placeholder="Opcjonalny opis relacji..." />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setShowAddRel(false)}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Zapisywanie..." : "Dodaj relacje"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
