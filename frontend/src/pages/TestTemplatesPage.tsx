import { useEffect, useState } from "react";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

/* ─── Types ─── */
interface TestTemplate {
  id: number;
  name: string;
  description: string | null;
  test_type: string;
  procedure: string | null;
  expected_evidence: string | null;
  framework_id: number | null;
  framework_name: string | null;
  requirement_ids: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Framework {
  id: number;
  name: string;
}

/* ─── Helpers ─── */
const TYPE_LABELS: Record<string, string> = {
  inquiry: "Wywiad",
  observation: "Obserwacja",
  inspection: "Inspekcja",
  reperformance: "Re-wykonanie",
  analytical: "Analityczny",
  walkthrough: "Przegląd procesu",
};

const TYPE_COLORS: Record<string, string> = {
  inquiry: "var(--blue)",
  observation: "var(--purple)",
  inspection: "var(--green)",
  reperformance: "var(--orange)",
  analytical: "var(--cyan)",
  walkthrough: "var(--yellow)",
};

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
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
   TestTemplatesPage
   ═══════════════════════════════════════════════════════════ */
export default function TestTemplatesPage() {
  const COLUMNS: ColumnDef<TestTemplate>[] = [
    { key: "name", header: "Nazwa" },
    { key: "test_type", header: "Typ testu", format: r => TYPE_LABELS[r.test_type] || r.test_type },
    { key: "framework_name", header: "Framework", format: r => r.framework_name ?? "—" },
    { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
    { key: "expected_evidence", header: "Oczekiwany dowód", format: r => r.expected_evidence ?? "", defaultVisible: false },
    { key: "is_active", header: "Aktywny", format: r => r.is_active ? "Tak" : "Nie", defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "test-templates");

  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TestTemplate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [form, setForm] = useState({
    name: "",
    test_type: "inquiry",
    description: "",
    procedure: "",
    expected_evidence: "",
    framework_id: null as number | null,
  });

  const table = useTableFeatures<TestTemplate>({
    data: templates,
    storageKey: "test-templates",
    defaultSort: "name",
    defaultSortDir: "asc",
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<TestTemplate[]>("/api/v1/test-templates/"),
      api.get<Framework[]>("/api/v1/frameworks/"),
    ])
      .then(([tt, fw]) => {
        setTemplates(tt);
        setFrameworks(fw.filter((f: any) => f.is_active !== false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post("/api/v1/test-templates/", {
        name: form.name,
        test_type: form.test_type,
        description: form.description || null,
        procedure: form.procedure || null,
        expected_evidence: form.expected_evidence || null,
        framework_id: form.framework_id,
      });
      setShowModal(false);
      setForm({ name: "", test_type: "inquiry", description: "", procedure: "", expected_evidence: "", framework_id: null });
      load();
    } catch {
      alert("Błąd tworzenia szablonu");
    }
  };

  /* ── Stats ── */
  const src = table.filtered;
  const byType = (type: string) => src.filter(t => t.test_type === type).length;
  const byTypeAll = (type: string) => templates.filter(t => t.test_type === type).length;
  const isFiltered = table.filteredCount !== table.totalCount;

  const stats: StatCard[] = [
    { label: "Szablony ogółem", value: src.length, total: templates.length, color: "var(--blue)" },
    { label: "Inspekcja", value: byType("inspection"), total: byTypeAll("inspection"), color: "var(--green)" },
    { label: "Wywiad", value: byType("inquiry"), total: byTypeAll("inquiry"), color: "var(--purple)" },
    { label: "Inne typy", value: src.length - byType("inspection") - byType("inquiry"), total: templates.length - byTypeAll("inspection") - byTypeAll("inquiry"), color: "var(--orange)" },
  ];

  const sel = selected;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <h2 style={{ margin: "0 0 16px" }}>Szablony Testów Audytowych</h2>

      <StatsCards cards={stats} isFiltered={isFiltered} />

      <TableToolbar<TestTemplate>
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="szablonów"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj szablonów..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(v => !v)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="test_templates"
        primaryLabel="Nowy szablon"
        onPrimaryAction={() => setShowModal(true)}
      />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14, marginTop: 2 }}>
        <DataTable<TestTemplate>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
          renderCell={(row, colKey) => {
            if (colKey === "name") {
              return <span style={{ fontWeight: 600 }}>{row.name}</span>;
            }
            if (colKey === "test_type") {
              const c = TYPE_COLORS[row.test_type] || "var(--blue)";
              return (
                <span className="badge" style={{ backgroundColor: `${c}20`, color: c }}>
                  {TYPE_LABELS[row.test_type] || row.test_type}
                </span>
              );
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
          emptyMessage="Brak szablonów testów. Utwórz katalog testów audytowych."
        />

        {/* ── Detail panel ── */}
        {sel && (
          <div className="card" style={{ padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{sel.name}</div>
                <span className="badge" style={{
                  backgroundColor: `${TYPE_COLORS[sel.test_type] || "var(--blue)"}20`,
                  color: TYPE_COLORS[sel.test_type] || "var(--blue)",
                }}>
                  {TYPE_LABELS[sel.test_type] || sel.test_type}
                </span>
              </div>
              <button className="btn btn-xs" onClick={() => setSelected(null)}>✕</button>
            </div>

            <SectionHeader number="1" label="Informacje" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <DetailRow label="Typ testu" value={TYPE_LABELS[sel.test_type] || sel.test_type} color={TYPE_COLORS[sel.test_type]} />
              <DetailRow label="Framework" value={sel.framework_name} />
              <DetailRow label="Aktywny" value={sel.is_active ? "Tak" : "Nie"} color={sel.is_active ? "var(--green)" : "var(--red)"} />
            </div>

            {sel.description && (
              <>
                <SectionHeader number="2" label="Opis" />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
                  {sel.description}
                </div>
              </>
            )}

            {sel.procedure && (
              <>
                <SectionHeader number="3" label="Procedura testowa" />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12, whiteSpace: "pre-wrap" }}>
                  {sel.procedure}
                </div>
              </>
            )}

            {sel.expected_evidence && (
              <>
                <SectionHeader number="4" label="Oczekiwany dowód" />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {sel.expected_evidence}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      <Modal open={showModal} title="Nowy szablon testu" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>Nazwa * <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="np. Test kontroli dostępu" /></label>
            <label>Typ testu
              <select className="form-control" value={form.test_type} onChange={e => setForm({ ...form, test_type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Framework
              <select className="form-control" value={form.framework_id ?? ""} onChange={e => setForm({ ...form, framework_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— brak —</option>
                {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
              </select>
            </label>
            <label>Opis <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></label>
            <label>Procedura testowa <textarea className="form-control" value={form.procedure} onChange={e => setForm({ ...form, procedure: e.target.value })} rows={3} /></label>
            <label>Oczekiwany dowód <textarea className="form-control" value={form.expected_evidence} onChange={e => setForm({ ...form, expected_evidence: e.target.value })} rows={2} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim()}>Utwórz</button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
