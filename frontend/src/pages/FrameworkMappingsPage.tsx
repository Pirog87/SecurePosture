import { useEffect, useState, useMemo, useRef } from "react";
import { api } from "../services/api";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { CISO_MAPPING_FILES } from "../data/cisoCatalog";

/* ─── Types ─── */
interface Framework {
  id: number;
  name: string;
}

interface MappingSet {
  id: number;
  source_framework_id: number;
  source_framework_name: string | null;
  target_framework_id: number;
  target_framework_name: string | null;
  name: string | null;
  status: string;
  mapping_count: number;
  coverage_percent: number | null;
  created_at: string;
}

interface FrameworkMapping {
  id: number;
  mapping_set_id: number | null;
  source_framework_id: number;
  source_framework_name: string;
  source_requirement_id: number;
  source_requirement_ref: string | null;
  source_requirement_name: string | null;
  target_framework_id: number;
  target_framework_name: string;
  target_requirement_id: number;
  target_requirement_ref: string | null;
  target_requirement_name: string | null;
  relationship_type: string;
  strength: number;
  rationale_type: string | null;
  rationale: string | null;
  mapping_source: string;
  mapping_status: string;
  ai_score: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface CoverageData {
  source_framework_id: number;
  target_framework_id: number;
  total_requirements: number;
  covered: number;
  confirmed_covered: number;
  uncovered: number;
  coverage_percent: number;
  confirmed_coverage_percent: number;
  by_relationship: Record<string, number>;
  by_strength: Record<string, number>;
  uncovered_requirements: { id: number; ref_id: string | null; name: string | null }[];
}

interface MappingStats {
  total_mappings: number;
  confirmed: number;
  draft: number;
  framework_pairs: number;
  mapping_sets: number;
  by_relationship: Record<string, number>;
  by_source: Record<string, number>;
}

/* ─── CISO Assistant Relationship Types ─── */
const RELATIONSHIP_LABELS: Record<string, string> = {
  equal: "Equal (=)",
  subset: "Subset (⊆)",
  superset: "Superset (⊇)",
  intersect: "Intersect (∩)",
  not_related: "Not Related (∅)",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  equal: "#10b981",
  subset: "#6366f1",
  superset: "#8b5cf6",
  intersect: "#f59e0b",
  not_related: "#94a3b8",
};

const RELATIONSHIP_PL: Record<string, string> = {
  equal: "Ekwiwalentne",
  subset: "Podzbiór",
  superset: "Nadzbiór",
  intersect: "Przecięcie",
  not_related: "Brak powiązania",
};

const STRENGTH_LABELS: Record<number, string> = {
  1: "Słabe",
  2: "Umiarkowane",
  3: "Silne",
};

const STRENGTH_COLORS: Record<number, string> = {
  1: "#f87171",
  2: "#f59e0b",
  3: "#10b981",
};

const RATIONALE_LABELS: Record<string, string> = {
  syntactic: "Syntaktyczne",
  semantic: "Semantyczne",
  functional: "Funkcjonalne",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Ręczne",
  ai_assisted: "AI-Assisted",
  scf_strm: "SCF STRM",
  import: "Import",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Wersja robocza",
  confirmed: "Potwierdzone",
};

/* ─── Helpers ─── */

function RelBadge({ rel }: { rel: string }) {
  const c = RELATIONSHIP_COLORS[rel] || "#94a3b8";
  return (
    <span className="badge" style={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40` }}>
      {RELATIONSHIP_LABELS[rel] || rel}
    </span>
  );
}

function StrengthDots({ strength }: { strength: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: i <= strength ? STRENGTH_COLORS[strength] : "var(--border)",
        }} />
      ))}
      <span style={{ marginLeft: 4, fontSize: 11, color: "var(--text-muted)" }}>
        {STRENGTH_LABELS[strength] || strength}
      </span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isDraft = status === "draft";
  return (
    <span className="badge" style={{
      backgroundColor: isDraft ? "#f59e0b18" : "#10b98118",
      color: isDraft ? "#f59e0b" : "#10b981",
      border: `1px solid ${isDraft ? "#f59e0b40" : "#10b98140"}`,
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: "var(--blue)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>{number}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "—"}</span>
    </div>
  );
}

function CoverageBar({ percent, label, color }: { percent: number; label: string; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{percent.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--border)" }}>
        <div style={{ height: "100%", borderRadius: 3, background: color, width: `${Math.min(percent, 100)}%`, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function RelationshipChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak danych</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(data).map(([rel, count]) => {
        const pct = (count / total) * 100;
        const c = RELATIONSHIP_COLORS[rel] || "#94a3b8";
        return (
          <div key={rel}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: c, fontWeight: 500 }}>{RELATIONSHIP_PL[rel] || rel}</span>
              <span style={{ color: "var(--text-muted)" }}>{count} ({pct.toFixed(0)}%)</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "var(--border)" }}>
              <div style={{ height: "100%", borderRadius: 2, background: c, width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tabs
   ═══════════════════════════════════════════════════════════ */
type TabId = "mappings" | "sets" | "ai_suggest" | "coverage" | "matrix";

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "mappings", label: "Mapowania", icon: "🔗" },
    { id: "sets", label: "Zestawy", icon: "📦" },
    { id: "ai_suggest", label: "AI Suggest", icon: "🤖" },
    { id: "coverage", label: "Pokrycie", icon: "📊" },
    { id: "matrix", label: "Matryca", icon: "🗓" },
  ];
  return (
    <div style={{ display: "flex", gap: 2, background: "var(--bg-secondary)", borderRadius: 8, padding: 3, marginBottom: 16 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", cursor: "pointer",
            background: active === t.id ? "var(--bg-primary)" : "transparent",
            color: active === t.id ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: active === t.id ? 600 : 400, fontSize: 13,
            boxShadow: active === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s",
          }}
        >
          <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MappingSetsTab
   ═══════════════════════════════════════════════════════════ */
interface ImportResult {
  mapping_set_id: number | null;
  source_framework_name: string | null;
  target_framework_name: string | null;
  created: number;
  revert_created: number;
  skipped: number;
  errors: string[];
}

/* ─── Searchable Mapping File Selector (inline list) ─── */
function MappingFileSelector({ value, onChange }: { value: string; onChange: (filename: string) => void }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return CISO_MAPPING_FILES;
    const q = search.toLowerCase();
    return CISO_MAPPING_FILES.filter(f =>
      f.source.toLowerCase().includes(q) ||
      f.target.toLowerCase().includes(q) ||
      f.filename.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Search input */}
      <input
        type="text"
        className="form-control"
        placeholder="Szukaj frameworka..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ fontSize: 12 }}
      />
      {/* Scrollable list */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: 8, overflowY: "auto",
        maxHeight: "min(50vh, 340px)", minHeight: 120,
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            Brak wyników dla "{search}"
          </div>
        ) : (
          filtered.map(f => (
            <div
              key={f.filename}
              onClick={() => onChange(f.filename)}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: 12,
                borderBottom: "1px solid var(--border)",
                background: f.filename === value ? "var(--blue-dim, rgba(99,102,241,0.08))" : "transparent",
                borderLeft: f.filename === value ? "3px solid var(--blue)" : "3px solid transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (f.filename !== value) (e.currentTarget.style.background = "var(--bg-secondary)"); }}
              onMouseLeave={e => { if (f.filename !== value) (e.currentTarget.style.background = f.filename === value ? "var(--blue-dim, rgba(99,102,241,0.08))" : "transparent"); }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{f.source}</span>
                <span style={{
                  padding: "1px 6px", borderRadius: 4, fontSize: 10,
                  background: f.direction === "and" ? "#6366f118" : "#10b98118",
                  color: f.direction === "and" ? "#6366f1" : "#10b981",
                  fontWeight: 600,
                }}>
                  {f.direction === "and" ? "\u2194" : "\u2192"}
                </span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{f.target}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{f.filename}</div>
            </div>
          ))
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>
        {filtered.length} / {CISO_MAPPING_FILES.length} plików
      </div>
    </div>
  );
}

function MappingSetsTab({ sets, frameworks, onRefresh }: {
  sets: MappingSet[];
  frameworks: Framework[];
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "github">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [githubPath, setGithubPath] = useState("mapping-nist-sp-800-53-rev5-to-iso27001-2022.yaml");
  const [importSrcFw, setImportSrcFw] = useState(0);
  const [importTgtFw, setImportTgtFw] = useState(0);
  const [importAutoRevert, setImportAutoRevert] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ source_framework_id: 0, target_framework_id: 0, name: "" });
  const [setsSearch, setSetsSearch] = useState("");

  const handleCreate = async () => {
    if (!form.source_framework_id || !form.target_framework_id) return;
    try {
      await api.post("/api/v1/framework-mappings/sets", {
        source_framework_id: form.source_framework_id,
        target_framework_id: form.target_framework_id,
        name: form.name || undefined,
      });
      setShowCreate(false);
      setForm({ source_framework_id: 0, target_framework_id: 0, name: "" });
      onRefresh();
    } catch { alert("Błąd tworzenia zestawu"); }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      let result: ImportResult;
      if (importMode === "file") {
        if (!importFile) return;
        const formData = new FormData();
        formData.append("file", importFile);
        const params = new URLSearchParams();
        if (importSrcFw) params.set("source_framework_id", String(importSrcFw));
        if (importTgtFw) params.set("target_framework_id", String(importTgtFw));
        params.set("auto_revert", String(importAutoRevert));
        result = await api.postFormData<ImportResult>(`/api/v1/framework-mappings/import/yaml?${params}`, formData);
      } else {
        if (!githubPath.trim()) return;
        const params = new URLSearchParams({ mapping_path: githubPath.trim(), auto_revert: String(importAutoRevert) });
        if (importSrcFw) params.set("source_framework_id", String(importSrcFw));
        if (importTgtFw) params.set("target_framework_id", String(importTgtFw));
        result = await api.post<ImportResult>(`/api/v1/framework-mappings/import/github-mapping?${params}`, {});
      }
      setImportResult(result);
      onRefresh();
    } catch (e: any) {
      const msg = e?.message || "Błąd importu";
      setImportResult({ mapping_set_id: null, source_framework_name: null, target_framework_name: null, created: 0, revert_created: 0, skipped: 0, errors: [msg] });
    }
    setImporting(false);
  };

  const resetImport = () => {
    setImportFile(null);
    setImportResult(null);
    setImportSrcFw(0);
    setImportTgtFw(0);
    setImportAutoRevert(true);
    setGithubPath("mapping-nist-sp-800-53-rev5-to-iso27001-2022.yaml");
    setImportMode("file");
  };

  /* Filtered mapping sets */
  const filteredSets = useMemo(() => {
    if (!setsSearch.trim()) return sets;
    const q = setsSearch.toLowerCase();
    return sets.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.source_framework_name || "").toLowerCase().includes(q) ||
      (s.target_framework_name || "").toLowerCase().includes(q)
    );
  }, [sets, setsSearch]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Zestawy Mapowań</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Grupuj mapowania między parami frameworków (wzorzec CISO Assistant)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            className="form-control"
            placeholder="Szukaj zestawów..."
            value={setsSearch}
            onChange={e => setSetsSearch(e.target.value)}
            style={{ width: 200, fontSize: 12, padding: "6px 10px" }}
          />
          <button className="btn" onClick={() => { resetImport(); setShowImport(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Import mapowań
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Nowy zestaw</button>
        </div>
      </div>

      {/* Search result info */}
      {setsSearch.trim() && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
          Znaleziono: {filteredSets.length} z {sets.length} zestawów
        </div>
      )}

      {filteredSets.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          {setsSearch.trim()
            ? `Brak zestawów pasujących do "${setsSearch}"`
            : "Brak zestawów mapowań. Utwórz zestaw, aby grupować mapowania między frameworkami."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {filteredSets.map(s => (
            <div key={s.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name || `Set #${s.id}`}</div>
                <StatusBadge status={s.status} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                {s.source_framework_name} → {s.target_framework_name}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--bg-secondary)" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--blue)" }}>{s.mapping_count}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Mapowań</div>
                </div>
                <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--bg-secondary)" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.coverage_percent != null && s.coverage_percent >= 80 ? "#10b981" : "#f59e0b" }}>
                    {s.coverage_percent != null ? `${s.coverage_percent}%` : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pokrycie</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} title="Nowy zestaw mapowań" onClose={() => setShowCreate(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>Source Framework *
            <select className="form-control" value={form.source_framework_id} onChange={e => setForm({ ...form, source_framework_id: Number(e.target.value) })}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <label>Target Framework *
            <select className="form-control" value={form.target_framework_id} onChange={e => setForm({ ...form, target_framework_id: Number(e.target.value) })}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <label>Nazwa (opcjonalna)
            <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Auto: Framework A <-> Framework B" />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => setShowCreate(false)}>Anuluj</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.source_framework_id || !form.target_framework_id}>Utwórz</button>
          </div>
        </div>
      </Modal>

      {/* Import YAML Modal */}
      <Modal open={showImport} title="Import mapowań CISO Assistant" onClose={() => setShowImport(false)} wide>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Info box */}
          <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Format CISO Assistant YAML</div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              Importuj pliki mapowań z repozytorium CISO Assistant Community.
              Pliki zawieraj{'ą'} sekcj{'ę'} <code>requirement_mapping_sets</code> z definicjami
              powi{'ą'}za{'ń'} mi{'ę'}dzy wymaganiami dw{'ó'}ch framework{'ó'}w.
              Frameworki {'źr\'ó'}d{'ł'}owe i docelowe musz{'ą'} by{'ć'} wcze{'ś'}niej zaimportowane.
            </div>
          </div>

          {/* Mode selector */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg-secondary)", borderRadius: 6, padding: 2 }}>
            <button
              onClick={() => setImportMode("file")}
              style={{
                flex: 1, padding: "6px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                background: importMode === "file" ? "var(--bg-primary)" : "transparent",
                color: importMode === "file" ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: importMode === "file" ? 600 : 400, fontSize: 12,
              }}
            >
              Import z pliku
            </button>
            <button
              onClick={() => setImportMode("github")}
              style={{
                flex: 1, padding: "6px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                background: importMode === "github" ? "var(--bg-primary)" : "transparent",
                color: importMode === "github" ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: importMode === "github" ? 600 : 400, fontSize: 12,
              }}
            >
              Import z CISO Assistant
            </button>
          </div>

          {/* File upload */}
          {importMode === "file" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml"
                style={{ display: "none" }}
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border)", borderRadius: 8, padding: 24,
                  textAlign: "center", cursor: "pointer", transition: "border-color 0.15s",
                  background: importFile ? "var(--bg-secondary)" : "transparent",
                }}
              >
                {importFile ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{importFile.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {(importFile.size / 1024).toFixed(1)} KB — kliknij aby zmieni{'ć'}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>+</div>
                    <div style={{ fontSize: 13 }}>Kliknij aby wybra{'ć'} plik YAML</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>mapping-*.yaml z repozytorium CISO Assistant</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GitHub path — searchable selector */}
          {importMode === "github" && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Plik mapowania z repozytorium CISO Assistant</div>
              <MappingFileSelector value={githubPath} onChange={setGithubPath} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {CISO_MAPPING_FILES.length} plików mapowań w katalogu CISO Assistant Community
              </div>
            </div>
          )}

          {/* Optional framework overrides */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ fontSize: 13 }}>Source Framework (opcjonalnie)
              <select className="form-control" value={importSrcFw} onChange={e => setImportSrcFw(Number(e.target.value))}>
                <option value={0}>— auto z YAML —</option>
                {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>Target Framework (opcjonalnie)
              <select className="form-control" value={importTgtFw} onChange={e => setImportTgtFw(Number(e.target.value))}>
                <option value={0}>— auto z YAML —</option>
                {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
              </select>
            </label>
          </div>

          {/* Auto-revert checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={importAutoRevert} onChange={e => setImportAutoRevert(e.target.checked)} />
            Auto-revert (generuj odwrotne mapowania)
          </label>

          {/* Result */}
          {importResult && (
            <div style={{
              padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.6,
              background: importResult.created > 0 ? "#10b98118" : "#ef444418",
              border: `1px solid ${importResult.created > 0 ? "#10b98140" : "#ef444440"}`,
            }}>
              {importResult.created > 0 ? (
                <>
                  <div style={{ fontWeight: 600, color: "#10b981", marginBottom: 4 }}>
                    Import zako{'ń'}czony pomy{'ś'}lnie
                  </div>
                  <div>Utworzono: <strong>{importResult.created}</strong> mapowa{'ń'}</div>
                  {importResult.revert_created > 0 && (
                    <div>Odwrotne: <strong>{importResult.revert_created}</strong> mapowa{'ń'}</div>
                  )}
                  {importResult.skipped > 0 && (
                    <div>Pomini{'ę'}to (duplikaty): <strong>{importResult.skipped}</strong></div>
                  )}
                  {importResult.source_framework_name && importResult.target_framework_name && (
                    <div style={{ marginTop: 4, color: "var(--text-muted)" }}>
                      {importResult.source_framework_name} {'→'} {importResult.target_framework_name}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, color: "#ef4444", marginBottom: 4 }}>
                    Bł{'ą'}d importu
                  </div>
                  {importResult.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, color: "var(--text-muted)" }}>{err}</div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button className="btn" onClick={() => setShowImport(false)}>
              {importResult?.created ? "Zamknij" : "Anuluj"}
            </button>
            {!importResult?.created && (
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || (importMode === "file" && !importFile) || (importMode === "github" && !githubPath.trim())}
              >
                {importing ? "Importowanie..." : "Importuj mapowania"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AISuggestTab — SBERT-based mapping suggestions
   ═══════════════════════════════════════════════════════════ */
interface AISuggestion {
  source_node_id: number;
  source_ref_id: string | null;
  source_name: string;
  target_node_id: number;
  target_ref_id: string | null;
  target_name: string;
  score: number;
  relationship_type: string;
  strength: number;
}

interface AISuggestResult {
  source_framework_id: number;
  source_framework_name: string;
  target_framework_id: number;
  target_framework_name: string;
  model_name: string;
  source_nodes_count: number;
  target_nodes_count: number;
  total_suggestions: number;
  suggestions: AISuggestion[];
}

function AISuggestTab({ frameworks, onRefresh }: { frameworks: Framework[]; onRefresh: () => void }) {
  const [srcFw, setSrcFw] = useState(0);
  const [tgtFw, setTgtFw] = useState(0);
  const [topK, setTopK] = useState(3);
  const [minScore, setMinScore] = useState(0.45);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AISuggestResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [accepting, setAccepting] = useState(false);
  const [acceptResult, setAcceptResult] = useState<{ created: number; revert_created: number; skipped: number } | null>(null);

  const handleGenerate = async () => {
    if (!srcFw || !tgtFw) return;
    setLoading(true);
    setResult(null);
    setSelected(new Set());
    setAcceptResult(null);
    try {
      const params = new URLSearchParams({
        source_framework_id: String(srcFw),
        target_framework_id: String(tgtFw),
        top_k: String(topK),
        min_score: String(minScore),
      });
      const data = await api.post<AISuggestResult>(`/api/v1/framework-mappings/ai-suggest?${params}`, {});
      setResult(data);
      // Pre-select high-confidence suggestions
      const preselected = new Set<number>();
      data.suggestions.forEach((s, i) => {
        if (s.score >= 0.60) preselected.add(i);
      });
      setSelected(preselected);
    } catch (e: any) {
      alert(e?.message || "B\u0142\u0105d generowania sugestii AI");
    }
    setLoading(false);
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    if (selected.size === result.suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result.suggestions.map((_, i) => i)));
    }
  };

  const handleAccept = async () => {
    if (!result || selected.size === 0) return;
    setAccepting(true);
    setAcceptResult(null);
    try {
      const suggestions = [...selected].map(i => result.suggestions[i]).map(s => ({
        source_node_id: s.source_node_id,
        target_node_id: s.target_node_id,
        relationship_type: s.relationship_type,
        strength: s.strength,
        score: s.score,
        model_name: result.model_name,
      }));
      const params = new URLSearchParams({
        source_framework_id: String(result.source_framework_id),
        target_framework_id: String(result.target_framework_id),
        auto_revert: "true",
      });
      const res = await api.post<{ created: number; revert_created: number; skipped: number }>(
        `/api/v1/framework-mappings/ai-suggest/accept?${params}`, suggestions
      );
      setAcceptResult(res);
      onRefresh();
    } catch (e: any) {
      alert(e?.message || "B\u0142\u0105d akceptowania sugestii");
    }
    setAccepting(false);
  };

  const scoreColor = (score: number) => {
    if (score >= 0.85) return "#10b981";
    if (score >= 0.70) return "#6366f1";
    if (score >= 0.55) return "#f59e0b";
    return "#94a3b8";
  };

  return (
    <div>
      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>AI-Suggest Mapowania (SBERT)</h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)" }}>
        Automatyczne sugestie mapowa{'\u0144'} na podstawie podobie{'\u0144'}stwa semantycznego tekst{'\u00f3'}w wymaga{'\u0144'} (sentence-transformers)
      </p>

      {/* Configuration */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>Source Framework *
            <select className="form-control" value={srcFw} onChange={e => setSrcFw(Number(e.target.value))}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>Target Framework *
            <select className="form-control" value={tgtFw} onChange={e => setTgtFw(Number(e.target.value))}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>Top-K (maks. wynik{'\u00f3'}w na wymaganie)
            <select className="form-control" value={topK} onChange={e => setTopK(Number(e.target.value))}>
              {[1, 2, 3, 5, 10].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>Min. score (pr{'\u00f3'}g podobie{'\u0144'}stwa)
            <select className="form-control" value={minScore} onChange={e => setMinScore(Number(e.target.value))}>
              {[0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.70].map(s => (
                <option key={s} value={s}>{(s * 100).toFixed(0)}%</option>
              ))}
            </select>
          </label>
        </div>

        {/* Info box */}
        <div style={{ padding: 10, borderRadius: 6, background: "var(--bg-secondary)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 12 }}>
          Model: <strong>all-MiniLM-L6-v2</strong> — szybki, wieloj{'\u0119'}zyczny model sentence-transformers.
          Oblicza cosine similarity mi{'\u0119'}dzy tekstami wymaga{'\u0144'} i sugeruje mapowania powy{'\u017c'}ej progu.
          Wyniki s{'\u0105'} w statusie <em>draft</em> — wymagaj{'\u0105'} potwierdzenia.
        </div>

        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || !srcFw || !tgtFw || srcFw === tgtFw}
          style={{ width: "100%" }}
        >
          {loading ? "Generowanie sugestii AI..." : "Generuj sugestie SBERT"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <div className="card" style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--blue)" }}>{result.total_suggestions}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sugestii</div>
            </div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>{result.source_nodes_count}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Source nodes</div>
            </div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#6366f1" }}>{result.target_nodes_count}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Target nodes</div>
            </div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{selected.size}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zaznaczonych</div>
            </div>
          </div>

          {/* Accept bar */}
          {!acceptResult && result.suggestions.length > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: 8, background: "var(--bg-secondary)", marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selected.size === result.suggestions.length}
                    onChange={toggleAll}
                  />
                  Zaznacz wszystkie
                </label>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {selected.size} z {result.suggestions.length} zaznaczonych
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleAccept}
                disabled={accepting || selected.size === 0}
              >
                {accepting ? "Akceptowanie..." : `Akceptuj ${selected.size} sugestii`}
              </button>
            </div>
          )}

          {/* Accept result */}
          {acceptResult && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13, lineHeight: 1.6,
              background: "#10b98118", border: "1px solid #10b98140",
            }}>
              <div style={{ fontWeight: 600, color: "#10b981", marginBottom: 4 }}>
                Sugestie zaakceptowane
              </div>
              <div>Utworzono: <strong>{acceptResult.created}</strong> mapowa{'\u0144'}</div>
              {acceptResult.revert_created > 0 && (
                <div>Odwrotne: <strong>{acceptResult.revert_created}</strong> mapowa{'\u0144'}</div>
              )}
              {acceptResult.skipped > 0 && (
                <div>Pomini{'\u0119'}to (duplikaty): <strong>{acceptResult.skipped}</strong></div>
              )}
            </div>
          )}

          {/* Suggestions table */}
          {result.suggestions.length > 0 ? (
            <div className="card" style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", width: 36 }}></th>
                    <th style={{ padding: "8px 10px" }}>Source</th>
                    <th style={{ padding: "8px 10px" }}>Target</th>
                    <th style={{ padding: "8px 10px", width: 80 }}>Score</th>
                    <th style={{ padding: "8px 10px", width: 100 }}>Relacja</th>
                    <th style={{ padding: "8px 10px", width: 60 }}>Si{'\u0142'}a</th>
                  </tr>
                </thead>
                <tbody>
                  {result.suggestions.map((s, i) => (
                    <tr
                      key={i}
                      onClick={() => toggleSelect(i)}
                      style={{
                        borderBottom: "1px solid var(--border)", cursor: "pointer",
                        background: selected.has(i) ? "var(--bg-secondary)" : "transparent",
                        opacity: acceptResult ? 0.6 : 1,
                      }}
                    >
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <input type="checkbox" checked={selected.has(i)} readOnly />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>
                          {s.source_ref_id || "—"}
                        </div>
                        <div style={{ fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.source_name}
                        </div>
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>
                          {s.target_ref_id || "—"}
                        </div>
                        <div style={{ fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.target_name}
                        </div>
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: 40, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${s.score * 100}%`, height: "100%", borderRadius: 3,
                              background: scoreColor(s.score),
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(s.score) }}>
                            {(s.score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <RelBadge rel={s.relationship_type} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <StrengthDots strength={s.strength} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
              Brak sugestii powy{'\u017c'}ej progu podobie{'\u0144'}stwa. Spr{'\u00f3'}buj obni{'\u017c'}y{'\u0107'} pr{'\u00f3'}g min. score.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CoverageTab
   ═══════════════════════════════════════════════════════════ */
function CoverageTab({ frameworks }: { frameworks: Framework[] }) {
  const [srcFw, setSrcFw] = useState(0);
  const [tgtFw, setTgtFw] = useState(0);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCoverage = async () => {
    if (!srcFw || !tgtFw) return;
    setLoading(true);
    try {
      const data = await api.get<CoverageData>(`/api/v1/framework-mappings/coverage?source_framework_id=${srcFw}&target_framework_id=${tgtFw}`);
      setCoverage(data);
    } catch { setCoverage(null); }
    setLoading(false);
  };

  return (
    <div>
      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Analiza Pokrycia</h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)" }}>
        Sprawdź, jakie wymagania są pokryte mapowaniami między frameworkami
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <label style={{ margin: 0 }}>Source Framework
            <select className="form-control" value={srcFw} onChange={e => setSrcFw(Number(e.target.value))}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>Target Framework
            <select className="form-control" value={tgtFw} onChange={e => setTgtFw(Number(e.target.value))}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={loadCoverage} disabled={!srcFw || !tgtFw || loading}>
            {loading ? "Analizuję..." : "Analizuj pokrycie"}
          </button>
        </div>
      </div>

      {coverage && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Coverage Summary */}
          <div className="card" style={{ padding: 16 }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>Pokrycie wymagań</h4>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{
                width: 100, height: 100, borderRadius: "50%", margin: "0 auto 8px",
                background: `conic-gradient(#10b981 ${coverage.coverage_percent * 3.6}deg, var(--border) 0deg)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: 76, height: 76, borderRadius: "50%", background: "var(--bg-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, color: coverage.coverage_percent >= 80 ? "#10b981" : coverage.coverage_percent >= 50 ? "#f59e0b" : "#ef4444",
                }}>
                  {coverage.coverage_percent}%
                </div>
              </div>
            </div>
            <CoverageBar percent={coverage.coverage_percent} label="Całkowite pokrycie" color="#10b981" />
            <CoverageBar percent={coverage.confirmed_coverage_percent} label="Potwierdzone pokrycie" color="#6366f1" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 6, background: "var(--bg-secondary)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--blue)" }}>{coverage.total_requirements}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Wymagań</div>
              </div>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 6, background: "var(--bg-secondary)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{coverage.covered}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Pokryte</div>
              </div>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 6, background: "var(--bg-secondary)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{coverage.uncovered}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Brak</div>
              </div>
            </div>
          </div>

          {/* Relationship Breakdown */}
          <div className="card" style={{ padding: 16 }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 14 }}>Rozkład relacji</h4>
            <RelationshipChart data={coverage.by_relationship} />
            <h4 style={{ margin: "16px 0 12px", fontSize: 14 }}>Siła powiązań</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(coverage.by_strength).map(([str, count]) => {
                const s = Number(str);
                const total = Object.values(coverage.by_strength).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={str}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: STRENGTH_COLORS[s], fontWeight: 500 }}>
                        {STRENGTH_LABELS[s] || `Poziom ${str}`}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>{count}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--border)" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: STRENGTH_COLORS[s], width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Uncovered Requirements */}
          {coverage.uncovered_requirements.length > 0 && (
            <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Niepokryte wymagania ({coverage.uncovered_requirements.length})</h4>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>Ref ID</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>Nazwa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.uncovered_requirements.map(r => (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{r.ref_id || "—"}</td>
                        <td style={{ padding: "6px 8px" }}>{r.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MatrixTab
   ═══════════════════════════════════════════════════════════ */
function MatrixTab({ frameworks }: { frameworks: Framework[] }) {
  const [srcFw, setSrcFw] = useState(0);
  const [tgtFw, setTgtFw] = useState(0);
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadMatrix = async () => {
    if (!srcFw || !tgtFw) return;
    setLoading(true);
    try {
      const data = await api.get<any>(`/api/v1/framework-mappings/matrix?source_framework_id=${srcFw}&target_framework_id=${tgtFw}`);
      setMatrix(data);
    } catch { setMatrix(null); }
    setLoading(false);
  };

  // Build heatmap grid from mappings
  const heatmap = useMemo(() => {
    if (!matrix?.mappings?.length) return null;
    const srcRefs = [...new Set(matrix.mappings.map((m: any) => m.source_ref_id as string))].sort() as string[];
    const tgtRefs = [...new Set(matrix.mappings.map((m: any) => m.target_ref_id as string))].sort() as string[];
    const lookup = new Map<string, any>();
    for (const m of matrix.mappings) {
      lookup.set(`${m.source_ref_id}|${m.target_ref_id}`, m);
    }
    return { srcRefs, tgtRefs, lookup };
  }, [matrix]);

  return (
    <div>
      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Matryca Mapowań</h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)" }}>
        Wizualizacja powiązań między wymaganiami dwóch frameworków w formie heatmapy
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <label style={{ margin: 0 }}>Source Framework
            <select className="form-control" value={srcFw} onChange={e => setSrcFw(Number(e.target.value))}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>Target Framework
            <select className="form-control" value={tgtFw} onChange={e => setTgtFw(Number(e.target.value))}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={loadMatrix} disabled={!srcFw || !tgtFw || loading}>
            {loading ? "Ładuję..." : "Pokaż matrycę"}
          </button>
        </div>
      </div>

      {matrix && (
        <>
          {/* Summary bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <div className="card" style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--blue)" }}>{matrix.total_mappings}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Mapowań</div>
            </div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>{matrix.coverage_percent}%</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pokrycie</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Relacje</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.entries(matrix.by_relationship || {}).map(([r, c]) => (
                  <span key={r} className="badge" style={{ backgroundColor: `${RELATIONSHIP_COLORS[r] || "#94a3b8"}18`, color: RELATIONSHIP_COLORS[r] || "#94a3b8", fontSize: 10 }}>
                    {RELATIONSHIP_PL[r] || r}: {c as number}
                  </span>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Siła</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.entries(matrix.by_strength || {}).map(([s, c]) => (
                  <span key={s} className="badge" style={{ backgroundColor: `${STRENGTH_COLORS[Number(s)] || "#94a3b8"}18`, color: STRENGTH_COLORS[Number(s)] || "#94a3b8", fontSize: 10 }}>
                    {STRENGTH_LABELS[Number(s)] || s}: {c as number}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Heatmap */}
          {heatmap && (
            <div className="card" style={{ padding: 16, overflowX: "auto" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>
                {matrix.source_framework_name} → {matrix.target_framework_name}
              </h4>
              {/* Legend */}
              <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 11, flexWrap: "wrap" }}>
                {Object.entries(RELATIONSHIP_LABELS).filter(([k]) => k !== "not_related").map(([k, v]) => (
                  <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: RELATIONSHIP_COLORS[k] }} />
                    <span style={{ color: "var(--text-muted)" }}>{v}</span>
                  </span>
                ))}
              </div>
              <div style={{ overflow: "auto", maxHeight: 500 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 4, background: "var(--bg-secondary)", position: "sticky", left: 0, zIndex: 2 }} />
                      {heatmap.tgtRefs.map((t: string) => (
                        <th key={t} style={{
                          padding: "4px 2px", background: "var(--bg-secondary)", writingMode: "vertical-lr",
                          transform: "rotate(180deg)", fontWeight: 500, color: "var(--text-muted)",
                          minWidth: 22, whiteSpace: "nowrap",
                        }}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.srcRefs.map((s: string) => (
                      <tr key={s}>
                        <td style={{
                          padding: "2px 6px", background: "var(--bg-secondary)", fontWeight: 500,
                          color: "var(--text-muted)", position: "sticky", left: 0, zIndex: 1,
                          whiteSpace: "nowrap",
                        }}>{s}</td>
                        {heatmap.tgtRefs.map((t: string) => {
                          const cell = heatmap.lookup.get(`${s}|${t}`);
                          return (
                            <td key={t} style={{
                              width: 20, height: 20, padding: 0, textAlign: "center",
                              background: cell ? `${RELATIONSHIP_COLORS[cell.relationship_type]}${cell.strength === 3 ? 'cc' : cell.strength === 2 ? '80' : '40'}` : "transparent",
                              border: "1px solid var(--border)",
                              cursor: cell ? "pointer" : "default",
                            }} title={cell ? `${s} ↔ ${t}: ${RELATIONSHIP_LABELS[cell.relationship_type]} (${STRENGTH_LABELS[cell.strength]})` : ""}>
                              {cell && <span style={{ fontSize: 8, color: "var(--text-primary)" }}>{cell.strength}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FrameworkMappingsPage (Main)
   ═══════════════════════════════════════════════════════════ */
export default function FrameworkMappingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("mappings");

  const COLUMNS: ColumnDef<FrameworkMapping>[] = [
    { key: "source_framework_name", header: "Source Framework" },
    { key: "source_requirement_ref", header: "Source Ref", format: r => r.source_requirement_ref ?? "" },
    { key: "source_requirement_name", header: "Source Wymag.", format: r => r.source_requirement_name ?? "" },
    { key: "target_framework_name", header: "Target Framework" },
    { key: "target_requirement_ref", header: "Target Ref", format: r => r.target_requirement_ref ?? "" },
    { key: "target_requirement_name", header: "Target Wymag.", format: r => r.target_requirement_name ?? "", defaultVisible: false },
    { key: "relationship_type", header: "Relacja", format: r => RELATIONSHIP_PL[r.relationship_type] || r.relationship_type },
    { key: "strength", header: "Siła", format: r => STRENGTH_LABELS[r.strength] || String(r.strength) },
    { key: "mapping_status", header: "Status", format: r => STATUS_LABELS[r.mapping_status] || r.mapping_status },
    { key: "mapping_source", header: "Źródło", format: r => SOURCE_LABELS[r.mapping_source] || r.mapping_source, defaultVisible: false },
    { key: "rationale_type", header: "Uzasadnienie", format: r => r.rationale_type ? RATIONALE_LABELS[r.rationale_type] || r.rationale_type : "", defaultVisible: false },
    { key: "created_at", header: "Utworzono", format: r => r.created_at?.slice(0, 10) ?? "", defaultVisible: false },
  ];

  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(COLUMNS, "framework-mappings-v2");

  const [mappings, setMappings] = useState<FrameworkMapping[]>([]);
  const [sets, setSets] = useState<MappingSet[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [stats, setStats] = useState<MappingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [_fwError, setFwError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FrameworkMapping | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    source_framework_id: 0,
    source_requirement_id: 0,
    target_framework_id: 0,
    target_requirement_id: 0,
    relationship_type: "intersect",
    strength: 2,
    rationale_type: "",
    rationale: "",
    mapping_source: "manual",
  });

  const [sourceNodes, setSourceNodes] = useState<{ id: number; ref_id: string | null; name: string | null }[]>([]);
  const [targetNodes, setTargetNodes] = useState<{ id: number; ref_id: string | null; name: string | null }[]>([]);

  const table = useTableFeatures<FrameworkMapping>({
    data: mappings,
    storageKey: "framework-mappings-v2",
    defaultSort: "source_framework_name",
    defaultSortDir: "asc",
  });

  const load = () => {
    setLoading(true);
    setFwError(null);

    // Load frameworks independently (same pattern as FrameworksPage)
    api.get<Framework[]>("/api/v1/frameworks")
      .then(data => {
        const active = data.filter((f: any) => f.is_active !== false);
        setFrameworks(active);
      })
      .catch(e => {
        console.error("[Mappings] load frameworks failed:", e);
        setFwError(String(e));
      });

    // Load mapping-specific data
    Promise.allSettled([
      api.get<FrameworkMapping[]>("/api/v1/framework-mappings/"),
      api.get<MappingSet[]>("/api/v1/framework-mappings/sets"),
      api.get<MappingStats>("/api/v1/framework-mappings/stats"),
    ])
      .then(([fm, ms, st]) => {
        if (fm.status === "fulfilled") setMappings(fm.value);
        if (ms.status === "fulfilled") setSets(ms.value);
        if (st.status === "fulfilled") setStats(st.value);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const loadNodes = async (frameworkId: number, target: "source" | "target") => {
    if (!frameworkId) return;
    try {
      const nodes = await api.get<any[]>(`/api/v1/frameworks/${frameworkId}/nodes`);
      const flat = nodes.map((n: any) => ({ id: n.id, ref_id: n.ref_id, name: n.name_pl || n.name }));
      if (target === "source") setSourceNodes(flat);
      else setTargetNodes(flat);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!form.source_requirement_id || !form.target_requirement_id) return;
    try {
      await api.post("/api/v1/framework-mappings/", {
        source_framework_id: form.source_framework_id,
        source_requirement_id: form.source_requirement_id,
        target_framework_id: form.target_framework_id,
        target_requirement_id: form.target_requirement_id,
        relationship_type: form.relationship_type,
        strength: form.strength,
        rationale_type: form.rationale_type || undefined,
        rationale: form.rationale || undefined,
        mapping_source: form.mapping_source,
      });
      setShowModal(false);
      load();
    } catch {
      alert("Błąd tworzenia mapowania");
    }
  };

  const handleConfirm = async (id: number) => {
    try {
      await api.post(`/api/v1/framework-mappings/${id}/confirm`, { confirmed_by: "admin" });
      load();
    } catch { alert("Błąd potwierdzania"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Czy na pewno chcesz usunąć to mapowanie?")) return;
    try {
      await api.delete(`/api/v1/framework-mappings/${id}`);
      setSelected(null);
      load();
    } catch { alert("Błąd usuwania"); }
  };

  /* ── Stats ── */
  const src = table.filtered;
  const equalCount = src.filter(m => m.relationship_type === "equal").length;
  const intersectCount = src.filter(m => m.relationship_type === "intersect").length;
  const confirmedCount = src.filter(m => m.mapping_status === "confirmed").length;

  const allEqual = mappings.filter(m => m.relationship_type === "equal").length;
  const allIntersect = mappings.filter(m => m.relationship_type === "intersect").length;
  const allConfirmed = mappings.filter(m => m.mapping_status === "confirmed").length;

  const isFiltered = table.filteredCount !== table.totalCount;

  const statsCards: StatCard[] = [
    { label: "Mapowania ogółem", value: src.length, total: mappings.length, color: "var(--blue)" },
    { label: "Equal (=)", value: equalCount, total: allEqual, color: "#10b981" },
    { label: "Intersect (∩)", value: intersectCount, total: allIntersect, color: "#f59e0b" },
    { label: "Potwierdzone", value: confirmedCount, total: allConfirmed, color: "#6366f1" },
  ];

  const sel = selected;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Mapowania Frameworków</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Mapowanie teoriomnogościowe wymagań (model CISO Assistant)
          </p>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
            <span>Zestawy: <strong>{stats.mapping_sets}</strong></span>
            <span>Pary fw: <strong>{stats.framework_pairs}</strong></span>
          </div>
        )}
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── Mappings Tab ── */}
      {activeTab === "mappings" && (
        <>
          <StatsCards cards={statsCards} isFiltered={isFiltered} />

          <TableToolbar<FrameworkMapping>
            filteredCount={table.filteredCount}
            totalCount={table.totalCount}
            unitLabel="mapowań"
            search={table.search}
            onSearchChange={table.setSearch}
            searchPlaceholder="Szukaj mapowań..."
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(v => !v)}
            hasActiveFilters={table.hasActiveFilters}
            onClearFilters={table.clearAllFilters}
            columns={COLUMNS}
            visibleColumns={visibleCols}
            onToggleColumn={toggleCol}
            data={table.filtered}
            exportFilename="framework_mappings"
            primaryLabel="Nowe mapowanie"
            onPrimaryAction={() => setShowModal(true)}
          />

          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 440px" : "1fr", gap: 14, marginTop: 2 }}>
            <DataTable<FrameworkMapping>
              columns={COLUMNS}
              visibleColumns={visibleCols}
              data={table.pageData}
              rowKey={r => r.id}
              selectedKey={selected?.id ?? null}
              onRowClick={r => setSelected(prev => prev?.id === r.id ? null : r)}
              rowBorderColor={r => RELATIONSHIP_COLORS[r.relationship_type] || undefined}
              renderCell={(row, colKey) => {
                if (colKey === "source_requirement_ref" || colKey === "target_requirement_ref") {
                  const v = colKey === "source_requirement_ref" ? row.source_requirement_ref : row.target_requirement_ref;
                  if (!v) return <span style={{ color: "var(--text-muted)" }}>—</span>;
                  return <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>{v}</span>;
                }
                if (colKey === "relationship_type") return <RelBadge rel={row.relationship_type} />;
                if (colKey === "strength") return <StrengthDots strength={row.strength} />;
                if (colKey === "mapping_status") return <StatusBadge status={row.mapping_status} />;
                if (colKey === "mapping_source") {
                  return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{SOURCE_LABELS[row.mapping_source] || row.mapping_source}</span>;
                }
                return undefined;
              }}
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
              emptyMessage="Brak mapowań. Utwórz korelację między wymaganiami frameworków."
            />

            {/* ── Detail panel ── */}
            {sel && (
              <div className="card" style={{ padding: 16, alignSelf: "start", position: "sticky", top: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Mapowanie #{sel.id}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <RelBadge rel={sel.relationship_type} />
                      <StatusBadge status={sel.mapping_status} />
                    </div>
                  </div>
                  <button className="btn btn-xs" onClick={() => setSelected(null)} title="Zamknij">✕</button>
                </div>

                {/* Strength gauge */}
                <div style={{ textAlign: "center", margin: "12px 0 16px" }}>
                  <StrengthDots strength={sel.strength} />
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Siła powiązania: {sel.strength}/3</div>
                </div>

                <SectionHeader number="1" label="Source (źródło)" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
                  <DetailRow label="Framework" value={sel.source_framework_name} />
                  <DetailRow label="Ref ID" value={sel.source_requirement_ref} />
                  <DetailRow label="Wymaganie" value={sel.source_requirement_name} />
                </div>

                <SectionHeader number="2" label="Target (cel)" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
                  <DetailRow label="Framework" value={sel.target_framework_name} />
                  <DetailRow label="Ref ID" value={sel.target_requirement_ref} />
                  <DetailRow label="Wymaganie" value={sel.target_requirement_name} />
                </div>

                <SectionHeader number="3" label="Metadane" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 12 }}>
                  <DetailRow label="Relacja" value={<RelBadge rel={sel.relationship_type} />} />
                  <DetailRow label="Siła" value={<StrengthDots strength={sel.strength} />} />
                  <DetailRow label="Uzasadnienie" value={sel.rationale_type ? RATIONALE_LABELS[sel.rationale_type] || sel.rationale_type : null} />
                  <DetailRow label="Źródło" value={SOURCE_LABELS[sel.mapping_source] || sel.mapping_source} />
                  {sel.ai_score != null && <DetailRow label="AI Score" value={`${(sel.ai_score * 100).toFixed(1)}%`} color="#6366f1" />}
                  {sel.confirmed_by && <DetailRow label="Potwierdził" value={sel.confirmed_by} />}
                  {sel.confirmed_at && <DetailRow label="Data potwierdzenia" value={sel.confirmed_at.slice(0, 10)} />}
                </div>

                {sel.rationale && (
                  <>
                    <SectionHeader number="4" label="Uzasadnienie" />
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
                      {sel.rationale}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {sel.mapping_status === "draft" && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleConfirm(sel.id)}>
                      Potwierdź
                    </button>
                  )}
                  <button className="btn" style={{ color: "#ef4444" }} onClick={() => handleDelete(sel.id)}>
                    Usuń
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Sets Tab ── */}
      {activeTab === "sets" && <MappingSetsTab sets={sets} frameworks={frameworks} onRefresh={load} />}

      {/* ── AI Suggest Tab ── */}
      {activeTab === "ai_suggest" && <AISuggestTab frameworks={frameworks} onRefresh={load} />}

      {/* ── Coverage Tab ── */}
      {activeTab === "coverage" && <CoverageTab frameworks={frameworks} />}

      {/* ── Matrix Tab ── */}
      {activeTab === "matrix" && <MatrixTab frameworks={frameworks} />}

      {/* ── Create Modal ── */}
      <Modal open={showModal} title="Nowe mapowanie frameworków" onClose={() => setShowModal(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Relationship legend */}
          <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Typy relacji (CISO Assistant):</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: RELATIONSHIP_COLORS[k] }} />
                  <span style={{ color: "var(--text-muted)" }}>{v} — {RELATIONSHIP_PL[k]}</span>
                </span>
              ))}
            </div>
          </div>

          <label>Source Framework *
            <select className="form-control" value={form.source_framework_id} onChange={e => {
              const id = Number(e.target.value);
              setForm({ ...form, source_framework_id: id, source_requirement_id: 0 });
              loadNodes(id, "source");
            }}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <label>Source wymaganie *
            <select className="form-control" value={form.source_requirement_id} onChange={e => setForm({ ...form, source_requirement_id: Number(e.target.value) })}>
              <option value={0}>— wybierz —</option>
              {sourceNodes.map(n => <option key={n.id} value={n.id}>{n.ref_id ? `${n.ref_id} — ` : ""}{n.name}</option>)}
            </select>
          </label>
          <label>Target Framework *
            <select className="form-control" value={form.target_framework_id} onChange={e => {
              const id = Number(e.target.value);
              setForm({ ...form, target_framework_id: id, target_requirement_id: 0 });
              loadNodes(id, "target");
            }}>
              <option value={0}>— wybierz —</option>
              {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
          </label>
          <label>Target wymaganie *
            <select className="form-control" value={form.target_requirement_id} onChange={e => setForm({ ...form, target_requirement_id: Number(e.target.value) })}>
              <option value={0}>— wybierz —</option>
              {targetNodes.map(n => <option key={n.id} value={n.id}>{n.ref_id ? `${n.ref_id} — ` : ""}{n.name}</option>)}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>Relacja *
              <select className="form-control" value={form.relationship_type} onChange={e => setForm({ ...form, relationship_type: e.target.value })}>
                {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Siła (1-3) *
              <select className="form-control" value={form.strength} onChange={e => setForm({ ...form, strength: Number(e.target.value) })}>
                <option value={1}>1 — Słabe</option>
                <option value={2}>2 — Umiarkowane</option>
                <option value={3}>3 — Silne</option>
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>Uzasadnienie (typ)
              <select className="form-control" value={form.rationale_type} onChange={e => setForm({ ...form, rationale_type: e.target.value })}>
                <option value="">— brak —</option>
                {Object.entries(RATIONALE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Źródło
              <select className="form-control" value={form.mapping_source} onChange={e => setForm({ ...form, mapping_source: e.target.value })}>
                {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <label>Uzasadnienie (opis) <textarea className="form-control" value={form.rationale} onChange={e => setForm({ ...form, rationale: e.target.value })} rows={2} /></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.source_requirement_id || !form.target_requirement_id}>Utwórz</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
