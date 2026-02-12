import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import type { OrgUnitTreeNode, OrgLevel } from "../types";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";

/* ─── Types ─── */
interface ContextIssue {
  id: number;
  org_unit_id: number;
  org_unit_name: string | null;
  issue_type: string;
  category_id: number | null;
  category_name: string | null;
  title: string;
  description: string | null;
  impact_level: string | null;
  relevance: string | null;
  response_action: string | null;
  review_date: string | null;
  is_active: boolean;
  inherited: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ContextObligation {
  id: number;
  org_unit_id: number;
  org_unit_name: string | null;
  obligation_type: string;
  regulation_id: number | null;
  regulation_name: string | null;
  custom_name: string | null;
  description: string | null;
  responsible_person: string | null;
  compliance_status: string | null;
  compliance_evidence: string | null;
  effective_from: string | null;
  review_date: string | null;
  notes: string | null;
  is_active: boolean;
  inherited: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ContextStakeholder {
  id: number;
  org_unit_id: number;
  org_unit_name: string | null;
  stakeholder_type: string;
  category_id: number | null;
  category_name: string | null;
  name: string;
  description: string | null;
  needs_expectations: string | null;
  requirements_type: string | null;
  requirements_detail: string | null;
  communication_channel: string | null;
  influence_level: string | null;
  relevance: string | null;
  is_active: boolean;
  inherited: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ContextScope {
  id: number;
  org_unit_id: number;
  org_unit_name: string | null;
  management_system_id: number | null;
  management_system_name: string | null;
  scope_statement: string | null;
  in_scope_description: string | null;
  out_of_scope_description: string | null;
  geographic_boundaries: string | null;
  technology_boundaries: string | null;
  organizational_boundaries: string | null;
  interfaces_dependencies: string | null;
  approved_by: string | null;
  approved_date: string | null;
  version: number;
  is_active: boolean;
  inherited: boolean;
  created_at: string;
  updated_at: string;
}

interface ContextRiskAppetite {
  id: number;
  org_unit_id: number;
  org_unit_name: string | null;
  risk_appetite_statement: string | null;
  max_acceptable_risk_level: string | null;
  max_acceptable_risk_score: number | null;
  exception_approval_authority: string | null;
  financial_risk_tolerance: string | null;
  reputational_risk_tolerance: string | null;
  operational_risk_tolerance: string | null;
  approved_by: string | null;
  approved_date: string | null;
  is_active: boolean;
  inherited: boolean;
  created_at: string;
  updated_at: string;
}

interface ContextReview {
  id: number;
  org_unit_id: number;
  org_unit_name: string | null;
  review_date: string;
  reviewer: string;
  review_type: string;
  sections_reviewed: Record<string, unknown> | null;
  changes_summary: string | null;
  approved_by: string | null;
  approved_date: string | null;
  next_review_date: string | null;
  is_active: boolean;
  created_at: string;
  [key: string]: unknown;
}

interface ContextGeneral {
  id: number;
  name: string;
  headcount: number | null;
  context_review_date: string | null;
  context_next_review: string | null;
  context_reviewer: string | null;
  context_status: string | null;
  mission_vision: string | null;
  key_products_services: string | null;
  strategic_objectives: string | null;
  key_processes_notes: string | null;
}

interface ContextOverview {
  org_unit_id: number;
  org_unit_name: string;
  context_status: string | null;
  issues_count: number;
  issues_own: number;
  issues_inherited: number;
  obligations_count: number;
  obligations_own: number;
  obligations_inherited: number;
  stakeholders_count: number;
  stakeholders_own: number;
  stakeholders_inherited: number;
  has_scope: boolean;
  scope_inherited: boolean;
  has_risk_appetite: boolean;
  risk_appetite_inherited: boolean;
  reviews_count: number;
  snapshots_count: number;
  last_review_date: string | null;
  next_review_date: string | null;
}

/* ─── Helpers ─── */
type Tab = "structure" | "overview" | "issues" | "obligations" | "stakeholders" | "scope" | "risk_appetite" | "reviews";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "structure", label: "Jednostka", icon: "🏢" },
  { key: "overview", label: "Przegląd", icon: "📊" },
  { key: "issues", label: "Czynniki", icon: "🔍" },
  { key: "obligations", label: "Zobowiązania", icon: "📜" },
  { key: "stakeholders", label: "Interesariusze", icon: "👥" },
  { key: "scope", label: "Zakres SZBI", icon: "🎯" },
  { key: "risk_appetite", label: "Apetyt na ryzyko", icon: "⚖️" },
  { key: "reviews", label: "Przeglądy", icon: "🔄" },
];

function statusColor(s: string | null): string {
  if (!s) return "var(--text-muted)";
  switch (s) {
    case "approved": return "var(--green)";
    case "in_review": return "var(--blue)";
    case "draft": return "var(--orange)";
    case "needs_update": return "var(--red)";
    default: return "var(--text-muted)";
  }
}

function statusLabel(s: string | null): string {
  if (!s) return "—";
  switch (s) {
    case "approved": return "Zatwierdzony";
    case "in_review": return "W przeglądzie";
    case "draft": return "Szkic";
    case "needs_update": return "Wymaga aktualizacji";
    default: return s;
  }
}

function relevanceColor(r: string | null) {
  switch (r) {
    case "high": return "var(--red)";
    case "medium": return "var(--orange)";
    case "low": return "var(--green)";
    default: return "var(--text-muted)";
  }
}

function relevanceLabel(r: string | null) {
  switch (r) {
    case "high": return "Wysoka";
    case "medium": return "Średnia";
    case "low": return "Niska";
    default: return "—";
  }
}

function impactLabel(i: string | null) {
  switch (i) {
    case "positive": return "Pozytywny";
    case "negative": return "Negatywny";
    case "neutral": return "Neutralny";
    default: return "—";
  }
}

function complianceColor(s: string | null) {
  switch (s) {
    case "compliant": return "var(--green)";
    case "partially_compliant": return "var(--orange)";
    case "non_compliant": return "var(--red)";
    default: return "var(--text-muted)";
  }
}

function complianceLabel(s: string | null) {
  switch (s) {
    case "compliant": return "Zgodny";
    case "partially_compliant": return "Częściowo zgodny";
    case "non_compliant": return "Niezgodny";
    case "not_assessed": return "Nieoceniony";
    default: return "—";
  }
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "2px 0" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "—"}</span>
    </div>
  );
}

const errorBorder = "1px solid var(--red)";
const errorShadow = "0 0 0 3px var(--red-dim)";

/* ─── Tree Node Component ─── */
function ContextTreeNode({ node, depth, selectedId, onSelect, overviews }: {
  node: OrgUnitTreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  overviews: Map<number, ContextOverview>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const ov = overviews.get(node.id);

  return (
    <>
      <div
        onClick={() => onSelect(node.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          paddingLeft: depth * 20 + 10,
          cursor: "pointer",
          background: isSelected ? "var(--blue-dim)" : "transparent",
          borderLeft: isSelected ? "3px solid var(--blue)" : "3px solid transparent",
          fontSize: 13,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget.style.background = "var(--bg-card-hover)"); }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget.style.background = "transparent"); }}
      >
        {hasChildren && (
          <span
            onClick={e => { e.stopPropagation(); setCollapsed(!collapsed); }}
            style={{ cursor: "pointer", fontSize: 10, width: 14, textAlign: "center", color: "var(--text-muted)", userSelect: "none" }}
          >
            {collapsed ? "▶" : "▼"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 14 }} />}
        <span style={{ fontWeight: depth === 0 ? 600 : 400 }}>{node.name}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>{node.symbol}</span>
        {ov && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center", fontSize: 11 }}>
            {ov.context_status && (
              <span style={{
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 10,
                background: ov.context_status === "approved" ? "var(--green-dim)" : ov.context_status === "draft" ? "var(--orange-dim)" : "var(--blue-dim)",
                color: statusColor(ov.context_status),
              }}>
                {statusLabel(ov.context_status)}
              </span>
            )}
            <span style={{ color: "var(--text-muted)" }}>
              {ov.issues_count}c {ov.obligations_count}z {ov.stakeholders_count}i
            </span>
          </span>
        )}
      </div>
      {!collapsed && hasChildren && node.children.map(ch => (
        <ContextTreeNode key={ch.id} node={ch} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} overviews={overviews} />
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OrgContextPage — main component
   ═══════════════════════════════════════════════════════════════════ */
export default function OrgContextPage() {
  /* ─── Column defs for issues ─── */
  const ISSUE_COLS: ColumnDef<ContextIssue>[] = [
    { key: "title", header: "Tytuł" },
    { key: "issue_type", header: "Typ", format: r => r.issue_type === "internal" ? "Wewnętrzny" : "Zewnętrzny" },
    { key: "category_name", header: "Kategoria", format: r => r.category_name ?? "" },
    { key: "impact_level", header: "Wpływ", format: r => impactLabel(r.impact_level) },
    { key: "relevance", header: "Istotność", format: r => relevanceLabel(r.relevance) },
    { key: "org_unit_name", header: "Jednostka", format: r => r.org_unit_name ?? "" },
    { key: "inherited", header: "Źródło", format: r => r.inherited ? "Odziedziczony" : "Własny" },
  ];

  const OBLIGATION_COLS: ColumnDef<ContextObligation>[] = [
    { key: "custom_name", header: "Nazwa", format: r => r.custom_name ?? r.regulation_name ?? "" },
    { key: "obligation_type", header: "Typ" },
    { key: "compliance_status", header: "Status zgodności", format: r => complianceLabel(r.compliance_status) },
    { key: "responsible_person", header: "Odpowiedzialny", format: r => r.responsible_person ?? "" },
    { key: "effective_from", header: "Obowiązuje od", format: r => r.effective_from ?? "" },
    { key: "org_unit_name", header: "Jednostka", format: r => r.org_unit_name ?? "" },
    { key: "inherited", header: "Źródło", format: r => r.inherited ? "Odziedziczony" : "Własny" },
  ];

  const STAKEHOLDER_COLS: ColumnDef<ContextStakeholder>[] = [
    { key: "name", header: "Nazwa" },
    { key: "stakeholder_type", header: "Typ", format: r => r.stakeholder_type === "internal" ? "Wewnętrzny" : "Zewnętrzny" },
    { key: "category_name", header: "Kategoria", format: r => r.category_name ?? "" },
    { key: "influence_level", header: "Wpływ", format: r => relevanceLabel(r.influence_level) },
    { key: "relevance", header: "Istotność", format: r => relevanceLabel(r.relevance) },
    { key: "org_unit_name", header: "Jednostka", format: r => r.org_unit_name ?? "" },
    { key: "inherited", header: "Źródło", format: r => r.inherited ? "Odziedziczony" : "Własny" },
  ];

  const REVIEW_COLS: ColumnDef<ContextReview>[] = [
    { key: "review_date", header: "Data przeglądu" },
    { key: "reviewer", header: "Przeglądający" },
    { key: "review_type", header: "Typ", format: r => r.review_type === "scheduled" ? "Planowany" : r.review_type === "triggered" ? "Wyzwolony" : "Początkowy" },
    { key: "approved_by", header: "Zatwierdzony przez", format: r => r.approved_by ?? "" },
    { key: "next_review_date", header: "Następny przegląd", format: r => r.next_review_date ?? "" },
  ];

  const { visible: issueVisCols, toggle: toggleIssueCol } = useColumnVisibility(ISSUE_COLS, "ctx-issues");
  const { visible: oblVisCols, toggle: toggleOblCol } = useColumnVisibility(OBLIGATION_COLS, "ctx-obligations");
  const { visible: stkVisCols, toggle: toggleStkCol } = useColumnVisibility(STAKEHOLDER_COLS, "ctx-stakeholders");
  const { visible: revVisCols, toggle: toggleRevCol } = useColumnVisibility(REVIEW_COLS, "ctx-reviews");

  /* ─── State ─── */
  const [orgUnits, setOrgUnits] = useState<OrgUnitTreeNode[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overviews map for tree badges
  const [overviews, setOverviews] = useState<Map<number, ContextOverview>>(new Map());

  // Data
  const [overview, setOverview] = useState<ContextOverview | null>(null);
  const [general, setGeneral] = useState<ContextGeneral | null>(null);
  const [issues, setIssues] = useState<ContextIssue[]>([]);
  const [obligations, setObligations] = useState<ContextObligation[]>([]);
  const [stakeholders, setStakeholders] = useState<ContextStakeholder[]>([]);
  const [scope, setScope] = useState<ContextScope | null>(null);
  const [riskAppetite, setRiskAppetite] = useState<ContextRiskAppetite | null>(null);
  const [reviews, setReviews] = useState<ContextReview[]>([]);

  // Search
  const [search, setSearch] = useState("");

  // Forms
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showOblForm, setShowOblForm] = useState(false);
  const [showStkForm, setShowStkForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  // Detail
  const [selectedIssue, setSelectedIssue] = useState<ContextIssue | null>(null);
  const [selectedObl, setSelectedObl] = useState<ContextObligation | null>(null);
  const [selectedStk, setSelectedStk] = useState<ContextStakeholder | null>(null);

  // Structure tab state
  const [levels, setLevels] = useState<OrgLevel[]>([]);
  const [showAddUnitForm, setShowAddUnitForm] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [editingUnit, setEditingUnit] = useState(false);
  const [unitForm, setUnitForm] = useState<Record<string, unknown>>({});
  const [addUnitParentId, setAddUnitParentId] = useState<number | null>(null);

  // General form edit
  const [editingGeneral, setEditingGeneral] = useState(false);
  const [generalForm, setGeneralForm] = useState<Record<string, unknown>>({});

  // Scope form
  const [showScopeForm, setShowScopeForm] = useState(false);
  const [scopeForm, setScopeForm] = useState<Record<string, unknown>>({});

  // Risk appetite form
  const [showRAForm, setShowRAForm] = useState(false);
  const [raForm, setRAForm] = useState<Record<string, unknown>>({});

  // Selected unit info from tree
  const selectedUnit = useMemo(() => {
    function findNode(nodes: OrgUnitTreeNode[], id: number): OrgUnitTreeNode | null {
      for (const n of nodes) {
        if (n.id === id) return n;
        const found = findNode(n.children, id);
        if (found) return found;
      }
      return null;
    }
    return selectedUnitId ? findNode(orgUnits, selectedUnitId) : null;
  }, [orgUnits, selectedUnitId]);

  /* ─── Load org units ─── */
  useEffect(() => {
    setTreeLoading(true);
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(data => {
      setOrgUnits(data);
      if (data.length > 0 && !selectedUnitId) setSelectedUnitId(data[0].id);
      // Load overviews for all units
      loadAllOverviews(data);
    }).catch(() => {}).finally(() => setTreeLoading(false));
  }, []);

  function flattenIds(nodes: OrgUnitTreeNode[]): number[] {
    const ids: number[] = [];
    for (const n of nodes) {
      ids.push(n.id);
      ids.push(...flattenIds(n.children));
    }
    return ids;
  }

  async function loadAllOverviews(tree: OrgUnitTreeNode[]) {
    const ids = flattenIds(tree);
    const map = new Map<number, ContextOverview>();
    // Load overviews in parallel (batched)
    await Promise.all(ids.map(async (id) => {
      try {
        const ov = await api.get<ContextOverview>(`/api/v1/org-units/${id}/context`);
        map.set(id, ov);
      } catch { /* skip */ }
    }));
    setOverviews(map);
  }

  /* ─── Load context data when unit changes ─── */
  useEffect(() => {
    if (!selectedUnitId) return;
    loadContextData(selectedUnitId);
  }, [selectedUnitId]);

  async function loadContextData(unitId: number) {
    setLoading(true);
    setError(null);
    setSelectedIssue(null);
    setSelectedObl(null);
    setSelectedStk(null);
    try {
      const base = `/api/v1/org-units/${unitId}/context`;
      const [ov, gen, iss, obl, stk, scp, ra, rev] = await Promise.all([
        api.get<ContextOverview>(base),
        api.get<ContextGeneral>(base + "/general"),
        api.get<ContextIssue[]>(base + "/issues"),
        api.get<ContextObligation[]>(base + "/obligations"),
        api.get<ContextStakeholder[]>(base + "/stakeholders"),
        api.get<ContextScope | null>(base + "/scope").catch(() => null),
        api.get<ContextRiskAppetite | null>(base + "/risk-appetite").catch(() => null),
        api.get<ContextReview[]>(base + "/reviews"),
      ]);
      setOverview(ov);
      setGeneral(gen);
      setIssues(iss);
      setObligations(obl);
      setStakeholders(stk);
      setScope(scp);
      setRiskAppetite(ra);
      setReviews(rev);
      // Update overview in tree map
      setOverviews(prev => {
        const next = new Map(prev);
        next.set(unitId, ov);
        return next;
      });
    } catch (e: unknown) {
      setError(String(e));
    }
    setLoading(false);
  }

  /* ─── Structure: Add unit ─── */
  const openAddUnitForm = async () => {
    if (levels.length === 0) {
      try {
        const lvls = await api.get<OrgLevel[]>("/api/v1/org-levels");
        setLevels(lvls);
      } catch { /* ignore */ }
    }
    setShowAddUnitForm(true);
  };

  async function handleAddUnit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingUnit(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      parent_id: addUnitParentId,
      level_id: Number(fd.get("level_id")),
      name: fd.get("name") as string,
      symbol: fd.get("symbol") as string,
      owner: (fd.get("owner") as string) || null,
      security_contact: (fd.get("security_contact") as string) || null,
      description: (fd.get("description") as string) || null,
    };
    try {
      await api.post("/api/v1/org-units", body);
      setShowAddUnitForm(false);
      // Refresh tree
      const data = await api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree");
      setOrgUnits(data);
      loadAllOverviews(data);
    } catch (err) { setError("Błąd zapisu: " + err); }
    setSavingUnit(false);
  }

  async function handleSaveUnit() {
    if (!selectedUnit) return;
    setSavingUnit(true);
    try {
      await api.put(`/api/v1/org-units/${selectedUnit.id}`, unitForm);
      setEditingUnit(false);
      const data = await api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree");
      setOrgUnits(data);
      loadAllOverviews(data);
      loadContextData(selectedUnit.id);
    } catch (err) { setError("Błąd zapisu: " + err); }
    setSavingUnit(false);
  }

  async function handleDeactivateUnit() {
    if (!selectedUnit) return;
    if (!confirm(`Dezaktywować jednostkę "${selectedUnit.name}"?`)) return;
    try {
      await api.delete(`/api/v1/org-units/${selectedUnit.id}`);
      setSelectedUnitId(null);
      const data = await api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree");
      setOrgUnits(data);
      loadAllOverviews(data);
    } catch (err) { setError("Błąd: " + err); }
  }

  /* ─── Issue form ─── */
  const emptyIssueForm = { issue_type: "internal", title: "", description: "", impact_level: "", relevance: "", response_action: "", review_date: "" };
  const [issueForm, setIssueForm] = useState(emptyIssueForm);

  async function saveIssue() {
    if (!selectedUnitId || !issueForm.title) { setTried(true); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...issueForm };
      if (!payload.impact_level) delete payload.impact_level;
      if (!payload.relevance) delete payload.relevance;
      if (!payload.review_date) delete payload.review_date;
      await api.post(`/api/v1/org-units/${selectedUnitId}/context/issues`, payload);
      setShowIssueForm(false);
      setIssueForm({ ...emptyIssueForm });
      setTried(false);
      loadContextData(selectedUnitId);
    } catch (e: unknown) { setError(String(e)); }
    setSaving(false);
  }

  /* ─── Obligation form ─── */
  const emptyOblForm = { obligation_type: "legal", custom_name: "", description: "", responsible_person: "", compliance_status: "not_assessed", effective_from: "" };
  const [oblForm, setOblForm] = useState(emptyOblForm);

  async function saveObligation() {
    if (!selectedUnitId || !oblForm.custom_name) { setTried(true); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...oblForm };
      if (!payload.effective_from) delete payload.effective_from;
      await api.post(`/api/v1/org-units/${selectedUnitId}/context/obligations`, payload);
      setShowOblForm(false);
      setOblForm({ ...emptyOblForm });
      setTried(false);
      loadContextData(selectedUnitId);
    } catch (e: unknown) { setError(String(e)); }
    setSaving(false);
  }

  /* ─── Stakeholder form ─── */
  const emptyStkForm = { stakeholder_type: "internal", name: "", description: "", needs_expectations: "", requirements_type: "", influence_level: "", relevance: "" };
  const [stkForm, setStkForm] = useState(emptyStkForm);

  async function saveStakeholder() {
    if (!selectedUnitId || !stkForm.name) { setTried(true); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...stkForm };
      if (!payload.requirements_type) delete payload.requirements_type;
      if (!payload.influence_level) delete payload.influence_level;
      if (!payload.relevance) delete payload.relevance;
      await api.post(`/api/v1/org-units/${selectedUnitId}/context/stakeholders`, payload);
      setShowStkForm(false);
      setStkForm({ ...emptyStkForm });
      setTried(false);
      loadContextData(selectedUnitId);
    } catch (e: unknown) { setError(String(e)); }
    setSaving(false);
  }

  /* ─── Review form ─── */
  const emptyRevForm = { review_date: "", reviewer: "", review_type: "scheduled", changes_summary: "", next_review_date: "" };
  const [revForm, setRevForm] = useState(emptyRevForm);

  async function saveReview() {
    if (!selectedUnitId || !revForm.review_date || !revForm.reviewer) { setTried(true); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...revForm };
      if (!payload.next_review_date) delete payload.next_review_date;
      await api.post(`/api/v1/org-units/${selectedUnitId}/context/reviews`, payload);
      setShowReviewForm(false);
      setRevForm({ ...emptyRevForm });
      setTried(false);
      loadContextData(selectedUnitId);
    } catch (e: unknown) { setError(String(e)); }
    setSaving(false);
  }

  /* ─── General save ─── */
  async function saveGeneral() {
    if (!selectedUnitId) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/org-units/${selectedUnitId}/context/general`, generalForm);
      setEditingGeneral(false);
      loadContextData(selectedUnitId);
    } catch (e: unknown) { setError(String(e)); }
    setSaving(false);
  }

  /* ─── Scope save ─── */
  async function saveScope() {
    if (!selectedUnitId) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/org-units/${selectedUnitId}/context/scope`, scopeForm);
      setShowScopeForm(false);
      loadContextData(selectedUnitId);
    } catch (e: unknown) { setError(String(e)); }
    setSaving(false);
  }

  /* ─── Risk Appetite save ─── */
  async function saveRA() {
    if (!selectedUnitId) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/org-units/${selectedUnitId}/context/risk-appetite`, raForm);
      setShowRAForm(false);
      loadContextData(selectedUnitId);
    } catch (e: unknown) { setError(String(e)); }
    setSaving(false);
  }

  /* ─── Delete helpers ─── */
  async function deleteIssue(id: number) {
    if (!selectedUnitId) return;
    await api.delete(`/api/v1/org-units/${selectedUnitId}/context/issues/${id}`);
    setSelectedIssue(null);
    loadContextData(selectedUnitId);
  }

  async function deleteObligation(id: number) {
    if (!selectedUnitId) return;
    await api.delete(`/api/v1/org-units/${selectedUnitId}/context/obligations/${id}`);
    setSelectedObl(null);
    loadContextData(selectedUnitId);
  }

  async function deleteStakeholder(id: number) {
    if (!selectedUnitId) return;
    await api.delete(`/api/v1/org-units/${selectedUnitId}/context/stakeholders/${id}`);
    setSelectedStk(null);
    loadContextData(selectedUnitId);
  }

  /* ─── Filtered data ─── */
  const filteredIssues = useMemo(() => {
    if (!search) return issues;
    const s = search.toLowerCase();
    return issues.filter(i => i.title.toLowerCase().includes(s) || (i.description ?? "").toLowerCase().includes(s));
  }, [issues, search]);

  const filteredObligations = useMemo(() => {
    if (!search) return obligations;
    const s = search.toLowerCase();
    return obligations.filter(o => (o.custom_name ?? "").toLowerCase().includes(s) || (o.description ?? "").toLowerCase().includes(s));
  }, [obligations, search]);

  const filteredStakeholders = useMemo(() => {
    if (!search) return stakeholders;
    const s = search.toLowerCase();
    return stakeholders.filter(st => st.name.toLowerCase().includes(s) || (st.description ?? "").toLowerCase().includes(s));
  }, [stakeholders, search]);

  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "calc(100vh - 60px)" }}>
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ margin: 0 }}>Kontekst Organizacyjny <span style={{ fontSize: 14, color: "var(--text-muted)" }}>ISO 27001 / 22301 klauzula 4</span></h2>
      </div>

      {error && <div className="card" style={{ background: "var(--red-dim)", color: "var(--red)", padding: 12, margin: "8px 16px 0" }}>{error}</div>}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* ─── Left: Org Tree ─── */}
        <div style={{
          width: 320,
          minWidth: 280,
          maxWidth: 400,
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          background: "var(--bg-card)",
        }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Struktura organizacyjna</span>
            <button className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={openAddUnitForm}>+ Dodaj</button>
          </div>
          {treeLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie...</div>
          ) : orgUnits.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Brak jednostek</div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              {orgUnits.map(n => (
                <ContextTreeNode
                  key={n.id}
                  node={n}
                  depth={0}
                  selectedId={selectedUnitId}
                  onSelect={setSelectedUnitId}
                  overviews={overviews}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── Right: Context Detail ─── */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {!selectedUnitId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
              Wybierz jednostkę z drzewa po lewej stronie
            </div>
          ) : (
            <>
              {/* Unit header */}
              {selectedUnit && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedUnit.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedUnit.level_name} · {selectedUnit.symbol} {selectedUnit.owner ? `· ${selectedUnit.owner}` : ""}</div>
                  </div>
                  {overview && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: statusColor(overview.context_status), fontWeight: 500 }}>{statusLabel(overview.context_status)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "0 16px", background: "var(--bg-card)" }}>
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setActiveTab(t.key); setSearch(""); }}
                    style={{
                      padding: "8px 14px",
                      background: activeTab === t.key ? "var(--blue-dim)" : "transparent",
                      color: activeTab === t.key ? "var(--blue)" : "var(--text-muted)",
                      border: "none",
                      borderBottom: activeTab === t.key ? "2px solid var(--blue)" : "2px solid transparent",
                      cursor: "pointer",
                      fontWeight: activeTab === t.key ? 600 : 400,
                      fontSize: 13,
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
                {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ładowanie...</div>}

                {!loading && activeTab === "structure" && renderStructure()}
                {!loading && activeTab === "overview" && overview && renderOverview()}
                {!loading && activeTab === "issues" && renderIssues()}
                {!loading && activeTab === "obligations" && renderObligations()}
                {!loading && activeTab === "stakeholders" && renderStakeholders()}
                {!loading && activeTab === "scope" && renderScope()}
                {!loading && activeTab === "risk_appetite" && renderRiskAppetite()}
                {!loading && activeTab === "reviews" && renderReviews()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Modals ─── */}
      {renderIssueModal()}
      {renderObligationModal()}
      {renderStakeholderModal()}
      {renderReviewModal()}
      {renderScopeModal()}
      {renderRAModal()}
      {renderAddUnitModal()}
    </div>
  );

  /* ═══════════════ TAB RENDERERS ═══════════════ */

  function renderStructure() {
    if (!selectedUnit) return <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Wybierz jednostkę z drzewa</div>;

    if (editingUnit) {
      return (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 15 }}>Edycja jednostki: {selectedUnit.name}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Nazwa *</label>
              <input className="form-control" value={(unitForm.name as string) ?? ""} onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Symbol *</label>
              <input className="form-control" value={(unitForm.symbol as string) ?? ""} onChange={e => setUnitForm({ ...unitForm, symbol: e.target.value })} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Właściciel biznesowy</label>
              <input className="form-control" value={(unitForm.owner as string) ?? ""} onChange={e => setUnitForm({ ...unitForm, owner: e.target.value || null })} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Security Contact</label>
              <input className="form-control" value={(unitForm.security_contact as string) ?? ""} onChange={e => setUnitForm({ ...unitForm, security_contact: e.target.value || null })} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Opis</label>
              <textarea className="form-control" rows={2} value={(unitForm.description as string) ?? ""} onChange={e => setUnitForm({ ...unitForm, description: e.target.value || null })} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Status</label>
              <select className="form-control" value={(unitForm.is_active as boolean) ? "active" : "inactive"} onChange={e => setUnitForm({ ...unitForm, is_active: e.target.value === "active" })}>
                <option value="active">Aktywna</option>
                <option value="inactive">Nieaktywna</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => setEditingUnit(false)}>Anuluj</button>
            <button className="btn btn-primary" onClick={handleSaveUnit} disabled={savingUnit}>{savingUnit ? "Zapisywanie..." : "Zapisz zmiany"}</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Atrybuty jednostki</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={handleDeactivateUnit}>Dezaktywuj</button>
              <button className="btn btn-sm btn-primary" onClick={() => {
                setEditingUnit(true);
                setUnitForm({
                  name: selectedUnit.name,
                  symbol: selectedUnit.symbol,
                  owner: selectedUnit.owner,
                  security_contact: selectedUnit.security_contact,
                  description: selectedUnit.description,
                  is_active: selectedUnit.is_active,
                });
              }}>Edytuj</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
            <DetailRow label="Nazwa" value={selectedUnit.name} />
            <DetailRow label="Symbol" value={selectedUnit.symbol} />
            <DetailRow label="Poziom" value={selectedUnit.level_name} />
            <DetailRow label="Właściciel biznesowy" value={selectedUnit.owner} />
            <DetailRow label="Security Contact" value={selectedUnit.security_contact} />
            <DetailRow label="Status" value={selectedUnit.is_active ? "Aktywna" : "Nieaktywna"} color={selectedUnit.is_active ? "var(--green)" : "var(--red)"} />
            {selectedUnit.description && (
              <div style={{ gridColumn: "span 2" }}>
                <DetailRow label="Opis" value={selectedUnit.description} />
              </div>
            )}
          </div>
        </div>
        {general && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Dane kontekstowe</h3>
              <button className="btn btn-sm" onClick={() => { setEditingGeneral(true); setGeneralForm({ headcount: general.headcount, mission_vision: general.mission_vision, key_products_services: general.key_products_services, strategic_objectives: general.strategic_objectives, key_processes_notes: general.key_processes_notes, context_status: general.context_status, context_reviewer: general.context_reviewer }); }}>Edytuj</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <DetailRow label="Zatrudnienie" value={general.headcount ?? "—"} />
              <DetailRow label="Status kontekstu" value={statusLabel(general.context_status)} color={statusColor(general.context_status)} />
              <DetailRow label="Przeglądający" value={general.context_reviewer} />
              <DetailRow label="Ostatni przegląd" value={general.context_review_date} />
              <DetailRow label="Następny przegląd" value={general.context_next_review} />
            </div>
            {general.mission_vision && <div style={{ marginTop: 12 }}><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Misja / Wizja</div><div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{general.mission_vision}</div></div>}
            {general.key_products_services && <div style={{ marginTop: 8 }}><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Kluczowe produkty / usługi</div><div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{general.key_products_services}</div></div>}
            {general.strategic_objectives && <div style={{ marginTop: 8 }}><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Cele strategiczne</div><div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{general.strategic_objectives}</div></div>}
            {general.key_processes_notes && <div style={{ marginTop: 8 }}><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Uwagi o kluczowych procesach</div><div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{general.key_processes_notes}</div></div>}
          </div>
        )}
        {editingGeneral && (
          <Modal open={editingGeneral} onClose={() => setEditingGeneral(false)} title="Edytuj dane kontekstowe" wide>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Zatrudnienie</label>
                <input type="number" className="form-control" value={(generalForm.headcount as number | null) ?? ""} onChange={e => setGeneralForm({ ...generalForm, headcount: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Status kontekstu</label>
                <select className="form-control" value={(generalForm.context_status as string) ?? ""} onChange={e => setGeneralForm({ ...generalForm, context_status: e.target.value || null })}>
                  <option value="">— wybierz —</option>
                  <option value="draft">Szkic</option>
                  <option value="in_review">W przeglądzie</option>
                  <option value="approved">Zatwierdzony</option>
                  <option value="needs_update">Wymaga aktualizacji</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Przeglądający</label>
                <input className="form-control" value={(generalForm.context_reviewer as string) ?? ""} onChange={e => setGeneralForm({ ...generalForm, context_reviewer: e.target.value || null })} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Misja / Wizja</label>
              <textarea className="form-control" rows={3} value={(generalForm.mission_vision as string) ?? ""} onChange={e => setGeneralForm({ ...generalForm, mission_vision: e.target.value || null })} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Kluczowe produkty / usługi</label>
              <textarea className="form-control" rows={2} value={(generalForm.key_products_services as string) ?? ""} onChange={e => setGeneralForm({ ...generalForm, key_products_services: e.target.value || null })} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Cele strategiczne</label>
              <textarea className="form-control" rows={2} value={(generalForm.strategic_objectives as string) ?? ""} onChange={e => setGeneralForm({ ...generalForm, strategic_objectives: e.target.value || null })} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Uwagi o kluczowych procesach</label>
              <textarea className="form-control" rows={2} value={(generalForm.key_processes_notes as string) ?? ""} onChange={e => setGeneralForm({ ...generalForm, key_processes_notes: e.target.value || null })} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setEditingGeneral(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={saveGeneral} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  function renderOverview() {
    if (!overview || !general) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Status */}
        <div className="grid-4">
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Status kontekstu</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: statusColor(overview.context_status) }}>{statusLabel(overview.context_status)}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Czynniki</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{overview.issues_count} <span style={{ fontSize: 12, color: "var(--text-muted)" }}>({overview.issues_own} własnych, {overview.issues_inherited} odziedziczonych)</span></div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Zobowiązania</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{overview.obligations_count} <span style={{ fontSize: 12, color: "var(--text-muted)" }}>({overview.obligations_own} wł., {overview.obligations_inherited} odz.)</span></div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Interesariusze</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{overview.stakeholders_count} <span style={{ fontSize: 12, color: "var(--text-muted)" }}>({overview.stakeholders_own} wł., {overview.stakeholders_inherited} odz.)</span></div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* General info */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 15 }}>Dane ogólne</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <DetailRow label="Jednostka" value={general.name} />
              <DetailRow label="Zatrudnienie" value={general.headcount ?? "—"} />
              <DetailRow label="Status" value={statusLabel(general.context_status)} color={statusColor(general.context_status)} />
              <DetailRow label="Przeglądający" value={general.context_reviewer} />
              <DetailRow label="Ostatni przegląd" value={general.context_review_date} />
              <DetailRow label="Następny przegląd" value={general.context_next_review} />
            </div>
          </div>

          {/* Scope & Risk Appetite summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 15 }}>Zakres SZBI</h3>
              {overview.has_scope ? (
                <div style={{ fontSize: 13 }}>
                  <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>Zdefiniowany</span>
                  {overview.scope_inherited && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>(odziedziczony)</span>}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nie zdefiniowano</div>
              )}
            </div>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 15 }}>Apetyt na ryzyko</h3>
              {overview.has_risk_appetite ? (
                <div style={{ fontSize: 13 }}>
                  <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>Zdefiniowany</span>
                  {overview.risk_appetite_inherited && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>(odziedziczony)</span>}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nie zdefiniowano</div>
              )}
            </div>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 15 }}>Przeglądy</h3>
              <div style={{ fontSize: 13 }}>
                <DetailRow label="Liczba przeglądów" value={overview.reviews_count} />
                <DetailRow label="Ostatni przegląd" value={overview.last_review_date ?? "—"} />
                <DetailRow label="Następny przegląd" value={overview.next_review_date ?? "—"} />
              </div>
            </div>
          </div>
        </div>

        {/* Edit general modal */}
      </div>
    );
  }

  /* ─── ISSUES ─── */
  function renderIssues() {
    return (
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            columns={ISSUE_COLS}
            visibleColumns={issueVisCols}
            onToggleColumn={toggleIssueCol}
            data={filteredIssues}
            filteredCount={filteredIssues.length}
            totalCount={issues.length}
            unitLabel="czynników"
            exportFilename="kontekst-czynniki"
            primaryLabel="Dodaj czynnik"
            onPrimaryAction={() => setShowIssueForm(true)}
          />
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                {ISSUE_COLS.filter(c => issueVisCols.has(c.key)).map(c => (
                  <th key={c.key}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredIssues.length === 0 && <tr><td colSpan={ISSUE_COLS.length} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak danych</td></tr>}
              {filteredIssues.map(i => (
                <tr key={i.id} onClick={() => setSelectedIssue(i)} style={{ cursor: "pointer", background: selectedIssue?.id === i.id ? "var(--bg-card-hover)" : undefined, opacity: i.inherited ? 0.75 : 1 }}>
                  {ISSUE_COLS.filter(c => issueVisCols.has(c.key)).map(c => (
                    <td key={c.key}>
                      {c.key === "relevance" ? <span style={{ color: relevanceColor(i.relevance) }}>{c.format ? c.format(i) : (i[c.key] as string)}</span>
                        : c.key === "inherited" ? <span className="score-badge" style={{ background: i.inherited ? "var(--blue-dim)" : "var(--green-dim)", color: i.inherited ? "var(--blue)" : "var(--green)", fontSize: 11 }}>{c.format!(i)}</span>
                        : c.format ? c.format(i) : (i[c.key] as string)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedIssue && (
          <div className="card" style={{ width: 320, padding: 16, fontSize: 13, position: "sticky", top: 16, alignSelf: "flex-start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Szczegóły</h3>
              <button className="btn btn-sm" onClick={() => setSelectedIssue(null)}>✕</button>
            </div>
            <DetailRow label="Tytuł" value={selectedIssue.title} />
            <DetailRow label="Typ" value={selectedIssue.issue_type === "internal" ? "Wewnętrzny" : "Zewnętrzny"} />
            <DetailRow label="Kategoria" value={selectedIssue.category_name} />
            <DetailRow label="Wpływ" value={impactLabel(selectedIssue.impact_level)} />
            <DetailRow label="Istotność" value={relevanceLabel(selectedIssue.relevance)} color={relevanceColor(selectedIssue.relevance)} />
            <DetailRow label="Jednostka" value={selectedIssue.org_unit_name} />
            <DetailRow label="Źródło" value={selectedIssue.inherited ? "Odziedziczony" : "Własny"} />
            {selectedIssue.description && <div style={{ marginTop: 8 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Opis</div><div style={{ whiteSpace: "pre-wrap" }}>{selectedIssue.description}</div></div>}
            {selectedIssue.response_action && <div style={{ marginTop: 8 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Działanie</div><div style={{ whiteSpace: "pre-wrap" }}>{selectedIssue.response_action}</div></div>}
            {!selectedIssue.inherited && (
              <button className="btn btn-sm" style={{ marginTop: 12, color: "var(--red)" }} onClick={() => deleteIssue(selectedIssue.id)}>Dezaktywuj</button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── OBLIGATIONS ─── */
  function renderObligations() {
    return (
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            columns={OBLIGATION_COLS}
            visibleColumns={oblVisCols}
            onToggleColumn={toggleOblCol}
            data={filteredObligations}
            filteredCount={filteredObligations.length}
            totalCount={obligations.length}
            unitLabel="zobowiązań"
            exportFilename="kontekst-zobowiazania"
            primaryLabel="Dodaj zobowiązanie"
            onPrimaryAction={() => setShowOblForm(true)}
          />
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                {OBLIGATION_COLS.filter(c => oblVisCols.has(c.key)).map(c => (
                  <th key={c.key}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredObligations.length === 0 && <tr><td colSpan={OBLIGATION_COLS.length} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak danych</td></tr>}
              {filteredObligations.map(o => (
                <tr key={o.id} onClick={() => setSelectedObl(o)} style={{ cursor: "pointer", background: selectedObl?.id === o.id ? "var(--bg-card-hover)" : undefined, opacity: o.inherited ? 0.75 : 1 }}>
                  {OBLIGATION_COLS.filter(c => oblVisCols.has(c.key)).map(c => (
                    <td key={c.key}>
                      {c.key === "compliance_status" ? <span style={{ color: complianceColor(o.compliance_status) }}>{c.format!(o)}</span>
                        : c.key === "inherited" ? <span className="score-badge" style={{ background: o.inherited ? "var(--blue-dim)" : "var(--green-dim)", color: o.inherited ? "var(--blue)" : "var(--green)", fontSize: 11 }}>{c.format!(o)}</span>
                        : c.format ? c.format(o) : (o[c.key] as string)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedObl && (
          <div className="card" style={{ width: 320, padding: 16, fontSize: 13, position: "sticky", top: 16, alignSelf: "flex-start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Szczegóły</h3>
              <button className="btn btn-sm" onClick={() => setSelectedObl(null)}>✕</button>
            </div>
            <DetailRow label="Nazwa" value={selectedObl.custom_name} />
            <DetailRow label="Typ" value={selectedObl.obligation_type} />
            <DetailRow label="Zgodność" value={complianceLabel(selectedObl.compliance_status)} color={complianceColor(selectedObl.compliance_status)} />
            <DetailRow label="Odpowiedzialny" value={selectedObl.responsible_person} />
            <DetailRow label="Obowiązuje od" value={selectedObl.effective_from} />
            <DetailRow label="Jednostka" value={selectedObl.org_unit_name} />
            {selectedObl.description && <div style={{ marginTop: 8 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Opis</div><div style={{ whiteSpace: "pre-wrap" }}>{selectedObl.description}</div></div>}
            {!selectedObl.inherited && (
              <button className="btn btn-sm" style={{ marginTop: 12, color: "var(--red)" }} onClick={() => deleteObligation(selectedObl.id)}>Dezaktywuj</button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── STAKEHOLDERS ─── */
  function renderStakeholders() {
    return (
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            columns={STAKEHOLDER_COLS}
            visibleColumns={stkVisCols}
            onToggleColumn={toggleStkCol}
            data={filteredStakeholders}
            filteredCount={filteredStakeholders.length}
            totalCount={stakeholders.length}
            unitLabel="interesariuszy"
            exportFilename="kontekst-interesariusze"
            primaryLabel="Dodaj interesariusza"
            onPrimaryAction={() => setShowStkForm(true)}
          />
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                {STAKEHOLDER_COLS.filter(c => stkVisCols.has(c.key)).map(c => (
                  <th key={c.key}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStakeholders.length === 0 && <tr><td colSpan={STAKEHOLDER_COLS.length} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak danych</td></tr>}
              {filteredStakeholders.map(st => (
                <tr key={st.id} onClick={() => setSelectedStk(st)} style={{ cursor: "pointer", background: selectedStk?.id === st.id ? "var(--bg-card-hover)" : undefined, opacity: st.inherited ? 0.75 : 1 }}>
                  {STAKEHOLDER_COLS.filter(c => stkVisCols.has(c.key)).map(c => (
                    <td key={c.key}>
                      {c.key === "relevance" || c.key === "influence_level" ? <span style={{ color: relevanceColor(c.key === "relevance" ? st.relevance : st.influence_level) }}>{c.format!(st)}</span>
                        : c.key === "inherited" ? <span className="score-badge" style={{ background: st.inherited ? "var(--blue-dim)" : "var(--green-dim)", color: st.inherited ? "var(--blue)" : "var(--green)", fontSize: 11 }}>{c.format!(st)}</span>
                        : c.format ? c.format(st) : (st[c.key] as string)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedStk && (
          <div className="card" style={{ width: 320, padding: 16, fontSize: 13, position: "sticky", top: 16, alignSelf: "flex-start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Szczegóły</h3>
              <button className="btn btn-sm" onClick={() => setSelectedStk(null)}>✕</button>
            </div>
            <DetailRow label="Nazwa" value={selectedStk.name} />
            <DetailRow label="Typ" value={selectedStk.stakeholder_type === "internal" ? "Wewnętrzny" : "Zewnętrzny"} />
            <DetailRow label="Kategoria" value={selectedStk.category_name} />
            <DetailRow label="Wpływ" value={relevanceLabel(selectedStk.influence_level)} color={relevanceColor(selectedStk.influence_level)} />
            <DetailRow label="Istotność" value={relevanceLabel(selectedStk.relevance)} color={relevanceColor(selectedStk.relevance)} />
            <DetailRow label="Kanał komunikacji" value={selectedStk.communication_channel} />
            <DetailRow label="Jednostka" value={selectedStk.org_unit_name} />
            {selectedStk.needs_expectations && <div style={{ marginTop: 8 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Potrzeby / oczekiwania</div><div style={{ whiteSpace: "pre-wrap" }}>{selectedStk.needs_expectations}</div></div>}
            {!selectedStk.inherited && (
              <button className="btn btn-sm" style={{ marginTop: 12, color: "var(--red)" }} onClick={() => deleteStakeholder(selectedStk.id)}>Dezaktywuj</button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── SCOPE ─── */
  function renderScope() {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Zakres Systemu Zarządzania Bezpieczeństwem Informacji</h3>
          <button className="btn btn-sm btn-primary" onClick={() => { setScopeForm(scope ? { scope_statement: scope.scope_statement, in_scope_description: scope.in_scope_description, out_of_scope_description: scope.out_of_scope_description, geographic_boundaries: scope.geographic_boundaries, technology_boundaries: scope.technology_boundaries, organizational_boundaries: scope.organizational_boundaries, interfaces_dependencies: scope.interfaces_dependencies } : {}); setShowScopeForm(true); }}>
            {scope && !scope.inherited ? "Edytuj" : "Zdefiniuj własny"}
          </button>
        </div>
        {!scope ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 30 }}>Zakres nie został zdefiniowany dla tej jednostki ani jednostek nadrzędnych.</div>
        ) : (
          <div style={{ fontSize: 13 }}>
            {scope.inherited && <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--blue-dim)", borderRadius: 6, fontSize: 12 }}>Odziedziczono z: <strong>{scope.org_unit_name}</strong> (wersja {scope.version})</div>}
            <DetailRow label="Wersja" value={scope.version} />
            <DetailRow label="Zatwierdzony przez" value={scope.approved_by} />
            <DetailRow label="Data zatwierdzenia" value={scope.approved_date} />
            {scope.scope_statement && <div style={{ marginTop: 12 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Oświadczenie o zakresie</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{scope.scope_statement}</div></div>}
            {scope.in_scope_description && <div style={{ marginTop: 10 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>W zakresie</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{scope.in_scope_description}</div></div>}
            {scope.out_of_scope_description && <div style={{ marginTop: 10 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Poza zakresem</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{scope.out_of_scope_description}</div></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              {scope.geographic_boundaries && <div><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Granice geograficzne</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{scope.geographic_boundaries}</div></div>}
              {scope.technology_boundaries && <div><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Granice technologiczne</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{scope.technology_boundaries}</div></div>}
              {scope.organizational_boundaries && <div><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Granice organizacyjne</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{scope.organizational_boundaries}</div></div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── RISK APPETITE ─── */
  function renderRiskAppetite() {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Apetyt na Ryzyko</h3>
          <button className="btn btn-sm btn-primary" onClick={() => { setRAForm(riskAppetite ? { risk_appetite_statement: riskAppetite.risk_appetite_statement, max_acceptable_risk_level: riskAppetite.max_acceptable_risk_level, max_acceptable_risk_score: riskAppetite.max_acceptable_risk_score, exception_approval_authority: riskAppetite.exception_approval_authority, financial_risk_tolerance: riskAppetite.financial_risk_tolerance, reputational_risk_tolerance: riskAppetite.reputational_risk_tolerance, operational_risk_tolerance: riskAppetite.operational_risk_tolerance } : {}); setShowRAForm(true); }}>
            {riskAppetite && !riskAppetite.inherited ? "Edytuj" : "Zdefiniuj własny"}
          </button>
        </div>
        {!riskAppetite ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 30 }}>Apetyt na ryzyko nie został zdefiniowany.</div>
        ) : (
          <div style={{ fontSize: 13 }}>
            {riskAppetite.inherited && <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--blue-dim)", borderRadius: 6, fontSize: 12 }}>Odziedziczono z: <strong>{riskAppetite.org_unit_name}</strong></div>}
            <DetailRow label="Maks. akceptowalny poziom ryzyka" value={relevanceLabel(riskAppetite.max_acceptable_risk_level)} color={relevanceColor(riskAppetite.max_acceptable_risk_level)} />
            <DetailRow label="Maks. akceptowalny wynik ryzyka" value={riskAppetite.max_acceptable_risk_score} />
            <DetailRow label="Organ zatwierdzający wyjątki" value={riskAppetite.exception_approval_authority} />
            <DetailRow label="Zatwierdzony przez" value={riskAppetite.approved_by} />
            <DetailRow label="Data zatwierdzenia" value={riskAppetite.approved_date} />
            {riskAppetite.risk_appetite_statement && <div style={{ marginTop: 12 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Oświadczenie o apetycie na ryzyko</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{riskAppetite.risk_appetite_statement}</div></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              {riskAppetite.financial_risk_tolerance && <div><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Tolerancja fin.</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{riskAppetite.financial_risk_tolerance}</div></div>}
              {riskAppetite.reputational_risk_tolerance && <div><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Tolerancja reput.</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{riskAppetite.reputational_risk_tolerance}</div></div>}
              {riskAppetite.operational_risk_tolerance && <div><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Tolerancja oper.</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{riskAppetite.operational_risk_tolerance}</div></div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── REVIEWS ─── */
  function renderReviews() {
    return (
      <div>
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          columns={REVIEW_COLS}
          visibleColumns={revVisCols}
          onToggleColumn={toggleRevCol}
          data={reviews}
          filteredCount={reviews.length}
          totalCount={reviews.length}
          unitLabel="przeglądów"
          exportFilename="kontekst-przeglady"
          primaryLabel="Dodaj przegląd"
          onPrimaryAction={() => setShowReviewForm(true)}
        />
        <table className="data-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              {REVIEW_COLS.filter(c => revVisCols.has(c.key)).map(c => (
                <th key={c.key}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 && <tr><td colSpan={REVIEW_COLS.length} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak przeglądów</td></tr>}
            {reviews.map(r => (
              <tr key={r.id}>
                {REVIEW_COLS.filter(c => revVisCols.has(c.key)).map(c => (
                  <td key={c.key}>{c.format ? c.format(r) : (r[c.key] as string)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ═══════════════ MODALS ═══════════════ */

  function renderIssueModal() {
    return (
      <Modal open={showIssueForm} onClose={() => { setShowIssueForm(false); setTried(false); }} title="Nowy czynnik kontekstowy">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Typ *</label>
            <select className="form-control" value={issueForm.issue_type} onChange={e => setIssueForm({ ...issueForm, issue_type: e.target.value })}>
              <option value="internal">Wewnętrzny</option>
              <option value="external">Zewnętrzny</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Istotność</label>
            <select className="form-control" value={issueForm.relevance} onChange={e => setIssueForm({ ...issueForm, relevance: e.target.value })}>
              <option value="">— wybierz —</option>
              <option value="high">Wysoka</option>
              <option value="medium">Średnia</option>
              <option value="low">Niska</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Tytuł *</label>
          <input className="form-control" style={fieldErr(!!issueForm.title)} value={issueForm.title} onChange={e => setIssueForm({ ...issueForm, title: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Opis</label>
          <textarea className="form-control" rows={3} value={issueForm.description} onChange={e => setIssueForm({ ...issueForm, description: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Wpływ</label>
            <select className="form-control" value={issueForm.impact_level} onChange={e => setIssueForm({ ...issueForm, impact_level: e.target.value })}>
              <option value="">— wybierz —</option>
              <option value="positive">Pozytywny</option>
              <option value="negative">Negatywny</option>
              <option value="neutral">Neutralny</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Data przeglądu</label>
            <input type="date" className="form-control" value={issueForm.review_date} onChange={e => setIssueForm({ ...issueForm, review_date: e.target.value })} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Działanie</label>
          <textarea className="form-control" rows={2} value={issueForm.response_action} onChange={e => setIssueForm({ ...issueForm, response_action: e.target.value })} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => { setShowIssueForm(false); setTried(false); }}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveIssue} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
        </div>
      </Modal>
    );
  }

  function renderObligationModal() {
    return (
      <Modal open={showOblForm} onClose={() => { setShowOblForm(false); setTried(false); }} title="Nowe zobowiązanie">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Typ *</label>
            <select className="form-control" value={oblForm.obligation_type} onChange={e => setOblForm({ ...oblForm, obligation_type: e.target.value })}>
              <option value="legal">Prawne</option>
              <option value="regulatory">Regulacyjne</option>
              <option value="contractual">Kontraktowe</option>
              <option value="voluntary">Dobrowolne</option>
              <option value="internal">Wewnętrzne</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Status zgodności</label>
            <select className="form-control" value={oblForm.compliance_status} onChange={e => setOblForm({ ...oblForm, compliance_status: e.target.value })}>
              <option value="not_assessed">Nieoceniony</option>
              <option value="compliant">Zgodny</option>
              <option value="partially_compliant">Częściowo zgodny</option>
              <option value="non_compliant">Niezgodny</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Nazwa *</label>
          <input className="form-control" style={fieldErr(!!oblForm.custom_name)} value={oblForm.custom_name} onChange={e => setOblForm({ ...oblForm, custom_name: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Opis</label>
          <textarea className="form-control" rows={3} value={oblForm.description} onChange={e => setOblForm({ ...oblForm, description: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Odpowiedzialny</label>
            <input className="form-control" value={oblForm.responsible_person} onChange={e => setOblForm({ ...oblForm, responsible_person: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Obowiązuje od</label>
            <input type="date" className="form-control" value={oblForm.effective_from} onChange={e => setOblForm({ ...oblForm, effective_from: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => { setShowOblForm(false); setTried(false); }}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveObligation} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
        </div>
      </Modal>
    );
  }

  function renderStakeholderModal() {
    return (
      <Modal open={showStkForm} onClose={() => { setShowStkForm(false); setTried(false); }} title="Nowy interesariusz">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Typ *</label>
            <select className="form-control" value={stkForm.stakeholder_type} onChange={e => setStkForm({ ...stkForm, stakeholder_type: e.target.value })}>
              <option value="internal">Wewnętrzny</option>
              <option value="external">Zewnętrzny</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Istotność</label>
            <select className="form-control" value={stkForm.relevance} onChange={e => setStkForm({ ...stkForm, relevance: e.target.value })}>
              <option value="">— wybierz —</option>
              <option value="high">Wysoka</option>
              <option value="medium">Średnia</option>
              <option value="low">Niska</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Nazwa *</label>
          <input className="form-control" style={fieldErr(!!stkForm.name)} value={stkForm.name} onChange={e => setStkForm({ ...stkForm, name: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Opis</label>
          <textarea className="form-control" rows={2} value={stkForm.description} onChange={e => setStkForm({ ...stkForm, description: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Potrzeby / oczekiwania</label>
          <textarea className="form-control" rows={2} value={stkForm.needs_expectations} onChange={e => setStkForm({ ...stkForm, needs_expectations: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Typ wymagań</label>
            <select className="form-control" value={stkForm.requirements_type} onChange={e => setStkForm({ ...stkForm, requirements_type: e.target.value })}>
              <option value="">— wybierz —</option>
              <option value="legal">Prawne</option>
              <option value="contractual">Kontraktowe</option>
              <option value="voluntary">Dobrowolne</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Poziom wpływu</label>
            <select className="form-control" value={stkForm.influence_level} onChange={e => setStkForm({ ...stkForm, influence_level: e.target.value })}>
              <option value="">— wybierz —</option>
              <option value="high">Wysoki</option>
              <option value="medium">Średni</option>
              <option value="low">Niski</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => { setShowStkForm(false); setTried(false); }}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveStakeholder} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
        </div>
      </Modal>
    );
  }

  function renderReviewModal() {
    return (
      <Modal open={showReviewForm} onClose={() => { setShowReviewForm(false); setTried(false); }} title="Nowy przegląd kontekstu">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Data przeglądu *</label>
            <input type="date" className="form-control" style={fieldErr(!!revForm.review_date)} value={revForm.review_date} onChange={e => setRevForm({ ...revForm, review_date: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Typ</label>
            <select className="form-control" value={revForm.review_type} onChange={e => setRevForm({ ...revForm, review_type: e.target.value })}>
              <option value="scheduled">Planowany</option>
              <option value="triggered">Wyzwolony</option>
              <option value="initial">Początkowy</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Przeglądający *</label>
          <input className="form-control" style={fieldErr(!!revForm.reviewer)} value={revForm.reviewer} onChange={e => setRevForm({ ...revForm, reviewer: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Podsumowanie zmian</label>
          <textarea className="form-control" rows={3} value={revForm.changes_summary} onChange={e => setRevForm({ ...revForm, changes_summary: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Data następnego przeglądu</label>
          <input type="date" className="form-control" value={revForm.next_review_date} onChange={e => setRevForm({ ...revForm, next_review_date: e.target.value })} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => { setShowReviewForm(false); setTried(false); }}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveReview} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
        </div>
      </Modal>
    );
  }

  function renderScopeModal() {
    return (
      <Modal open={showScopeForm} onClose={() => setShowScopeForm(false)} title="Zakres SZBI" wide>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Oświadczenie o zakresie</label>
          <textarea className="form-control" rows={3} value={(scopeForm.scope_statement as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, scope_statement: e.target.value || null })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>W zakresie</label>
            <textarea className="form-control" rows={3} value={(scopeForm.in_scope_description as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, in_scope_description: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Poza zakresem</label>
            <textarea className="form-control" rows={3} value={(scopeForm.out_of_scope_description as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, out_of_scope_description: e.target.value || null })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Granice geograficzne</label>
            <textarea className="form-control" rows={2} value={(scopeForm.geographic_boundaries as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, geographic_boundaries: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Granice technologiczne</label>
            <textarea className="form-control" rows={2} value={(scopeForm.technology_boundaries as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, technology_boundaries: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Granice organizacyjne</label>
            <textarea className="form-control" rows={2} value={(scopeForm.organizational_boundaries as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, organizational_boundaries: e.target.value || null })} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Interfejsy / zależności</label>
          <textarea className="form-control" rows={2} value={(scopeForm.interfaces_dependencies as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, interfaces_dependencies: e.target.value || null })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Zatwierdzony przez</label>
            <input className="form-control" value={(scopeForm.approved_by as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, approved_by: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Data zatwierdzenia</label>
            <input type="date" className="form-control" value={(scopeForm.approved_date as string) ?? ""} onChange={e => setScopeForm({ ...scopeForm, approved_date: e.target.value || null })} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => setShowScopeForm(false)}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveScope} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
        </div>
      </Modal>
    );
  }

  function renderAddUnitModal() {
    return (
      <Modal open={showAddUnitForm} onClose={() => setShowAddUnitForm(false)} title="Dodaj jednostkę organizacyjną">
        <form onSubmit={handleAddUnit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Jednostka nadrzędna</label>
              <OrgUnitTreeSelect
                tree={orgUnits}
                value={addUnitParentId}
                onChange={setAddUnitParentId}
                placeholder="Brak (najwyższy poziom)"
                allowClear
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Poziom *</label>
              <select name="level_id" className="form-control" required>
                <option value="">Wybierz...</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Nazwa *</label>
              <input name="name" className="form-control" required placeholder="np. Dział IT" />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Symbol *</label>
              <input name="symbol" className="form-control" required placeholder="np. DIT" />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Właściciel biznesowy</label>
              <input name="owner" className="form-control" placeholder="np. Jan Kowalski" />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Security Contact</label>
              <input name="security_contact" className="form-control" placeholder="np. Anna Nowak" />
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Opis</label>
              <textarea name="description" className="form-control" placeholder="Opis jednostki..." />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setShowAddUnitForm(false)}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={savingUnit}>{savingUnit ? "Zapisywanie..." : "Dodaj jednostkę"}</button>
          </div>
        </form>
      </Modal>
    );
  }

  function renderRAModal() {
    return (
      <Modal open={showRAForm} onClose={() => setShowRAForm(false)} title="Apetyt na ryzyko" wide>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Oświadczenie o apetycie na ryzyko</label>
          <textarea className="form-control" rows={3} value={(raForm.risk_appetite_statement as string) ?? ""} onChange={e => setRAForm({ ...raForm, risk_appetite_statement: e.target.value || null })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Maks. poziom ryzyka</label>
            <select className="form-control" value={(raForm.max_acceptable_risk_level as string) ?? ""} onChange={e => setRAForm({ ...raForm, max_acceptable_risk_level: e.target.value || null })}>
              <option value="">— wybierz —</option>
              <option value="low">Niski</option>
              <option value="medium">Średni</option>
              <option value="high">Wysoki</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Maks. wynik ryzyka</label>
            <input type="number" step="0.01" className="form-control" value={(raForm.max_acceptable_risk_score as number | null) ?? ""} onChange={e => setRAForm({ ...raForm, max_acceptable_risk_score: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Zatwierdzanie wyjątków</label>
            <input className="form-control" value={(raForm.exception_approval_authority as string) ?? ""} onChange={e => setRAForm({ ...raForm, exception_approval_authority: e.target.value || null })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Tolerancja fin.</label>
            <textarea className="form-control" rows={2} value={(raForm.financial_risk_tolerance as string) ?? ""} onChange={e => setRAForm({ ...raForm, financial_risk_tolerance: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Tolerancja reput.</label>
            <textarea className="form-control" rows={2} value={(raForm.reputational_risk_tolerance as string) ?? ""} onChange={e => setRAForm({ ...raForm, reputational_risk_tolerance: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Tolerancja oper.</label>
            <textarea className="form-control" rows={2} value={(raForm.operational_risk_tolerance as string) ?? ""} onChange={e => setRAForm({ ...raForm, operational_risk_tolerance: e.target.value || null })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Zatwierdzony przez</label>
            <input className="form-control" value={(raForm.approved_by as string) ?? ""} onChange={e => setRAForm({ ...raForm, approved_by: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Data zatwierdzenia</label>
            <input type="date" className="form-control" value={(raForm.approved_date as string) ?? ""} onChange={e => setRAForm({ ...raForm, approved_date: e.target.value || null })} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => setShowRAForm(false)}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveRA} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
        </div>
      </Modal>
    );
  }
}
