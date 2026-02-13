import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { FrameworkBrief, FrameworkImportResult } from "../types";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

/* ─── Lifecycle helpers ─── */
const LIFECYCLE_LABELS: Record<string, { label: string; cls: string; color: string; bg: string }> = {
  draft:      { label: "Szkic",          cls: "badge-gray",   color: "var(--text-muted)", bg: "var(--bg-inset)" },
  review:     { label: "Przegląd",       cls: "badge-yellow", color: "var(--orange)",     bg: "var(--orange-dim)" },
  published:  { label: "Opublikowany",   cls: "badge-green",  color: "var(--green)",      bg: "var(--green-dim)" },
  deprecated: { label: "Wycofany",       cls: "badge-red",    color: "var(--red)",        bg: "var(--red-dim)" },
  archived:   { label: "Zarchiwizowany", cls: "badge-gray",   color: "var(--text-muted)", bg: "var(--bg-inset)" },
};

function lifecycleColor(status: string) { return LIFECYCLE_LABELS[status]?.color ?? "var(--text-muted)"; }
function lifecycleBg(status: string) { return LIFECYCLE_LABELS[status]?.bg ?? "var(--bg-inset)"; }
function lifecycleLabel(status: string) { return LIFECYCLE_LABELS[status]?.label ?? status; }

function sourceLabel(fmt: string | null) {
  if (!fmt) return "—";
  if (fmt === "manual") return "Ręczny";
  if (fmt === "ciso_assistant_yaml") return "YAML";
  if (fmt === "ciso_assistant_excel") return "Excel";
  return fmt;
}

/* ─── Detail panel rows ─── */
function SectionHeader({ number, label }: { number: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
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
   FrameworksPage — main list page
   ═══════════════════════════════════════════════════ */
export default function FrameworksPage() {
  const navigate = useNavigate();
  const [frameworks, setFrameworks] = useState<FrameworkBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<FrameworkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selected, setSelected] = useState<FrameworkBrief | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    const qs = showArchived ? "" : "?is_active=true";
    api.get<FrameworkBrief[]>(`/api/v1/frameworks${qs}`)
      .then(setFrameworks)
      .catch(() => setFrameworks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [showArchived]);

  /* ── Import handler ── */
  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    setImportError(null);

    const formData = new FormData();
    formData.append("file", file);

    const isYaml = file.name.endsWith(".yaml") || file.name.endsWith(".yml");
    const endpoint = isYaml ? "/api/v1/frameworks/import/yaml" : "/api/v1/frameworks/import/excel";

    try {
      const res = await api.postFormData<FrameworkImportResult>(endpoint, formData);
      setImportResult(res);
      load();
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Błąd importu");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ── Delete handler ── */
  const handleDelete = async (fw: FrameworkBrief) => {
    const action = fw.lifecycle_status === "published" ? "zarchiwizować" : "trwale usunąć";
    if (!confirm(`Czy na pewno chcesz ${action} framework "${fw.name}"?`)) return;
    try {
      await api.delete(`/api/v1/frameworks/${fw.id}`);
      setSelected(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd usuwania");
    }
  };

  /* ── Create handler ── */
  const handleCreate = async (data: { name: string; ref_id: string; description: string; version: string; provider: string }) => {
    try {
      const fw = await api.post<{ id: number }>("/api/v1/frameworks", data);
      setShowCreateModal(false);
      navigate(`/frameworks/${fw.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd tworzenia");
    }
  };

  /* ── Table columns ── */
  const COLUMNS: ColumnDef<FrameworkBrief>[] = [
    { key: "name", header: "Nazwa" },
    { key: "ref_id", header: "Ref ID", defaultVisible: false },
    { key: "published_version", header: "Wersja publ.", format: r => r.published_version || r.version || "" },
    { key: "provider", header: "Dostawca", format: r => r.provider ?? "" },
    { key: "source_format", header: "Źródło", format: r => sourceLabel(r.source_format) },
    { key: "total_nodes", header: "Węzły", format: r => String(r.total_nodes) },
    { key: "total_assessable", header: "Ocenialne", format: r => String(r.total_assessable) },
    { key: "lifecycle_status", header: "Status", format: r => lifecycleLabel(r.lifecycle_status) },
    { key: "edit_version", header: "Edycja", format: r => `v${r.edit_version}` },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "frameworks");

  const table = useTableFeatures<FrameworkBrief>({
    data: frameworks,
    storageKey: "frameworks",
    defaultSort: "name",
    defaultSortDir: "asc",
  });

  /* ── Stats cards ── */
  const isFiltered = table.filteredCount !== table.totalCount;
  const statsCards: StatCard[] = useMemo(() => {
    const src = table.filtered;
    const published = src.filter(f => f.lifecycle_status === "published").length;
    const drafts = src.filter(f => f.lifecycle_status === "draft").length;
    const totalNodes = src.reduce((s, f) => s + f.total_nodes, 0);
    const pubTotal = frameworks.filter(f => f.lifecycle_status === "published").length;
    const draftTotal = frameworks.filter(f => f.lifecycle_status === "draft").length;
    const totalNodesAll = frameworks.reduce((s, f) => s + f.total_nodes, 0);
    return [
      { label: "Frameworków", value: src.length, total: frameworks.length, color: "var(--blue)" },
      { label: "Opublikowanych", value: published, total: pubTotal, color: "var(--green)" },
      { label: "Szkiców", value: drafts, total: draftTotal, color: "var(--orange)" },
      { label: "Węzłów łącznie", value: totalNodes, total: totalNodesAll, color: "var(--purple)" },
    ];
  }, [table.filtered, frameworks]);

  return (
    <div>
      {/* Import result/error */}
      {importResult && (
        <div className="card" style={{ background: "var(--green-dim)", borderLeft: "3px solid var(--green)", marginBottom: 12, padding: "10px 14px", fontSize: 12 }}>
          <strong>Import zakończony:</strong> {importResult.name} — {importResult.total_nodes} węzłów, {importResult.total_assessable} ocenialnych, {importResult.dimensions_created} wymiarów
          <button className="btn btn-sm" style={{ marginLeft: 12, fontSize: 10 }} onClick={() => setImportResult(null)}>✕</button>
        </div>
      )}
      {importError && (
        <div className="card" style={{ background: "var(--red-dim)", borderLeft: "3px solid var(--red)", marginBottom: 12, padding: "10px 14px", fontSize: 12 }}>
          <strong>Błąd importu:</strong> {importError}
          <button className="btn btn-sm" style={{ marginLeft: 12, fontSize: 10 }} onClick={() => setImportError(null)}>✕</button>
        </div>
      )}

      {/* Stats */}
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      {/* Toolbar */}
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.yaml,.yml" style={{ display: "none" }}
             onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
      <TableToolbar
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="frameworków"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj frameworków..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="frameworki"
        primaryLabel="Nowy framework"
        onPrimaryAction={() => setShowCreateModal(true)}
        secondaryActions={[
          { label: importing ? "Importowanie..." : "Import z pliku", onClick: () => fileRef.current?.click() },
          { label: showArchived ? "Ukryj archiwalne" : "Pokaż archiwalne", onClick: () => setShowArchived(v => !v) },
        ]}
      />

      {/* Main grid: table + detail panel */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>

        {/* Table */}
        <DataTable<FrameworkBrief>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(selected?.id === r.id ? null : r)}
          rowBorderColor={r => lifecycleColor(r.lifecycle_status)}
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
          emptyMessage="Brak frameworków. Zaimportuj z pliku lub utwórz ręcznie."
          emptyFilteredMessage="Brak frameworków pasujących do filtrów."
          renderCell={(r, key) => {
            if (key === "name") return <span style={{ fontWeight: 600 }}>{r.name}</span>;
            if (key === "total_nodes") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.total_nodes}</span>;
            if (key === "total_assessable") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.total_assessable}</span>;
            if (key === "lifecycle_status") return (
              <span className="score-badge" style={{ background: lifecycleBg(r.lifecycle_status), color: lifecycleColor(r.lifecycle_status) }}>
                {lifecycleLabel(r.lifecycle_status)}
              </span>
            );
            if (key === "edit_version") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>v{r.edit_version}</span>;
            if (key === "source_format") return <span style={{ fontSize: 11 }}>{sourceLabel(r.source_format)}</span>;
            return undefined;
          }}
        />

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegóły Frameworka</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-sm" onClick={() => navigate(`/frameworks/${selected.id}`)} title="Otwórz">Otwórz</button>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
              </div>
            </div>

            {/* Status display */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: lifecycleColor(selected.lifecycle_status) }}>
                v{selected.edit_version}
              </div>
              <span className="score-badge" style={{ background: lifecycleBg(selected.lifecycle_status), color: lifecycleColor(selected.lifecycle_status), fontSize: 13, padding: "4px 12px" }}>
                {lifecycleLabel(selected.lifecycle_status)}
              </span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                {selected.total_nodes} węzłów | {selected.total_assessable} ocenialnych
              </div>
            </div>

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={1} label="Informacje" />
              <DetailRow label="Nazwa" value={<span style={{ fontWeight: 500 }}>{selected.name}</span>} />
              <DetailRow label="Ref ID" value={selected.ref_id} />
              <DetailRow label="Wersja publ." value={selected.published_version || selected.version} />
              <DetailRow label="Dostawca" value={selected.provider} />
              <DetailRow label="Źródło" value={sourceLabel(selected.source_format)} />

              <SectionHeader number={2} label="Statystyki" />
              <DetailRow label="Węzły" value={
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{selected.total_nodes}</span>
              } />
              <DetailRow label="Ocenialne" value={
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{selected.total_assessable}</span>
              } />
              <DetailRow label="Edycja" value={`v${selected.edit_version}`} />
              <DetailRow label="Status" value={
                <span className="score-badge" style={{ background: lifecycleBg(selected.lifecycle_status), color: lifecycleColor(selected.lifecycle_status), fontSize: 11 }}>
                  {lifecycleLabel(selected.lifecycle_status)}
                </span>
              } />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/frameworks/${selected.id}`)}>
                Otwórz
              </button>
              <button className="btn btn-sm" style={{ flex: 1, color: "var(--red)" }} onClick={() => handleDelete(selected)}>
                {selected.lifecycle_status === "published" ? "Archiwizuj" : "Usuń"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nowy framework">
        <CreateFrameworkForm
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      </Modal>
    </div>
  );
}

/* ─── Create Framework Form ─── */
function CreateFrameworkForm({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { name: string; ref_id: string; description: string; version: string; provider: string }) => void;
}) {
  const [name, setName] = useState("");
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [provider, setProvider] = useState("");

  return (
    <div>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="form-group">
          <label>Nazwa *</label>
          <input className="form-control" value={name} onChange={e => setName(e.target.value)}
                 placeholder="np. ISO 27001:2022" autoFocus />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>ID referencyjny</label>
            <input className="form-control" value={refId} onChange={e => setRefId(e.target.value)}
                   placeholder="np. ISO-27001-2022" />
          </div>
          <div className="form-group">
            <label>Wersja publikacji</label>
            <input className="form-control" value={version} onChange={e => setVersion(e.target.value)}
                   placeholder="np. 2022" />
          </div>
        </div>
        <div className="form-group">
          <label>Dostawca</label>
          <input className="form-control" value={provider} onChange={e => setProvider(e.target.value)}
                 placeholder="np. ISO" />
        </div>
        <div className="form-group">
          <label>Opis</label>
          <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)}
                    rows={3} placeholder="Opis frameworka..." />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="btn" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" disabled={!name.trim()}
                onClick={() => onCreate({ name, ref_id: refId, description, version, provider })}>
          Utwórz
        </button>
      </div>
    </div>
  );
}
