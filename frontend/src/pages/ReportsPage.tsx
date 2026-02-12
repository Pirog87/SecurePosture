import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

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
    </div>
  );
}

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
            <div style={{ marginBottom: 10, padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid var(--border)" }}>
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
