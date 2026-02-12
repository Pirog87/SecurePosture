import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { api } from "../services/api";
import type {
  Asset, AssetCategoryTreeNode, CategoryFieldDefinition,
  AssetRelationship, RelationshipType, OrgUnitTreeNode, DictionaryTypeWithEntries,
  AuditLogEntry, AuditLogPage, Risk, Threat, Vulnerability, Safeguard, Action,
} from "../types";
import { buildPathMap } from "../utils/orgTree";
import Modal from "../components/Modal";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import AssetCategoryTree from "../components/AssetCategoryTree";
import DynamicAssetForm from "../components/DynamicAssetForm";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards from "../components/StatsCards";

/* Icon name → emoji map (same as AssetCategoryTree) */
const CAT_ICON: Record<string, string> = {
  HardDrive: "\uD83D\uDDA5\uFE0F", Server: "\uD83D\uDDA5\uFE0F", Monitor: "\uD83D\uDDA5\uFE0F", Laptop: "\uD83D\uDCBB",
  Smartphone: "\uD83D\uDCF1", Printer: "\uD83D\uDDA8\uFE0F", Database: "\uD83D\uDDC4\uFE0F",
  Network: "\uD83C\uDF10", Globe: "\uD83C\uDF10", Router: "\uD83D\uDD0C", Shield: "\uD83D\uDEE1\uFE0F",
  Code: "\uD83D\uDCBB", Layers: "\uD83D\uDCDA", AppWindow: "\uD83D\uDCF1", Cloud: "\u2601\uFE0F", Settings: "\u2699\uFE0F",
  Users: "\uD83D\uDC65", User: "\uD83D\uDC64", UsersGroup: "\uD83D\uDC65", Briefcase: "\uD83D\uDCBC",
  FileText: "\uD83D\uDCC4", File: "\uD83D\uDCC4", Table: "\uD83D\uDCCA", Key: "\uD83D\uDD11",
  Building: "\uD83C\uDFE2", MapPin: "\uD83D\uDCCD", Door: "\uD83D\uDEAA",
  Workflow: "\u2699\uFE0F", GitBranch: "\uD83D\uDD00", Headphones: "\uD83C\uDFA7",
};
function catIcon(name: string | null): string {
  if (!name) return "\uD83D\uDCC1";
  return CAT_ICON[name] ?? "\uD83D\uDCC1";
}

function critColor(name: string | null): string {
  if (!name) return "var(--text-muted)";
  const l = name.toLowerCase();
  if (l.includes("wysok") || l.includes("high") || l.includes("krytycz")) return "var(--red)";
  if (l.includes("średni") || l.includes("medium")) return "var(--orange)";
  return "var(--green)";
}

interface FormLookups {
  orgUnits: OrgUnitTreeNode[];
  assets: Asset[];
  sensitivities: { id: number; label: string }[];
  criticalities: { id: number; label: string }[];
}

/* ═══════════════════════════════════════════════
   AssetsPage — Unified CMDB module
   ═══════════════════════════════════════════════ */
export default function AssetsPage() {
  // ── Category tree state ──
  const [categoryTree, setCategoryTree] = useState<AssetCategoryTreeNode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategoryTreeNode | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(true);

  // ── Assets list state ──
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  // ── Detail panel state ──
  const [selected, setSelected] = useState<Asset | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "custom" | "relations" | "risks" | "history">("info");

  // ── Dynamic fields ──
  const [categoryFields, setCategoryFields] = useState<CategoryFieldDefinition[]>([]);
  // ── Relationships for detail ──
  const [assetRelations, setAssetRelations] = useState<AssetRelationship[]>([]);

  // ── History for detail ──
  const [assetHistory, setAssetHistory] = useState<AuditLogEntry[]>([]);

  // ── Relationship types + add relation form ──
  const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);
  const [showAddRel, setShowAddRel] = useState(false);
  const [relSaving, setRelSaving] = useState(false);

  // ── Form modal ──
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [formCustomAttrs, setFormCustomAttrs] = useState<Record<string, unknown>>({});
  const [formFields, setFormFields] = useState<CategoryFieldDefinition[]>([]);
  const [formCategoryId, setFormCategoryId] = useState<number | null>(null);
  const [editFormTab, setEditFormTab] = useState<"data" | "risks">("data");

  // ── Graph modal ──
  const [showGraph, setShowGraph] = useState(false);
  const [graphAsset, setGraphAsset] = useState<Asset | null>(null);

  // ── CSV import ──
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[]; total_errors: number } | null>(null);

  // ── Bulk selection ──
  const [bulkIds, setBulkIds] = useState<Set<number>>(new Set());

  // ── Filters ──
  const [showFilters, setShowFilters] = useState(false);

  // ── Org tree for path display ──
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);
  const orgPathMap = useMemo(() => buildPathMap(orgTree), [orgTree]);

  // ═══════════════════ COLUMNS ═══════════════════
  const COLUMNS: ColumnDef<Asset>[] = useMemo(() => {
    const base: ColumnDef<Asset>[] = [
      { key: "id", header: "ID" },
      { key: "name", header: "Nazwa" },
      { key: "asset_category_name", header: "Kategoria", format: r => r.asset_category_name ?? r.asset_type_name ?? "" },
      { key: "org_unit_name", header: "Jednostka org.", format: r => r.org_unit_name ?? "" },
      { key: "owner", header: "Wlasciciel", format: r => r.owner ?? "" },
      { key: "criticality_name", header: "Krytycznosc", format: r => r.criticality_name ?? "" },
      { key: "risk_count", header: "Ryzyka", format: r => String(r.risk_count) },
      { key: "sensitivity_name", header: "Wrazliwosc", format: r => r.sensitivity_name ?? "", defaultVisible: false },
      { key: "location", header: "Lokalizacja", format: r => r.location ?? "", defaultVisible: false },
      { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
    ];
    // Add dynamic columns from category field definitions
    for (const f of categoryFields.filter(fd => fd.show_in_list)) {
      base.push({
        key: `ca_${f.field_key}` as keyof Asset & string,
        header: f.label,
        format: r => {
          const v = r.custom_attributes?.[f.field_key];
          if (v == null) return "";
          if (Array.isArray(v)) return v.join(", ");
          return String(v);
        },
      });
    }
    return base;
  }, [categoryFields]);

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "assets-cmdb");
  const table = useTableFeatures<Asset>({ data: assets, storageKey: "assets-cmdb", defaultSort: "name" });

  // ═══════════════════ LOAD DATA ═══════════════════

  // Load category tree
  useEffect(() => {
    setCategoryLoading(true);
    api.get<AssetCategoryTreeNode[]>("/api/v1/asset-categories/tree")
      .then(setCategoryTree)
      .catch(() => {})
      .finally(() => setCategoryLoading(false));
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
    api.get<RelationshipType[]>("/api/v1/asset-categories/relationship-types/all").then(setRelTypes).catch(() => {});
  }, []);

  // Load assets when category changes
  const loadAssets = useCallback(() => {
    setAssetsLoading(true);
    const params = selectedCategory ? `?asset_category_id=${selectedCategory.id}` : "";
    api.get<Asset[]>(`/api/v1/assets${params}`)
      .then(data => {
        setAssets(data);
        // If selected asset no longer in list, deselect
        if (selected && !data.find(a => a.id === selected.id)) {
          setSelected(null);
        }
      })
      .catch(() => {})
      .finally(() => setAssetsLoading(false));
  }, [selectedCategory?.id]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // Load fields for selected category
  useEffect(() => {
    if (selectedCategory && !selectedCategory.is_abstract) {
      api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${selectedCategory.id}/fields`)
        .then(setCategoryFields)
        .catch(() => setCategoryFields([]));
    } else {
      setCategoryFields([]);
    }
  }, [selectedCategory?.id]);

  // Load relations + history when asset selected
  useEffect(() => {
    if (selected) {
      setDetailTab("info");
      api.get<AssetRelationship[]>(`/api/v1/assets/${selected.id}/relationships`)
        .then(setAssetRelations).catch(() => setAssetRelations([]));
      api.get<AuditLogPage>(`/api/v1/audit?entity_type=Asset&entity_id=${selected.id}&per_page=50`)
        .then(page => setAssetHistory(page.items)).catch(() => setAssetHistory([]));
    } else {
      setAssetRelations([]);
      setAssetHistory([]);
    }
  }, [selected?.id]);

  // ═══════════════════ CATEGORY SELECT ═══════════════════

  const handleCategorySelect = (cat: AssetCategoryTreeNode | null) => {
    setSelectedCategory(cat);
    setSelected(null);
  };

  // ═══════════════════ FORM LOGIC ═══════════════════

  const loadLookups = async (): Promise<FormLookups> => {
    if (lookups) return lookups;
    const [orgUnits, allAssets] = await Promise.all([
      api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").catch(() => [] as OrgUnitTreeNode[]),
      api.get<Asset[]>("/api/v1/assets").catch(() => [] as Asset[]),
    ]);
    const dictEntries = async (code: string) => {
      try {
        const d = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${code}/entries`);
        return d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label }));
      } catch { return []; }
    };
    const [sensitivities, criticalities] = await Promise.all([
      dictEntries("sensitivity"), dictEntries("criticality"),
    ]);
    const result = { orgUnits, assets: allAssets, sensitivities, criticalities };
    setLookups(result);
    return result;
  };

  const openAddForm = async () => {
    await loadLookups();
    setEditAsset(null);
    // Pre-select category if one is selected in sidebar
    const catId = selectedCategory && !selectedCategory.is_abstract ? selectedCategory.id : null;
    setFormCategoryId(catId);
    setFormCustomAttrs({});
    if (catId) {
      const fields = await api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${catId}/fields`).catch(() => []);
      setFormFields(fields);
    } else {
      setFormFields([]);
    }
    setShowForm(true);
  };

  const openEditForm = async (asset: Asset) => {
    await loadLookups();
    setEditAsset(asset);
    setEditFormTab("data");
    setFormCategoryId(asset.asset_category_id);
    setFormCustomAttrs(asset.custom_attributes || {});
    if (asset.asset_category_id) {
      const fields = await api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${asset.asset_category_id}/fields`).catch(() => []);
      setFormFields(fields);
    } else {
      setFormFields([]);
    }
    setShowForm(true);
  };

  const handleFormCategoryChange = async (catId: number | null) => {
    setFormCategoryId(catId);
    if (catId) {
      const fields = await api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${catId}/fields`).catch(() => []);
      setFormFields(fields);
    } else {
      setFormFields([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: fd.get("name") as string,
      org_unit_id: fd.get("org_unit_id") ? Number(fd.get("org_unit_id")) : null,
      parent_id: fd.get("parent_id") ? Number(fd.get("parent_id")) : null,
      owner: (fd.get("owner") as string) || null,
      description: (fd.get("description") as string) || null,
      location: (fd.get("location") as string) || null,
      sensitivity_id: fd.get("sensitivity_id") ? Number(fd.get("sensitivity_id")) : null,
      criticality_id: fd.get("criticality_id") ? Number(fd.get("criticality_id")) : null,
      asset_category_id: formCategoryId,
      custom_attributes: Object.keys(formCustomAttrs).length > 0 ? formCustomAttrs : null,
    };
    try {
      if (editAsset) {
        const updated = await api.put<Asset>(`/api/v1/assets/${editAsset.id}`, body);
        setSelected(updated);
      } else {
        await api.post("/api/v1/assets", body);
      }
      setShowForm(false);
      setEditAsset(null);
      setLookups(null);
      loadAssets();
      // Refresh category tree counts
      api.get<AssetCategoryTreeNode[]>("/api/v1/asset-categories/tree").then(setCategoryTree).catch(() => {});
    } catch (err) {
      alert("Blad zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (asset: Asset) => {
    if (!confirm(`Archiwizowac aktyw "${asset.name}"?`)) return;
    try {
      await api.delete(`/api/v1/assets/${asset.id}`);
      setSelected(null);
      loadAssets();
      api.get<AssetCategoryTreeNode[]>("/api/v1/asset-categories/tree").then(setCategoryTree).catch(() => {});
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  // ═══════════════════ EGO GRAPH ═══════════════════

  const openGraph = (asset: Asset) => {
    setGraphAsset(asset);
    setShowGraph(true);
  };

  // ═══════════════════ RELATIONSHIP CRUD ═══════════════════

  const handleAddRelation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    setRelSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      source_asset_id: selected.id,
      target_asset_id: Number(fd.get("target_asset_id")),
      relationship_type: fd.get("relationship_type") as string,
      description: (fd.get("rel_description") as string) || null,
    };
    try {
      await api.post("/api/v1/assets/relationships", body);
      setShowAddRel(false);
      // Refresh relations
      const rels = await api.get<AssetRelationship[]>(`/api/v1/assets/${selected.id}/relationships`);
      setAssetRelations(rels);
    } catch (err) {
      alert("Blad dodawania relacji: " + err);
    } finally {
      setRelSaving(false);
    }
  };

  const handleDeleteRelation = async (relId: number) => {
    if (!selected || !confirm("Usunac te relacje?")) return;
    try {
      await api.delete(`/api/v1/assets/relationships/${relId}`);
      setAssetRelations(prev => prev.filter(r => r.id !== relId));
    } catch (err) {
      alert("Blad usuwania relacji: " + err);
    }
  };

  // ═══════════════════ CSV IMPORT ═══════════════════

  const handleCsvImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("csv_file") as File;
    if (!file || file.size === 0) return;

    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);

    const catId = selectedCategory && !selectedCategory.is_abstract ? selectedCategory.id : null;
    const url = `/api/v1/assets/import/csv${catId ? `?asset_category_id=${catId}` : ""}`;

    try {
      const res = await api.postFormData<{ created: number; errors: string[]; total_errors: number }>(url, formData);
      setImportResult(res);
      loadAssets();
      api.get<AssetCategoryTreeNode[]>("/api/v1/asset-categories/tree").then(setCategoryTree).catch(() => {});
    } catch (err) {
      alert("Blad importu: " + err);
    } finally {
      setImporting(false);
    }
  };

  // ═══════════════════ BULK OPERATIONS ═══════════════════

  const toggleBulk = (id: number) => {
    setBulkIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    if (bulkIds.size === 0 || !confirm(`Archiwizowac ${bulkIds.size} aktywow?`)) return;
    try {
      await api.post("/api/v1/assets/bulk/archive", { asset_ids: [...bulkIds] });
      setBulkIds(new Set());
      setSelected(null);
      loadAssets();
      api.get<AssetCategoryTreeNode[]>("/api/v1/asset-categories/tree").then(setCategoryTree).catch(() => {});
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  const handleBulkAssignCategory = async (catId: number | null) => {
    if (bulkIds.size === 0) return;
    try {
      await api.post("/api/v1/assets/bulk/assign-category", { asset_ids: [...bulkIds], asset_category_id: catId });
      setBulkIds(new Set());
      loadAssets();
      api.get<AssetCategoryTreeNode[]>("/api/v1/asset-categories/tree").then(setCategoryTree).catch(() => {});
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  // ═══════════════════ HIERARCHICAL CATEGORY LIST ═══════════════════
  const hierarchicalCategories = useMemo(() => {
    const flat: { cat: AssetCategoryTreeNode; depth: number }[] = [];
    const walk = (nodes: AssetCategoryTreeNode[], depth: number) => {
      for (const n of nodes) {
        flat.push({ cat: n, depth });
        walk(n.children, depth + 1);
      }
    };
    walk(categoryTree, 0);
    return flat;
  }, [categoryTree]);

  // Leaf-only for bulk assignment (backwards compat)
  const flatCategories = useMemo(() => hierarchicalCategories.filter(c => !c.cat.is_abstract), [hierarchicalCategories]);

  // ═══════════════════ RENDER ═══════════════════

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Left: Category Tree */}
      <AssetCategoryTree
        tree={categoryTree}
        selectedId={selectedCategory?.id ?? null}
        onSelect={handleCategorySelect}
        loading={categoryLoading}
      />

      {/* Right: Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
        {/* Page title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0 8px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {selectedCategory ? (selectedCategory.name_plural || selectedCategory.name) : "Wszystkie Aktywa"}
          </h2>
          {selectedCategory && (
            <span className="score-badge" style={{
              background: (selectedCategory.color || "var(--blue)") + "20",
              color: selectedCategory.color || "var(--blue)",
              fontSize: 11,
            }}>
              {selectedCategory.is_abstract ? "Grupa" : "Kategoria"}
            </span>
          )}
        </div>

        {/* KPI */}
        <StatsCards
          cards={[
            { label: "Aktywow", value: table.filtered.filter(a => a.is_active).length, total: assets.filter(a => a.is_active).length, color: "var(--blue)" },
            { label: "Z ryzykami", value: table.filtered.filter(a => a.risk_count > 0).length, total: assets.filter(a => a.risk_count > 0).length, color: "var(--orange)" },
            { label: "Krytycznych", value: table.filtered.filter(a => a.criticality_name?.toLowerCase().includes("wysok") || a.criticality_name?.toLowerCase().includes("krytycz")).length, color: "var(--red)" },
            { label: "Jednostek org.", value: new Set(table.filtered.filter(a => a.org_unit_id).map(a => a.org_unit_id)).size, color: "var(--cyan)" },
          ]}
          isFiltered={table.filteredCount !== table.totalCount}
        />

        {/* Toolbar */}
        <TableToolbar
          filteredCount={table.filteredCount}
          totalCount={table.totalCount}
          unitLabel="aktywow"
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Szukaj aktywow..."
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(f => !f)}
          hasActiveFilters={table.hasActiveFilters}
          onClearFilters={table.clearAllFilters}
          columns={COLUMNS}
          visibleColumns={visibleCols}
          onToggleColumn={toggleCol}
          data={table.filtered}
          exportFilename="aktywa-cmdb"
          primaryLabel="Dodaj aktyw"
          onPrimaryAction={openAddForm}
          secondaryActions={[
            { label: "Import CSV", onClick: () => { setShowImport(true); setImportResult(null); } },
          ]}
        />

        {/* Bulk action bar */}
        {bulkIds.size > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 8,
            background: "var(--blue-dim)", borderRadius: 8, fontSize: 12,
          }}>
            <span style={{ fontWeight: 600, color: "var(--blue)" }}>Zaznaczono: {bulkIds.size}</span>
            <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setBulkIds(new Set())}>Odznacz</button>
            <div style={{ flex: 1 }} />
            <select
              className="form-control"
              style={{ width: "auto", fontSize: 11, padding: "3px 8px" }}
              value=""
              onChange={e => { if (e.target.value) handleBulkAssignCategory(Number(e.target.value)); }}
            >
              <option value="">Przypisz kategorie...</option>
              {flatCategories.map(({ cat, depth }) => (
                <option key={cat.id} value={cat.id}>{"\u00A0\u00A0".repeat(depth)}{cat.name}</option>
              ))}
            </select>
            <button className="btn btn-sm" style={{ fontSize: 11, color: "var(--red)" }} onClick={handleBulkArchive}>
              Archiwizuj ({bulkIds.size})
            </button>
          </div>
        )}

        {/* Table + Detail panel */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
          <DataTable<Asset>
            columns={COLUMNS}
            visibleColumns={visibleCols}
            data={table.pageData}
            rowKey={r => r.id}
            selectedKey={selected?.id ?? null}
            onRowClick={r => setSelected(selected?.id === r.id ? null : r)}
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
            loading={assetsLoading}
            emptyMessage="Brak aktywow w tej kategorii."
            emptyFilteredMessage="Brak aktywow pasujacych do filtrow."
            renderCell={(a, key) => {
              if (key === "id") return (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={bulkIds.has(a.id)}
                    onChange={(e) => { e.stopPropagation(); toggleBulk(a.id); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 14, height: 14, cursor: "pointer" }}
                  />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{a.ref_id || a.id}</span>
                </span>
              );
              if (key === "name") return <span style={{ fontWeight: 500 }}>{a.name}</span>;
              if (key === "asset_category_name") {
                const catName = a.asset_category_name || a.asset_type_name;
                const catColor = a.asset_category_color || "var(--purple)";
                return catName ? <span className="score-badge" style={{ background: catColor + "20", color: catColor }}>{catName}</span> : "\u2014";
              }
              if (key === "org_unit_name") return <span style={{ fontSize: 11 }}>{(a.org_unit_id ? orgPathMap.get(a.org_unit_id) : null) ?? a.org_unit_name ?? "\u2014"}</span>;
              if (key === "criticality_name") return a.criticality_name ? <span className="score-badge" style={{ background: critColor(a.criticality_name) === "var(--red)" ? "var(--red-dim)" : critColor(a.criticality_name) === "var(--orange)" ? "var(--orange-dim)" : "var(--green-dim)", color: critColor(a.criticality_name) }}>{a.criticality_name}</span> : "\u2014";
              // Custom attribute columns
              if (typeof key === "string" && key.startsWith("ca_")) {
                const fk = key.slice(3);
                const v = a.custom_attributes?.[fk];
                if (v == null) return "\u2014";
                if (Array.isArray(v)) return <span>{v.join(", ")}</span>;
                return <span>{String(v)}</span>;
              }
              return undefined;
            }}
          />

          {/* ═══ DETAIL PANEL ═══ */}
          {selected && (
            <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="card-title" style={{ margin: 0 }}>Szczegoly aktywa</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-sm" title="Graf relacji" onClick={() => openGraph(selected)}
                    style={{ fontSize: 14, padding: "4px 8px" }}>
                    🔗
                  </button>
                  <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
                </div>
              </div>

              {/* Asset name + category badge */}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{selected.name}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 6 }}>
                  {selected.asset_category_name && (
                    <span className="score-badge" style={{
                      background: (selected.asset_category_color || "var(--purple)") + "20",
                      color: selected.asset_category_color || "var(--purple)", fontSize: 11,
                    }}>
                      {selected.asset_category_name}
                    </span>
                  )}
                  {selected.ref_id && (
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>
                      {selected.ref_id}
                    </span>
                  )}
                </div>
              </div>

              {/* Detail tabs */}
              <div style={{ display: "flex", gap: 0, marginBottom: 14 }}>
                {([
                  { key: "info" as const, label: "Informacje" },
                  { key: "custom" as const, label: "Atrybuty" },
                  { key: "relations" as const, label: `Relacje (${assetRelations.length})` },
                  { key: "risks" as const, label: `Ryzyka (${selected.risk_count})` },
                  { key: "history" as const, label: "Historia" },
                ]).map(t => (
                  <div
                    key={t.key}
                    style={{
                      flex: 1, textAlign: "center", padding: "5px 4px",
                      background: detailTab === t.key ? "var(--blue-dim)" : "transparent",
                      borderBottom: detailTab === t.key ? "2px solid var(--blue)" : "2px solid var(--border)",
                      color: detailTab === t.key ? "var(--blue)" : "var(--text-muted)",
                      fontWeight: detailTab === t.key ? 600 : 400,
                      fontSize: 11, cursor: "pointer", transition: "all 0.2s",
                    }}
                    onClick={() => setDetailTab(t.key)}
                  >
                    {t.label}
                  </div>
                ))}
              </div>

              {/* Tab: Info */}
              {detailTab === "info" && (
                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  {[
                    ["Kategoria", selected.asset_category_name ?? selected.category_name ?? "\u2014"],
                    ["Jednostka org.", (selected.org_unit_id ? orgPathMap.get(selected.org_unit_id) : null) ?? selected.org_unit_name ?? "\u2014"],
                    ["Wlasciciel", selected.owner ?? "\u2014"],
                    ["Lokalizacja", selected.location ?? "\u2014"],
                    ["Wrazliwosc", selected.sensitivity_name ?? "\u2014"],
                    ["Krytycznosc", selected.criticality_name ?? "\u2014"],
                    ["Nadrzedny aktyw", selected.parent_name ?? "\u2014"],
                    ["Utworzono", selected.created_at?.slice(0, 10)],
                    ["Zaktualizowano", selected.updated_at?.slice(0, 10)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>{label}</span>
                      <span style={label === "Krytycznosc" ? { fontWeight: 500, color: critColor(selected.criticality_name) } : {}}>
                        {val}
                      </span>
                    </div>
                  ))}
                  {selected.description && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Opis</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset)", borderRadius: 6, padding: 8 }}>
                        {selected.description}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Custom Attributes */}
              {detailTab === "custom" && (
                <DetailCustomAttributes
                  assetCategoryId={selected.asset_category_id}
                  customAttributes={selected.custom_attributes || {}}
                />
              )}

              {/* Tab: Relations */}
              {detailTab === "relations" && (
                <div>
                  {assetRelations.length === 0 && !showAddRel ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                      Brak zdefiniowanych relacji.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {assetRelations.map(rel => {
                        const isSource = rel.source_asset_id === selected.id;
                        const relType = relTypes.find(t => t.code === rel.relationship_type);
                        const relColor = relType?.color || "var(--text-muted)";
                        return (
                          <div key={rel.id} style={{
                            padding: "8px 10px", borderRadius: 6,
                            background: "var(--bg-inset)",
                            border: "1px solid var(--border)", fontSize: 12,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                              <span className="score-badge" style={{ background: relColor + "20", color: relColor, fontSize: 10 }}>
                                {isSource ? (relType?.name || rel.relationship_type) : (relType?.name_reverse || rel.relationship_type)}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{isSource ? "→" : "←"}</span>
                                <button
                                  onClick={() => handleDeleteRelation(rel.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 12, padding: "0 2px", opacity: 0.5 }}
                                  title="Usun relacje"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                            <div style={{ fontWeight: 500 }}>
                              {isSource ? rel.target_asset_name : rel.source_asset_name}
                            </div>
                            {rel.description && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{rel.description}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add relation inline form */}
                  {showAddRel ? (
                    <form onSubmit={handleAddRelation} style={{ marginTop: 10, padding: 10, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-inset)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>Nowa relacja</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <select name="relationship_type" className="form-control" required style={{ fontSize: 12 }}>
                          <option value="">Typ relacji...</option>
                          {relTypes.map(t => (
                            <option key={t.code} value={t.code}>{t.name}</option>
                          ))}
                        </select>
                        <select name="target_asset_id" className="form-control" required style={{ fontSize: 12 }}>
                          <option value="">Docelowy aktyw...</option>
                          {assets.filter(a => a.id !== selected.id).map(a => (
                            <option key={a.id} value={a.id}>{a.name}{a.asset_category_name ? ` (${a.asset_category_name})` : ""}</option>
                          ))}
                        </select>
                        <input name="rel_description" className="form-control" placeholder="Opis (opcjonalnie)" style={{ fontSize: 12 }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="submit" className="btn btn-sm btn-primary" disabled={relSaving} style={{ flex: 1 }}>
                            {relSaving ? "Dodawanie..." : "Dodaj"}
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => setShowAddRel(false)}>Anuluj</button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <button className="btn btn-sm btn-primary" style={{ marginTop: 10, width: "100%" }} onClick={() => setShowAddRel(true)}>
                      + Dodaj relacje
                    </button>
                  )}

                  <button className="btn btn-sm" style={{ marginTop: 6, width: "100%" }} onClick={() => openGraph(selected)}>
                    Pokaz graf relacji
                  </button>
                </div>
              )}

              {/* Tab: Risks */}
              {detailTab === "risks" && (
                <AssetRisksTab
                  asset={selected}
                  orgTree={orgTree}
                  onRiskCountChange={(count) => {
                    setSelected(prev => prev ? { ...prev, risk_count: count } : prev);
                  }}
                />
              )}

              {/* Tab: History */}
              {detailTab === "history" && (
                <div>
                  {assetHistory.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                      Brak historii zmian.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {assetHistory.map(entry => (
                        <div key={entry.id} style={{
                          padding: "6px 8px", borderRadius: 4, fontSize: 11,
                          background: "var(--bg-inset)",
                          borderLeft: "2px solid var(--blue)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 500 }}>{entry.action}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                              {entry.created_at?.slice(0, 16).replace("T", " ")}
                            </span>
                          </div>
                          {entry.field_name && (
                            <div style={{ color: "var(--text-muted)" }}>
                              {entry.field_name}: {entry.old_value ?? "–"} → {entry.new_value ?? "–"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => openEditForm(selected)}>Edytuj</button>
                <button className="btn btn-sm" style={{ flex: 1 }} title="Graf relacji" onClick={() => openGraph(selected)}>Graf</button>
                <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleArchive(selected)}>Archiwizuj</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ADD / EDIT FORM MODAL ═══ */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditAsset(null); }} title={editAsset ? `Edytuj aktyw: ${editAsset.name}` : "Dodaj aktyw"} wide>
        {lookups ? (
          <div>
            {/* Tabs header - only when editing existing asset */}
            {editAsset && (
              <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid var(--border)" }}>
                {([
                  { key: "data" as const, label: "Dane aktywa" },
                  { key: "risks" as const, label: "Ryzyka" },
                ]).map(t => (
                  <div
                    key={t.key}
                    style={{
                      padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: editFormTab === t.key ? 600 : 400,
                      color: editFormTab === t.key ? "var(--blue)" : "var(--text-muted)",
                      borderBottom: editFormTab === t.key ? "2px solid var(--blue)" : "2px solid transparent",
                      marginBottom: -2, transition: "all 0.2s",
                    }}
                    onClick={() => setEditFormTab(t.key)}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Data (form) */}
            {(editFormTab === "data" || !editAsset) && (
              <form onSubmit={handleSubmit}>
                {/* Core fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label>Nazwa aktywa *</label>
                    <input name="name" className="form-control" required defaultValue={editAsset?.name ?? ""} placeholder="np. Serwer bazodanowy DB-01" />
                  </div>
                  <div className="form-group">
                    <label>Kategoria CMDB</label>
                    <select
                      className="form-control"
                      value={formCategoryId ?? ""}
                      onChange={e => handleFormCategoryChange(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Wybierz kategorie...</option>
                      {hierarchicalCategories.map(({ cat, depth }) => (
                        <option
                          key={cat.id}
                          value={cat.id}
                          disabled={cat.is_abstract}
                        >
                          {depth > 0 ? "\u2003".repeat(depth) : ""}{cat.is_abstract ? `▸ ${cat.name}` : `${catIcon(cat.icon)} ${cat.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Jednostka organizacyjna</label>
                    <OrgUnitTreeSelect
                      tree={lookups.orgUnits}
                      value={editAsset?.org_unit_id ?? null}
                      onChange={id => {
                        const hidden = document.querySelector<HTMLInputElement>('input[name="org_unit_id"]');
                        if (hidden) hidden.value = id ? String(id) : "";
                      }}
                      placeholder="Wybierz..."
                      allowClear
                    />
                    <input type="hidden" name="org_unit_id" defaultValue={editAsset?.org_unit_id ?? ""} />
                  </div>
                  <div className="form-group">
                    <label>Nadrzedny aktyw</label>
                    <select name="parent_id" className="form-control" defaultValue={editAsset?.parent_id ?? ""}>
                      <option value="">Brak (glowny)</option>
                      {lookups.assets.filter(a => !editAsset || a.id !== editAsset.id).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Wlasciciel</label>
                    <input name="owner" className="form-control" defaultValue={editAsset?.owner ?? ""} placeholder="np. Jan Kowalski" />
                  </div>
                  <div className="form-group">
                    <label>Lokalizacja</label>
                    <input name="location" className="form-control" defaultValue={editAsset?.location ?? ""} placeholder="np. Serwerownia DC-1" />
                  </div>
                  <div className="form-group">
                    <label>Wrazliwosc</label>
                    <select name="sensitivity_id" className="form-control" defaultValue={editAsset?.sensitivity_id ?? ""}>
                      <option value="">Wybierz...</option>
                      {lookups.sensitivities.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Krytycznosc</label>
                    <select name="criticality_id" className="form-control" defaultValue={editAsset?.criticality_id ?? ""}>
                      <option value="">Wybierz...</option>
                      {lookups.criticalities.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label>Opis</label>
                    <textarea name="description" className="form-control" rows={2} defaultValue={editAsset?.description ?? ""} />
                  </div>
                </div>

                {/* Dynamic fields from category */}
                {formFields.length > 0 && (
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
                      Atrybuty kategorii
                    </div>
                    <DynamicAssetForm
                      fields={formFields}
                      values={formCustomAttrs}
                      onChange={(key, val) => setFormCustomAttrs(prev => ({ ...prev, [key]: val }))}
                    />
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                  <button type="button" className="btn" onClick={() => { setShowForm(false); setEditAsset(null); }}>Anuluj</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Zapisywanie..." : editAsset ? "Zapisz zmiany" : "Dodaj aktyw"}
                  </button>
                </div>
              </form>
            )}

            {/* Tab: Risks (only when editing) */}
            {editAsset && editFormTab === "risks" && (
              <AssetRisksTab
                asset={editAsset}
                orgTree={orgTree}
                onRiskCountChange={(count) => {
                  setSelected(prev => prev && prev.id === editAsset.id ? { ...prev, risk_count: count } : prev);
                }}
              />
            )}
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie danych formularza...</div>
        )}
      </Modal>

      {/* ═══ GRAPH MODAL ═══ */}
      <Modal open={showGraph} onClose={() => { setShowGraph(false); setGraphAsset(null); }} title={graphAsset ? `Graf relacji: ${graphAsset.name}` : "Graf relacji"} wide>
        {graphAsset && <EgoGraph assetId={graphAsset.id} assetName={graphAsset.name} />}
      </Modal>

      {/* ═══ CSV IMPORT MODAL ═══ */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportResult(null); }} title="Import aktywow z CSV">
        {importResult ? (
          <div>
            <div style={{ textAlign: "center", padding: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "var(--green)", marginBottom: 8 }}>{importResult.created}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>aktywow zaimportowano pomyslnie</div>
            </div>
            {importResult.total_errors > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--red)", marginBottom: 6 }}>
                  Bledy ({importResult.total_errors}):
                </div>
                <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 11, color: "var(--text-muted)", background: "var(--bg-inset)", borderRadius: 6, padding: 8 }}>
                  {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                  {importResult.total_errors > importResult.errors.length && (
                    <div style={{ fontStyle: "italic" }}>...i {importResult.total_errors - importResult.errors.length} wiecej</div>
                  )}
                </div>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => { setShowImport(false); setImportResult(null); }}>Zamknij</button>
          </div>
        ) : (
          <form onSubmit={handleCsvImport}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Zaladuj plik CSV z aktywami. Wymagana kolumna: <code>name</code>.
              Opcjonalne: <code>owner</code>, <code>description</code>, <code>location</code>.
              Pozostale kolumny beda zapisane jako atrybuty niestandardowe.
              <br /><br />
              Separator: <code>;</code> (srednik) lub <code>,</code> (przecinek).
              {selectedCategory && !selectedCategory.is_abstract && (
                <div style={{ marginTop: 8, padding: "6px 10px", background: "var(--blue-dim)", borderRadius: 6, color: "var(--blue)", fontSize: 12 }}>
                  Importowane aktywa zostana przypisane do kategorii: <strong>{selectedCategory.name}</strong>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Plik CSV</label>
              <input name="csv_file" type="file" accept=".csv" required className="form-control" style={{ padding: 8 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setShowImport(false)}>Anuluj</button>
              <button type="submit" className="btn btn-primary" disabled={importing}>
                {importing ? "Importowanie..." : "Importuj"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════
   Detail: Custom Attributes (read-only)
   ══════════════════════════════════════ */
function DetailCustomAttributes({ assetCategoryId, customAttributes }: {
  assetCategoryId: number | null;
  customAttributes: Record<string, unknown>;
}) {
  const [fields, setFields] = useState<CategoryFieldDefinition[]>([]);

  useEffect(() => {
    if (assetCategoryId) {
      api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${assetCategoryId}/fields`)
        .then(setFields).catch(() => setFields([]));
    } else {
      setFields([]);
    }
  }, [assetCategoryId]);

  if (!assetCategoryId) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Aktyw nie ma przypisanej kategorii CMDB.
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Brak zdefiniowanych atrybutow.
      </div>
    );
  }

  return (
    <DynamicAssetForm fields={fields} values={customAttributes} onChange={() => {}} readOnly />
  );
}

/* ══════════════════════════════════════
   AssetRisksTab: Risk linking section
   ══════════════════════════════════════ */
function AssetRisksTab({ asset, orgTree, onRiskCountChange }: {
  asset: Asset;
  orgTree: OrgUnitTreeNode[];
  onRiskCountChange: (count: number) => void;
}) {
  const [linkedRisks, setLinkedRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "search" | "create" | "link_action">("list");
  const [previewRisk, setPreviewRisk] = useState<Risk | null>(null);

  // Search state
  const [allRisks, setAllRisks] = useState<Risk[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLevel, setSearchLevel] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // Create form state
  const [createSaving, setCreateSaving] = useState(false);
  const [securityAreas, setSecurityAreas] = useState<{ id: number; name: string }[]>([]);
  const [catalogThreats, setCatalogThreats] = useState<Threat[]>([]);
  const [catalogVulns, setCatalogVulns] = useState<Vulnerability[]>([]);
  const [catalogSafeguards, setCatalogSafeguards] = useState<Safeguard[]>([]);
  // Create form controlled state
  const [cW, setCW] = useState(2);
  const [cP, setCP] = useState(2);
  const [cZ, setCZ] = useState(0.25);
  const [cThreatIds, setCThreatIds] = useState<number[]>([]);
  const [cVulnIds, setCVulnIds] = useState<number[]>([]);
  const [cSafeguardIds, setCSafeguardIds] = useState<number[]>([]);
  // Post-creation action linking
  const [createdRiskId, setCreatedRiskId] = useState<number | null>(null);
  const [actionQuery, setActionQuery] = useState("");
  const [actionResults, setActionResults] = useState<Action[]>([]);
  const [actionSearching, setActionSearching] = useState(false);
  const [linkedActionIds, setLinkedActionIds] = useState<number[]>([]);
  const [showNewAction, setShowNewAction] = useState(false);
  const [newActionSaving, setNewActionSaving] = useState(false);

  // Use ref to avoid infinite loop — onRiskCountChange is an inline function from parent
  const countRef = useRef(onRiskCountChange);
  countRef.current = onRiskCountChange;

  // Load linked risks
  const loadLinkedRisks = useCallback(() => {
    setLoading(true);
    api.get<Risk[]>(`/api/v1/risks?include_archived=false`)
      .then(risks => {
        const linked = risks.filter(r => r.asset_id === asset.id);
        setLinkedRisks(linked);
        countRef.current(linked.length);
      })
      .catch(() => setLinkedRisks([]))
      .finally(() => setLoading(false));
  }, [asset.id]);

  useEffect(() => { loadLinkedRisks(); }, [loadLinkedRisks]);

  // Load all risks for search
  const loadAllRisks = useCallback(() => {
    if (allRisks.length > 0) return;
    setSearchLoading(true);
    api.get<Risk[]>("/api/v1/risks?include_archived=false")
      .then(setAllRisks)
      .catch(() => {})
      .finally(() => setSearchLoading(false));
  }, [allRisks.length]);

  // Filtered search results
  const searchResults = useMemo(() => {
    const linkedIds = new Set(linkedRisks.map(r => r.id));
    let filtered = allRisks.filter(r => !linkedIds.has(r.id));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.asset_name.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.owner?.toLowerCase().includes(q) ||
        r.security_area_name?.toLowerCase().includes(q)
      );
    }
    if (searchLevel) {
      filtered = filtered.filter(r => r.risk_level === searchLevel);
    }
    return filtered.slice(0, 20);
  }, [allRisks, linkedRisks, searchQuery, searchLevel]);

  // Link existing risk to this asset
  const handleLinkRisk = async (risk: Risk) => {
    try {
      await api.put(`/api/v1/risks/${risk.id}`, {
        asset_id: asset.id,
        asset_name: asset.name,
      });
      setMode("list");
      setSearchQuery("");
      setSearchLevel("");
      loadLinkedRisks();
      // Refresh search cache
      setAllRisks([]);
    } catch (err) {
      alert("Blad linkowania: " + err);
    }
  };

  // Unlink risk from asset
  const handleUnlinkRisk = async (risk: Risk) => {
    if (!confirm(`Odlacz ryzyko R-${risk.id} od tego aktywa?`)) return;
    try {
      await api.put(`/api/v1/risks/${risk.id}`, {
        asset_id: null,
      });
      loadLinkedRisks();
      setAllRisks([]);
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  // Create new risk linked to this asset
  const handleCreateRisk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      org_unit_id: asset.org_unit_id || Number(fd.get("org_unit_id")) || null,
      asset_id: asset.id,
      asset_name: asset.name,
      security_area_id: Number(fd.get("security_area_id")),
      impact_level: cW,
      probability_level: cP,
      safeguard_rating: cZ,
      consequence_description: (fd.get("consequence_description") as string) || null,
      existing_controls: (fd.get("existing_controls") as string) || null,
      owner: (fd.get("owner") as string) || asset.owner || null,
      threat_ids: cThreatIds,
      vulnerability_ids: cVulnIds,
      safeguard_ids: cSafeguardIds,
    };
    try {
      const created = await api.post<Risk>("/api/v1/risks", body);
      setCreatedRiskId(created.id);
      setMode("link_action");
      loadLinkedRisks();
      setAllRisks([]);
    } catch (err) {
      alert("Blad tworzenia ryzyka: " + err);
    } finally {
      setCreateSaving(false);
    }
  };

  // Action search for post-creation linking
  useEffect(() => {
    if (mode !== "link_action" || actionQuery.length < 2) { setActionResults([]); return; }
    const timer = setTimeout(() => {
      setActionSearching(true);
      api.get<Action[]>("/api/v1/actions")
        .then(all => {
          const q = actionQuery.toLowerCase();
          setActionResults((all ?? []).filter(a =>
            a.title.toLowerCase().includes(q) ||
            (a.owner ?? "").toLowerCase().includes(q)
          ).slice(0, 8));
        })
        .catch(() => {})
        .finally(() => setActionSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [actionQuery, mode]);

  const linkActionToRisk = async (action: Action) => {
    if (!createdRiskId) return;
    try {
      const full = await api.get<Action>(`/api/v1/actions/${action.id}`);
      const links = (full.links ?? []).map(l => ({ entity_type: l.entity_type, entity_id: l.entity_id }));
      links.push({ entity_type: "risk", entity_id: createdRiskId });
      await api.put(`/api/v1/actions/${action.id}`, { links });
      setLinkedActionIds(prev => [...prev, action.id]);
      setActionQuery("");
      setActionResults([]);
    } catch (err) { alert("Blad: " + err); }
  };

  const createAndLinkAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!createdRiskId) return;
    setNewActionSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await api.post<Action>("/api/v1/actions", {
        title: fd.get("title"),
        description: (fd.get("description") as string) || null,
        owner: (fd.get("action_owner") as string) || null,
        due_date: (fd.get("due_date") as string) || null,
        org_unit_id: asset.org_unit_id || null,
        links: [{ entity_type: "risk", entity_id: createdRiskId }],
      });
      setLinkedActionIds(prev => [...prev, created.id]);
      setShowNewAction(false);
    } catch (err) { alert("Blad: " + err); }
    finally { setNewActionSaving(false); }
  };

  const riskLevelColor = (level: string) => {
    if (level === "high") return "var(--red)";
    if (level === "medium") return "var(--orange)";
    return "var(--green)";
  };

  const riskLevelBg = (level: string) => {
    if (level === "high") return "var(--red-dim, rgba(239,68,68,0.15))";
    if (level === "medium") return "var(--orange-dim, rgba(249,115,22,0.15))";
    return "var(--green-dim, rgba(34,197,94,0.15))";
  };

  // Load security areas + catalogs for create form
  const openCreateMode = async () => {
    setMode("create");
    setCW(2); setCP(2); setCZ(0.25);
    setCThreatIds([]); setCVulnIds([]); setCSafeguardIds([]);
    setCreatedRiskId(null); setLinkedActionIds([]); setShowNewAction(false);
    if (securityAreas.length === 0) {
      try {
        const areas = await api.get<{ id: number; name: string }[]>("/api/v1/security-areas");
        setSecurityAreas(areas);
      } catch { /* ignore */ }
    }
    // Load catalogs in parallel
    if (catalogThreats.length === 0) {
      api.get<Threat[]>("/api/v1/threats").then(setCatalogThreats).catch(() => {});
    }
    if (catalogVulns.length === 0) {
      api.get<Vulnerability[]>("/api/v1/vulnerabilities").then(setCatalogVulns).catch(() => {});
    }
    if (catalogSafeguards.length === 0) {
      api.get<Safeguard[]>("/api/v1/safeguards").then(setCatalogSafeguards).catch(() => {});
    }
  };

  // Risk score + color helpers for matrix
  const riskScoreCalc = (w: number, p: number, z: number) => Math.exp(w) * p / z;
  const riskScoreColor = (R: number) => R >= 221 ? "var(--red)" : R >= 31 ? "var(--orange)" : "var(--green)";
  const riskScoreBg = (R: number) => R >= 221 ? "var(--red-dim, rgba(239,68,68,0.15))" : R >= 31 ? "var(--orange-dim, rgba(249,115,22,0.15))" : "var(--green-dim, rgba(34,197,94,0.15))";

  if (loading) {
    return <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Ladowanie ryzyk...</div>;
  }

  // Risk preview sub-view
  if (previewRisk) {
    const r = previewRisk;
    const lvlLabel = r.risk_level === "high" ? "WYSOKI" : r.risk_level === "medium" ? "SREDNI" : "NISKI";
    const rows: [string, string | null | undefined][] = [
      ["Kod", r.code],
      ["Domena bezp.", r.security_area_name],
      ["Kategoria ryzyka", r.risk_category_name],
      ["Jednostka org.", r.org_unit_name],
      ["Wlasciciel", r.owner],
      ["Status", r.status_name],
      ["Strategia", r.strategy_name],
      ["Wplyw (W)", String(r.impact_level)],
      ["Prawdopodobienstwo (P)", String(r.probability_level)],
      ["Zabezpieczenia (Z)", String(r.safeguard_rating)],
      ["Wynik ryzyka", r.risk_score?.toFixed(1)],
      ["Poziom ryzyka", lvlLabel],
      ["Wrazliwosc aktywa", r.sensitivity_name],
      ["Krytycznosc aktywa", r.criticality_name],
      ["Termin postepowania", r.treatment_deadline?.slice(0, 10)],
      ["Ryzyko rezydualne", r.residual_risk != null ? String(r.residual_risk) : null],
      ["Zaakceptowane przez", r.accepted_by],
      ["Data akceptacji", r.accepted_at?.slice(0, 10)],
      ["Zidentyfikowano", r.identified_at?.slice(0, 10)],
      ["Nastepny przeglad", r.next_review_date?.slice(0, 10)],
    ];
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setPreviewRisk(null)}>← Wstecz do listy</button>
        </div>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>R-{r.id}</span>
          <span className="score-badge" style={{ marginLeft: 8, background: riskLevelBg(r.risk_level), color: riskLevelColor(r.risk_level), fontSize: 11 }}>
            {lvlLabel} {r.risk_score?.toFixed(0)}
          </span>
        </div>
        <div style={{ fontSize: 12, lineHeight: 2 }}>
          {rows.map(([label, value]) => value ? (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(42,53,84,0.08)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{label}</span>
              <span style={{ fontWeight: 500, fontSize: 11, textAlign: "right", maxWidth: "60%" }}>{value}</span>
            </div>
          ) : null)}
        </div>
        {r.consequence_description && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Opis konsekwencji</div>
            <div style={{ fontSize: 11, background: "var(--bg-inset)", borderRadius: 6, padding: 8, whiteSpace: "pre-wrap" }}>{r.consequence_description}</div>
          </div>
        )}
        {r.existing_controls && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Istniejace zabezpieczenia</div>
            <div style={{ fontSize: 11, background: "var(--bg-inset)", borderRadius: 6, padding: 8, whiteSpace: "pre-wrap" }}>{r.existing_controls}</div>
          </div>
        )}
        {r.planned_actions && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Planowane dzialania</div>
            <div style={{ fontSize: 11, background: "var(--bg-inset)", borderRadius: 6, padding: 8, whiteSpace: "pre-wrap" }}>{r.planned_actions}</div>
          </div>
        )}
        {r.acceptance_justification && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Uzasadnienie akceptacji</div>
            <div style={{ fontSize: 11, background: "var(--bg-inset)", borderRadius: 6, padding: 8, whiteSpace: "pre-wrap" }}>{r.acceptance_justification}</div>
          </div>
        )}
        {r.threats.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Zagrozenia ({r.threats.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {r.threats.map(t => <span key={t.threat_id} className="score-badge" style={{ fontSize: 10, background: "var(--red-dim, rgba(239,68,68,0.1))", color: "var(--red)" }}>{t.threat_name}</span>)}
            </div>
          </div>
        )}
        {r.vulnerabilities.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Podatnosci ({r.vulnerabilities.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {r.vulnerabilities.map(v => <span key={v.vulnerability_id} className="score-badge" style={{ fontSize: 10, background: "var(--orange-dim, rgba(249,115,22,0.1))", color: "var(--orange)" }}>{v.vulnerability_name}</span>)}
            </div>
          </div>
        )}
        {r.safeguards.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Zabezpieczenia ({r.safeguards.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {r.safeguards.map(sg => <span key={sg.safeguard_id} className="score-badge" style={{ fontSize: 10, background: "var(--green-dim, rgba(34,197,94,0.1))", color: "var(--green)" }}>{sg.safeguard_name}</span>)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <button className="btn btn-sm" style={{ flex: 1, color: "var(--red)" }} onClick={() => { setPreviewRisk(null); handleUnlinkRisk(r); }}>
            Odlacz ryzyko
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Mode: List linked risks */}
      {mode === "list" && (
        <>
          {linkedRisks.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Brak powiazanych ryzyk dla tego aktywa.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {linkedRisks.map(risk => (
                <div key={risk.id} style={{
                  padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border)", fontSize: 12, transition: "border-color 0.2s",
                }}
                  onClick={() => setPreviewRisk(risk)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--blue)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>R-{risk.id}</span>
                      <span className="score-badge" style={{
                        background: riskLevelBg(risk.risk_level),
                        color: riskLevelColor(risk.risk_level), fontSize: 10,
                      }}>
                        {risk.risk_level === "high" ? "WYSOKI" : risk.risk_level === "medium" ? "SREDNI" : "NISKI"}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 11, color: riskLevelColor(risk.risk_level) }}>
                        {risk.risk_score?.toFixed(0)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnlinkRisk(risk); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 12, padding: "0 2px", opacity: 0.5 }}
                      title="Odlacz ryzyko"
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{risk.security_area_name}</div>
                      {risk.status_name && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Status: {risk.status_name}</span>}
                    </div>
                    <div style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)" }}>
                      {risk.owner && <div>{risk.owner}</div>}
                      <div>W={risk.impact_level} P={risk.probability_level}</div>
                    </div>
                  </div>
                  {risk.consequence_description && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
                      {risk.consequence_description.length > 80 ? risk.consequence_description.slice(0, 80) + "..." : risk.consequence_description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => { setMode("search"); loadAllRisks(); }}>
              Polacz istniejace ryzyko
            </button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={openCreateMode}>
              + Nowe ryzyko
            </button>
          </div>
        </>
      )}

      {/* Mode: Search & link existing risk */}
      {mode === "search" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Wyszukaj ryzyko do polaczenia</div>
            <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => { setMode("list"); setSearchQuery(""); setSearchLevel(""); }}>Wstecz</button>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              className="form-control"
              placeholder="Szukaj po nazwie, kodzie, wlascicielu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: 12, flex: 1 }}
              autoFocus
            />
            <select
              className="form-control"
              value={searchLevel}
              onChange={e => setSearchLevel(e.target.value)}
              style={{ fontSize: 12, width: 100 }}
            >
              <option value="">Poziom</option>
              <option value="high">Wysoki</option>
              <option value="medium">Sredni</option>
              <option value="low">Niski</option>
            </select>
          </div>

          {searchLoading ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Ladowanie ryzyk...</div>
          ) : searchResults.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              {searchQuery || searchLevel ? "Brak ryzyk pasujacych do filtrow." : "Wpisz fraze aby wyszukac..."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
              {searchResults.map(risk => (
                <div
                  key={risk.id}
                  style={{
                    padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                    background: "var(--bg-inset)",
                    border: "1px solid var(--border)", fontSize: 12,
                    transition: "border-color 0.2s",
                  }}
                  onClick={() => handleLinkRisk(risk)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--blue)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>R-{risk.id}</span>
                      <span className="score-badge" style={{
                        background: riskLevelBg(risk.risk_level),
                        color: riskLevelColor(risk.risk_level), fontSize: 9,
                      }}>
                        {risk.risk_level === "high" ? "WYS" : risk.risk_level === "medium" ? "SRE" : "NIS"} {risk.risk_score?.toFixed(0)}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--blue)" }}>+ Polacz</span>
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 11, marginTop: 2 }}>{risk.asset_name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    <span>{risk.security_area_name}</span>
                    <span>{risk.owner || "brak wlasciciela"}</span>
                  </div>
                  {risk.asset_id_name && risk.asset_id !== asset.id && (
                    <div style={{ fontSize: 10, color: "var(--orange)", marginTop: 2 }}>
                      Aktualnie powiazane z: {risk.asset_id_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode: Create new risk (enhanced) */}
      {mode === "create" && (() => {
        const liveScore = riskScoreCalc(cW, cP, cZ);
        const lvColor = riskScoreColor(liveScore);
        const lvLabel = liveScore >= 221 ? "WYSOKI" : liveScore >= 31 ? "SREDNI" : "NISKI";
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Nowe ryzyko dla: {asset.name}</div>
              <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setMode("list")}>Wstecz</button>
            </div>

            {/* Live score preview */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: lvColor }}>{liveScore.toFixed(1)}</span>
              <span className="score-badge" style={{ background: `${lvColor}30`, color: lvColor, fontSize: 11, marginLeft: 8 }}>{lvLabel}</span>
            </div>

            {/* Risk matrix (W x P) + Z selector */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 14 }}>
              {/* 3x3 matrix */}
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Macierz ryzyka (W &times; P)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto repeat(3, 1fr)", gap: 2, maxWidth: 220 }}>
                  <div />
                  {["P=1", "P=2", "P=3"].map(h => (
                    <div key={h} style={{ textAlign: "center", fontSize: 9, color: "var(--text-muted)", padding: 3 }}>{h}</div>
                  ))}
                  {[3, 2, 1].map(w => (
                    <div key={`row-${w}`} style={{ display: "contents" }}>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", padding: 3, display: "flex", alignItems: "center" }}>W={w}</div>
                      {[1, 2, 3].map(p => {
                        const score = riskScoreCalc(w, p, cZ);
                        const isActive = w === cW && p === cP;
                        return (
                          <div
                            key={`${w}-${p}`}
                            style={{
                              textAlign: "center", padding: 5, borderRadius: 4, fontSize: 9,
                              fontFamily: "'JetBrains Mono',monospace", fontWeight: isActive ? 700 : 400,
                              background: riskScoreBg(score), color: riskScoreColor(score),
                              border: isActive ? `2px solid ${riskScoreColor(score)}` : "2px solid transparent",
                              cursor: "pointer", transition: "all 0.15s",
                            }}
                            onClick={() => { setCW(w); setCP(p); }}
                          >
                            {score.toFixed(0)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", marginTop: 3 }}>
                  Kliknij komorke aby wybrac W i P
                </div>
              </div>

              {/* Z level selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", marginBottom: 2 }}>
                  Ocena zabezpieczen (Z)
                </div>
                {([
                  { value: 0.10, label: "Brak zabezpieczen", color: "var(--red)" },
                  { value: 0.25, label: "Czesciowe", color: "var(--orange)" },
                  { value: 0.70, label: "Dobra jakosc", color: "var(--blue)" },
                  { value: 0.95, label: "Skuteczne, testowane", color: "var(--green)" },
                ] as const).map(zl => {
                  const isActive = Math.abs(cZ - zl.value) < 0.01;
                  return (
                    <div
                      key={zl.value}
                      style={{
                        padding: "4px 8px", borderRadius: 5, fontSize: 10, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                        background: isActive ? `${zl.color}18` : "transparent",
                        border: isActive ? `2px solid ${zl.color}` : "2px solid var(--border)",
                        color: isActive ? zl.color : "var(--text-muted)",
                        fontWeight: isActive ? 600 : 400, transition: "all 0.15s",
                      }}
                      onClick={() => setCZ(zl.value)}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? zl.color : "var(--border)", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", minWidth: 28, fontSize: 10 }}>{zl.value.toFixed(2)}</span>
                      <span style={{ fontSize: 10 }}>{zl.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleCreateRisk}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Domena bezpieczenstwa *</label>
                  <select name="security_area_id" className="form-control" required style={{ fontSize: 12 }}>
                    <option value="">Wybierz...</option>
                    {securityAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                {!asset.org_unit_id && (
                  <div className="form-group">
                    <label style={{ fontSize: 11 }}>Jednostka organizacyjna *</label>
                    <select name="org_unit_id" className="form-control" required style={{ fontSize: 12 }}>
                      <option value="">Wybierz...</option>
                      {(() => {
                        const flat: { id: number; name: string; depth: number }[] = [];
                        const walk = (nodes: OrgUnitTreeNode[], d: number) => {
                          for (const n of nodes) { flat.push({ id: n.id, name: n.name, depth: d }); walk(n.children, d + 1); }
                        };
                        walk(orgTree, 0);
                        return flat.map(u => (
                          <option key={u.id} value={u.id}>{"\u00A0\u00A0".repeat(u.depth)}{u.name}</option>
                        ));
                      })()}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Wlasciciel ryzyka</label>
                  <input name="owner" className="form-control" defaultValue={asset.owner || ""} style={{ fontSize: 12 }} placeholder="np. Jan Kowalski" />
                </div>

                {/* Threats TagMultiSelect */}
                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Zagrozenia</label>
                  {cThreatIds.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                      {cThreatIds.map(id => {
                        const t = catalogThreats.find(x => x.id === id);
                        return (
                          <span key={id} style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            background: "var(--red-dim, rgba(239,68,68,0.1))", color: "var(--red)",
                            border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12,
                            padding: "2px 8px", fontSize: 10, fontWeight: 500,
                          }}>
                            {t?.name ?? `#${id}`}
                            <span style={{ cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                              onClick={() => setCThreatIds(prev => prev.filter(x => x !== id))}>&times;</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <select
                    className="form-control" style={{ fontSize: 11 }}
                    value="" onChange={e => { const v = Number(e.target.value); if (v && !cThreatIds.includes(v)) setCThreatIds(prev => [...prev, v]); }}
                  >
                    <option value="">+ Dodaj zagrozenie...</option>
                    {catalogThreats.filter(t => !cThreatIds.includes(t.id)).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Vulnerabilities TagMultiSelect */}
                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Podatnosci</label>
                  {cVulnIds.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                      {cVulnIds.map(id => {
                        const v = catalogVulns.find(x => x.id === id);
                        return (
                          <span key={id} style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            background: "var(--orange-dim, rgba(249,115,22,0.1))", color: "var(--orange)",
                            border: "1px solid rgba(249,115,22,0.3)", borderRadius: 12,
                            padding: "2px 8px", fontSize: 10, fontWeight: 500,
                          }}>
                            {v?.name ?? `#${id}`}
                            <span style={{ cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                              onClick={() => setCVulnIds(prev => prev.filter(x => x !== id))}>&times;</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <select
                    className="form-control" style={{ fontSize: 11 }}
                    value="" onChange={e => { const v = Number(e.target.value); if (v && !cVulnIds.includes(v)) setCVulnIds(prev => [...prev, v]); }}
                  >
                    <option value="">+ Dodaj podatnosc...</option>
                    {catalogVulns.filter(v => !cVulnIds.includes(v.id)).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Safeguards TagMultiSelect */}
                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Zabezpieczenia (katalog)</label>
                  {cSafeguardIds.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                      {cSafeguardIds.map(id => {
                        const s = catalogSafeguards.find(x => x.id === id);
                        return (
                          <span key={id} style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            background: "var(--green-dim, rgba(34,197,94,0.1))", color: "var(--green)",
                            border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12,
                            padding: "2px 8px", fontSize: 10, fontWeight: 500,
                          }}>
                            {s?.name ?? `#${id}`}
                            <span style={{ cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                              onClick={() => setCSafeguardIds(prev => prev.filter(x => x !== id))}>&times;</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <select
                    className="form-control" style={{ fontSize: 11 }}
                    value="" onChange={e => { const v = Number(e.target.value); if (v && !cSafeguardIds.includes(v)) setCSafeguardIds(prev => [...prev, v]); }}
                  >
                    <option value="">+ Dodaj zabezpieczenie...</option>
                    {catalogSafeguards.filter(s => !cSafeguardIds.includes(s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Opis konsekwencji</label>
                  <textarea name="consequence_description" className="form-control" rows={2} style={{ fontSize: 12 }} placeholder="Co moze sie stac w przypadku materializacji ryzyka?" />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Istniejace zabezpieczenia (opis)</label>
                  <textarea name="existing_controls" className="form-control" rows={2} style={{ fontSize: 12 }} placeholder="Jakie zabezpieczenia juz istnieja?" />
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit" className="btn btn-sm btn-primary" style={{ flex: 1 }} disabled={createSaving}>
                    {createSaving ? "Tworzenie..." : "Utworz ryzyko i polacz"}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setMode("list")}>Anuluj</button>
                </div>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Mode: Post-creation — link mitigating actions */}
      {mode === "link_action" && createdRiskId && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>&#10003;</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>Ryzyko R-{createdRiskId} utworzone!</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Dodaj dzialanie mitygujace lub wroc do listy ryzyk.
            </div>
          </div>

          {/* Linked actions list */}
          {linkedActionIds.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Powiazane dzialania ({linkedActionIds.length})</div>
              {linkedActionIds.map(aid => (
                <div key={aid} style={{
                  padding: "4px 8px", background: "rgba(59,130,246,0.06)", borderRadius: 4, marginBottom: 3,
                  fontSize: 11, display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ color: "var(--blue)" }}>A-{aid}</span>
                  <span style={{ color: "var(--green)", fontSize: 10 }}>&#10003; powiazane</span>
                </div>
              ))}
            </div>
          )}

          {/* Search existing action */}
          {!showNewAction && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    className="form-control"
                    style={{ fontSize: 12 }}
                    placeholder="Szukaj istniejacego dzialania po tytule..."
                    value={actionQuery}
                    onChange={e => setActionQuery(e.target.value)}
                  />
                  {actionSearching && <span style={{ position: "absolute", right: 8, top: 8, fontSize: 10, color: "var(--text-muted)" }}>...</span>}
                  {actionResults.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
                      maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}>
                      {actionResults.map(a => (
                        <div key={a.id} style={{
                          padding: "7px 10px", cursor: "pointer", fontSize: 11,
                          borderBottom: "1px solid var(--border)",
                          opacity: linkedActionIds.includes(a.id) ? 0.4 : 1,
                        }}
                          onClick={() => !linkedActionIds.includes(a.id) && linkActionToRisk(a)}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ fontWeight: 500 }}>{a.title}</div>
                          <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
                            {a.owner && <span>{a.owner}</span>}
                            {a.status_name && <span> | {a.status_name}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-sm btn-primary" style={{ fontSize: 11, whiteSpace: "nowrap" }}
                  onClick={() => { setShowNewAction(true); setActionQuery(""); setActionResults([]); }}>
                  + Nowe
                </button>
              </div>
            </div>
          )}

          {/* Inline new action form */}
          {showNewAction && (
            <form onSubmit={createAndLinkAction} style={{
              background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 8, padding: 12, marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: "var(--blue)" }}>Nowe dzialanie</span>
                <button type="button" className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setShowNewAction(false)}>Anuluj</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Tytul dzialania *</label>
                  <input name="title" className="form-control" required style={{ fontSize: 12 }} placeholder="np. Wdrozenie MFA" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="form-group">
                    <label style={{ fontSize: 11 }}>Wlasciciel</label>
                    <input name="action_owner" className="form-control" style={{ fontSize: 12 }} placeholder="np. Jan Kowalski" />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 11 }}>Termin</label>
                    <input type="date" name="due_date" className="form-control" style={{ fontSize: 12 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11 }}>Opis</label>
                  <textarea name="description" className="form-control" rows={2} style={{ fontSize: 12 }} placeholder="Opis dzialania..." />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setShowNewAction(false)}>Anuluj</button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={newActionSaving}>
                  {newActionSaving ? "Tworzenie..." : "Utworz i powiaz"}
                </button>
              </div>
            </form>
          )}

          <button type="button" className="btn btn-sm" style={{ width: "100%", marginTop: 6 }}
            onClick={() => { setMode("list"); setCreatedRiskId(null); }}>
            Zakoncz — wroc do listy ryzyk
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   EgoGraph: Simple relationship graph for a single asset
   ══════════════════════════════════════ */
function EgoGraph({ assetId, assetName }: { assetId: number; assetName: string }) {
  const [relations, setRelations] = useState<AssetRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<AssetRelationship[]>(`/api/v1/assets/${assetId}/relationships`)
      .then(setRelations)
      .catch(() => setRelations([]))
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie grafu...</div>;
  }

  if (relations.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <div>Ten aktyw nie ma zdefiniowanych relacji.</div>
      </div>
    );
  }

  // Build unique connected assets
  const connectedAssets = new Map<number, { name: string; relations: { type: string; direction: "out" | "in"; description: string | null }[] }>();
  for (const rel of relations) {
    const isSource = rel.source_asset_id === assetId;
    const otherId = isSource ? rel.target_asset_id : rel.source_asset_id;
    const otherName = isSource ? (rel.target_asset_name || `Asset #${otherId}`) : (rel.source_asset_name || `Asset #${otherId}`);
    if (!connectedAssets.has(otherId)) {
      connectedAssets.set(otherId, { name: otherName, relations: [] });
    }
    connectedAssets.get(otherId)!.relations.push({
      type: rel.relationship_type,
      direction: isSource ? "out" : "in",
      description: rel.description,
    });
  }

  const REL_COLORS: Record<string, string> = {
    depends_on: "#F59E0B", supports: "#3B82F6", connects_to: "#8B5CF6",
    contains: "#10B981", backup_of: "#06B6D4", replaces: "#EF4444",
    runs_on: "#F97316", managed_by: "#6366F1", used_by: "#EC4899", hosted_on: "#14B8A6",
  };

  // Simple radial layout visualization
  const connected = [...connectedAssets.entries()];
  const cx = 300, cy = 200, radius = 150;

  return (
    <div>
      <svg width="100%" viewBox="0 0 600 400" style={{ background: "rgba(0,0,0,0.1)", borderRadius: 8 }}>
        {/* Center node */}
        <circle cx={cx} cy={cy} r={32} fill="var(--blue)" opacity={0.9} />
        <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={11} fontWeight={600}>
          {assetName.length > 12 ? assetName.slice(0, 12) + "..." : assetName}
        </text>

        {/* Connected nodes */}
        {connected.map(([id, data], i) => {
          const angle = (2 * Math.PI * i) / connected.length - Math.PI / 2;
          const nx = cx + radius * Math.cos(angle);
          const ny = cy + radius * Math.sin(angle);
          const relColor = REL_COLORS[data.relations[0]?.type] || "#666";

          return (
            <g key={id}>
              {/* Edge */}
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={relColor} strokeWidth={2} opacity={0.6} />
              {/* Rel type label */}
              <text
                x={(cx + nx) / 2}
                y={(cy + ny) / 2 - 6}
                textAnchor="middle"
                fill={relColor}
                fontSize={9}
                fontWeight={500}
              >
                {data.relations[0]?.type}
              </text>
              {/* Arrow */}
              {data.relations[0]?.direction === "out" && (
                <circle cx={nx - (nx - cx) * 0.15} cy={ny - (ny - cy) * 0.15} r={3} fill={relColor} />
              )}
              {/* Node */}
              <circle cx={nx} cy={ny} r={26} fill="var(--bg-card)" stroke={relColor} strokeWidth={2} />
              <text x={nx} y={ny + 4} textAnchor="middle" fill="var(--text-primary)" fontSize={10}>
                {data.name.length > 14 ? data.name.slice(0, 14) + "..." : data.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" }}>
        {[...new Set(relations.map(r => r.relationship_type))].map(type => (
          <span key={type} style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 8,
            background: (REL_COLORS[type] || "#666") + "20",
            color: REL_COLORS[type] || "#666",
          }}>
            {type}
          </span>
        ))}
      </div>

      {/* Relation list */}
      <div style={{ marginTop: 16, maxHeight: 200, overflowY: "auto" }}>
        {relations.map(rel => {
          const isSource = rel.source_asset_id === assetId;
          return (
            <div key={rel.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", fontSize: 12,
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: REL_COLORS[rel.relationship_type] || "#666",
              }} />
              <span style={{ color: "var(--text-muted)", minWidth: 80 }}>{rel.relationship_type}</span>
              <span>{isSource ? "→" : "←"}</span>
              <span style={{ fontWeight: 500 }}>{isSource ? rel.target_asset_name : rel.source_asset_name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
