import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Asset, OrgUnitTreeNode, DictionaryTypeWithEntries } from "../types";
import { buildPathMap } from "../utils/orgTree";
import Modal from "../components/Modal";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards from "../components/StatsCards";

/* Exception reference for asset detail */
interface AssetExceptionRef {
  id: number;
  ref_id: string | null;
  title: string;
  status_name: string | null;
  risk_score: number | null;
  risk_level: string | null;
  expiry_date: string;
}

function excRiskColor(R: number) { return R >= 221 ? "var(--red)" : R >= 31 ? "var(--orange)" : "var(--green)"; }
function excRiskBg(R: number) { return R >= 221 ? "var(--red-dim)" : R >= 31 ? "var(--orange-dim)" : "var(--green-dim)"; }

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
  assetTypes: { id: number; label: string }[];
  categories: { id: number; label: string }[];
  sensitivities: { id: number; label: string }[];
  criticalities: { id: number; label: string }[];
}

export default function AssetRegistryPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);

  const [detailTab, setDetailTab] = useState<"info" | "exceptions">("info");
  const [assetExceptions, setAssetExceptions] = useState<AssetExceptionRef[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);

  const [showFilters, setShowFilters] = useState(false);

  const COLUMNS: ColumnDef<Asset>[] = [
    { key: "id", header: "ID" },
    { key: "name", header: "Nazwa" },
    { key: "asset_type_name", header: "Typ", format: r => r.asset_type_name ?? "" },
    { key: "category_name", header: "Kategoria", format: r => r.category_name ?? "" },
    { key: "org_unit_name", header: "Jednostka org.", format: r => r.org_unit_name ?? "" },
    { key: "owner", header: "Właściciel", format: r => r.owner ?? "" },
    { key: "criticality_name", header: "Krytyczność", format: r => r.criticality_name ?? "" },
    { key: "risk_count", header: "Ryzyka", format: r => String(r.risk_count) },
    { key: "sensitivity_name", header: "Wrażliwość", format: r => r.sensitivity_name ?? "", defaultVisible: false },
    { key: "parent_name", header: "Nadrzędne aktywo", format: r => r.parent_name ?? "", defaultVisible: false },
    { key: "location", header: "Lokalizacja", format: r => r.location ?? "", defaultVisible: false },
    { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
    { key: "updated_at", header: "Aktualizacja", format: r => r.updated_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "assets");

  const table = useTableFeatures<Asset>({
    data: assets,
    storageKey: "assets",
    defaultSort: "name",
  });

  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);

  const loadAssets = () => {
    api.get<Asset[]>("/api/v1/assets").then(data => {
      setAssets(data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssets();
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
  }, []);

  const orgPathMap = useMemo(() => buildPathMap(orgTree), [orgTree]);

  // Load exceptions for selected asset
  const loadAssetExceptions = useCallback((assetId: number) => {
    setExceptionsLoading(true);
    api.get<AssetExceptionRef[]>(`/api/v1/exceptions?asset_id=${assetId}`)
      .then(setAssetExceptions)
      .catch(() => setAssetExceptions([]))
      .finally(() => setExceptionsLoading(false));
  }, []);

  useEffect(() => {
    if (selected) {
      loadAssetExceptions(selected.id);
      setDetailTab("info");
    } else {
      setAssetExceptions([]);
    }
  }, [selected?.id]);

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
    const [assetTypes, categories, sensitivities, criticalities] = await Promise.all([
      dictEntries("asset_type"), dictEntries("asset_category"),
      dictEntries("sensitivity"), dictEntries("criticality"),
    ]);
    const result = { orgUnits, assets: allAssets, assetTypes, categories, sensitivities, criticalities };
    setLookups(result);
    return result;
  };

  const openAddForm = async () => {
    await loadLookups();
    setEditAsset(null);
    setShowForm(true);
  };

  const openEditForm = async (asset: Asset) => {
    await loadLookups();
    setEditAsset(asset);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: fd.get("name") as string,
      asset_type_id: fd.get("asset_type_id") ? Number(fd.get("asset_type_id")) : null,
      category_id: fd.get("category_id") ? Number(fd.get("category_id")) : null,
      org_unit_id: fd.get("org_unit_id") ? Number(fd.get("org_unit_id")) : null,
      parent_id: fd.get("parent_id") ? Number(fd.get("parent_id")) : null,
      owner: (fd.get("owner") as string) || null,
      description: (fd.get("description") as string) || null,
      location: (fd.get("location") as string) || null,
      sensitivity_id: fd.get("sensitivity_id") ? Number(fd.get("sensitivity_id")) : null,
      criticality_id: fd.get("criticality_id") ? Number(fd.get("criticality_id")) : null,
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
      setLoading(true);
      loadAssets();
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (asset: Asset) => {
    if (!confirm(`Archiwizować aktyw "${asset.name}"?`)) return;
    try {
      await api.delete(`/api/v1/assets/${asset.id}`);
      setSelected(null);
      setLoading(true);
      loadAssets();
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  const uniqueTypes = [...new Map(assets.filter(a => a.asset_type_id).map(a => [a.asset_type_id, { id: a.asset_type_id!, name: a.asset_type_name! }])).values()];
  const uniqueOrgs = [...new Map(assets.filter(a => a.org_unit_id).map(a => [a.org_unit_id, { id: a.org_unit_id!, name: a.org_unit_name! }])).values()];

  return (
    <div>
      {/* KPI Summary */}
      <StatsCards
        cards={[
          { label: "Aktywnych aktywów", value: table.filtered.filter(a => a.is_active).length, total: assets.filter(a => a.is_active).length, color: "var(--blue)" },
          { label: "Z przypisanymi ryzykami", value: table.filtered.filter(a => a.risk_count > 0).length, total: assets.filter(a => a.risk_count > 0).length, color: "var(--orange)" },
          { label: "Typów aktywów", value: new Set(table.filtered.filter(a => a.asset_type_id).map(a => a.asset_type_id)).size, total: uniqueTypes.length, color: "var(--purple)" },
          { label: "Jednostek organizacyjnych", value: new Set(table.filtered.filter(a => a.org_unit_id).map(a => a.org_unit_id)).size, total: uniqueOrgs.length, color: "var(--cyan)" },
        ]}
        isFiltered={table.filteredCount !== table.totalCount}
      />

      <TableToolbar
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="aktywów"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj aktywów..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="aktywa"
        primaryLabel="Dodaj aktyw"
        onPrimaryAction={openAddForm}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 14 }}>
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
          loading={loading}
          emptyMessage="Brak aktywów w systemie."
          emptyFilteredMessage="Brak aktywów pasujących do filtrów."
          renderCell={(a, key) => {
            if (key === "id") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{a.id}</span>;
            if (key === "name") return <span style={{ fontWeight: 500 }}>{a.name}</span>;
            if (key === "asset_type_name") return a.asset_type_name ? <span className="score-badge" style={{ background: "var(--purple-dim)", color: "var(--purple)" }}>{a.asset_type_name}</span> : "\u2014";
            if (key === "category_name") return a.category_name ? <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{a.category_name}</span> : "\u2014";
            if (key === "org_unit_name") return <span style={{ fontSize: 11 }}>{(a.org_unit_id ? orgPathMap.get(a.org_unit_id) : null) ?? a.org_unit_name ?? "\u2014"}</span>;
            if (key === "criticality_name") return a.criticality_name ? <span className="score-badge" style={{ background: critColor(a.criticality_name) === "var(--red)" ? "var(--red-dim)" : critColor(a.criticality_name) === "var(--orange)" ? "var(--orange-dim)" : "var(--green-dim)", color: critColor(a.criticality_name) }}>{a.criticality_name}</span> : "\u2014";
            return undefined;
          }}
        />

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegóły aktywa</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{selected.name}</div>
              {selected.asset_type_name && (
                <span className="score-badge" style={{ background: "var(--purple-dim)", color: "var(--purple)", fontSize: 12, marginTop: 6 }}>
                  {selected.asset_type_name}
                </span>
              )}
            </div>

            {/* Detail tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 14 }}>
              {[
                { key: "info" as const, label: "Informacje" },
                { key: "exceptions" as const, label: `Wyjatki (${assetExceptions.length})` },
              ].map(t => (
                <div
                  key={t.key}
                  style={{
                    flex: 1, textAlign: "center", padding: "6px 10px",
                    background: detailTab === t.key ? "var(--blue-dim)" : "transparent",
                    borderBottom: detailTab === t.key ? "2px solid var(--blue)" : "2px solid var(--border)",
                    color: detailTab === t.key ? "var(--blue)" : "var(--text-muted)",
                    fontWeight: detailTab === t.key ? 600 : 400,
                    fontSize: 12, cursor: "pointer", transition: "all 0.2s",
                  }}
                  onClick={() => setDetailTab(t.key)}
                >
                  {t.label}
                </div>
              ))}
            </div>

            {/* Tab: Info */}
            {detailTab === "info" && (
              <>
                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>ID</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>A-{selected.id}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Kategoria</span>
                    <span>{selected.category_name ?? "\u2014"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Jednostka org.</span>
                    <span style={{ fontSize: 11 }}>{(selected.org_unit_id ? orgPathMap.get(selected.org_unit_id) : null) ?? selected.org_unit_name ?? "\u2014"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Wlasciciel</span>
                    <span>{selected.owner ?? "\u2014"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Lokalizacja</span>
                    <span>{selected.location ?? "\u2014"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Wrazliwosc</span>
                    <span>{selected.sensitivity_name ?? "\u2014"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Krytycznosc</span>
                    <span style={{ fontWeight: 500, color: critColor(selected.criticality_name) }}>{selected.criticality_name ?? "\u2014"}</span>
                  </div>
                  {selected.parent_name && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Nadrzedny aktyw</span>
                      <span>{selected.parent_name}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Powiazane ryzyka</span>
                    <span
                      style={{ fontFamily: "'JetBrains Mono',monospace", color: selected.risk_count > 0 ? "var(--red)" : "var(--text-muted)", cursor: selected.risk_count > 0 ? "pointer" : "default" }}
                      onClick={() => { if (selected.risk_count > 0) navigate(`/risks?asset=${selected.id}`); }}
                    >
                      {selected.risk_count}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Utworzono</span>
                    <span>{selected.created_at?.slice(0, 10)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Zaktualizowano</span>
                    <span>{selected.updated_at?.slice(0, 10)}</span>
                  </div>
                  {selected.description && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Opis</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset)", borderRadius: 6, padding: 8 }}>
                        {selected.description}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Tab: Exceptions */}
            {detailTab === "exceptions" && (
              <div>
                {exceptionsLoading ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Ladowanie wyjatkow...</div>
                ) : assetExceptions.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                    Brak zarejestrowanych wyjatkow dla tego aktywa.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {assetExceptions.map(ex => {
                      const rs = ex.risk_score ?? 0;
                      const isExpired = ex.expiry_date ? new Date(ex.expiry_date) < new Date() : false;
                      return (
                        <div
                          key={ex.id}
                          style={{
                            padding: "10px 12px", borderRadius: 8,
                            background: "var(--bg-inset)",
                            border: "1px solid var(--border)",
                            borderLeft: ex.risk_score != null ? `3px solid ${excRiskColor(rs)}` : "3px solid var(--border)",
                            cursor: "pointer",
                          }}
                          onClick={() => navigate(`/exceptions?highlight=${ex.id}`)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>{ex.ref_id}</span>
                            {ex.status_name && (
                              <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)", fontSize: 10 }}>
                                {ex.status_name}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{ex.title}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            {ex.risk_score != null ? (
                              <span className="score-badge" style={{ background: excRiskBg(rs), color: excRiskColor(rs), fontSize: 10 }}>
                                R: {rs.toFixed(1)}
                              </span>
                            ) : (
                              <span />
                            )}
                            <span style={{
                              color: isExpired ? "var(--red)" : "var(--text-muted)",
                              fontWeight: isExpired ? 600 : 400,
                            }}>
                              {isExpired ? "WYGASLY" : `do ${ex.expiry_date}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => openEditForm(selected)}>Edytuj</button>
              <button className="btn btn-sm" style={{ flex: 1, color: "var(--red)" }} onClick={() => handleArchive(selected)}>Archiwizuj</button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditAsset(null); }} title={editAsset ? `Edytuj aktyw: ${editAsset.name}` : "Dodaj aktyw"} wide>
        {lookups ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>Nazwa aktywa *</label>
                <input name="name" className="form-control" required defaultValue={editAsset?.name ?? ""} placeholder="np. Serwer bazodanowy DB-01" />
              </div>
              <div className="form-group">
                <label>Typ aktywa</label>
                <select name="asset_type_id" className="form-control" defaultValue={editAsset?.asset_type_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {lookups.assetTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Kategoria</label>
                <select name="category_id" className="form-control" defaultValue={editAsset?.category_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {lookups.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
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
                <label>Nadrzędny aktyw</label>
                <select name="parent_id" className="form-control" defaultValue={editAsset?.parent_id ?? ""}>
                  <option value="">Brak (główny)</option>
                  {lookups.assets.filter(a => !editAsset || a.id !== editAsset.id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Właściciel</label>
                <input name="owner" className="form-control" defaultValue={editAsset?.owner ?? ""} placeholder="np. Jan Kowalski" />
              </div>
              <div className="form-group">
                <label>Lokalizacja</label>
                <input name="location" className="form-control" defaultValue={editAsset?.location ?? ""} placeholder="np. Serwerownia DC-1" />
              </div>
              <div className="form-group">
                <label>Wrażliwość</label>
                <select name="sensitivity_id" className="form-control" defaultValue={editAsset?.sensitivity_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {lookups.sensitivities.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Krytyczność</label>
                <select name="criticality_id" className="form-control" defaultValue={editAsset?.criticality_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {lookups.criticalities.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>Opis</label>
                <textarea name="description" className="form-control" rows={3} defaultValue={editAsset?.description ?? ""} placeholder="Opcjonalny opis aktywa..." />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setEditAsset(null); }}>Anuluj</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Zapisywanie..." : editAsset ? "Zapisz zmiany" : "Dodaj aktyw"}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ładowanie danych formularza...</div>
        )}
      </Modal>
    </div>
  );
}
