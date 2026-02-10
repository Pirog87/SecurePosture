import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import type { Action, OrgUnitTreeNode, DictionaryTypeWithEntries, Risk, Asset } from "../types";
import { flattenTree, buildPathMap, collectDescendantIds } from "../utils/orgTree";
import Modal from "../components/Modal";

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

  const [filterOrg, setFilterOrg] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);

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

  const flatUnits = lookups ? flattenTree(lookups.orgUnits) : [];

  // Hierarchical org filtering
  const filterOrgIds = useMemo(() => {
    if (!filterOrg) return null;
    return new Set(collectDescendantIds(orgTree, Number(filterOrg)));
  }, [filterOrg, orgTree]);

  const filtered = actions.filter(a => {
    if (filterOrgIds && a.org_unit_id && !filterOrgIds.has(a.org_unit_id)) return false;
    if (filterStatus && a.status_name !== filterStatus) return false;
    if (filterOverdue && !a.is_overdue) return false;
    if (filterSearch && !a.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const flatFilterUnits = flattenTree(orgTree);
  const uniqueOrgs = flatFilterUnits.map(u => ({ id: u.id, name: u.name, depth: u.depth }));
  const uniqueStatuses = [...new Set(actions.map(a => a.status_name).filter(Boolean))] as string[];
  const hasFilters = filterOrg || filterStatus || filterSearch || filterOverdue;

  // KPIs
  const totalActive = actions.filter(a => a.is_active).length;
  const overdueCount = actions.filter(a => a.is_overdue).length;
  const completedCount = actions.filter(a => a.completed_at).length;
  const avgEffectiveness = (() => {
    const rated = actions.filter(a => a.effectiveness_rating != null);
    if (rated.length === 0) return null;
    return rated.reduce((s, a) => s + a.effectiveness_rating!, 0) / rated.length;
  })();

  return (
    <div>
      {/* KPI Summary */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)" }}>{totalActive}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Aktywnych dzialan</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: overdueCount > 0 ? "var(--red)" : "var(--green)" }}>{overdueCount}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Przeterminowanych</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--green)" }}>{completedCount}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Zamknietych</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{avgEffectiveness != null ? avgEffectiveness.toFixed(1) : "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Srednia skutecznosc</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <input
            className="form-control"
            style={{ width: 220 }}
            placeholder="Szukaj dzialan..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
          />
          <select className="form-control" style={{ width: 220 }} value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
            <option value="">Wszystkie piony</option>
            {uniqueOrgs.map(o => <option key={o.id} value={o.id}>{"  ".repeat(o.depth)}{o.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Wszystkie statusy</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={filterOverdue} onChange={e => setFilterOverdue(e.target.checked)} />
            Tylko przeterminowane
          </label>
          {hasFilters && (
            <button className="btn btn-sm" onClick={() => { setFilterOrg(""); setFilterStatus(""); setFilterSearch(""); setFilterOverdue(false); }}>Wyczysc filtry</button>
          )}
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} / {actions.length}</span>
          <button className="btn btn-primary btn-sm" onClick={openAddForm}>+ Dodaj dzialanie</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie dzialan...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {actions.length === 0 ? "Brak dzialan w systemie. Kliknij '+ Dodaj dzialanie' aby rozpoczac." : "Brak dzialan pasujacych do filtrow."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tytul</th>
                  <th>Pion</th>
                  <th>Priorytet</th>
                  <th>Status</th>
                  <th>Termin</th>
                  <th>Odpowiedzialny</th>
                  <th>Powiazania</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const days = daysUntil(a.due_date);
                  const overdue = a.is_overdue;
                  return (
                    <tr
                      key={a.id}
                      style={{
                        cursor: "pointer",
                        background: selected?.id === a.id ? "var(--bg-card-hover)" : undefined,
                        borderLeft: overdue ? "3px solid var(--red)" : a.completed_at ? "3px solid var(--green)" : "3px solid transparent",
                      }}
                      onClick={() => setSelected(selected?.id === a.id ? null : a)}
                    >
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>D-{a.id}</td>
                      <td style={{ fontWeight: 500, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</td>
                      <td style={{ fontSize: 11 }}>{(a.org_unit_id ? orgPathMap.get(a.org_unit_id) : null) ?? a.org_unit_name ?? "—"}</td>
                      <td>
                        {a.priority_name ? (
                          <span style={{ fontSize: 12, fontWeight: 500, color: priorityColor(a.priority_name) }}>{a.priority_name}</span>
                        ) : "—"}
                      </td>
                      <td>
                        {a.status_name ? (
                          <span className="score-badge" style={{ background: `${statusColor(a.status_name)}20`, color: statusColor(a.status_name) }}>{a.status_name}</span>
                        ) : "—"}
                      </td>
                      <td>
                        {a.due_date ? (
                          <span style={{
                            fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                            color: overdue ? "var(--red)" : days != null && days <= 7 ? "var(--orange)" : "var(--text-secondary)"
                          }}>
                            {a.due_date.slice(0, 10)}
                            {overdue && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--red)" }}>!</span>}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.responsible ?? a.owner ?? "—"}</td>
                      <td>
                        {a.links.length > 0 ? (
                          <span className="score-badge" style={{ background: "var(--cyan-dim)", color: "var(--cyan)" }}>{a.links.length}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

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
                <select name="org_unit_id" className="form-control" defaultValue={editAction?.org_unit_id ?? ""}>
                  <option value="">Wybierz...</option>
                  {flatUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
                </select>
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
