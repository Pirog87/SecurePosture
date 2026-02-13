import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

const API = import.meta.env.VITE_API_URL ?? "";

/* ── types ── */

interface TestRecord {
  id: number;
  ref_id: string;
  implementation_id: number;
  test_date: string;
  test_type: string;
  tester: string;
  result: string;
  design_score: number | null;
  operational_score: number | null;
  findings: string | null;
  recommendations: string | null;
  evidence_url: string | null;
  created_at: string;
}

interface ImplRecord {
  id: number;
  ref_id: string;
  control_id: number;
  control_name: string | null;
  control_ref_id: string | null;
  org_unit_id: number;
  org_unit_name: string | null;
  asset_id: number | null;
  asset_name: string | null;
  security_area_id: number | null;
  security_area_name: string | null;
  status: string;
  responsible: string | null;
  implementation_date: string | null;
  description: string | null;
  evidence_url: string | null;
  evidence_notes: string | null;
  design_effectiveness: number | null;
  operational_effectiveness: number | null;
  coverage_percent: number | null;
  overall_effectiveness: number | null;
  test_frequency_days: number | null;
  last_test_date: string | null;
  next_test_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tests: TestRecord[];
}

interface Metrics {
  total_controls_in_catalog: number;
  total_implementations: number;
  implemented_count: number;
  partial_count: number;
  planned_count: number;
  not_applicable_count: number;
  avg_design_effectiveness: number | null;
  avg_operational_effectiveness: number | null;
  avg_overall_effectiveness: number | null;
  avg_coverage: number | null;
  tests_last_90_days: number;
  overdue_tests: number;
  positive_test_rate: number | null;
  recommended_safeguard_rating: number | null;
}

interface OrgUnit { id: number; name: string }
interface Control { id: number; ref_id: string; name: string }

/* ── helpers ── */

const STATUS_LABELS: Record<string, string> = {
  planned: "Planowane",
  in_progress: "W trakcie",
  implemented: "Wdrożone",
  partial: "Częściowo",
  not_applicable: "Nie dotyczy",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "#6b7280",
  in_progress: "#f59e0b",
  implemented: "#16a34a",
  partial: "#f97316",
  not_applicable: "#9ca3af",
};

const RESULT_LABELS: Record<string, string> = {
  positive: "Pozytywny",
  conditional: "Warunkowy",
  negative: "Negatywny",
};

const RESULT_COLORS: Record<string, string> = {
  positive: "#16a34a",
  conditional: "#f59e0b",
  negative: "#dc2626",
};

const TEST_TYPE_LABELS: Record<string, string> = {
  manual_test: "Test manualny",
  automated_test: "Test automatyczny",
  audit: "Audyt",
  review: "Przegląd",
  pentest: "Pen-test",
};

function effColor(val: number | null): string {
  if (val == null) return "var(--text-muted)";
  if (val >= 85) return "#16a34a";
  if (val >= 60) return "#f59e0b";
  if (val >= 30) return "#f97316";
  return "#dc2626";
}

function isOverdue(d: string | null): boolean {
  return !!d && new Date(d) < new Date();
}

/* ── columns ── */

const columns: ColumnDef<ImplRecord>[] = [
  { key: "ref_id", header: "Ref" },
  { key: "control_ref_id", header: "Zabezpieczenie" },
  { key: "control_name", header: "Nazwa zabezpieczenia" },
  { key: "org_unit_name", header: "Jednostka org." },
  { key: "asset_name", header: "Aktyw", defaultVisible: false },
  { key: "security_area_name", header: "Obszar", defaultVisible: false },
  { key: "status", header: "Status" },
  { key: "responsible", header: "Odpowiedzialny" },
  { key: "implementation_date", header: "Data wdrożenia", defaultVisible: false },
  { key: "design_effectiveness", header: "Projekt %" },
  { key: "operational_effectiveness", header: "Operacyjna %" },
  { key: "overall_effectiveness", header: "Ogólna %" },
  { key: "coverage_percent", header: "Pokrycie %", defaultVisible: false },
  { key: "last_test_date", header: "Ostatni test" },
  { key: "next_test_date", header: "Następny test" },
  { key: "actions", header: "Akcje" },
];

/* ── main component ── */

export default function ControlEffectivenessPage() {
  const [impls, setImpls] = useState<ImplRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ImplRecord | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingImpl, setTestingImpl] = useState<ImplRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailImpl, setDetailImpl] = useState<ImplRecord | null>(null);

  // Form state
  const [form, setForm] = useState({
    control_id: 0,
    org_unit_id: 0,
    asset_id: null as number | null,
    security_area_id: null as number | null,
    status: "planned",
    responsible: "",
    implementation_date: "",
    description: "",
    evidence_url: "",
    design_effectiveness: "" as string | number,
    operational_effectiveness: "" as string | number,
    coverage_percent: "" as string | number,
    test_frequency_days: "" as string | number,
  });

  const [testForm, setTestForm] = useState({
    test_date: new Date().toISOString().split("T")[0],
    test_type: "manual_test",
    tester: "",
    result: "positive",
    design_score: "" as string | number,
    operational_score: "" as string | number,
    findings: "",
    recommendations: "",
  });

  // Table features
  const [showFilters, setShowFilters] = useState(false);
  const { visible, toggle: toggleCol } = useColumnVisibility(columns, "ctrl-eff");
  const table = useTableFeatures<ImplRecord>({
    data: impls,
    storageKey: "ctrl-eff",
    defaultSort: "overall_effectiveness",
    defaultSortDir: "desc",
  });

  /* ── data loading ── */

  const fetchData = async () => {
    setLoading(true);
    try {
      const [implRes, metricsRes, ctrlRes, ouRes] = await Promise.all([
        fetch(`${API}/api/v1/control-effectiveness`),
        fetch(`${API}/api/v1/control-effectiveness/metrics/summary`),
        fetch(`${API}/api/v1/smart-catalog/controls`),
        fetch(`${API}/api/v1/org-units`),
      ]);
      if (implRes.ok) setImpls(await implRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (ctrlRes.ok) {
        const data = await ctrlRes.json();
        setControls(data.map((c: any) => ({ id: c.id, ref_id: c.ref_id, name: c.name })));
      }
      if (ouRes.ok) {
        const data = await ouRes.json();
        setOrgUnits(data.map((o: any) => ({ id: o.id, name: o.name })));
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  /* ── stats cards ── */

  const statsCards = useMemo<StatCard[]>(() => {
    if (!metrics) return [];
    return [
      {
        label: "Wdrożone",
        value: metrics.implemented_count,
        total: metrics.total_implementations,
        color: "#16a34a",
      },
      {
        label: "Częściowo",
        value: metrics.partial_count,
        color: "#f97316",
      },
      {
        label: "Śr. skuteczność",
        value: metrics.avg_overall_effectiveness != null ? `${metrics.avg_overall_effectiveness}%` : "—",
        color: effColor(metrics.avg_overall_effectiveness),
      },
      {
        label: "Testy (90d)",
        value: metrics.tests_last_90_days,
        color: metrics.overdue_tests > 0 ? "#dc2626" : "var(--text-secondary)",
      },
    ];
  }, [metrics]);

  /* ── handlers ── */

  const openCreate = () => {
    setEditing(null);
    setForm({
      control_id: controls[0]?.id ?? 0,
      org_unit_id: orgUnits[0]?.id ?? 0,
      asset_id: null,
      security_area_id: null,
      status: "planned",
      responsible: "",
      implementation_date: "",
      description: "",
      evidence_url: "",
      design_effectiveness: "",
      operational_effectiveness: "",
      coverage_percent: "",
      test_frequency_days: "",
    });
    setShowModal(true);
  };

  const openEdit = (row: ImplRecord) => {
    setEditing(row);
    setForm({
      control_id: row.control_id,
      org_unit_id: row.org_unit_id,
      asset_id: row.asset_id,
      security_area_id: row.security_area_id,
      status: row.status,
      responsible: row.responsible || "",
      implementation_date: row.implementation_date || "",
      description: row.description || "",
      evidence_url: row.evidence_url || "",
      design_effectiveness: row.design_effectiveness ?? "",
      operational_effectiveness: row.operational_effectiveness ?? "",
      coverage_percent: row.coverage_percent ?? "",
      test_frequency_days: row.test_frequency_days ?? "",
    });
    setShowModal(true);
  };

  const openTest = (row: ImplRecord) => {
    setTestingImpl(row);
    setTestForm({
      test_date: new Date().toISOString().split("T")[0],
      test_type: "manual_test",
      tester: "",
      result: "positive",
      design_score: "",
      operational_score: "",
      findings: "",
      recommendations: "",
    });
    setShowTestModal(true);
  };

  const openDetail = (row: ImplRecord) => {
    setDetailImpl(row);
    setShowDetail(true);
  };

  const saveImpl = async () => {
    const payload: any = {
      control_id: form.control_id,
      org_unit_id: form.org_unit_id,
      status: form.status,
    };
    if (form.asset_id) payload.asset_id = form.asset_id;
    if (form.security_area_id) payload.security_area_id = form.security_area_id;
    if (form.responsible) payload.responsible = form.responsible;
    if (form.implementation_date) payload.implementation_date = form.implementation_date;
    if (form.description) payload.description = form.description;
    if (form.evidence_url) payload.evidence_url = form.evidence_url;
    if (form.design_effectiveness !== "") payload.design_effectiveness = Number(form.design_effectiveness);
    if (form.operational_effectiveness !== "") payload.operational_effectiveness = Number(form.operational_effectiveness);
    if (form.coverage_percent !== "") payload.coverage_percent = Number(form.coverage_percent);
    if (form.test_frequency_days !== "") payload.test_frequency_days = Number(form.test_frequency_days);

    const url = editing
      ? `${API}/api/v1/control-effectiveness/${editing.id}`
      : `${API}/api/v1/control-effectiveness`;
    const method = editing ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowModal(false);
    fetchData();
  };

  const saveTest = async () => {
    if (!testingImpl) return;
    const payload: any = {
      test_date: testForm.test_date,
      test_type: testForm.test_type,
      tester: testForm.tester,
      result: testForm.result,
    };
    if (testForm.design_score !== "") payload.design_score = Number(testForm.design_score);
    if (testForm.operational_score !== "") payload.operational_score = Number(testForm.operational_score);
    if (testForm.findings) payload.findings = testForm.findings;
    if (testForm.recommendations) payload.recommendations = testForm.recommendations;

    await fetch(`${API}/api/v1/control-effectiveness/${testingImpl.id}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowTestModal(false);
    fetchData();
  };

  const deactivate = async (id: number) => {
    await fetch(`${API}/api/v1/control-effectiveness/${id}`, { method: "DELETE" });
    fetchData();
  };

  /* ── render ── */

  if (loading) return <div style={{ padding: 32 }}>Ładowanie...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>Ocena Skuteczności Zabezpieczeń</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
        Śledzenie wdrożeń zabezpieczeń z katalogu kontroli, ich skuteczności operacyjnej
        i wyników testów/walidacji.
      </p>

      {/* Stats */}
      <StatsCards cards={statsCards} isFiltered={table.hasActiveFilters} />

      {/* Safeguard rating recommendation */}
      {metrics?.recommended_safeguard_rating != null && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Rekomendowane Z (safeguard_rating) na podstawie ocen:
          </span>
          <span style={{ fontWeight: 700, fontSize: 18, color: effColor(metrics.avg_overall_effectiveness) }}>
            {metrics.recommended_safeguard_rating}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ({metrics.avg_overall_effectiveness != null ? `skuteczność ${metrics.avg_overall_effectiveness}%` : "brak danych"})
          </span>
          {metrics.overdue_tests > 0 && (
            <span style={{ fontSize: 12, color: "#dc2626", marginLeft: "auto" }}>
              {metrics.overdue_tests} przeterminowanych testów
            </span>
          )}
        </div>
      )}

      {/* Toolbar */}
      <TableToolbar<ImplRecord>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="wdrożeń"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj zabezpieczenia..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={columns}
        visibleColumns={visible}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="skutecznosc_zabezpieczen"
        primaryLabel="+ Dodaj wdrożenie"
        onPrimaryAction={openCreate}
      />

      {/* Table */}
      <DataTable<ImplRecord>
        columns={columns}
        visibleColumns={visible}
        data={table.pageData}
        rowKey={(row) => String(row.id)}
        sortField={table.sortField}
        sortDir={table.sortDir}
        onSort={table.toggleSort}
        showFilters={showFilters}
        columnFilters={table.columnFilters}
        onColumnFilter={table.setColumnFilter}
        onRowClick={openDetail}
        page={table.page}
        totalPages={table.totalPages}
        pageSize={table.pageSize}
        totalItems={table.totalCount}
        filteredItems={table.filteredCount}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        renderCell={(row, key) => {
          if (key === "status") {
            return (
              <span style={{
                color: STATUS_COLORS[row.status] || "inherit",
                fontWeight: 600,
              }}>
                {STATUS_LABELS[row.status] || row.status}
              </span>
            );
          }
          if (key === "design_effectiveness" || key === "operational_effectiveness" || key === "overall_effectiveness" || key === "coverage_percent") {
            const val = row[key as keyof ImplRecord] as number | null;
            if (val == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
            return <span style={{ color: effColor(val), fontWeight: 600 }}>{val}%</span>;
          }
          if (key === "next_test_date") {
            if (!row.next_test_date) return <span style={{ color: "var(--text-muted)" }}>—</span>;
            const overdue = isOverdue(row.next_test_date);
            return (
              <span style={{ color: overdue ? "#dc2626" : "inherit", fontWeight: overdue ? 600 : 400 }}>
                {row.next_test_date}
                {overdue && " !"}
              </span>
            );
          }
          if (key === "last_test_date") {
            return row.last_test_date || <span style={{ color: "var(--text-muted)" }}>—</span>;
          }
          if (key === "actions") {
            return (
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-xs" title="Edytuj" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
                  Edytuj
                </button>
                <button className="btn btn-xs btn-primary" title="Test" onClick={(e) => { e.stopPropagation(); openTest(row); }}>
                  + Test
                </button>
                <button className="btn btn-xs btn-danger" title="Dezaktywuj" onClick={(e) => { e.stopPropagation(); deactivate(row.id); }}>
                  X
                </button>
              </div>
            );
          }
          return undefined;
        }}
      />

      {/* ═══ Create/Edit Modal ═══ */}
      <Modal
        open={showModal}
        title={editing ? `Edycja: ${editing.ref_id}` : "Nowe wdrożenie zabezpieczenia"}
        onClose={() => setShowModal(false)}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Control */}
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>Zabezpieczenie *</label>
            <select value={form.control_id} onChange={(e) => setForm({ ...form, control_id: Number(e.target.value) })}>
              <option value={0}>— wybierz —</option>
              {controls.map((c) => (
                <option key={c.id} value={c.id}>{c.ref_id} — {c.name}</option>
              ))}
            </select>
          </div>

          {/* Org unit */}
          <div className="form-group">
            <label>Jednostka organizacyjna *</label>
            <select value={form.org_unit_id} onChange={(e) => setForm({ ...form, org_unit_id: Number(e.target.value) })}>
              <option value={0}>— wybierz —</option>
              {orgUnits.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="form-group">
            <label>Status *</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Responsible */}
          <div className="form-group">
            <label>Odpowiedzialny</label>
            <input type="text" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          </div>

          {/* Implementation date */}
          <div className="form-group">
            <label>Data wdrożenia</label>
            <input type="date" value={form.implementation_date} onChange={(e) => setForm({ ...form, implementation_date: e.target.value })} />
          </div>

          {/* Design effectiveness */}
          <div className="form-group">
            <label>Skuteczność projektowa (0–100)</label>
            <input type="number" min={0} max={100} value={form.design_effectiveness} onChange={(e) => setForm({ ...form, design_effectiveness: e.target.value })} />
          </div>

          {/* Operational effectiveness */}
          <div className="form-group">
            <label>Skuteczność operacyjna (0–100)</label>
            <input type="number" min={0} max={100} value={form.operational_effectiveness} onChange={(e) => setForm({ ...form, operational_effectiveness: e.target.value })} />
          </div>

          {/* Coverage */}
          <div className="form-group">
            <label>Pokrycie % (0–100)</label>
            <input type="number" min={0} max={100} value={form.coverage_percent} onChange={(e) => setForm({ ...form, coverage_percent: e.target.value })} />
          </div>

          {/* Test frequency */}
          <div className="form-group">
            <label>Częstotliwość testów (dni)</label>
            <input type="number" min={1} value={form.test_frequency_days} onChange={(e) => setForm({ ...form, test_frequency_days: e.target.value })} />
          </div>

          {/* Description */}
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>Opis</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* Evidence URL */}
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>URL dowodu</label>
            <input type="text" value={form.evidence_url} onChange={(e) => setForm({ ...form, evidence_url: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveImpl} disabled={!form.control_id || !form.org_unit_id}>
            {editing ? "Zapisz" : "Dodaj"}
          </button>
        </div>
      </Modal>

      {/* ═══ Test Modal ═══ */}
      <Modal
        open={showTestModal}
        title={`Nowy test: ${testingImpl?.ref_id ?? ""}`}
        onClose={() => setShowTestModal(false)}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label>Data testu *</label>
            <input type="date" value={testForm.test_date} onChange={(e) => setTestForm({ ...testForm, test_date: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Typ testu *</label>
            <select value={testForm.test_type} onChange={(e) => setTestForm({ ...testForm, test_type: e.target.value })}>
              {Object.entries(TEST_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Tester *</label>
            <input type="text" value={testForm.tester} onChange={(e) => setTestForm({ ...testForm, tester: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Wynik *</label>
            <select value={testForm.result} onChange={(e) => setTestForm({ ...testForm, result: e.target.value })}>
              {Object.entries(RESULT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Wynik projektowy (0–100)</label>
            <input type="number" min={0} max={100} value={testForm.design_score} onChange={(e) => setTestForm({ ...testForm, design_score: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Wynik operacyjny (0–100)</label>
            <input type="number" min={0} max={100} value={testForm.operational_score} onChange={(e) => setTestForm({ ...testForm, operational_score: e.target.value })} />
          </div>

          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>Ustalenia</label>
            <textarea rows={3} value={testForm.findings} onChange={(e) => setTestForm({ ...testForm, findings: e.target.value })} />
          </div>

          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>Rekomendacje</label>
            <textarea rows={3} value={testForm.recommendations} onChange={(e) => setTestForm({ ...testForm, recommendations: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => setShowTestModal(false)}>Anuluj</button>
          <button className="btn btn-primary" onClick={saveTest} disabled={!testForm.tester}>
            Zapisz test
          </button>
        </div>
      </Modal>

      {/* ═══ Detail Modal ═══ */}
      <Modal
        open={showDetail}
        title={`Szczegóły: ${detailImpl?.ref_id ?? ""}`}
        onClose={() => setShowDetail(false)}
      >
        {detailImpl && (
          <div>
            {/* Header info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zabezpieczenie</div>
                <div style={{ fontWeight: 600 }}>{detailImpl.control_ref_id} — {detailImpl.control_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Jednostka org.</div>
                <div>{detailImpl.org_unit_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Status</div>
                <span style={{ color: STATUS_COLORS[detailImpl.status], fontWeight: 600 }}>
                  {STATUS_LABELS[detailImpl.status]}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Odpowiedzialny</div>
                <div>{detailImpl.responsible || "—"}</div>
              </div>
            </div>

            {/* Effectiveness gauges */}
            <div className="grid-4" style={{ marginBottom: 16 }}>
              {[
                { label: "Projektowa", val: detailImpl.design_effectiveness },
                { label: "Operacyjna", val: detailImpl.operational_effectiveness },
                { label: "Ogólna", val: detailImpl.overall_effectiveness },
                { label: "Pokrycie", val: detailImpl.coverage_percent },
              ].map((g) => (
                <div key={g.label} className="card" style={{ textAlign: "center", padding: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: effColor(g.val) }}>
                    {g.val != null ? `${g.val}%` : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.label}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {detailImpl.description && (
              <div className="card" style={{ padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Opis</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{detailImpl.description}</div>
              </div>
            )}

            {/* Test history */}
            <h4 style={{ marginBottom: 8 }}>Historia testów ({detailImpl.tests.length})</h4>
            {detailImpl.tests.length === 0 ? (
              <div style={{ color: "var(--text-muted)", padding: 12 }}>Brak testów</div>
            ) : (
              <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Typ</th>
                    <th>Tester</th>
                    <th>Wynik</th>
                    <th>Projekt</th>
                    <th>Operac.</th>
                  </tr>
                </thead>
                <tbody>
                  {detailImpl.tests.map((t) => (
                    <tr key={t.id}>
                      <td>{t.test_date}</td>
                      <td>{TEST_TYPE_LABELS[t.test_type] || t.test_type}</td>
                      <td>{t.tester}</td>
                      <td style={{ color: RESULT_COLORS[t.result], fontWeight: 600 }}>
                        {RESULT_LABELS[t.result] || t.result}
                      </td>
                      <td>{t.design_score != null ? `${t.design_score}%` : "—"}</td>
                      <td>{t.operational_score != null ? `${t.operational_score}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => { setShowDetail(false); openTest(detailImpl); }}>
                + Dodaj test
              </button>
              <button className="btn" onClick={() => setShowDetail(false)}>Zamknij</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
