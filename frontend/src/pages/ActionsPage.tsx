import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { api } from "../services/api";
import type { Action, ActionAttachment, ActionLink, ActionComment, ActionStats, OrgUnitTreeNode, DictionaryTypeWithEntries, Risk } from "../types";
import { buildPathMap } from "../utils/orgTree";
import Modal from "../components/Modal";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

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
  if (l.includes("przetermin") || l.includes("overdue")) return "var(--red)";
  return "var(--orange)";
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function riskScoreColor(score: number): string {
  if (score >= 221) return "var(--red)";
  if (score >= 31) return "var(--orange)";
  return "var(--green)";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Tytuł", description: "Opis", org_unit_id: "Jednostka org.",
  owner: "Właściciel", responsible: "Odpowiedzialny", priority_id: "Priorytet",
  status_id: "Status", source_id: "Źródło", due_date: "Termin realizacji",
  completed_at: "Zamknięto", effectiveness_rating: "Ocena skuteczności",
  effectiveness_notes: "Notatki skuteczności", implementation_notes: "Notatki wdrożenia",
};

const TRACKED_FIELDS = ["title", "description", "owner", "responsible", "due_date", "status_id", "priority_id"];

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface FormLookups {
  orgUnits: OrgUnitTreeNode[];
  priorities: { id: number; label: string }[];
  statuses: { id: number; label: string }[];
  sources: { id: number; label: string }[];
  allRisks: Risk[];
}

type FormTab = "description" | "links" | "effectiveness" | "comments" | "history";

/* ═══════════════════════════════════════════════════════════
   Table columns
   ═══════════════════════════════════════════════════════════ */

const COLUMNS: ColumnDef<Action>[] = [
  { key: "id", header: "ID", format: r => `D-${r.id}` },
  { key: "title", header: "Tytuł" },
  { key: "org_unit_name", header: "Pion", format: r => r.org_unit_name ?? "" },
  { key: "priority_name", header: "Priorytet", format: r => r.priority_name ?? "" },
  { key: "status_name", header: "Status", format: r => r.status_name ?? "" },
  { key: "due_date", header: "Termin", format: r => r.due_date?.slice(0, 10) ?? "" },
  { key: "responsible", header: "Odpowiedzialny", format: r => r.responsible ?? r.owner ?? "" },
  { key: "links", header: "Powiązania", format: r => String(r.links.length) },
  { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
  { key: "owner", header: "Właściciel", format: r => r.owner ?? "", defaultVisible: false },
  { key: "source_name", header: "Źródło", format: r => r.source_name ?? "", defaultVisible: false },
  { key: "completed_at", header: "Ukończono", format: r => r.completed_at?.slice(0, 10) ?? "", defaultVisible: false },
  { key: "effectiveness_rating", header: "Ocena skut.", format: r => r.effectiveness_rating != null ? `${r.effectiveness_rating}/5` : "", defaultVisible: false },
  { key: "is_overdue", header: "Przeterminowane", format: r => r.is_overdue ? "TAK" : "NIE", defaultVisible: false },
  { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  { key: "updated_at", header: "Aktualizacja", format: r => r.updated_at?.slice(0, 10) ?? "", defaultVisible: false },
];

/* ═══════════════════════════════════════════════════════════
   MiniBarChart — simple inline bar chart for KPI dashboard
   ═══════════════════════════════════════════════════════════ */

function MiniBarChart({ data, color1, color2, label1, label2 }: {
  data: { label: string; v1: number; v2: number }[];
  color1: string; color2: string; label1: string; label2: string;
}) {
  const max = Math.max(...data.map(d => Math.max(d.v1, d.v2)), 1);
  return (
    <div>
      <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: color1, marginRight: 4 }} />{label1}</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: color2, marginRight: 4 }} />{label2}</span>
      </div>
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 60 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 50 }}>
              <div style={{ width: 6, height: Math.max(2, (d.v1 / max) * 50), background: color1, borderRadius: 1 }} title={`${label1}: ${d.v1}`} />
              <div style={{ width: 6, height: Math.max(2, (d.v2 / max) * 50), background: color2, borderRadius: 1 }} title={`${label2}: ${d.v2}`} />
            </div>
            <div style={{ fontSize: 8, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{d.label.slice(5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   KPI Dashboard Panel
   ═══════════════════════════════════════════════════════════ */

function KpiDashboard({ stats }: { stats: ActionStats | null }) {
  if (!stats) return null;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="card-title" style={{ margin: 0, fontSize: 13 }}>Dashboard KPI</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {/* Col 1: Status breakdown */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Podział wg statusu</div>
          {stats.by_status.map((s, i) => {
            const pct = stats.total > 0 ? (s.count / stats.total * 100) : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, width: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.status_name}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: statusColor(s.status_name) }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", width: 24, textAlign: "right" }}>{s.count}</span>
              </div>
            );
          })}
        </div>

        {/* Col 2: Priority breakdown */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Podział wg priorytetu</div>
          {stats.by_priority.map((p, i) => {
            const pct = stats.total > 0 ? (p.count / stats.total * 100) : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, width: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.priority_name}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: priorityColor(p.priority_name) }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", width: 24, textAlign: "right" }}>{p.count}</span>
              </div>
            );
          })}
          {stats.avg_completion_days != null && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              Śr. czas realizacji: <span style={{ fontWeight: 600, color: "var(--blue)", fontFamily: "'JetBrains Mono',monospace" }}>{stats.avg_completion_days} dni</span>
            </div>
          )}
        </div>

        {/* Col 3: Monthly trend */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Trend miesięczny (12 mies.)</div>
          <MiniBarChart
            data={stats.monthly_trend.map(t => ({ label: t.month, v1: t.created, v2: t.completed }))}
            color1="var(--blue)" color2="var(--green)"
            label1="Utworzone" label2="Ukończone"
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Bulk action bar
   ═══════════════════════════════════════════════════════════ */

function BulkActionBar({ selectedIds, lookups, onBulkDone }: {
  selectedIds: number[];
  lookups: FormLookups | null;
  onBulkDone: () => void;
}) {
  const [bulkField, setBulkField] = useState<"status" | "priority" | "responsible">("status");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleBulk = async () => {
    if (!bulkValue) { alert("Wybierz wartość"); return; }
    setSaving(true);
    const body: Record<string, unknown> = { action_ids: selectedIds };
    if (bulkField === "status") body.status_id = Number(bulkValue);
    else if (bulkField === "priority") body.priority_id = Number(bulkValue);
    else body.responsible = bulkValue;
    if (bulkReason) body.change_reason = bulkReason;
    try {
      await api.post("/api/v1/actions/bulk", body);
      onBulkDone();
    } catch (err) { alert("Błąd: " + err); }
    setSaving(false);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", marginBottom: 8,
      background: "rgba(59,130,246,0.08)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.2)",
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)" }}>
        Zaznaczono: {selectedIds.length}
      </span>
      <select className="form-control" style={{ width: 130, fontSize: 11, padding: "4px 8px" }} value={bulkField} onChange={e => { setBulkField(e.target.value as any); setBulkValue(""); }}>
        <option value="status">Status</option>
        <option value="priority">Priorytet</option>
        <option value="responsible">Odpowiedzialny</option>
      </select>
      {bulkField === "responsible" ? (
        <input className="form-control" style={{ width: 160, fontSize: 11, padding: "4px 8px" }} placeholder="Nowy odpowiedzialny..." value={bulkValue} onChange={e => setBulkValue(e.target.value)} />
      ) : (
        <select className="form-control" style={{ width: 160, fontSize: 11, padding: "4px 8px" }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
          <option value="">Wybierz...</option>
          {(bulkField === "status" ? lookups?.statuses : lookups?.priorities)?.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
      <input className="form-control" style={{ width: 200, fontSize: 11, padding: "4px 8px" }} placeholder="Powód zmiany (opcjonalnie)..." value={bulkReason} onChange={e => setBulkReason(e.target.value)} />
      <button className="btn btn-sm btn-primary" disabled={saving || !bulkValue} onClick={handleBulk} style={{ fontSize: 11 }}>
        {saving ? "..." : "Zastosuj"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════ */

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAction, setEditAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [selected, setSelected] = useState<Action | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [kpiStats, setKpiStats] = useState<ActionStats | null>(null);
  const [showKpi, setShowKpi] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "actions");
  const table = useTableFeatures<Action>({ data: actions, storageKey: "actions", defaultSort: "due_date", defaultSortDir: "asc" });
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);

  const loadActions = useCallback(() => {
    api.get<Action[]>("/api/v1/actions").then(setActions).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadKpi = useCallback(() => {
    api.get<ActionStats>("/api/v1/actions/stats").then(setKpiStats).catch(() => {});
  }, []);

  useEffect(() => {
    loadActions();
    loadKpi();
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
    // Auto-overdue on page load
    api.post("/api/v1/actions/auto-overdue", {}).catch(() => {});
  }, [loadActions, loadKpi]);

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
    const allRisks = await api.get<Risk[]>("/api/v1/risks").catch(() => [] as Risk[]);
    const result = { orgUnits, priorities, statuses, sources, allRisks };
    setLookups(result);
    return result;
  };

  const openAddForm = async () => { await loadLookups(); setEditAction(null); setShowForm(true); };
  const openEditForm = async (action: Action) => { await loadLookups(); setEditAction(action); setShowForm(true); };

  const handleArchive = async (action: Action) => {
    if (!confirm(`Archiwizowac dzialanie "${action.title}"?`)) return;
    try { await api.delete(`/api/v1/actions/${action.id}`); setSelected(null); setLoading(true); loadActions(); loadKpi(); } catch (err) { alert("Blad: " + err); }
  };

  const handleExportRich = () => {
    const apiBase = (import.meta as any).env?.VITE_API_BASE ?? "";
    window.open(`${apiBase}/api/v1/actions/export`, "_blank");
  };

  /* ── Checkbox selection ── */
  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllChecked = () => {
    if (checkedIds.size === table.pageData.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(table.pageData.map(a => a.id)));
    }
  };

  /* ── Stats cards ── */
  const filteredOverdue = table.filtered.filter(a => a.is_overdue).length;
  const totalOverdue = actions.filter(a => a.is_overdue).length;
  const filteredInProgress = table.filtered.filter(a => { const l = (a.status_name ?? "").toLowerCase(); return l.includes("trakcie") || l.includes("progress"); }).length;
  const totalInProgress = actions.filter(a => { const l = (a.status_name ?? "").toLowerCase(); return l.includes("trakcie") || l.includes("progress"); }).length;
  const filteredCompleted = table.filtered.filter(a => { const l = (a.status_name ?? "").toLowerCase(); return l.includes("zamkn") || l.includes("complet") || l.includes("wykonan"); }).length;
  const totalCompleted = actions.filter(a => { const l = (a.status_name ?? "").toLowerCase(); return l.includes("zamkn") || l.includes("complet") || l.includes("wykonan"); }).length;

  const statsCards: StatCard[] = [
    { label: "Wszystkich działań", value: table.filteredCount, total: table.totalCount, color: "var(--blue)" },
    { label: "Przeterminowanych", value: filteredOverdue, total: totalOverdue, color: "var(--red)" },
    { label: "W trakcie", value: filteredInProgress, total: totalInProgress, color: "var(--orange)" },
    { label: "Ukończonych", value: filteredCompleted, total: totalCompleted, color: "var(--green)" },
  ];
  const isFiltered = table.hasActiveFilters || !!table.search;

  return (
    <div>
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      {/* KPI toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button className="btn btn-sm" style={{ fontSize: 11, color: showKpi ? "var(--blue)" : undefined }} onClick={() => setShowKpi(v => !v)}>
          {showKpi ? "Ukryj" : "Pokaż"} Dashboard KPI
        </button>
        <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={handleExportRich} title="Eksport do Excel z ryzykami i historią">
          Eksport szczegółowy (XLSX)
        </button>
      </div>
      {showKpi && <KpiDashboard stats={kpiStats} />}

      {/* Bulk bar */}
      {checkedIds.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(checkedIds)}
          lookups={lookups}
          onBulkDone={() => { setCheckedIds(new Set()); setLoading(true); loadActions(); loadKpi(); setLookups(null); }}
        />
      )}

      <TableToolbar
        filteredCount={table.filteredCount} totalCount={table.totalCount} unitLabel="działań"
        search={table.search} onSearchChange={table.setSearch} searchPlaceholder="Szukaj działań..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters} onClearFilters={table.clearAllFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={table.filtered} exportFilename="dzialania" primaryLabel="Dodaj działanie" onPrimaryAction={openAddForm}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 14 }}>
        <DataTable<Action>
          columns={COLUMNS} visibleColumns={visibleCols} data={table.pageData} rowKey={a => a.id}
          selectedKey={selected?.id ?? null} onRowClick={a => setSelected(selected?.id === a.id ? null : a)}
          rowBorderColor={a => a.is_overdue ? "var(--red)" : a.completed_at ? "var(--green)" : undefined}
          sortField={table.sortField} sortDir={table.sortDir} onSort={table.toggleSort}
          columnFilters={table.columnFilters} onColumnFilter={table.setColumnFilter} showFilters={showFilters}
          page={table.page} totalPages={table.totalPages} pageSize={table.pageSize}
          totalItems={table.totalCount} filteredItems={table.filteredCount}
          onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
          loading={loading} emptyMessage="Brak działań w systemie." emptyFilteredMessage="Brak działań pasujących do filtrów."
          renderCell={(row, colKey) => {
            if (colKey === "id") return (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={checkedIds.has(row.id)} onChange={() => toggleCheck(row.id)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>D-{row.id}</span>
              </span>
            );
            if (colKey === "title") return <span style={{ fontWeight: 500, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>{row.title}</span>;
            if (colKey === "priority_name") return row.priority_name ? <span style={{ fontSize: 12, fontWeight: 500, color: priorityColor(row.priority_name) }}>{row.priority_name}</span> : <span>{"\u2014"}</span>;
            if (colKey === "status_name") return row.status_name ? <span className="score-badge" style={{ background: `${statusColor(row.status_name)}20`, color: statusColor(row.status_name) }}>{row.status_name}</span> : <span>{"\u2014"}</span>;
            if (colKey === "due_date") {
              if (!row.due_date) return <span>{"\u2014"}</span>;
              const days = daysUntil(row.due_date);
              return <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: row.is_overdue ? "var(--red)" : days != null && days <= 7 ? "var(--orange)" : "var(--text-secondary)" }}>{row.due_date.slice(0, 10)}{row.is_overdue && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--red)" }}>!</span>}</span>;
            }
            if (colKey === "links") return row.links.length > 0 ? <span className="score-badge" style={{ background: "var(--cyan-dim)", color: "var(--cyan)" }}>{row.links.length}</span> : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>0</span>;
            return undefined;
          }}
          renderHeaderExtra={colKey => {
            if (colKey === "id") return (
              <input type="checkbox" checked={checkedIds.size > 0 && checkedIds.size === table.pageData.length} onChange={toggleAllChecked} onClick={e => e.stopPropagation()} style={{ cursor: "pointer", marginRight: 4 }} />
            );
            return undefined;
          }}
        />

        {/* ── Detail Panel ── */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegóły działania</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{selected.title}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
                {selected.is_overdue && <span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)", fontSize: 11 }}>Przeterminowane</span>}
                {selected.completed_at && <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)", fontSize: 11 }}>Zamknięte</span>}
                {selected.status_name && <span className="score-badge" style={{ background: `${statusColor(selected.status_name)}20`, color: statusColor(selected.status_name), fontSize: 11 }}>{selected.status_name}</span>}
              </div>
            </div>

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <DetailRow label="ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>D-{selected.id}</span>} />
              <DetailRow label="Jednostka org." value={<span style={{ fontSize: 11 }}>{(selected.org_unit_id ? orgPathMap.get(selected.org_unit_id) : null) ?? selected.org_unit_name ?? "\u2014"}</span>} />
              <DetailRow label="Właściciel" value={selected.owner} />
              <DetailRow label="Odpowiedzialny" value={selected.responsible} />
              <DetailRow label="Priorytet" value={selected.priority_name ? <span style={{ fontWeight: 500, color: priorityColor(selected.priority_name) }}>{selected.priority_name}</span> : "\u2014"} />
              <DetailRow label="Źródło" value={selected.source_name} />
              <DetailRow label="Termin" value={<span style={{ fontFamily: "'JetBrains Mono',monospace", color: selected.is_overdue ? "var(--red)" : "var(--text-secondary)" }}>{selected.due_date?.slice(0, 10) ?? "\u2014"}</span>} />
              {selected.completed_at && <DetailRow label="Zamknięte" value={<span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--green)" }}>{selected.completed_at.slice(0, 10)}</span>} />}
              {selected.effectiveness_rating != null && <DetailRow label="Skuteczność" value={<span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{selected.effectiveness_rating}/5 {["","Minimalna","Niska","Średnia","Wysoka","Pełna"][selected.effectiveness_rating]}</span>} />}
              <DetailRow label="Utworzono" value={selected.created_at?.slice(0, 10)} />

              {selected.description && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Opis</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8, whiteSpace: "pre-wrap" }}>{selected.description}</div>
                </div>
              )}

              {/* Linked entities */}
              {selected.links.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Powiązane obiekty ({selected.links.length})</div>
                  {selected.links.map(l => (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", borderRadius: 6, marginBottom: 3, background: l.entity_type === "risk" ? "rgba(239,68,68,0.06)" : "rgba(59,130,246,0.06)", border: `1px solid ${l.entity_type === "risk" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)"}` }}>
                      <div>
                        <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", marginRight: 4 }}>
                          {l.entity_type === "risk" ? "Ryzyko" : l.entity_type === "asset" ? "Aktyw" : l.entity_type}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{l.entity_name ?? `#${l.entity_id}`}</span>
                      </div>
                      {l.entity_extra?.risk_score != null && (
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: riskScoreColor(l.entity_extra.risk_score) }}>
                          {l.entity_extra.risk_score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Last 5 history entries */}
              {selected.history.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Ostatnie zmiany</div>
                  <div style={{ maxHeight: 160, overflowY: "auto" }}>
                    {selected.history.slice(0, 5).map(h => (
                      <div key={h.id} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid rgba(42,53,84,0.15)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{h.created_at?.slice(0, 16).replace("T", " ")}</span>
                        {" "}<span style={{ color: "var(--blue)" }}>{FIELD_LABELS[h.field_name] ?? h.field_name}</span>
                        {h.old_value && <span style={{ color: "var(--red)", textDecoration: "line-through", marginLeft: 4, fontSize: 10 }}>{h.old_value.length > 40 ? h.old_value.slice(0, 40) + "..." : h.old_value}</span>}
                        <span style={{ color: "var(--green)", marginLeft: 4, fontSize: 10 }}>{h.new_value && (h.new_value.length > 40 ? h.new_value.slice(0, 40) + "..." : h.new_value)}</span>
                        {h.change_reason && <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginLeft: 8 }}>Powód: {h.change_reason}</div>}
                      </div>
                    ))}
                    {selected.history.length > 5 && <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 0", textAlign: "center" }}>...i {selected.history.length - 5} więcej</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid rgba(42,53,84,0.25)", paddingTop: 12 }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => openEditForm(selected)}>Edytuj</button>
              <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleArchive(selected)}>Archiwizuj</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Form Modal with 5 Tabs ── */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditAction(null); }} title={editAction ? `Edytuj: D-${editAction.id} ${editAction.title}` : "Nowe działanie"} wide>
        {lookups ? (
          <ActionFormTabs
            editAction={editAction}
            lookups={lookups}
            orgTree={lookups.orgUnits}
            saving={saving}
            setSaving={setSaving}
            onSaved={(updated) => {
              if (updated) setSelected(updated);
              setShowForm(false);
              setEditAction(null);
              setLookups(null);
              setLoading(true);
              loadActions();
              loadKpi();
            }}
            onCancel={() => { setShowForm(false); setEditAction(null); }}
          />
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ładowanie danych formularza...</div>
        )}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DetailRow
   ═══════════════════════════════════════════════════════════ */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span>{value ?? "\u2014"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ActionFormTabs — 5 tab form (desc, links, effectiveness, comments, history)
   ═══════════════════════════════════════════════════════════ */

function ActionFormTabs({ editAction, lookups, orgTree, saving, setSaving, onSaved, onCancel }: {
  editAction: Action | null;
  lookups: FormLookups;
  orgTree: OrgUnitTreeNode[];
  saving: boolean;
  setSaving: (v: boolean) => void;
  onSaved: (updated?: Action) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<FormTab>("description");
  const isEdit = !!editAction;

  // ── Form state (Tab 1: Description) ──
  const [title, setTitle] = useState(editAction?.title ?? "");
  const [description, setDescription] = useState(editAction?.description ?? "");
  const [orgUnitId, setOrgUnitId] = useState<number | null>(editAction?.org_unit_id ?? null);
  const [priorityId, setPriorityId] = useState<number | null>(editAction?.priority_id ?? null);
  const [statusId, setStatusId] = useState<number | null>(editAction?.status_id ?? null);
  const [sourceId, setSourceId] = useState<number | null>(editAction?.source_id ?? null);
  const [owner, setOwner] = useState(editAction?.owner ?? "");
  const [responsible, setResponsible] = useState(editAction?.responsible ?? "");
  const [dueDate, setDueDate] = useState(editAction?.due_date?.slice(0, 10) ?? "");

  // ── Form state (Tab 2: Links) ──
  const [linkedRiskIds, setLinkedRiskIds] = useState<number[]>(
    () => editAction?.links.filter(l => l.entity_type === "risk").map(l => l.entity_id) ?? []
  );

  // ── Form state (Tab 3: Effectiveness) ──
  const [implementationNotes, setImplementationNotes] = useState(editAction?.implementation_notes ?? "");
  const [effectivenessRating, setEffectivenessRating] = useState<number | null>(editAction?.effectiveness_rating ?? null);
  const [effectivenessNotes, setEffectivenessNotes] = useState(editAction?.effectiveness_notes ?? "");
  const [attachments, setAttachments] = useState<ActionAttachment[]>(editAction?.attachments ?? []);

  // ── Change reason modal ──
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const pendingSubmit = useRef<(() => void) | null>(null);

  // Non-risk links from the original action (preserve them)
  const otherLinks = useMemo(() =>
    editAction?.links.filter(l => l.entity_type !== "risk") ?? [],
    [editAction]
  );

  // ── Detect tracked field changes ──
  const hasTrackedChanges = useCallback((): boolean => {
    if (!editAction) return false;
    if (title !== editAction.title) return true;
    if (description !== (editAction.description ?? "")) return true;
    if (owner !== (editAction.owner ?? "")) return true;
    if (responsible !== (editAction.responsible ?? "")) return true;
    if (dueDate !== (editAction.due_date?.slice(0, 10) ?? "")) return true;
    if (statusId !== editAction.status_id) return true;
    if (priorityId !== editAction.priority_id) return true;
    return false;
  }, [editAction, title, description, owner, responsible, dueDate, statusId, priorityId]);

  // ── Submit handler ──
  const doSubmit = async (reason?: string) => {
    if (!title.trim()) { alert("Tytuł jest wymagany"); return; }
    setSaving(true);

    const links = [
      ...linkedRiskIds.map(id => ({ entity_type: "risk", entity_id: id })),
      ...otherLinks.map(l => ({ entity_type: l.entity_type, entity_id: l.entity_id })),
    ];

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description || null,
      org_unit_id: orgUnitId,
      owner: owner || null,
      responsible: responsible || null,
      priority_id: priorityId,
      status_id: statusId,
      source_id: sourceId,
      due_date: dueDate || null,
      links,
    };

    if (isEdit) {
      // Update-only fields
      body.implementation_notes = implementationNotes || null;
      body.effectiveness_rating = effectivenessRating;
      body.effectiveness_notes = effectivenessNotes || null;
      if (reason) body.change_reason = reason;
    }

    try {
      if (isEdit) {
        const updated = await api.put<Action>(`/api/v1/actions/${editAction.id}`, body);
        onSaved(updated);
      } else {
        await api.post<Action>("/api/v1/actions", body);
        onSaved();
      }
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (isEdit && hasTrackedChanges()) {
      pendingSubmit.current = () => doSubmit(changeReason);
      setChangeReason("");
      setShowReasonModal(true);
    } else {
      doSubmit();
    }
  };

  const confirmReason = () => {
    setShowReasonModal(false);
    doSubmit(changeReason || undefined);
  };

  /* ── Tab styles ── */
  const tabStyle = (t: FormTab): React.CSSProperties => ({
    padding: "8px 16px", fontSize: 12, fontWeight: tab === t ? 600 : 400, cursor: "pointer",
    borderBottom: tab === t ? "2px solid var(--blue)" : "2px solid transparent",
    color: tab === t ? "var(--blue)" : "var(--text-muted)",
  });

  /* ── File upload handler ── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editAction || !e.target.files?.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await fetch(`${(import.meta as any).env?.VITE_API_URL ?? ""}/api/v1/actions/${editAction.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const att = await resp.json();
      setAttachments(prev => [att, ...prev]);
    } catch (err) {
      alert("Błąd uploadu: " + err);
    }
    e.target.value = "";
  };

  const handleDeleteAttachment = async (attId: number) => {
    if (!editAction) return;
    if (!confirm("Usunąć załącznik?")) return;
    try {
      await api.delete(`/api/v1/actions/${editAction.id}/attachments/${attId}`);
      setAttachments(prev => prev.filter(a => a.id !== attId));
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <span style={tabStyle("description")} onClick={() => setTab("description")}>Opis działania</span>
        <span style={tabStyle("links")} onClick={() => setTab("links")}>
          Powiązania
          {linkedRiskIds.length > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--cyan)", fontWeight: 700 }}>({linkedRiskIds.length})</span>}
        </span>
        {isEdit && <span style={tabStyle("effectiveness")} onClick={() => setTab("effectiveness")}>Skuteczność</span>}
        {isEdit && <span style={tabStyle("comments")} onClick={() => setTab("comments")}>Komentarze</span>}
        {isEdit && <span style={tabStyle("history")} onClick={() => setTab("history")}>
          Historia
          {editAction?.history.length ? <span style={{ marginLeft: 4, fontSize: 10, color: "var(--text-muted)" }}>({editAction.history.length})</span> : null}
        </span>}
      </div>

      {/* ══════════ Tab 1: Description ══════════ */}
      {tab === "description" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Tytuł działania *</label>
            <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Wdrożenie MFA dla kont administracyjnych" />
            {!title.trim() && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>Pole wymagane</div>}
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Opis</label>
            <textarea className="form-control" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Opisz działanie, cele, kroki..." />
          </div>
          <div className="form-group">
            <label>Jednostka organizacyjna</label>
            <OrgUnitTreeSelect tree={orgTree} value={orgUnitId} onChange={setOrgUnitId} placeholder="Wybierz..." allowClear />
          </div>
          <div className="form-group">
            <label>Priorytet</label>
            <select className="form-control" value={priorityId ?? ""} onChange={e => setPriorityId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Wybierz...</option>
              {lookups.priorities.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={statusId ?? ""} onChange={e => setStatusId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Wybierz...</option>
              {lookups.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Źródło</label>
            <select className="form-control" value={sourceId ?? ""} onChange={e => setSourceId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Wybierz...</option>
              {lookups.sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Właściciel</label>
            <input className="form-control" value={owner} onChange={e => setOwner(e.target.value)} placeholder="np. Jan Kowalski" />
          </div>
          <div className="form-group">
            <label>Odpowiedzialny za realizację</label>
            <input className="form-control" value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="np. Anna Nowak" />
          </div>
          <div className="form-group">
            <label>Termin realizacji</label>
            <input type="date" className="form-control" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>
      )}

      {/* ══════════ Tab 2: Links (Risk search + link) ══════════ */}
      {tab === "links" && (
        <RiskLinkerTab
          allRisks={lookups.allRisks}
          linkedRiskIds={linkedRiskIds}
          setLinkedRiskIds={setLinkedRiskIds}
          otherLinks={otherLinks}
        />
      )}

      {/* ══════════ Tab 3: Effectiveness ══════════ */}
      {tab === "effectiveness" && editAction && (
        <EffectivenessTab
          editAction={editAction}
          implementationNotes={implementationNotes}
          setImplementationNotes={setImplementationNotes}
          effectivenessRating={effectivenessRating}
          setEffectivenessRating={setEffectivenessRating}
          effectivenessNotes={effectivenessNotes}
          setEffectivenessNotes={setEffectivenessNotes}
          attachments={attachments}
          onFileUpload={handleFileUpload}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}

      {/* ══════════ Tab 4: Comments ══════════ */}
      {tab === "comments" && editAction && (
        <CommentsTab actionId={editAction.id} />
      )}

      {/* ══════════ Tab 5: History ══════════ */}
      {tab === "history" && editAction && (
        <HistoryTab history={editAction.history} />
      )}

      {/* ── Footer buttons ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <button type="button" className="btn" onClick={onCancel}>Anuluj</button>
        <button type="button" className="btn btn-primary" disabled={saving || !title.trim()} onClick={handleSave}>
          {saving ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj działanie"}
        </button>
      </div>

      {/* ── Change reason modal ── */}
      {showReasonModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }} onClick={() => setShowReasonModal(false)}>
          <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, maxWidth: 480, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--blue)" }}>Powód zmiany</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              Wykryto zmiany w śledzonych polach (tytuł, opis, termin, właściciel, status, priorytet, odpowiedzialny). Podaj uzasadnienie zmian — zostanie zapisane w historii.
            </div>
            <textarea
              className="form-control"
              rows={3}
              value={changeReason}
              onChange={e => setChangeReason(e.target.value)}
              placeholder="np. Przesunięcie terminu ze względu na brak zasobów..."
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" className="btn btn-sm" onClick={() => setShowReasonModal(false)}>Anuluj</button>
              <button type="button" className="btn btn-sm" style={{ color: "var(--text-muted)" }} onClick={() => { setShowReasonModal(false); doSubmit(); }}>Zapisz bez powodu</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={confirmReason} disabled={!changeReason.trim()}>Zapisz ze zmianami</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Tab 2: RiskLinkerTab — search + link risks
   ═══════════════════════════════════════════════════════════ */

function RiskLinkerTab({ allRisks, linkedRiskIds, setLinkedRiskIds, otherLinks }: {
  allRisks: Risk[];
  linkedRiskIds: number[];
  setLinkedRiskIds: (ids: number[]) => void;
  otherLinks: ActionLink[];
}) {
  const [search, setSearch] = useState("");

  const linkedRisks = allRisks.filter(r => linkedRiskIds.includes(r.id));
  const available = allRisks.filter(r => !linkedRiskIds.includes(r.id));

  const filtered = search.length >= 1
    ? available.filter(r => {
        const q = search.toLowerCase();
        return r.asset_name.toLowerCase().includes(q)
          || (r.code ?? `R-${r.id}`).toLowerCase().includes(q)
          || (r.org_unit_name ?? "").toLowerCase().includes(q)
          || (r.owner ?? "").toLowerCase().includes(q)
          || (r.risk_category_name ?? "").toLowerCase().includes(q);
      }).slice(0, 10)
    : [];

  const addRisk = (id: number) => { setLinkedRiskIds([...linkedRiskIds, id]); setSearch(""); };
  const removeRisk = (id: number) => setLinkedRiskIds(linkedRiskIds.filter(i => i !== id));

  return (
    <div>
      {/* ── Linked risks list ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
          Powiązane ryzyka ({linkedRisks.length})
        </div>
        {linkedRisks.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed var(--border)" }}>
            Brak powiązanych ryzyk. Wyszukaj i dodaj ryzyko poniżej.
          </div>
        )}
        {linkedRisks.map(risk => (
          <div key={risk.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 12px", borderRadius: 8, marginBottom: 6,
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>
                  {risk.code || `R-${risk.id}`}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{risk.asset_name}</span>
                {risk.risk_score != null && (
                  <span className="score-badge" style={{
                    background: `${riskScoreColor(risk.risk_score)}20`,
                    color: riskScoreColor(risk.risk_score),
                    fontSize: 10, padding: "1px 6px",
                  }}>
                    {risk.risk_score.toFixed(1)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                {risk.org_unit_name && <span>{risk.org_unit_name}</span>}
                {risk.risk_category_name && <span>{risk.risk_category_name}</span>}
                {risk.security_area_name && <span>{risk.security_area_name}</span>}
                {risk.status_name && <span>Status: {risk.status_name}</span>}
                {risk.owner && <span>Właśc.: {risk.owner}</span>}
              </div>
            </div>
            <button type="button" className="btn btn-sm" style={{ padding: "2px 8px", fontSize: 11, color: "var(--red)" }} onClick={() => removeRisk(risk.id)}>
              &#10005;
            </button>
          </div>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div style={{ position: "relative" }}>
        <input
          className="form-control"
          style={{ fontSize: 12 }}
          placeholder="Szukaj ryzyka po aktywie, kodzie, jednostce, właścicielu, kategorii..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* ── Search results dropdown ── */}
        {filtered.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
            maxHeight: 300, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", marginTop: 2,
          }}>
            {filtered.map(risk => (
              <div key={risk.id} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid rgba(42,53,84,0.12)" }}
                onClick={() => addRisk(risk.id)}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>
                    {risk.code || `R-${risk.id}`}
                  </span>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{risk.asset_name}</span>
                  {risk.risk_score != null && (
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: riskScoreColor(risk.risk_score) }}>
                      {risk.risk_score.toFixed(1)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", gap: 8, marginTop: 2 }}>
                  {risk.org_unit_name && <span>{risk.org_unit_name}</span>}
                  {risk.risk_category_name && <span>{risk.risk_category_name}</span>}
                  {risk.status_name && <span>{risk.status_name}</span>}
                  {risk.owner && <span>{risk.owner}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {search.length >= 1 && filtered.length === 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
            padding: "12px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", marginTop: 2,
            fontSize: 12, color: "var(--text-muted)", textAlign: "center",
          }}>
            Brak wyników dla "{search}"
          </div>
        )}
      </div>

      {/* ── Other (non-risk) links info ── */}
      {otherLinks.length > 0 && (
        <div style={{ marginTop: 16, padding: 10, background: "rgba(59,130,246,0.04)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.15)" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Inne powiązania (informacyjnie)</div>
          {otherLinks.map(l => (
            <div key={l.id} style={{ fontSize: 12, padding: "3px 0", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "var(--blue)", textTransform: "uppercase", fontWeight: 600 }}>
                {l.entity_type === "asset" ? "Aktyw" : l.entity_type === "incident" ? "Incydent" : l.entity_type === "audit" ? "Audyt" : l.entity_type === "policy_exception" ? "Wyjątek" : l.entity_type}
              </span>
              <span>{l.entity_name ?? `#${l.entity_id}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Tab 3: EffectivenessTab
   ═══════════════════════════════════════════════════════════ */

function EffectivenessTab({ editAction, implementationNotes, setImplementationNotes, effectivenessRating, setEffectivenessRating, effectivenessNotes, setEffectivenessNotes, attachments, onFileUpload, onDeleteAttachment }: {
  editAction: Action;
  implementationNotes: string;
  setImplementationNotes: (v: string) => void;
  effectivenessRating: number | null;
  setEffectivenessRating: (v: number | null) => void;
  effectivenessNotes: string;
  setEffectivenessNotes: (v: string) => void;
  attachments: ActionAttachment[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteAttachment: (id: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiUrl = (import.meta as any).env?.VITE_API_URL ?? "";

  const ratingLabels = ["", "1 — Minimalna", "2 — Niska", "3 — Średnia", "4 — Wysoka", "5 — Pełna"];

  return (
    <div>
      {editAction.completed_at && (
        <div style={{ marginBottom: 14, padding: 12, background: "rgba(52,211,153,0.08)", borderRadius: 8, border: "1px solid rgba(52,211,153,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="score-badge" style={{ background: "rgba(34,197,94,0.15)", color: "var(--green)", fontSize: 11 }}>Zamknięte</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {editAction.completed_at.slice(0, 10)}
            </span>
          </div>
        </div>
      )}

      <div className="form-group">
        <label>Opis zrealizowanych działań</label>
        <textarea
          className="form-control" rows={4}
          value={implementationNotes}
          onChange={e => setImplementationNotes(e.target.value)}
          placeholder="Opisz co zostało wykonane, jakie kroki podjęto, jakie wyniki osiągnięto..."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Ocena skuteczności mitygacji ryzyka (1-5)</label>
          <select className="form-control"
            value={effectivenessRating ?? ""}
            onChange={e => setEffectivenessRating(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Brak oceny</option>
            <option value="1">1 — Minimalna (działanie niemal bez efektu)</option>
            <option value="2">2 — Niska (częściowo zrealizowane)</option>
            <option value="3">3 — Średnia (zrealizowane, umiarkowany efekt)</option>
            <option value="4">4 — Wysoka (dobrze zrealizowane)</option>
            <option value="5">5 — Pełna (w pełni skuteczne)</option>
          </select>
        </div>
        {effectivenessRating != null && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: "100%", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden",
            }}>
              <div style={{
                width: `${effectivenessRating * 20}%`, height: "100%", borderRadius: 4,
                background: effectivenessRating >= 4 ? "var(--green)" : effectivenessRating >= 3 ? "var(--blue)" : effectivenessRating >= 2 ? "var(--orange)" : "var(--red)",
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>
              {ratingLabels[effectivenessRating]}
            </span>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Notatki dot. skuteczności</label>
        <textarea
          className="form-control" rows={2}
          value={effectivenessNotes}
          onChange={e => setEffectivenessNotes(e.target.value)}
          placeholder="Opisz rezultaty, co się udało, co można poprawić..."
        />
      </div>

      {/* ── Attachments ── */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Załączniki ({attachments.length})</label>
          <button type="button" className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
            + Dodaj załącznik
          </button>
          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={onFileUpload} />
        </div>

        {attachments.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed var(--border)" }}>
            Brak załączników. Dodaj pliki jako dowody realizacji działania.
          </div>
        )}
        {attachments.map(att => (
          <div key={att.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 12px", borderRadius: 6, marginBottom: 4,
            background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)",
          }}>
            <div>
              <a
                href={`${apiUrl}/api/v1/actions/${editAction.id}/attachments/${att.id}/download`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 500, color: "var(--blue)", textDecoration: "none" }}
              >
                {att.original_name}
              </a>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {formatFileSize(att.file_size)} | {att.created_at.slice(0, 16).replace("T", " ")}
              </div>
            </div>
            <button type="button" className="btn btn-sm" style={{ padding: "2px 6px", fontSize: 10, color: "var(--red)" }} onClick={() => onDeleteAttachment(att.id)}>
              &#10005;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Tab 4: CommentsTab — discussion thread
   ═══════════════════════════════════════════════════════════ */

function CommentsTab({ actionId }: { actionId: number }) {
  const [comments, setComments] = useState<ActionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const loadComments = useCallback(() => {
    api.get<ActionComment[]>(`/api/v1/actions/${actionId}/comments`)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actionId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const c = await api.post<ActionComment>(`/api/v1/actions/${actionId}/comments`, {
        content: newContent.trim(),
        author: newAuthor.trim() || null,
      });
      setComments(prev => [...prev, c]);
      setNewContent("");
    } catch (err) {
      alert("Błąd: " + err);
    }
    setSaving(false);
  };

  const handleUpdate = async (commentId: number) => {
    if (!editContent.trim()) return;
    try {
      const c = await api.put<ActionComment>(`/api/v1/actions/${actionId}/comments/${commentId}`, {
        content: editContent.trim(),
      });
      setComments(prev => prev.map(x => x.id === commentId ? c : x));
      setEditingId(null);
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm("Usunąć komentarz?")) return;
    try {
      await api.delete(`/api/v1/actions/${actionId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Ładowanie komentarzy...</div>;

  return (
    <div>
      {/* Comment list */}
      <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 16 }}>
        {comments.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed var(--border)" }}>
            Brak komentarzy. Dodaj pierwszy komentarz poniżej.
          </div>
        )}
        {comments.map(c => (
          <div key={c.id} style={{
            padding: "10px 12px", borderRadius: 8, marginBottom: 6,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(42,53,84,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)" }}>{c.author || "Anonim"}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.created_at.slice(0, 16).replace("T", " ")}</span>
                {c.updated_at !== c.created_at && <span style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>(edytowany)</span>}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" className="btn btn-sm" style={{ padding: "1px 6px", fontSize: 10 }} onClick={() => { setEditingId(c.id); setEditContent(c.content); }}>Edytuj</button>
                <button type="button" className="btn btn-sm" style={{ padding: "1px 6px", fontSize: 10, color: "var(--red)" }} onClick={() => handleDelete(c.id)}>Usuń</button>
              </div>
            </div>
            {editingId === c.id ? (
              <div>
                <textarea className="form-control" rows={2} value={editContent} onChange={e => setEditContent(e.target.value)} style={{ fontSize: 12 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setEditingId(null)}>Anuluj</button>
                  <button type="button" className="btn btn-sm btn-primary" style={{ fontSize: 10 }} onClick={() => handleUpdate(c.id)} disabled={!editContent.trim()}>Zapisz</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.content}</div>
            )}
          </div>
        ))}
      </div>

      {/* Add comment form */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Nowy komentarz</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input className="form-control" style={{ width: 180, fontSize: 11 }} placeholder="Autor (opcjonalnie)" value={newAuthor} onChange={e => setNewAuthor(e.target.value)} />
        </div>
        <textarea
          className="form-control" rows={3} style={{ fontSize: 12 }}
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Wpisz komentarz, uwagę, pytanie..."
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving || !newContent.trim()} onClick={handleAdd}>
            {saving ? "..." : "Dodaj komentarz"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Tab 5: HistoryTab — full change history
   ═══════════════════════════════════════════════════════════ */

function HistoryTab({ history }: { history: Action["history"] }) {
  if (history.length === 0) {
    return (
      <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Brak historii zmian. Zmiany będą rejestrowane automatycznie po pierwszej edycji.
      </div>
    );
  }

  // Group by created_at (same timestamp = same save operation)
  const groups: { timestamp: string; reason: string | null; entries: Action["history"] }[] = [];
  let currentTs = "";
  for (const h of history) {
    const ts = h.created_at.slice(0, 19); // group by second precision
    if (ts !== currentTs) {
      groups.push({ timestamp: ts, reason: h.change_reason, entries: [h] });
      currentTs = ts;
    } else {
      groups[groups.length - 1].entries.push(h);
      if (h.change_reason && !groups[groups.length - 1].reason) {
        groups[groups.length - 1].reason = h.change_reason;
      }
    }
  }

  return (
    <div style={{ maxHeight: 450, overflowY: "auto" }}>
      {groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(42,53,84,0.15)" }}>
          {/* Timestamp header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)" }}>
              {group.timestamp.replace("T", " ")}
            </span>
            {group.entries[0].changed_by && (
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{group.entries[0].changed_by}</span>
            )}
          </div>

          {/* Change reason */}
          {group.reason && (
            <div style={{ fontSize: 11, color: "var(--blue)", padding: "4px 8px", background: "rgba(59,130,246,0.06)", borderRadius: 4, marginBottom: 6, fontStyle: "italic" }}>
              Powód: {group.reason}
            </div>
          )}

          {/* Field changes */}
          {group.entries.map(h => (
            <div key={h.id} style={{ fontSize: 12, padding: "4px 0", display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
              <span style={{ color: "var(--blue)", fontWeight: 500, fontSize: 11 }}>
                {FIELD_LABELS[h.field_name] ?? h.field_name}
              </span>
              <div>
                {h.old_value && (
                  <div style={{ color: "var(--red)", fontSize: 11, textDecoration: "line-through", opacity: 0.8, wordBreak: "break-word" }}>
                    {h.old_value}
                  </div>
                )}
                {h.new_value && (
                  <div style={{ color: "var(--green)", fontSize: 11, wordBreak: "break-word" }}>
                    {h.new_value}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
