import { useEffect, useMemo, useState } from "react";
import type { DictionaryEntry } from "../types";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";

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

/* ── sort types ── */

type SortField = "ref_id" | "title" | "category_name" | "owner" | "status_name" | "current_version" | "effective_date" | "review_date" | "acknowledgment_rate";
type SortDir = "asc" | "desc";

/* ── column definitions ── */

const COLUMNS: ColumnDef<PolicyRecord>[] = [
  { key: "ref_id", header: "Ref", format: (r) => r.ref_id ?? "" },
  { key: "title", header: "Tytul", format: (r) => r.title },
  { key: "category_name", header: "Kategoria", format: (r) => r.category_name ?? "" },
  { key: "owner", header: "Wlasciciel", format: (r) => r.owner },
  { key: "status_name", header: "Status", format: (r) => r.status_name ?? "" },
  { key: "current_version", header: "Wersja", format: (r) => r.current_version ?? "" },
  { key: "effective_date", header: "Obowiazuje od", format: (r) => r.effective_date ?? "" },
  { key: "review_date", header: "Przeglad", format: (r) => r.review_date ?? "" },
  { key: "acknowledgment_rate", header: "Potwierdz.", format: (r) => r.acknowledgment_rate != null ? `${r.acknowledgment_rate}%` : "" },
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

  // Search, sort, filters
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "policies");

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

  // Sort helper
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const hasFilters = !!filterStatus || !!filterCategory;
  const clearFilters = () => { setFilterStatus(""); setFilterCategory(""); };

  const today = new Date();

  // Filtered & sorted data
  const filtered = useMemo(() => {
    let result = [...policies];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p =>
        (p.title ?? "").toLowerCase().includes(s) ||
        (p.owner ?? "").toLowerCase().includes(s) ||
        (p.ref_id ?? "").toLowerCase().includes(s)
      );
    }
    if (filterStatus) result = result.filter(p => p.status_id === Number(filterStatus));
    if (filterCategory) result = result.filter(p => p.category_id === Number(filterCategory));

    result.sort((a, b) => {
      const av = (a as any)[sortField];
      const bv = (b as any)[sortField];
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = 1;
      else if (bv == null) cmp = -1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "pl");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [policies, search, filterStatus, filterCategory, sortField, sortDir]);

  // Statistics
  const stats = useMemo(() => {
    const total = policies.length;
    const active = policies.filter(p => p.is_active).length;
    const overdueReview = policies.filter(p => p.review_date && new Date(p.review_date) < today).length;
    const withRate = policies.filter(p => p.acknowledgment_rate != null);
    const avgAck = withRate.length > 0
      ? (withRate.reduce((s, p) => s + (p.acknowledgment_rate ?? 0), 0) / withRate.length).toFixed(0)
      : "\u2014";
    return { total, active, overdueReview, avgAck };
  }, [policies]);

  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => handleSort(field)}>
      {label}
      {sortField === field && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  const fieldErr = (ok: boolean) => tried && !ok ? { border: errorBorder, boxShadow: errorShadow } : {};

  return (
    <div>
      {/* Statistics cards */}
      <div className="grid-4">
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--blue)" }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Wszystkich polityk</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--green)" }}>{stats.active}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Aktywnych <span style={{ color: "var(--text-muted)", fontSize: 10 }}>({stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%)</span></div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: stats.overdueReview > 0 ? "var(--red)" : "var(--green)" }}>{stats.overdueReview}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zalegly przeglad</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)" }}>{stats.avgAck}{stats.avgAck !== "\u2014" ? "%" : ""}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sredni wsk. potwierdzen</div>
        </div>
      </div>

      {/* Toolbar */}
      <TableToolbar
        filteredCount={filtered.length} totalCount={policies.length} unitLabel="polityk"
        search={search} onSearchChange={setSearch} searchPlaceholder="Szukaj (tytul, wlasciciel, ref)..."
        showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={hasFilters} onClearFilters={clearFilters}
        columns={COLUMNS} visibleColumns={visibleCols} onToggleColumn={toggleCol}
        data={filtered} exportFilename="polityki"
        primaryLabel="Nowa polityka" onPrimaryAction={() => { resetForm(); setShowForm(true); }}
      />

      {/* Collapsible filters */}
      {showFilters && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Wszystkie statusy</option>
            {statuses.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select className="form-control" style={{ width: 180, padding: "5px 10px", fontSize: 12 }}
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Wszystkie kategorie</option>
            {categories.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {policies.length === 0 ? "Brak polityk w systemie." : "Brak polityk pasujacych do filtrow."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {visibleCols.has("ref_id") && <SortTh field="ref_id" label="Ref" />}
                  {visibleCols.has("title") && <SortTh field="title" label="Tytul" />}
                  {visibleCols.has("category_name") && <SortTh field="category_name" label="Kategoria" />}
                  {visibleCols.has("owner") && <SortTh field="owner" label="Wlasciciel" />}
                  {visibleCols.has("status_name") && <SortTh field="status_name" label="Status" />}
                  {visibleCols.has("current_version") && <SortTh field="current_version" label="Wersja" />}
                  {visibleCols.has("effective_date") && <SortTh field="effective_date" label="Obowiazuje od" />}
                  {visibleCols.has("review_date") && <SortTh field="review_date" label="Przeglad" />}
                  {visibleCols.has("acknowledgment_rate") && <SortTh field="acknowledgment_rate" label="Potwierdz." />}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const reviewOverdue = p.review_date && new Date(p.review_date) < today;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        cursor: "pointer",
                        background: selected?.id === p.id ? "var(--bg-card-hover)" : undefined,
                      }}
                      onClick={() => setSelected(selected?.id === p.id ? null : p)}
                    >
                      {visibleCols.has("ref_id") && (
                        <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{p.ref_id}</td>
                      )}
                      {visibleCols.has("title") && (
                        <td style={{ fontWeight: 500 }}>{p.title}</td>
                      )}
                      {visibleCols.has("category_name") && (
                        <td style={{ fontSize: 12 }}>{p.category_name ?? "\u2014"}</td>
                      )}
                      {visibleCols.has("owner") && (
                        <td style={{ fontSize: 12 }}>{p.owner}</td>
                      )}
                      {visibleCols.has("status_name") && (
                        <td>
                          <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
                            {p.status_name ?? "\u2014"}
                          </span>
                        </td>
                      )}
                      {visibleCols.has("current_version") && (
                        <td style={{ fontSize: 12 }}>{p.current_version ?? "\u2014"}</td>
                      )}
                      {visibleCols.has("effective_date") && (
                        <td style={{ fontSize: 12 }}>{p.effective_date ?? "\u2014"}</td>
                      )}
                      {visibleCols.has("review_date") && (
                        <td style={{
                          fontSize: 12,
                          color: reviewOverdue ? "var(--red)" : undefined,
                          fontWeight: reviewOverdue ? 600 : undefined,
                        }}>
                          {p.review_date ?? "\u2014"}
                          {reviewOverdue && " (zalegly!)"}
                        </td>
                      )}
                      {visibleCols.has("acknowledgment_rate") && (
                        <td style={{ fontSize: 12 }}>
                          {p.acknowledgment_rate != null ? (
                            <span style={{ color: p.acknowledgment_rate >= 80 ? "var(--green)" : p.acknowledgment_rate >= 50 ? "var(--orange)" : "var(--red)" }}>
                              {p.acknowledgment_rate}%
                            </span>
                          ) : "\u2014"}
                          {" "}
                          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({p.acknowledgment_count}/{p.target_audience_count})</span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

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
