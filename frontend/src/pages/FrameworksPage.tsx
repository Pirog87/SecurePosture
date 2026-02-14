import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import type { FrameworkBrief, FrameworkImportResult, DictionaryEntry } from "../types";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";
import {
  CISO_FRAMEWORK_CATALOG, CATEGORY_LABELS, CATEGORY_COLORS,
  type CatalogFramework, type FrameworkCategory,
} from "../data/cisoCatalog";

/* ─── Lifecycle helpers ─── */
const LIFECYCLE_LABELS: Record<string, { label: string; cls: string; color: string; bg: string }> = {
  draft:      { label: "Szkic",          cls: "badge-gray",   color: "var(--text-muted)", bg: "var(--bg-inset)" },
  review:     { label: "Przegląd",       cls: "badge-yellow", color: "var(--orange)",     bg: "var(--orange-dim)" },
  published:  { label: "Zatwierdzony",   cls: "badge-green",  color: "var(--green)",      bg: "var(--green-dim)" },
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
  if (fmt === "copy") return "Kopia";
  return fmt;
}

const ORIGIN_LABELS: Record<string, string> = {
  internal: "Wewnętrzny",
  external: "Zewnętrzny",
};

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
   FrameworksPage — Repozytorium Wymagań
   ═══════════════════════════════════════════════════ */
export default function FrameworksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [frameworks, setFrameworks] = useState<FrameworkBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<FrameworkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdoptModal, setShowAdoptModal] = useState(false);
  const [adoptFrameworkId, setAdoptFrameworkId] = useState<number | null>(null);
  const [selected, setSelected] = useState<FrameworkBrief | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<DictionaryEntry[]>([]);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(searchParams.get("type"));
  const [activeOriginFilter, setActiveOriginFilter] = useState<string | null>(searchParams.get("origin"));
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Load document types from dictionary ── */
  useEffect(() => {
    api.get<DictionaryEntry[]>("/api/v1/dictionaries/entries?type_code=document_type")
      .then(setDocumentTypes)
      .catch(() => setDocumentTypes([]));
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (!showArchived) params.set("is_active", "true");
    if (activeTypeFilter) {
      const entry = documentTypes.find(dt => dt.code === activeTypeFilter);
      if (entry) params.set("document_type_id", String(entry.id));
    }
    if (activeOriginFilter) params.set("document_origin", activeOriginFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";
    api.get<FrameworkBrief[]>(`/api/v1/frameworks${qs}`)
      .then(setFrameworks)
      .catch(() => setFrameworks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [showArchived, activeTypeFilter, activeOriginFilter, documentTypes]);

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
      // Show adoption form after import
      setAdoptFrameworkId(res.framework_id);
      setShowAdoptModal(true);
      load();
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Błąd importu");
      load(); // Refresh list even on error — framework may have been partially created
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ── Delete / Archive handler ── */
  const handleDelete = async (fw: FrameworkBrief) => {
    const isDraft = fw.lifecycle_status === "draft" || fw.lifecycle_status === "review";
    const action = isDraft ? "usunąć" : "zarchiwizować";
    const target = isDraft ? "dokument" : "dokument";
    if (!confirm(`Czy na pewno chcesz ${action} wskazany ${target} "${fw.name}"?`)) return;
    try {
      await api.delete(`/api/v1/frameworks/${fw.id}`);
      setSelected(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd usuwania");
    }
  };

  /* ── Copy handler ── */
  const handleCopy = async (fw: FrameworkBrief) => {
    try {
      const result = await api.post<{ id: number }>(`/api/v1/frameworks/${fw.id}/copy`, {
        copy_org_unit_links: true,
      });
      navigate(`/frameworks/${result.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd kopiowania");
    }
  };

  /* ── Create handler ── */
  const handleCreate = async (data: Record<string, unknown>) => {
    try {
      const fw = await api.post<{ id: number }>("/api/v1/frameworks", data);
      setShowCreateModal(false);
      navigate(`/frameworks/${fw.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd tworzenia");
    }
  };

  /* ── Type filter chips ── */
  const typeFilterChips = useMemo(() => {
    const chips: { code: string | null; label: string; count: number }[] = [
      { code: null, label: "Wszystkie", count: frameworks.length },
    ];
    for (const dt of documentTypes) {
      const count = frameworks.filter(f => f.document_type_id === dt.id).length;
      chips.push({ code: dt.code, label: dt.label, count });
    }
    return chips;
  }, [documentTypes, frameworks]);

  /* ── Table columns ── */
  const COLUMNS: ColumnDef<FrameworkBrief>[] = [
    { key: "name", header: "Nazwa" },
    { key: "document_type_name", header: "Typ dokumentu", format: r => r.document_type_name || "—" },
    { key: "document_origin", header: "Pochodzenie", format: r => ORIGIN_LABELS[r.document_origin] || r.document_origin },
    { key: "owner", header: "Właściciel", format: r => r.owner || "—" },
    { key: "display_version", header: "Wersja", format: r => r.display_version || r.published_version || r.version || "—" },
    { key: "provider", header: "Dostawca", format: r => r.provider ?? "" },
    { key: "total_nodes", header: "Węzły", format: r => String(r.total_nodes) },
    { key: "total_assessable", header: "Ocenialne", format: r => String(r.total_assessable) },
    { key: "lifecycle_status", header: "Status", format: r => lifecycleLabel(r.lifecycle_status) },
    { key: "next_review_date", header: "Następny przegląd", format: r => r.next_review_date || "—", defaultVisible: false },
    { key: "ref_id", header: "Ref ID", defaultVisible: false },
    { key: "source_format", header: "Źródło", format: r => sourceLabel(r.source_format), defaultVisible: false },
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
    const reviewOverdue = src.filter(f => f.requires_review && f.next_review_date && new Date(f.next_review_date) < new Date()).length;
    const pubTotal = frameworks.filter(f => f.lifecycle_status === "published").length;
    const draftTotal = frameworks.filter(f => f.lifecycle_status === "draft").length;
    const overdueTotal = frameworks.filter(f => f.requires_review && f.next_review_date && new Date(f.next_review_date) < new Date()).length;
    return [
      { label: "Dokumentów", value: src.length, total: frameworks.length, color: "var(--blue)" },
      { label: "Zatwierdzonych", value: published, total: pubTotal, color: "var(--green)" },
      { label: "Szkiców", value: drafts, total: draftTotal, color: "var(--orange)" },
      { label: "Zaległy przegląd", value: reviewOverdue, total: overdueTotal, color: "var(--red)" },
    ];
  }, [table.filtered, frameworks]);

  return (
    <div>
      {/* Import result/error */}
      {importResult && !showAdoptModal && (
        <div className="card" style={{ background: "var(--green-dim)", borderLeft: "3px solid var(--green)", marginBottom: 12, padding: "10px 14px", fontSize: 12 }}>
          <strong>Import zakończony:</strong> {importResult.name} — {importResult.total_nodes} węzłów, {importResult.total_assessable} ocenialnych, {importResult.dimensions_created} wymiarów
          <button className="btn btn-sm" style={{ marginLeft: 12, fontSize: 10 }} onClick={() => setImportResult(null)}>&#10005;</button>
        </div>
      )}
      {importError && (
        <div className="card" style={{ background: "var(--red-dim)", borderLeft: "3px solid var(--red)", marginBottom: 12, padding: "10px 14px", fontSize: 12 }}>
          <strong>Błąd importu:</strong> {importError}
          <button className="btn btn-sm" style={{ marginLeft: 12, fontSize: 10 }} onClick={() => setImportError(null)}>&#10005;</button>
        </div>
      )}

      {/* Stats */}
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      {/* Quick type filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {typeFilterChips.map(chip => (
          <button
            key={chip.code ?? "all"}
            className="btn btn-sm"
            style={{
              background: activeTypeFilter === chip.code ? "var(--blue)" : "var(--bg-inset)",
              color: activeTypeFilter === chip.code ? "#fff" : "var(--text-muted)",
              border: activeTypeFilter === chip.code ? "1px solid var(--blue)" : "1px solid var(--border)",
              borderRadius: 16,
              padding: "3px 12px",
              fontSize: 11,
            }}
            onClick={() => {
              setActiveTypeFilter(activeTypeFilter === chip.code ? null : chip.code);
            }}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
        <span style={{ borderLeft: "1px solid var(--border)", margin: "0 4px" }} />
        {["internal", "external"].map(origin => (
          <button
            key={origin}
            className="btn btn-sm"
            style={{
              background: activeOriginFilter === origin ? "var(--purple)" : "var(--bg-inset)",
              color: activeOriginFilter === origin ? "#fff" : "var(--text-muted)",
              border: activeOriginFilter === origin ? "1px solid var(--purple)" : "1px solid var(--border)",
              borderRadius: 16,
              padding: "3px 12px",
              fontSize: 11,
            }}
            onClick={() => setActiveOriginFilter(activeOriginFilter === origin ? null : origin)}
          >
            {ORIGIN_LABELS[origin]}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.yaml,.yml" style={{ display: "none" }}
             onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
      <TableToolbar
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="dokumentów"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj dokumentów..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="repozytorium_wymagan"
        primaryLabel="Nowy dokument"
        onPrimaryAction={() => setShowCreateModal(true)}
        secondaryActions={[
          { label: "Katalog CISO Assistant", onClick: () => setShowCatalog(true) },
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
          emptyMessage="Brak dokumentów referencyjnych. Zaimportuj z pliku lub utwórz ręcznie."
          emptyFilteredMessage="Brak dokumentów pasujących do filtrów."
          renderCell={(r, key) => {
            if (key === "name") return (
              <div>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                {r.updates_document_id && (
                  <span style={{ fontSize: 9, color: "var(--orange)", marginLeft: 6 }}>AKTUALIZACJA</span>
                )}
              </div>
            );
            if (key === "document_type_name") return (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.document_type_name || "—"}</span>
            );
            if (key === "document_origin") return (
              <span className="score-badge" style={{
                background: r.document_origin === "internal" ? "var(--blue-dim)" : "var(--bg-inset)",
                color: r.document_origin === "internal" ? "var(--blue)" : "var(--text-muted)",
                fontSize: 10,
              }}>
                {ORIGIN_LABELS[r.document_origin] || r.document_origin}
              </span>
            );
            if (key === "total_nodes") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.total_nodes}</span>;
            if (key === "total_assessable") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.total_assessable}</span>;
            if (key === "lifecycle_status") return (
              <span className="score-badge" style={{ background: lifecycleBg(r.lifecycle_status), color: lifecycleColor(r.lifecycle_status) }}>
                {lifecycleLabel(r.lifecycle_status)}
              </span>
            );
            if (key === "display_version") return (
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                {r.display_version || r.published_version || "—"}
              </span>
            );
            if (key === "next_review_date") {
              if (!r.next_review_date) return <span style={{ color: "var(--text-muted)" }}>—</span>;
              const isOverdue = new Date(r.next_review_date) < new Date();
              return (
                <span style={{ color: isOverdue ? "var(--red)" : "var(--text-muted)", fontWeight: isOverdue ? 600 : 400 }}>
                  {r.next_review_date}
                  {isOverdue && " !"}
                </span>
              );
            }
            return undefined;
          }}
        />

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegóły dokumentu</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-sm" onClick={() => navigate(`/frameworks/${selected.id}`)} title="Otwórz">Otwórz</button>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
              </div>
            </div>

            {/* Status + Version display */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: lifecycleColor(selected.lifecycle_status) }}>
                {selected.display_version || `v${selected.edit_version}`}
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
              <DetailRow label="Typ dokumentu" value={selected.document_type_name || "—"} />
              <DetailRow label="Pochodzenie" value={ORIGIN_LABELS[selected.document_origin] || selected.document_origin} />
              <DetailRow label="Właściciel" value={selected.owner} />
              <DetailRow label="Dostawca" value={selected.provider} />
              <DetailRow label="Wersja" value={selected.display_version || selected.published_version || selected.version} />
              <DetailRow label="Ref ID" value={selected.ref_id} />

              <SectionHeader number={2} label="Przeglądy" />
              <DetailRow label="Wymaga przeglądu" value={selected.requires_review ? "Tak" : "Nie"} color={selected.requires_review ? "var(--blue)" : undefined} />
              {selected.requires_review && (
                <>
                  <DetailRow label="Następny przegląd" value={selected.next_review_date || "Nie ustalono"} color={
                    selected.next_review_date && new Date(selected.next_review_date) < new Date() ? "var(--red)" : undefined
                  } />
                </>
              )}

              <SectionHeader number={3} label="Struktura" />
              <DetailRow label="Węzły" value={
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{selected.total_nodes}</span>
              } />
              <DetailRow label="Ocenialne" value={
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{selected.total_assessable}</span>
              } />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/frameworks/${selected.id}`)}>
                Otwórz
              </button>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => handleCopy(selected)}>
                Kopiuj
              </button>
              <button className="btn btn-sm" style={{ flex: 1, color: "var(--red)" }} onClick={() => handleDelete(selected)}>
                {selected.lifecycle_status === "published" ? "Archiwizuj" : "Usuń"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nowy dokument referencyjny">
        <CreateDocumentForm
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          documentTypes={documentTypes}
        />
      </Modal>

      {/* Adoption Modal (after import) */}
      <Modal open={showAdoptModal} onClose={() => { setShowAdoptModal(false); setAdoptFrameworkId(null); }} title="Formularz adopcji dokumentu">
        {adoptFrameworkId && (
          <AdoptionForm
            frameworkId={adoptFrameworkId}
            documentTypes={documentTypes}
            onClose={() => { setShowAdoptModal(false); setAdoptFrameworkId(null); load(); }}
            onAdoptAndOpen={(id) => { setShowAdoptModal(false); navigate(`/frameworks/${id}`); }}
          />
        )}
      </Modal>

      {/* CISO Assistant Catalog */}
      <Modal open={showCatalog} onClose={() => setShowCatalog(false)} title="Katalog CISO Assistant Community" wide>
        <CisoCatalogBrowser
          existingFrameworks={frameworks}
          onImportDone={(result) => {
            setAdoptFrameworkId(result.framework_id);
            setShowCatalog(false);
            setShowAdoptModal(true);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

/* ─── Create Document Form ─── */
function CreateDocumentForm({ onClose, onCreate, documentTypes }: {
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => void;
  documentTypes: DictionaryEntry[];
}) {
  const [name, setName] = useState("");
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [provider, setProvider] = useState("");
  const [owner, setOwner] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState<number | null>(null);
  const [documentOrigin, setDocumentOrigin] = useState("external");
  const [requiresReview, setRequiresReview] = useState(false);
  const [reviewFrequency, setReviewFrequency] = useState(12);

  return (
    <div>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="form-group">
          <label>Nazwa dokumentu *</label>
          <input className="form-control" value={name} onChange={e => setName(e.target.value)}
                 placeholder="np. ISO 27001:2022, Polityka Bezpieczeństwa IT" autoFocus />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Typ dokumentu</label>
            <select className="form-control" value={documentTypeId ?? ""}
                    onChange={e => setDocumentTypeId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Wybierz typ —</option>
              {documentTypes.map(dt => (
                <option key={dt.id} value={dt.id}>{dt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Pochodzenie</label>
            <select className="form-control" value={documentOrigin}
                    onChange={e => setDocumentOrigin(e.target.value)}>
              <option value="external">Zewnętrzny</option>
              <option value="internal">Wewnętrzny</option>
            </select>
          </div>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Dostawca / Wydawca</label>
            <input className="form-control" value={provider} onChange={e => setProvider(e.target.value)}
                   placeholder="np. ISO, NIST, CIS" />
          </div>
          <div className="form-group">
            <label>Właściciel dokumentu</label>
            <input className="form-control" value={owner} onChange={e => setOwner(e.target.value)}
                   placeholder="Osoba odpowiedzialna" />
          </div>
        </div>
        <div className="form-group">
          <label>Opis</label>
          <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)}
                    rows={3} placeholder="Opis dokumentu..." />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={requiresReview} onChange={e => setRequiresReview(e.target.checked)} />
            Podlega przeglądom okresowym
          </label>
          {requiresReview && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>co</span>
              <input type="number" className="form-control" style={{ width: 60 }}
                     value={reviewFrequency} onChange={e => setReviewFrequency(Number(e.target.value))}
                     min={1} max={60} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>mies.</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="btn" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" disabled={!name.trim()}
                onClick={() => onCreate({
                  name, ref_id: refId, description, version, provider, owner,
                  document_type_id: documentTypeId,
                  document_origin: documentOrigin,
                  requires_review: requiresReview,
                  review_frequency_months: reviewFrequency,
                })}>
          Utwórz
        </button>
      </div>
    </div>
  );
}

/* ─── Adoption Form (shown after import) ─── */
function AdoptionForm({ frameworkId, documentTypes, onClose, onAdoptAndOpen }: {
  frameworkId: number;
  documentTypes: DictionaryEntry[];
  onClose: () => void;
  onAdoptAndOpen: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState<number | null>(null);
  const [documentOrigin, setDocumentOrigin] = useState("external");
  const [owner, setOwner] = useState("");
  const [requiresReview, setRequiresReview] = useState(false);
  const [reviewFrequency, setReviewFrequency] = useState(12);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<{ name: string; document_origin: string }>(`/api/v1/frameworks/${frameworkId}`)
      .then(fw => {
        setName(fw.name);
        setDocumentOrigin(fw.document_origin || "external");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [frameworkId]);

  const handleAdopt = async () => {
    try {
      await api.put(`/api/v1/frameworks/${frameworkId}/adopt`, {
        name: name || undefined,
        document_type_id: documentTypeId,
        document_origin: documentOrigin,
        owner: owner || undefined,
        requires_review: requiresReview,
        review_frequency_months: reviewFrequency,
      });
      onAdoptAndOpen(frameworkId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Błąd adopcji");
    }
  };

  if (!loaded) return <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ładowanie...</div>;

  return (
    <div>
      <div style={{ background: "var(--blue-dim)", borderLeft: "3px solid var(--blue)", padding: "10px 14px", marginBottom: 16, fontSize: 12 }}>
        Dokument został zaimportowany jako szkic. Uzupełnij jego atrybuty i przejrzyj strukturę przed zatwierdzeniem.
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="form-group">
          <label>Nazwa dokumentu</label>
          <input className="form-control" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Typ dokumentu</label>
            <select className="form-control" value={documentTypeId ?? ""}
                    onChange={e => setDocumentTypeId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Wybierz typ —</option>
              {documentTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Pochodzenie</label>
            <select className="form-control" value={documentOrigin}
                    onChange={e => setDocumentOrigin(e.target.value)}>
              <option value="external">Zewnętrzny</option>
              <option value="internal">Wewnętrzny</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Właściciel dokumentu</label>
          <input className="form-control" value={owner} onChange={e => setOwner(e.target.value)}
                 placeholder="Osoba odpowiedzialna za dokument" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={requiresReview} onChange={e => setRequiresReview(e.target.checked)} />
            Podlega przeglądom okresowym
          </label>
          {requiresReview && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>co</span>
              <input type="number" className="form-control" style={{ width: 60 }}
                     value={reviewFrequency} onChange={e => setReviewFrequency(Number(e.target.value))}
                     min={1} max={60} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>mies.</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="btn" onClick={onClose}>Pomiń (pozostaw szkic)</button>
        <button className="btn btn-primary" onClick={handleAdopt}>
          Zapisz i otwórz dokument
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CisoCatalogBrowser — browse & import from CISO Assistant Community
   ═══════════════════════════════════════════════════ */
function CisoCatalogBrowser({ existingFrameworks, onImportDone }: {
  existingFrameworks: FrameworkBrief[];
  onImportDone: (result: FrameworkImportResult) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FrameworkCategory | null>(null);
  const [importingFile, setImportingFile] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  /* Check if framework might already be imported (by name similarity) */
  const isLikelyImported = (cf: CatalogFramework) => {
    const n = cf.name.toLowerCase();
    return existingFrameworks.some(ef => {
      const en = ef.name.toLowerCase();
      return en.includes(n) || n.includes(en) ||
        (cf.filename.replace(/\.yaml|\.xlsx/g, "").replace(/-/g, " ").toLowerCase()
          .split(" ").filter(w => w.length > 2).some(w => en.includes(w)) && en.length > 5);
    });
  };

  const filtered = useMemo(() => {
    let list = CISO_FRAMEWORK_CATALOG;
    if (activeCategory) list = list.filter(f => f.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.provider.toLowerCase().includes(q) ||
        f.filename.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, activeCategory]);

  /* Category chips with counts */
  const categoryChips = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of CISO_FRAMEWORK_CATALOG) {
      counts[f.category] = (counts[f.category] || 0) + 1;
    }
    return Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
      key: key as FrameworkCategory,
      label,
      count: counts[key] || 0,
      color: CATEGORY_COLORS[key as FrameworkCategory],
    })).filter(c => c.count > 0);
  }, []);

  const handleImport = async (cf: CatalogFramework) => {
    setImportingFile(cf.filename);
    setImportError(null);
    try {
      const result = await api.post<FrameworkImportResult>(
        `/api/v1/frameworks/import/github?framework_path=${encodeURIComponent(cf.filename)}`,
        {}
      );
      onImportDone(result);
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Błąd importu");
    } finally {
      setImportingFile(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Info */}
      <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Katalog CISO Assistant Community</div>
        <div style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          Przeglądaj i importuj frameworki bezpieczeństwa z repozytorium open-source CISO Assistant.
          Po imporcie uzupełnij atrybuty dokumentu w formularzu adopcji.
        </div>
      </div>

      {importError && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 12,
          background: "#7f1d1d", color: "#fca5a5",
        }}>
          <strong>Błąd:</strong> {importError}
          <button className="btn btn-sm" style={{ marginLeft: 8, fontSize: 10 }} onClick={() => setImportError(null)}>×</button>
        </div>
      )}

      {/* Search + Category chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          className="form-control"
          placeholder="Szukaj frameworka..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: "1 1 200px", fontSize: 12, padding: "6px 10px" }}
          autoFocus
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button
            className="btn btn-sm"
            style={{
              borderRadius: 16, padding: "2px 10px", fontSize: 10,
              background: !activeCategory ? "var(--blue)" : "var(--bg-inset)",
              color: !activeCategory ? "#fff" : "var(--text-muted)",
              border: !activeCategory ? "1px solid var(--blue)" : "1px solid var(--border)",
            }}
            onClick={() => setActiveCategory(null)}
          >
            Wszystkie ({CISO_FRAMEWORK_CATALOG.length})
          </button>
          {categoryChips.map(c => (
            <button
              key={c.key}
              className="btn btn-sm"
              style={{
                borderRadius: 16, padding: "2px 10px", fontSize: 10,
                background: activeCategory === c.key ? c.color : "var(--bg-inset)",
                color: activeCategory === c.key ? "#fff" : "var(--text-muted)",
                border: `1px solid ${activeCategory === c.key ? c.color : "var(--border)"}`,
              }}
              onClick={() => setActiveCategory(activeCategory === c.key ? null : c.key)}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {filtered.length} z {CISO_FRAMEWORK_CATALOG.length} frameworków
      </div>

      {/* Framework list */}
      <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Brak frameworków pasujących do wyszukiwania
          </div>
        ) : (
          filtered.map(cf => {
            const imported = isLikelyImported(cf);
            const isImporting = importingFile === cf.filename;
            const catColor = CATEGORY_COLORS[cf.category];
            return (
              <div
                key={cf.filename}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderBottom: "1px solid var(--border)",
                  opacity: isImporting ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      padding: "1px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600,
                      background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}40`,
                      flexShrink: 0,
                    }}>
                      {CATEGORY_LABELS[cf.category]}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{cf.name}</span>
                    {imported && (
                      <span style={{
                        padding: "1px 6px", borderRadius: 10, fontSize: 9,
                        background: "#10b98118", color: "#10b981", border: "1px solid #10b98140",
                      }}>
                        zaimportowany
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {cf.provider} &middot; {cf.filename}
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{
                    fontSize: 11, marginLeft: 12, flexShrink: 0,
                    ...(imported ? {} : { background: "var(--blue)", color: "#fff", border: "1px solid var(--blue)" }),
                  }}
                  onClick={() => handleImport(cf)}
                  disabled={isImporting}
                >
                  {isImporting ? "Importowanie..." : imported ? "Reimportuj" : "Importuj"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
