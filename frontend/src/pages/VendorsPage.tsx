import { useEffect, useMemo, useState } from "react";
import type { DictionaryEntry } from "../types";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

const API = import.meta.env.VITE_API_URL ?? "";

/* ── types ── */
interface VendorRecord {
  id: number;
  ref_id: string | null;
  name: string;
  category_name: string | null;
  criticality_name: string | null;
  status_name: string | null;
  risk_rating_name: string | null;
  risk_score: number | null;
  contract_owner: string | null;
  contract_end: string | null;
  last_assessment_date: string | null;
  next_assessment_date: string | null;
  questionnaire_completed: boolean;
  is_active: boolean;
}

/* ── helpers ── */
function ratingColor(name: string | null): string | undefined {
  if (!name) return undefined;
  if (name.startsWith("A")) return "#16a34a";
  if (name.startsWith("B")) return "#ca8a04";
  if (name.startsWith("C")) return "#ea580c";
  if (name.startsWith("D")) return "#dc2626";
  return undefined;
}

function ratingBg(name: string | null): string {
  if (!name) return "transparent";
  if (name.startsWith("A")) return "var(--green-dim)";
  if (name.startsWith("B")) return "var(--yellow-dim)";
  if (name.startsWith("C")) return "var(--orange-dim)";
  if (name.startsWith("D")) return "var(--red-dim)";
  return "transparent";
}

function isExpired(date: string | null): boolean {
  return !!date && new Date(date) < new Date();
}

function isWithin90Days(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const in90 = new Date();
  in90.setDate(in90.getDate() + 90);
  return d >= now && d <= in90;
}

/* ── sub-components ── */
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

/* ── validation styles ── */
const errorBorder = "1px solid var(--red)";
const errorShadow = "0 0 0 3px var(--red-dim)";

/* ── column definitions ── */
const COLUMNS: ColumnDef<VendorRecord>[] = [
  { key: "ref_id", header: "Ref", defaultVisible: true, format: (r) => r.ref_id ?? "" },
  { key: "name", header: "Nazwa", defaultVisible: true, format: (r) => r.name },
  { key: "category_name", header: "Kategoria", defaultVisible: true, format: (r) => r.category_name ?? "" },
  { key: "criticality_name", header: "Krytycznosc", defaultVisible: true, format: (r) => r.criticality_name ?? "" },
  { key: "status_name", header: "Status", defaultVisible: true, format: (r) => r.status_name ?? "" },
  { key: "risk_rating_name", header: "Rating", defaultVisible: true, format: (r) => r.risk_rating_name ?? "" },
  { key: "risk_score", header: "Wynik", defaultVisible: true, format: (r) => r.risk_score != null ? `${r.risk_score}%` : "" },
  { key: "contract_end", header: "Koniec umowy", defaultVisible: true, format: (r) => r.contract_end ?? "" },
  { key: "last_assessment_date", header: "Ostatnia ocena", defaultVisible: true, format: (r) => r.last_assessment_date ?? "" },
  { key: "next_assessment_date", header: "Nastepna ocena", defaultVisible: true, format: (r) => r.next_assessment_date ?? "" },
  { key: "contract_owner", header: "Wlasciciel umowy", defaultVisible: false, format: (r) => r.contract_owner ?? "" },
  { key: "questionnaire_completed", header: "Kwestionariusz", defaultVisible: false, format: (r) => r.questionnaire_completed ? "TAK" : "NIE" },
  { key: "is_active", header: "Aktywny", defaultVisible: false, format: (r) => r.is_active ? "TAK" : "NIE" },
];

/* ═══════════════════════════════════════════════════════════════════
   VendorsPage
   ═══════════════════════════════════════════════════════════════════ */
export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<VendorRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  /* Dictionaries */
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [criticalities, setCriticalities] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [dataAccessLevels, setDataAccessLevels] = useState<DictionaryEntry[]>([]);

  /* Column visibility */
  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "vendors");

  /* Table features (search, sort, filter, pagination) */
  const [showFilters, setShowFilters] = useState(false);

  const table = useTableFeatures<VendorRecord>({
    data: vendors,
    storageKey: "vendors",
    defaultSort: "name",
    defaultSortDir: "asc",
  });

  /* Form state */
  const [form, setForm] = useState({
    name: "",
    category_id: null as number | null,
    criticality_id: null as number | null,
    services_provided: "",
    data_access_level_id: null as number | null,
    contract_owner: "",
    security_contact: "",
    contract_start: "",
    contract_end: "",
    sla_description: "",
    status_id: null as number | null,
    certifications: "",
  });

  const resetForm = () => {
    setForm({
      name: "", category_id: null, criticality_id: null, services_provided: "",
      data_access_level_id: null, contract_owner: "", security_contact: "",
      contract_start: "", contract_end: "", sla_description: "",
      status_id: null, certifications: "",
    });
    setTried(false);
  };

  /* ── data loading ── */
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/v1/vendors`);
      if (r.ok) setVendors(await r.json());
      else setError(`API ${r.status}`);

      for (const [code, setter] of [
        ["vendor_category", setCategories],
        ["vendor_status", setStatuses],
        ["asset_criticality", setCriticalities],
        ["vendor_data_access", setDataAccessLevels],
      ] as const) {
        const dr = await fetch(`${API}/api/v1/dictionaries/by-code/${code}`);
        if (dr.ok) {
          const d = await dr.json();
          (setter as (v: DictionaryEntry[]) => void)(d.entries ?? []);
        }
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  /* ── create vendor ── */
  async function handleCreate() {
    setTried(true);
    if (!form.name) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        services_provided: form.services_provided || null,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        sla_description: form.sla_description || null,
        certifications: form.certifications || null,
      };
      const r = await fetch(`${API}/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setShowForm(false);
        resetForm();
        loadAll();
      } else {
        alert("Blad zapisu: " + (await r.text()));
      }
    } catch (e) {
      alert("Blad: " + e);
    }
    setSaving(false);
  }

  /* ── statistics ── */
  const isHighCriticality = (v: VendorRecord) => {
    const n = (v.criticality_name ?? "").toLowerCase();
    return n.includes("wysoki") || n.includes("high") || n.includes("krytyczny") || n.includes("critical");
  };

  const statsCards = useMemo((): StatCard[] => {
    const filteredData = table.filtered;
    const allData = vendors;

    const filteredHighCrit = filteredData.filter(isHighCriticality).length;
    const totalHighCrit = allData.filter(isHighCriticality).length;

    const filteredScored = filteredData.filter((v) => v.risk_score != null);
    const totalScored = allData.filter((v) => v.risk_score != null);
    const filteredAvg = filteredScored.length > 0
      ? filteredScored.reduce((s, v) => s + (v.risk_score ?? 0), 0) / filteredScored.length
      : 0;
    const totalAvg = totalScored.length > 0
      ? totalScored.reduce((s, v) => s + (v.risk_score ?? 0), 0) / totalScored.length
      : 0;

    const filteredExpiring = filteredData.filter((v) => isWithin90Days(v.contract_end)).length;
    const totalExpiring = allData.filter((v) => isWithin90Days(v.contract_end)).length;

    return [
      {
        label: "Wszystkich dostawcow",
        value: filteredData.length,
        total: allData.length,
        color: "var(--blue)",
      },
      {
        label: "Krytycznych",
        value: filteredHighCrit,
        total: totalHighCrit,
        color: "var(--red)",
      },
      {
        label: "Sr. wynik ryzyka",
        value: filteredAvg,
        total: totalAvg,
        color: "var(--orange, #ea580c)",
        formatValue: (v) => typeof v === "number" ? `${v.toFixed(1)}%` : `${v}%`,
      },
      {
        label: "Umowy wygasajace",
        value: filteredExpiring,
        total: totalExpiring,
        color: "var(--purple, #7c3aed)",
      },
    ];
  }, [vendors, table.filtered]);

  /* ── validation helper ── */
  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  /* ── renderCell for DataTable ── */
  const renderCell = (row: VendorRecord, colKey: string) => {
    switch (colKey) {
      case "name":
        return <span style={{ fontWeight: 500 }}>{row.name}</span>;
      case "criticality_name":
        if (!row.criticality_name) return "\u2014";
        return (
          <span
            className="score-badge"
            style={{
              background: isHighCriticality(row) ? "var(--red-dim)" : "var(--blue-dim)",
              color: isHighCriticality(row) ? "var(--red)" : "var(--blue)",
            }}
          >
            {row.criticality_name}
          </span>
        );
      case "risk_rating_name":
        if (!row.risk_rating_name) return "\u2014";
        return (
          <span
            className="score-badge"
            style={{
              background: ratingBg(row.risk_rating_name),
              color: ratingColor(row.risk_rating_name),
              fontWeight: 600,
            }}
          >
            {row.risk_rating_name}
          </span>
        );
      case "risk_score":
        if (row.risk_score == null) return "\u2014";
        return (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: ratingColor(row.risk_rating_name) }}>
            {row.risk_score}%
          </span>
        );
      case "contract_end":
        if (!row.contract_end) return "\u2014";
        return (
          <span style={{
            fontSize: 12,
            color: isExpired(row.contract_end) ? "var(--red)" : undefined,
            fontWeight: isExpired(row.contract_end) ? 600 : undefined,
          }}>
            {row.contract_end}{isExpired(row.contract_end) ? " !" : ""}
          </span>
        );
      default:
        return undefined;
    }
  };

  /* ═══ RENDER ═══ */
  return (
    <div>
      {/* ── Statistics Cards ── */}
      <StatsCards
        cards={statsCards}
        isFiltered={table.filteredCount !== table.totalCount}
      />

      {/* ── Error State ── */}
      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      {/* ── TableToolbar ── */}
      <TableToolbar
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="dostawcow"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj (nazwa, ref, wlasciciel)..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((f) => !f)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="dostawcy"
        primaryLabel="Nowy dostawca"
        onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* ── Main Grid: Table + Detail Panel ── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>

        {/* ── DataTable ── */}
        <DataTable<VendorRecord>
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
          emptyMessage="Brak dostawcow w systemie."
          emptyFilteredMessage="Brak dostawcow pasujacych do filtrow."
        />

        {/* ── Detail Panel (sticky right sidebar 420px) ── */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly Dostawcy</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            {/* Rating display */}
            {selected.risk_rating_name && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Risk Rating
                </div>
                <span
                  className="score-badge"
                  style={{
                    background: ratingBg(selected.risk_rating_name),
                    color: ratingColor(selected.risk_rating_name),
                    fontSize: 14,
                    padding: "6px 16px",
                  }}
                >
                  {selected.risk_rating_name}
                </span>
                {selected.risk_score != null && (
                  <div style={{
                    marginTop: 4, fontSize: 20,
                    fontFamily: "'JetBrains Mono',monospace",
                    fontWeight: 700,
                    color: ratingColor(selected.risk_rating_name),
                  }}>
                    {selected.risk_score}%
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={"\u2460"} label="Dane dostawcy" />
              <DetailRow label="Ref" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.ref_id}</span>} />
              <DetailRow label="Nazwa" value={<strong>{selected.name}</strong>} />
              <DetailRow label="Kategoria" value={selected.category_name} />
              <DetailRow label="Krytycznosc" value={selected.criticality_name} />
              <DetailRow label="Status" value={
                selected.status_name ? (
                  <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{selected.status_name}</span>
                ) : "\u2014"
              } />

              <SectionHeader number={"\u2461"} label="Umowa i kontakt" />
              <DetailRow label="Wlasciciel umowy" value={selected.contract_owner} />
              <DetailRow
                label="Koniec umowy"
                value={selected.contract_end ? (
                  <span>{selected.contract_end}{isExpired(selected.contract_end) ? " !" : ""}</span>
                ) : "\u2014"}
                color={isExpired(selected.contract_end) ? "var(--red)" : undefined}
              />
              <DetailRow label="Kwestionariusz" value={selected.questionnaire_completed ? (
                <span style={{ color: "var(--green)", fontWeight: 600 }}>TAK</span>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>NIE</span>
              )} />
              <DetailRow label="Aktywny" value={selected.is_active ? (
                <span style={{ color: "var(--green)", fontWeight: 600 }}>TAK</span>
              ) : (
                <span style={{ color: "var(--red)", fontWeight: 600 }}>NIE</span>
              )} />

              <SectionHeader number={"\u2462"} label="Oceny i ryzyko" />
              <DetailRow label="Risk Rating" value={selected.risk_rating_name} color={ratingColor(selected.risk_rating_name)} />
              <DetailRow label="Risk Score" value={selected.risk_score != null ? `${selected.risk_score}%` : "\u2014"} />
              <DetailRow label="Ostatnia ocena" value={selected.last_assessment_date} />
              <DetailRow
                label="Nastepna ocena"
                value={selected.next_assessment_date ? (
                  <span>{selected.next_assessment_date}{isExpired(selected.next_assessment_date) ? " !" : ""}</span>
                ) : "\u2014"}
                color={isExpired(selected.next_assessment_date) ? "var(--red)" : undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowy dostawca (TPRM)" wide>
        <SectionHeader number={"\u2460"} label="Dane podstawowe" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "span 3" }}>
            <label>Nazwa *</label>
            <input
              className="form-control"
              style={fieldErr(!!form.name)}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nazwa dostawcy"
            />
            {tried && !form.name && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>Pole wymagane</div>}
          </div>
          <div className="form-group">
            <label>Kategoria</label>
            <select
              className="form-control"
              value={form.category_id ?? ""}
              onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">-- brak --</option>
              {categories.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Krytycznosc</label>
            <select
              className="form-control"
              value={form.criticality_id ?? ""}
              onChange={(e) => setForm({ ...form, criticality_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">-- brak --</option>
              {criticalities.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Poziom dostepu do danych</label>
            <select
              className="form-control"
              value={form.data_access_level_id ?? ""}
              onChange={(e) => setForm({ ...form, data_access_level_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">-- brak --</option>
              {dataAccessLevels.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <SectionHeader number={"\u2461"} label="Umowa i kontakt" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label>Wlasciciel umowy</label>
            <input className="form-control" value={form.contract_owner} onChange={(e) => setForm({ ...form, contract_owner: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Kontakt bezpieczenstwa</label>
            <input className="form-control" value={form.security_contact} onChange={(e) => setForm({ ...form, security_contact: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              className="form-control"
              value={form.status_id ?? ""}
              onChange={(e) => setForm({ ...form, status_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">-- brak --</option>
              {statuses.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Data rozpoczecia</label>
            <input className="form-control" type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Data konca umowy</label>
            <input className="form-control" type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Certyfikaty</label>
            <input className="form-control" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="ISO 27001, SOC2..." />
          </div>
        </div>

        <SectionHeader number={"\u2462"} label="Opis uslug" />
        <div className="form-group">
          <label>Opis swiadczonych uslug</label>
          <textarea
            className="form-control"
            rows={3}
            value={form.services_provided}
            onChange={(e) => setForm({ ...form, services_provided: e.target.value })}
            placeholder="Szczegolowy opis uslug dostawcy..."
          />
        </div>
        <div className="form-group">
          <label>Opis SLA</label>
          <textarea
            className="form-control"
            rows={2}
            value={form.sla_description}
            onChange={(e) => setForm({ ...form, sla_description: e.target.value })}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleCreate}>
            {saving ? "Zapisywanie..." : "Utworz dostawce"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
