import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { ExecutiveSummary, RiskDashboard, PostureScoreResponse, RiskMatrixCell, OrgUnitTreeNode, KpiItem } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";

/* ──────────────── helpers ──────────────── */

function gradeColor(g: string | null) {
  if (!g) return "var(--text-muted)";
  return g === "A" ? "var(--green)" : g === "B" ? "var(--cyan)" : g === "C" ? "var(--yellow)" : g === "D" ? "var(--orange)" : "var(--red)";
}
function riskColor(lv: string) { return lv === "high" ? "var(--red)" : lv === "medium" ? "var(--orange)" : "var(--green)"; }
function riskBg(lv: string) { return lv === "high" ? "var(--red-dim)" : lv === "medium" ? "var(--orange-dim)" : "var(--green-dim)"; }
function pctColor(v: number) { return v >= 75 ? "var(--green)" : v >= 50 ? "var(--yellow)" : v >= 25 ? "var(--orange)" : "var(--red)"; }

function matrixBg(impact: number, prob: number): string {
  const score = impact * prob;
  if (score >= 6) return "var(--red)";
  if (score >= 3) return "var(--orange)";
  return "var(--green)";
}

function matrixCount(matrix: RiskMatrixCell[], impact: number, prob: number): number {
  return matrix.find(c => c.impact === impact && c.probability === prob)?.count ?? 0;
}

function gradeLabel(g: string | null): string {
  switch (g) {
    case "A": return "DOSKONAŁY";
    case "B": return "DOBRY";
    case "C": return "UMIARKOWANY";
    case "D": return "SŁABY";
    case "F": return "KRYTYCZNY";
    default: return "—";
  }
}

function gradeDesc(g: string | null): string {
  switch (g) {
    case "A": return "Doskonała postawa bezpieczeństwa. Wszystkie wymiary powyżej progu akceptacji. Utrzymuj obecny standard.";
    case "B": return "Dobra postawa z obszarami wymagającymi wzmocnienia. Skoncentruj się na najsłabszych wymiarach.";
    case "C": return "Umiarkowana postawa bezpieczeństwa. Wymagane są działania korygujące w wielu obszarach.";
    case "D": return "Słaba postawa bezpieczeństwa. Konieczne natychmiastowe działania naprawcze i eskalacja.";
    case "F": return "Krytycznie niski poziom bezpieczeństwa. Wymaga natychmiastowej interwencji zarządu.";
    default: return "Brak wystarczających danych do pełnej oceny.";
  }
}

function kpiVal(kpis: KpiItem[], label: string): number {
  const k = kpis.find(x => x.label === label);
  return typeof k?.value === "number" ? k.value : parseFloat(String(k?.value ?? "0")) || 0;
}

function pluralPL(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/* ──────────────── navigation helper ──────────────── */
function buildLink(base: string, params: Record<string, string | number | null | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `${base}?${parts.join("&")}` : base;
}

/* ──────────────── component ──────────────── */

export default function DashboardPage() {
  const [exec, setExec] = useState<ExecutiveSummary | null>(null);
  const [riskDash, setRiskDash] = useState<RiskDashboard | null>(null);
  const [posture, setPosture] = useState<PostureScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const navigate = useNavigate();

  const loadData = (orgUnitId?: string) => {
    setLoading(true);
    const qs = orgUnitId ? `?org_unit_id=${orgUnitId}` : "";
    Promise.all([
      api.get<ExecutiveSummary>(`/api/v1/dashboard/executive-summary${qs}`).catch(() => null),
      api.get<RiskDashboard>(`/api/v1/dashboard/risks${qs}`).catch(() => null),
      api.get<PostureScoreResponse>(`/api/v1/dashboard/posture-score${qs}`).catch(() => null),
    ]).then(([e, r, p]) => {
      setExec(e); setRiskDash(r); setPosture(p);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
    loadData();
  }, []);

  const handleOrgChange = (val: string) => {
    setOrgFilter(val);
    loadData(val || undefined);
  };

  if (loading && !exec) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ładowanie dashboardu...</span>
    </div>;
  }

  const score = posture?.score ?? exec?.posture_score ?? 0;
  const grade = posture?.grade ?? exec?.posture_grade ?? null;
  const circ = 2 * Math.PI * 54;
  const offset = circ - (score / 100) * circ;
  const rc = exec?.risk_counts ?? riskDash?.risk_counts ?? { high: 0, medium: 0, low: 0, total: 0 };

  // Org context
  const orgName = exec?.org_unit?.name ?? null;
  const scopeLabel = orgName ?? "Cała organizacja";

  // KPI values from the kpis array
  const vulns = kpiVal(exec?.kpis ?? [], "Otwarte podatności");
  const incidents = kpiVal(exec?.kpis ?? [], "Otwarte incydenty");
  const totalAssets = kpiVal(exec?.kpis ?? [], "Aktywa (CMDB)");
  const cmdbCoverage = kpiVal(exec?.kpis ?? [], "CMDB Coverage");

  // Trend calculation from risk trend data
  const highTrend = (() => {
    if (!riskDash?.trend || riskDash.trend.length < 2) return null;
    const t = riskDash.trend;
    const last = t[t.length - 1];
    const prev = t[t.length - 2];
    return { delta: last.high - prev.high, totalDelta: last.total - prev.total };
  })();

  // Auto-generated findings for executive briefing
  const findings: { text: string; color: string; bg: string }[] = [];
  if (rc.high > 0) findings.push({
    text: `${rc.high} ${pluralPL(rc.high, "ryzyko krytyczne wymaga", "ryzyka krytyczne wymagają", "ryzyk krytycznych wymaga")} natychmiastowej uwagi`,
    color: "var(--red)", bg: "var(--red-dim)",
  });
  if (incidents > 0) findings.push({
    text: `${incidents} ${pluralPL(incidents, "otwarty incydent", "otwarte incydenty", "otwartych incydentów")} bezpieczeństwa`,
    color: "var(--red)", bg: "var(--red-dim)",
  });
  if ((exec?.overdue_reviews_count ?? 0) > 0) findings.push({
    text: `${exec!.overdue_reviews_count} ${pluralPL(exec!.overdue_reviews_count, "przegląd ryzyka przeterminowany", "przeglądy ryzyk przeterminowane", "przeglądów ryzyk przeterminowanych")}`,
    color: "var(--orange)", bg: "var(--orange-dim)",
  });
  if (vulns > 0) findings.push({
    text: `${vulns} ${pluralPL(vulns, "otwarta podatność", "otwarte podatności", "otwartych podatności")} do remediacji`,
    color: vulns > 5 ? "var(--orange)" : "var(--yellow)", bg: vulns > 5 ? "var(--orange-dim)" : "var(--yellow-dim)",
  });
  if (exec?.cis_maturity_rating != null) {
    const cis = exec.cis_maturity_rating;
    if (cis < 2) findings.push({ text: `CIS Maturity ${cis.toFixed(2)}/5.0 — znacznie poniżej oczekiwań`, color: "var(--red)", bg: "var(--red-dim)" });
    else if (cis < 3) findings.push({ text: `CIS Maturity ${cis.toFixed(2)}/5.0 — wymaga poprawy`, color: "var(--orange)", bg: "var(--orange-dim)" });
    else if (cis < 4) findings.push({ text: `CIS Maturity ${cis.toFixed(2)}/5.0 — dobry poziom, dalszy rozwój`, color: "var(--yellow)", bg: "var(--yellow-dim)" });
    else findings.push({ text: `CIS Maturity ${cis.toFixed(2)}/5.0 — wysoki poziom dojrzałości`, color: "var(--green)", bg: "var(--green-dim)" });
  }
  if (findings.length === 0) findings.push({ text: "Brak krytycznych zagrożeń. Postawa bezpieczeństwa stabilna.", color: "var(--green)", bg: "var(--green-dim)" });

  // Recommendations
  const recommendations: { text: string; link: string }[] = [];
  if (rc.high > 0) recommendations.push({ text: "Przegląd ryzyk krytycznych", link: buildLink("/risks", { level: "high", org_unit_id: orgFilter || null }) });
  if ((exec?.overdue_reviews_count ?? 0) > 0) recommendations.push({ text: "Uzupełnienie zaległych przeglądów", link: "/reviews" });
  if (exec?.cis_maturity_rating != null && exec.cis_maturity_rating < 3) recommendations.push({ text: "Rozwój kontroli CIS", link: "/cis" });
  if (vulns > 3) recommendations.push({ text: "Plan remediacji podatności", link: "/vulnerabilities" });
  const weakDim = posture?.dimensions?.length ? [...posture.dimensions].sort((a, b) => a.score - b.score)[0] : null;
  if (weakDim && weakDim.score < 70) recommendations.push({ text: `Wzmocnienie: ${weakDim.name}`, link: "#" });

  // Severity level for the briefing border
  const severityColor = rc.high > 5 || grade === "F" ? "var(--red)"
    : rc.high > 0 || grade === "D" ? "var(--orange)"
    : grade === "C" ? "var(--yellow)"
    : "var(--green)";

  // Risk proportion bar widths
  const riskBarTotal = Math.max(rc.total, 1);
  const highPct = (rc.high / riskBarTotal) * 100;
  const medPct = (rc.medium / riskBarTotal) * 100;

  return (
    <div>
      {/* Org Unit Filter */}
      <div className="toolbar">
        <div className="toolbar-left">
          <OrgUnitTreeSelect
            tree={orgTree}
            value={orgFilter ? Number(orgFilter) : null}
            onChange={id => handleOrgChange(id ? String(id) : "")}
            placeholder="Cała organizacja"
            allowClear
            style={{ width: 300 }}
          />
          {loading && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odświeżanie...</span>}
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Zakres: <strong style={{ color: "var(--text-secondary)" }}>{scopeLabel}</strong>
          </span>
          {posture?.benchmark_avg != null && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 12 }}>
              Benchmark: <strong style={{ color: pctColor(posture.benchmark_avg) }}>{Math.round(posture.benchmark_avg)}%</strong>
            </span>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
           EXECUTIVE BRIEFING — hero section
         ═══════════════════════════════════════ */}
      <div className="card" style={{
        borderLeft: `4px solid ${severityColor}`,
        padding: "24px 28px",
        marginBottom: 16,
        background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)",
      }}>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* LEFT — Score Ring */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ position: "relative", width: 130, height: 130 }}>
              <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="65" cy="65" r="54" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle cx="65" cy="65" r="54" fill="none"
                  stroke={gradeColor(grade)} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)" }} />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: gradeColor(grade), lineHeight: 1 }}>
                  {score ? Math.round(score) : "—"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>/ 100</div>
              </div>
            </div>
            <div style={{
              display: "inline-block", marginTop: 8, padding: "4px 16px", borderRadius: 20,
              background: `${gradeColor(grade)}18`, border: `1px solid ${gradeColor(grade)}40`,
              fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: gradeColor(grade),
            }}>
              {grade ?? "—"} — {gradeLabel(grade)}
            </div>
          </div>

          {/* CENTER — Briefing Text */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                Executive Briefing
              </div>
              {orgName && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--blue-dim)", color: "var(--blue)" }}>
                  {orgName}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 14 }}>
              {gradeDesc(grade)}
            </div>

            {/* Findings */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {findings.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: f.color, flexShrink: 0 }} />
                  <span style={{ color: "var(--text-secondary)" }}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* Trend indicator */}
            {highTrend && (
              <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 11 }}>
                <span style={{
                  padding: "3px 10px", borderRadius: 4,
                  background: highTrend.delta > 0 ? "var(--red-dim)" : highTrend.delta < 0 ? "var(--green-dim)" : "var(--blue-dim)",
                  color: highTrend.delta > 0 ? "var(--red)" : highTrend.delta < 0 ? "var(--green)" : "var(--blue)",
                  fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                }}>
                  {highTrend.delta > 0 ? `+${highTrend.delta}` : highTrend.delta < 0 ? String(highTrend.delta) : "0"} ryzyk wysokich m/m
                  {highTrend.delta > 0 ? " ▲" : highTrend.delta < 0 ? " ▼" : " ■"}
                </span>
                {highTrend.totalDelta !== 0 && (
                  <span style={{
                    padding: "3px 10px", borderRadius: 4, background: "var(--bg-subtle)",
                    color: "var(--text-muted)", fontFamily: "'JetBrains Mono',monospace",
                  }}>
                    {highTrend.totalDelta > 0 ? "+" : ""}{highTrend.totalDelta} ogółem m/m
                  </span>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Recommendations */}
          {recommendations.length > 0 && (
            <div style={{ flexShrink: 0, minWidth: 200, maxWidth: 260 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
                Rekomendowane Działania
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {recommendations.slice(0, 4).map((r, i) => (
                  <div key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 6,
                      background: "var(--bg-subtle)", border: "1px solid var(--border)",
                      cursor: "pointer", transition: "var(--transition)", fontSize: 12, color: "var(--text-secondary)",
                    }}
                    onClick={() => r.link !== "#" && navigate(r.link)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-light)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  >
                    <span style={{ color: "var(--blue)", fontSize: 11, flexShrink: 0 }}>►</span>
                    <span>{r.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
           KPI ROW — Enhanced metrics
         ═══════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 16 }}>

        {/* Risk Exposure */}
        <div className="card clickable" onClick={() => navigate(buildLink("/risks", { org_unit_id: orgFilter || null }))} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
            Ekspozycja na Ryzyko
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--text-primary)", lineHeight: 1 }}>
            {rc.total}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{pluralPL(rc.total, "ryzyko", "ryzyka", "ryzyk")} ogółem</div>
          {/* Segmented risk bar */}
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--bg-subtle)" }}>
            {rc.high > 0 && <div style={{ width: `${highPct}%`, background: "var(--red)" }} />}
            {rc.medium > 0 && <div style={{ width: `${medPct}%`, background: "var(--orange)" }} />}
            {rc.low > 0 && <div style={{ flex: 1, background: "var(--green)" }} />}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
            <span style={{ color: "var(--red)" }}>{rc.high} wys.</span>
            <span style={{ color: "var(--orange)" }}>{rc.medium} śr.</span>
            <span style={{ color: "var(--green)" }}>{rc.low} nis.</span>
          </div>
        </div>

        {/* CIS Compliance */}
        <div className="card clickable" onClick={() => navigate("/cis")} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
            Zgodność CIS
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--yellow)", lineHeight: 1 }}>
            {exec?.cis_maturity_rating != null ? exec.cis_maturity_rating.toFixed(1) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>maturity / 5.0</div>
          {exec?.cis_risk_addressed_pct != null && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>
                <span>Adresowane ryzyka</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: pctColor(exec.cis_risk_addressed_pct) }}>
                  {Math.round(exec.cis_risk_addressed_pct)}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, overflow: "hidden", background: "var(--bg-subtle)" }}>
                <div style={{ width: `${exec.cis_risk_addressed_pct}%`, height: "100%", borderRadius: 3, background: pctColor(exec.cis_risk_addressed_pct), transition: "width 1s ease" }} />
              </div>
            </>
          )}
        </div>

        {/* Assets & CMDB */}
        <div className="card clickable" onClick={() => navigate("/assets")} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
            Aktywa CMDB
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "var(--purple)", lineHeight: 1 }}>
            {totalAssets || "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>zarejestrowanych aktywów</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>
            <span>Pokrycie kategorii</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: pctColor(cmdbCoverage) }}>
              {cmdbCoverage}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, overflow: "hidden", background: "var(--bg-subtle)" }}>
            <div style={{ width: `${cmdbCoverage}%`, height: "100%", borderRadius: 3, background: "var(--purple)", transition: "width 1s ease" }} />
          </div>
        </div>

        {/* Incidents & Vulnerabilities */}
        <div className="card clickable" onClick={() => navigate("/vulnerabilities")} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
            Incydenty & Podatności
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: incidents > 0 ? "var(--red)" : "var(--green)", lineHeight: 1 }}>
                {incidents}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>incydentów</div>
            </div>
            <div style={{ width: 1, height: 30, background: "var(--border)" }} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: vulns > 5 ? "var(--orange)" : vulns > 0 ? "var(--yellow)" : "var(--green)", lineHeight: 1 }}>
                {vulns}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>podatności</div>
            </div>
          </div>
          {(incidents > 0 || vulns > 0) && (
            <div style={{ marginTop: 8, padding: "3px 8px", borderRadius: 4, background: incidents > 0 ? "var(--red-dim)" : "var(--yellow-dim)", color: incidents > 0 ? "var(--red)" : "var(--yellow)", fontSize: 10, display: "inline-block" }}>
              {incidents > 0 ? "Wymaga natychmiastowej reakcji" : "Zaplanuj remediację"}
            </div>
          )}
        </div>

        {/* Review Discipline */}
        <div className="card clickable" onClick={() => navigate("/reviews")} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
            Dyscyplina Przeglądów
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: (exec?.overdue_reviews_count ?? 0) > 0 ? "var(--orange)" : "var(--green)", lineHeight: 1 }}>
            {exec?.overdue_reviews_count ?? 0}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>przeterminowanych</div>
          {rc.total > 0 && (() => {
            const onTime = rc.total - (exec?.overdue_reviews_count ?? 0);
            const onTimePct = Math.round((onTime / rc.total) * 100);
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>
                  <span>Terminowość</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: pctColor(onTimePct) }}>{onTimePct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, overflow: "hidden", background: "var(--bg-subtle)" }}>
                  <div style={{ width: `${onTimePct}%`, height: "100%", borderRadius: 3, background: pctColor(onTimePct), transition: "width 1s ease" }} />
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ═══════════════════════════════════════
           RISK MATRIX + SECURITY POSTURE
         ═══════════════════════════════════════ */}
      <div className="grid-2-1">
        {/* Left: Risk Matrix (unchanged) */}
        <div className="card">
          <div className="card-title">Macierz Ryzyka (Wpływ x Prawdopodobieństwo)</div>
          <div style={{ padding: "8px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(3, 1fr)", gap: 6, maxWidth: 400 }}>
              <div />
              {["W=1 Niski", "W=2 Średni", "W=3 Wysoki"].map(h => (
                <div key={h} className="heatmap-header">{h}</div>
              ))}
              {[3, 2, 1].map(prob => (
                <div key={`row-${prob}`} style={{ display: "contents" }}>
                  <div className="heatmap-label" style={{ lineHeight: "40px" }}>P={prob}</div>
                  {[1, 2, 3].map(impact => {
                    const cnt = riskDash ? matrixCount(riskDash.matrix, impact, prob) : 0;
                    return (
                      <div key={`${impact}-${prob}`} className="heatmap-cell"
                        style={{
                          background: cnt > 0 ? matrixBg(impact, prob) : "var(--bg-subtle)",
                          color: cnt > 0 ? "#fff" : "var(--text-muted)",
                          height: 40,
                          opacity: cnt > 0 ? 1 : 0.5,
                          cursor: cnt > 0 ? "pointer" : "default",
                        }}
                        onClick={() => cnt > 0 && navigate(buildLink("/risks", { impact, prob, org_unit_id: orgFilter || null }))}
                      >
                        {cnt > 0 ? cnt : "—"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
              R = EXP(W) &times; P / Z &nbsp;|&nbsp; Wysoki &ge;221 &nbsp; Średni 31–220 &nbsp; Niski &lt;31
            </div>
          </div>

          {/* Risk by Area breakdown */}
          {riskDash && riskDash.by_area.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Ryzyka wg Obszarów</div>
              {riskDash.by_area.map(a => (
                <div key={a.area_id} className="bar-row">
                  <div className="bar-label">{a.area_name}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${Math.min(100, (a.total / Math.max(1, rc.total)) * 100)}%`,
                      background: `linear-gradient(90deg, var(--red) ${(a.high / Math.max(1, a.total)) * 100}%, var(--orange) ${(a.high / Math.max(1, a.total)) * 100}%, var(--orange) ${((a.high + a.medium) / Math.max(1, a.total)) * 100}%, var(--green) ${((a.high + a.medium) / Math.max(1, a.total)) * 100}%)`,
                    }} data-value={String(a.total)} />
                  </div>
                  <div className="bar-score" style={{ color: a.high > 0 ? "var(--red)" : "var(--text-secondary)" }}>{a.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Enhanced Security Posture */}
        <div>
          {/* Score Overview */}
          <div className="card" style={{ textAlign: "center", paddingBottom: 16 }}>
            <div className="card-title">Security Posture Score</div>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <div className="score-ring" style={{ width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="70" cy="70" r="58" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle cx="70" cy="70" r="58" fill="none"
                    stroke={gradeColor(grade)} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 58}
                    strokeDashoffset={2 * Math.PI * 58 - (score / 100) * 2 * Math.PI * 58}
                    style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)" }} />
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                  <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: gradeColor(grade), lineHeight: 1 }}>
                    {score ? Math.round(score) : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>/ 100</div>
                </div>
              </div>
            </div>
            {grade && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: gradeColor(grade) }}>
                  {grade}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4, padding: "0 8px" }}>
                  {gradeDesc(grade)}
                </div>
              </div>
            )}
            {/* Benchmark comparison */}
            {posture?.benchmark_avg != null && (
              <div style={{ marginTop: 10, padding: "6px 12px", borderRadius: 6, background: "var(--bg-subtle)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span style={{ color: "var(--text-muted)" }}>vs. średnia org:</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: score >= posture.benchmark_avg ? "var(--green)" : "var(--orange)" }}>
                  {score >= posture.benchmark_avg ? "+" : ""}{(score - posture.benchmark_avg).toFixed(0)} pkt
                </span>
              </div>
            )}
          </div>

          {/* Posture Dimensions with insights */}
          {posture && posture.dimensions.length > 0 && (
            <div className="card">
              <div className="card-title">Wymiary Bezpieczeństwa</div>
              {posture.dimensions.map(d => {
                const isWeak = weakDim?.name === d.name && d.score < 70;
                return (
                  <div key={d.name} style={{ marginBottom: 12, padding: isWeak ? "8px 10px" : 0, borderRadius: 6, background: isWeak ? "rgba(239,68,68,0.05)" : "transparent", border: isWeak ? "1px solid rgba(239,68,68,0.15)" : "1px solid transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                        {d.name}
                        {isWeak && <span style={{ fontSize: 9, color: "var(--red)", fontWeight: 600 }}>WYMAGA UWAGI</span>}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: pctColor(d.score) }}>
                        {Math.round(d.score)}%
                        <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>({Math.round(d.weight * 100)}%)</span>
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <div className="bar-track" style={{ height: 8 }}>
                        <div className="bar-fill" style={{ width: `${d.score}%`, background: d.color ?? pctColor(d.score), height: 8 }} />
                      </div>
                      {/* 70% threshold marker */}
                      <div style={{ position: "absolute", left: "70%", top: -2, width: 1, height: 12, background: "var(--text-muted)", opacity: 0.4 }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
                <div style={{ width: 1, height: 10, background: "var(--text-muted)", opacity: 0.4 }} />
                <span>Próg akceptacji: 70%</span>
              </div>
            </div>
          )}

          {/* CIS Maturity */}
          <div className="card">
            <div className="card-title">CIS Maturity</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 28, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "var(--yellow)" }}>
                {exec?.cis_maturity_rating?.toFixed(2) ?? "—"}
              </div>
              <div>
                <div style={{ fontSize: 12 }}>Maturity Rating</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Skala 0–5</div>
              </div>
            </div>
            {exec?.cis_risk_addressed_pct != null && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "var(--text-secondary)" }}>% Risk Addressed</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: pctColor(exec.cis_risk_addressed_pct) }}>{Math.round(exec.cis_risk_addressed_pct)}%</span>
                </div>
                <div className="bar-track" style={{ height: 8 }}>
                  <div className="bar-fill" style={{ width: `${exec.cis_risk_addressed_pct}%`, background: pctColor(exec.cis_risk_addressed_pct), height: 8 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
           TOP RISKS + DISTRIBUTION
         ═══════════════════════════════════════ */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Top 5 Ryzyk Krytycznych</div>
          {exec?.top_risks && exec.top_risks.length > 0 ? (
            <table className="data-table">
              <thead><tr><th>Aktywo</th><th>Pion</th><th>Ocena</th><th>Status</th></tr></thead>
              <tbody>
                {exec.top_risks.slice(0, 5).map(r => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => navigate(buildLink("/risks", { highlight: r.id }))}>
                    <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                    <td style={{ fontSize: 12 }}>{r.org_unit}</td>
                    <td><span className="score-badge" style={{ background: riskBg(r.risk_level), color: riskColor(r.risk_level) }}>{Number(r.risk_score).toFixed(1)}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak danych o ryzykach.</p>
          )}
        </div>

        <div className="card">
          <div className="card-title">Rozkład Ryzyk</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Wysokie", count: rc.high, color: "var(--red)", bg: "var(--red-dim)", level: "high" },
              { label: "Średnie", count: rc.medium, color: "var(--orange)", bg: "var(--orange-dim)", level: "medium" },
              { label: "Niskie", count: rc.low, color: "var(--green)", bg: "var(--green-dim)", level: "low" },
            ].map(r => (
              <div key={r.label} style={{ flex: 1, textAlign: "center", background: r.bg, borderRadius: 8, padding: "12px 8px", cursor: "pointer" }}
                onClick={() => navigate(buildLink("/risks", { level: r.level, org_unit_id: orgFilter || null }))}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: r.color }}>{r.count}</div>
                <div style={{ fontSize: 11, color: r.color }}>{r.label}</div>
              </div>
            ))}
          </div>
          {riskDash && riskDash.by_org_unit.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Ryzyka wg Pionów</div>
              {riskDash.by_org_unit.map(u => (
                <div key={u.org_unit_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{u.org_unit_name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {u.high > 0 && <span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)" }}>{u.high}</span>}
                    {u.medium > 0 && <span className="score-badge" style={{ background: "var(--orange-dim)", color: "var(--orange)" }}>{u.medium}</span>}
                    {u.low > 0 && <span className="score-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>{u.low}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RISK BY STATUS */}
      {riskDash && riskDash.by_status.length > 0 && (
        <div className="card">
          <div className="card-title">Status Ryzyk</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {riskDash.by_status.map(s => (
              <div key={s.status} style={{
                background: s.status_color ? `${s.status_color}20` : "var(--bg-card)",
                border: `1px solid ${s.status_color ?? "var(--border)"}`,
                borderRadius: 8, padding: "10px 16px", textAlign: "center", minWidth: 100,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: s.status_color ?? "var(--text)" }}>{s.count}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RISK TREND */}
      {riskDash && riskDash.trend.length > 1 && (
        <div className="card">
          <div className="card-title">Trend Ryzyk (12 mies.)</div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 120 }}>
            {riskDash.trend.map(t => {
              const maxTotal = Math.max(...riskDash.trend.map(p => p.total), 1);
              const h = (t.total / maxTotal) * 100;
              const thighPct = (t.high / Math.max(t.total, 1)) * 100;
              const tmedPct = (t.medium / Math.max(t.total, 1)) * 100;
              return (
                <div key={t.period} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)" }}>{t.total}</div>
                  <div style={{ width: "100%", maxWidth: 40, height: `${h}%`, minHeight: 2, borderRadius: "4px 4px 0 0", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: "100%", background: "var(--green)" }} />
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${thighPct + tmedPct}%`, background: "var(--orange)" }} />
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${thighPct}%`, background: "var(--red)" }} />
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.period}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 10 }}>
            {[{ label: "Wysokie", color: "var(--red)" }, { label: "Średnie", color: "var(--orange)" }, { label: "Niskie", color: "var(--green)" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} /> {l.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OVERDUE REVIEWS */}
      {riskDash && riskDash.overdue_reviews.length > 0 && (
        <div className="card">
          <div className="card-title">
            Przeterminowane Przeglądy
            <span style={{ fontSize: 11, color: "var(--red)", marginLeft: 8 }}>({riskDash.overdue_reviews.length})</span>
          </div>
          <table className="data-table">
            <thead><tr><th>Aktywo</th><th>Pion</th><th>Ocena</th><th>Dni od przeglądu</th><th>Właściciel</th></tr></thead>
            <tbody>
              {riskDash.overdue_reviews.slice(0, 10).map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                  <td style={{ fontSize: 12 }}>{r.org_unit}</td>
                  <td><span className="score-badge" style={{ background: riskBg(r.risk_level), color: riskColor(r.risk_level) }}>{Number(r.risk_score).toFixed(1)}</span></td>
                  <td><span className="score-badge" style={{ background: "var(--red-dim)", color: "var(--red)" }}>{r.days_since_review} dni</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.owner ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
