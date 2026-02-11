import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import type { Risk, Asset, OrgUnitTreeNode, SecurityArea, Threat, Vulnerability, Safeguard, DictionaryTypeWithEntries, Action } from "../types";
import { flattenTree, buildPathMap, collectDescendantIds } from "../utils/orgTree";
import Modal from "../components/Modal";

/* ─── Risk score helpers ─── */
function riskColor(R: number) { return R >= 221 ? "var(--red)" : R >= 31 ? "var(--orange)" : "var(--green)"; }
function riskBg(R: number) { return R >= 221 ? "var(--red-dim)" : R >= 31 ? "var(--orange-dim)" : "var(--green-dim)"; }
function riskLabel(R: number) { return R >= 221 ? "Wysokie" : R >= 31 ? "Srednie" : "Niskie"; }

/* ─── Section header component ─── */
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

/* ─── Detail panel row ─── */
function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "\u2014"}</span>
    </div>
  );
}

/* ─── Lookups interface ─── */
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
  risk_categories: { id: number; label: string }[];
  control_effectivenesses: { id: number; label: string }[];
}

/* ═══════════════════════════════════════════════════════════════════
   RisksPage — main page component
   ═══════════════════════════════════════════════════════════════════ */
export default function RisksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRisk, setEditRisk] = useState<Risk | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [selected, setSelected] = useState<Risk | null>(null);
  const [accepting, setAccepting] = useState(false);

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
      api.get<SecurityArea[]>("/api/v1/domains").catch(() => [] as SecurityArea[]),
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
    const [categories, sensitivities, criticalities, statuses, strategies, risk_categories, control_effectivenesses] = await Promise.all([
      dictEntries("asset_category"),
      dictEntries("sensitivity"),
      dictEntries("criticality"),
      dictEntries("risk_status"),
      dictEntries("risk_strategy"),
      dictEntries("risk_category"),
      dictEntries("control_effectiveness"),
    ]);
    const result: FormLookups = {
      orgUnits, areas, threats, vulns, safeguards, assets,
      categories, sensitivities, criticalities, statuses, strategies,
      risk_categories, control_effectivenesses,
    };
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
      // Sekcja 1: Kontekst
      org_unit_id: Number(fd.get("org_unit_id")),
      risk_category_id: fd.get("risk_category_id") ? Number(fd.get("risk_category_id")) : null,
      risk_source: (fd.get("risk_source") as string) || null,
      // Sekcja 2: Identyfikacja aktywa
      asset_id: fd.get("asset_id") ? Number(fd.get("asset_id")) : null,
      asset_name: fd.get("asset_name") as string,
      asset_category_id: fd.get("asset_category_id") ? Number(fd.get("asset_category_id")) : null,
      sensitivity_id: fd.get("sensitivity_id") ? Number(fd.get("sensitivity_id")) : null,
      criticality_id: fd.get("criticality_id") ? Number(fd.get("criticality_id")) : null,
      // Sekcja 3: Scenariusz ryzyka
      security_area_id: fd.get("security_area_id") ? Number(fd.get("security_area_id")) : null,
      threat_id: fd.get("threat_id") ? Number(fd.get("threat_id")) : null,
      vulnerability_id: fd.get("vulnerability_id") ? Number(fd.get("vulnerability_id")) : null,
      existing_controls: (fd.get("existing_controls") as string) || null,
      control_effectiveness_id: fd.get("control_effectiveness_id") ? Number(fd.get("control_effectiveness_id")) : null,
      consequence_description: (fd.get("consequence_description") as string) || null,
      // Sekcja 4: Analiza ryzyka
      impact_level: Number(fd.get("impact_level")),
      probability_level: Number(fd.get("probability_level")),
      safeguard_rating: Number(fd.get("safeguard_rating")),
      // Sekcja 5: Postepowanie z ryzykiem
      strategy_id: fd.get("strategy_id") ? Number(fd.get("strategy_id")) : null,
      treatment_plan: (fd.get("treatment_plan") as string) || null,
      treatment_deadline: (fd.get("treatment_deadline") as string) || null,
      treatment_resources: (fd.get("treatment_resources") as string) || null,
      safeguard_ids: Array.from(fd.getAll("safeguard_ids")).map(Number).filter(Boolean),
      target_impact: fd.get("target_impact") ? Number(fd.get("target_impact")) : null,
      target_probability: fd.get("target_probability") ? Number(fd.get("target_probability")) : null,
      target_safeguard: fd.get("target_safeguard") ? Number(fd.get("target_safeguard")) : null,
      residual_risk: fd.get("residual_risk") ? Number(fd.get("residual_risk")) : null,
      // Sekcja 6: Akceptacja i monitorowanie
      status_id: fd.get("status_id") ? Number(fd.get("status_id")) : null,
      owner: (fd.get("owner") as string) || null,
      accepted_by: (fd.get("accepted_by") as string) || null,
      acceptance_justification: (fd.get("acceptance_justification") as string) || null,
      next_review_date: (fd.get("next_review_date") as string) || null,
      planned_actions: (fd.get("planned_actions") as string) || null,
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
      alert("Blad zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRisk = async (risk: Risk) => {
    if (!confirm(`Zamknac ryzyko ${risk.code || risk.id}? Status zostanie zmieniony na "Zamkniete".`)) return;
    try {
      await api.delete(`/api/v1/risks/${risk.id}`);
      setSelected(null);
      setLoading(true);
      loadRisks();
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  const handleAcceptRisk = async (risk: Risk) => {
    const name = prompt("Kto akceptuje ryzyko? (imie i nazwisko)");
    if (!name) return;
    setAccepting(true);
    try {
      const updated = await api.post<Risk>(`/api/v1/risks/${risk.id}/accept`, {
        accepted_by: name,
      });
      setSelected(updated);
      setLoading(true);
      loadRisks();
    } catch (err) {
      alert("Blad akceptacji: " + err);
    } finally {
      setAccepting(false);
    }
  };

  const flatUnits = lookups ? flattenTree(lookups.orgUnits) : [];

  // Apply filters -- hierarchical org filtering
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

  // Helper: is a date overdue (past today)?
  const isOverdue = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div>
      {/* ─── Toolbar ─── */}
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
            <option value="medium">Srednie</option>
            <option value="low">Niskie</option>
          </select>
          {hasFilters && (
            <button className="btn btn-sm" onClick={clearFilters}>Wyczysc filtry</button>
          )}
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} / {risks.length}</span>
          <button className="btn btn-primary btn-sm" onClick={openAddForm}>+ Dodaj ryzyko</button>
        </div>
      </div>

      {/* ─── Main grid: table + detail panel ─── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>

        {/* ─── Risk Table ─── */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ladowanie ryzyk...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {risks.length === 0 ? "Brak ryzyk w systemie." : "Brak ryzyk pasujacych do filtrow."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Aktywo</th>
                  <th>Pion</th>
                  <th>Kategoria</th>
                  <th>Domena</th>
                  <th>W</th>
                  <th>P</th>
                  <th>Z</th>
                  <th>Ocena (R)</th>
                  <th>Status</th>
                  <th>Wlasciciel</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}
                    style={{
                      borderLeft: `3px solid ${riskColor(r.risk_score ?? 0)}`,
                      cursor: "pointer",
                      background: selected?.id === r.id ? "var(--bg-card-hover)" : undefined,
                    }}
                    onClick={() => setSelected(selected?.id === r.id ? null : r)}
                  >
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{r.code || r.id}</td>
                    <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                    <td style={{ fontSize: 11 }}>{orgPathMap.get(r.org_unit_id) ?? r.org_unit_name}</td>
                    <td style={{ fontSize: 11 }}>{r.risk_category_name ?? "\u2014"}</td>
                    <td>{r.security_area_name}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.impact_level}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.probability_level}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.safeguard_rating}</td>
                    <td>
                      <span className="score-badge" style={{ background: riskBg(r.risk_score ?? 0), color: riskColor(r.risk_score ?? 0) }}>
                        {(r.risk_score ?? 0).toFixed(1)} {riskLabel(r.risk_score ?? 0)}
                      </span>
                    </td>
                    <td><span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{r.status_name ?? "\u2014"}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.owner ?? "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Detail Panel ─── */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly Ryzyka</div>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
            </div>

            {/* Score display */}
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
              {/* --- Sekcja 1: Kontekst --- */}
              <SectionHeader number="\u2460" label="Kontekst" />
              <DetailRow label="ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selected.code || `R-${selected.id}`}</span>} />
              <DetailRow label="Pion" value={<span style={{ fontSize: 11 }}>{orgPathMap.get(selected.org_unit_id) ?? selected.org_unit_name}</span>} />
              <DetailRow label="Kategoria ryzyka" value={selected.risk_category_name} />
              {selected.risk_source && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Zrodlo ryzyka</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.risk_source}
                  </div>
                </div>
              )}

              {/* --- Sekcja 2: Identyfikacja aktywa --- */}
              <SectionHeader number="\u2461" label="Identyfikacja aktywa" />
              <DetailRow label="Aktywo" value={<span style={{ fontWeight: 500 }}>{selected.asset_name}</span>} />
              {selected.asset_id_name && (
                <DetailRow label="Z rejestru" value={<span style={{ color: "var(--cyan)" }}>{selected.asset_id_name}</span>} />
              )}
              <DetailRow label="Kategoria aktywa" value={selected.asset_category_name} />
              <DetailRow label="Wrazliwosc" value={selected.sensitivity_name} />
              <DetailRow label="Krytycznosc" value={selected.criticality_name} />

              {/* --- Sekcja 3: Scenariusz ryzyka --- */}
              <SectionHeader number="\u2462" label="Scenariusz ryzyka" />
              <DetailRow label="Domena" value={selected.security_area_name} />
              <DetailRow label="Zagrozenie" value={selected.threat_name} />
              <DetailRow label="Podatnosc" value={selected.vulnerability_name} />
              {selected.existing_controls && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Istniejace zabezpieczenia</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.existing_controls}
                  </div>
                </div>
              )}
              <DetailRow label="Skutecznosc kontroli" value={selected.control_effectiveness_name} />
              {selected.consequence_description && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Opis konsekwencji</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.consequence_description}
                  </div>
                </div>
              )}

              {/* --- Sekcja 4: Analiza ryzyka --- */}
              <SectionHeader number="\u2463" label="Analiza ryzyka" />
              <DetailRow label="Wplyw (W)" value={selected.impact_level} />
              <DetailRow label="Prawdopodobienstwo (P)" value={selected.probability_level} />
              <DetailRow label="Zabezpieczenia (Z)" value={selected.safeguard_rating} />
              <DetailRow label="Ocena (R)" value={
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: riskColor(selected.risk_score ?? 0) }}>
                  {(selected.risk_score ?? 0).toFixed(1)}
                </span>
              } />

              {/* --- Sekcja 5: Postepowanie z ryzykiem --- */}
              <SectionHeader number="\u2464" label="Postepowanie z ryzykiem" />
              <DetailRow label="Strategia" value={selected.strategy_name} />
              {selected.treatment_plan && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Plan postepowania</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.treatment_plan}
                  </div>
                </div>
              )}
              <DetailRow label="Termin realizacji" value={
                selected.treatment_deadline ? (
                  <span style={{ color: isOverdue(selected.treatment_deadline) ? "var(--red)" : undefined }}>
                    {selected.treatment_deadline.slice(0, 10)}
                    {isOverdue(selected.treatment_deadline) && " (po terminie!)"}
                  </span>
                ) : "\u2014"
              } />
              {selected.treatment_resources && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Zasoby</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.treatment_resources}
                  </div>
                </div>
              )}
              {selected.safeguards && selected.safeguards.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Zabezpieczenia</div>
                  <div className="tag-list">
                    {selected.safeguards.map(s => (
                      <span key={s.safeguard_id} className="tag">{s.safeguard_name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Residual risk block */}
              {selected.residual_risk != null && (
                <div style={{ marginTop: 8, padding: 8, background: riskBg(selected.residual_risk), borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Ryzyko rezydualne</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: riskColor(selected.residual_risk) }}>
                      {selected.residual_risk.toFixed(1)}
                    </span>
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

              {/* --- Sekcja 6: Akceptacja i monitorowanie --- */}
              <SectionHeader number="\u2465" label="Akceptacja i monitorowanie" />
              <DetailRow label="Status" value={
                selected.status_name ? (
                  <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{selected.status_name}</span>
                ) : "\u2014"
              } />
              <DetailRow label="Wlasciciel" value={selected.owner} />

              {/* Acceptance display */}
              {selected.accepted_by ? (
                <div style={{ marginTop: 4, padding: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span className="score-badge" style={{ background: "rgba(34,197,94,0.15)", color: "var(--green)", fontSize: 11 }}>Zaakceptowane</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Przez: <strong>{selected.accepted_by}</strong>
                    {selected.accepted_at && <span> ({selected.accepted_at.slice(0, 10)})</span>}
                  </div>
                  {selected.acceptance_justification && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      Uzasadnienie: {selected.acceptance_justification}
                    </div>
                  )}
                </div>
              ) : (
                <DetailRow label="Akceptacja" value={<span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Nie zaakceptowano</span>} />
              )}

              <DetailRow label="Nastepny przeglad" value={
                selected.next_review_date ? (
                  <span style={{ color: isOverdue(selected.next_review_date) ? "var(--red)" : undefined, fontWeight: isOverdue(selected.next_review_date) ? 600 : undefined }}>
                    {selected.next_review_date.slice(0, 10)}
                    {isOverdue(selected.next_review_date) && " (zalegly!)"}
                  </span>
                ) : "\u2014"
              } />
              <DetailRow label="Zidentyfikowano" value={selected.identified_at?.slice(0, 10)} />
              <DetailRow label="Ostatni przeglad" value={selected.last_review_at?.slice(0, 10) ?? "Nigdy"} />

              {selected.planned_actions && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Planowane dzialania</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.planned_actions}
                  </div>
                </div>
              )}

              {/* --- Powiazane dzialania --- */}
              {selected.linked_actions && selected.linked_actions.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <SectionHeader number="" label="Powiazane dzialania" />
                  {selected.linked_actions.map(a => (
                    <div key={a.action_id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 8px", borderRadius: 6, marginBottom: 4,
                      background: a.is_overdue ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)",
                      border: a.is_overdue ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(42,53,84,0.15)",
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{a.title}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {a.owner && <span>{a.owner}</span>}
                          {a.due_date && <span> | {a.due_date.slice(0, 10)}{a.is_overdue && " (po terminie!)"}</span>}
                        </div>
                      </div>
                      {a.status_name && (
                        <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)", fontSize: 10 }}>
                          {a.status_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid rgba(42,53,84,0.25)", paddingTop: 12, flexWrap: "wrap" }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => openEditForm(selected)}>Edytuj</button>
              {!selected.accepted_by && (
                <button
                  className="btn btn-sm"
                  style={{ flex: 1, color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" }}
                  onClick={() => handleAcceptRisk(selected)}
                  disabled={accepting}
                >
                  {accepting ? "Akceptowanie..." : "Akceptuj"}
                </button>
              )}
              <button className="btn btn-sm" style={{ flex: 1, color: "var(--red)" }} onClick={() => handleCloseRisk(selected)}>Zamknij</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Add / Edit Form Modal ─── */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditRisk(null); }} title={editRisk ? `Edytuj ryzyko: ${editRisk.code || editRisk.id}` : "Dodaj ryzyko"} wide>
        {lookups ? (
          <RiskForm editRisk={editRisk} lookups={lookups} flatUnits={flatUnits} saving={saving} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setEditRisk(null); }} />
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie danych formularza...</div>
        )}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ActionSearch — searchable action picker for linking to risks
   ═══════════════════════════════════════════════════════════════════ */
function ActionSearch({ riskId, existingLinks }: { riskId: number | null; existingLinks: { action_id: number; title: string }[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Action[]>([]);
  const [searching, setSearching] = useState(false);
  const [linked, setLinked] = useState<{ action_id: number; title: string }[]>(existingLinks);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      setSearching(true);
      api.get<Action[]>("/api/v1/actions")
        .then(all => {
          const q = query.toLowerCase();
          setResults(all.filter(a =>
            a.title.toLowerCase().includes(q) ||
            (a.owner ?? "").toLowerCase().includes(q) ||
            (a.description ?? "").toLowerCase().includes(q)
          ).slice(0, 10));
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const linkAction = async (action: Action) => {
    if (!riskId) return;
    if (linked.some(l => l.action_id === action.id)) return;
    try {
      // Get the action, update its links to include this risk
      const full = await api.get<Action>(`/api/v1/actions/${action.id}`);
      const existingEntityLinks = full.links.map(l => ({ entity_type: l.entity_type, entity_id: l.entity_id }));
      existingEntityLinks.push({ entity_type: "risk", entity_id: riskId });
      await api.put(`/api/v1/actions/${action.id}`, { links: existingEntityLinks });
      setLinked([...linked, { action_id: action.id, title: action.title }]);
      setQuery("");
      setResults([]);
    } catch (err) {
      alert("Blad wiazania: " + err);
    }
  };

  const unlinkAction = async (actionId: number) => {
    if (!riskId) return;
    try {
      const full = await api.get<Action>(`/api/v1/actions/${actionId}`);
      const updatedLinks = full.links
        .filter(l => !(l.entity_type === "risk" && l.entity_id === riskId))
        .map(l => ({ entity_type: l.entity_type, entity_id: l.entity_id }));
      await api.put(`/api/v1/actions/${actionId}`, { links: updatedLinks });
      setLinked(linked.filter(l => l.action_id !== actionId));
    } catch (err) {
      alert("Blad odlaczania: " + err);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
        Powiazane dzialania ({linked.length})
      </label>
      {linked.map(l => (
        <div key={l.action_id} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "4px 8px", background: "rgba(59,130,246,0.06)", borderRadius: 4, marginBottom: 4,
          fontSize: 12,
        }}>
          <span>{l.title}</span>
          <button type="button" className="btn btn-sm" style={{ padding: "0 6px", fontSize: 10, color: "var(--red)" }}
            onClick={() => unlinkAction(l.action_id)}>&#10005;</button>
        </div>
      ))}
      {riskId && (
        <div style={{ position: "relative" }}>
          <input
            className="form-control"
            style={{ fontSize: 12 }}
            placeholder="Szukaj dzialania po tytule, wlascicielu..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searching && <span style={{ position: "absolute", right: 8, top: 8, fontSize: 10, color: "var(--text-muted)" }}>...</span>}
          {results.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
              maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}>
              {results.map(a => (
                <div key={a.id} style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 12,
                  borderBottom: "1px solid rgba(42,53,84,0.15)",
                  opacity: linked.some(l => l.action_id === a.id) ? 0.4 : 1,
                }}
                  onClick={() => linkAction(a)}
                >
                  <div style={{ fontWeight: 500 }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {a.owner && <span>{a.owner}</span>}
                    {a.status_name && <span> | {a.status_name}</span>}
                    {a.due_date && <span> | {a.due_date.slice(0, 10)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!riskId && (
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Zapisz ryzyko najpierw, aby moc wiazac dzialania</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RiskForm — structured form with live calculators
   ═══════════════════════════════════════════════════════════════════ */
function RiskForm({ editRisk, lookups, flatUnits, saving, onSubmit, onCancel }: {
  editRisk: Risk | null;
  lookups: FormLookups;
  flatUnits: { id: number; name: string; depth: number }[];
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  // Live risk calculator state
  const [W, setW] = useState(editRisk?.impact_level ?? 2);
  const [P, setP] = useState(editRisk?.probability_level ?? 2);
  const [Z, setZ] = useState(editRisk?.safeguard_rating ?? 0.25);

  // Target (residual) components
  const [tW, setTW] = useState(editRisk?.target_impact ?? editRisk?.impact_level ?? 1);
  const [tP, setTP] = useState(editRisk?.target_probability ?? editRisk?.probability_level ?? 1);
  const [tZ, setTZ] = useState(editRisk?.target_safeguard ?? 0.95);

  // Live score calculations
  const liveScore = Math.exp(W) * P / Z;
  const liveLabel = liveScore >= 221 ? "Wysokie" : liveScore >= 31 ? "Srednie" : "Niskie";
  const lvColor = liveScore >= 221 ? "var(--red)" : liveScore >= 31 ? "var(--orange)" : "var(--green)";
  const lvBg = liveScore >= 221 ? "var(--red-dim)" : liveScore >= 31 ? "var(--orange-dim)" : "var(--green-dim)";

  // Residual risk from target components
  const residualScore = Math.exp(tW) * tP / tZ;
  const resLabel = residualScore >= 221 ? "Wysokie" : residualScore >= 31 ? "Srednie" : "Niskie";
  const resColor = residualScore >= 221 ? "var(--red)" : residualScore >= 31 ? "var(--orange)" : "var(--green)";
  const resBg = residualScore >= 221 ? "var(--red-dim)" : residualScore >= 31 ? "var(--orange-dim)" : "var(--green-dim)";
  const reduction = liveScore > 0 ? ((1 - residualScore / liveScore) * 100) : 0;

  return (
    <form onSubmit={onSubmit}>
      {/* ─── Live Score Preview ─── */}
      <div style={{
        background: lvBg, border: `1px solid ${lvColor}`, borderRadius: 10,
        padding: "12px 20px", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 11, color: lvColor, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Kalkulacja na biezaco</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            R = EXP({W}) &times; {P} / {Z} = <strong style={{ color: lvColor }}>{liveScore.toFixed(1)}</strong>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: lvColor }}>{liveScore.toFixed(1)}</div>
          <span className="score-badge" style={{ background: `${lvColor}30`, color: lvColor, fontSize: 12 }}>{liveLabel}</span>
        </div>
      </div>

      {/* ═══ Sekcja 1: Kontekst (ISO 31000 §5.3) ═══ */}
      <SectionHeader number={"\u2460"} label="Kontekst" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Jednostka organizacyjna *</label>
          <select name="org_unit_id" className="form-control" required defaultValue={editRisk?.org_unit_id ?? ""}>
            <option value="">Wybierz...</option>
            {flatUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Kategoria ryzyka</label>
          <select name="risk_category_id" className="form-control" defaultValue={editRisk?.risk_category_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.risk_categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Zrodlo ryzyka</label>
          <textarea name="risk_source" className="form-control" rows={2} defaultValue={editRisk?.risk_source ?? ""} placeholder="Opisz zrodlo lub kontekst ryzyka..." />
        </div>
      </div>

      {/* ═══ Sekcja 2: Identyfikacja aktywa (ISO 27005 §8.2) ═══ */}
      <SectionHeader number={"\u2461"} label="Identyfikacja aktywa" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Powiazany aktyw (z rejestru)</label>
          <select name="asset_id" className="form-control" defaultValue={editRisk?.asset_id ?? ""}>
            <option value="">Brak powiazania</option>
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
          <input name="asset_name" className="form-control" required defaultValue={editRisk?.asset_name ?? ""} placeholder="np. Laptopy konsultantow" />
        </div>
        <div className="form-group">
          <label>Wrazliwosc</label>
          <select name="sensitivity_id" className="form-control" defaultValue={editRisk?.sensitivity_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.sensitivities.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Krytycznosc</label>
          <select name="criticality_id" className="form-control" defaultValue={editRisk?.criticality_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.criticalities.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* ═══ Sekcja 3: Scenariusz ryzyka ═══ */}
      <SectionHeader number={"\u2462"} label="Scenariusz ryzyka" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Domena bezpieczenstwa</label>
          <select name="security_area_id" className="form-control" defaultValue={editRisk?.security_area_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Zagrozenie</label>
          <select name="threat_id" className="form-control" defaultValue={editRisk?.threat_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.threats.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Podatnosc</label>
          <select name="vulnerability_id" className="form-control" defaultValue={editRisk?.vulnerability_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.vulns.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Skutecznosc istniejacych kontroli</label>
          <select name="control_effectiveness_id" className="form-control" defaultValue={editRisk?.control_effectiveness_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.control_effectivenesses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Istniejace zabezpieczenia / kontrole</label>
          <textarea name="existing_controls" className="form-control" rows={2} defaultValue={editRisk?.existing_controls ?? ""} placeholder="Opisz istniejace kontrole i zabezpieczenia..." />
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Opis konsekwencji</label>
          <textarea name="consequence_description" className="form-control" rows={2} defaultValue={editRisk?.consequence_description ?? ""} placeholder="Opisz potencjalne konsekwencje materializacji ryzyka..." />
        </div>
      </div>

      {/* ═══ Sekcja 4: Analiza ryzyka (ISO 27005 §8.3) ═══ */}
      <SectionHeader number={"\u2463"} label="Analiza ryzyka" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Wplyw (W) *</label>
          <select name="impact_level" className="form-control" required value={W} onChange={e => setW(Number(e.target.value))}>
            <option value="1">1 -- Niski</option>
            <option value="2">2 -- Sredni</option>
            <option value="3">3 -- Wysoki</option>
          </select>
        </div>
        <div className="form-group">
          <label>Prawdopodobienstwo (P) *</label>
          <select name="probability_level" className="form-control" required value={P} onChange={e => setP(Number(e.target.value))}>
            <option value="1">1 -- Niskie</option>
            <option value="2">2 -- Srednie</option>
            <option value="3">3 -- Wysokie</option>
          </select>
        </div>
        <div className="form-group">
          <label>Ocena zabezpieczen (Z) *</label>
          <select name="safeguard_rating" className="form-control" required value={Z} onChange={e => setZ(Number(e.target.value))}>
            <option value="0.10">0,10 -- Brak zabezpieczen</option>
            <option value="0.25">0,25 -- Czesciowe</option>
            <option value="0.70">0,70 -- Dobra jakosc</option>
            <option value="0.95">0,95 -- Skuteczne, testowane</option>
          </select>
        </div>
      </div>

      {/* ═══ Sekcja 5: Postepowanie z ryzykiem (ISO 27005 §8.5) ═══ */}
      <SectionHeader number={"\u2464"} label="Postepowanie z ryzykiem" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Strategia</label>
          <select name="strategy_id" className="form-control" defaultValue={editRisk?.strategy_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.strategies.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Termin realizacji</label>
          <input name="treatment_deadline" type="date" className="form-control" defaultValue={editRisk?.treatment_deadline?.slice(0, 10) ?? ""} />
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Plan postepowania z ryzykiem</label>
          <textarea name="treatment_plan" className="form-control" rows={3} defaultValue={editRisk?.treatment_plan ?? ""} placeholder="Opisz plan postepowania z ryzykiem (redukcja, transfer, unikanie, akceptacja)..." />
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Zasoby wymagane</label>
          <textarea name="treatment_resources" className="form-control" rows={2} defaultValue={editRisk?.treatment_resources ?? ""} placeholder="Opisz wymagane zasoby (budzet, ludzie, narzedzia)..." />
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Zabezpieczenia</label>
          <select name="safeguard_ids" className="form-control" multiple style={{ height: 80 }}
            defaultValue={editRisk?.safeguards?.map(s => String(s.safeguard_id)) ?? []}>
            {lookups.safeguards.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Ctrl+klik aby wybrac wiele</span>
        </div>
      </div>

      {/* Action Search (only when editing) */}
      <ActionSearch
        riskId={editRisk?.id ?? null}
        existingLinks={(editRisk?.linked_actions ?? []).map(a => ({ action_id: a.action_id, title: a.title }))}
      />

      {/* Residual Risk -- Target Components */}
      <div style={{
        background: resBg, border: `1px solid ${resColor}`, borderRadius: 10,
        padding: "12px 20px", marginTop: 8, marginBottom: 8,
      }}>
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
              <option value="1">1 -- Niski</option>
              <option value="2">2 -- Sredni</option>
              <option value="3">3 -- Wysoki</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Docelowe P</label>
            <select name="target_probability" className="form-control" value={tP} onChange={e => setTP(Number(e.target.value))}>
              <option value="1">1 -- Niskie</option>
              <option value="2">2 -- Srednie</option>
              <option value="3">3 -- Wysokie</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Docelowe Z</label>
            <select name="target_safeguard" className="form-control" value={tZ} onChange={e => setTZ(Number(e.target.value))}>
              <option value="0.10">0,10 -- Brak</option>
              <option value="0.25">0,25 -- Czesciowe</option>
              <option value="0.70">0,70 -- Dobre</option>
              <option value="0.95">0,95 -- Skuteczne</option>
            </select>
          </div>
        </div>
      </div>
      <input type="hidden" name="residual_risk" value={residualScore.toFixed(2)} />

      {/* ═══ Sekcja 6: Akceptacja i monitorowanie (ISO 27005 §8.6/§9) ═══ */}
      <SectionHeader number={"\u2465"} label="Akceptacja i monitorowanie" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Status</label>
          <select name="status_id" className="form-control" defaultValue={editRisk?.status_id ?? ""}>
            <option value="">Wybierz...</option>
            {lookups.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Wlasciciel ryzyka</label>
          <input name="owner" className="form-control" defaultValue={editRisk?.owner ?? ""} placeholder="np. Jan Kowalski" />
        </div>
        <div className="form-group">
          <label>Zaakceptowane przez</label>
          <input name="accepted_by" className="form-control" defaultValue={editRisk?.accepted_by ?? ""} placeholder="Imie i nazwisko akceptujacego" />
        </div>
        <div className="form-group">
          <label>Data nastepnego przegladu</label>
          <input name="next_review_date" type="date" className="form-control" defaultValue={editRisk?.next_review_date?.slice(0, 10) ?? ""} />
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Uzasadnienie akceptacji</label>
          <textarea name="acceptance_justification" className="form-control" rows={2} defaultValue={editRisk?.acceptance_justification ?? ""} placeholder="Uzasadnienie akceptacji poziomu ryzyka..." />
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Planowane dzialania</label>
          <textarea name="planned_actions" className="form-control" rows={3} defaultValue={editRisk?.planned_actions ?? ""} placeholder="Opisz planowane kroki mitygacyjne i monitorujace..." />
        </div>
      </div>

      {/* Submit buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn" onClick={onCancel}>Anuluj</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Zapisywanie..." : editRisk ? "Zapisz zmiany" : "Zapisz ryzyko"}
        </button>
      </div>
    </form>
  );
}
