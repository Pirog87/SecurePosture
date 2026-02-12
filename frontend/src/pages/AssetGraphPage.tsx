import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import type { AssetGraph, AssetGraphNode, AssetGraphEdge, Asset, AssetRelationship } from "../types";
import Modal from "../components/Modal";

/* ═══════════════════════════════════════════════════════════
   Constants & helpers
   ═══════════════════════════════════════════════════════════ */

const REL_TYPES = [
  { value: "depends_on", label: "Zależy od", color: "#f59e0b" },
  { value: "supports", label: "Wspiera", color: "#3b82f6" },
  { value: "connects_to", label: "Łączy się z", color: "#8b5cf6" },
  { value: "contains", label: "Zawiera", color: "#10b981" },
  { value: "backup_of", label: "Kopia zapasowa", color: "#06b6d4" },
  { value: "replaces", label: "Zastępuje", color: "#ef4444" },
];

function relColor(type: string): string {
  return REL_TYPES.find((r) => r.value === type)?.color ?? "#94a3b8";
}
function relLabel(type: string): string {
  return REL_TYPES.find((r) => r.value === type)?.label ?? type;
}

function critColor(name: string | null): string {
  if (!name) return "#475569";
  const l = name.toLowerCase();
  if (l.includes("wysok") || l.includes("krytycz")) return "#ef4444";
  if (l.includes("średni") || l.includes("medium")) return "#f59e0b";
  return "#22c55e";
}

const NODE_ICONS: Record<string, string> = {
  serwer: "S", server: "S", baza: "DB", database: "DB",
  aplikacja: "A", application: "A", siec: "N", network: "N",
  urzadzenie: "D", device: "D", osoba: "P", person: "P",
  dokument: "F", document: "F", usługa: "U", service: "U",
};

function nodeIcon(typeName: string | null): string {
  if (!typeName) return "?";
  const lower = typeName.toLowerCase();
  for (const [k, v] of Object.entries(NODE_ICONS)) {
    if (lower.includes(k)) return v;
  }
  return typeName.charAt(0).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════
   Layout: positions for nodes
   ═══════════════════════════════════════════════════════════ */

interface NodePos {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
}

/** Detect connected components (clusters) */
function findClusters(nodes: AssetGraphNode[], edges: AssetGraphEdge[]): number[][] {
  const idSet = new Set(nodes.map((n) => n.id));
  const adj = new Map<number, Set<number>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (idSet.has(e.source) && idSet.has(e.target)) {
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
  }
  const visited = new Set<number>();
  const clusters: number[][] = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const cluster: number[] = [];
    const stack = [n.id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      cluster.push(id);
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) stack.push(nb);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/** Build a hierarchical tree layout for a cluster */
function treeLayout(
  clusterIds: number[],
  edges: AssetGraphEdge[],
  offsetX: number,
  offsetY: number,
): Map<number, { x: number; y: number }> {
  const idSet = new Set(clusterIds);
  const clusterEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));

  // Build adjacency: prefer contains/depends_on for parent-child
  const children = new Map<number, Set<number>>();
  const parentOf = new Map<number, number>();
  for (const id of clusterIds) children.set(id, new Set());

  // First pass: hierarchy edges
  const hierarchyTypes = ["contains", "depends_on", "supports"];
  for (const e of clusterEdges) {
    if (hierarchyTypes.includes(e.type) && !parentOf.has(e.target)) {
      children.get(e.source)!.add(e.target);
      parentOf.set(e.target, e.source);
    }
  }
  // Second pass: remaining edges
  for (const e of clusterEdges) {
    if (!parentOf.has(e.target) && e.target !== e.source) {
      children.get(e.source)!.add(e.target);
      parentOf.set(e.target, e.source);
    }
  }

  // Find roots (nodes with no parent)
  const roots = clusterIds.filter((id) => !parentOf.has(id));
  if (roots.length === 0) roots.push(clusterIds[0]);

  // BFS to assign layers
  const layers = new Map<number, number>();
  const queue: number[] = [...roots];
  for (const r of roots) layers.set(r, 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const layer = layers.get(id)!;
    for (const child of children.get(id) ?? []) {
      if (!layers.has(child)) {
        layers.set(child, layer + 1);
        queue.push(child);
      }
    }
  }
  // Assign any remaining (orphans in cycle) to layer 0
  for (const id of clusterIds) {
    if (!layers.has(id)) layers.set(id, 0);
  }

  // Group by layer
  const maxLayer = Math.max(...Array.from(layers.values()));
  const layerGroups: number[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const [id, layer] of layers) layerGroups[layer].push(id);

  // Position: vertical spacing between layers, horizontal spacing within layer
  const LAYER_H = 140;
  const NODE_W = 160;

  const positions = new Map<number, { x: number; y: number }>();
  const totalHeight = maxLayer * LAYER_H;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const nodesInLayer = layerGroups[layer];
    const layerWidth = nodesInLayer.length * NODE_W;
    const startX = -layerWidth / 2 + NODE_W / 2;
    for (let i = 0; i < nodesInLayer.length; i++) {
      positions.set(nodesInLayer[i], {
        x: offsetX + startX + i * NODE_W,
        y: offsetY + layer * LAYER_H - totalHeight / 2,
      });
    }
  }

  return positions;
}

/** Compute initial positions using tree layout per cluster */
function computeLayout(
  g: AssetGraph,
  canvasW: number,
  canvasH: number,
): Map<number, NodePos> {
  const clusters = findClusters(g.nodes, g.edges);
  const positions = new Map<number, NodePos>();

  if (clusters.length === 0) return positions;

  const cx = canvasW / 2;
  const cy = canvasH / 2;

  if (clusters.length === 1) {
    const treePosMap = treeLayout(clusters[0], g.edges, cx, cy);
    for (const [id, pos] of treePosMap) {
      positions.set(id, { x: pos.x, y: pos.y, vx: 0, vy: 0, fixed: false });
    }
  } else {
    // Multiple clusters: arrange them in a grid
    const cols = Math.ceil(Math.sqrt(clusters.length));
    const clusterSpacing = Math.max(canvasW, canvasH) / (cols + 1);

    for (let ci = 0; ci < clusters.length; ci++) {
      const row = Math.floor(ci / cols);
      const col = ci % cols;
      const ox = (col + 1) * clusterSpacing - canvasW / 2 + cx;
      const oy = (row + 1) * clusterSpacing - canvasH / 2 + cy;

      const treePosMap = treeLayout(clusters[ci], g.edges, ox, oy);
      for (const [id, pos] of treePosMap) {
        positions.set(id, { x: pos.x, y: pos.y, vx: 0, vy: 0, fixed: false });
      }
    }
  }

  return positions;
}

/* ═══════════════════════════════════════════════════════════
   Force simulation (refine after initial tree layout)
   ═══════════════════════════════════════════════════════════ */

function simulate(
  g: AssetGraph,
  pos: Map<number, NodePos>,
  dragId: number | null,
) {
  const nodes = g.nodes;
  const edges = g.edges;

  // Repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = pos.get(nodes[i].id)!;
      const b = pos.get(nodes[j].id)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = 15000 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.fixed && a !== null) { a.vx -= fx; a.vy -= fy; }
      if (!b.fixed && b !== null) { b.vx += fx; b.vy += fy; }
    }
  }

  // Attraction along edges (spring)
  const SPRING_LEN = 180;
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const force = (dist - SPRING_LEN) * 0.015;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!a.fixed) { a.vx += fx; a.vy += fy; }
    if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
  }

  // Apply velocity with strong damping
  for (const n of nodes) {
    const p = pos.get(n.id)!;
    if (p.fixed || n.id === dragId) { p.vx = 0; p.vy = 0; continue; }
    p.vx *= 0.65;
    p.vy *= 0.65;
    p.x += p.vx;
    p.y += p.vy;
  }
}

/* ═══════════════════════════════════════════════════════════
   Canvas drawing
   ═══════════════════════════════════════════════════════════ */

const NODE_R = 26;

function drawGraph(
  ctx: CanvasRenderingContext2D,
  g: AssetGraph,
  pos: Map<number, NodePos>,
  selectedId: number | null,
  zoom: number,
  panX: number,
  panY: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = "#060a14";
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);
  const gridSize = 60;
  ctx.strokeStyle = "rgba(30,41,59,0.35)";
  ctx.lineWidth = 0.5 / zoom;
  const startX = Math.floor((-panX / zoom - 2000) / gridSize) * gridSize;
  const startY = Math.floor((-panY / zoom - 2000) / gridSize) * gridSize;
  const endX = startX + 6000;
  const endY = startY + 6000;
  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
  }
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
  }
  ctx.restore();

  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // ── Draw edges ──
  for (const e of g.edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const color = relColor(e.type);

    // Curved edge
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    // Perpendicular offset for curve
    const nx = -dy / Math.max(dist, 1);
    const ny = dx / Math.max(dist, 1);
    const curveAmount = Math.min(dist * 0.12, 30);
    const cpX = midX + nx * curveAmount;
    const cpY = midY + ny * curveAmount;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cpX, cpY, b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Arrowhead near target (inset by NODE_R)
    const t = 1 - (NODE_R + 4) / Math.max(dist, 1);
    const arrowX = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cpX + t * t * b.x;
    const arrowY = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cpY + t * t * b.y;
    const tangentX = 2 * (1 - t) * (cpX - a.x) + 2 * t * (b.x - cpX);
    const tangentY = 2 * (1 - t) * (cpY - a.y) + 2 * t * (b.y - cpY);
    const angle = Math.atan2(tangentY, tangentX);

    ctx.beginPath();
    ctx.moveTo(arrowX + 10 * Math.cos(angle), arrowY + 10 * Math.sin(angle));
    ctx.lineTo(arrowX - 6 * Math.cos(angle - 0.45), arrowY - 6 * Math.sin(angle - 0.45));
    ctx.lineTo(arrowX - 6 * Math.cos(angle + 0.45), arrowY - 6 * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Edge label at curve midpoint
    const labelX = 0.25 * a.x + 0.5 * cpX + 0.25 * b.x;
    const labelY = 0.25 * a.y + 0.5 * cpY + 0.25 * b.y;
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelText = relLabel(e.type);
    // Label background
    const tw = ctx.measureText(labelText).width + 8;
    ctx.fillStyle = "#060a14";
    ctx.fillRect(labelX - tw / 2, labelY - 8, tw, 16);
    ctx.fillStyle = color;
    ctx.fillText(labelText, labelX, labelY);
    ctx.globalAlpha = 1;
  }

  // ── Draw nodes ──
  for (const n of g.nodes) {
    const p = pos.get(n.id);
    if (!p) continue;

    const isSelected = n.id === selectedId;
    const borderColor = isSelected ? "#3b82f6" : critColor(n.criticality_name);
    const r = NODE_R;

    // Glow effect for selected
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 8);
      glow.addColorStop(0, "rgba(59,130,246,0.25)");
      glow.addColorStop(1, "rgba(59,130,246,0)");
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Node outer ring
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = borderColor;
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Node body
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(p.x - 4, p.y - 4, 2, p.x, p.y, r);
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    // Icon letter inside
    const icon = nodeIcon(n.asset_type_name);
    ctx.font = `bold ${icon.length > 1 ? 11 : 14}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = borderColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, p.x, p.y);

    // Risk count badge
    if (n.risk_count > 0) {
      const bx = p.x + r - 2;
      const by = p.y - r + 2;
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.strokeStyle = "#060a14";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "bold 9px 'Inter', sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n.risk_count), bx, by);
    }

    // Name label below
    ctx.font = "600 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = n.name.length > 22 ? n.name.slice(0, 20) + "…" : n.name;
    // Label shadow
    ctx.fillStyle = "#060a14";
    ctx.fillText(label, p.x + 1, p.y + r + 7);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(label, p.x, p.y + r + 6);

    // Type label
    if (n.asset_type_name) {
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(n.asset_type_name, p.x, p.y + r + 22);
    }

    // Criticality indicator
    if (n.criticality_name) {
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = critColor(n.criticality_name);
      ctx.globalAlpha = 0.8;
      ctx.fillText(n.criticality_name, p.x, p.y + r + 34);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

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
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<number, NodePos>>(new Map());
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const graphRef = useRef<AssetGraph | null>(null);

  // Zoom & pan state
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

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

      // Compute layout
      const canvas = canvasRef.current;
      const cw = canvas?.width ?? 1200;
      const ch = canvas?.height ?? 800;
      const posMap = computeLayout(g, cw, ch);
      positionsRef.current = posMap;

      // Auto-fit: compute bounding box and center
      if (posMap.size > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of posMap.values()) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const graphW = maxX - minX + 200;
        const graphH = maxY - minY + 200;
        const scaleX = cw / graphW;
        const scaleY = ch / graphH;
        const fitZoom = Math.min(scaleX, scaleY, 1.5);
        zoomRef.current = Math.max(fitZoom, 0.3);
        panRef.current = {
          x: cw / 2 - ((minX + maxX) / 2) * zoomRef.current,
          y: ch / 2 - ((minY + maxY) / 2) * zoomRef.current,
        };
      }
    } catch (err) {
      console.error("Failed to load graph data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [graph]);

  // ── Animation loop ──
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;
    let ticks = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Run physics for first 120 ticks only
      if (ticks < 120) {
        simulate(graphRef.current!, positionsRef.current, dragRef.current?.id ?? null);
      }

      drawGraph(
        ctx, graphRef.current!, positionsRef.current,
        selectedNode?.id ?? null,
        zoomRef.current, panRef.current.x, panRef.current.y,
        w, h,
      );

      ticks++;
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [graph, selectedNode]);

  // ── Mouse events ──
  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: (sy - panRef.current.y) / zoomRef.current,
  });

  const findNode = (mx: number, my: number): AssetGraphNode | null => {
    const g = graphRef.current;
    if (!g) return null;
    const world = screenToWorld(mx, my);
    const pos = positionsRef.current;
    for (const n of g.nodes) {
      const p = pos.get(n.id);
      if (!p) continue;
      const dx = world.x - p.x;
      const dy = world.y - p.y;
      if (dx * dx + dy * dy < (NODE_R + 4) * (NODE_R + 4)) return n;
    }
    return null;
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: mx, y: my } = getCanvasPos(e);
    const n = findNode(mx, my);
    if (n) {
      const world = screenToWorld(mx, my);
      const p = positionsRef.current.get(n.id);
      if (p) {
        dragRef.current = { id: n.id, offsetX: world.x - p.x, offsetY: world.y - p.y };
        p.fixed = true;
      }
      setSelectedNode(n);
    } else {
      // Start panning
      isPanningRef.current = true;
      panStartRef.current = { x: mx, y: my, panX: panRef.current.x, panY: panRef.current.y };
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: mx, y: my } = getCanvasPos(e);
    if (dragRef.current) {
      const world = screenToWorld(mx, my);
      const p = positionsRef.current.get(dragRef.current.id);
      if (p) {
        p.x = world.x - dragRef.current.offsetX;
        p.y = world.y - dragRef.current.offsetY;
      }
    } else if (isPanningRef.current) {
      panRef.current = {
        x: panStartRef.current.panX + (mx - panStartRef.current.x),
        y: panStartRef.current.panY + (my - panStartRef.current.y),
      };
    }
  };

  const handleMouseUp = () => {
    if (dragRef.current) {
      const p = positionsRef.current.get(dragRef.current.id);
      if (p) p.fixed = false;
    }
    dragRef.current = null;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x: mx, y: my } = getCanvasPos(e);
    const oldZoom = zoomRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(oldZoom * factor, 0.15), 5);
    zoomRef.current = newZoom;

    // Zoom toward mouse position
    panRef.current = {
      x: mx - (mx - panRef.current.x) * (newZoom / oldZoom),
      y: my - (my - panRef.current.y) * (newZoom / oldZoom),
    };
  };

  // ── Zoom controls ──
  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cx = (canvas.width / dpr) / 2;
    const cy = (canvas.height / dpr) / 2;
    const oldZoom = zoomRef.current;
    const newZoom = Math.min(oldZoom * 1.3, 5);
    zoomRef.current = newZoom;
    panRef.current = {
      x: cx - (cx - panRef.current.x) * (newZoom / oldZoom),
      y: cy - (cy - panRef.current.y) * (newZoom / oldZoom),
    };
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cx = (canvas.width / dpr) / 2;
    const cy = (canvas.height / dpr) / 2;
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(oldZoom * 0.7, 0.15);
    zoomRef.current = newZoom;
    panRef.current = {
      x: cx - (cx - panRef.current.x) * (newZoom / oldZoom),
      y: cy - (cy - panRef.current.y) * (newZoom / oldZoom),
    };
  };

  const handleFitAll = () => {
    const canvas = canvasRef.current;
    const pos = positionsRef.current;
    if (!canvas || pos.size === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pos.values()) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const graphW = maxX - minX + 200;
    const graphH = maxY - minY + 200;
    const scaleX = cw / graphW;
    const scaleY = ch / graphH;
    const fitZoom = Math.min(scaleX, scaleY, 1.5);
    zoomRef.current = Math.max(fitZoom, 0.2);
    panRef.current = {
      x: cw / 2 - ((minX + maxX) / 2) * zoomRef.current,
      y: ch / 2 - ((minY + maxY) / 2) * zoomRef.current,
    };
  };

  // ── CRUD handlers ──
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
      alert("Błąd: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRel = async (relId: number) => {
    if (!confirm("Usunąć tę relację?")) return;
    try {
      await api.delete(`/api/v1/assets/relationships/${relId}`);
      await loadData();
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ładowanie grafu aktywów...</span>
      </div>
    );
  }

  return (
    <div>
      {/* KPI bar */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)" }}>{assets.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Aktywów</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{relationships.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Relacji</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--cyan)" }}>{graph?.nodes.length ?? 0}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Połączonych</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--orange)" }}>{assets.filter((a) => !graph?.nodes.find((n) => n.id === a.id)).length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Izolowanych</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button className={`btn btn-sm ${view === "graph" ? "btn-primary" : ""}`} onClick={() => setView("graph")}>Diagram</button>
          <button className={`btn btn-sm ${view === "table" ? "btn-primary" : ""}`} onClick={() => setView("table")}>Tabela relacji</button>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddRel(true)}>+ Dodaj relację</button>
        </div>
      </div>

      {view === "graph" ? (
        <div style={{ display: "grid", gridTemplateColumns: selectedNode ? "1fr 320px" : "1fr", gap: 14 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
            {graph && graph.nodes.length > 0 ? (
              <>
                {/* Legend */}
                <div style={{
                  position: "absolute", top: 10, left: 10, zIndex: 2,
                  display: "flex", gap: 10, flexWrap: "wrap",
                  padding: "6px 10px", borderRadius: 6,
                  background: "rgba(6,10,20,0.85)", backdropFilter: "blur(4px)",
                  border: "1px solid var(--border)",
                }}>
                  {REL_TYPES.map((r) => (
                    <span key={r.value} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 14, height: 3, background: r.color, display: "inline-block", borderRadius: 2 }} />
                      <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                    </span>
                  ))}
                </div>

                {/* Zoom controls */}
                <div style={{
                  position: "absolute", top: 10, right: 10, zIndex: 2,
                  display: "flex", flexDirection: "column", gap: 4,
                  background: "rgba(6,10,20,0.85)", backdropFilter: "blur(4px)",
                  border: "1px solid var(--border)", borderRadius: 8, padding: 4,
                }}>
                  <button className="btn btn-sm" onClick={handleZoomIn} style={{ padding: "4px 8px", fontSize: 14, lineHeight: 1 }} title="Przybliż">+</button>
                  <button className="btn btn-sm" onClick={handleZoomOut} style={{ padding: "4px 8px", fontSize: 14, lineHeight: 1 }} title="Oddal">-</button>
                  <div style={{ height: 1, background: "rgba(42,53,84,0.4)" }} />
                  <button className="btn btn-sm" onClick={handleFitAll} style={{ padding: "4px 8px", fontSize: 10, lineHeight: 1 }} title="Dopasuj widok">FIT</button>
                </div>

                {/* Help hint */}
                <div style={{
                  position: "absolute", bottom: 8, left: 10, zIndex: 2,
                  fontSize: 10, color: "var(--text-muted)", opacity: 0.6,
                }}>
                  Scroll = zoom | Przeciągnij tło = przesuwanie | Przeciągnij węzeł = pozycjonowanie
                </div>

                <div ref={containerRef} style={{ width: "100%", height: 650 }}>
                  <canvas
                    ref={canvasRef}
                    style={{ width: "100%", height: "100%", cursor: dragRef.current ? "grabbing" : "grab", display: "block" }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                  />
                </div>
              </>
            ) : (
              <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Brak relacji między aktywami. Dodaj relacje aby zobaczyć diagram.
              </div>
            )}
          </div>

          {/* Selected node detail panel */}
          {selectedNode && (
            <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="card-title" style={{ margin: 0 }}>{selectedNode.name}</div>
                <button className="btn btn-sm" onClick={() => setSelectedNode(null)} style={{ fontSize: 12 }}>&#10005;</button>
              </div>
              <div style={{ fontSize: 12, lineHeight: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Typ</span>
                  <span>{selectedNode.asset_type_name ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Krytyczność</span>
                  <span style={{ color: critColor(selectedNode.criticality_name) }}>{selectedNode.criticality_name ?? "—"}</span>
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
                {graph?.edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e) => {
                    const other = e.source === selectedNode.id
                      ? graph.nodes.find((n) => n.id === e.target)
                      : graph.nodes.find((n) => n.id === e.source);
                    const direction = e.source === selectedNode.id ? "\u2192" : "\u2190";
                    return (
                      <div key={e.id} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
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
              Brak relacji. Kliknij "+ Dodaj relację" aby zdefiniować powiązania.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Źródłowy aktyw</th>
                  <th>Typ relacji</th>
                  <th>Docelowy aktyw</th>
                  <th>Opis</th>
                  <th>Utworzono</th>
                  <th style={{ width: 80 }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((r) => (
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
                      <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleDeleteRel(r.id)}>Usuń</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Relationship Modal */}
      <Modal open={showAddRel} onClose={() => setShowAddRel(false)} title="Dodaj relację między aktywami">
        <form onSubmit={handleAddRelationship}>
          <div className="form-group">
            <label>Aktyw źródłowy *</label>
            <select name="source_asset_id" className="form-control" required>
              <option value="">Wybierz...</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Typ relacji *</label>
            <select name="relationship_type" className="form-control" required>
              <option value="">Wybierz...</option>
              {REL_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Aktyw docelowy *</label>
            <select name="target_asset_id" className="form-control" required>
              <option value="">Wybierz...</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Opis</label>
            <input name="description" className="form-control" placeholder="Opcjonalny opis relacji..." />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setShowAddRel(false)}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Zapisywanie..." : "Dodaj relację"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
