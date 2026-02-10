import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import type { Risk, Asset, OrgUnitTreeNode, SecurityArea, Threat, Vulnerability, Safeguard, DictionaryTypeWithEntries } from "../types";
import { flattenTree, buildPathMap, collectDescendantIds } from "../utils/orgTree";
import Modal from "../components/Modal";

function riskColor(R: number) { return R >= 221 ? "var(--red)" : R >= 31 ? "var(--orange)" : "var(--green)"; }
function riskBg(R: number) { return R >= 221 ? "var(--red-dim)" : R >= 31 ? "var(--orange-dim)" : "var(--green-dim)"; }
function riskLabel(R: number) { return R >= 221 ? "Wysokie" : R >= 31 ? "Średnie" : "Niskie"; }

interface FormLookups {
  orgUnits: OrgUnitTreeNode[];
  areas: SecurityArea[];
  threats: Threat[];
  vulns: Vulnerability[];
  safeguards: Safeguard[];
  assets: Asset[];
  categories: { id: number; label: string }[];
  sensitivities: { id: number; label: string }[];
  criticalities: { id: number; label: string }[];
  statuses: { id: number; label: string }[];
  strategies: { id: number; label: string }[];
}

export default function RisksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRisk, setEditRisk] = useState<Risk | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [selected, setSelected] = useState<Risk | null>(null);

  // Filters from URL or local state
  const [filterOrg, setFilterOrg] = useState(searchParams.get("org") ?? "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") ?? "");
  const [filterLevel, setFilterLevel] = useState(searchParams.get("level") ?? "");

  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);

  const loadRisks = () => {
    api.get<Risk[]>("/api/v1/risks").then(data => {
      setRisks(data);
      const highlightId = searchParams.get("highlight");
      if (highlightId) {
        const found = data.find(r => r.id === Number(highlightId));
        if (found) setSelected(found);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRisks();
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
  }, []);

  const orgPathMap = useMemo(() => buildPathMap(orgTree), [orgTree]);

  const loadLookups = async (): Promise<FormLookups> => {
    if (lookups) return lookups;
    const [orgUnits, areas, threats, vulns, safeguards, assets] = await Promise.all([
      api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").catch(() => [] as OrgUnitTreeNode[]),
      api.get<SecurityArea[]>("/api/v1/security-areas").catch(() => [] as SecurityArea[]),
      api.get<Threat[]>("/api/v1/threats").catch(() => [] as Threat[]),
      api.get<Vulnerability[]>("/api/v1/vulnerabilities").catch(() => [] as Vulnerability[]),
      api.get<Safeguard[]>("/api/v1/safeguards").catch(() => [] as Safeguard[]),
      api.get<Asset[]>("/api/v1/assets").catch(() => [] as Asset[]),
    ]);
    const dictEntries = async (code: string) => {
      try {
        const d = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${code}/entries`);
        return d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label }));
      } catch { return []; }
    };
    const [categories, sensitivities, criticalities, statuses, strategies] = await Promise.all([
      dictEntries("asset_category"), dictEntries("sensitivity"), dictEntries("criticality"),
      dictEntries("risk_status"), dictEntries("risk_strategy"),
    ]);
    const result = { orgUnits, areas, threats, vulns, safeguards, assets, categories, sensitivities, criticalities, statuses, strategies };
    setLookups(result);
    return result;
  };

  const openAddForm = async () => {
    await loadLookups();
    setEditRisk(null);
    setShowForm(true);
  };

  const openEditForm = async (risk: Risk) => {
    await loadLookups();
    setEditRisk(risk);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      org_unit_id: Number(fd.get("org_unit_id")),
      asset_id: fd.get("asset_id") ? Number(fd.get("asset_id")) : null,
      asset_name: fd.get("asset_name") as string,
      asset_category_id: fd.get("asset_category_id") ? Number(fd.get("asset_category_id")) : null,
      sensitivity_id: fd.get("sensitivity_id") ? Number(fd.get("sensitivity_id")) : null,
      criticality_id: fd.get("criticality_id") ? Number(fd.get("criticality_id")) : null,
      security_area_id: fd.get("security_area_id") ? Number(fd.get("security_area_id")) : null,
      threat_id: fd.get("threat_id") ? Number(fd.get("threat_id")) : null,
      vulnerability_id: fd.get("vulnerability_id") ? Number(fd.get("vulnerability_id")) : null,
      impact_level: Number(fd.get("impact_level")),
      probability_level: Number(fd.get("probability_level")),
      safeguard_rating: Number(fd.get("safeguard_rating")),
      status_id: fd.get("status_id") ? Number(fd.get("status_id")) : null,
      strategy_id: fd.get("strategy_id") ? Number(fd.get("strategy_id")) : null,
      owner: (fd.get("owner") as string) || null,
      planned_actions: (fd.get("planned_actions") as string) || null,
      residual_risk: fd.get("residual_risk") ? Number(fd.get("residual_risk")) : null,
      target_impact: fd.get("target_impact") ? Number(fd.get("target_impact")) : null,
      target_probability: fd.get("target_probability") ? Number(fd.get("target_probability")) : null,
      target_safeguard: fd.get("target_safeguard") ? Number(fd.get("target_safeguard")) : null,
      safeguard_ids: Array.from(fd.getAll("safeguard_ids")).map(Number).filter(Boolean),
    };
    try {
      if (editRisk) {
        const updated = await api.put<Risk>(`/api/v1/risks/${editRisk.id}`, body);
        setSelected(updated);
      } else {
        await api.post("/api/v1/risks", body);
      }
      setShowForm(false);
      setEditRisk(null);
      setLoading(true);
      loadRisks();
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRisk = async (risk: Risk) => {
    if (!confirm(`Zamknąć ryzyko ${risk.code || risk.id}? Status zostanie zmieniony na "Zamknięte".`)) return;
    try {
      await api.delete(`/api/v1/risks/${risk.id}`);
      setSelected(null);
      setLoading(true);
      loadRisks();
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  const flatUnits = lookups ? flattenTree(lookups.orgUnits) : [];

  // Apply filters — hierarchical org filtering
  const filterOrgIds = useMemo(() => {
    if (!filterOrg) return null;
    return new Set(collectDescendantIds(orgTree, Number(filterOrg)));
  }, [filterOrg, orgTree]);

  const filtered = risks.filter(r => {
    if (filterOrgIds && !filterOrgIds.has(r.org_unit_id)) return false;
    if (filterLevel && r.risk_level !== filterLevel) return false;
    if (filterStatus && r.status_name !== filterStatus) return false;
    return true;
  }).sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));

  const flatFilterUnits = flattenTree(orgTree);
  const uniqueOrgs = flatFilterUnits.map(u => ({ id: u.id, name: u.name, depth: u.depth }));
  const uniqueStatuses = [...new Set(risks.map(r => r.status_name).filter(Boolean))] as string[];

  const clearFilters = () => {
    setFilterOrg(""); setFilterStatus(""); setFilterLevel("");
    setSearchParams({});
  };
  const hasFilters = filterOrg || filterStatus || filterLevel;

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 220 }} value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
            <option value="">Wszystkie piony</option>
            {uniqueOrgs.map(o => <option key={o.id} value={o.id}>{"  ".repeat(o.depth)}{o.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Wszystkie statusy</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-control" style={{ width: 140 }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
            <option value="">Poziom ryzyka</option>
            <option value="high">Wysokie</option>
            <option value="medium">Średnie</option>
            <option value="low">Niskie</option>
          </select>
          {hasFilters && (
            <button className="btn btn-sm" onClick={clearFilters}>Wyczyść filtry</button>
          )}
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} / {risks.length}</span>
          <button className="btn btn-primary btn-sm" onClick={openAddForm}>+ Dodaj ryzyko</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie ryzyk...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {risks.length === 0 ? "Brak ryzyk w systemie." : "Brak ryzyk pasujących do filtrów."}
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>ID</th><th>Aktywo</th><th>Pion</th><th>Obszar</th><th>W</th><th>P</th><th>Z</th><th>Ocena (R)</th><th>Status</th><th>Właściciel</th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}
                    style={{ borderLeft: `3px solid ${riskColor(r.risk_score ?? 0)}`, cursor: "pointer", background: selected?.id === r.id ? "var(--bg-card-hover)" : undefined }}
                    onClick={() => setSelected(selected?.id === r.id ? null : r)}
                  >
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{r.code || r.id}</td>
                    <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                    <td style={{ fontSize: 11 }}>{orgPathMap.get(r.org_unit_id) ?? r.org_unit_name}</td>
                    <td>{r.security_area_name}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.impact_level}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.probability_level}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.safeguard_rating}</td>
                    <td>
                      <span className="score-badge" style={{ background: riskBg(r.risk_score ?? 0), color: riskColor(r.risk_score ?? 0) }}>
                        {(r.risk_score ?? 0).toFixed(1)} {riskLabel(r.risk_score ?? 0)}
                      </span>
                    </td>
                    <td><span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{r.status_name ?? "—"}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.owner ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegóły Ryzyka</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: riskColor(selected.risk_score ?? 0) }}>
                {(selected.risk_score ?? 0).toFixed(1)}
              </div>
              <span className="score-badge" style={{ background: riskBg(selected.risk_score ?? 0), color: riskColor(selected.risk_score ?? 0), fontSize: 13, padding: "4px 12px" }}>
                {riskLabel(selected.risk_score ?? 0)}
              </span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                R = EXP({selected.impact_level}) &times; {selected.probability_level} / {selected.safeguard_rating}
              </div>
            </div>

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>ID</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.code || `R-${selected.id}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Aktywo</span>
                <span style={{ fontWeight: 500 }}>{selected.asset_name}</span>
              </div>
              {selected.asset_id_name && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Z rejestru</span>
                  <span style={{ color: "var(--cyan)" }}>{selected.asset_id_name}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Pion</span>
                <span style={{ fontSize: 11 }}>{orgPathMap.get(selected.org_unit_id) ?? selected.org_unit_name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Obszar</span>
                <span>{selected.security_area_name ?? "—"}</span>
              </div>
              {selected.threat_name && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Zagrożenie</span>
                  <span>{selected.threat_name}</span>
                </div>
              )}
              {selected.vulnerability_name && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Podatność</span>
                  <span>{selected.vulnerability_name}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Strategia</span>
                <span>{selected.strategy_name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Właściciel</span>
                <span>{selected.owner ?? "—"}</span>
              </div>
              {selected.residual_risk != null && (
                <div style={{ marginTop: 4, padding: 8, background: riskBg(selected.residual_risk), borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Ryzyko rezydualne</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: riskColor(selected.residual_risk) }}>{selected.residual_risk.toFixed(1)}</span>
                  </div>
                  {selected.target_impact != null && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      Docelowe: W={selected.target_impact} P={selected.target_probability} Z={selected.target_safeguard}
                      {selected.risk_score > 0 && (
                        <span style={{ marginLeft: 6, color: "var(--green)" }}>
                          (-{((1 - selected.residual_risk / selected.risk_score) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Zidentyfikowano</span>
                <span>{selected.identified_at?.slice(0, 10) ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Ostatni przegląd</span>
                <span>{selected.last_review_at?.slice(0, 10) ?? "Nigdy"}</span>
              </div>
              {selected.planned_actions && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Planowane działania</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.planned_actions}
                  </div>
                </div>
              )}
              {selected.safeguards && selected.safeguards.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Zabezpieczenia</div>
                  <div className="tag-list">
                    {selected.safeguards.map(s => (
                      <span key={s.safeguard_id} className="tag">{s.safeguard_name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid rgba(42,53,84,0.25)", paddingTop: 12 }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => openEditForm(selected)}>Edytuj</button>
              <button className="btn btn-sm" style={{ flex: 1, color: "var(--red)" }} onClick={() => handleCloseRisk(selected)}>Zamknij</button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditRisk(null); }} title={editRisk ? `Edytuj ryzyko: ${editRisk.code || editRisk.id}` : "Dodaj ryzyko"} wide>
        {lookups ? (
          <RiskForm editRisk={editRisk} lookups={lookups} flatUnits={flatUnits} saving={saving} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setEditRisk(null); }} />
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ładowanie danych formularza...</div>
        )}
      </Modal>
    </div>
  );
}

/* Live Risk Score Calculator Form */
function RiskForm({ editRisk, lookups, flatUnits, saving, onSubmit, onCancel }: {
  editRisk: Risk | null; lookups: FormLookups;
  flatUnits: { id: number; name: string; depth: number }[];
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [W, setW] = useState(editRisk?.impact_level ?? 2);
  const [P, setP] = useState(editRisk?.probability_level ?? 2);
  const [Z, setZ] = useState(editRisk?.safeguard_rating ?? 0.25);

  // Target (residual) components
  const [tW, setTW] = useState(editRisk?.target_impact ?? editRisk?.impact_level ?? 1);
  const [tP, setTP] = useState(editRisk?.target_probability ?? editRisk?.probability_level ?? 1);
  const [tZ, setTZ] = useState(editRisk?.target_safeguard ?? 0.95);

  const liveScore = Math.exp(W) * P / Z;
  const liveLabel = liveScore >= 221 ? "Wysokie" : liveScore >= 31 ? "Średnie" : "Niskie";
  const lvColor = liveScore >= 221 ? "var(--red)" : liveScore >= 31 ? "var(--orange)" : "var(--green)";
  const lvBg = liveScore >= 221 ? "var(--red-dim)" : liveScore >= 31 ? "var(--orange-dim)" : "var(--green-dim)";

  // Residual risk from target components
  const residualScore = Math.exp(tW) * tP / tZ;
  const resLabel = residualScore >= 221 ? "Wysokie" : residualScore >= 31 ? "Średnie" : "Niskie";
  const resColor = residualScore >= 221 ? "var(--red)" : residualScore >= 31 ? "var(--orange)" : "var(--green)";
  const resBg = residualScore >= 221 ? "var(--red-dim)" : residualScore >= 31 ? "var(--orange-dim)" : "var(--green-dim)";
  const reduction = liveScore > 0 ? ((1 - residualScore / liveScore) * 100) : 0;

  return (
    <form onSubmit={onSubmit}>
      {/* Live Score Preview */}
      <div style={{ background: lvBg, border: `1px solid ${lvColor}`, borderRadius: 10, padding: "12px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: lvColor, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Kalkulacja na bieżąco</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            R = EXP({W}) &times; {P} / {Z} = <strong style={{ color: lvColor }}>{liveScore.toFixed(1)}</strong>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: lvColor }}>{liveScore.toFixed(1)}</div>
          <span className="score-badge" style={{ background: `${lvColor}30`, color: lvColor, fontSize: 12 }}>{liveLabel}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Jednostka organizacyjna *</label>
          <select name="org_unit_id" className="form-control" required defaultValue={editRisk?.org_unit_id ?? ""}>
            <option value="">Wybierz...</option>
            {flatUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Powiązany aktyw (z rejestru)</label>
          <select name="asset_id" className="form-control" defaultValue={editRisk?.asset_id ?? ""}>
            <option value="">Brak powiązania</option>
            {lookups.assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.org_unit_name ? ` (${a.org_unit_name})` : ""}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Kategoria aktywa</label>
          <select name="asset_category_id" className="form-control" defaultValue={editRisk?.asset_category_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Nazwa aktywa *</label>
          <input name="asset_name" className="form-control" required defaultValue={editRisk?.asset_name ?? ""} placeholder="np. Laptopy konsultantów" />
        </div>
              <div className="form-group"><label>Wrażliwość</label>
                <select name="sensitivity_id" className="form-control" defaultValue={editRisk?.sensitivity_id ?? ""}><option value="">Wybierz...</option>{lookups.sensitivities.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              </div>
              <div className="form-group"><label>Krytyczność</label>
                <select name="criticality_id" className="form-control" defaultValue={editRisk?.criticality_id ?? ""}><option value="">Wybierz...</option>{lookups.criticalities.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              </div>
              <div className="form-group"><label>Obszar raportowania</label>
                <select name="security_area_id" className="form-control" defaultValue={editRisk?.security_area_id ?? ""}><option value="">Wybierz...</option>{lookups.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </div>
              <div className="form-group"><label>Zagrożenie</label>
                <select name="threat_id" className="form-control" defaultValue={editRisk?.threat_id ?? ""}><option value="">Wybierz...</option>{lookups.threats.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
              <div className="form-group"><label>Podatność</label>
                <select name="vulnerability_id" className="form-control" defaultValue={editRisk?.vulnerability_id ?? ""}><option value="">Wybierz...</option>{lookups.vulns.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              </div>
              <div className="form-group"><label>Wpływ (W) *</label>
                <select name="impact_level" className="form-control" required value={W} onChange={e => setW(Number(e.target.value))}>
                  <option value="1">1 — Niski</option><option value="2">2 — Średni</option><option value="3">3 — Wysoki</option>
                </select>
              </div>
              <div className="form-group"><label>Prawdopodobieństwo (P) *</label>
                <select name="probability_level" className="form-control" required value={P} onChange={e => setP(Number(e.target.value))}>
                  <option value="1">1 — Niskie</option><option value="2">2 — Średnie</option><option value="3">3 — Wysokie</option>
                </select>
              </div>
              <div className="form-group"><label>Ocena zabezpieczeń (Z) *</label>
                <select name="safeguard_rating" className="form-control" required value={Z} onChange={e => setZ(Number(e.target.value))}>
                  <option value="0.10">0,10 — Brak zabezpieczeń</option>
                  <option value="0.25">0,25 — Częściowe</option>
                  <option value="0.70">0,70 — Dobra jakość</option>
                  <option value="0.95">0,95 — Skuteczne, testowane</option>
                </select>
              </div>
              <div className="form-group"><label>Strategia</label>
                <select name="strategy_id" className="form-control" defaultValue={editRisk?.strategy_id ?? ""}><option value="">Wybierz...</option>{lookups.strategies.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              </div>
              <div className="form-group"><label>Właściciel ryzyka</label><input name="owner" className="form-control" defaultValue={editRisk?.owner ?? ""} placeholder="np. Jan Kowalski" /></div>
              <div className="form-group"><label>Status</label>
                <select name="status_id" className="form-control" defaultValue={editRisk?.status_id ?? ""}><option value="">Wybierz...</option>{lookups.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              </div>
              <div className="form-group">
                <label>Zabezpieczenia</label>
                <select name="safeguard_ids" className="form-control" multiple style={{ height: 80 }}
                  defaultValue={editRisk?.safeguards?.map(s => String(s.safeguard_id)) ?? []}>
                  {lookups.safeguards.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Ctrl+klik aby wybrać wiele</span>
              </div>
            </div>
            {/* Residual Risk — Target Components */}
            <div style={{ background: resBg, border: `1px solid ${resColor}`, borderRadius: 10, padding: "12px 20px", marginTop: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: resColor, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Ryzyko rezydualne (docelowe)</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    R<sub>res</sub> = EXP({tW}) &times; {tP} / {tZ} = <strong style={{ color: resColor }}>{residualScore.toFixed(1)}</strong>
                    {reduction > 0 && <span style={{ marginLeft: 8, color: "var(--green)" }}>(-{reduction.toFixed(0)}%)</span>}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: resColor }}>{residualScore.toFixed(1)}</div>
                  <span className="score-badge" style={{ background: `${resColor}30`, color: resColor, fontSize: 11 }}>{resLabel}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Docelowy W</label>
                  <select name="target_impact" className="form-control" value={tW} onChange={e => setTW(Number(e.target.value))}>
                    <option value="1">1 — Niski</option><option value="2">2 — Sredni</option><option value="3">3 — Wysoki</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Docelowe P</label>
                  <select name="target_probability" className="form-control" value={tP} onChange={e => setTP(Number(e.target.value))}>
                    <option value="1">1 — Niskie</option><option value="2">2 — Srednie</option><option value="3">3 — Wysokie</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Docelowe Z</label>
                  <select name="target_safeguard" className="form-control" value={tZ} onChange={e => setTZ(Number(e.target.value))}>
                    <option value="0.10">0,10 — Brak</option>
                    <option value="0.25">0,25 — Czesciowe</option>
                    <option value="0.70">0,70 — Dobre</option>
                    <option value="0.95">0,95 — Skuteczne</option>
                  </select>
                </div>
              </div>
            </div>
            <input type="hidden" name="residual_risk" value={residualScore.toFixed(2)} />
            <div className="form-group"><label>Planowane dzialania</label><textarea name="planned_actions" className="form-control" defaultValue={editRisk?.planned_actions ?? ""} placeholder="Opisz planowane kroki mitygacyjne..." /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn" onClick={onCancel}>Anuluj</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Zapisywanie..." : editRisk ? "Zapisz zmiany" : "Zapisz ryzyko"}</button>
            </div>
          </form>
        );
}
