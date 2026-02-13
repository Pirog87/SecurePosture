import { useEffect, useState } from "react";
import { api } from "../services/api";
import Modal from "../components/Modal";

interface Framework {
  id: number;
  name: string;
}

interface Mapping {
  id: number;
  source_framework_id: number;
  source_framework_name: string;
  source_requirement_ref: string | null;
  source_requirement_name: string | null;
  target_framework_id: number;
  target_framework_name: string;
  target_requirement_ref: string | null;
  target_requirement_name: string | null;
  relationship_type: string;
  strength: string;
  rationale: string | null;
  mapping_source: string;
  mapping_status: string;
}

interface CoverageResult {
  total_requirements: number;
  covered: number;
  uncovered: number;
  coverage_percent: number;
  uncovered_requirements: { id: number; ref_id: string; name: string }[];
}

const REL_COLORS: Record<string, string> = {
  equal: "#22c55e",
  subset: "#3b82f6",
  superset: "#8b5cf6",
  intersect: "#f59e0b",
  related: "#6b7280",
};

const STRENGTH_LABELS: Record<string, string> = {
  strong: "Silne",
  moderate: "Umiarkowane",
  weak: "Słabe",
};

export default function FrameworkMappingsPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Framework[]>("/api/v1/frameworks/").then((fw) =>
      setFrameworks(fw.filter((f: any) => f.is_active !== false)),
    );
  }, []);

  const loadMappings = async () => {
    if (!sourceId && !targetId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (sourceId) params.set("source_framework_id", String(sourceId));
    if (targetId) params.set("target_framework_id", String(targetId));
    try {
      const [m] = await Promise.all([
        api.get<Mapping[]>(`/api/v1/framework-mappings/?${params}`),
      ]);
      setMappings(m);

      // Load coverage if both selected
      if (sourceId && targetId) {
        const cov = await api.get<CoverageResult>(
          `/api/v1/framework-mappings/coverage?source_framework_id=${sourceId}&target_framework_id=${targetId}`,
        );
        setCoverage(cov);
      } else {
        setCoverage(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadMappings(); }, [sourceId, targetId]);

  return (
    <div style={{ padding: "0 0 32px" }}>
      <h2 style={{ margin: "0 0 16px" }}>Mapowanie Frameworków</h2>

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 16, alignItems: "end" }}>
        <label style={{ flex: 1 }}>
          Framework źródłowy
          <select className="form-control" value={sourceId || ""} onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— wybierz —</option>
            {frameworks.map((fw) => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 20, padding: "0 8px", color: "var(--text-muted)" }}>→</span>
        <label style={{ flex: 1 }}>
          Framework docelowy
          <select className="form-control" value={targetId || ""} onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— wybierz —</option>
            {frameworks.map((fw) => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
          </select>
        </label>
      </div>

      {/* Coverage summary */}
      {coverage && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Analiza pokrycia</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 12, backgroundColor: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${coverage.coverage_percent}%`, height: "100%", backgroundColor: coverage.coverage_percent >= 80 ? "#22c55e" : coverage.coverage_percent >= 50 ? "#f59e0b" : "#ef4444", borderRadius: 6, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, color: coverage.coverage_percent >= 80 ? "#22c55e" : coverage.coverage_percent >= 50 ? "#f59e0b" : "#ef4444" }}>
              {coverage.coverage_percent}%
            </span>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
            <span style={{ color: "#22c55e" }}>Pokryte: {coverage.covered}</span>
            <span style={{ color: "#ef4444" }}>Niepokryte: {coverage.uncovered}</span>
            <span style={{ color: "var(--text-muted)" }}>Razem: {coverage.total_requirements}</span>
          </div>
          {coverage.uncovered_requirements.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)" }}>Wymagania bez pokrycia:</h4>
              <div style={{ maxHeight: 200, overflow: "auto" }}>
                {coverage.uncovered_requirements.map((r) => (
                  <div key={r.id} style={{ fontSize: 12, padding: "2px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "monospace", color: "#ef4444", marginRight: 8 }}>{r.ref_id}</span>
                    {r.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mappings table */}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>
      ) : !sourceId && !targetId ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          Wybierz framework źródłowy i/lub docelowy, aby zobaczyć mapowania.
        </div>
      ) : mappings.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          Brak mapowań dla wybranych frameworków.
        </div>
      ) : (
        <div className="card">
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Źródło (Ref)</th>
                <th>Źródło (Nazwa)</th>
                <th>Relacja</th>
                <th>Siła</th>
                <th>Cel (Ref)</th>
                <th>Cel (Nazwa)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{m.source_requirement_ref}</td>
                  <td style={{ fontSize: 12 }}>{m.source_requirement_name}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: `${REL_COLORS[m.relationship_type]}20`, color: REL_COLORS[m.relationship_type] }}>
                      {m.relationship_type}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{STRENGTH_LABELS[m.strength] || m.strength}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{m.target_requirement_ref}</td>
                  <td style={{ fontSize: 12 }}>{m.target_requirement_name}</td>
                  <td>
                    <span className="badge" style={{ fontSize: 10 }}>{m.mapping_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
