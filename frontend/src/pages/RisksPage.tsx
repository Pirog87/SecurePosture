import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import type { Risk, Asset, OrgUnitTreeNode, SecurityArea, Threat, Vulnerability, Safeguard, DictionaryTypeWithEntries, Action } from "../types";
import { flattenTree, buildPathMap } from "../utils/orgTree";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";
import Modal from "../components/Modal";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import StatsCards, { type StatCard } from "../components/StatsCards";

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
  identification_sources: { id: number; label: string }[];
  asset_types: { id: number; label: string }[];
}

/* ─── Sort types (removed — handled by useTableFeatures) ─── */

/* ═══════════════════════════════════════════════════════════════════
   RisksPage — main page component
   ═══════════════════════════════════════════════════════════════════ */
export default function RisksPage() {
  const [searchParams] = useSearchParams();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editRisk, setEditRisk] = useState<Risk | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [selected, setSelected] = useState<Risk | null>(null);
  const [accepting, setAccepting] = useState(false);

  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const loadRisks = () => {
    setError(null);
    api.get<Risk[]>("/api/v1/risks").then(data => {
      setRisks(data);
      const highlightId = searchParams.get("highlight");
      if (highlightId) {
        const found = data.find(r => r.id === Number(highlightId));
        if (found) setSelected(found);
      }
    }).catch((err) => {
      setError(String(err));
      console.error("loadRisks failed:", err);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRisks();
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
  }, []);

  const orgPathMap = useMemo(() => buildPathMap(orgTree), [orgTree]);

  const COLUMNS: ColumnDef<Risk>[] = [
    { key: "id", header: "ID", format: r => `R-${r.id}` },
    { key: "code", header: "Kod", format: r => r.code ?? "", defaultVisible: false },
    { key: "asset_name", header: "Aktywo" },
    { key: "org_unit_name", header: "Pion", format: r => r.org_unit_name ?? "" },
    { key: "risk_category_name", header: "Kategoria", format: r => r.risk_category_name ?? "" },
    { key: "security_area_name", header: "Domena", format: r => r.security_area_name ?? "" },
    { key: "risk_score", header: "Ocena (R)", format: r => (r.risk_score ?? 0).toFixed(1) },
    { key: "risk_level", header: "Poziom", format: r => r.risk_level ?? "", defaultVisible: false },
    { key: "status_name", header: "Status", format: r => r.status_name ?? "" },
    { key: "strategy_name", header: "Strategia", format: r => r.strategy_name ?? "", defaultVisible: false },
    { key: "owner", header: "Wlasciciel", format: r => r.owner ?? "" },
    { key: "identification_source_name", header: "Źródło ident.", format: r => r.identification_source_name ?? "", defaultVisible: false },
    { key: "asset_category_name", header: "Kat. aktywa", format: r => r.asset_category_name ?? "", defaultVisible: false },
    { key: "sensitivity_name", header: "Wrażliwość", format: r => r.sensitivity_name ?? "", defaultVisible: false },
    { key: "criticality_name", header: "Krytyczność", format: r => r.criticality_name ?? "", defaultVisible: false },
    { key: "impact_level", header: "Wpływ (W)", format: r => String(r.impact_level), defaultVisible: false },
    { key: "probability_level", header: "Prawd. (P)", format: r => String(r.probability_level), defaultVisible: false },
    { key: "safeguard_rating", header: "Zabezp. (Z)", format: r => String(r.safeguard_rating), defaultVisible: false },
    { key: "residual_risk", header: "Ryzyko rezyd.", format: r => r.residual_risk != null ? r.residual_risk.toFixed(1) : "", defaultVisible: false },
    { key: "treatment_deadline", header: "Termin real.", format: r => r.treatment_deadline?.slice(0, 10) ?? "", defaultVisible: false },
    { key: "accepted_by", header: "Akceptował", format: r => r.accepted_by ?? "", defaultVisible: false },
    { key: "next_review_date", header: "Następny przegląd", format: r => r.next_review_date?.slice(0, 10) ?? "", defaultVisible: false },
    { key: "identified_at", header: "Zidentyfikowano", format: r => r.identified_at?.slice(0, 10) ?? "", defaultVisible: false },
    { key: "last_review_at", header: "Ostatni przegląd", format: r => r.last_review_at?.slice(0, 10) ?? "", defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "risks");

  const table = useTableFeatures<Risk>({
    data: risks,
    storageKey: "risks",
    defaultSort: "risk_score",
    defaultSortDir: "desc",
  });

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
    const [categories, sensitivities, criticalities, statuses, strategies, risk_categories, identification_sources, asset_types] = await Promise.all([
      dictEntries("asset_category"),
      dictEntries("sensitivity"),
      dictEntries("criticality"),
      dictEntries("risk_status"),
      dictEntries("risk_strategy"),
      dictEntries("risk_category"),
      dictEntries("risk_identification_source"),
      dictEntries("asset_type"),
    ]);
    const result: FormLookups = {
      orgUnits, areas, threats, vulns, safeguards, assets,
      categories, sensitivities, criticalities, statuses, strategies,
      risk_categories, identification_sources, asset_types,
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

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editRisk) {
        const updated = await api.put<Risk>(`/api/v1/risks/${editRisk.id}`, data);
        setSelected(updated);
      } else {
        await api.post("/api/v1/risks", data);
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
    if (!confirm(`Zamknac ryzyko R-${risk.id}? Status zostanie zmieniony na "Zamkniete".`)) return;
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

  /* ── Dynamic stats ── */
  const isFiltered = table.filteredCount !== table.totalCount;
  const statsCards: StatCard[] = useMemo(() => {
    const src = table.filtered;
    const highF = src.filter(r => (r.risk_score ?? 0) >= 221).length;
    const medF = src.filter(r => { const s = r.risk_score ?? 0; return s >= 31 && s < 221; }).length;
    const avgF = src.length > 0 ? src.reduce((s, r) => s + (r.risk_score ?? 0), 0) / src.length : 0;
    const highT = risks.filter(r => (r.risk_score ?? 0) >= 221).length;
    const medT = risks.filter(r => { const s = r.risk_score ?? 0; return s >= 31 && s < 221; }).length;
    const avgT = risks.length > 0 ? risks.reduce((s, r) => s + (r.risk_score ?? 0), 0) / risks.length : 0;
    return [
      { label: "Wszystkich ryzyk", value: src.length, total: risks.length, color: "var(--blue)" },
      { label: "Wysokich", value: highF, total: highT, color: "var(--red)" },
      { label: "Średnich", value: medF, total: medT, color: "var(--orange)" },
      { label: "Średnia ocena", value: avgF.toFixed(1), total: avgT.toFixed(1), color: "var(--purple)" },
    ];
  }, [table.filtered, risks]);

  // Helper: is a date overdue?
  const isOverdue = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div>
      {error && (
        <div className="card" style={{ background: "#3a1a1a", borderColor: "#e74c3c", marginBottom: 16, padding: 16 }}>
          <strong style={{ color: "#e74c3c" }}>Blad ladowania ryzyk:</strong>
          <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}
      {/* ─── KPI Stats Cards ─── */}
      <StatsCards cards={statsCards} isFiltered={isFiltered} />

      {/* ─── Toolbar ─── */}
      <TableToolbar
        filteredCount={table.filteredCount}
        totalCount={table.totalCount}
        unitLabel="ryzyk"
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Szukaj ryzyk..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={table.hasActiveFilters}
        onClearFilters={table.clearAllFilters}
        columns={COLUMNS}
        visibleColumns={visibleCols}
        onToggleColumn={toggleCol}
        data={table.filtered}
        exportFilename="ryzyka"
        primaryLabel="Dodaj ryzyko"
        onPrimaryAction={openAddForm}
      />

      {/* ─── Main grid: table + detail panel ─── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 14 }}>

        {/* ─── Risk Table ─── */}
        <DataTable<Risk>
          columns={COLUMNS}
          visibleColumns={visibleCols}
          data={table.pageData}
          rowKey={r => r.id}
          selectedKey={selected?.id ?? null}
          onRowClick={r => setSelected(selected?.id === r.id ? null : r)}
          rowBorderColor={r => riskColor(r.risk_score ?? 0)}
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
          emptyMessage="Brak ryzyk w systemie."
          emptyFilteredMessage="Brak ryzyk pasujących do filtrów."
          renderCell={(r, key) => {
            if (key === "id") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>R-{r.id}</span>;
            if (key === "asset_name") return <span style={{ fontWeight: 500 }}>{r.asset_name}</span>;
            if (key === "org_unit_name") return <span style={{ fontSize: 11 }}>{orgPathMap.get(r.org_unit_id) ?? r.org_unit_name}</span>;
            if (key === "risk_score") return (
              <span className="score-badge" style={{ background: riskBg(r.risk_score ?? 0), color: riskColor(r.risk_score ?? 0) }}>
                {(r.risk_score ?? 0).toFixed(1)} {riskLabel(r.risk_score ?? 0)}
              </span>
            );
            if (key === "status_name") return <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{r.status_name ?? "\u2014"}</span>;
            return undefined;
          }}
        />

        {/* ─── Detail Panel ─── */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Szczegoly Ryzyka</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-sm" onClick={() => openEditForm(selected)} title="Edytuj">Edytuj</button>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>&#10005;</button>
              </div>
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
              <SectionHeader number="\u2460" label="Kontekst" />
              <DetailRow label="ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>R-{selected.id}</span>} />
              <DetailRow label="Pion" value={<span style={{ fontSize: 11 }}>{orgPathMap.get(selected.org_unit_id) ?? selected.org_unit_name}</span>} />
              <DetailRow label="Kategoria ryzyka" value={selected.risk_category_name} />
              <DetailRow label="Zrodlo identyfikacji" value={selected.identification_source_name} />
              {selected.risk_source && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Zrodlo ryzyka</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.risk_source}
                  </div>
                </div>
              )}

              <SectionHeader number="\u2461" label="Identyfikacja aktywa" />
              <DetailRow label="Aktywo" value={<span style={{ fontWeight: 500 }}>{selected.asset_name}</span>} />
              {selected.asset_id_name && (
                <DetailRow label="Z rejestru" value={<span style={{ color: "var(--cyan)" }}>{selected.asset_id_name}</span>} />
              )}
              <DetailRow label="Kategoria aktywa" value={selected.asset_category_name} />
              <DetailRow label="Wrazliwosc" value={selected.sensitivity_name} />
              <DetailRow label="Krytycznosc" value={selected.criticality_name} />

              <SectionHeader number="\u2462" label="Scenariusz ryzyka" />
              <DetailRow label="Domena" value={selected.security_area_name} />
              {selected.threats && selected.threats.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Zagrozenia</div>
                  <div className="tag-list">
                    {selected.threats.map(t => (
                      <span key={t.threat_id} className="tag" style={{ background: "var(--red-dim)", color: "var(--red)" }}>{t.threat_name}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.vulnerabilities && selected.vulnerabilities.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Podatnosci</div>
                  <div className="tag-list">
                    {selected.vulnerabilities.map(v => (
                      <span key={v.vulnerability_id} className="tag" style={{ background: "var(--orange-dim)", color: "var(--orange)" }}>{v.vulnerability_name}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.safeguards && selected.safeguards.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Zabezpieczenia</div>
                  <div className="tag-list">
                    {selected.safeguards.map(s => (
                      <span key={s.safeguard_id} className="tag" style={{ background: "var(--green-dim)", color: "var(--green)" }}>{s.safeguard_name}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.existing_controls && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Istniejace kontrole</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.existing_controls}
                  </div>
                </div>
              )}
              {selected.consequence_description && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>Opis konsekwencji</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: 8 }}>
                    {selected.consequence_description}
                  </div>
                </div>
              )}

              <SectionHeader number="\u2463" label="Analiza ryzyka" />
              <DetailRow label="Wplyw (W)" value={selected.impact_level} />
              <DetailRow label="Prawdopodobienstwo (P)" value={selected.probability_level} />
              <DetailRow label="Zabezpieczenia (Z)" value={selected.safeguard_rating} />
              <DetailRow label="Ocena (R)" value={
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: riskColor(selected.risk_score ?? 0) }}>
                  {(selected.risk_score ?? 0).toFixed(1)}
                </span>
              } />

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
              {selected.planned_safeguard_name && (
                <DetailRow label="Planowane zabezpieczenie" value={
                  <span style={{ color: "var(--green)", fontWeight: 500 }}>{selected.planned_safeguard_name}</span>
                } />
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

              <SectionHeader number="\u2465" label="Akceptacja i monitorowanie" />
              <DetailRow label="Status" value={
                selected.status_name ? (
                  <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{selected.status_name}</span>
                ) : "\u2014"
              } />
              <DetailRow label="Wlasciciel" value={selected.owner} />

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
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditRisk(null); }} title={editRisk ? `Edytuj ryzyko: R-${editRisk.id}` : "Dodaj ryzyko"} wide>
        {lookups ? (
          <RiskFormTabs
            editRisk={editRisk}
            lookups={lookups}
            setLookups={setLookups}
            flatUnits={flattenTree(lookups.orgUnits)}
            orgTree={lookups.orgUnits}
            saving={saving}
            onSubmit={handleFormSubmit}
            onCancel={() => { setShowForm(false); setEditRisk(null); }}
          />
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie danych formularza...</div>
        )}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PlannedSafeguardPicker — pick safeguard for treatment plan
   ═══════════════════════════════════════════════════════════════════ */

function PlannedSafeguardPicker({ lookups, setLookups, assetId, plannedSafeguardId, setPlannedSafeguardId }: {
  lookups: FormLookups;
  setLookups: React.Dispatch<React.SetStateAction<FormLookups | null>>;
  assetId: number | null;
  plannedSafeguardId: number | null;
  setPlannedSafeguardId: (id: number | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const selectedAsset = assetId ? lookups.assets.find(a => a.id === assetId) : null;
  const assetTypeId = selectedAsset?.asset_type_id ?? null;

  const available = assetTypeId
    ? lookups.safeguards.filter(s => s.asset_type_id === assetTypeId || s.asset_type_id === null)
    : lookups.safeguards;

  const filtered = search.length >= 1
    ? available.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const selected = plannedSafeguardId ? lookups.safeguards.find(s => s.id === plannedSafeguardId) : null;

  const handleAdd = async () => {
    if (!search.trim()) return;
    setAdding(true);
    try {
      const created = await api.post<Safeguard>("/api/v1/safeguards", { name: search.trim(), asset_type_id: assetTypeId });
      setLookups(prev => prev ? { ...prev, safeguards: [...prev.safeguards, created] } : prev);
      setPlannedSafeguardId(created.id);
      setSearch("");
    } catch (err) {
      alert("Blad: " + err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="form-group" style={{ gridColumn: "span 2" }}>
      <label>Planowane zabezpieczenie <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(wdrazane w ramach planu postepowania)</span></label>
      {selected ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 6,
        }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--green)" }}>{selected.name}</span>
          <button type="button" className="btn btn-sm" style={{ fontSize: 10, color: "var(--red)", padding: "0 6px" }}
            onClick={() => setPlannedSafeguardId(null)}>&#10005;</button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            className="form-control"
            style={{ fontSize: 12 }}
            placeholder="Szukaj zabezpieczenia lub wpisz nowe..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search.length >= 1 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
              maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              marginTop: 2,
            }}>
              {filtered.map(s => (
                <div key={s.id} style={{ padding: "7px 12px", cursor: "pointer", fontSize: 12, borderBottom: "1px solid rgba(42,53,84,0.12)" }}
                  onClick={() => { setPlannedSafeguardId(s.id); setSearch(""); }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {s.name}
                </div>
              ))}
              <div style={{ padding: "7px 12px", cursor: "pointer", fontSize: 12, color: "var(--green)", fontWeight: 500 }}
                onClick={handleAdd}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {adding ? "Dodawanie..." : `+ Dodaj "${search}" do katalogu zabezpieczen`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ActionSearchWithCreate — search + inline create actions for risk
   ═══════════════════════════════════════════════════════════════════ */

function ActionSearchWithCreate({ riskId, existingLinks, lookups, flatUnits, orgTree, strategyId }: {
  riskId: number | null;
  existingLinks: { action_id: number; title: string }[];
  lookups: FormLookups;
  flatUnits: { id: number; name: string; depth: number }[];
  orgTree: OrgUnitTreeNode[];
  strategyId: number | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Action[]>([]);
  const [searching, setSearching] = useState(false);
  const [linked, setLinked] = useState<{ action_id: number; title: string }[]>(existingLinks);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // New action form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newOrgUnitId, setNewOrgUnitId] = useState<number | null>(null);

  // Determine if strategy requires action
  const strategyLabel = strategyId ? lookups.strategies.find(s => s.id === strategyId)?.label : null;
  const requiresAction = strategyLabel && (
    strategyLabel.toLowerCase().includes("modyfikacja")
    || strategyLabel.toLowerCase().includes("transfer")
    || strategyLabel.toLowerCase().includes("unikanie")
  );

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

  const handleCreateAction = async () => {
    if (!newTitle || !riskId) return;
    setCreating(true);
    try {
      const links = [{ entity_type: "risk", entity_id: riskId }];
      const created = await api.post<Action>("/api/v1/actions", {
        title: newTitle,
        description: newDescription || null,
        owner: newOwner || null,
        responsible: newResponsible || null,
        due_date: newDueDate || null,
        org_unit_id: newOrgUnitId,
        links,
      });
      setLinked([...linked, { action_id: created.id, title: created.title }]);
      setShowNewForm(false);
      setNewTitle(""); setNewDescription(""); setNewOwner("");
      setNewResponsible(""); setNewDueDate(""); setNewOrgUnitId(null);
    } catch (err) {
      alert("Blad tworzenia: " + err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Powiazane dzialania ({linked.length})
          {requiresAction && linked.length === 0 && (
            <span style={{ color: "var(--orange)", marginLeft: 8, fontWeight: 600 }}>
              Strategia "{strategyLabel}" wymaga zaplanowania dzialania
            </span>
          )}
        </label>
      </div>

      {/* Linked actions list */}
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

      {riskId && !showNewForm && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              className="form-control"
              style={{ fontSize: 12 }}
              placeholder="Szukaj istniejacego dzialania po tytule, wlascicielu..."
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
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { setShowNewForm(true); setQuery(""); setResults([]); }}>
            + Nowe dzialanie
          </button>
        </div>
      )}

      {!riskId && (
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Zapisz ryzyko najpierw, aby moc wiazac dzialania</span>
      )}

      {/* Inline new action form */}
      {showNewForm && riskId && (
        <div style={{
          background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 8, padding: 14, marginTop: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--blue)" }}>Nowe dzialanie</span>
            <button type="button" className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setShowNewForm(false)}>Anuluj</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Tytul dzialania *</label>
              <input className="form-control" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="np. Wdrozenie MFA dla kont administracyjnych" />
              {!newTitle && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>Pole wymagane</div>}
            </div>
            <div className="form-group">
              <label>Wlasciciel</label>
              <input className="form-control" value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="np. Jan Kowalski" />
            </div>
            <div className="form-group">
              <label>Odpowiedzialny</label>
              <input className="form-control" value={newResponsible} onChange={e => setNewResponsible(e.target.value)} placeholder="np. Anna Nowak" />
            </div>
            <div className="form-group">
              <label>Jednostka organizacyjna</label>
              <OrgUnitTreeSelect
                tree={orgTree}
                value={newOrgUnitId}
                onChange={setNewOrgUnitId}
                placeholder="Wybierz..."
                allowClear
              />
            </div>
            <div className="form-group">
              <label>Termin realizacji</label>
              <input type="date" className="form-control" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Opis</label>
              <textarea className="form-control" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)}
                placeholder="Opisz dzialanie, cele, kroki..." />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={() => setShowNewForm(false)}>Anuluj</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={creating || !newTitle}
              onClick={handleCreateAction}>
              {creating ? "Tworzenie..." : "Utworz i powiaz dzialanie"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   TagMultiSelect — reusable multi-select with tags + inline add
   ═══════════════════════════════════════════════════════════════════ */

function TagMultiSelect<T extends { id: number; name: string }>({ label, items, selectedIds, onChange, onAdd, color }: {
  label: string;
  items: T[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onAdd: (name: string) => Promise<T>;
  color: string;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const available = items.filter(i => !selectedIds.includes(i.id));
  const filtered = search.length >= 1
    ? available.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const handleAdd = async () => {
    if (!search.trim()) return;
    setAdding(true);
    try {
      const created = await onAdd(search.trim());
      onChange([...selectedIds, created.id]);
      setSearch("");
    } catch (err) {
      alert("Blad: " + err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="form-group" style={{ gridColumn: "span 2" }}>
      <label>{label}</label>
      {/* Selected tags */}
      {selectedIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selectedIds.map(id => {
            const item = items.find(i => i.id === id);
            return (
              <span key={id} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: color + "18", color, border: `1px solid ${color}40`,
                borderRadius: 14, padding: "3px 10px 3px 10px", fontSize: 12, fontWeight: 500,
              }}>
                {item?.name ?? `#${id}`}
                <span style={{ cursor: "pointer", marginLeft: 2, opacity: 0.7, fontWeight: 700, fontSize: 14 }}
                  onClick={() => onChange(selectedIds.filter(sid => sid !== id))}>
                  &times;
                </span>
              </span>
            );
          })}
        </div>
      )}
      {/* Search input */}
      <div style={{ position: "relative" }}>
        <input
          className="form-control"
          style={{ fontSize: 12 }}
          placeholder={`Szukaj lub wpisz nowe...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {/* Dropdown results */}
        {search.length >= 1 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
            maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            marginTop: 2,
          }}>
            {filtered.map(item => (
              <div key={item.id} style={{
                padding: "7px 12px", cursor: "pointer", fontSize: 12,
                borderBottom: "1px solid rgba(42,53,84,0.12)",
              }}
                onClick={() => { onChange([...selectedIds, item.id]); setSearch(""); }}
                onMouseEnter={e => (e.currentTarget.style.background = color + "12")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {item.name}
              </div>
            ))}
            {/* "Add new" option */}
            <div style={{
              padding: "7px 12px", cursor: "pointer", fontSize: 12,
              color, fontWeight: 500, borderTop: filtered.length > 0 ? `1px solid ${color}30` : "none",
            }}
              onClick={handleAdd}
              onMouseEnter={e => (e.currentTarget.style.background = color + "12")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {adding ? "Dodawanie..." : `+ Dodaj "${search}" do slownika`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ScenarioTab — threats, vulnerabilities, safeguards with tag pickers
   ═══════════════════════════════════════════════════════════════════ */

function ScenarioTab({ lookups, setLookups, assetId, securityAreaId, setSecurityAreaId,
  threatIds, setThreatIds, vulnerabilityIds, setVulnerabilityIds,
  safeguardIds, setSafeguardIds, existingControls, setExistingControls,
  consequenceDescription, setConsequenceDescription }: {
  lookups: FormLookups;
  setLookups: React.Dispatch<React.SetStateAction<FormLookups | null>>;
  assetId: number | null;
  securityAreaId: number | null;
  setSecurityAreaId: (id: number | null) => void;
  threatIds: number[];
  setThreatIds: (ids: number[]) => void;
  vulnerabilityIds: number[];
  setVulnerabilityIds: (ids: number[]) => void;
  safeguardIds: number[];
  setSafeguardIds: (ids: number[]) => void;
  existingControls: string;
  setExistingControls: (v: string) => void;
  consequenceDescription: string;
  setConsequenceDescription: (v: string) => void;
}) {
  // Determine asset_type_id from selected asset
  const selectedAsset = assetId ? lookups.assets.find(a => a.id === assetId) : null;
  const assetTypeId = selectedAsset?.asset_type_id ?? null;
  const assetTypeName = selectedAsset?.asset_type_name ?? null;

  // Filter catalogs by asset type (show matching + untyped)
  const filteredThreats = assetTypeId
    ? lookups.threats.filter(t => t.asset_type_id === assetTypeId || t.asset_type_id === null)
    : lookups.threats;
  const filteredVulns = assetTypeId
    ? lookups.vulns.filter(v => v.asset_type_id === assetTypeId || v.asset_type_id === null)
    : lookups.vulns;
  const filteredSafeguards = assetTypeId
    ? lookups.safeguards.filter(s => s.asset_type_id === assetTypeId || s.asset_type_id === null)
    : lookups.safeguards;

  return (
    <div>
      <SectionHeader number="\u2462" label="Scenariusz ryzyka" />
      {assetTypeName && (
        <div style={{ fontSize: 11, color: "var(--blue)", marginBottom: 10, padding: "4px 8px", background: "rgba(59,130,246,0.06)", borderRadius: 6, display: "inline-block" }}>
          Filtrowanie wg typu aktywa: <strong>{assetTypeName}</strong>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-group">
          <label>Domena bezpieczenstwa</label>
          <select className="form-control" value={securityAreaId ?? ""} onChange={e => setSecurityAreaId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Wybierz...</option>
            {lookups.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div />

        <TagMultiSelect<Threat>
          label="Zagrozenia"
          items={filteredThreats}
          selectedIds={threatIds}
          onChange={setThreatIds}
          color="var(--red)"
          onAdd={async (name) => {
            const created = await api.post<Threat>("/api/v1/threats", { name, asset_type_id: assetTypeId });
            setLookups(prev => prev ? { ...prev, threats: [...prev.threats, created] } : prev);
            return created;
          }}
        />

        <TagMultiSelect<Vulnerability>
          label="Podatnosci"
          items={filteredVulns}
          selectedIds={vulnerabilityIds}
          onChange={setVulnerabilityIds}
          color="var(--orange)"
          onAdd={async (name) => {
            const created = await api.post<Vulnerability>("/api/v1/vulnerabilities", { name, asset_type_id: assetTypeId });
            setLookups(prev => prev ? { ...prev, vulns: [...prev.vulns, created] } : prev);
            return created;
          }}
        />

        <TagMultiSelect<Safeguard>
          label="Zabezpieczenia"
          items={filteredSafeguards}
          selectedIds={safeguardIds}
          onChange={setSafeguardIds}
          color="var(--green)"
          onAdd={async (name) => {
            const created = await api.post<Safeguard>("/api/v1/safeguards", { name, asset_type_id: assetTypeId });
            setLookups(prev => prev ? { ...prev, safeguards: [...prev.safeguards, created] } : prev);
            return created;
          }}
        />

        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Istniejace kontrole</label>
          <textarea className="form-control" rows={2} value={existingControls} onChange={e => setExistingControls(e.target.value)} placeholder="Opisz istniejace kontrole i zabezpieczenia..." />
        </div>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label>Opis konsekwencji</label>
          <textarea className="form-control" rows={2} value={consequenceDescription} onChange={e => setConsequenceDescription(e.target.value)} placeholder="Opisz potencjalne konsekwencje materializacji ryzyka..." />
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   AssetTab — searchable asset picker + inline asset creation
   ═══════════════════════════════════════════════════════════════════ */

function AssetTab({ assetId, assetName, lookups, flatUnits, orgTree, onSelectAsset, onClearAsset, onAssetCreated }: {
  assetId: number | null;
  assetName: string;
  lookups: FormLookups;
  flatUnits: { id: number; name: string; depth: number }[];
  orgTree: OrgUnitTreeNode[];
  onSelectAsset: (asset: Asset) => void;
  onClearAsset: () => void;
  onAssetCreated: (asset: Asset) => void;
}) {
  const [search, setSearch] = useState("");
  const [cmdbCategoryFilter, setCmdbCategoryFilter] = useState<string>("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // New asset form state
  const [newName, setNewName] = useState("");
  const [newTypeId, setNewTypeId] = useState<number | null>(null);
  const [newCategoryId, setNewCategoryId] = useState<number | null>(null);
  const [newOrgUnitId, setNewOrgUnitId] = useState<number | null>(null);
  const [newOwner, setNewOwner] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newSensitivityId, setNewSensitivityId] = useState<number | null>(null);
  const [newCriticalityId, setNewCriticalityId] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState("");

  const selectedAsset = assetId ? lookups.assets.find(a => a.id === assetId) : null;

  // Get unique CMDB category names for filtering
  const cmdbCategories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const a of lookups.assets) {
      const name = a.asset_category_name || a.category_name;
      if (name) cats.set(name, (cats.get(name) || 0) + 1);
    }
    return [...cats.entries()].sort((a, b) => b[1] - a[1]);
  }, [lookups.assets]);

  const filtered = search.length >= 1 || cmdbCategoryFilter
    ? lookups.assets.filter(a => {
        if (cmdbCategoryFilter) {
          const catName = a.asset_category_name || a.category_name;
          if (catName !== cmdbCategoryFilter) return false;
        }
        if (search.length >= 1) {
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q)
            || (a.org_unit_name ?? "").toLowerCase().includes(q)
            || (a.owner ?? "").toLowerCase().includes(q)
            || (a.category_name ?? "").toLowerCase().includes(q)
            || (a.asset_category_name ?? "").toLowerCase().includes(q);
        }
        return true;
      }).slice(0, 20)
    : [];

  const handleCreateAsset = async () => {
    if (!newName) return;
    setCreating(true);
    try {
      const created = await api.post<Asset>("/api/v1/assets", {
        name: newName,
        asset_type_id: newTypeId,
        category_id: newCategoryId,
        org_unit_id: newOrgUnitId,
        owner: newOwner || null,
        location: newLocation || null,
        sensitivity_id: newSensitivityId,
        criticality_id: newCriticalityId,
        description: newDescription || null,
      });
      onAssetCreated(created);
      setShowNewForm(false);
      setSearch("");
      // Reset form
      setNewName(""); setNewTypeId(null); setNewCategoryId(null);
      setNewOrgUnitId(null); setNewOwner(""); setNewLocation("");
      setNewSensitivityId(null); setNewCriticalityId(null); setNewDescription("");
    } catch (err) {
      alert("Blad tworzenia aktywa: " + err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <SectionHeader number="\u2461" label="Identyfikacja aktywa (ISO 27005 &sect;8.2)" />

      {/* ── Selected asset display ── */}
      {selectedAsset ? (
        <div style={{
          background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 8, padding: 14, marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)", fontSize: 11 }}>Powiazane aktywo</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedAsset.name}</span>
            </div>
            <button type="button" className="btn btn-sm" style={{ color: "var(--red)", fontSize: 11 }} onClick={onClearAsset}>
              Odlacz
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 12 }}>
            <DetailRow label="Typ" value={selectedAsset.asset_type_name} />
            <DetailRow label="Kategoria" value={selectedAsset.category_name} />
            <DetailRow label="Jednostka org." value={selectedAsset.org_unit_name} />
            <DetailRow label="Wlasciciel" value={selectedAsset.owner} />
            <DetailRow label="Wrazliwosc" value={selectedAsset.sensitivity_name} />
            <DetailRow label="Krytycznosc" value={selectedAsset.criticality_name} />
            {selectedAsset.location && <DetailRow label="Lokalizacja" value={selectedAsset.location} />}
            {selectedAsset.description && (
              <div style={{ gridColumn: "span 2", marginTop: 4 }}>
                <span style={{ color: "var(--text-muted)" }}>Opis: </span>
                <span style={{ color: "var(--text-secondary)" }}>{selectedAsset.description}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* ── Search bar ── */}
          {!showNewForm && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {cmdbCategories.length > 0 && (
                  <select
                    className="form-control"
                    style={{ fontSize: 11, width: 180, padding: "5px 8px" }}
                    value={cmdbCategoryFilter}
                    onChange={e => setCmdbCategoryFilter(e.target.value)}
                  >
                    <option value="">Kategoria CMDB...</option>
                    {cmdbCategories.map(([name, count]) => (
                      <option key={name} value={name}>{name} ({count})</option>
                    ))}
                  </select>
                )}
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    className="form-control"
                    style={{ fontSize: 12 }}
                    placeholder="Szukaj aktywa po nazwie, jednostce, wlascicielu..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => { setShowNewForm(true); setSearch(""); }}>
                  + Dodaj nowe
                </button>
              </div>
              {/* ── Search results dropdown ── */}
              {filtered.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
                  maxHeight: 260, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  marginTop: 2,
                }}>
                  {filtered.map(a => (
                    <div key={a.id} style={{
                      padding: "8px 14px", cursor: "pointer", fontSize: 12,
                      borderBottom: "1px solid rgba(42,53,84,0.15)",
                      transition: "background 0.1s",
                    }}
                      onClick={() => { onSelectAsset(a); setSearch(""); }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", gap: 10 }}>
                        {a.asset_category_name && (
                          <span className="score-badge" style={{ background: (a.asset_category_color || "var(--purple)") + "20", color: a.asset_category_color || "var(--purple)", fontSize: 9, padding: "1px 5px" }}>
                            {a.asset_category_name}
                          </span>
                        )}
                        {!a.asset_category_name && a.category_name && <span>{a.category_name}</span>}
                        {a.org_unit_name && <span>{a.org_unit_name}</span>}
                        {a.owner && <span>{a.owner}</span>}
                        {a.sensitivity_name && <span>W: {a.sensitivity_name}</span>}
                        {a.criticality_name && <span>K: {a.criticality_name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {search.length >= 1 && filtered.length === 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
                  padding: "12px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  marginTop: 2, fontSize: 12, color: "var(--text-muted)", textAlign: "center",
                }}>
                  Brak wynikow. <span style={{ color: "var(--blue)", cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => { setShowNewForm(true); setNewName(search); setSearch(""); }}>Dodaj nowe aktywo</span>
                </div>
              )}
            </div>
          )}

          {!showNewForm && !assetName && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed var(--border)" }}>
              Wyszukaj i wybierz aktywo z rejestru lub dodaj nowe
            </div>
          )}
        </div>
      )}

      {/* ── Inline new asset form (1:1 with AssetRegistryPage) ── */}
      {showNewForm && !selectedAsset && (
        <div style={{
          background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 8, padding: 16, marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--green)" }}>Nowe aktywo</span>
            <button type="button" className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setShowNewForm(false)}>
              Anuluj
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Nazwa aktywa *</label>
              <input className="form-control" value={newName} onChange={e => setNewName(e.target.value)} placeholder="np. Serwer bazodanowy DB-01" />
              {!newName && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>Pole wymagane</div>}
            </div>
            <div className="form-group">
              <label>Typ aktywa</label>
              <select className="form-control" value={newTypeId ?? ""} onChange={e => setNewTypeId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.asset_types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Kategoria</label>
              <select className="form-control" value={newCategoryId ?? ""} onChange={e => setNewCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Jednostka organizacyjna</label>
              <OrgUnitTreeSelect
                tree={orgTree}
                value={newOrgUnitId}
                onChange={setNewOrgUnitId}
                placeholder="Wybierz..."
                allowClear
              />
            </div>
            <div className="form-group">
              <label>Wlasciciel</label>
              <input className="form-control" value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="np. Jan Kowalski" />
            </div>
            <div className="form-group">
              <label>Lokalizacja</label>
              <input className="form-control" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="np. Serwerownia DC-1" />
            </div>
            <div className="form-group">
              <label>Wrazliwosc</label>
              <select className="form-control" value={newSensitivityId ?? ""} onChange={e => setNewSensitivityId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.sensitivities.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Krytycznosc</label>
              <select className="form-control" value={newCriticalityId ?? ""} onChange={e => setNewCriticalityId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.criticalities.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Opis</label>
              <textarea className="form-control" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Opcjonalny opis aktywa..." />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={() => setShowNewForm(false)}>Anuluj</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={creating || !newName} onClick={handleCreateAsset}>
              {creating ? "Tworzenie..." : "Utworz i powiaz aktywo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RiskFormTabs — tabbed form with 5 ISO sections
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { key: "context", label: "Kontekst", num: "\u2460" },
  { key: "asset", label: "Aktywo", num: "\u2461" },
  { key: "scenario", label: "Scenariusz", num: "\u2462" },
  { key: "treatment", label: "Postepowanie", num: "\u2463" },
  { key: "acceptance", label: "Akceptacja", num: "\u2464" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function RiskFormTabs({ editRisk, lookups, setLookups, flatUnits, orgTree, saving, onSubmit, onCancel }: {
  editRisk: Risk | null;
  lookups: FormLookups;
  setLookups: React.Dispatch<React.SetStateAction<FormLookups | null>>;
  flatUnits: { id: number; name: string; depth: number }[];
  orgTree: OrgUnitTreeNode[];
  saving: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("context");

  // ── Controlled form state ──
  // Sekcja 1: Kontekst
  const [orgUnitId, setOrgUnitId] = useState<number | null>(editRisk?.org_unit_id ?? null);
  const [riskCategoryId, setRiskCategoryId] = useState<number | null>(editRisk?.risk_category_id ?? null);
  const [riskSource, setRiskSource] = useState(editRisk?.risk_source ?? "");
  const [identificationSourceId, setIdentificationSourceId] = useState<number | null>(editRisk?.identification_source_id ?? null);

  // Sekcja 2: Aktywo
  const [assetId, setAssetId] = useState<number | null>(editRisk?.asset_id ?? null);
  const [assetCategoryId, setAssetCategoryId] = useState<number | null>(editRisk?.asset_category_id ?? null);
  const [assetName, setAssetName] = useState(editRisk?.asset_name ?? "");
  const [sensitivityId, setSensitivityId] = useState<number | null>(editRisk?.sensitivity_id ?? null);
  const [criticalityId, setCriticalityId] = useState<number | null>(editRisk?.criticality_id ?? null);

  // Sekcja 3: Scenariusz
  const [securityAreaId, setSecurityAreaId] = useState<number | null>(editRisk?.security_area_id ?? null);
  const [threatIds, setThreatIds] = useState<number[]>(editRisk?.threats?.map(t => t.threat_id) ?? []);
  const [vulnerabilityIds, setVulnerabilityIds] = useState<number[]>(editRisk?.vulnerabilities?.map(v => v.vulnerability_id) ?? []);
  const [existingControls, setExistingControls] = useState(editRisk?.existing_controls ?? "");
  const [consequenceDescription, setConsequenceDescription] = useState(editRisk?.consequence_description ?? "");

  // Sekcja 4: Analiza
  const [W, setW] = useState(editRisk?.impact_level ?? 2);
  const [P, setP] = useState(editRisk?.probability_level ?? 2);
  const [Z, setZ] = useState(editRisk?.safeguard_rating ?? 0.25);

  // Sekcja 5: Postepowanie
  const [strategyId, setStrategyId] = useState<number | null>(editRisk?.strategy_id ?? null);
  const [treatmentPlan, setTreatmentPlan] = useState(editRisk?.treatment_plan ?? "");
  const [plannedSafeguardId, setPlannedSafeguardId] = useState<number | null>(editRisk?.planned_safeguard_id ?? null);
  const [treatmentDeadline, setTreatmentDeadline] = useState(editRisk?.treatment_deadline?.slice(0, 10) ?? "");
  const [treatmentResources, setTreatmentResources] = useState(editRisk?.treatment_resources ?? "");
  const [safeguardIds, setSafeguardIds] = useState<number[]>(editRisk?.safeguards?.map(s => s.safeguard_id) ?? []);
  const [plannedActions] = useState(editRisk?.planned_actions ?? "");
  const [tW, setTW] = useState(editRisk?.target_impact ?? editRisk?.impact_level ?? 1);
  const [tP, setTP] = useState(editRisk?.target_probability ?? editRisk?.probability_level ?? 1);
  const [tZ, setTZ] = useState(editRisk?.target_safeguard ?? 0.95);

  // Sekcja 6: Akceptacja
  const [statusId, setStatusId] = useState<number | null>(editRisk?.status_id ?? null);
  const [owner, setOwner] = useState(editRisk?.owner ?? "");
  const [acceptedBy, setAcceptedBy] = useState(editRisk?.accepted_by ?? "");
  const [acceptanceJustification, setAcceptanceJustification] = useState(editRisk?.acceptance_justification ?? "");
  const [nextReviewDate, setNextReviewDate] = useState(editRisk?.next_review_date?.slice(0, 10) ?? "");

  // Live calculations
  const liveScore = Math.exp(W) * P / Z;
  const lvColor = riskColor(liveScore);
  const lvBg = riskBg(liveScore);
  const liveLabel = riskLabel(liveScore);

  const residualScore = Math.exp(tW) * tP / tZ;
  const resColor = riskColor(residualScore);
  const resBg = riskBg(residualScore);
  const resLabel = riskLabel(residualScore);
  const reduction = liveScore > 0 ? ((1 - residualScore / liveScore) * 100) : 0;

  const canSubmit = orgUnitId && assetName;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      org_unit_id: orgUnitId,
      risk_category_id: riskCategoryId,
      risk_source: riskSource || null,
      identification_source_id: identificationSourceId,
      asset_id: assetId,
      asset_category_id: assetCategoryId,
      asset_name: assetName,
      sensitivity_id: sensitivityId,
      criticality_id: criticalityId,
      security_area_id: securityAreaId,
      existing_controls: existingControls || null,
      consequence_description: consequenceDescription || null,
      impact_level: W,
      probability_level: P,
      safeguard_rating: Z,
      strategy_id: strategyId,
      treatment_plan: treatmentPlan || null,
      planned_safeguard_id: plannedSafeguardId,
      treatment_deadline: treatmentDeadline || null,
      treatment_resources: treatmentResources || null,
      threat_ids: threatIds,
      vulnerability_ids: vulnerabilityIds,
      safeguard_ids: safeguardIds,
      planned_actions: plannedActions || null,
      target_impact: tW,
      target_probability: tP,
      target_safeguard: tZ,
      residual_risk: Math.round(residualScore * 100) / 100,
      status_id: statusId,
      owner: owner || null,
      accepted_by: acceptedBy || null,
      acceptance_justification: acceptanceJustification || null,
      next_review_date: nextReviewDate || null,
    });
  };

  return (
    <div>
      {/* ─── Live Score Bar ─── */}
      <div style={{
        background: lvBg, border: `1px solid ${lvColor}`, borderRadius: 10,
        padding: "10px 20px", marginBottom: 16,
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

      {/* ─── Risk matrix 3x3 + Z panel (always visible, like Exceptions) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Macierz ryzyka (W &times; P)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto repeat(3, 1fr)", gap: 2, maxWidth: 280 }}>
            <div />
            {["P=1", "P=2", "P=3"].map(h => (
              <div key={h} style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", padding: 4 }}>{h}</div>
            ))}
            {[3, 2, 1].map(w => (
              <div key={`row-${w}`} style={{ display: "contents" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}>W={w}</div>
                {[1, 2, 3].map(p => {
                  const score = Math.exp(w) * p / Z;
                  const isActive = w === W && p === P;
                  return (
                    <div
                      key={`${w}-${p}`}
                      style={{
                        textAlign: "center", padding: 6, borderRadius: 4, fontSize: 10,
                        fontFamily: "'JetBrains Mono',monospace", fontWeight: isActive ? 700 : 400,
                        background: riskBg(score), color: riskColor(score),
                        border: isActive ? `2px solid ${riskColor(score)}` : "2px solid transparent",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                      onClick={() => { setW(w); setP(p); }}
                    >
                      {score.toFixed(0)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
            Kliknij komorke aby wybrac W i P
          </div>
        </div>

        {/* Z Level Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", marginBottom: 2 }}>
            Ocena zabezpieczen (Z)
          </div>
          {([
            { value: 0.10, label: "Brak zabezpieczen", color: "var(--red)" },
            { value: 0.25, label: "Czesciowe", color: "var(--orange)" },
            { value: 0.70, label: "Dobra jakosc", color: "var(--blue)" },
            { value: 0.95, label: "Skuteczne, testowane", color: "var(--green)" },
          ] as const).map(zl => {
            const isActive = Math.abs(Z - zl.value) < 0.01;
            return (
              <div
                key={zl.value}
                style={{
                  padding: "6px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  background: isActive ? `${zl.color}18` : "transparent",
                  border: isActive ? `2px solid ${zl.color}` : "2px solid var(--border)",
                  color: isActive ? zl.color : "var(--text-muted)",
                  fontWeight: isActive ? 600 : 400, transition: "all 0.15s",
                }}
                onClick={() => setZ(zl.value)}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? zl.color : "var(--border)", flexShrink: 0 }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", minWidth: 30 }}>{zl.value.toFixed(2)}</span>
                <span>{zl.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Tab bar ─── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, overflowX: "auto" }}>
        {TABS.map(t => (
          <div
            key={t.key}
            style={{
              flex: 1, textAlign: "center", padding: "8px 6px", minWidth: 100,
              background: tab === t.key ? "var(--blue-dim)" : "transparent",
              borderBottom: tab === t.key ? "2px solid var(--blue)" : "2px solid var(--border)",
              color: tab === t.key ? "var(--blue)" : "var(--text-muted)",
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 12, cursor: "pointer", transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
            onClick={() => setTab(t.key)}
          >
            <span style={{ marginRight: 4 }}>{t.num}</span>
            {t.label}
          </div>
        ))}
      </div>

      {/* ═══ Tab: Kontekst ═══ */}
      {tab === "context" && (
        <div>
          <SectionHeader number="\u2460" label="Kontekst (ISO 31000 &sect;5.3)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Jednostka organizacyjna *</label>
              <OrgUnitTreeSelect
                tree={orgTree}
                value={orgUnitId}
                onChange={setOrgUnitId}
                placeholder="Wybierz..."
                allowClear={false}
              />
              {!orgUnitId && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>Pole wymagane</div>}
            </div>
            <div className="form-group">
              <label>Kategoria ryzyka</label>
              <select className="form-control" value={riskCategoryId ?? ""} onChange={e => setRiskCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.risk_categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Zrodlo identyfikacji</label>
              <select className="form-control" value={identificationSourceId ?? ""} onChange={e => setIdentificationSourceId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.identification_sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Zrodlo ryzyka</label>
              <textarea className="form-control" rows={2} value={riskSource} onChange={e => setRiskSource(e.target.value)} placeholder="Opisz zrodlo lub kontekst ryzyka..." />
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab: Aktywo ═══ */}
      {tab === "asset" && (
        <AssetTab
          assetId={assetId}
          assetName={assetName}
          lookups={lookups}
          flatUnits={flatUnits}
          orgTree={orgTree}
          onSelectAsset={(asset) => {
            setAssetId(asset.id);
            setAssetName(asset.name);
            setAssetCategoryId(asset.category_id);
            setSensitivityId(asset.sensitivity_id);
            setCriticalityId(asset.criticality_id);
          }}
          onClearAsset={() => {
            setAssetId(null);
            setAssetName("");
            setAssetCategoryId(null);
            setSensitivityId(null);
            setCriticalityId(null);
          }}
          onAssetCreated={(asset) => {
            setAssetId(asset.id);
            setAssetName(asset.name);
            setAssetCategoryId(asset.category_id);
            setSensitivityId(asset.sensitivity_id);
            setCriticalityId(asset.criticality_id);
            api.get<Asset[]>("/api/v1/assets").then(all => {
              setLookups(prev => prev ? { ...prev, assets: all } : prev);
            }).catch(() => {});
          }}
        />
      )}

      {/* ═══ Tab: Scenariusz ═══ */}
      {tab === "scenario" && (
        <ScenarioTab
          lookups={lookups}
          setLookups={setLookups}
          assetId={assetId}
          securityAreaId={securityAreaId}
          setSecurityAreaId={setSecurityAreaId}
          threatIds={threatIds}
          setThreatIds={setThreatIds}
          vulnerabilityIds={vulnerabilityIds}
          setVulnerabilityIds={setVulnerabilityIds}
          safeguardIds={safeguardIds}
          setSafeguardIds={setSafeguardIds}
          existingControls={existingControls}
          setExistingControls={setExistingControls}
          consequenceDescription={consequenceDescription}
          setConsequenceDescription={setConsequenceDescription}
        />
      )}

      {/* ═══ Tab: Postepowanie ═══ */}
      {tab === "treatment" && (
        <div>
          <SectionHeader number="\u2463" label="Postepowanie z ryzykiem (ISO 27005 &sect;8.5)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Strategia</label>
              <select className="form-control" value={strategyId ?? ""} onChange={e => setStrategyId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.strategies.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Termin realizacji</label>
              <input type="date" className="form-control" value={treatmentDeadline} onChange={e => setTreatmentDeadline(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Plan postepowania z ryzykiem</label>
              <textarea className="form-control" rows={3} value={treatmentPlan} onChange={e => setTreatmentPlan(e.target.value)} placeholder="Opisz plan postepowania z ryzykiem..." />
            </div>

            {/* Planowane zabezpieczenie - filtrowane po typie aktywa */}
            <PlannedSafeguardPicker
              lookups={lookups}
              setLookups={setLookups}
              assetId={assetId}
              plannedSafeguardId={plannedSafeguardId}
              setPlannedSafeguardId={setPlannedSafeguardId}
            />

            {/* Istniejace zabezpieczenia aktywa (readonly) */}
            {safeguardIds.length > 0 && (
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label style={{ color: "var(--text-muted)" }}>Zabezpieczenia przypisane do ryzyka (z sekcji Scenariusz)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0" }}>
                  {safeguardIds.map(sid => {
                    const sg = lookups.safeguards.find(s => s.id === sid);
                    return (
                      <span key={sid} style={{
                        background: "var(--green-dim)", color: "var(--green)",
                        borderRadius: 14, padding: "3px 10px", fontSize: 12, fontWeight: 500,
                        border: "1px solid rgba(34,197,94,0.3)",
                      }}>
                        {sg?.name ?? `#${sid}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Zasoby wymagane</label>
              <textarea className="form-control" rows={2} value={treatmentResources} onChange={e => setTreatmentResources(e.target.value)} placeholder="Opisz wymagane zasoby (budzet, ludzie, narzedzia)..." />
            </div>
          </div>

          {/* Dzialania - szukaj lub tworzenie inline */}
          <ActionSearchWithCreate
            riskId={editRisk?.id ?? null}
            existingLinks={(editRisk?.linked_actions ?? []).map(a => ({ action_id: a.action_id, title: a.title }))}
            lookups={lookups}
            flatUnits={flatUnits}
            orgTree={orgTree}
            strategyId={strategyId}
          />

          {/* Residual Risk */}
          <div style={{
            background: resBg, border: `1px solid ${resColor}`, borderRadius: 10,
            padding: "12px 20px", marginTop: 16,
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
                <select className="form-control" value={tW} onChange={e => setTW(Number(e.target.value))}>
                  <option value="1">1 -- Niski</option>
                  <option value="2">2 -- Sredni</option>
                  <option value="3">3 -- Wysoki</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Docelowe P</label>
                <select className="form-control" value={tP} onChange={e => setTP(Number(e.target.value))}>
                  <option value="1">1 -- Niskie</option>
                  <option value="2">2 -- Srednie</option>
                  <option value="3">3 -- Wysokie</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Docelowe Z</label>
                <select className="form-control" value={tZ} onChange={e => setTZ(Number(e.target.value))}>
                  <option value="0.10">0,10 -- Brak</option>
                  <option value="0.25">0,25 -- Czesciowe</option>
                  <option value="0.70">0,70 -- Dobre</option>
                  <option value="0.95">0,95 -- Skuteczne</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab: Akceptacja ═══ */}
      {tab === "acceptance" && (
        <div>
          <SectionHeader number="\u2464" label="Akceptacja i monitorowanie (ISO 27005 &sect;8.6/&sect;9)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={statusId ?? ""} onChange={e => setStatusId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Wybierz...</option>
                {lookups.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Wlasciciel ryzyka</label>
              <input className="form-control" value={owner} onChange={e => setOwner(e.target.value)} placeholder="np. Jan Kowalski" />
            </div>
            <div className="form-group">
              <label>Zaakceptowane przez</label>
              <input className="form-control" value={acceptedBy} onChange={e => setAcceptedBy(e.target.value)} placeholder="Imie i nazwisko akceptujacego" />
            </div>
            <div className="form-group">
              <label>Data nastepnego przegladu</label>
              <input type="date" className="form-control" value={nextReviewDate} onChange={e => setNextReviewDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Uzasadnienie akceptacji</label>
              <textarea className="form-control" rows={2} value={acceptanceJustification} onChange={e => setAcceptanceJustification(e.target.value)} placeholder="Uzasadnienie akceptacji poziomu ryzyka..." />
            </div>
          </div>
        </div>
      )}

      {/* ─── Submit buttons ─── */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button type="button" className="btn" onClick={onCancel}>Anuluj</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || !canSubmit}
          onClick={handleSubmit}
        >
          {saving ? "Zapisywanie..." : editRisk ? "Zapisz zmiany" : "Zapisz ryzyko"}
        </button>
      </div>
    </div>
  );
}
