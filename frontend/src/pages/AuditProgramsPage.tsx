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
  budget_actual_days: number;
  budget_planned_cost: number | null;
  budget_actual_cost: number;
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

interface VersionDiff {
  id: number;
  from_version_id: number;
  to_version_id: number;
  from_version: number;
  to_version: number;
  program_field_changes: Record<string, { from: string | null; to: string | null }>;
  items_added: { ref_id: string; name: string; audit_type: string }[];
  items_removed: { ref_id: string; name: string; audit_type: string }[];
  items_modified: { ref_id: string; name: string; changes: Record<string, { from: string | null; to: string | null }> }[];
  items_unchanged: number;
  summary: string;
  generated_at: string | null;
}

interface ChangeRequest {
  id: number;
  audit_program_id: number;
  ref_id: string;
  title: string;
  change_type: string;
  justification: string;
  change_description: string;
  impact_assessment: string | null;
  affected_item_id: number | null;
  proposed_changes: Record<string, unknown> | null;
  status: string;
  requested_by: number;
  requested_by_name: string | null;
  requested_at: string;
  submitted_at: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_comment: string | null;
  resulting_version_id: number | null;
  implemented_at: string | null;
  created_at: string;
}

interface HistoryEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  description: string | null;
  justification: string | null;
  field_changes: Record<string, { old: string; new: string }> | null;
  performed_by: number;
  performed_by_name: string | null;
  performed_at: string | null;
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

const FIELD_LABELS: Record<string, string> = {
  name: "Nazwa", description: "Opis", period_type: "Typ okresu",
  period_start: "Okres od", period_end: "Okres do", year: "Rok",
  strategic_objectives: "Cele strategiczne", risks_and_opportunities: "Ryzyka i szanse",
  scope_description: "Zakres", audit_criteria: "Kryteria audytu",
  methods: "Metody", risk_assessment_ref: "Ref. oceny ryzyka",
  budget_planned_days: "Budzet (dni)", budget_planned_cost: "Budzet (koszt)",
  budget_currency: "Waluta", owner_id: "Wlasciciel (ID)", approver_id: "Zatwierdzajacy (ID)",
  org_unit_id: "Jedn. org. (ID)", audit_type: "Typ audytu",
  planned_quarter: "Kwartal", planned_month: "Miesiac",
  planned_start: "Data od", planned_end: "Data do",
  scope_type: "Typ zakresu", scope_name: "Nazwa zakresu",
  planned_days: "Osobodni", planned_cost: "Koszt",
  priority: "Priorytet", risk_rating: "Ocena ryzyka",
  lead_auditor_id: "Audytor wiodacy (ID)", audit_method: "Metoda",
  display_order: "Kolejnosc",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Utworzono", updated: "Zaktualizowano", deleted: "Usunieto",
  status_changed: "Zmiana statusu", submitted: "Zlozono", approved: "Zatwierdzono",
  rejected: "Odrzucono", correction_initiated: "Korekta", version_created: "Nowa wersja",
  item_added: "Dodano pozycje", item_removed: "Usunieto pozycje", item_modified: "Zmodyfikowano pozycje",
  item_transferred_out: "Transfer (wyjscie)", item_transferred_in: "Transfer (wejscie)",
  cr_submitted: "CR zlozono", cr_approved: "CR zatwierdzono", cr_rejected: "CR odrzucono", cr_implemented: "CR wdrozono",
};

const ACTION_COLORS: Record<string, string> = {
  created: "var(--green)", updated: "var(--blue)", deleted: "var(--red)",
  status_changed: "var(--purple)", submitted: "var(--purple)", approved: "var(--green)",
  rejected: "var(--red)", correction_initiated: "var(--orange)", version_created: "var(--purple)",
  item_added: "var(--green)", item_removed: "var(--red)", item_modified: "var(--blue)",
};

const CR_TYPE_LABELS: Record<string, string> = {
  add_audit: "Dodanie audytu", remove_audit: "Usuniecie audytu", modify_audit: "Modyfikacja audytu",
  modify_schedule: "Zmiana harmonogramu", modify_scope: "Zmiana zakresu", modify_budget: "Zmiana budzetu",
  modify_team: "Zmiana zespolu", other: "Inna",
};

const CR_STATUS_LABELS: Record<string, string> = {
  draft: "Szkic", submitted: "Zlozony", approved: "Zatwierdzony",
  rejected: "Odrzucony", implemented: "Wdrozony", cancelled: "Anulowany",
};

const CR_STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", submitted: "var(--purple)", approved: "var(--green)",
  rejected: "var(--red)", implemented: "var(--blue)", cancelled: "#6b7280",
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

  // Version history & diffs
  const [versions, setVersions] = useState<{ id: number; version: number; status: string; is_current_version: boolean; correction_reason: string | null; approved_at: string | null; created_at: string | null }[]>([]);
  const [diffs, setDiffs] = useState<VersionDiff[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<VersionDiff | null>(null);

  // Audit trail
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");

  // Change Requests
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showCRModal, setShowCRModal] = useState(false);
  const [showCRRejectModal, setShowCRRejectModal] = useState<ChangeRequest | null>(null);
  const [crRejectComment, setCrRejectComment] = useState("");

  // Transfer
  const [showTransferModal, setShowTransferModal] = useState<ProgramItem | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [transferJustification, setTransferJustification] = useState("");
  const [draftPrograms, setDraftPrograms] = useState<AuditProgram[]>([]);

  // AI (Krok 8)
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiFeatures, setAiFeatures] = useState<Record<string, boolean>>({});
  const [showAISuggest, setShowAISuggest] = useState(false);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, unknown>[]>([]);
  const [aiSuggestChecked, setAiSuggestChecked] = useState<Set<number>>(new Set());
  const [aiSuggestScopes, setAiSuggestScopes] = useState<string[]>(["compliance"]);
  const [aiSuggestContext, setAiSuggestContext] = useState("");
  const [aiSuggestIncludes, setAiSuggestIncludes] = useState({
    assessments: true, findings: true, risks: true, suppliers: true,
    locations: true, previous_program: true, frameworks: true,
  });
  const [showAIReview, setShowAIReview] = useState(false);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<Record<string, unknown>[] | null>(null);
  const [aiAddingItem, setAiAddingItem] = useState(false);

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
    api.get<{ ai_enabled: boolean; ai_features: Record<string, boolean> }>("/api/v1/config/features")
      .then(d => { setAiEnabled(d.ai_enabled); setAiFeatures(d.ai_features); })
      .catch(() => {});
  }, []);

  const loadHistory = (programId: number, action?: string) => {
    setHistoryLoading(true);
    const params = action ? `?action=${action}` : "";
    api.get<{ total: number; items: HistoryEntry[] }>(`/api/v1/audit-programs/${programId}/history${params}`)
      .then(d => { setHistory(d.items); setHistoryTotal(d.total); })
      .catch(() => { setHistory([]); setHistoryTotal(0); })
      .finally(() => setHistoryLoading(false));
  };

  const loadCRs = (programId: number) => {
    api.get<ChangeRequest[]>(`/api/v1/audit-programs/${programId}/change-requests`)
      .then(setChangeRequests).catch(() => setChangeRequests([]));
  };

  // Load items + versions + diffs + CRs when selection changes
  useEffect(() => {
    if (selected) {
      loadItems(selected.id);
      api.get<typeof versions>(`/api/v1/audit-programs/${selected.id}/versions`)
        .then(setVersions).catch(() => setVersions([]));
      api.get<VersionDiff[]>(`/api/v1/audit-programs/${selected.id}/diffs`)
        .then(setDiffs).catch(() => setDiffs([]));
      loadCRs(selected.id);
      setShowHistory(false);
      setHistory([]);
      setHistoryFilter("");
    } else {
      setItems([]);
      setVersions([]);
      setDiffs([]);
      setSelectedDiff(null);
      setHistory([]);
      setShowHistory(false);
      setChangeRequests([]);
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
                <div>
                  <DetailRow
                    label="Budzet (dni)"
                    value={`${sel.budget_actual_days} / ${sel.budget_planned_days}`}
                    color={sel.budget_actual_days > Number(sel.budget_planned_days) ? "var(--red)" : undefined}
                  />
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-inset)", overflow: "hidden", marginTop: 2, marginBottom: 4 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((sel.budget_actual_days / Number(sel.budget_planned_days)) * 100))}%`,
                      background: sel.budget_actual_days > Number(sel.budget_planned_days) ? "var(--red)" : "var(--blue)",
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              )}
              {sel.budget_planned_cost != null && (
                <div>
                  <DetailRow
                    label="Budzet (koszt)"
                    value={`${sel.budget_actual_cost} / ${sel.budget_planned_cost} ${sel.budget_currency}`}
                    color={sel.budget_actual_cost > Number(sel.budget_planned_cost) ? "var(--red)" : undefined}
                  />
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-inset)", overflow: "hidden", marginTop: 2, marginBottom: 4 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((sel.budget_actual_cost / Number(sel.budget_planned_cost)) * 100))}%`,
                      background: sel.budget_actual_cost > Number(sel.budget_planned_cost) ? "var(--red)" : "var(--green)",
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
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
                        {/* Transfer button for draft programs */}
                        {sel.status === "draft" && item.item_status === "planned" && (
                          <button
                            className="btn btn-xs"
                            style={{ fontSize: 10, padding: "1px 6px", color: "var(--orange)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTransferModal(item);
                              setTransferTargetId(null);
                              setTransferJustification("");
                              // Load draft programs for target selection
                              api.get<AuditProgram[]>("/api/v1/audit-programs?status=draft")
                                .then(p => setDraftPrograms(p.filter(dp => dp.id !== sel.id)))
                                .catch(() => setDraftPrograms([]));
                            }}
                            title="Transfer do innego programu"
                          >
                            Transfer
                          </button>
                        )}
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
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => { setEditingItem(null); setShowItemModal(true); }}
                >
                  + Dodaj pozycje
                </button>
                {aiEnabled && aiFeatures.audit_program_suggest && (
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", border: "none" }}
                    onClick={() => {
                      setAiSuggestions([]);
                      setAiSuggestChecked(new Set());
                      setAiSuggestScopes(["compliance"]);
                      setAiSuggestContext("");
                      setShowAISuggest(true);
                    }}
                  >
                    Zasugeruj pozycje AI
                  </button>
                )}
                {aiEnabled && aiFeatures.audit_program_review && (
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1, background: "linear-gradient(135deg, #06b6d4, #3b82f6)", color: "#fff", border: "none" }}
                    onClick={async () => {
                      setAiReviewResult(null);
                      setShowAIReview(true);
                      setAiReviewLoading(true);
                      try {
                        const res = await api.post<{ observations: Record<string, unknown>[] }>("/api/v1/ai/audit-program/review-completeness", { program_id: sel.id });
                        setAiReviewResult(res.observations);
                      } catch (err) {
                        alert("Blad AI: " + err);
                      } finally {
                        setAiReviewLoading(false);
                      }
                    }}
                  >
                    Sprawdz kompletnosc AI
                  </button>
                )}
              </div>
            )}

            {/* ── Change Requests (Krok 6) ── */}
            {["approved", "in_execution"].includes(sel.status) && (
              <div style={{ marginTop: 8 }}>
                <SectionHeader number={"\u2463"} label={`Change Requests (${changeRequests.length})`} />
                {changeRequests.length === 0 ? (
                  <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", padding: 8 }}>Brak wnioskow o zmiane</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {changeRequests.map(cr => (
                      <div
                        key={cr.id}
                        style={{
                          padding: "6px 8px", borderRadius: 4, fontSize: 11,
                          background: "var(--bg-inset)",
                          borderLeft: `3px solid ${CR_STATUS_COLORS[cr.status] || "#94a3b8"}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{cr.title}</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>{cr.ref_id}</span>
                          </div>
                          <Badge label={CR_STATUS_LABELS[cr.status] || cr.status} color={CR_STATUS_COLORS[cr.status] || "#94a3b8"} />
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 2, color: "var(--text-muted)", fontSize: 10 }}>
                          <span>{CR_TYPE_LABELS[cr.change_type] || cr.change_type}</span>
                          <span>{cr.requested_by_name || `User #${cr.requested_by}`}</span>
                          <span>{cr.created_at?.slice(0, 10)}</span>
                        </div>
                        {cr.justification && (
                          <div style={{ marginTop: 3, fontSize: 10, color: "var(--text-secondary)", fontStyle: "italic" }}>
                            {cr.justification.length > 80 ? cr.justification.slice(0, 80) + "..." : cr.justification}
                          </div>
                        )}
                        {cr.review_comment && (
                          <div style={{ marginTop: 3, padding: "3px 6px", borderRadius: 3, background: "rgba(59,130,246,0.05)", fontSize: 10, color: "var(--text-secondary)" }}>
                            Komentarz: {cr.review_comment}
                          </div>
                        )}
                        {/* CR action buttons */}
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          {cr.status === "draft" && (
                            <>
                              <button
                                className="btn btn-xs"
                                style={{ fontSize: 10, color: "var(--purple)" }}
                                onClick={async () => {
                                  try {
                                    await api.post(`/api/v1/change-requests/${cr.id}/submit`, {});
                                    loadCRs(sel.id);
                                  } catch (err) { alert("Blad: " + err); }
                                }}
                                disabled={workflowBusy}
                              >
                                Zloz
                              </button>
                              <button
                                className="btn btn-xs"
                                style={{ fontSize: 10, color: "var(--red)" }}
                                onClick={async () => {
                                  if (!confirm("Usunac CR?")) return;
                                  try {
                                    await api.delete(`/api/v1/change-requests/${cr.id}`);
                                    loadCRs(sel.id);
                                  } catch (err) { alert("Blad: " + err); }
                                }}
                              >
                                Usun
                              </button>
                            </>
                          )}
                          {cr.status === "submitted" && (
                            <>
                              <button
                                className="btn btn-xs"
                                style={{ fontSize: 10, color: "var(--green)" }}
                                onClick={async () => {
                                  try {
                                    await api.post(`/api/v1/change-requests/${cr.id}/approve`, {});
                                    loadCRs(sel.id);
                                  } catch (err) { alert("Blad: " + err); }
                                }}
                                disabled={workflowBusy}
                              >
                                Zatwierdz
                              </button>
                              <button
                                className="btn btn-xs"
                                style={{ fontSize: 10, color: "var(--red)" }}
                                onClick={() => { setCrRejectComment(""); setShowCRRejectModal(cr); }}
                                disabled={workflowBusy}
                              >
                                Odrzuc
                              </button>
                            </>
                          )}
                          {cr.status === "approved" && (
                            <button
                              className="btn btn-xs"
                              style={{ fontSize: 10, color: "var(--blue)", fontWeight: 600 }}
                              onClick={async () => {
                                setWorkflowBusy(true);
                                try {
                                  const newProg = await api.post<AuditProgram>(`/api/v1/change-requests/${cr.id}/implement`, {});
                                  setSelected(newProg);
                                  load();
                                } catch (err) { alert("Blad: " + err); }
                                finally { setWorkflowBusy(false); }
                              }}
                              disabled={workflowBusy}
                            >
                              Implementuj
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="btn btn-sm"
                  style={{ width: "100%", marginTop: 6 }}
                  onClick={() => setShowCRModal(true)}
                >
                  + Nowy Change Request
                </button>
              </div>
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
                  {versions.map(v => {
                    const diff = diffs.find(d => d.to_version_id === v.id);
                    return (
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
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>v{v.version}</span>
                          {v.is_current_version && <span style={{ fontSize: 9, color: "var(--blue)" }}>aktualna</span>}
                          {diff && (
                            <button
                              className="btn btn-xs"
                              style={{ fontSize: 9, padding: "0 4px", lineHeight: "16px", marginLeft: 2 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDiff(selectedDiff?.id === diff.id ? null : diff);
                              }}
                              title={`Porownaj v${diff.from_version} → v${diff.to_version}`}
                            >
                              diff
                            </button>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Badge label={STATUS_LABELS[v.status] || v.status} color={STATUS_COLORS[v.status] || "#94a3b8"} />
                          <span style={{ color: "var(--text-muted)" }}>{v.created_at?.slice(0, 10)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Diff Viewer ── */}
                {selectedDiff && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--border)", fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: "var(--purple)" }}>
                        Zmiany: v{selectedDiff.from_version} → v{selectedDiff.to_version}
                      </div>
                      <button
                        className="btn btn-xs"
                        style={{ fontSize: 10, padding: "0 4px" }}
                        onClick={() => setSelectedDiff(null)}
                      >
                        &#10005;
                      </button>
                    </div>

                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, fontStyle: "italic" }}>
                      {selectedDiff.summary}
                    </div>

                    {/* Program field changes */}
                    {Object.keys(selectedDiff.program_field_changes).length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--blue)" }}>Pola programu:</div>
                        {Object.entries(selectedDiff.program_field_changes).map(([field, { from: fromVal, to: toVal }]) => (
                          <div key={field} style={{ display: "flex", gap: 4, marginBottom: 2, lineHeight: 1.5 }}>
                            <span style={{ color: "var(--text-muted)", minWidth: 100, flexShrink: 0 }}>
                              {FIELD_LABELS[field] || field}:
                            </span>
                            <span>
                              <span style={{ textDecoration: "line-through", color: "var(--red)", opacity: 0.7 }}>
                                {fromVal ?? "(brak)"}
                              </span>
                              {" → "}
                              <span style={{ color: "var(--green)", fontWeight: 500 }}>
                                {toVal ?? "(brak)"}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Items added */}
                    {selectedDiff.items_added.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--green)" }}>
                          Dodane pozycje ({selectedDiff.items_added.length}):
                        </div>
                        {selectedDiff.items_added.map(item => (
                          <div key={item.ref_id} style={{ paddingLeft: 8, marginBottom: 2 }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>{item.ref_id}</span>
                            {" "}{item.name}
                            <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>({AUDIT_TYPE_LABELS[item.audit_type] || item.audit_type})</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Items removed */}
                    {selectedDiff.items_removed.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--red)" }}>
                          Usuniete pozycje ({selectedDiff.items_removed.length}):
                        </div>
                        {selectedDiff.items_removed.map(item => (
                          <div key={item.ref_id} style={{ paddingLeft: 8, marginBottom: 2, textDecoration: "line-through", opacity: 0.7 }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{item.ref_id}</span>
                            {" "}{item.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Items modified */}
                    {selectedDiff.items_modified.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--orange)" }}>
                          Zmodyfikowane pozycje ({selectedDiff.items_modified.length}):
                        </div>
                        {selectedDiff.items_modified.map(item => (
                          <div key={item.ref_id} style={{ paddingLeft: 8, marginBottom: 6, borderLeft: "2px solid var(--orange)", paddingTop: 2, paddingBottom: 2 }}>
                            <div style={{ fontWeight: 500 }}>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>{item.ref_id}</span>
                              {" "}{item.name}
                            </div>
                            {Object.entries(item.changes).map(([field, { from: fv, to: tv }]) => (
                              <div key={field} style={{ display: "flex", gap: 4, paddingLeft: 8 }}>
                                <span style={{ color: "var(--text-muted)", minWidth: 90, flexShrink: 0 }}>
                                  {FIELD_LABELS[field] || field}:
                                </span>
                                <span>
                                  <span style={{ textDecoration: "line-through", color: "var(--red)", opacity: 0.7 }}>
                                    {fv ?? "(brak)"}
                                  </span>
                                  {" → "}
                                  <span style={{ color: "var(--green)", fontWeight: 500 }}>
                                    {tv ?? "(brak)"}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unchanged count */}
                    {selectedDiff.items_unchanged > 0 && (
                      <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                        {selectedDiff.items_unchanged} pozycji bez zmian
                      </div>
                    )}

                    {selectedDiff.generated_at && (
                      <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>
                        Wygenerowano: {selectedDiff.generated_at.slice(0, 16).replace("T", " ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Audit Trail (Krok 5) ── */}
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", paddingBottom: 4, borderBottom: "1px solid rgba(59,130,246,0.2)",
                }}
                onClick={() => {
                  const next = !showHistory;
                  setShowHistory(next);
                  if (next && history.length === 0) loadHistory(sel.id);
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {"\u2464"} Historia zmian
                </div>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{showHistory ? "\u25B2" : "\u25BC"}</span>
              </div>

              {showHistory && (
                <div style={{ marginTop: 8 }}>
                  {/* Filter by action */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <select
                      className="form-control"
                      style={{ fontSize: 11, padding: "2px 6px", flex: 1 }}
                      value={historyFilter}
                      onChange={e => {
                        setHistoryFilter(e.target.value);
                        loadHistory(sel.id, e.target.value || undefined);
                      }}
                    >
                      <option value="">Wszystkie akcje</option>
                      {Object.entries(ACTION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-xs"
                      style={{ fontSize: 10 }}
                      onClick={() => loadHistory(sel.id, historyFilter || undefined)}
                    >
                      Odswiez
                    </button>
                  </div>

                  {historyLoading ? (
                    <div style={{ textAlign: "center", padding: 12, color: "var(--text-muted)", fontSize: 12 }}>Ladowanie...</div>
                  ) : history.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 12, color: "var(--text-muted)", fontSize: 12 }}>Brak wpisow</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {history.map(h => (
                        <div
                          key={h.id}
                          style={{
                            padding: "6px 8px", borderRadius: 4, fontSize: 11,
                            background: "var(--bg-inset)",
                            borderLeft: `3px solid ${ACTION_COLORS[h.action] || "#94a3b8"}`,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, color: ACTION_COLORS[h.action] || "var(--text-primary)" }}>
                              {ACTION_LABELS[h.action] || h.action}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {h.performed_at?.slice(0, 16).replace("T", " ")}
                            </span>
                          </div>
                          {h.description && (
                            <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{h.description}</div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                            <span style={{ color: "var(--text-muted)" }}>
                              {h.performed_by_name || `User #${h.performed_by}`}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {h.entity_type}
                            </span>
                          </div>
                          {h.justification && (
                            <div style={{ marginTop: 4, padding: "4px 6px", borderRadius: 3, background: "rgba(59,130,246,0.05)", fontSize: 10, fontStyle: "italic", color: "var(--text-secondary)" }}>
                              {h.justification}
                            </div>
                          )}
                          {h.field_changes && Object.keys(h.field_changes).length > 0 && (
                            <div style={{ marginTop: 4, padding: "4px 6px", borderRadius: 3, background: "rgba(0,0,0,0.03)", fontSize: 10 }}>
                              {Object.entries(h.field_changes).map(([field, { old: oldV, new: newV }]) => (
                                <div key={field}>
                                  <span style={{ color: "var(--text-muted)" }}>{FIELD_LABELS[field] || field}:</span>{" "}
                                  <span style={{ textDecoration: "line-through", color: "var(--red)", opacity: 0.7 }}>{oldV ?? "(brak)"}</span>
                                  {" → "}
                                  <span style={{ color: "var(--green)" }}>{newV ?? "(brak)"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {historyTotal > history.length && (
                        <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", padding: 4 }}>
                          Pokazano {history.length} z {historyTotal} wpisow
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
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

      {/* ── CR Create Modal (Krok 6) ── */}
      <Modal
        open={showCRModal}
        onClose={() => setShowCRModal(false)}
        title="Nowy Change Request"
        wide
      >
        {sel && (
          <CRForm
            items={items}
            saving={saving}
            onSubmit={async (data) => {
              setSaving(true);
              try {
                await api.post(`/api/v1/audit-programs/${sel.id}/change-requests`, data);
                setShowCRModal(false);
                loadCRs(sel.id);
              } catch (err) { alert("Blad: " + err); }
              finally { setSaving(false); }
            }}
            onCancel={() => setShowCRModal(false)}
          />
        )}
      </Modal>

      {/* ── CR Reject Modal ── */}
      <Modal
        open={!!showCRRejectModal}
        onClose={() => setShowCRRejectModal(null)}
        title={`Odrzucenie CR: ${showCRRejectModal?.ref_id ?? ""}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13 }}>
            Komentarz (powod odrzucenia) *
            <textarea
              className="form-control"
              value={crRejectComment}
              onChange={e => setCrRejectComment(e.target.value)}
              rows={3}
              placeholder="Opisz powod odrzucenia CR (min. 3 znaki)..."
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setShowCRRejectModal(null)}>Anuluj</button>
            <button
              className="btn btn-primary"
              style={{ background: "var(--red)", borderColor: "var(--red)" }}
              disabled={crRejectComment.trim().length < 3 || workflowBusy}
              onClick={async () => {
                if (!showCRRejectModal) return;
                setWorkflowBusy(true);
                try {
                  await api.post(`/api/v1/change-requests/${showCRRejectModal.id}/reject`, { review_comment: crRejectComment.trim() });
                  setShowCRRejectModal(null);
                  if (sel) loadCRs(sel.id);
                } catch (err) { alert("Blad: " + err); }
                finally { setWorkflowBusy(false); }
              }}
            >
              {workflowBusy ? "Odrzucanie..." : "Odrzuc CR"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Transfer Modal ── */}
      <Modal open={!!showTransferModal} onClose={() => setShowTransferModal(null)} title={`Transfer: ${showTransferModal?.name ?? ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 400 }}>
          <p style={{ fontSize: 13, margin: 0, color: "var(--text-muted)" }}>
            Przenies pozycje audytu do innego programu w statusie &quot;Szkic&quot;. Pozycja zostanie anulowana w biezacym programie i skopiowana do docelowego.
          </p>
          <label style={{ fontSize: 13 }}>
            Program docelowy *
            <select
              className="form-control"
              value={transferTargetId ?? ""}
              onChange={e => setTransferTargetId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- wybierz program --</option>
              {draftPrograms.map(dp => (
                <option key={dp.id} value={dp.id}>{dp.ref_id} — {dp.name} (v{dp.version})</option>
              ))}
            </select>
            {draftPrograms.length === 0 && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Brak innych programow w statusie Szkic</span>
            )}
          </label>
          <label style={{ fontSize: 13 }}>
            Uzasadnienie * (min. 5 znakow)
            <textarea
              className="form-control"
              value={transferJustification}
              onChange={e => setTransferJustification(e.target.value)}
              rows={3}
              placeholder="Dlaczego pozycja ma byc przeniesiona..."
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setShowTransferModal(null)}>Anuluj</button>
            <button
              className="btn btn-primary"
              style={{ background: "var(--orange)", borderColor: "var(--orange)" }}
              disabled={!transferTargetId || transferJustification.trim().length < 5 || workflowBusy}
              onClick={async () => {
                if (!showTransferModal || !transferTargetId) return;
                setWorkflowBusy(true);
                try {
                  await api.post(`/api/v1/audit-program-items/${showTransferModal.id}/transfer`, {
                    target_program_id: transferTargetId,
                    justification: transferJustification.trim(),
                  });
                  setShowTransferModal(null);
                  if (sel) { loadItems(sel.id); load(); }
                } catch (err) { alert("Blad transferu: " + err); }
                finally { setWorkflowBusy(false); }
              }}
            >
              {workflowBusy ? "Transferowanie..." : "Transferuj"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── AI Suggest Items Modal (Krok 8) ── */}
      <Modal open={showAISuggest} onClose={() => setShowAISuggest(false)} title="AI: Zasugeruj pozycje programu audytow">
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {aiSuggestions.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Zakres tematyczny programu *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {[
                    { key: "compliance", label: "Audyty zgodnosci (compliance)" },
                    { key: "process", label: "Audyty procesowe (risk-based)" },
                    { key: "supplier", label: "Audyty dostawcow" },
                    { key: "physical", label: "Audyty lokalizacji (bezp. fizyczne)" },
                    { key: "follow_up", label: "Audyty follow-up (weryfikacja ustalen)" },
                  ].map(opt => (
                    <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 4, background: aiSuggestScopes.includes(opt.key) ? "rgba(99,102,241,0.15)" : "var(--bg-inset)" }}>
                      <input
                        type="checkbox"
                        checked={aiSuggestScopes.includes(opt.key)}
                        onChange={e => {
                          setAiSuggestScopes(prev =>
                            e.target.checked ? [...prev, opt.key] : prev.filter(s => s !== opt.key)
                          );
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Dodatkowy kontekst (opcjonalny)</label>
                <textarea
                  className="input"
                  rows={3}
                  value={aiSuggestContext}
                  onChange={e => setAiSuggestContext(e.target.value)}
                  placeholder="Np. Jestem CISO, chce zaplanowac audyty zgodnosci z ISO 27001 i NIS2..."
                />
              </div>

              <div>
                <label className="label">Uwzglednij dane z systemu</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {[
                    { key: "assessments", label: "Oceny zgodnosci" },
                    { key: "findings", label: "Otwarte ustalenia" },
                    { key: "risks", label: "Rejestr ryzyk" },
                    { key: "suppliers", label: "Lista dostawcow" },
                    { key: "locations", label: "Lista lokalizacji" },
                    { key: "previous_program", label: "Poprzedni program" },
                    { key: "frameworks", label: "Frameworki/regulacje" },
                  ].map(opt => (
                    <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 4, background: aiSuggestIncludes[opt.key as keyof typeof aiSuggestIncludes] ? "rgba(99,102,241,0.15)" : "var(--bg-inset)" }}>
                      <input
                        type="checkbox"
                        checked={aiSuggestIncludes[opt.key as keyof typeof aiSuggestIncludes]}
                        onChange={e => setAiSuggestIncludes(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setShowAISuggest(false)}>Anuluj</button>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", borderColor: "#6366f1" }}
                  disabled={aiSuggestLoading || aiSuggestScopes.length === 0}
                  onClick={async () => {
                    if (!selected) return;
                    setAiSuggestLoading(true);
                    try {
                      const res = await api.post<{ suggestions: Record<string, unknown>[] }>("/api/v1/ai/audit-program/suggest-items", {
                        program_id: selected.id,
                        scope_themes: aiSuggestScopes,
                        additional_context: aiSuggestContext || null,
                        include_assessments: aiSuggestIncludes.assessments,
                        include_findings: aiSuggestIncludes.findings,
                        include_risks: aiSuggestIncludes.risks,
                        include_suppliers: aiSuggestIncludes.suppliers,
                        include_locations: aiSuggestIncludes.locations,
                        include_previous_program: aiSuggestIncludes.previous_program,
                        include_frameworks: aiSuggestIncludes.frameworks,
                      });
                      setAiSuggestions(res.suggestions);
                      setAiSuggestChecked(new Set(res.suggestions.map((_: unknown, i: number) => i)));
                    } catch (err) {
                      alert("Blad AI: " + err);
                    } finally {
                      setAiSuggestLoading(false);
                    }
                  }}
                >
                  {aiSuggestLoading ? "Generowanie..." : "Generuj sugestie"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                AI zasugerowalo {aiSuggestions.length} pozycji programu
              </div>
              {aiSuggestions.map((sug, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex", gap: 8, padding: "8px 10px", borderRadius: 6,
                    background: aiSuggestChecked.has(idx) ? "rgba(99,102,241,0.08)" : "var(--bg-inset)",
                    border: `1px solid ${aiSuggestChecked.has(idx) ? "rgba(99,102,241,0.3)" : "transparent"}`,
                    cursor: "pointer", fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={aiSuggestChecked.has(idx)}
                    onChange={e => {
                      setAiSuggestChecked(prev => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(idx) : next.delete(idx);
                        return next;
                      });
                    }}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>
                        Q{String(sug.planned_quarter ?? "?")} | {String(sug.name)}
                      </span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: PRIORITY_COLORS[String(sug.priority)] || "#94a3b8", color: "#fff" }}>
                        {String(sug.priority ?? "medium")}
                      </span>
                    </div>
                    <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                      {AUDIT_TYPE_LABELS[String(sug.audit_type)] || String(sug.audit_type ?? "")}
                      {!!sug.estimated_days && <> | ~{String(sug.estimated_days)} dni</>}
                      {!!sug.scope_name && <> | {String(sug.scope_name)}</>}
                    </div>
                    {!!sug.rationale && (
                      <div style={{ color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>
                        {String(sug.rationale)}
                      </div>
                    )}
                  </div>
                </label>
              ))}

              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Zaznaczonych: {aiSuggestChecked.size} pozycji
                {aiSuggestions.filter((_, i) => aiSuggestChecked.has(i)).reduce((sum, s) => sum + (Number(s.estimated_days) || 0), 0) > 0 && (
                  <>, ~{aiSuggestions.filter((_, i) => aiSuggestChecked.has(i)).reduce((sum, s) => sum + (Number(s.estimated_days) || 0), 0)} osobodni</>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setAiSuggestions([])}>Wstecz</button>
                <button className="btn btn-sm" onClick={() => setShowAISuggest(false)}>Anuluj</button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={aiSuggestChecked.size === 0 || aiAddingItem}
                  onClick={async () => {
                    if (!selected) return;
                    setAiAddingItem(true);
                    try {
                      for (const idx of aiSuggestChecked) {
                        const sug = aiSuggestions[idx];
                        await api.post(`/api/v1/audit-programs/${selected.id}/items`, {
                          name: sug.name,
                          audit_type: sug.audit_type || "compliance",
                          planned_quarter: sug.planned_quarter || null,
                          planned_days: sug.estimated_days || null,
                          priority: sug.priority || "medium",
                          scope_type: sug.scope_type || null,
                          scope_name: sug.scope_name || null,
                          audit_method: "on_site",
                          description: sug.rationale ? String(sug.rationale) : null,
                        });
                      }
                      setShowAISuggest(false);
                      loadItems(selected.id);
                      load();
                    } catch (err) {
                      alert("Blad dodawania: " + err);
                    } finally {
                      setAiAddingItem(false);
                    }
                  }}
                >
                  {aiAddingItem ? "Dodawanie..." : `Dodaj zaznaczone (${aiSuggestChecked.size})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── AI Review Completeness Modal (Krok 8) ── */}
      <Modal open={showAIReview} onClose={() => setShowAIReview(false)} title="AI: Przeglad kompletnosci programu">
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {aiReviewLoading ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>Analizowanie programu...</div>
              <div style={{ fontSize: 12 }}>AI sprawdza kompletnosc na podstawie danych systemowych</div>
            </div>
          ) : aiReviewResult === null ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 12 }}>Brak wynikow</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Gaps */}
              {aiReviewResult.filter(o => o.type === "gap").length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", marginBottom: 6 }}>
                    Luki ({aiReviewResult.filter(o => o.type === "gap").length})
                  </div>
                  {aiReviewResult.filter(o => o.type === "gap").map((obs, idx) => (
                    <div key={`gap-${idx}`} style={{ padding: 8, borderRadius: 6, marginBottom: 6, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>
                          <span style={{ color: String(obs.severity) === "critical" ? "var(--red)" : "var(--orange)" }}>
                            {String(obs.severity ?? "").toUpperCase()}
                          </span>{" "}
                          {String(obs.title)}
                        </span>
                        {!!obs.suggested_item && selected?.status === "draft" && (
                          <button
                            className="btn btn-xs"
                            style={{ fontSize: 10, color: "var(--green)" }}
                            disabled={aiAddingItem}
                            onClick={async () => {
                              if (!selected) return;
                              setAiAddingItem(true);
                              try {
                                const si = obs.suggested_item as Record<string, unknown>;
                                await api.post(`/api/v1/audit-programs/${selected.id}/items`, {
                                  name: si.name,
                                  audit_type: si.audit_type || "compliance",
                                  planned_quarter: si.planned_quarter || null,
                                  planned_days: si.estimated_days || null,
                                  priority: si.priority || "medium",
                                  scope_type: si.scope_type || null,
                                  scope_name: si.scope_name || null,
                                  audit_method: "on_site",
                                });
                                loadItems(selected.id);
                                load();
                              } catch (err) {
                                alert("Blad: " + err);
                              } finally {
                                setAiAddingItem(false);
                              }
                            }}
                          >
                            + Dodaj do programu
                          </button>
                        )}
                      </div>
                      <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>{String(obs.details)}</div>
                      {!!obs.recommendation && (
                        <div style={{ color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>Rekomendacja: {String(obs.recommendation)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {aiReviewResult.filter(o => o.type === "warning").length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--orange)", marginBottom: 6 }}>
                    Ostrzezenia ({aiReviewResult.filter(o => o.type === "warning").length})
                  </div>
                  {aiReviewResult.filter(o => o.type === "warning").map((obs, idx) => (
                    <div key={`warn-${idx}`} style={{ padding: 8, borderRadius: 6, marginBottom: 6, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ color: "var(--orange)" }}>{String(obs.severity ?? "").toUpperCase()}</span>{" "}
                        {String(obs.title)}
                      </div>
                      <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>{String(obs.details)}</div>
                      {!!obs.recommendation && (
                        <div style={{ color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>Rekomendacja: {String(obs.recommendation)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmations */}
              {aiReviewResult.filter(o => o.type === "confirmation").length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)", marginBottom: 6 }}>
                    Potwierdzone pokrycie ({aiReviewResult.filter(o => o.type === "confirmation").length})
                  </div>
                  {aiReviewResult.filter(o => o.type === "confirmation").map((obs, idx) => (
                    <div key={`conf-${idx}`} style={{ padding: 8, borderRadius: 6, marginBottom: 6, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: "var(--green)" }}>{String(obs.title)}</div>
                      <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{String(obs.details)}</div>
                    </div>
                  ))}
                </div>
              )}

              {aiReviewResult.length === 0 && (
                <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 12 }}>
                  AI nie zwrocilo zadnych obserwacji.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setShowAIReview(false)}>Zamknij</button>
              </div>
            </div>
          )}
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
  const [approverId, setApproverId] = useState(editingProgram?.approver_id ?? (users[1]?.id ?? users[0]?.id ?? 1));
  const [orgUnitId, setOrgUnitId] = useState<number | null>(editingProgram?.org_unit_id ?? null);
  const [budgetDays, setBudgetDays] = useState(editingProgram?.budget_planned_days != null ? String(editingProgram.budget_planned_days) : "");
  const [budgetCost, setBudgetCost] = useState(editingProgram?.budget_planned_cost != null ? String(editingProgram.budget_planned_cost) : "");
  const [scope, setScope] = useState(editingProgram?.scope_description ?? "");
  const [objectives, setObjectives] = useState(editingProgram?.strategic_objectives ?? "");
  const [criteria, setCriteria] = useState(editingProgram?.audit_criteria ?? "");
  const [methods, setMethods] = useState(editingProgram?.methods ?? "");

  const canSubmit = name.trim().length > 0 && (users.length <= 1 || ownerId !== approverId);

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


/* ═══════════════════════════════════════════════════════════
   CRForm — create change request
   ═══════════════════════════════════════════════════════════ */
interface CRFormProps {
  items: ProgramItem[];
  saving: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

function CRForm({ items, saving, onSubmit, onCancel }: CRFormProps) {
  const [title, setTitle] = useState("");
  const [changeType, setChangeType] = useState("modify_audit");
  const [justification, setJustification] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [impactAssessment, setImpactAssessment] = useState("");
  const [affectedItemId, setAffectedItemId] = useState<number | null>(null);

  const canSubmit = title.trim().length >= 3 && justification.trim().length >= 5 && changeDescription.trim().length >= 5;

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      title: title.trim(),
      change_type: changeType,
      justification: justification.trim(),
      change_description: changeDescription.trim(),
      impact_assessment: impactAssessment.trim() || null,
      affected_item_id: affectedItemId,
      proposed_changes: {},
    };
    onSubmit(data);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          Tytul wniosku *
          <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Dodanie audytu NIS2" />
        </label>
        <label style={{ fontSize: 13 }}>
          Typ zmiany *
          <select className="form-control" value={changeType} onChange={e => setChangeType(e.target.value)}>
            {Object.entries(CR_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Dotyczy pozycji (opcjonalnie)
          <select className="form-control" value={affectedItemId ?? ""} onChange={e => setAffectedItemId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">-- caly program --</option>
            {items.map(it => <option key={it.id} value={it.id}>{it.ref_id} — {it.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Ocena wplywu
          <textarea className="form-control" value={impactAssessment} onChange={e => setImpactAssessment(e.target.value)} rows={2} placeholder="Wplyw na budzet, zasoby, harmonogram..." />
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          Uzasadnienie zmiany * (min. 5 znakow)
          <textarea className="form-control" value={justification} onChange={e => setJustification(e.target.value)} rows={3} placeholder="Dlaczego zmiana jest konieczna..." />
        </label>
        <label style={{ fontSize: 13 }}>
          Szczegolowy opis proponowanych zmian * (min. 5 znakow)
          <textarea className="form-control" value={changeDescription} onChange={e => setChangeDescription(e.target.value)} rows={4} placeholder="Co dokladnie nalezy zmienic..." />
        </label>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? "Zapisywanie..." : "Utworz Change Request"}
        </button>
      </div>
    </div>
  );
}
