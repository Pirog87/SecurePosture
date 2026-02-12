import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../services/api";
import type { CisControl, CisAssessment, OrgUnitTreeNode, DictionaryTypeWithEntries } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";

function flattenTree(nodes: OrgUnitTreeNode[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

const dimColors: Record<string, string> = {
  policy: "var(--blue)", impl: "var(--green)", auto: "var(--purple)", report: "var(--cyan)",
};

function selectColor(val: string): string {
  if (!val || val === "N/A") return "var(--text-muted)";
  const n = Number(val);
  if (n >= 4) return "var(--green)";
  if (n >= 3) return "var(--cyan)";
  if (n >= 2) return "var(--yellow)";
  if (n >= 1) return "var(--orange)";
  return "var(--red)";
}

function dimAvgColor(v: number): string {
  if (v >= 4) return "var(--green)";
  if (v >= 3) return "var(--cyan)";
  if (v >= 2) return "var(--yellow)";
  if (v >= 1) return "var(--orange)";
  return "var(--red)";
}

interface AnswerVals { policy: string; impl: string; auto: string; report: string }

export default function CisAssessPage() {
  const [controls, setControls] = useState<CisControl[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>("");
  const [statuses, setStatuses] = useState<{ id: number; label: string }[]>([]);
  const answersRef = useRef<Map<string, AnswerVals>>(new Map());
  const [summary, setSummary] = useState({ total: 0, answered: 0, policyAvg: 0, implAvg: 0, autoAvg: 0, reportAvg: 0, overallAvg: 0 });
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<CisControl[]>("/api/v1/cis/controls").catch(() => []),
      api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").catch(() => [] as OrgUnitTreeNode[]),
      api.get<DictionaryTypeWithEntries>("/api/v1/dictionaries/cis_assessment_status/entries")
        .then(d => d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label })))
        .catch(() => []),
    ]).then(([c, tree, sts]) => {
      setControls(c);
      setOrgTree(tree);
      setStatuses(sts);
      const totalSubs = c.reduce((sum, ctrl) => sum + ctrl.sub_controls.length, 0);
      setSummary(prev => ({ ...prev, total: totalSubs }));
    }).finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const expandAll = () => setExpanded(new Set(controls.map(c => c.id)));
  const collapseAll = () => setExpanded(new Set());

  const recalcSummary = useCallback(() => {
    let answered = 0, pSum = 0, iSum = 0, aSum = 0, rSum = 0, pCnt = 0, iCnt = 0, aCnt = 0, rCnt = 0;
    answersRef.current.forEach(vals => {
      const hasAny = vals.policy || vals.impl || vals.auto || vals.report;
      if (hasAny) answered++;
      if (vals.policy && vals.policy !== "N/A") { pSum += Number(vals.policy); pCnt++; }
      if (vals.impl && vals.impl !== "N/A") { iSum += Number(vals.impl); iCnt++; }
      if (vals.auto && vals.auto !== "N/A") { aSum += Number(vals.auto); aCnt++; }
      if (vals.report && vals.report !== "N/A") { rSum += Number(vals.report); rCnt++; }
    });
    const pAvg = pCnt > 0 ? pSum / pCnt : 0;
    const iAvg = iCnt > 0 ? iSum / iCnt : 0;
    const aAvg = aCnt > 0 ? aSum / aCnt : 0;
    const rAvg = rCnt > 0 ? rSum / rCnt : 0;
    const allCnt = pCnt + iCnt + aCnt + rCnt;
    const allSum = pSum + iSum + aSum + rSum;
    setSummary(prev => ({ ...prev, answered, policyAvg: pAvg, implAvg: iAvg, autoAvg: aAvg, reportAvg: rAvg, overallAvg: allCnt > 0 ? allSum / allCnt : 0 }));
  }, []);

  const handleDimChange = (subControlId: number, dim: string, value: string) => {
    const key = String(subControlId);
    const prev = answersRef.current.get(key) ?? { policy: "", impl: "", auto: "", report: "" };
    answersRef.current.set(key, { ...prev, [dim]: value });
    recalcSummary();
  };

  const collectAnswers = () => {
    const answers: { sub_control_id: number; policy_value: number | null; impl_value: number | null; auto_value: number | null; report_value: number | null; is_not_applicable: boolean }[] = [];
    answersRef.current.forEach((vals, key) => {
      const subControlId = Number(key);
      const isNA = vals.policy === "N/A" || vals.impl === "N/A" || vals.auto === "N/A" || vals.report === "N/A";
      answers.push({
        sub_control_id: subControlId,
        policy_value: vals.policy && vals.policy !== "N/A" ? Number(vals.policy) : null,
        impl_value: vals.impl && vals.impl !== "N/A" ? Number(vals.impl) : null,
        auto_value: vals.auto && vals.auto !== "N/A" ? Number(vals.auto) : null,
        report_value: vals.report && vals.report !== "N/A" ? Number(vals.report) : null,
        is_not_applicable: isNA,
      });
    });
    return answers;
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      let aId = assessmentId;
      if (!aId) {
        const draftStatus = statuses.find(s => s.label.toLowerCase().includes("robocz"));
        const created = await api.post<CisAssessment>("/api/v1/cis/assessments", {
          org_unit_id: selectedOrgUnit ? Number(selectedOrgUnit) : null, assessor_name: "CISO", status_id: draftStatus?.id ?? null,
        });
        aId = created.id;
        setAssessmentId(aId);
      }
      const answers = collectAnswers();
      if (answers.length > 0) await api.post(`/api/v1/cis/assessments/${aId}/answers`, { answers });
      alert("Zapisano roboczą wersję oceny.");
    } catch (err) { alert("Błąd zapisu: " + err); }
    finally { setSaving(false); }
  };

  const approve = async () => {
    if (!confirm("Zatwierdzić ocenę CIS? Po zatwierdzeniu edycja nie będzie możliwa.")) return;
    setSaving(true);
    try {
      let aId = assessmentId;
      const approvedStatus = statuses.find(s => s.label.toLowerCase().includes("zatwierdz"));
      if (!aId) {
        const created = await api.post<CisAssessment>("/api/v1/cis/assessments", {
          org_unit_id: selectedOrgUnit ? Number(selectedOrgUnit) : null, assessor_name: "CISO", status_id: approvedStatus?.id ?? null,
        });
        aId = created.id; setAssessmentId(aId);
      } else if (approvedStatus) {
        await api.put(`/api/v1/cis/assessments/${aId}`, { status_id: approvedStatus.id });
      }
      const answers = collectAnswers();
      if (answers.length > 0) await api.post(`/api/v1/cis/assessments/${aId}/answers`, { answers });
      alert("Ocena CIS została zatwierdzona.");
    } catch (err) { alert("Błąd: " + err); }
    finally { setSaving(false); }
  };

  const pctFill = summary.total > 0 ? Math.round((summary.answered / summary.total) * 100) : 0;

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left" style={{ alignItems: "center" }}>
          <OrgUnitTreeSelect
            tree={orgTree}
            value={selectedOrgUnit ? Number(selectedOrgUnit) : null}
            onChange={id => setSelectedOrgUnit(id ? String(id) : "")}
            placeholder="Cała organizacja"
            allowClear
            style={{ width: 300 }}
          />
          <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
            {assessmentId ? `Ocena #${assessmentId}` : "Nowa ocena"}
          </span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-sm" onClick={expandAll}>Rozwiń</button>
          <button className="btn btn-sm" onClick={collapseAll}>Zwiń</button>
          <button className="btn btn-sm" onClick={saveDraft} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz roboczą"}</button>
          <button className="btn btn-primary btn-sm" onClick={approve} disabled={saving}>Zatwierdź</button>
        </div>
      </div>

      {/* SUMMARY HEADER */}
      {!loading && controls.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="card-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              Podsumowanie Oceny CIS
              <span
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "var(--blue-dim)", color: "var(--blue)", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                onClick={() => setShowMethodology(!showMethodology)}
                title="Metodyka oceny"
              >i</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {summary.answered} / {summary.total} sub-kontroli ({pctFill}%)
            </div>
          </div>

          {showMethodology && (
            <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid var(--blue)", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--blue)" }}>Metodyka CIS Maturity:</strong><br />
              Każda sub-kontrola oceniana w 4 wymiarach: Policy, Implementation, Automation, Reporting (skala 0-5).<br />
              <strong>Maturity Rating</strong> = średnia ze wszystkich ocen wymiarów (0-5). Ocena 5 = pełna dojrzałość.<br />
              <strong>% Risk Addressed</strong> = (suma ocen / maks. możliwa suma) &times; 100%<br />
              <strong>IG1/IG2/IG3</strong> = oddzielne średnie dla sub-kontroli przypisanych do Implementation Groups.<br />
              Skala: <span style={{ color: "var(--green)" }}>4-5 Wysoka</span> · <span style={{ color: "var(--cyan)" }}>3 Dobra</span> · <span style={{ color: "var(--yellow)" }}>2 Średnia</span> · <span style={{ color: "var(--orange)" }}>1 Niska</span> · <span style={{ color: "var(--red)" }}>0 Brak</span>
            </div>
          )}

          <div className="bar-track" style={{ height: 8, marginBottom: 14 }}>
            <div className="bar-fill" style={{ width: `${pctFill}%`, background: pctFill >= 75 ? "var(--green)" : pctFill >= 50 ? "var(--yellow)" : pctFill >= 25 ? "var(--orange)" : "var(--red)", height: 8 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            <div style={{ textAlign: "center", padding: "8px 4px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: dimAvgColor(summary.overallAvg) }}>
                {summary.overallAvg > 0 ? summary.overallAvg.toFixed(2) : "—"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Maturity</div>
            </div>
            {[
              { key: "policy", label: "Policy", avg: summary.policyAvg, color: "var(--blue)" },
              { key: "impl", label: "Implemented", avg: summary.implAvg, color: "var(--green)" },
              { key: "auto", label: "Automated", avg: summary.autoAvg, color: "var(--purple)" },
              { key: "report", label: "Reported", avg: summary.reportAvg, color: "var(--cyan)" },
            ].map(d => (
              <div key={d.key} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 8, background: `${d.color}10` }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: d.color }}>
                  {d.avg > 0 ? d.avg.toFixed(1) : "—"}
                </div>
                <div style={{ fontSize: 10, color: d.color }}>{d.label}</div>
                <div className="bar-track" style={{ height: 4, marginTop: 4 }}>
                  <div className="bar-fill" style={{ width: `${(d.avg / 5) * 100}%`, background: d.color, height: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie kontroli CIS...</div>
      ) : controls.length === 0 ? (
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak kontroli CIS lub brak połączenia z API.</p>
        </div>
      ) : (
        <div>
          {controls.map((c) => {
            const isExpanded = expanded.has(c.id);
            return (
              <div key={c.id} className={`cis-control-card${isExpanded ? " expanded" : ""}`}>
                <div className="cis-control-header" onClick={() => toggle(c.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)", minWidth: 50 }}>
                      CSC #{c.control_number}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name_pl}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.sub_controls.length} sub-kontroli</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "0 18px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr repeat(4, 110px)", gap: 8, padding: "8px 0", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      <div style={{ color: "var(--text-muted)" }}>#</div>
                      <div style={{ color: "var(--text-muted)" }}>Kontrola</div>
                      <div style={{ color: dimColors.policy }}>Policy</div>
                      <div style={{ color: dimColors.impl }}>Implemented</div>
                      <div style={{ color: dimColors.auto }}>Automated</div>
                      <div style={{ color: dimColors.report }}>Reported</div>
                    </div>
                    {c.sub_controls.map((sc) => (
                      <div key={sc.id} style={{
                        display: "grid", gridTemplateColumns: "60px 1fr repeat(4, 110px)",
                        gap: 8, alignItems: "center", padding: "8px 0",
                        borderBottom: "1px solid rgba(42,53,84,0.25)", fontSize: 12,
                      }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)", fontSize: 11 }}>
                          {sc.sub_id}
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.3 }}>
                          {sc.detail_pl || sc.detail_en || `Sub-kontrola ${sc.sub_id}`}
                        </div>
                        {(["policy", "impl", "auto", "report"] as const).map((dim) => (
                          <select key={dim} className="cis-select" style={{ borderColor: dimColors[dim] }}
                            onChange={e => {
                              handleDimChange(sc.id, dim, e.target.value);
                              e.target.style.color = selectColor(e.target.value);
                            }}>
                            <option value="">—</option>
                            {[0, 1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                            <option value="N/A">N/A</option>
                          </select>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
