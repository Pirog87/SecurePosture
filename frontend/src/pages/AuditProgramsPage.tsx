import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import type { OrgUnitTreeNode } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

/* ─── Types ─── */
interface AuditProgram {
  id: number;
  ref_id: string;
  name: string;
  description: string | null;
  version: number;
  period_type: string;
  period_start: string;
  period_end: string;
  year: number | null;
  status: string;
  owner_id: number;
  approver_id: number;
  org_unit_id: number | null;
  owner_name: string | null;
  approver_name: string | null;
  org_unit_name: string | null;
  item_count: number;
  items_completed: number;
  items_in_progress: number;
  items_planned: number;
  items_cancelled: number;
  pending_cr_count: number;
  budget_planned_days: number | null;
  budget_planned_cost: number | null;
  budget_currency: string;
  strategic_objectives: string | null;
  scope_description: string | null;
  audit_criteria: string | null;
  methods: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProgramItem {
  id: number;
  audit_program_id: number;
  ref_id: string | null;
  name: string;
  description: string | null;
  audit_type: string;
  planned_quarter: number | null;
  planned_month: number | null;
  planned_start: string | null;
  planned_end: string | null;
  scope_type: string | null;
  scope_name: string | null;
  planned_days: number | null;
  planned_cost: number | null;
  priority: string;
  risk_rating: string | null;
  lead_auditor_id: number | null;
  lead_auditor_name: string | null;
  audit_method: string;
  item_status: string;
  display_order: number;
  created_at: string;
}

interface UserOption {
  id: number;
  display_name: string;
}

/* ─── Helpers ─── */
const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  submitted: "var(--purple)",
  approved: "var(--green)",
  in_execution: "var(--blue)",
  completed: "#6b7280",
  rejected: "var(--red)",
  archived: "#6b7280",
  superseded: "#a78bfa",
  deleted: "var(--red)",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  submitted: "Zgloszony",
  approved: "Zatwierdzony",
  in_execution: "W realizacji",
  completed: "Zakonczony",
  rejected: "Odrzucony",
  archived: "Archiwalny",
  superseded: "Zastapiony",
  deleted: "Usuniety",
};

const AUDIT_TYPE_LABELS: Record<string, string> = {
  compliance: "Zgodnosci",
  operational: "Operacyjny",
  financial: "Finansowy",
  it: "IT",
  security: "Bezpieczenstwa",
  supplier: "Dostawcy",
  process: "Procesowy",
  follow_up: "Nastepczy",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--blue)",
  low: "#94a3b8",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  planned: "Zaplanowany",
  in_progress: "W trakcie",
  completed: "Wykonany",
  cancelled: "Anulowany",
  deferred: "Odroczony",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  planned: "#94a3b8",
  in_progress: "var(--blue)",
  completed: "var(--green)",
  cancelled: "var(--red)",
  deferred: "var(--orange)",
};

const METHOD_LABELS: Record<string, string> = {
  on_site: "Na miejscu",
  remote: "Zdalnie",
  hybrid: "Hybrydowo",
  document_review: "Przeglad dokumentow",
};

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase",
      letterSpacing: "0.05em", marginTop: 16, marginBottom: 8, paddingBottom: 4,
      borderBottom: "1px solid rgba(59,130,246,0.2)",
    }}>
      {number} {label}
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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="badge" style={{ backgroundColor: `${color}20`, color }}>{label}</span>
  );
}

/* ═══════════════════════════════════════════════════════════
   AuditProgramsPage
   ═══════════════════════════════════════════════════════════ */
export default function AuditProgramsPage() {
  const COLUMNS: ColumnDef<AuditProgram>[] = [
    { key: "ref_id", header: "Ref", format: r => r.ref_id ?? "" },
    { key: "name", header: "Nazwa" },
    { key: "year", header: "Rok", format: r => r.year != null ? String(r.year) : "" },
    { key: "status", header: "Status", format: r => STATUS_LABELS[r.status] || r.status },
    { key: "item_count", header: "Pozycje", format: r => String(r.item_count) },
    { key: "owner_name", header: "Wlasciciel", format: r => r.owner_name ?? "" },
    { key: "approver_name", header: "Zatwierdzajacy", format: r => r.approver_name ?? "", defaultVisible: false },
    { key: "org_unit_name", header: "Jedn. org.", format: r => r.org_unit_name ?? "", defaultVisible: false },
    { key: "period_start", header: "Okres od", format: r => r.period_start ?? "", defaultVisible: false },
    { key: "period_end", header: "Okres do", format: r => r.period_end ?? "", defaultVisible: false },
    { key: "budget_planned_days", header: "Budzet (dni)", format: r => r.budget_planned_days != null ? String(r.budget_planned_days) : "", defaultVisible: false },
    { key: "version", header: "Wersja", format: r => `v${r.version}`, defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "audit-programs-v2");

  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditProgram | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AuditProgram | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving] = useState(false);

  // Items for selected program
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgramItem | null>(null);

  // Workflow dialogs
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveJustification, setApproveJustification] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [workflowBusy, setWorkflowBusy] = useState(false);

  // Version history
  const [versions, setVersions] = useState<{ id: number; version: number; status: string; is_current_version: boolean; correction_reason: string | null; approved_at: string | null; created_at: string | null }[]>([]);

  // Lookups
  const [users, setUsers] = useState<UserOption[]>([]);
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);

  const table = useTableFeatures<AuditProgram>({
    data: programs,
    storageKey: "audit-programs-v2",
    defaultSort: "created_at",
    defaultSortDir: "desc",
  });

  const load = () => {
    setLoading(true);
    api.get<AuditProgram[]>("/api/v1/audit-programs")
      .then(setPrograms)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadItems = (programId: number) => {
    setItemsLoading(true);
    api.get<ProgramItem[]>(`/api/v1/audit-programs/${programId}/items`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setItemsLoading(false));
  };

  useEffect(() => {
    load();
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
    api.get<{ users: UserOption[] }>("/api/v1/audit-programs/lookups")
      .then(d => setUsers(d.users))
      .catch(() => {});
  }, []);

  // Load items + versions when selection changes
  useEffect(() => {
    if (selected) {
      loadItems(selected.id);
      api.get<typeof versions>(`/api/v1/audit-programs/${selected.id}/versions`)
        .then(setVersions).catch(() => setVersions([]));
    } else {
      setItems([]);
      setVersions([]);
    }
  }, [selected?.id]);

  /* ── Stats ── */
  const isFiltered = table.filteredCount !== table.totalCount;
  const statsCards: StatCard[] = useMemo(() => {
    const src = table.filtered;
    const draftCount = src.filter(p => p.status === "draft").length;
    const activeCount = src.filter(p => ["approved", "in_execution"].includes(p.status)).length;
    const totalItems = src.reduce((s, p) => s + p.item_count, 0);
    const completedItems = src.reduce((s, p) => s + p.items_completed, 0);

    const allDraft = programs.filter(p => p.status === "draft").length;
    const allActive = programs.filter(p => ["approved", "in_execution"].includes(p.status)).length;
    const allTotalItems = programs.reduce((s, p) => s + p.item_count, 0);
    const allCompletedItems = programs.reduce((s, p) => s + p.items_completed, 0);

    return [
      { label: "Programy ogolem", value: src.length, total: programs.length, color: "var(--blue)" },
      { label: "Szkice", value: draftCount, total: allDraft, color: "#94a3b8" },
      { label: "Aktywne", value: activeCount, total: allActive, color: "var(--green)" },
      { label: "Pozycje / wykonane", value: `${totalItems} / ${completedItems}`, total: `${allTotalItems} / ${allCompletedItems}`, color: "var(--purple)" },
    ];
  }, [table.filtered, programs]);

  /* ── Program form ── */
  const openAddForm = () => {
    setEditingProgram(null);
    setShowModal(true);
  };

  const openEditForm = (p: AuditProgram) => {
    setEditingProgram(p);
    setShowModal(true);
  };

  /* ── Workflow actions ── */
  const refreshSelected = async (id: number) => {
    try {
      const updated = await api.get<AuditProgram>(`/api/v1/audit-programs/${id}`);
      setSelected(updated);
      load();
      loadItems(id);
    } catch { /* ignore */ }
  };

  const doWorkflow = async (action: string, body?: Record<string, unknown>) => {
    if (!selected) return;
    setWorkflowBusy(true);
    try {
      await api.post(`/api/v1/audit-programs/${selected.id}/${action}`, body ?? {});
      await refreshSelected(selected.id);
    } catch (err) {
      alert("Blad: " + err);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const doItemAction = async (itemId: number, action: string) => {
    if (!selected) return;
    setWorkflowBusy(true);
    try {
      await api.post(`/api/v1/audit-program-items/${itemId}/${action}`, {});
      await refreshSelected(selected.id);
    } catch (err) {
      alert("Blad: " + err);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const sel = selected;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      <TableToolbar<AuditProgram>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="programow"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj programow..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="programy_audytow"
        primaryLabel="Nowy program"
        onPrimaryAction={openAddForm}
      />

      <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 420px" : "1fr", gap: 14, marginTop: 2 }}>
        <DataTable<AuditProgram>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={sel?.id ?? null}
          onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
          renderCell={(row, colKey) => {
            if (colKey === "ref_id") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{row.ref_id}</span>;
            if (colKey === "name") return <span style={{ fontWeight: 600 }}>{row.name}</span>;
            if (colKey === "status") {
              const c = STATUS_COLORS[row.status] || "#94a3b8";
              return <Badge label={STATUS_LABELS[row.status] || row.status} color={c} />;
            }
            if (colKey === "item_count") {
              const done = row.items_completed;
              const total = row.item_count;
              return (
                <span style={{ fontWeight: 600, color: total > 0 ? "var(--blue)" : "var(--text-muted)" }}>
                  {done}/{total}
                </span>
              );
            }
            if (colKey === "version") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>v{row.version}</span>;
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
          emptyMessage="Brak programow audytow. Utworz roczny plan audytow."
        />

        {/* ── Detail panel ── */}
        {sel && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{sel.name}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge label={STATUS_LABELS[sel.status] || sel.status} color={STATUS_COLORS[sel.status] || "#94a3b8"} />
                  {sel.year && <Badge label={String(sel.year)} color="var(--blue)" />}
                  <Badge label={`v${sel.version}`} color="var(--purple)" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {sel.status === "draft" && (
                  <button className="btn btn-xs btn-primary" onClick={() => openEditForm(sel)}>Edytuj</button>
                )}
                <button className="btn btn-xs" onClick={() => setSelected(null)}>&#10005;</button>
              </div>
            </div>

            {/* Progress ring */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--blue)" }}>
                {sel.items_completed}<span style={{ fontSize: 18, color: "var(--text-muted)", fontWeight: 400 }}>/{sel.item_count}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pozycji wykonanych</div>
              {sel.item_count > 0 && (
                <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: "var(--bg-inset)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${Math.round((sel.items_completed / sel.item_count) * 100)}%`,
                    background: "var(--green)",
                    transition: "width 0.3s",
                  }} />
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={"\u2460"} label="Informacje" />
              <DetailRow label="Ref" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{sel.ref_id}</span>} />
              <DetailRow label="Wlasciciel" value={sel.owner_name} />
              <DetailRow label="Zatwierdzajacy" value={sel.approver_name} />
              <DetailRow label="Jedn. org." value={sel.org_unit_name} />
              <DetailRow label="Okres" value={`${sel.period_start} \u2014 ${sel.period_end}`} />
              {sel.budget_planned_days != null && (
                <DetailRow label="Budzet (dni)" value={sel.budget_planned_days} />
              )}
              {sel.budget_planned_cost != null && (
                <DetailRow label="Budzet (koszt)" value={`${sel.budget_planned_cost} ${sel.budget_currency}`} />
              )}

              {sel.scope_description && (
                <>
                  <SectionHeader number={"\u2461"} label="Zakres" />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset)", borderRadius: 6, padding: 8, marginBottom: 4 }}>
                    {sel.scope_description}
                  </div>
                </>
              )}

              {/* Items section */}
              <SectionHeader number={"\u2462"} label={`Pozycje programu (${sel.item_count})`} />
            </div>

            {/* Rejection notice */}
            {sel.rejection_reason && sel.status === "draft" && (
              <div style={{
                padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 8,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              }}>
                <div style={{ fontWeight: 600, color: "var(--red)", marginBottom: 2 }}>Powod odrzucenia:</div>
                <div style={{ color: "var(--text-secondary)" }}>{sel.rejection_reason}</div>
              </div>
            )}

            {itemsLoading ? (
              <div style={{ textAlign: "center", padding: 12, color: "var(--text-muted)", fontSize: 12 }}>Ladowanie pozycji...</div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: "center", padding: 12, color: "var(--text-muted)", fontSize: 12 }}>Brak pozycji</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: "8px 10px", borderRadius: 6,
                      background: "var(--bg-inset)",
                      borderLeft: `3px solid ${ITEM_STATUS_COLORS[item.item_status] || "#94a3b8"}`,
                      fontSize: 12,
                      cursor: sel.status === "draft" ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (sel.status === "draft") {
                        setEditingItem(item);
                        setShowItemModal(true);
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: 600, marginRight: 6 }}>{item.name}</span>
                        {item.ref_id && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>{item.ref_id}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {/* Item lifecycle buttons for approved/in_execution programs */}
                        {["approved", "in_execution"].includes(sel.status) && item.item_status === "planned" && (
                          <button
                            className="btn btn-xs"
                            style={{ fontSize: 10, padding: "1px 6px" }}
                            onClick={(e) => { e.stopPropagation(); doItemAction(item.id, "start"); }}
                            disabled={workflowBusy}
                          >
                            Rozpocznij
                          </button>
                        )}
                        {["approved", "in_execution"].includes(sel.status) && item.item_status === "in_progress" && (
                          <button
                            className="btn btn-xs"
                            style={{ fontSize: 10, padding: "1px 6px", color: "var(--green)" }}
                            onClick={(e) => { e.stopPropagation(); doItemAction(item.id, "complete"); }}
                            disabled={workflowBusy}
                          >
                            Zakoncz
                          </button>
                        )}
                        <Badge label={ITEM_STATUS_LABELS[item.item_status] || item.item_status} color={ITEM_STATUS_COLORS[item.item_status] || "#94a3b8"} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, color: "var(--text-muted)", fontSize: 11 }}>
                      <span>{AUDIT_TYPE_LABELS[item.audit_type] || item.audit_type}</span>
                      {item.planned_quarter && <span>Q{item.planned_quarter}</span>}
                      {item.lead_auditor_name && <span>{item.lead_auditor_name}</span>}
                      <span style={{ color: PRIORITY_COLORS[item.priority] || "var(--text-muted)" }}>
                        {item.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sel.status === "draft" && (
              <button
                className="btn btn-sm"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => { setEditingItem(null); setShowItemModal(true); }}
              >
                + Dodaj pozycje
              </button>
            )}

            {/* ── Workflow Actions ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              {/* draft → submit / edit / delete */}
              {sel.status === "draft" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ flex: 2 }}
                    onClick={() => doWorkflow("submit")}
                    disabled={workflowBusy || sel.item_count === 0}
                    title={sel.item_count === 0 ? "Dodaj co najmniej 1 pozycje" : "Zloz do zatwierdzenia"}
                  >
                    Zloz do zatwierdzenia
                  </button>
                  <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => openEditForm(sel)}>Edytuj</button>
                  {sel.version === 1 && (
                    <button
                      className="btn btn-sm"
                      style={{ color: "var(--red)" }}
                      onClick={async () => {
                        if (!confirm(`Usunac program ${sel.ref_id}?`)) return;
                        try {
                          await api.delete(`/api/v1/audit-programs/${sel.id}`);
                          setSelected(null);
                          load();
                        } catch (err) {
                          alert("Blad: " + err);
                        }
                      }}
                    >
                      Usun
                    </button>
                  )}
                </div>
              )}

              {/* submitted → approve / reject */}
              {sel.status === "submitted" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ flex: 1, background: "var(--green)", borderColor: "var(--green)" }}
                    onClick={() => {
                      if (sel.version > 1) {
                        setApproveJustification("");
                        setShowApproveModal(true);
                      } else {
                        doWorkflow("approve", { approval_justification: null });
                      }
                    }}
                    disabled={workflowBusy}
                  >
                    Zatwierdz
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1, color: "var(--red)", borderColor: "var(--red)" }}
                    onClick={() => { setRejectReason(""); setShowRejectModal(true); }}
                    disabled={workflowBusy}
                  >
                    Odrzuc
                  </button>
                </div>
              )}

              {/* approved/in_execution → initiate correction */}
              {["approved", "in_execution"].includes(sel.status) && (
                <div style={{ display: "flex", gap: 8 }}>
                  {sel.status === "in_execution" && (
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => doWorkflow("complete")}
                      disabled={workflowBusy}
                      title="Wszystkie pozycje musza byc zakonczone/anulowane/odroczone"
                    >
                      Zakoncz program
                    </button>
                  )}
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1, color: "var(--purple)", borderColor: "var(--purple)" }}
                    onClick={() => { setCorrectionReason(""); setShowCorrectionModal(true); }}
                    disabled={workflowBusy}
                  >
                    Inicjuj korekta
                  </button>
                </div>
              )}

              {/* completed → archive */}
              {sel.status === "completed" && (
                <button
                  className="btn btn-sm"
                  style={{ width: "100%" }}
                  onClick={() => doWorkflow("archive")}
                  disabled={workflowBusy}
                >
                  Archiwizuj
                </button>
              )}

              {/* Status info for terminal/waiting states */}
              {sel.status === "submitted" && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  Oczekuje na zatwierdzenie przez: {sel.approver_name}
                </div>
              )}
              {sel.status === "approved" && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  Zatwierdzony. Rozpocznij audyty aby przejsc do realizacji.
                </div>
              )}
            </div>

            {/* ── Version history ── */}
            {versions.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <SectionHeader number={"\u2463"} label={`Historia wersji (${versions.length})`} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {versions.map(v => (
                    <div
                      key={v.id}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "6px 8px", borderRadius: 4, fontSize: 11,
                        background: v.id === sel.id ? "rgba(59,130,246,0.1)" : "var(--bg-inset)",
                        border: v.is_current_version ? "1px solid var(--blue)" : "1px solid transparent",
                        cursor: v.id !== sel.id ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (v.id !== sel.id) {
                          api.get<AuditProgram>(`/api/v1/audit-programs/${v.id}`)
                            .then(p => setSelected(p))
                            .catch(() => {});
                        }
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>v{v.version}</span>
                        {v.is_current_version && <span style={{ fontSize: 9, color: "var(--blue)", marginLeft: 4 }}>aktualna</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Badge label={STATUS_LABELS[v.status] || v.status} color={STATUS_COLORS[v.status] || "#94a3b8"} />
                        <span style={{ color: "var(--text-muted)" }}>{v.created_at?.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Program Create/Edit Modal ── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingProgram(null); }}
        title={editingProgram ? `Edycja: ${editingProgram.ref_id}` : "Nowy program audytow"}
        wide
      >
        <ProgramForm
          users={users}
          orgTree={orgTree}
          editingProgram={editingProgram}
          saving={saving}
          onSubmit={async (data) => {
            setSaving(true);
            try {
              if (editingProgram) {
                await api.put(`/api/v1/audit-programs/${editingProgram.id}`, data);
              } else {
                await api.post("/api/v1/audit-programs", data);
              }
              setShowModal(false);
              setEditingProgram(null);
              setSelected(null);
              load();
            } catch (err) {
              alert("Blad zapisu: " + err);
            } finally {
              setSaving(false);
            }
          }}
          onCancel={() => { setShowModal(false); setEditingProgram(null); }}
        />
      </Modal>

      {/* ── Item Create/Edit Modal ── */}
      <Modal
        open={showItemModal}
        onClose={() => { setShowItemModal(false); setEditingItem(null); }}
        title={editingItem ? `Edycja pozycji: ${editingItem.ref_id ?? ""}` : "Nowa pozycja programu"}
        wide
      >
        {sel && (
          <ItemForm
            users={users}
            editingItem={editingItem}
            saving={saving}
            onSubmit={async (data) => {
              setSaving(true);
              try {
                if (editingItem) {
                  await api.put(`/api/v1/audit-program-items/${editingItem.id}`, data);
                } else {
                  await api.post(`/api/v1/audit-programs/${sel.id}/items`, data);
                }
                setShowItemModal(false);
                setEditingItem(null);
                loadItems(sel.id);
                load(); // refresh item counts
              } catch (err) {
                alert("Blad zapisu: " + err);
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => { setShowItemModal(false); setEditingItem(null); }}
          />
        )}
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Odrzucenie programu"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Podaj powod odrzucenia programu. Program wrocido statusu "Szkic" i bedzie mogl byc poprawiony.
          </p>
          <label style={{ fontSize: 13 }}>
            Powod odrzucenia *
            <textarea
              className="form-control"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Opisz powod odrzucenia (min. 3 znaki)..."
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setShowRejectModal(false)}>Anuluj</button>
            <button
              className="btn btn-primary"
              style={{ background: "var(--red)", borderColor: "var(--red)" }}
              disabled={rejectReason.trim().length < 3 || workflowBusy}
              onClick={async () => {
                await doWorkflow("reject", { rejection_reason: rejectReason.trim() });
                setShowRejectModal(false);
              }}
            >
              {workflowBusy ? "Odrzucanie..." : "Odrzuc program"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Approve Modal (for v2+ requiring justification) ── */}
      <Modal
        open={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Zatwierdzenie korekty programu"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            To jest wersja {sel?.version} programu. Uzasadnienie zatwierdzenia jest wymagane dla korekt.
          </p>
          <label style={{ fontSize: 13 }}>
            Uzasadnienie zatwierdzenia *
            <textarea
              className="form-control"
              value={approveJustification}
              onChange={e => setApproveJustification(e.target.value)}
              rows={3}
              placeholder="Dlaczego zatwierdzasz te korekta..."
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setShowApproveModal(false)}>Anuluj</button>
            <button
              className="btn btn-primary"
              style={{ background: "var(--green)", borderColor: "var(--green)" }}
              disabled={!approveJustification.trim() || workflowBusy}
              onClick={async () => {
                await doWorkflow("approve", { approval_justification: approveJustification.trim() });
                setShowApproveModal(false);
              }}
            >
              {workflowBusy ? "Zatwierdzanie..." : "Zatwierdz"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Correction Modal ── */}
      <Modal
        open={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        title="Inicjacja korekty programu"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Korekta utworzy nowa wersje (v{(sel?.version ?? 0) + 1}) programu jako kopie w statusie "Szkic".
            Obecna wersja zostanie oznaczona jako "Zastapiona".
          </p>
          <label style={{ fontSize: 13 }}>
            Uzasadnienie korekty * (min. 10 znakow)
            <textarea
              className="form-control"
              value={correctionReason}
              onChange={e => setCorrectionReason(e.target.value)}
              rows={3}
              placeholder="Opisz powod korekty, np. zmiana zakresu, dodanie nowych audytow..."
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setShowCorrectionModal(false)}>Anuluj</button>
            <button
              className="btn btn-primary"
              style={{ background: "var(--purple)", borderColor: "var(--purple)" }}
              disabled={correctionReason.trim().length < 10 || workflowBusy}
              onClick={async () => {
                setWorkflowBusy(true);
                try {
                  const newProg = await api.post<AuditProgram>(
                    `/api/v1/audit-programs/${sel!.id}/initiate-correction`,
                    { correction_reason: correctionReason.trim() },
                  );
                  setShowCorrectionModal(false);
                  setSelected(newProg);
                  load();
                } catch (err) {
                  alert("Blad: " + err);
                } finally {
                  setWorkflowBusy(false);
                }
              }}
            >
              {workflowBusy ? "Tworzenie korekty..." : "Utworz korekta"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   ProgramForm — create / edit audit program
   ═══════════════════════════════════════════════════════════ */
interface ProgramFormProps {
  users: UserOption[];
  orgTree: OrgUnitTreeNode[];
  editingProgram: AuditProgram | null;
  saving: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

function ProgramForm({ users, orgTree, editingProgram, saving, onSubmit, onCancel }: ProgramFormProps) {
  const now = new Date();
  const yr = now.getFullYear();

  const [name, setName] = useState(editingProgram?.name ?? "");
  const [description, setDescription] = useState(editingProgram?.description ?? "");
  const [periodType, setPeriodType] = useState(editingProgram?.period_type ?? "annual");
  const [periodStart, setPeriodStart] = useState(editingProgram?.period_start ?? `${yr}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(editingProgram?.period_end ?? `${yr}-12-31`);
  const [year, setYear] = useState(editingProgram?.year ?? yr);
  const [ownerId, setOwnerId] = useState(editingProgram?.owner_id ?? (users[0]?.id ?? 1));
  const [approverId, setApproverId] = useState(editingProgram?.approver_id ?? (users[1]?.id ?? 2));
  const [orgUnitId, setOrgUnitId] = useState<number | null>(editingProgram?.org_unit_id ?? null);
  const [budgetDays, setBudgetDays] = useState(editingProgram?.budget_planned_days != null ? String(editingProgram.budget_planned_days) : "");
  const [budgetCost, setBudgetCost] = useState(editingProgram?.budget_planned_cost != null ? String(editingProgram.budget_planned_cost) : "");
  const [scope, setScope] = useState(editingProgram?.scope_description ?? "");
  const [objectives, setObjectives] = useState(editingProgram?.strategic_objectives ?? "");
  const [criteria, setCriteria] = useState(editingProgram?.audit_criteria ?? "");
  const [methods, setMethods] = useState(editingProgram?.methods ?? "");

  const canSubmit = name.trim().length > 0 && ownerId !== approverId;

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      name: name.trim(),
      description: description || null,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      year,
      owner_id: ownerId,
      approver_id: approverId,
      org_unit_id: orgUnitId,
      budget_planned_days: budgetDays ? Number(budgetDays) : null,
      budget_planned_cost: budgetCost ? Number(budgetCost) : null,
      scope_description: scope || null,
      strategic_objectives: objectives || null,
      audit_criteria: criteria || null,
      methods: methods || null,
    };
    onSubmit(data);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Left column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          Nazwa *
          <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="np. Program Audytow IT 2026" />
        </label>
        <label style={{ fontSize: 13 }}>
          Opis
          <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Typ okresu
            <select className="form-control" value={periodType} onChange={e => setPeriodType(e.target.value)}>
              <option value="annual">Roczny</option>
              <option value="semi_annual">Polroczny</option>
              <option value="quarterly">Kwartalny</option>
              <option value="custom">Niestandardowy</option>
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Okres od
            <input className="form-control" type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
          </label>
          <label style={{ fontSize: 13 }}>
            Okres do
            <input className="form-control" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </label>
        </div>
        <label style={{ fontSize: 13 }}>
          Rok
          <input className="form-control" type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 13 }}>
          Cele strategiczne
          <textarea className="form-control" value={objectives} onChange={e => setObjectives(e.target.value)} rows={2} />
        </label>
        <label style={{ fontSize: 13 }}>
          Kryteria audytu
          <textarea className="form-control" value={criteria} onChange={e => setCriteria(e.target.value)} rows={2} />
        </label>
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          Wlasciciel programu *
          <select
            className="form-control"
            value={ownerId}
            onChange={e => setOwnerId(Number(e.target.value))}
            style={ownerId === approverId ? { border: "1px solid var(--red)", boxShadow: "0 0 0 3px var(--red-dim)" } : {}}
          >
            {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Zatwierdzajacy *
          <select
            className="form-control"
            value={approverId}
            onChange={e => setApproverId(Number(e.target.value))}
            style={ownerId === approverId ? { border: "1px solid var(--red)", boxShadow: "0 0 0 3px var(--red-dim)" } : {}}
          >
            {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
          {ownerId === approverId && <span style={{ fontSize: 11, color: "var(--red)" }}>Wlasciciel i zatwierdzajacy musza byc rozni</span>}
        </label>
        <label style={{ fontSize: 13 }}>
          Jednostka organizacyjna
          <OrgUnitTreeSelect tree={orgTree} value={orgUnitId} onChange={setOrgUnitId} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Budzet (osobodni)
            <input className="form-control" type="number" value={budgetDays} onChange={e => setBudgetDays(e.target.value)} placeholder="np. 120" />
          </label>
          <label style={{ fontSize: 13 }}>
            Budzet (koszt PLN)
            <input className="form-control" type="number" value={budgetCost} onChange={e => setBudgetCost(e.target.value)} placeholder="np. 150000" />
          </label>
        </div>
        <label style={{ fontSize: 13 }}>
          Zakres audytu
          <textarea className="form-control" value={scope} onChange={e => setScope(e.target.value)} rows={2} />
        </label>
        <label style={{ fontSize: 13 }}>
          Metody
          <textarea className="form-control" value={methods} onChange={e => setMethods(e.target.value)} rows={2} />
        </label>
      </div>

      {/* Footer */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? "Zapisywanie..." : editingProgram ? "Zapisz zmiany" : "Utworz program"}
        </button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   ItemForm — create / edit program item
   ═══════════════════════════════════════════════════════════ */
interface ItemFormProps {
  users: UserOption[];
  editingItem: ProgramItem | null;
  saving: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

function ItemForm({ users, editingItem, saving, onSubmit, onCancel }: ItemFormProps) {
  const [name, setName] = useState(editingItem?.name ?? "");
  const [description, setDescription] = useState(editingItem?.description ?? "");
  const [auditType, setAuditType] = useState(editingItem?.audit_type ?? "compliance");
  const [plannedQuarter, setPlannedQuarter] = useState(editingItem?.planned_quarter ?? 1);
  const [plannedStart, setPlannedStart] = useState(editingItem?.planned_start ?? "");
  const [plannedEnd, setPlannedEnd] = useState(editingItem?.planned_end ?? "");
  const [scopeType, setScopeType] = useState(editingItem?.scope_type ?? "");
  const [scopeName, setScopeName] = useState(editingItem?.scope_name ?? "");
  const [plannedDays, setPlannedDays] = useState(editingItem?.planned_days != null ? String(editingItem.planned_days) : "");
  const [priority, setPriority] = useState(editingItem?.priority ?? "medium");
  const [riskRating, setRiskRating] = useState(editingItem?.risk_rating ?? "");
  const [leadAuditorId, setLeadAuditorId] = useState<number | null>(editingItem?.lead_auditor_id ?? null);
  const [auditMethod, setAuditMethod] = useState(editingItem?.audit_method ?? "on_site");

  const canSubmit = name.trim().length > 0;

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      name: name.trim(),
      description: description || null,
      audit_type: auditType,
      planned_quarter: plannedQuarter || null,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      scope_type: scopeType || null,
      scope_name: scopeName || null,
      planned_days: plannedDays ? Number(plannedDays) : null,
      priority,
      risk_rating: riskRating || null,
      lead_auditor_id: leadAuditorId,
      audit_method: auditMethod,
    };
    onSubmit(data);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Left */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          Nazwa audytu *
          <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="np. Audyt SZBI" />
        </label>
        <label style={{ fontSize: 13 }}>
          Opis
          <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Typ audytu
            <select className="form-control" value={auditType} onChange={e => setAuditType(e.target.value)}>
              {Object.entries(AUDIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Kwartal
            <select className="form-control" value={plannedQuarter} onChange={e => setPlannedQuarter(Number(e.target.value))}>
              <option value={1}>Q1</option>
              <option value={2}>Q2</option>
              <option value={3}>Q3</option>
              <option value={4}>Q4</option>
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Data od
            <input className="form-control" type="date" value={plannedStart} onChange={e => setPlannedStart(e.target.value)} />
          </label>
          <label style={{ fontSize: 13 }}>
            Data do
            <input className="form-control" type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Priorytet
            <select className="form-control" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="critical">Krytyczny</option>
              <option value="high">Wysoki</option>
              <option value="medium">Sredni</option>
              <option value="low">Niski</option>
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Ocena ryzyka
            <select className="form-control" value={riskRating} onChange={e => setRiskRating(e.target.value)}>
              <option value="">-- brak --</option>
              <option value="critical">Krytyczne</option>
              <option value="high">Wysokie</option>
              <option value="medium">Srednie</option>
              <option value="low">Niskie</option>
            </select>
          </label>
        </div>
        <label style={{ fontSize: 13 }}>
          Audytor wiodacy
          <select className="form-control" value={leadAuditorId ?? ""} onChange={e => setLeadAuditorId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">-- brak --</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Metoda
          <select className="form-control" value={auditMethod} onChange={e => setAuditMethod(e.target.value)}>
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Typ zakresu
            <select className="form-control" value={scopeType} onChange={e => setScopeType(e.target.value)}>
              <option value="">-- brak --</option>
              <option value="org_unit">Jednostka org.</option>
              <option value="process">Proces</option>
              <option value="system">System</option>
              <option value="supplier">Dostawca</option>
              <option value="location">Lokalizacja</option>
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Nazwa zakresu
            <input className="form-control" value={scopeName} onChange={e => setScopeName(e.target.value)} placeholder="np. Dz. IT" />
          </label>
        </div>
        <label style={{ fontSize: 13 }}>
          Planowane osobodni
          <input className="form-control" type="number" value={plannedDays} onChange={e => setPlannedDays(e.target.value)} placeholder="np. 10" />
        </label>
      </div>

      {/* Footer */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? "Zapisywanie..." : editingItem ? "Zapisz zmiany" : "Dodaj pozycje"}
        </button>
      </div>
    </div>
  );
}
