import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import type { CisControl, CisAssessment, OrgUnitTreeNode, DictionaryTypeWithEntries } from "../types";

function flattenTree(nodes: OrgUnitTreeNode[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

export default function CisAssessPage() {
  const [controls, setControls] = useState<CisControl[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [orgUnits, setOrgUnits] = useState<{ id: number; name: string; depth: number }[]>([]);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>("");
  const [statuses, setStatuses] = useState<{ id: number; label: string }[]>([]);
  const answersRef = useRef<Map<string, { policy: string; impl: string; auto: string; report: string }>>(new Map());

  useEffect(() => {
    Promise.all([
      api.get<CisControl[]>("/api/v1/cis/controls").catch(() => []),
      api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").catch(() => [] as OrgUnitTreeNode[]),
      api.get<DictionaryTypeWithEntries>("/api/v1/dictionaries/cis_assessment_status/entries")
        .then(d => d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label })))
        .catch(() => []),
    ]).then(([c, tree, sts]) => {
      setControls(c);
      setOrgUnits(flattenTree(tree));
      setStatuses(sts);
    }).finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDimChange = (subControlId: number, dim: string, value: string) => {
    const key = String(subControlId);
    const prev = answersRef.current.get(key) ?? { policy: "", impl: "", auto: "", report: "" };
    answersRef.current.set(key, { ...prev, [dim]: value });
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
        const body: Record<string, unknown> = {
          org_unit_id: selectedOrgUnit ? Number(selectedOrgUnit) : null,
          assessor_name: "CISO",
          status_id: draftStatus?.id ?? null,
        };
        const created = await api.post<CisAssessment>("/api/v1/cis/assessments", body);
        aId = created.id;
        setAssessmentId(aId);
      }
      const answers = collectAnswers();
      if (answers.length > 0) {
        await api.post(`/api/v1/cis/assessments/${aId}/answers`, { answers });
      }
      alert("Zapisano roboczą wersję oceny.");
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!confirm("Zatwierdzić ocenę CIS? Po zatwierdzeniu edycja nie będzie możliwa.")) return;
    setSaving(true);
    try {
      let aId = assessmentId;
      const approvedStatus = statuses.find(s => s.label.toLowerCase().includes("zatwierdz"));
      if (!aId) {
        const body: Record<string, unknown> = {
          org_unit_id: selectedOrgUnit ? Number(selectedOrgUnit) : null,
          assessor_name: "CISO",
          status_id: approvedStatus?.id ?? null,
        };
        const created = await api.post<CisAssessment>("/api/v1/cis/assessments", body);
        aId = created.id;
        setAssessmentId(aId);
      } else if (approvedStatus) {
        await api.put(`/api/v1/cis/assessments/${aId}`, { status_id: approvedStatus.id });
      }
      const answers = collectAnswers();
      if (answers.length > 0) {
        await api.post(`/api/v1/cis/assessments/${aId}/answers`, { answers });
      }
      alert("Ocena CIS została zatwierdzona.");
    } catch (err) {
      alert("Błąd: " + err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left" style={{ alignItems: "center" }}>
          <select className="form-control" style={{ width: 200 }} value={selectedOrgUnit} onChange={e => setSelectedOrgUnit(e.target.value)}>
            <option value="">Cała organizacja</option>
            {orgUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
          </select>
          <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
            {assessmentId ? `Ocena #${assessmentId}` : "Nowa ocena"}
          </span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-sm" onClick={saveDraft} disabled={saving}>
            {saving ? "Zapisywanie..." : "💾 Zapisz roboczą"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={approve} disabled={saving}>
            ✅ Zatwierdź
          </button>
        </div>
      </div>

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
                      CSC #{c.number}
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
                    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr repeat(4, 110px)", gap: 8, padding: "8px 0", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      <div>#</div><div>Kontrola</div>
                      <div>Policy</div><div>Implemented</div><div>Automated</div><div>Reported</div>
                    </div>
                    {c.sub_controls.map((sc) => (
                      <div key={sc.id} style={{
                        display: "grid",
                        gridTemplateColumns: "60px 1fr repeat(4, 110px)",
                        gap: 8, alignItems: "center", padding: "8px 0",
                        borderBottom: "1px solid rgba(42,53,84,0.25)", fontSize: 12,
                      }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)", fontSize: 11 }}>
                          {sc.number}
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.3 }}>
                          {sc.name_pl || sc.name_en || `Sub-kontrola ${sc.number}`}
                        </div>
                        {(["policy", "impl", "auto", "report"] as const).map((dim) => (
                          <select key={dim} className="cis-select" onChange={e => handleDimChange(sc.id, dim, e.target.value)}>
                            <option value="">Wybierz...</option>
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
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
