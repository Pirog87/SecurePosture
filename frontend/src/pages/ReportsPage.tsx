import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

interface AIReportHistoryItem {
  id: number;
  title: string;
  generated_at: string;
}

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  endpoint: string;
  params?: { key: string; label: string; type: "number" | "text" }[];
}

const REPORTS: ReportDef[] = [
  {
    id: "executive",
    title: "Executive Summary",
    description: "Podsumowanie wykonawcze: KPI, top ryzyka, przeglad aktywow wg kategorii CMDB.",
    icon: "📊",
    endpoint: "/api/v1/reports/executive",
  },
  {
    id: "risks",
    title: "Rejestr Ryzyk",
    description: "Pelny rejestr ryzyk z ocenami, statusami, wlascicielami i terminami.",
    icon: "⚠️",
    endpoint: "/api/v1/reports/risks",
    params: [{ key: "org_unit_id", label: "Jednostka org. (ID, opcjonalnie)", type: "number" }],
  },
  {
    id: "assets",
    title: "Rejestr Aktywow (CMDB)",
    description: "Lista aktywow z kategoriami CMDB, wlascicielami, lokalizacjami i ryzykami.",
    icon: "🖥️",
    endpoint: "/api/v1/reports/assets",
    params: [{ key: "asset_category_id", label: "Kategoria CMDB (ID, opcjonalnie)", type: "number" }],
  },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<AIReportData | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<AIReportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/reports/ai-management/history`);
      if (res.ok) setAiHistory(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleGenerate = async (report: ReportDef, formData?: Record<string, string>) => {
    setGenerating(report.id);
    try {
      const params = new URLSearchParams();
      if (formData) {
        for (const [k, v] of Object.entries(formData)) {
          if (v) params.set(k, v);
        }
      }
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}${report.endpoint}${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `raport_${report.id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Blad generowania raportu: " + err);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiReport(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/reports/ai-management`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAiReport(data);
      fetchHistory();
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleLoadReport = async (id: number) => {
    setHistoryLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/reports/ai-management/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAiReport(await res.json());
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Raporty</h2>
        <span className="score-badge" style={{ background: "var(--cyan-dim, rgba(6,182,212,0.15))", color: "var(--cyan, #06B6D4)", fontSize: 11 }}>
          Excel / XLSX
        </span>
      </div>

      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {REPORTS.map(report => (
          <ReportCard
            key={report.id}
            report={report}
            generating={generating === report.id}
            onGenerate={handleGenerate}
          />
        ))}
      </div>

      {/* AI Management Report Section */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Raport Zarzadczy AI</h2>
        <span className="score-badge" style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", fontSize: 11 }}>
          AI / LLM
        </span>
      </div>

      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(124,58,237,0.12)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#7c3aed" stroke="none">
                <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
                <path d="M5 3L5.5 5L7 5.5L5.5 6L5 8L4.5 6L3 5.5L4.5 5L5 3Z" opacity="0.7" />
                <path d="M19 14L19.5 16L21 16.5L19.5 17L19 19L18.5 17L17 16.5L18.5 16L19 14Z" opacity="0.7" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                Raport Zarzadczy AI
                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "rgba(124,58,237,0.15)", color: "#7c3aed" }}>AI</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                Kompleksowy raport dla zarzadu generowany przez AI na podstawie aktualnych danych:
                ryzyka, aktywa, podatnosci, incydenty, compliance, Security Score.
              </div>
            </div>
          </div>
          <div style={{ marginTop: "auto" }}>
            <button
              className="btn btn-primary"
              style={{ width: "100%", background: aiLoading ? undefined : "#7c3aed" }}
              disabled={aiLoading}
              onClick={handleGenerateAI}
            >
              {aiLoading ? "Generowanie raportu AI..." : "Generuj raport AI"}
            </button>
          </div>
        </div>
      </div>

      {/* Report History */}
      {aiHistory.length > 0 && (
        <div className="card no-print" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
            Zapisane raporty ({aiHistory.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {aiHistory.map(h => (
              <button
                key={h.id}
                className="btn btn-sm"
                style={{ textAlign: "left", fontSize: 12, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: historyLoading ? 0.6 : 1 }}
                disabled={historyLoading}
                onClick={() => handleLoadReport(h.id)}
              >
                <span>{h.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(h.generated_at).toLocaleString("pl-PL")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {aiError && (
        <div className="card" style={{ marginTop: 16, borderLeft: "4px solid #ef4444", background: "rgba(239,68,68,0.05)" }}>
          <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>Blad generowania raportu AI</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{aiError}</div>
        </div>
      )}

      {aiReport && <AIReportView data={aiReport} />}
    </div>
  );
}

/* ═══ XLSX Report Card (existing) ═══ */

function ReportCard({ report, generating, onGenerate }: {
  report: ReportDef;
  generating: boolean;
  onGenerate: (report: ReportDef, formData?: Record<string, string>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 28 }}>{report.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            {report.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
            {report.description}
          </div>
        </div>
      </div>

      {report.params && report.params.length > 0 && (
        <div>
          {!expanded ? (
            <button className="btn btn-sm" style={{ fontSize: 11, marginBottom: 8 }} onClick={() => setExpanded(true)}>
              Parametry filtrowania...
            </button>
          ) : (
            <div style={{ marginBottom: 10, padding: 10, background: "var(--bg-inset)", borderRadius: 6, border: "1px solid var(--border)" }}>
              {report.params.map(p => (
                <div className="form-group" key={p.key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.label}</label>
                  <input
                    className="form-control"
                    type={p.type}
                    value={formValues[p.key] || ""}
                    onChange={e => setFormValues(prev => ({ ...prev, [p.key]: e.target.value }))}
                    style={{ fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "auto" }}>
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={generating}
          onClick={() => onGenerate(report, formValues)}
        >
          {generating ? "Generowanie..." : "Pobierz raport (XLSX)"}
        </button>
      </div>
    </div>
  );
}

/* ═══ AI Report Types & View ═══ */

interface AIReportData {
  generated_at: string;
  report: {
    executive_summary?: string;
    risk_assessment?: {
      overall_rating?: string;
      analysis?: string;
      key_concerns?: { concern?: string; description?: string; rationale?: string }[];
    };
    strengths?: { area: string; description: string }[];
    critical_findings?: { finding: string; severity: string; impact: string; recommendation: string }[];
    recommendations?: { action: string; priority: number; rationale: string; estimated_effort?: string; responsible_role?: string }[];
    action_plan?: { action: string; deadline_days: number; responsible_role: string; expected_outcome: string }[];
    kpi_targets?: { kpi_name: string; current_value: string | number; target_value: string | number; rationale: string }[];
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  krytyczny: "#dc2626",
  wysoki: "#ef4444",
  sredni: "#f59e0b",
  niski: "#22c55e",
};

const RATING_COLORS: Record<string, string> = {
  krytyczny: "#dc2626",
  wysoki: "#ef4444",
  umiarkowany: "#f59e0b",
  niski: "#22c55e",
};

function AIReportView({ data }: { data: AIReportData }) {
  const r = data.report;
  const genDate = new Date(data.generated_at).toLocaleString("pl-PL");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="card" style={{ marginTop: 24, padding: 24 }} id="ai-report">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, borderBottom: "2px solid var(--border)", paddingBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#7c3aed", display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#7c3aed" stroke="none">
              <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
              <path d="M5 3L5.5 5L7 5.5L5.5 6L5 8L4.5 6L3 5.5L4.5 5L5 3Z" opacity="0.7" />
              <path d="M19 14L19.5 16L21 16.5L19.5 17L19 19L18.5 17L17 16.5L18.5 16L19 14Z" opacity="0.7" />
            </svg>
            Raport Zarzadczy — SecurePosture
          </h3>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Wygenerowano: {genDate} | AI-powered
          </div>
        </div>
        <button className="btn btn-sm" onClick={handlePrint} style={{ fontSize: 11 }}>
          Drukuj / PDF
        </button>
      </div>

      {/* Executive Summary */}
      {r.executive_summary && (
        <Section title="Podsumowanie wykonawcze" icon="📋">
          <p style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line" }}>{r.executive_summary}</p>
        </Section>
      )}

      {/* Risk Assessment */}
      {r.risk_assessment && (
        <Section title="Ocena profilu ryzyka" icon="🎯">
          {r.risk_assessment.overall_rating && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ocena ogolna: </span>
              <span style={{
                fontSize: 13, fontWeight: 700, padding: "2px 10px", borderRadius: 4,
                background: `${RATING_COLORS[r.risk_assessment.overall_rating] || "#6b7280"}20`,
                color: RATING_COLORS[r.risk_assessment.overall_rating] || "#6b7280",
              }}>
                {r.risk_assessment.overall_rating.toUpperCase()}
              </span>
            </div>
          )}
          {r.risk_assessment.analysis && (
            <p style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line" }}>{r.risk_assessment.analysis}</p>
          )}
          {r.risk_assessment.key_concerns && r.risk_assessment.key_concerns.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-muted)" }}>Glowne obawy:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                {r.risk_assessment.key_concerns.map((c, i) => (
                  <li key={i}>{c.concern || c.description || JSON.stringify(c)}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Strengths */}
      {r.strengths && r.strengths.length > 0 && (
        <Section title="Mocne strony" icon="✅">
          <div style={{ display: "grid", gap: 8 }}>
            {r.strengths.map((s, i) => (
              <div key={i} style={{ padding: 10, background: "rgba(34,197,94,0.05)", borderRadius: 6, borderLeft: "3px solid #22c55e" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>{s.area}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.description}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Critical Findings */}
      {r.critical_findings && r.critical_findings.length > 0 && (
        <Section title="Krytyczne ustalenia" icon="🔴">
          <div style={{ display: "grid", gap: 8 }}>
            {r.critical_findings.map((f, i) => (
              <div key={i} style={{ padding: 10, background: "rgba(239,68,68,0.04)", borderRadius: 6, borderLeft: `3px solid ${SEVERITY_COLORS[f.severity] || "#6b7280"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.finding}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 4,
                    background: `${SEVERITY_COLORS[f.severity] || "#6b7280"}20`,
                    color: SEVERITY_COLORS[f.severity] || "#6b7280",
                  }}>
                    {f.severity}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  <strong>Wplyw:</strong> {f.impact}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  <strong>Rekomendacja:</strong> {f.recommendation}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recommendations */}
      {r.recommendations && r.recommendations.length > 0 && (
        <Section title="Rekomendacje" icon="💡">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600, width: 30 }}>P</th>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Dzialanie</th>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Naklad</th>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Rola</th>
              </tr>
            </thead>
            <tbody>
              {r.recommendations.sort((a, b) => a.priority - b.priority).map((rec, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px", fontWeight: 700, color: rec.priority <= 2 ? "#ef4444" : rec.priority <= 3 ? "#f59e0b" : "#6b7280" }}>
                    {rec.priority}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <div style={{ fontWeight: 500 }}>{rec.action}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{rec.rationale}</div>
                  </td>
                  <td style={{ padding: "8px", color: "var(--text-muted)" }}>{rec.estimated_effort || "-"}</td>
                  <td style={{ padding: "8px", color: "var(--text-muted)" }}>{rec.responsible_role || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Action Plan */}
      {r.action_plan && r.action_plan.length > 0 && (
        <Section title="Plan dzialan (90 dni)" icon="📅">
          <div style={{ display: "grid", gap: 8 }}>
            {r.action_plan.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: 10, background: "var(--bg-inset)", borderRadius: 6 }}>
                <div style={{ minWidth: 50, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6" }}>{a.deadline_days}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)" }}>dni</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.action}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {a.responsible_role} — {a.expected_outcome}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* KPI Targets */}
      {r.kpi_targets && r.kpi_targets.length > 0 && (
        <Section title="Cele KPI na nastepny kwartal" icon="📈">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>KPI</th>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Obecnie</th>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Cel</th>
                <th style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Uzasadnienie</th>
              </tr>
            </thead>
            <tbody>
              {r.kpi_targets.map((k, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px", fontWeight: 500 }}>{k.kpi_name}</td>
                  <td style={{ padding: "8px", color: "var(--text-muted)" }}>{String(k.current_value)}</td>
                  <td style={{ padding: "8px", fontWeight: 600, color: "#3b82f6" }}>{String(k.target_value)}</td>
                  <td style={{ padding: "8px", fontSize: 11, color: "var(--text-muted)" }}>{k.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
        <span>{icon}</span> {title}
      </h4>
      {children}
    </div>
  );
}
