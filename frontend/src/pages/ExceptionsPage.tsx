import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import type { OrgUnitTreeNode, SecurityArea, Threat, Vulnerability, DictionaryTypeWithEntries } from "../types";
import { flattenTree, buildPathMap } from "../utils/orgTree";
import Modal from "../components/Modal";

/* ─── Types ─── */
interface ExceptionRecord {
  id: number;
  ref_id: string | null;
  title: string;
  description: string;
  policy_id: number;
  policy_title: string | null;
  category_id: number | null;
  category_name: string | null;
  org_unit_id: number;
  org_unit_name: string | null;
  asset_id: number | null;
  asset_name: string | null;
  requested_by: string;
  approved_by: string | null;
  risk_level_id: number | null;
  risk_level_name: string | null;
  compensating_controls: string | null;
  status_id: number | null;
  status_name: string | null;
  start_date: string;
  expiry_date: string;
  review_date: string | null;
  closed_at: string | null;
  risk_id: number | null;
  risk_score: number | null;
  risk_level: string | null;
  vulnerability_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Lookups {
  orgUnits: OrgUnitTreeNode[];
  policies: { id: number; title: string }[];
  categories: { id: number; label: string }[];
  statuses: { id: number; label: string }[];
  riskLevels: { id: number; label: string }[];
  areas: SecurityArea[];
  threats: Threat[];
  vulns: Vulnerability[];
  strategies: { id: number; label: string }[];
}

/* ─── Risk helpers ─── */
function riskColor(R: number) { return R >= 221 ? "var(--red)" : R >= 31 ? "var(--orange)" : "var(--green)"; }
function riskBg(R: number) { return R >= 221 ? "var(--red-dim)" : R >= 31 ? "var(--orange-dim)" : "var(--green-dim)"; }
function riskLabel(R: number) { return R >= 221 ? "Wysokie" : R >= 31 ? "Srednie" : "Niskie"; }

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

/* ═══════════════════════════════════════════════════════════════════
   ExceptionsPage — main component
   ═══════════════════════════════════════════════════════════════════ */
export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [selected, setSelected] = useState<ExceptionRecord | null>(null);

  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);

  const load = () => {
    api.get<ExceptionRecord[]>("/api/v1/exceptions").then(setExceptions).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
  }, []);

  const orgPathMap = useMemo(() => buildPathMap(orgTree), [orgTree]);

  const loadLookups = async (): Promise<Lookups> => {
    if (lookups) return lookups;
    const [orgUnits, policiesRaw, areasRaw, threatsRaw, vulnsRaw] = await Promise.all([
      api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").catch(() => [] as OrgUnitTreeNode[]),
      api.get<{ id: number; title: string }[]>("/api/v1/policies").catch(() => []),
      api.get<SecurityArea[]>("/api/v1/domains").catch(() => [] as SecurityArea[]),
      api.get<Threat[]>("/api/v1/threats").catch(() => [] as Threat[]),
      api.get<Vulnerability[]>("/api/v1/vulnerabilities").catch(() => [] as Vulnerability[]),
    ]);
    const policies = policiesRaw.map((p: any) => ({ id: p.id, title: p.title }));
    const dictEntries = async (code: string) => {
      try {
        const d = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${code}/entries`);
        return d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label }));
      } catch { return []; }
    };
    const [categories, statuses, riskLevels, strategies] = await Promise.all([
      dictEntries("exception_category"),
      dictEntries("exception_status"),
      dictEntries("risk_level"),
      dictEntries("risk_strategy"),
    ]);
    const result: Lookups = { orgUnits, policies, categories, statuses, riskLevels, areas: areasRaw, threats: threatsRaw, vulns: vulnsRaw, strategies };
    setLookups(result);
    return result;
  };

  const openAddForm = async () => {
    await loadLookups();
    setEditExc(null);
    setShowForm(true);
  };

  const today = new Date();
  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 30;
  };
  const isExpired = (d: string | null) => d ? new Date(d) < today : false;

  const flatUnits = lookups ? flattenTree(lookups.orgUnits) : [];

  return (
    <div>
      {/* ─── Toolbar ─── */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{exceptions.length} wyjatkow</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={openAddForm}>+ Nowy wyjatek</button>
        </div>
      </div>

      {/* ─── Main grid ─── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>
        {/* ─── Table ─── */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie...</div>
          ) : exceptions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Brak wyjatkow w systemie.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Tytul</th>
                  <th>Polityka</th>
                  <th>Pion</th>
                  <th>Ryzyko odst.</th>
                  <th>Status</th>
                  <th>Wygasa</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map(ex => {
                  const rs = ex.risk_score ?? 0;
                  return (
                    <tr
                      key={ex.id}
                      style={{
                        borderLeft: ex.risk_score != null ? `3px solid ${riskColor(rs)}` : undefined,
                        cursor: "pointer",
                        background: selected?.id === ex.id ? "var(--bg-card-hover)" : undefined,
                      }}
                      onClick={() => setSelected(selected?.id === ex.id ? null : ex)}
                    >
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{ex.ref_id}</td>
                      <td style={{ fontWeight: 500 }}>{ex.title}</td>
                      <td style={{ fontSize: 11 }}>{ex.policy_title ?? "\u2014"}</td>
                      <td style={{ fontSize: 11 }}>{orgPathMap.get(ex.org_unit_id) ?? ex.org_unit_name}</td>
                      <td>
                        {ex.risk_score != null ? (
                          <span className="score-badge" style={{ background: riskBg(rs), color: riskColor(rs) }}>
                            {rs.toFixed(1)} {riskLabel(rs)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>{ex.risk_level_name ?? "\u2014"}</span>
                        )}
                      </td>
                      <td>
                        <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
                          {ex.status_name ?? "\u2014"}
                        </span>
                      </td>
                      <td style={{
                        color: isExpired(ex.expiry_date) ? "var(--red)" : isExpiringSoon(ex.expiry_date) ? "var(--orange)" : undefined,
                        fontWeight: isExpired(ex.expiry_date) || isExpiringSoon(ex.expiry_date) ? 600 : undefined,
                        fontSize: 12,
                      }}>
                        {ex.expiry_date}
                        {isExpired(ex.expiry_date) && " (WYGASLY)"}
                        {isExpiringSoon(ex.expiry_date) && " (reocena)"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Detail Panel ─── */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly Wyjatku</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            {/* Risk score display */}
            {selected.risk_score != null && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Ryzyko odstepstwa
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: riskColor(selected.risk_score) }}>
                  {selected.risk_score.toFixed(1)}
                </div>
                <span className="score-badge" style={{ background: riskBg(selected.risk_score), color: riskColor(selected.risk_score), fontSize: 13, padding: "4px 12px" }}>
                  {riskLabel(selected.risk_score)}
                </span>
                {selected.risk_id && (
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={`/risks?highlight=${selected.risk_id}`}
                      style={{ fontSize: 11, color: "var(--blue)", textDecoration: "none" }}
                    >
                      Przejdz do ryzyka w rejestrze &rarr;
                    </a>
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <SectionHeader number={"\u2460"} label="Dane wyjatku" />
              <DetailRow label="Ref" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.ref_id}</span>} />
              <DetailRow label="Tytul" value={<strong>{selected.title}</strong>} />
              <DetailRow label="Polityka" value={selected.policy_title} />
              <DetailRow label="Pion" value={orgPathMap.get(selected.org_unit_id) ?? selected.org_unit_name} />
              <DetailRow label="Kategoria" value={selected.category_name} />
              <DetailRow label="Wnioskujacy" value={selected.requested_by} />
              <DetailRow label="Zatwierdzajacy" value={selected.approved_by} />

              <SectionHeader number={"\u2461"} label="Uzasadnienie i kompensacja" />
              {selected.description && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                  {selected.description}
                </div>
              )}
              {selected.compensating_controls && (
                <div>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2, fontSize: 11 }}>Srodki kompensacyjne</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.compensating_controls}
                  </div>
                </div>
              )}

              <SectionHeader number={"\u2462"} label="Daty i status" />
              <DetailRow label="Status" value={
                selected.status_name ? (
                  <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{selected.status_name}</span>
                ) : "\u2014"
              } />
              <DetailRow label="Poczatek" value={selected.start_date} />
              <DetailRow label="Wygasniecie" value={
                <span style={{
                  color: isExpired(selected.expiry_date) ? "var(--red)" : isExpiringSoon(selected.expiry_date) ? "var(--orange)" : undefined,
                  fontWeight: isExpired(selected.expiry_date) ? 600 : undefined,
                }}>
                  {selected.expiry_date}
                  {isExpired(selected.expiry_date) && " (WYGASLY!)"}
                  {isExpiringSoon(selected.expiry_date) && " (reocena)"}
                </span>
              } />
              <DetailRow label="Data przegladu" value={selected.review_date} />
              {selected.closed_at && <DetailRow label="Zamknieto" value={selected.closed_at} />}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid rgba(42,53,84,0.25)", paddingTop: 12 }}>
              <button
                className="btn btn-sm"
                style={{ flex: 1, color: "var(--red)" }}
                onClick={async () => {
                  if (!confirm(`Archiwizowac wyjatek ${selected.ref_id}?`)) return;
                  await api.delete(`/api/v1/exceptions/${selected.id}`);
                  setSelected(null);
                  setLoading(true);
                  load();
                }}
              >
                Archiwizuj
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Wizard Form Modal ─── */}
      <Modal open={showForm} onClose={() => { setShowForm(false); }} title="Nowy wyjatek od polityki" wide>
        {lookups ? (
          <ExceptionWizard
            lookups={lookups}
            flatUnits={flatUnits}
            saving={saving}
            onSubmit={async (data) => {
              setSaving(true);
              try {
                await api.post("/api/v1/exceptions/with-risk", data);
                setShowForm(false);
                setLoading(true);
                load();
              } catch (err) {
                alert("Blad zapisu: " + err);
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => { setShowForm(false); }}
          />
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie danych formularza...</div>
        )}
      </Modal>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ExceptionWizard — 2-step form with mandatory risk assessment
   ═══════════════════════════════════════════════════════════════════ */
function ExceptionWizard({ lookups, flatUnits, saving, onSubmit, onCancel }: {
  lookups: Lookups;
  flatUnits: { id: number; name: string; depth: number }[];
  saving: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);

  // Step 1: Exception fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [policyId, setPolicyId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [orgUnitId, setOrgUnitId] = useState<number | null>(null);
  const [requestedBy, setRequestedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [compensatingControls, setCompensatingControls] = useState("");
  const [statusId, setStatusId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");

  // Step 2: Risk assessment
  const [riskAssetName, setRiskAssetName] = useState("");
  const [riskAreaId, setRiskAreaId] = useState<number | null>(null);
  const [riskThreatId, setRiskThreatId] = useState<number | null>(null);
  const [riskVulnId, setRiskVulnId] = useState<number | null>(null);
  const [riskConsequence, setRiskConsequence] = useState("");
  const [riskExistingControls, setRiskExistingControls] = useState("");
  const [W, setW] = useState(2);
  const [P, setP] = useState(2);
  const [Z, setZ] = useState(0.25);
  const [riskOwner, setRiskOwner] = useState("");
  const [riskStrategyId, setRiskStrategyId] = useState<number | null>(null);
  const [riskTreatmentPlan, setRiskTreatmentPlan] = useState("");

  // Live risk calculation
  const liveScore = Math.exp(W) * P / Z;
  const lvColor = liveScore >= 221 ? "var(--red)" : liveScore >= 31 ? "var(--orange)" : "var(--green)";
  const lvBg = liveScore >= 221 ? "var(--red-dim)" : liveScore >= 31 ? "var(--orange-dim)" : "var(--green-dim)";
  const liveLabel = riskLabel(liveScore);

  const canStep1 = title && description && policyId && orgUnitId && requestedBy && startDate && expiryDate;
  const canStep2 = riskAssetName && W && P && Z;

  const handleSubmit = () => {
    if (!canStep2) return;
    onSubmit({
      title,
      description,
      policy_id: policyId,
      category_id: categoryId,
      org_unit_id: orgUnitId,
      requested_by: requestedBy,
      approved_by: approvedBy || null,
      compensating_controls: compensatingControls || null,
      status_id: statusId,
      start_date: startDate,
      expiry_date: expiryDate,
      vulnerability_id: null,
      risk_asset_name: riskAssetName,
      risk_security_area_id: riskAreaId,
      risk_threat_id: riskThreatId,
      risk_vulnerability_id: riskVulnId,
      risk_consequence: riskConsequence || null,
      risk_existing_controls: riskExistingControls || null,
      risk_impact_level: W,
      risk_probability_level: P,
      risk_safeguard_rating: Z,
      risk_owner: riskOwner || null,
      risk_strategy_id: riskStrategyId,
      risk_treatment_plan: riskTreatmentPlan || null,
    });
  };

  // Auto-fill risk asset name from exception title
  useEffect(() => {
    if (!riskAssetName && title) {
      setRiskAssetName(title);
    }
  }, [step]);

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
        {[
          { n: 1, label: "Dane wyjatku" },
          { n: 2, label: "Ocena ryzyka odstepstwa" },
        ].map(s => (
          <div
            key={s.n}
            style={{
              flex: 1, textAlign: "center", padding: "10px 16px",
              background: step === s.n ? "var(--blue-dim)" : "transparent",
              borderBottom: step === s.n ? "2px solid var(--blue)" : "2px solid var(--border)",
              color: step === s.n ? "var(--blue)" : "var(--text-muted)",
              fontWeight: step === s.n ? 600 : 400,
              fontSize: 13, cursor: s.n < step ? "pointer" : undefined,
              transition: "all 0.2s",
            }}
            onClick={() => { if (s.n < step) setStep(s.n); }}
          >
            <span style={{
              display: "inline-flex", width: 22, height: 22, borderRadius: "50%",
              alignItems: "center", justifyContent: "center", fontSize: 11,
              background: step >= s.n ? "var(--blue)" : "var(--border)",
              color: step >= s.n ? "#fff" : "var(--text-muted)",
              marginRight: 8,
            }}>
              {s.n}
            </span>
            {s.label}
          </div>
        ))}
      </div>

      {/* ═══ Step 1: Exception details ═══ */}
      {step === 1 && (
        <div>
          <SectionHeader number={"\u2460"} label="Dane podstawowe wyjatku" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Tytul wyjatku *</label>
              <input className="form-control" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="np. Brak szyfrowania dysków na stacjach roboczych w oddziale X" />
            </div>
            <div className="form-group">
              <label>Polityka *</label>
              <select className="form-control" required value={policyId ?? ""} onChange={e => setPolicyId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz polityk...</option>
                {lookups.policies.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Jednostka organizacyjna *</label>
              <select className="form-control" required value={orgUnitId ?? ""} onChange={e => setOrgUnitId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {flatUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Wnioskujacy *</label>
              <input className="form-control" required value={requestedBy} onChange={e => setRequestedBy(e.target.value)}
                placeholder="Imie i nazwisko" />
            </div>
            <div className="form-group">
              <label>Zatwierdzajacy</label>
              <input className="form-control" value={approvedBy} onChange={e => setApprovedBy(e.target.value)}
                placeholder="Imie i nazwisko" />
            </div>
            <div className="form-group">
              <label>Kategoria</label>
              <select className="form-control" value={categoryId ?? ""} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Brak</option>
                {lookups.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={statusId ?? ""} onChange={e => setStatusId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Brak</option>
                {lookups.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Data rozpoczecia *</label>
              <input className="form-control" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Data wygasniecia *</label>
              <input className="form-control" type="date" required value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <SectionHeader number={"\u2461"} label="Uzasadnienie i kompensacja" />
          <div className="form-group">
            <label>Uzasadnienie biznesowe *</label>
            <textarea className="form-control" rows={3} required value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Opisz powod wyjatku, wplyw na biznes, uzasadnienie..." />
          </div>
          <div className="form-group">
            <label>Srodki kompensacyjne</label>
            <textarea className="form-control" rows={3} value={compensatingControls} onChange={e => setCompensatingControls(e.target.value)}
              placeholder="Opisz jakie dodatkowe srodki bezpieczenstwa zostana wdrozone..." />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={onCancel}>Anuluj</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canStep1}
              onClick={() => setStep(2)}
            >
              Dalej: Ocena ryzyka &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Risk Assessment (Mandatory) ═══ */}
      {step === 2 && (
        <div>
          {/* Info banner */}
          <div style={{
            background: "var(--orange-dim)", border: "1px solid var(--orange)", borderRadius: 8,
            padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "var(--orange)",
          }}>
            Kazdy wyjatek od polityki wymaga formalnej oceny ryzyka odstepstwa zgodnie z macierza ryzyka.
            Ryzyko zostanie automatycznie zarejestrowane w rejestrze ryzyk.
          </div>

          {/* Live score preview */}
          <div style={{
            background: lvBg, border: `1px solid ${lvColor}`, borderRadius: 10,
            padding: "12px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 11, color: lvColor, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                Ocena ryzyka odstepstwa
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                R = EXP({W}) &times; {P} / {Z} = <strong style={{ color: lvColor }}>{liveScore.toFixed(1)}</strong>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: lvColor }}>{liveScore.toFixed(1)}</div>
              <span className="score-badge" style={{ background: `${lvColor}30`, color: lvColor, fontSize: 12 }}>{liveLabel}</span>
            </div>
          </div>

          {/* Risk matrix 3x3 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Macierz ryzyka
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto repeat(3, 1fr)", gap: 2, maxWidth: 340, margin: "0 auto" }}>
              <div />
              {["P=1", "P=2", "P=3"].map(h => (
                <div key={h} style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", padding: 4 }}>{h}</div>
              ))}
              {[3, 2, 1].map(w => (
                <>
                  <div key={`w${w}`} style={{ fontSize: 10, color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}>W={w}</div>
                  {[1, 2, 3].map(p => {
                    const score = Math.exp(w) * p / Z;
                    const isActive = w === W && p === P;
                    return (
                      <div
                        key={`${w}-${p}`}
                        style={{
                          textAlign: "center", padding: 6, borderRadius: 4, fontSize: 10,
                          fontFamily: "'JetBrains Mono',monospace", fontWeight: isActive ? 700 : 400,
                          background: riskBg(score),
                          color: riskColor(score),
                          border: isActive ? `2px solid ${riskColor(score)}` : "2px solid transparent",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        onClick={() => { setW(w); setP(p); }}
                      >
                        {score.toFixed(0)}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
              Kliknij komorke aby wybrac W i P (Z={Z})
            </div>
          </div>

          <SectionHeader number={"\u2460"} label="Identyfikacja ryzyka" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Aktywo / obszar narazony na ryzyko *</label>
              <input className="form-control" required value={riskAssetName} onChange={e => setRiskAssetName(e.target.value)}
                placeholder="np. Stacje robocze oddzialu X" />
            </div>
            <div className="form-group">
              <label>Domena bezpieczenstwa</label>
              <select className="form-control" value={riskAreaId ?? ""} onChange={e => setRiskAreaId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Zagrozenie</label>
              <select className="form-control" value={riskThreatId ?? ""} onChange={e => setRiskThreatId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.threats.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Podatnosc</label>
              <select className="form-control" value={riskVulnId ?? ""} onChange={e => setRiskVulnId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.vulns.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Opis konsekwencji realizacji ryzyka</label>
              <textarea className="form-control" rows={2} value={riskConsequence} onChange={e => setRiskConsequence(e.target.value)}
                placeholder="Co moze sie stac jezeli ryzyko sie zmaterializuje..." />
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Istniejace zabezpieczenia / kontrole</label>
              <textarea className="form-control" rows={2} value={riskExistingControls} onChange={e => setRiskExistingControls(e.target.value)}
                placeholder="Jakie srodki sa juz wdrozone..." />
            </div>
          </div>

          <SectionHeader number={"\u2461"} label="Ocena ryzyka (macierz)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Wplyw (W) *</label>
              <select className="form-control" required value={W} onChange={e => setW(Number(e.target.value))}>
                <option value="1">1 -- Niski</option>
                <option value="2">2 -- Sredni</option>
                <option value="3">3 -- Wysoki</option>
              </select>
            </div>
            <div className="form-group">
              <label>Prawdopodobienstwo (P) *</label>
              <select className="form-control" required value={P} onChange={e => setP(Number(e.target.value))}>
                <option value="1">1 -- Niskie</option>
                <option value="2">2 -- Srednie</option>
                <option value="3">3 -- Wysokie</option>
              </select>
            </div>
            <div className="form-group">
              <label>Ocena zabezpieczen (Z) *</label>
              <select className="form-control" required value={Z} onChange={e => setZ(Number(e.target.value))}>
                <option value="0.10">0,10 -- Brak zabezpieczen</option>
                <option value="0.25">0,25 -- Czesciowe</option>
                <option value="0.70">0,70 -- Dobra jakosc</option>
                <option value="0.95">0,95 -- Skuteczne, testowane</option>
              </select>
            </div>
          </div>

          <SectionHeader number={"\u2462"} label="Postepowanie z ryzykiem" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Wlasciciel ryzyka</label>
              <input className="form-control" value={riskOwner} onChange={e => setRiskOwner(e.target.value)}
                placeholder="np. Jan Kowalski" />
            </div>
            <div className="form-group">
              <label>Strategia</label>
              <select className="form-control" value={riskStrategyId ?? ""} onChange={e => setRiskStrategyId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.strategies.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Plan postepowania z ryzykiem</label>
              <textarea className="form-control" rows={2} value={riskTreatmentPlan} onChange={e => setRiskTreatmentPlan(e.target.value)}
                placeholder="Jakie dzialania beda podjete aby zredukowac ryzyko..." />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setStep(1)}>&larr; Wstecz</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={onCancel}>Anuluj</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !canStep2}
                onClick={handleSubmit}
              >
                {saving ? "Zapisywanie..." : "Zapisz wyjatek + ryzyko"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
