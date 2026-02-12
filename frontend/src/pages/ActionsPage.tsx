import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import type { Action, OrgUnitTreeNode, DictionaryTypeWithEntries, Risk, Asset } from "../types";
import { buildPathMap, collectDescendantIds } from "../utils/orgTree";
import Modal from "../components/Modal";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

function priorityColor(name: string | null): string {
  if (!name) return "var(--text-muted)";
  const l = name.toLowerCase();
  if (l.includes("krytycz") || l.includes("critical")) return "var(--red)";
  if (l.includes("wysok") || l.includes("high")) return "var(--orange)";
  if (l.includes("średni") || l.includes("medium")) return "var(--blue)";
  return "var(--green)";
}

function statusColor(name: string | null): string {
  if (!name) return "var(--text-muted)";
  const l = name.toLowerCase();
  if (l.includes("zamkn") || l.includes("complet") || l.includes("wykonan")) return "var(--green)";
  if (l.includes("w trakcie") || l.includes("progress") || l.includes("realizac")) return "var(--blue)";
  if (l.includes("anulowa") || l.includes("cancel")) return "var(--text-muted)";
  return "var(--orange)";
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface FormLookups {
  orgUnits: OrgUnitTreeNode[];
  priorities: { id: number; label: string }[];
  statuses: { id: number; label: string }[];
  sources: { id: number; label: string }[];
  risks: { id: number; label: string }[];
  assets: { id: number; label: string }[];
}

const COLUMNS: ColumnDef<Action>[] = [
  { key: "id", header: "ID", format: r => `D-${r.id}` },
  { key: "title", header: "Tytuł" },
  { key: "org_unit_name", header: "Pion", format: r => r.org_unit_name ?? "" },
  { key: "priority_name", header: "Priorytet", format: r => r.priority_name ?? "" },
  { key: "status_name", header: "Status", format: r => r.status_name ?? "" },
  { key: "due_date", header: "Termin", format: r => r.due_date?.slice(0, 10) ?? "" },
  { key: "responsible", header: "Odpowiedzialny", format: r => r.responsible ?? r.owner ?? "" },
  { key: "links", header: "Powiązania", format: r => String(r.links.length), defaultVisible: true },
  { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
  { key: "owner", header: "Właściciel", format: r => r.owner ?? "", defaultVisible: false },
  { key: "source_name", header: "Źródło", format: r => r.source_name ?? "", defaultVisible: false },
  { key: "completed_at", header: "Ukończono", format: r => r.completed_at?.slice(0, 10) ?? "", defaultVisible: false },
  { key: "effectiveness_rating", header: "Ocena skuteczności", format: r => r.effectiveness_rating != null ? String(r.effectiveness_rating) : "", defaultVisible: false },
  { key: "is_overdue", header: "Przeterminowane", format: r => r.is_overdue ? "TAK" : "NIE", defaultVisible: false },
  { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  { key: "updated_at", header: "Aktualizacja", format: r => r.updated_at?.slice(0, 10) ?? "", defaultVisible: false },
];

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAction, setEditAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [selected, setSelected] = useState<Action | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [closingAction, setClosingAction] = useState<Action | null>(null);

  const [showFilters, setShowFilters] = useState(false);

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "actions");

  const table = useTableFeatures<Action>({
    data: actions,
    storageKey: "actions",
    defaultSort: "due_date",
    defaultSortDir: "asc",
  });

  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);

  const loadActions = () => {
    api.get<Action[]>("/api/v1/actions").then(data => {
      setActions(data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadActions();
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
  }, []);

  const orgPathMap = useMemo(() => buildPathMap(orgTree), [orgTree]);

  const loadLookups = async (): Promise<FormLookups> => {
    if (lookups) return lookups;
    const orgUnits = await api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").catch(() => [] as OrgUnitTreeNode[]);
    const dictEntries = async (code: string) => {
      try {
        const d = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${code}/entries`);
        return d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label }));
      } catch { return []; }
    };
    const [priorities, statuses, sources] = await Promise.all([
      dictEntries("action_priority"), dictEntries("action_status"), dictEntries("action_source"),
    ]);
    const risks = await api.get<Risk[]>("/api/v1/risks").then(
      rs => rs.map(r => ({ id: r.id, label: `${r.code || `R-${r.id}`}: ${r.asset_name}` }))
    ).catch(() => [] as { id: number; label: string }[]);
    const assets = await api.get<Asset[]>("/api/v1/assets").then(
      as => as.map(a => ({ id: a.id, label: a.name }))
    ).catch(() => [] as { id: number; label: string }[]);
    const result = { orgUnits, priorities, statuses, sources, risks, assets };
    setLookups(result);
    return result;
  };

  const openAddForm = async () => {
    await loadLookups();
    setEditAction(null);
    setShowForm(true);
  };

  const openEditForm = async (action: Action) => {
    await loadLookups();
    setEditAction(action);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const links: { entity_type: string; entity_id: number }[] = [];
    const riskIds = Array.from(fd.getAll("link_risks")).map(Number).filter(Boolean);
    const assetIds = Array.from(fd.getAll("link_assets")).map(Number).filter(Boolean);
    riskIds.forEach(id => links.push({ entity_type: "risk", entity_id: id }));
    assetIds.forEach(id => links.push({ entity_type: "asset", entity_id: id }));

    const body: Record<string, unknown> = {
      title: fd.get("title") as string,
      description: (fd.get("description") as string) || null,
      org_unit_id: fd.get("org_unit_id") ? Number(fd.get("org_unit_id")) : null,
      owner: (fd.get("owner") as string) || null,
      responsible: (fd.get("responsible") as string) || null,
      priority_id: fd.get("priority_id") ? Number(fd.get("priority_id")) : null,
      status_id: fd.get("status_id") ? Number(fd.get("status_id")) : null,
      source_id: fd.get("source_id") ? Number(fd.get("source_id")) : null,
      due_date: (fd.get("due_date") as string) || null,
      links,
    };
    try {
      if (editAction) {
        const updated = await api.put<Action>(`/api/v1/actions/${editAction.id}`, body);
        setSelected(updated);
      } else {
        await api.post("/api/v1/actions", body);
      }
      setShowForm(false);
      setEditAction(null);
      setLookups(null);
      setLoading(true);
      loadActions();
    } catch (err) {
      alert("Blad zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (action: Action) => {
    if (!confirm(`Archiwizowac dzialanie "${action.title}"?`)) return;
    try {
      await api.delete(`/api/v1/actions/${action.id}`);
      setSelected(null);
      setLoading(true);
      loadActions();
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  const openCloseDialog = (action: Action) => {
    setClosingAction(action);
    setShowClose(true);
  };

  const handleClose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!closingAction) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      effectiveness_rating: Number(fd.get("effectiveness_rating")),
      effectiveness_notes: (fd.get("effectiveness_notes") as string) || null,
    };
    try {
      const updated = await api.post<Action>(`/api/v1/actions/${closingAction.id}/close`, body);
      setSelected(updated);
      setShowClose(false);
      setClosingAction(null);
      setLoading(true);
      loadActions();
    } catch (err) {
      alert("Blad: " + err);
    } finally {
      setSaving(false);
    }
  };

  // Stats cards
  const filteredOverdue = table.filtered.filter(a => a.is_overdue).length;
  const totalOverdue = actions.filter(a => a.is_overdue).length;
  const filteredInProgress = table.filtered.filter(a => {
    const l = (a.status_name ?? "").toLowerCase();
    return l.includes("trakcie") || l.includes("progress");
  }).length;
  const totalInProgress = actions.filter(a => {
    const l = (a.status_name ?? "").toLowerCase();
    return l.includes("trakcie") || l.includes("progress");
  }).length;
  const filteredCompleted = table.filtered.filter(a => {
    const l = (a.status_name ?? "").toLowerCase();
    return l.includes("zamkn") || l.includes("complet") || l.includes("wykonan");
  }).length;
  const totalCompleted = actions.filter(a => {
    const l = (a.status_name ?? "").toLowerCase();
    return l.includes("zamkn") || l.includes("complet") || l.includes("wykonan");
  }).length;

  const statsCards: StatCard[] = [
    { label: "Wszystkich działań", value: table.filteredCount, total: table.totalCount, color: "var(--blue)" },
    { label: "Przeterminowanych", value: filteredOverdue, total: totalOverdue, color: "var(--red)" },
    { label: "W trakcie", value: filteredInProgress, total: totalInProgress, color: "var(--orange)" },
    { label: "Ukończonych", value: filteredCompleted, total: totalCompleted, color: "var(--green)" },
  ];

  const isFiltered = table.hasActiveFilters || !!table.search;

  return (
    <div>
      {/* KPI Summary */}
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      <TableToolbar
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="działań"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj działań..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="dzialania"
        primaryLabel="Dodaj działanie"
        onPrimaryAction={openAddForm}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 14 }}>
        <DataTable<Action>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={a => a.id}
          selectedKey={selected?.id ?? null}
          onRowClick={a => setSelected(selected?.id === a.id ? null : a)}
          rowBorderColor={a =>
            a.is_overdue ? "var(--red)" : a.completed_at ? "var(--green)" : undefined
          }
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
          emptyMessage="Brak dzialan w systemie. Kliknij '+ Dodaj dzialanie' aby rozpoczac."
          emptyFilteredMessage="Brak dzialan pasujacych do filtrow."
          renderCell={(row, colKey) => {
            if (colKey === "id") {
              return (
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>
                  D-{row.id}
                </span>
              );
            }
            if (colKey === "title") {
              return (
                <span style={{ fontWeight: 500, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                  {row.title}
                </span>
              );
            }
            if (colKey === "priority_name") {
              return row.priority_name ? (
                <span style={{ fontSize: 12, fontWeight: 500, color: priorityColor(row.priority_name) }}>{row.priority_name}</span>
              ) : <span>{"\u2014"}</span>;
            }
            if (colKey === "status_name") {
              return row.status_name ? (
                <span className="score-badge" style={{ background: `${statusColor(row.status_name)}20`, color: statusColor(row.status_name) }}>{row.status_name}</span>
              ) : <span>{"\u2014"}</span>;
            }
            if (colKey === "due_date") {
              if (!row.due_date) return <span>{"\u2014"}</span>;
              const days = daysUntil(row.due_date);
              const overdue = row.is_overdue;
              return (
                <span style={{
                  fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                  color: overdue ? "var(--red)" : days != null && days <= 7 ? "var(--orange)" : "var(--text-secondary)",
                }}>
                  {row.due_date.slice(0, 10)}
                  {overdue && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--red)" }}>!</span>}
                </span>
              );
            }
            if (colKey === "links") {
              return row.links.length > 0 ? (
                <span className="score-badge" style={{ background: "var(--cyan-dim)", color: "var(--cyan)" }}>{row.links.length}</span>
              ) : (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>0</span>
              );
            }
            return undefined;
          }}
        />

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly dzialania</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{selected.title}</div>
              {selected.is_overdue && (
                <span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)", fontSize: 11, marginTop: 6 }}>
                  Przeterminowane
                </span>
              )}
              {selected.completed_at && (
                <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)", fontSize: 11, marginTop: 6 }}>
                  Zamkniete
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>ID</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>D-{selected.id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Jednostka org.</span>
                <span style={{ fontSize: 11 }}>{(selected.org_unit_id ? orgPathMap.get(selected.org_unit_id) : null) ?? selected.org_unit_name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Wlasciciel</span>
                <span>{selected.owner ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Odpowiedzialny</span>
                <span>{selected.responsible ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Priorytet</span>
                <span style={{ fontWeight: 500, color: priorityColor(selected.priority_name) }}>{selected.priority_name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Status</span>
                <span style={{ color: statusColor(selected.status_name) }}>{selected.status_name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Zrodlo</span>
                <span>{selected.source_name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Termin</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  color: selected.is_overdue ? "var(--red)" : "var(--text-secondary)"
                }}>
                  {selected.due_date?.slice(0, 10) ?? "—"}
                </span>
              </div>
              {selected.completed_at && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Zamkniete</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--green)" }}>{selected.completed_at.slice(0, 10)}</span>
                </div>
              )}
              {selected.effectiveness_rating != null && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Skutecznosc</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>
                    {selected.effectiveness_rating}/5
                    {" "}{["", "Minimalna", "Niska", "Srednia", "Wysoka", "Pelna"][selected.effectiveness_rating]}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Utworzono</span>
                <span>{selected.created_at?.slice(0, 10)}</span>
              </div>
              {selected.description && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Opis</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.description}
                  </div>
                </div>
              )}
              {selected.effectiveness_notes && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Notatki dot. skutecznosci</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.effectiveness_notes}
                  </div>
                </div>
              )}

              {/* Linked entities */}
              {selected.links.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Powiazane obiekty</div>
                  <div className="tag-list">
                    {selected.links.map(l => (
                      <span key={l.id} className="tag" style={{ cursor: "default" }}>
                        <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", marginRight: 4 }}>
                          {l.entity_type === "risk" ? "Ryzyko" : l.entity_type === "asset" ? "Aktyw" : l.entity_type}
                        </span>
                        {l.entity_name ?? `#${l.entity_id}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Change history */}
              {selected.history.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Historia zmian</div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {selected.history.map(h => (
                      <div key={h.id} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid rgba(42,53,84,0.15)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{h.created_at?.slice(0, 16).replace("T", " ")}</span>
                        {" "}<span style={{ color: "var(--blue)" }}>{h.field_name}</span>
                        {h.old_value && <span style={{ color: "var(--red)", textDecoration: "line-through", marginLeft: 4 }}>{h.old_value}</span>}
                        <span style={{ color: "var(--green)", marginLeft: 4 }}>{h.new_value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid rgba(42,53,84,0.25)", paddingTop: 12 }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => openEditForm(selected)}>Edytuj</button>
              {!selected.completed_at && (
                <button className="btn btn-sm" style={{ flex: 1, color: "var(--green)" }} onClick={() => openCloseDialog(selected)}>Zamknij</button>
              )}
              <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleArchive(selected)}>Archiwizuj</button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditAction(null); }} title={editAction ? `Edytuj: ${editAction.title}` : "Nowe dzialanie"} wide>
        {lookups ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>Tytul dzialania *</label>
                <input name="title" className="form-control" required defaultValue={editAction?.title ?? ""} placeholder="np. Wdrozenie MFA dla kont administracyjnych" />
              </div>
              <div className="form-group">
                <label>Jednostka organizacyjna</label>
                <OrgUnitTreeSelect
                  tree={lookups.orgUnits}
                  value={editAction?.org_unit_id ?? null}
                  onChange={id => {
                    const hidden = document.querySelector<HTMLInputElement>('input[name="org_unit_id"]');
                    if (hidden) hidden.value = id ? String(id) : "";
                  }}
                  placeholder="Wybierz..."
                  allowClear
                />
                <input type="hidden" name="org_unit_id" defaultValue={editAction?.org_unit_id ?? ""} />
              </div>
              <div className="form-group">
                <label>Priorytet</label>
                <select name="priority_id" className="form-control" defaultValue={editAction?.priority_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {lookups.priorities.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select name="status_id" className="form-control" defaultValue={editAction?.status_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {lookups.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Zrodlo</label>
                <select name="source_id" className="form-control" defaultValue={editAction?.source_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {lookups.sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Wlasciciel</label>
                <input name="owner" className="form-control" defaultValue={editAction?.owner ?? ""} placeholder="np. Jan Kowalski" />
              </div>
              <div className="form-group">
                <label>Odpowiedzialny</label>
                <input name="responsible" className="form-control" defaultValue={editAction?.responsible ?? ""} placeholder="np. Anna Nowak" />
              </div>
              <div className="form-group">
                <label>Termin realizacji</label>
                <input name="due_date" type="date" className="form-control" defaultValue={editAction?.due_date?.slice(0, 10) ?? ""} />
              </div>
              <div className="form-group">
                <label>Powiazane ryzyka</label>
                <select name="link_risks" className="form-control" multiple style={{ height: 80 }}
                  defaultValue={editAction?.links.filter(l => l.entity_type === "risk").map(l => String(l.entity_id)) ?? []}>
                  {lookups.risks.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Ctrl+klik aby wybrac wiele</span>
              </div>
              <div className="form-group">
                <label>Powiazane aktywa</label>
                <select name="link_assets" className="form-control" multiple style={{ height: 80 }}
                  defaultValue={editAction?.links.filter(l => l.entity_type === "asset").map(l => String(l.entity_id)) ?? []}>
                  {lookups.assets.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Ctrl+klik aby wybrac wiele</span>
              </div>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>Opis</label>
                <textarea name="description" className="form-control" rows={3} defaultValue={editAction?.description ?? ""} placeholder="Opisz dzialanie, cele, kroki..." />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setEditAction(null); }}>Anuluj</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Zapisywanie..." : editAction ? "Zapisz zmiany" : "Dodaj dzialanie"}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie danych formularza...</div>
        )}
      </Modal>

      {/* Close with Effectiveness Modal */}
      <Modal open={showClose} onClose={() => { setShowClose(false); setClosingAction(null); }} title={`Zamknij dzialanie: ${closingAction?.title ?? ""}`}>
        <form onSubmit={handleClose}>
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(52,211,153,0.08)", borderRadius: 8, border: "1px solid rgba(52,211,153,0.2)" }}>
            <div style={{ fontSize: 12, color: "var(--green)", marginBottom: 4 }}>Zamykanie dzialania</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Ocen skutecznosc realizacji tego dzialania. Ocena zostanie zapisana w historii.
            </div>
          </div>
          <div className="form-group">
            <label>Ocena skutecznosci (1-5) *</label>
            <select name="effectiveness_rating" className="form-control" required defaultValue="">
              <option value="">Wybierz...</option>
              <option value="1">1 — Minimalna (dzialanie niemal bez efektu)</option>
              <option value="2">2 — Niska (czescowo zrealizowane)</option>
              <option value="3">3 — Srednia (zrealizowane, umiarkowany efekt)</option>
              <option value="4">4 — Wysoka (dobrze zrealizowane)</option>
              <option value="5">5 — Pelna (w pelni skuteczne)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notatki dot. skutecznosci</label>
            <textarea name="effectiveness_notes" className="form-control" rows={3} placeholder="Opisz rezultaty dzialania, co sie udalo, co mozna poprawic..." />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => { setShowClose(false); setClosingAction(null); }}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Zamykanie..." : "Zamknij dzialanie"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
