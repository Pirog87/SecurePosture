import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

/* ─── Types ─── */
interface Framework {
  id: number;
  name: string;
  total_assessable: number;
}

interface ComplianceAssessment {
  id: number;
  framework_id: number;
  framework_name: string;
  scope_type: string;
  scope_name: string | null;
  assessment_type: string;
  status: string;
  name: string | null;
  compliance_score: number | null;
  total_requirements: number;
  assessed_count: number;
  compliant_count: number;
  partially_count: number;
  non_compliant_count: number;
  not_applicable_count: number;
  created_at: string;
  updated_at: string;
}

/* ─── Helpers ─── */
function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-muted)";
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--yellow)";
  return "var(--red)";
}
function scoreBg(score: number | null): string {
  if (score == null) return "transparent";
  if (score >= 80) return "var(--green-dim)";
  if (score >= 60) return "var(--yellow-dim)";
  return "var(--red-dim)";
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  in_progress: "var(--blue)",
  completed: "var(--green)",
  archived: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  in_progress: "W toku",
  completed: "Zakończona",
  archived: "Archiwalna",
};

const TYPE_LABELS: Record<string, string> = {
  continuous: "Bieżąca",
  audit_snapshot: "Snapshot",
};

const SCOPE_LABELS: Record<string, string> = {
  organization: "Organizacja",
  org_unit: "Jednostka org.",
  service: "Usługa",
  process: "Proces",
  project: "Projekt",
};

/* ─── Section / Detail helpers (same pattern as Exceptions/Risks) ─── */
function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: "var(--blue)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>{number}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
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

/* ═══════════════════════════════════════════════════════════
   ComplianceAssessmentsPage
   ═══════════════════════════════════════════════════════════ */
export default function ComplianceAssessmentsPage() {
  const COLUMNS: ColumnDef<ComplianceAssessment>[] = [
    { key: "name", header: "Nazwa", format: r => r.name || `#${r.id}` },
    { key: "framework_name", header: "Framework" },
    { key: "scope_type", header: "Scope", format: r => SCOPE_LABELS[r.scope_type] || r.scope_type },
    { key: "scope_name", header: "Scope nazwa", format: r => r.scope_name ?? "", defaultVisible: false },
    { key: "assessment_type", header: "Typ", format: r => TYPE_LABELS[r.assessment_type] || r.assessment_type },
    { key: "status", header: "Status", format: r => STATUS_LABELS[r.status] || r.status },
    { key: "compliance_score", header: "Zgodność %", format: r => r.compliance_score != null ? `${r.compliance_score}%` : "" },
    { key: "assessed_count", header: "Ocenione", format: r => `${r.assessed_count}/${r.total_requirements}` },
    { key: "compliant_count", header: "Zgodne", format: r => String(r.compliant_count) },
    { key: "partially_count", header: "Częściowo", format: r => String(r.partially_count), defaultVisible: false },
    { key: "non_compliant_count", header: "Niezgodne", format: r => String(r.non_compliant_count), defaultVisible: false },
    { key: "not_applicable_count", header: "N/A", format: r => String(r.not_applicable_count), defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
    { key: "updated_at", header: "Aktualizacja", format: r => r.updated_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "compliance-assessments");

  const [assessments, setAssessments] = useState<ComplianceAssessment[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ComplianceAssessment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    framework_id: 0,
    scope_type: "organization",
    scope_name: "",
    name: "",
  });

  const table = useTableFeatures<ComplianceAssessment>({
    data: assessments,
    storageKey: "compliance-assessments",
    defaultSort: "compliance_score",
    defaultSortDir: "desc",
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<ComplianceAssessment[]>("/api/v1/compliance-assessments/"),
      api.get<Framework[]>("/api/v1/frameworks/"),
    ])
      .then(([ca, fw]) => {
        setAssessments(ca);
        setFrameworks(fw.filter((f: any) => f.is_active !== false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.framework_id) return;
    try {
      const result = await api.post<ComplianceAssessment>("/api/v1/compliance-assessments/", {
        framework_id: form.framework_id,
        scope_type: form.scope_type,
        scope_name: form.scope_name || null,
        name: form.name || null,
      });
      setShowModal(false);
      navigate(`/compliance/assessments/${result.id}`);
    } catch {
      alert("Błąd tworzenia oceny");
    }
  };

  /* ── Stats ── */
  const src = table.filtered;
  const inProgress = src.filter(a => a.status === "in_progress").length;
  const completed = src.filter(a => a.status === "completed").length;
  const scored = src.filter(a => a.compliance_score != null);
  const avgScore = scored.length > 0
    ? scored.reduce((s, a) => s + (a.compliance_score ?? 0), 0) / scored.length
    : null;

  const allInProgress = assessments.filter(a => a.status === "in_progress").length;
  const allCompleted = assessments.filter(a => a.status === "completed").length;
  const allScored = assessments.filter(a => a.compliance_score != null);
  const allAvgScore = allScored.length > 0
    ? allScored.reduce((s, a) => s + (a.compliance_score ?? 0), 0) / allScored.length
    : null;

  const isFiltered = table.filteredCount !== table.totalCount;

  const stats: StatCard[] = [
    { label: "Oceny ogółem", value: src.length, total: assessments.length, color: "var(--blue)" },
    { label: "W toku", value: inProgress, total: allInProgress, color: "var(--orange)" },
    { label: "Zakończone", value: completed, total: allCompleted, color: "var(--green)" },
    { label: "Średni % zgodności", value: avgScore != null ? avgScore.toFixed(1) : "—", total: allAvgScore != null ? allAvgScore.toFixed(1) : "—", color: scoreColor(avgScore) },
  ];

  /* ── Detail panel ── */
  const sel = selected;
  const progress = sel && sel.total_requirements > 0
    ? Math.round((sel.assessed_count / sel.total_requirements) * 100)
    : 0;
  const notAssessed = sel
    ? sel.total_requirements - sel.assessed_count
    : 0;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <h2 style={{ margin: "0 0 16px" }}>Oceny Zgodności</h2>

      <StatsCards cards={stats} isFiltered={isFiltered} />

      <TableToolbar<ComplianceAssessment>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="ocen"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj ocen..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="compliance_assessments"
        primaryLabel="Nowa ocena"
        onPrimaryAction={() => setShowModal(true)}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14, marginTop: 2 }}>
        <DataTable<ComplianceAssessment>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
          rowBorderColor={r => {
            const s = r.compliance_score;
            if (s == null) return undefined;
            return s >= 80 ? "var(--green)" : s >= 60 ? "var(--orange)" : "var(--red)";
          }}
          renderCell={(row, colKey) => {
            if (colKey === "compliance_score") {
              const s = row.compliance_score;
              if (s == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
              return (
                <span style={{
                  background: scoreBg(s), color: scoreColor(s),
                  borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                }}>
                  {s}%
                </span>
              );
            }
            if (colKey === "status") {
              const c = STATUS_COLORS[row.status] || "#94a3b8";
              return (
                <span className="badge" style={{ backgroundColor: `${c}20`, color: c }}>
                  {STATUS_LABELS[row.status] || row.status}
                </span>
              );
            }
            if (colKey === "compliant_count") {
              return <span style={{ color: "var(--green)", fontWeight: 600 }}>{row.compliant_count}</span>;
            }
            if (colKey === "name") {
              return <span style={{ fontWeight: 600 }}>{row.name || `#${row.id}`}</span>;
            }
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
          emptyMessage="Brak ocen zgodności. Utwórz pierwszą ocenę, wybierając framework."
        />

        {/* ── Detail panel ── */}
        {sel && (
          <div className="card" style={{ padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {sel.name || `#${sel.id}`}
                </div>
                <span className="badge" style={{
                  backgroundColor: `${STATUS_COLORS[sel.status] || "#94a3b8"}20`,
                  color: STATUS_COLORS[sel.status] || "#94a3b8",
                }}>
                  {STATUS_LABELS[sel.status] || sel.status}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-xs btn-primary"
                  onClick={() => navigate(`/compliance/assessments/${sel.id}`)}
                >
                  Otwórz
                </button>
                <button className="btn btn-xs" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>

            {/* Score gauge */}
            {sel.compliance_score != null && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{
                  fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                  color: scoreColor(sel.compliance_score),
                }}>
                  {sel.compliance_score}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zgodność</div>
                <div style={{ marginTop: 8, height: 6, backgroundColor: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${progress}%`, height: "100%",
                    backgroundColor: scoreColor(sel.compliance_score),
                    borderRadius: 3, transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Postęp: {sel.assessed_count} / {sel.total_requirements}
                </div>
              </div>
            )}

            <SectionHeader number="1" label="Framework i scope" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Framework" value={sel.framework_name} />
              <DetailRow label="Scope" value={SCOPE_LABELS[sel.scope_type] || sel.scope_type} />
              {sel.scope_name && <DetailRow label="Scope nazwa" value={sel.scope_name} />}
              <DetailRow label="Typ oceny" value={TYPE_LABELS[sel.assessment_type] || sel.assessment_type} />
            </div>

            <SectionHeader number="2" label="Wyniki oceny" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Zgodne" value={sel.compliant_count} color="var(--green)" />
              <DetailRow label="Częściowo zgodne" value={sel.partially_count} color="var(--yellow)" />
              <DetailRow label="Niezgodne" value={sel.non_compliant_count} color="var(--red)" />
              <DetailRow label="Nie dotyczy" value={sel.not_applicable_count} />
              <DetailRow label="Nieocenione" value={notAssessed > 0 ? notAssessed : 0} />
              <DetailRow label="Razem wymagań" value={sel.total_requirements} />
            </div>

            <SectionHeader number="3" label="Daty" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <DetailRow label="Utworzono" value={sel.created_at?.slice(0, 10)} />
              <DetailRow label="Aktualizacja" value={sel.updated_at?.slice(0, 10)} />
            </div>
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      <Modal open={showModal} title="Nowa ocena zgodności" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Framework *
              <select
                className="form-control"
                value={form.framework_id}
                onChange={e => setForm({ ...form, framework_id: Number(e.target.value) })}
              >
                <option value={0}>— wybierz —</option>
                {frameworks.map(fw => (
                  <option key={fw.id} value={fw.id}>
                    {fw.name} ({fw.total_assessable} wymagań)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scope
              <select className="form-control" value={form.scope_type} onChange={e => setForm({ ...form, scope_type: e.target.value })}>
                <option value="organization">Cała organizacja</option>
                <option value="org_unit">Jednostka organizacyjna</option>
                <option value="service">Usługa</option>
                <option value="process">Proces</option>
              </select>
            </label>
            <label>
              Nazwa scope
              <input className="form-control" value={form.scope_name} onChange={e => setForm({ ...form, scope_name: e.target.value })} placeholder="np. Dział IT" />
            </label>
            <label>
              Nazwa oceny (opcjonalna)
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="np. ISO 27001 — IT — 2026" />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.framework_id}>
                Utwórz
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
