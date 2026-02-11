import { useEffect, useState } from "react";
import type { DictionaryEntry } from "../types";
import Modal from "../components/Modal";

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

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<DictionaryEntry[]>([]);
  const [statuses, setStatuses] = useState<DictionaryEntry[]>([]);
  const [selected, setSelected] = useState<PolicyRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "", owner: "", approver: "",
    category_id: null as number | null,
    status_id: null as number | null,
    current_version: "1.0",
    effective_date: "", review_date: "",
    document_url: "", target_audience_count: 0,
    description: "",
  });

  const resetForm = () => setForm({
    title: "", owner: "", approver: "",
    category_id: null, status_id: null,
    current_version: "1.0",
    effective_date: "", review_date: "",
    document_url: "", target_audience_count: 0,
    description: "",
  });

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

  const canSubmit = form.title && form.owner;
  const today = new Date();

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{policies.length} polityk</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Nowa polityka</button>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
          ) : policies.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Brak polityk w systemie.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Tytul</th>
                  <th>Kategoria</th>
                  <th>Wlasciciel</th>
                  <th>Status</th>
                  <th>Wersja</th>
                  <th>Obowiazuje od</th>
                  <th>Przeglad</th>
                  <th>Potwierdz.</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => {
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
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{p.ref_id}</td>
                      <td style={{ fontWeight: 500 }}>{p.title}</td>
                      <td style={{ fontSize: 12 }}>{p.category_name ?? "\u2014"}</td>
                      <td style={{ fontSize: 12 }}>{p.owner}</td>
                      <td>
                        <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
                          {p.status_name ?? "\u2014"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{p.current_version ?? "\u2014"}</td>
                      <td style={{ fontSize: 12 }}>{p.effective_date ?? "\u2014"}</td>
                      <td style={{
                        fontSize: 12,
                        color: reviewOverdue ? "var(--red)" : undefined,
                        fontWeight: reviewOverdue ? 600 : undefined,
                      }}>
                        {p.review_date ?? "\u2014"}
                        {reviewOverdue && " (zalegly!)"}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {p.acknowledgment_rate != null ? (
                          <span style={{ color: p.acknowledgment_rate >= 80 ? "var(--green)" : p.acknowledgment_rate >= 50 ? "var(--orange)" : "var(--red)" }}>
                            {p.acknowledgment_rate}%
                          </span>
                        ) : "\u2014"}
                        {" "}
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({p.acknowledgment_count}/{p.target_audience_count})</span>
                      </td>
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
            <input className="form-control" required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              placeholder="np. Polityka bezpieczenstwa informacji" />
          </div>
          <div className="form-group">
            <label>Wlasciciel *</label>
            <input className="form-control" required value={form.owner} onChange={e => setForm({...form, owner: e.target.value})}
              placeholder="Imie i nazwisko" />
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
            disabled={saving || !canSubmit}
            onClick={handleCreate}
          >
            {saving ? "Zapisywanie..." : "Zapisz polityke"}
          </button>
        </div>
      </Modal>
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
