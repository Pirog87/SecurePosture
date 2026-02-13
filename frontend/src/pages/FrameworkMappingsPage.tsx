import { useEffect, useState } from "react";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

/* ─── Types ─── */
interface Framework {
  id: number;
  name: string;
}

interface FrameworkMapping {
  id: number;
  source_framework_id: number;
  source_framework_name: string;
  source_node_id: number;
  source_node_ref_id: string | null;
  source_node_name: string | null;
  target_framework_id: number;
  target_framework_name: string;
  target_node_id: number;
  target_node_ref_id: string | null;
  target_node_name: string | null;
  relationship: string;
  confidence: number | null;
  notes: string | null;
  created_at: string;
}

/* ─── Helpers ─── */
const RELATIONSHIP_LABELS: Record<string, string> = {
  equivalent: "Ekwiwalentne",
  partial_overlap: "Częściowe pokrycie",
  broader: "Szersze",
  narrower: "Węższe",
  related: "Powiązane",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  equivalent: "var(--green)",
  partial_overlap: "var(--yellow)",
  broader: "var(--blue)",
  narrower: "var(--purple)",
  related: "#94a3b8",
};

function confidenceColor(c: number | null): string {
  if (c == null) return "var(--text-muted)";
  if (c >= 0.8) return "var(--green)";
  if (c >= 0.5) return "var(--yellow)";
  return "var(--red)";
}

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: "var(--blue)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>{number}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "\u2014"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FrameworkMappingsPage
   ═══════════════════════════════════════════════════════════ */
export default function FrameworkMappingsPage() {
  const COLUMNS: ColumnDef<FrameworkMapping>[] = [
    { key: "source_framework_name", header: "Source Framework" },
    { key: "source_node_ref_id", header: "Source Ref", format: r => r.source_node_ref_id ?? "" },
    { key: "source_node_name", header: "Source Wymag.", format: r => r.source_node_name ?? "" },
    { key: "target_framework_name", header: "Target Framework" },
    { key: "target_node_ref_id", header: "Target Ref", format: r => r.target_node_ref_id ?? "" },
    { key: "target_node_name", header: "Target Wymag.", format: r => r.target_node_name ?? "", defaultVisible: false },
    { key: "relationship", header: "Relacja", format: r => RELATIONSHIP_LABELS[r.relationship] || r.relationship },
    { key: "confidence", header: "Pewność", format: r => r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "" },
    { key: "notes", header: "Notatki", format: r => r.notes ?? "", defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "framework-mappings");

  const [mappings, setMappings] = useState<FrameworkMapping[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FrameworkMapping | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    source_framework_id: 0,
    source_node_id: 0,
    target_framework_id: 0,
    target_node_id: 0,
    relationship: "equivalent",
    confidence: 1.0,
    notes: "",
  });

  const [sourceNodes, setSourceNodes] = useState<{ id: number; ref_id: string | null; name: string | null }[]>([]);
  const [targetNodes, setTargetNodes] = useState<{ id: number; ref_id: string | null; name: string | null }[]>([]);

  const table = useTableFeatures<FrameworkMapping>({
    data: mappings,
    storageKey: "framework-mappings",
    defaultSort: "source_framework_name",
    defaultSortDir: "asc",
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<FrameworkMapping[]>("/api/v1/framework-mappings/"),
      api.get<Framework[]>("/api/v1/frameworks/"),
    ])
      .then(([fm, fw]) => {
        setMappings(fm);
        setFrameworks(fw.filter((f: any) => f.is_active !== false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const loadNodes = async (frameworkId: number, target: "source" | "target") => {
    if (!frameworkId) return;
    try {
      const nodes = await api.get<any[]>(`/api/v1/frameworks/${frameworkId}/nodes`);
      const flat = nodes.map((n: any) => ({ id: n.id, ref_id: n.ref_id, name: n.name_pl || n.name }));
      if (target === "source") setSourceNodes(flat);
      else setTargetNodes(flat);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!form.source_node_id || !form.target_node_id) return;
    try {
      await api.post("/api/v1/framework-mappings/", {
        source_node_id: form.source_node_id,
        target_node_id: form.target_node_id,
        relationship: form.relationship,
        confidence: form.confidence,
        notes: form.notes || null,
      });
      setShowModal(false);
      load();
    } catch {
      alert("Błąd tworzenia mapowania");
    }
  };

  /* ── Stats ── */
  const src = table.filtered;
  const equivalent = src.filter(m => m.relationship === "equivalent").length;
  const partial = src.filter(m => m.relationship === "partial_overlap").length;
  const uniqueFrameworks = new Set([...src.map(m => m.source_framework_id), ...src.map(m => m.target_framework_id)]).size;

  const allEquivalent = mappings.filter(m => m.relationship === "equivalent").length;
  const allPartial = mappings.filter(m => m.relationship === "partial_overlap").length;
  const allUnique = new Set([...mappings.map(m => m.source_framework_id), ...mappings.map(m => m.target_framework_id)]).size;

  const isFiltered = table.filteredCount !== table.totalCount;

  const stats: StatCard[] = [
    { label: "Mapowania ogółem", value: src.length, total: mappings.length, color: "var(--blue)" },
    { label: "Ekwiwalentne", value: equivalent, total: allEquivalent, color: "var(--green)" },
    { label: "Częściowe", value: partial, total: allPartial, color: "var(--yellow)" },
    { label: "Frameworki", value: uniqueFrameworks, total: allUnique, color: "var(--purple)" },
  ];

  const sel = selected;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <h2 style={{ margin: "0 0 16px" }}>Mapowania Frameworków</h2>

      <StatsCards cards={stats} isFiltered={isFiltered} />

      <TableToolbar<FrameworkMapping>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="mapowań"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj mapowań..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="framework_mappings"
        primaryLabel="Nowe mapowanie"
        onPrimaryAction={() => setShowModal(true)}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14, marginTop: 2 }}>
        <DataTable<FrameworkMapping>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
          rowBorderColor={r => RELATIONSHIP_COLORS[r.relationship] || undefined}
          renderCell={(row, colKey) => {
            if (colKey === "source_node_ref_id" || colKey === "target_node_ref_id") {
              const v = colKey === "source_node_ref_id" ? row.source_node_ref_id : row.target_node_ref_id;
              if (!v) return <span style={{ color: "var(--text-muted)" }}>—</span>;
              return <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>{v}</span>;
            }
            if (colKey === "relationship") {
              const c = RELATIONSHIP_COLORS[row.relationship] || "#94a3b8";
              return <span className="badge" style={{ backgroundColor: `${c}20`, color: c }}>{RELATIONSHIP_LABELS[row.relationship] || row.relationship}</span>;
            }
            if (colKey === "confidence") {
              if (row.confidence == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
              const pct = Math.round(row.confidence * 100);
              return <span style={{ color: confidenceColor(row.confidence), fontWeight: 600, fontSize: 12 }}>{pct}%</span>;
            }
            return undefined;
          }}
          sortField={table.sortField}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          columnFilters={table.columnFilters}
          onColumnFilter={table.setColumnFilter}
          showFilters={showFilters}
          page={table.page}
          totalPages={table.totalPages}
          pageSize={table.pageSize}
          totalItems={table.totalCount}
          filteredItems={table.filteredCount}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          loading={loading}
          emptyMessage="Brak mapowań. Utwórz korelację między wymaganiami frameworków."
        />

        {/* ── Detail panel ── */}
        {sel && (
          <div className="card" style={{ padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Mapowanie #{sel.id}</div>
                <span className="badge" style={{
                  backgroundColor: `${RELATIONSHIP_COLORS[sel.relationship] || "#94a3b8"}20`,
                  color: RELATIONSHIP_COLORS[sel.relationship] || "#94a3b8",
                }}>
                  {RELATIONSHIP_LABELS[sel.relationship] || sel.relationship}
                </span>
              </div>
              <button className="btn btn-xs" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Confidence gauge */}
            {sel.confidence != null && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{
                  fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                  color: confidenceColor(sel.confidence),
                }}>
                  {Math.round(sel.confidence * 100)}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pewność korelacji</div>
              </div>
            )}

            <SectionHeader number="1" label="Source (źródło)" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Framework" value={sel.source_framework_name} />
              <DetailRow label="Ref ID" value={sel.source_node_ref_id} />
              <DetailRow label="Wymaganie" value={sel.source_node_name} />
            </div>

            <SectionHeader number="2" label="Target (cel)" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Framework" value={sel.target_framework_name} />
              <DetailRow label="Ref ID" value={sel.target_node_ref_id} />
              <DetailRow label="Wymaganie" value={sel.target_node_name} />
            </div>

            {sel.notes && (
              <>
                <SectionHeader number="3" label="Notatki" />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {sel.notes}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      {showModal && (
        <Modal title="Nowe mapowanie frameworków" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>Source Framework *
              <select className="form-control" value={form.source_framework_id} onChange={e => {
                const id = Number(e.target.value);
                setForm({ ...form, source_framework_id: id, source_node_id: 0 });
                loadNodes(id, "source");
              }}>
                <option value={0}>— wybierz —</option>
                {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
              </select>
            </label>
            <label>Source wymaganie *
              <select className="form-control" value={form.source_node_id} onChange={e => setForm({ ...form, source_node_id: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {sourceNodes.map(n => <option key={n.id} value={n.id}>{n.ref_id ? `${n.ref_id} — ` : ""}{n.name}</option>)}
              </select>
            </label>
            <label>Target Framework *
              <select className="form-control" value={form.target_framework_id} onChange={e => {
                const id = Number(e.target.value);
                setForm({ ...form, target_framework_id: id, target_node_id: 0 });
                loadNodes(id, "target");
              }}>
                <option value={0}>— wybierz —</option>
                {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
              </select>
            </label>
            <label>Target wymaganie *
              <select className="form-control" value={form.target_node_id} onChange={e => setForm({ ...form, target_node_id: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {targetNodes.map(n => <option key={n.id} value={n.id}>{n.ref_id ? `${n.ref_id} — ` : ""}{n.name}</option>)}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>Relacja
                <select className="form-control" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
                  {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>Pewność
                <input className="form-control" type="number" step="0.05" min="0" max="1" value={form.confidence} onChange={e => setForm({ ...form, confidence: Number(e.target.value) })} />
              </label>
            </div>
            <label>Notatki <textarea className="form-control" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.source_node_id || !form.target_node_id}>Utwórz</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
