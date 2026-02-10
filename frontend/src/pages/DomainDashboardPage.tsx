import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { DomainDashboard, DomainScoreCard, OrgUnitTreeNode } from "../types";
import { flattenTree } from "../utils/orgTree";

function gradeColor(g: string) {
  return g === "A" ? "var(--green)" : g === "B" ? "var(--cyan)" : g === "C" ? "var(--yellow)" : g === "D" ? "var(--orange)" : "var(--red)";
}
function riskColor(lv: string) { return lv === "high" ? "var(--red)" : lv === "medium" ? "var(--orange)" : "var(--green)"; }
function riskBg(lv: string) { return lv === "high" ? "var(--red-dim)" : lv === "medium" ? "var(--orange-dim)" : "var(--green-dim)"; }
function pctColor(v: number) { return v >= 75 ? "var(--green)" : v >= 50 ? "var(--yellow)" : v >= 25 ? "var(--orange)" : "var(--red)"; }

export default function DomainDashboardPage() {
  const [data, setData] = useState<DomainDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const navigate = useNavigate();

  const loadData = (orgUnitId?: string) => {
    setLoading(true);
    const qs = orgUnitId ? `?org_unit_id=${orgUnitId}` : "";
    api.get<DomainDashboard>(`/api/v1/domains/dashboard/scores${qs}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").then(setOrgTree).catch(() => {});
    loadData();
  }, []);

  const flatUnits = useMemo(() => flattenTree(orgTree), [orgTree]);

  const handleOrgChange = (val: string) => {
    setOrgFilter(val);
    loadData(val || undefined);
  };

  if (loading && !data) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ladowanie dashboardu domen...</span>
    </div>;
  }

  const overall = data?.overall_score ?? 0;
  const overallGrade = data?.overall_grade ?? "F";
  const domains = data?.domains ?? [];

  // Sort domains: by score ascending (worst first) for urgency view
  const sorted = [...domains].sort((a, b) => a.score - b.score);

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 220 }} value={orgFilter} onChange={e => handleOrgChange(e.target.value)}>
            <option value="">Cala organizacja</option>
            {flatUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
          </select>
          {loading && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odswiezanie...</span>}
        </div>
        <div className="toolbar-right">
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ogolny wynik</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: gradeColor(overallGrade) }}>
                {Math.round(overall)}
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, color: gradeColor(overallGrade) }}>{overallGrade}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Cards Grid */}
      {domains.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Brak zdefiniowanych domen bezpieczenstwa. Dodaj domeny w Konfiguracji.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {sorted.map(d => <DomainCard key={d.domain_id} domain={d} navigate={navigate} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Domain Score Card ─── */
function DomainCard({ domain: d, navigate }: { domain: DomainScoreCard; navigate: (to: string) => void }) {
  const gc = gradeColor(d.grade);
  const circ = 2 * Math.PI * 24;
  const offset = circ - (d.score / 100) * circ;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", cursor: "default" }}>
      {/* Header with color accent */}
      <div style={{
        padding: "12px 16px",
        borderBottom: `2px solid ${d.color ?? "var(--border)"}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${d.color ?? "var(--blue)"}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: d.color ?? "var(--blue)",
          }}>
            {d.icon ? iconChar(d.icon) : "?"}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{d.domain_name}</div>
            {d.owner && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.owner}</div>}
          </div>
        </div>

        {/* Score ring */}
        <div style={{ position: "relative", width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none"
              stroke={gc} strokeWidth="4"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "28px 28px" }}
            />
          </svg>
          <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: gc, lineHeight: 1 }}>
              {Math.round(d.score)}
            </div>
            <div style={{ fontSize: 9, color: gc }}>{d.grade}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px" }}>
        {/* Risk counts */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { label: "Wysokie", count: d.risk_high, color: "var(--red)", bg: "var(--red-dim)" },
            { label: "Srednie", count: d.risk_medium, color: "var(--orange)", bg: "var(--orange-dim)" },
            { label: "Niskie", count: d.risk_low, color: "var(--green)", bg: "var(--green-dim)" },
          ].map(r => (
            <div key={r.label} style={{
              flex: 1, textAlign: "center", background: r.bg, borderRadius: 6, padding: "6px 4px",
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: r.color }}>{r.count}</div>
              <div style={{ fontSize: 9, color: r.color }}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* CIS compliance bar */}
        {d.cis_control_count > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: "var(--text-muted)" }}>CIS ({d.cis_control_count} kontroli)</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: d.cis_pct != null ? pctColor(d.cis_pct) : "var(--text-muted)" }}>
                {d.cis_pct != null ? `${Math.round(d.cis_pct)}%` : "—"}
              </span>
            </div>
            <div className="bar-track" style={{ height: 6 }}>
              <div className="bar-fill" style={{
                width: `${d.cis_pct ?? 0}%`,
                background: d.cis_pct != null ? pctColor(d.cis_pct) : "var(--text-muted)",
                height: 6,
              }} />
            </div>
          </div>
        )}

        {/* Top risks */}
        {d.top_risks.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 4 }}>
              Top ryzyka
            </div>
            {d.top_risks.map(r => (
              <div key={r.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "4px 0", borderBottom: "1px solid rgba(42,53,84,0.15)", fontSize: 11,
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/risks?highlight=${r.id}`)}
              >
                <span style={{ color: "var(--text-secondary)" }}>{r.asset_name}</span>
                <span className="score-badge" style={{ background: riskBg(r.risk_level), color: riskColor(r.risk_level), fontSize: 10 }}>
                  {r.risk_score.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}

        {d.risk_count === 0 && d.cis_control_count === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: 8 }}>
            Brak ryzyk i kontroli CIS
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Icon helper: map icon name to character ─── */
function iconChar(name: string): string {
  const map: Record<string, string> = {
    "monitor": "🖥",
    "database": "🗄",
    "settings": "⚙",
    "users": "👥",
    "shield-alert": "🛡",
    "file-text": "📄",
    "mail": "📧",
    "bug": "🐛",
    "wifi": "📡",
    "hard-drive": "💾",
    "building": "🏢",
    "scale": "⚖",
    "activity": "📈",
    "graduation-cap": "🎓",
    "alert-triangle": "⚠",
  };
  return map[name] ?? "📋";
}
