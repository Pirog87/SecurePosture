import { useEffect, useMemo, useState } from "react";
import type { DictionaryEntry } from "../types";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

interface PolicyRecord {
  id: number;
  ref_id: string | null;
  title: string;
  category_name: string | null;
  category_id: number | null;
  owner: string;
  approver: string | null;
  status_name: string | null;
  status_id: number | null;
  current_version: string | null;
  effective_date: string | null;
  review_date: string | null;
  target_audience_count: number;
  acknowledgment_count: number;
  acknowledgment_rate: number | null;
  is_active: boolean;
}

const API = import.meta.env.VITE_API_URL ?? "";

const errorBorder = "1px solid var(--red)";
const errorShadow = "0 0 0 3px var(--red-dim)";

/* ── helper components ── */

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

/* ── column definitions ── */

const COLUMNS: ColumnDef<PolicyRecord>[] = [
  { key: "ref_id", header: "Ref", defaultVisible: true, format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytul", defaultVisible: true, format: (r) => r.title },
  { key: "category_name", header: "Kategoria", defaultVisible: true, format: (r) => r.category_name ?? "" },
  { key: "owner", header: "Wlasciciel", defaultVisible: true, format: (r) => r.owner },
  { key: "status_name", header: "Status", defaultVisible: true, format: (r) => r.status_name ?? "" },
  { key: "current_version", header: "Wersja", defaultVisible: true, format: (r) => r.current_version ?? "" },
  { key: "effective_date", header: "Obowiazuje od", defaultVisible: true, format: (r) => r.effective_date ?? "" },
  { key: "review_date", header: "Przeglad", defaultVisible: true, format: (r) => r.review_date ?? "" },
  { key: "acknowledgment_rate", header: "Potwierdz.", defaultVisible: true, format: (r) => r.acknowledgment_rate != null ? `${r.acknowledgment_rate}%` : "" },
  { key: "approver", header: "Zatwierdzaj\u0105cy", defaultVisible: false, format: (r) => r.approver ?? "" },
  { key: "target_audience_count", header: "Grupa docelowa", defaultVisible: false, format: (r) => String(r.target_audience_count) },
  { key: "acknowledgment_count", header: "Potwierdzenia", defaultVisible: false, format: (r) => String(r.acknowledgment_count) },
  { key: "is_active", header: "Aktywna", defaultVisible: false, format: (r) => r.is_active ? "TAK" : "NIE" },
];

/* ── main component ── */

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [selected, setSelected] = useState<PolicyRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "policies");

  const [showFilters, setShowFilters] = useState(false);

  const table = useTableFeatures<PolicyRecord>({
    data: policies,
    storageKey: "policies",
    defaultSort: "title",
    defaultSortDir: "asc",
  });

  // Form state
  const [form, setForm] = useState({
    title: "", owner: "", approver: "",
    category_id: null as number | null,
    status_id: null as number | null,
    current_version: "1.0",
    effective_date: "", review_date: "",
    document_url: "", target_audience_count: 0,
    description: "",
  });

  const resetForm = () => {
    setForm({
      title: "", owner: "", approver: "",
      category_id: null, status_id: null,
      current_version: "1.0",
      effective_date: "", review_date: "",
      document_url: "", target_audience_count: 0,
      description: "",
    });
    setTried(false);
  };

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/policies`);
      if (r.ok) setPolicies(await r.json());
      for (const [code, setter] of [
        ["policy_category", setCategories],
        ["policy_status", setStatuses],
      ] as const) {
        const dr = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (dr.ok) { const d = await dr.json(); (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []); }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleCreate() {
    setTried(true);
    if (!form.title || !form.owner) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        effective_date: form.effective_date || null,
        review_date: form.review_date || null,
        document_url: form.document_url || null,
        description: form.description || null,
      };
      const r = await fetch(`${API}/api/v1/policies`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (r.ok) { setShowForm(false); resetForm(); loadAll(); }
    } catch { /* ignore */ }
    setSaving(false);
  }

  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Dynamic StatsCards
  const statsCards = useMemo((): StatCard[] => {
    const filteredData = table.filtered;
    const allData = policies;

    const filteredActive = filteredData.filter(p => p.is_active).length;
    const totalActive = allData.filter(p => p.is_active).length;

    const filteredReviewRequired = filteredData.filter(p => {
      if (!p.review_date) return false;
      const rd = new Date(p.review_date);
      return rd < today || rd <= thirtyDaysFromNow;
    }).length;
    const totalReviewRequired = allData.filter(p => {
      if (!p.review_date) return false;
      const rd = new Date(p.review_date);
      return rd < today || rd <= thirtyDaysFromNow;
    }).length;

    const filteredWithRate = filteredData.filter(p => p.acknowledgment_rate != null);
    const filteredAvgAck = filteredWithRate.length > 0
      ? Math.round(filteredWithRate.reduce((s, p) => s + (p.acknowledgment_rate ?? 0), 0) / filteredWithRate.length)
      : 0;
    const totalWithRate = allData.filter(p => p.acknowledgment_rate != null);
    const totalAvgAck = totalWithRate.length > 0
      ? Math.round(totalWithRate.reduce((s, p) => s + (p.acknowledgment_rate ?? 0), 0) / totalWithRate.length)
      : 0;

    return [
      {
        label: "Wszystkich polityk",
        value: table.filteredCount,
        total: table.totalCount,
        color: "var(--blue)",
      },
      {
        label: "Aktywnych",
        value: filteredActive,
        total: totalActive,
        color: "var(--green)",
      },
      {
        label: "Przegl\u0105d wymagany",
        value: filteredReviewRequired,
        total: totalReviewRequired,
        color: "var(--orange)",
      },
      {
        label: "\u015ar. potwierdzenie",
        value: filteredAvgAck,
        total: totalAvgAck,
        color: "var(--purple)",
        formatValue: (v) => v + "%",
      },
    ];
  }, [policies, table.filtered, table.filteredCount, table.totalCount]);

  const isFiltered = table.filteredCount !== table.totalCount;

  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  const renderCell = (row: PolicyRecord, colKey: string) => {
    if (colKey === "ref_id") {
      return (
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>
          {row.ref_id ?? "\u2014"}
        </span>
      );
    }
    if (colKey === "title") {
      return <span style={{ fontWeight: 500 }}>{row.title}</span>;
    }
    if (colKey === "status_name") {
      return (
        <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
          {row.status_name ?? "\u2014"}
        </span>
      );
    }
    if (colKey === "acknowledgment_rate") {
      if (row.acknowledgment_rate != null) {
        const color = row.acknowledgment_rate > 80
          ? "var(--green)"
          : row.acknowledgment_rate > 50
            ? "var(--orange)"
            : "var(--red)";
        return (
          <>
            <span style={{ color }}>{row.acknowledgment_rate}%</span>
            {" "}
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({row.acknowledgment_count}/{row.target_audience_count})</span>
          </>
        );
      }
      return "\u2014";
    }
    if (colKey === "review_date") {
      const reviewOverdue = row.review_date && new Date(row.review_date) < today;
      return (
        <span style={{
          fontSize: 12,
          color: reviewOverdue ? "var(--red)" : undefined,
          fontWeight: reviewOverdue ? 600 : undefined,
        }}>
          {row.review_date ?? "\u2014"}
          {reviewOverdue && " (zalegly!)"}
        </span>
      );
    }
    return undefined;
  };

  return (
    <div>
      {/* Statistics cards */}
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      {/* Toolbar */}
      <TableToolbar
        filteredCount={table.filteredCount} totalCount={table.totalCount} unitLabel="polityk"
        search={table.search} onSearchChange={table.setSearch} searchPlaceholder="Szukaj (tytul, wlasciciel, ref)..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters} onClearFilters={table.clearAllFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={table.filtered} exportFilename="polityki"
        primaryLabel="Nowa polityka" onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        {/* Table */}
        <DataTable<PolicyRecord>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          renderCell={renderCell}
          onRowClick={(row) => setSelected(selected?.id === row.id ? null : row)}
          rowKey={(row) => row.id}
          selectedKey={selected?.id ?? null}
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
          emptyMessage="Brak polityk w systemie."
          emptyFilteredMessage="Brak polityk pasujacych do filtrow."
        />

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly Polityki</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={"\u2460"} label="Dane polityki" />
              <DetailRow label="Ref" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.ref_id}</span>} />
              <DetailRow label="Tytul" value={<strong>{selected.title}</strong>} />
              <DetailRow label="Kategoria" value={selected.category_name} />
              <DetailRow label="Wlasciciel" value={selected.owner} />
              <DetailRow label="Zatwierdzajacy" value={selected.approver} />
              <DetailRow label="Status" value={
                selected.status_name ? (
                  <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{selected.status_name}</span>
                ) : "\u2014"
              } />

              <SectionHeader number={"\u2461"} label="Wersja i daty" />
              <DetailRow label="Wersja" value={selected.current_version} />
              <DetailRow label="Obowiazuje od" value={selected.effective_date} />
              <DetailRow label="Data przegladu" value={
                <span style={{
                  color: selected.review_date && new Date(selected.review_date) < today ? "var(--red)" : undefined,
                  fontWeight: selected.review_date && new Date(selected.review_date) < today ? 600 : undefined,
                }}>
                  {selected.review_date ?? "\u2014"}
                </span>
              } />

              <SectionHeader number={"\u2462"} label="Potwierdzenia" />
              <DetailRow label="Odbiorcow" value={selected.target_audience_count} />
              <DetailRow label="Potwierdzen" value={selected.acknowledgment_count} />
              <DetailRow label="Wskaznik" value={
                selected.acknowledgment_rate != null ? (
                  <span style={{ color: selected.acknowledgment_rate >= 80 ? "var(--green)" : selected.acknowledgment_rate >= 50 ? "var(--orange)" : "var(--red)", fontWeight: 600 }}>
                    {selected.acknowledgment_rate}%
                  </span>
                ) : "\u2014"
              } />
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowa polityka bezpieczenstwa" wide>
        <SectionHeader number={"\u2460"} label="Dane podstawowe" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Tytul polityki *</label>
            <input className="form-control" style={fieldErr(!!form.title)} value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              placeholder="np. Polityka bezpieczenstwa informacji" />
            {tried && !form.title && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Wlasciciel *</label>
            <input className="form-control" style={fieldErr(!!form.owner)} value={form.owner} onChange={e => setForm({...form, owner: e.target.value})}
              placeholder="Imie i nazwisko" />
            {tried && !form.owner && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Zatwierdzajacy</label>
            <input className="form-control" value={form.approver} onChange={e => setForm({...form, approver: e.target.value})}
              placeholder="Imie i nazwisko" />
          </div>
          <div className="form-group">
            <label>Kategoria</label>
            <select className="form-control" value={form.category_id ?? ""} onChange={e => setForm({...form, category_id: e.target.value ? Number(e.target.value) : null})}>
              <option value="">Brak</option>
              {categories.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={form.status_id ?? ""} onChange={e => setForm({...form, status_id: e.target.value ? Number(e.target.value) : null})}>
              <option value="">Brak</option>
              {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Wersja</label>
            <input className="form-control" value={form.current_version} onChange={e => setForm({...form, current_version: e.target.value})}
              placeholder="1.0" />
          </div>
        </div>

        <SectionHeader number={"\u2461"} label="Daty i odbiorcy" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Data obowiazywania</label>
            <input className="form-control" type="date" value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Data przegladu</label>
            <input className="form-control" type="date" value={form.review_date} onChange={e => setForm({...form, review_date: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Liczba odbiorcow</label>
            <input className="form-control" type="number" min={0} value={form.target_audience_count} onChange={e => setForm({...form, target_audience_count: Number(e.target.value)})} />
          </div>
          <div className="form-group">
            <label>URL dokumentu</label>
            <input className="form-control" value={form.document_url} onChange={e => setForm({...form, document_url: e.target.value})}
              placeholder="https://..." />
          </div>
        </div>

        <SectionHeader number={"\u2462"} label="Opis" />
        <div className="form-group">
          <label>Opis polityki</label>
          <textarea className="form-control" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Krotki opis celu i zakresu polityki..." />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={handleCreate}
          >
            {saving ? "Zapisywanie..." : "Zapisz polityke"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
