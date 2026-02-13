import { useEffect, useMemo, useState, useCallback } from "react";
import Modal from "../components/Modal";
import StatsCards, { type StatCard } from "../components/StatsCards";
import { useFeatureFlags } from "../hooks/useFeatureFlags";

const API = import.meta.env.VITE_API_URL ?? "";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface ThreatRecord {
  id: number;
  ref_id: string;
  name: string;
  description: string | null;
  category: string;
  source: string;
  cia_impact: { C?: boolean; I?: boolean; A?: boolean } | null;
  is_system: boolean;
  is_active: boolean;
  org_unit_id: number | null;
  asset_category_ids: number[];
}

interface WeaknessRecord {
  id: number;
  ref_id: string;
  name: string;
  description: string | null;
  category: string;
  is_system: boolean;
  is_active: boolean;
  org_unit_id: number | null;
  asset_category_ids: number[];
}

interface ControlRecord {
  id: number;
  ref_id: string;
  name: string;
  description: string | null;
  category: string;
  implementation_type: string;
  is_system: boolean;
  is_active: boolean;
  org_unit_id: number | null;
  asset_category_ids: number[];
}

interface LinkRecord {
  id: number;
  relevance: string | null;
  effectiveness: string | null;
  description: string | null;
  is_system: boolean;
  threat_id: number | null;
  threat_ref_id: string | null;
  threat_name: string | null;
  weakness_id: number | null;
  weakness_ref_id: string | null;
  weakness_name: string | null;
  control_id: number | null;
  control_ref_id: string | null;
  control_name: string | null;
}

interface WeaknessSuggestion {
  weakness_id: number;
  ref_id: string;
  name: string;
  relevance: string;
}

interface ControlSuggestion {
  control_id: number;
  ref_id: string;
  name: string;
  effectiveness: string;
  applied_status: string | null;
}

interface CoverageResult {
  total_threats: number;
  covered: number;
  gaps: { ref_id?: string; name?: string }[];
  coverage_pct: number;
}

interface AssetCategory {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  is_abstract: boolean;
}

/* ══════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════ */

type TabKey = "threats" | "weaknesses" | "controls" | "correlations" | "coverage" | "ai";

const BASE_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "threats", label: "Zagrozenia", icon: "⚡" },
  { key: "weaknesses", label: "Slabosci", icon: "🔓" },
  { key: "controls", label: "Zabezpieczenia", icon: "🛡" },
  { key: "correlations", label: "Korelacje", icon: "🔗" },
  { key: "coverage", label: "Pokrycie", icon: "📊" },
];

const AI_TAB = { key: "ai" as TabKey, label: "AI Asystent", icon: "🤖" };

const THREAT_CATEGORIES = [
  "NATURAL", "ENVIRONMENTAL", "HUMAN_INTENTIONAL", "HUMAN_ACCIDENTAL", "TECHNICAL", "ORGANIZATIONAL",
];
const THREAT_SOURCES = ["INTERNAL", "EXTERNAL", "BOTH"];
const WEAKNESS_CATEGORIES = [
  "HARDWARE", "SOFTWARE", "NETWORK", "PERSONNEL", "SITE", "ORGANIZATION", "PROCESS",
];
const CONTROL_CATEGORIES = ["TECHNICAL", "ORGANIZATIONAL", "PHYSICAL", "LEGAL"];
const CONTROL_IMPL_TYPES = ["PREVENTIVE", "DETECTIVE", "CORRECTIVE", "DETERRENT", "COMPENSATING"];
const RELEVANCE_LEVELS = ["HIGH", "MEDIUM", "LOW"];

const CATEGORY_COLORS: Record<string, string> = {
  NATURAL: "#06b6d4", ENVIRONMENTAL: "#0891b2", HUMAN_INTENTIONAL: "#dc2626",
  HUMAN_ACCIDENTAL: "#f59e0b", TECHNICAL: "#8b5cf6", ORGANIZATIONAL: "#3b82f6",
  HARDWARE: "#64748b", SOFTWARE: "#8b5cf6", NETWORK: "#06b6d4",
  PERSONNEL: "#f59e0b", SITE: "#84cc16", ORGANIZATION: "#3b82f6", PROCESS: "#ec4899",
  PHYSICAL: "#84cc16", LEGAL: "#a855f7",
  PREVENTIVE: "#16a34a", DETECTIVE: "#2563eb", CORRECTIVE: "#ea580c",
  DETERRENT: "#dc2626", COMPENSATING: "#6366f1",
};

const LEVEL_COLORS: Record<string, string> = {
  HIGH: "#dc2626", MEDIUM: "#f59e0b", LOW: "#16a34a",
};

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11,
      fontWeight: 600, background: color ? `${color}22` : "var(--bg-alt)",
      color: color ?? "var(--text-muted)", whiteSpace: "nowrap",
    }}>
      {text}
    </span>
  );
}

function CIABadge({ cia }: { cia: { C?: boolean; I?: boolean; A?: boolean } | null }) {
  if (!cia) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return (
    <span style={{ fontFamily: "monospace", fontSize: 13, letterSpacing: 2 }}>
      <span style={{ color: cia.C ? "#dc2626" : "var(--border)", fontWeight: cia.C ? 700 : 400 }}>C</span>
      <span style={{ color: cia.I ? "#f59e0b" : "var(--border)", fontWeight: cia.I ? 700 : 400 }}>I</span>
      <span style={{ color: cia.A ? "#16a34a" : "var(--border)", fontWeight: cia.A ? 700 : 400 }}>A</span>
    </span>
  );
}

function CoverageMeter({ pct, label, gaps }: { pct: number; label: string; gaps: number }) {
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#dc2626";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span>
          <span style={{ fontWeight: 700, color }}>{pct.toFixed(0)}%</span>
          {gaps > 0 && <span style={{ color: "#dc2626", marginLeft: 8, fontSize: 11 }}>{gaps} luk</span>}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--bg-alt)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════ */

export default function SmartCatalogPage() {
  const { aiEnabled, hasFeature } = useFeatureFlags();
  const [tab, setTab] = useState<TabKey>("threats");
  const [search, setSearch] = useState("");

  /* Data stores */
  const [threats, setThreats] = useState<ThreatRecord[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessRecord[]>([]);
  const [controls, setControls] = useState<ControlRecord[]>([]);
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* AI state */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const TABS = useMemo(() => {
    const tabs = [...BASE_TABS];
    if (aiEnabled) tabs.push(AI_TAB);
    return tabs;
  }, [aiEnabled]);

  /* Filters */
  const [filterCategory, setFilterCategory] = useState("");
  const [filterImplType, setFilterImplType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterAssetCat, setFilterAssetCat] = useState<number | "">("");

  /* Modals */
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ThreatRecord | WeaknessRecord | ControlRecord | null>(null);
  const [saving, setSaving] = useState(false);

  /* Detail / Suggestions */
  const [selectedThreat, setSelectedThreat] = useState<ThreatRecord | null>(null);
  const [suggestedWeaknesses, setSuggestedWeaknesses] = useState<WeaknessSuggestion[]>([]);
  const [suggestedControls, setSuggestedControls] = useState<ControlSuggestion[]>([]);

  /* Correlations */
  const [corrType, setCorrType] = useState<"tw" | "tc" | "wc">("tw");
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  /* Coverage */
  const [coverageData, setCoverageData] = useState<Record<number, CoverageResult>>({});
  const [coverageLoading, setCoverageLoading] = useState(false);

  /* ── Fetchers ── */

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, w, c, ac] = await Promise.all([
        fetch(`${API}/api/v1/threat-catalog`).then(r => r.json()),
        fetch(`${API}/api/v1/weakness-catalog`).then(r => r.json()),
        fetch(`${API}/api/v1/control-catalog`).then(r => r.json()),
        fetch(`${API}/api/v1/asset-categories`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setThreats(t);
      setWeaknesses(w);
      setControls(c);
      setAssetCategories(Array.isArray(ac) ? ac.filter((x: AssetCategory) => !x.is_abstract) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Blad ladowania danych");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchSuggestions = useCallback(async (threatId: number) => {
    try {
      const [ws, cs] = await Promise.all([
        fetch(`${API}/api/v1/suggestions/weaknesses?threat_id=${threatId}`).then(r => r.json()),
        fetch(`${API}/api/v1/suggestions/controls?threat_id=${threatId}`).then(r => r.json()),
      ]);
      setSuggestedWeaknesses(ws);
      setSuggestedControls(cs);
    } catch { /* ignore */ }
  }, []);

  const fetchLinks = useCallback(async (type: "tw" | "tc" | "wc") => {
    setLinksLoading(true);
    try {
      const ep = type === "tw" ? "threat-weakness" : type === "tc" ? "threat-control" : "weakness-control";
      const data = await fetch(`${API}/api/v1/links/${ep}`).then(r => r.json());
      setLinks(data);
    } catch { setLinks([]); }
    finally { setLinksLoading(false); }
  }, []);

  const fetchCoverage = useCallback(async () => {
    setCoverageLoading(true);
    const leafCats = assetCategories.filter(c => !c.is_abstract);
    const results: Record<number, CoverageResult> = {};
    await Promise.all(leafCats.map(async (cat) => {
      try {
        const r = await fetch(`${API}/api/v1/coverage/asset-category/${cat.id}`).then(res => res.json());
        results[cat.id] = r;
      } catch { /* skip */ }
    }));
    setCoverageData(results);
    setCoverageLoading(false);
  }, [assetCategories]);

  /* Tab change effects */
  useEffect(() => {
    if (tab === "correlations") fetchLinks(corrType);
  }, [tab, corrType, fetchLinks]);

  useEffect(() => {
    if (tab === "coverage" && assetCategories.length > 0) fetchCoverage();
  }, [tab, assetCategories, fetchCoverage]);

  /* ── Filtered data ── */

  const filteredThreats = useMemo(() => {
    let items = threats;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(t => t.ref_id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    if (filterCategory) items = items.filter(t => t.category === filterCategory);
    if (filterSource) items = items.filter(t => t.source === filterSource);
    if (filterAssetCat) items = items.filter(t => t.asset_category_ids.includes(Number(filterAssetCat)));
    return items;
  }, [threats, search, filterCategory, filterSource, filterAssetCat]);

  const filteredWeaknesses = useMemo(() => {
    let items = weaknesses;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(w => w.ref_id.toLowerCase().includes(q) || w.name.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q));
    }
    if (filterCategory) items = items.filter(w => w.category === filterCategory);
    if (filterAssetCat) items = items.filter(w => w.asset_category_ids.includes(Number(filterAssetCat)));
    return items;
  }, [weaknesses, search, filterCategory, filterAssetCat]);

  const filteredControls = useMemo(() => {
    let items = controls;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(c => c.ref_id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q));
    }
    if (filterCategory) items = items.filter(c => c.category === filterCategory);
    if (filterImplType) items = items.filter(c => c.implementation_type === filterImplType);
    if (filterAssetCat) items = items.filter(c => c.asset_category_ids.includes(Number(filterAssetCat)));
    return items;
  }, [controls, search, filterCategory, filterImplType, filterAssetCat]);

  const filteredLinks = useMemo(() => {
    if (!search) return links;
    const q = search.toLowerCase();
    return links.filter(l =>
      (l.threat_ref_id ?? "").toLowerCase().includes(q) ||
      (l.threat_name ?? "").toLowerCase().includes(q) ||
      (l.weakness_ref_id ?? "").toLowerCase().includes(q) ||
      (l.weakness_name ?? "").toLowerCase().includes(q) ||
      (l.control_ref_id ?? "").toLowerCase().includes(q) ||
      (l.control_name ?? "").toLowerCase().includes(q)
    );
  }, [links, search]);

  /* ── Stats ── */

  const stats: StatCard[] = useMemo(() => {
    if (tab === "threats") return [
      { label: "Zagrozenia", value: filteredThreats.length, total: threats.length, color: "#dc2626" },
      { label: "Systemowe", value: filteredThreats.filter(t => t.is_system).length, color: "#3b82f6" },
      { label: "Kategorie", value: new Set(filteredThreats.map(t => t.category)).size, color: "#8b5cf6" },
      { label: "Zewnetrzne", value: filteredThreats.filter(t => t.source === "EXTERNAL").length, color: "#f59e0b" },
    ];
    if (tab === "weaknesses") return [
      { label: "Slabosci", value: filteredWeaknesses.length, total: weaknesses.length, color: "#f59e0b" },
      { label: "Systemowe", value: filteredWeaknesses.filter(w => w.is_system).length, color: "#3b82f6" },
      { label: "Kategorie", value: new Set(filteredWeaknesses.map(w => w.category)).size, color: "#8b5cf6" },
    ];
    if (tab === "controls") return [
      { label: "Zabezpieczenia", value: filteredControls.length, total: controls.length, color: "#16a34a" },
      { label: "Systemowe", value: filteredControls.filter(c => c.is_system).length, color: "#3b82f6" },
      { label: "Prewencyjne", value: filteredControls.filter(c => c.implementation_type === "PREVENTIVE").length, color: "#16a34a" },
      { label: "Detektywne", value: filteredControls.filter(c => c.implementation_type === "DETECTIVE").length, color: "#2563eb" },
    ];
    if (tab === "correlations") return [
      { label: "Korelacje", value: filteredLinks.length, total: links.length, color: "#8b5cf6" },
      { label: "Systemowe", value: filteredLinks.filter(l => l.is_system).length, color: "#3b82f6" },
      { label: "HIGH", value: filteredLinks.filter(l => (l.relevance ?? l.effectiveness) === "HIGH").length, color: "#dc2626" },
    ];
    return [];
  }, [tab, filteredThreats, threats, filteredWeaknesses, weaknesses, filteredControls, controls, filteredLinks, links]);

  /* ── CRUD handlers ── */

  const handleSave = async (formData: Record<string, unknown>) => {
    setSaving(true);
    try {
      const isEdit = !!editItem;
      let url = "";
      if (tab === "threats") url = `${API}/api/v1/threat-catalog`;
      else if (tab === "weaknesses") url = `${API}/api/v1/weakness-catalog`;
      else if (tab === "controls") url = `${API}/api/v1/control-catalog`;
      if (isEdit) url += `/${(editItem as { id: number }).id}`;

      await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setEditItem(null);
      await fetchAll();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad zapisu");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (type: "threat" | "weakness" | "control", id: number) => {
    if (!confirm("Archiwizowac wpis?")) return;
    const ep = type === "threat" ? "threat-catalog" : type === "weakness" ? "weakness-catalog" : "control-catalog";
    await fetch(`${API}/api/v1/${ep}/${id}`, { method: "DELETE" });
    await fetchAll();
  };

  /* Reset filters on tab change */
  useEffect(() => {
    setSearch("");
    setFilterCategory("");
    setFilterImplType("");
    setFilterSource("");
    setFilterAssetCat("");
    setSelectedThreat(null);
    setSuggestedWeaknesses([]);
    setSuggestedControls([]);
  }, [tab]);

  const isFiltered = !!(search || filterCategory || filterImplType || filterSource || filterAssetCat);

  /* ── Render ── */

  if (loading) return <div className="page-loading">Ladowanie Smart Catalog...</div>;
  if (error) return <div className="card" style={{ color: "#dc2626", padding: 24 }}>Blad: {error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Smart Catalog</h2>
        {(tab === "threats" || tab === "weaknesses" || tab === "controls") && (
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
            + Dodaj wpis
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "2px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px", border: "none", cursor: "pointer",
              background: tab === t.key ? "var(--blue)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--text-muted)",
              borderRadius: "6px 6px 0 0", fontWeight: tab === t.key ? 600 : 400,
              fontSize: 13, transition: "all 0.2s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      {stats.length > 0 && <StatsCards cards={stats} isFiltered={isFiltered} />}

      {/* Search + Filters bar */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Szukaj (ref_id, nazwa, opis)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
          className="input"
        />

        {tab === "threats" && (
          <>
            <select className="input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 180 }}>
              <option value="">Kategoria...</option>
              {THREAT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ width: 140 }}>
              <option value="">Zrodlo...</option>
              {THREAT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}

        {tab === "weaknesses" && (
          <select className="input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 180 }}>
            <option value="">Kategoria...</option>
            {WEAKNESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {tab === "controls" && (
          <>
            <select className="input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 180 }}>
              <option value="">Kategoria...</option>
              {CONTROL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" value={filterImplType} onChange={e => setFilterImplType(e.target.value)} style={{ width: 180 }}>
              <option value="">Typ implementacji...</option>
              {CONTROL_IMPL_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}

        {(tab === "threats" || tab === "weaknesses" || tab === "controls") && assetCategories.length > 0 && (
          <select className="input" value={filterAssetCat} onChange={e => setFilterAssetCat(e.target.value ? Number(e.target.value) : "")} style={{ width: 180 }}>
            <option value="">Kat. aktywa...</option>
            {assetCategories.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
          </select>
        )}

        {tab === "correlations" && (
          <select className="input" value={corrType} onChange={e => { setCorrType(e.target.value as "tw" | "tc" | "wc"); }} style={{ width: 240 }}>
            <option value="tw">Zagrozenie ↔ Slabosc</option>
            <option value="tc">Zagrozenie ↔ Zabezpieczenie</option>
            <option value="wc">Slabosc ↔ Zabezpieczenie</option>
          </select>
        )}

        {isFiltered && (
          <button className="btn btn-ghost" onClick={() => { setSearch(""); setFilterCategory(""); setFilterImplType(""); setFilterSource(""); setFilterAssetCat(""); }}>
            Wyczysc filtry
          </button>
        )}
      </div>

      {/* ═══════════ THREATS TAB ═══════════ */}
      {tab === "threats" && (
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ overflow: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Nazwa</th>
                    <th>Kategoria</th>
                    <th>Zrodlo</th>
                    <th>CIA</th>
                    <th>Sys</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredThreats.map(t => (
                    <tr
                      key={t.id}
                      style={{ cursor: "pointer", background: selectedThreat?.id === t.id ? "var(--blue-dim)" : undefined }}
                      onClick={() => { setSelectedThreat(t); fetchSuggestions(t.id); }}
                    >
                      <td style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>{t.ref_id}</td>
                      <td>{t.name}</td>
                      <td><Badge text={t.category} color={CATEGORY_COLORS[t.category]} /></td>
                      <td><Badge text={t.source} /></td>
                      <td><CIABadge cia={t.cia_impact} /></td>
                      <td>{t.is_system ? "SYS" : ""}</td>
                      <td>
                        {!t.is_system && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); setEditItem(t); setShowForm(true); }}>Edytuj</button>
                            <button className="btn btn-ghost btn-xs" style={{ color: "#dc2626" }} onClick={e => { e.stopPropagation(); handleArchive("threat", t.id); }}>Arch.</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredThreats.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak wynikow</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Suggestion panel */}
          {selectedThreat && (
            <div style={{ width: 360, flexShrink: 0 }}>
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ margin: "0 0 4px", fontSize: 14 }}>{selectedThreat.ref_id} {selectedThreat.name}</h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>{selectedThreat.description}</p>

                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Sugerowane slabosci ({suggestedWeaknesses.length})
                </div>
                {suggestedWeaknesses.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak sugestii</p>}
                {suggestedWeaknesses.map(sw => (
                  <div key={sw.weakness_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{sw.ref_id}</span> {sw.name}
                    </span>
                    <Badge text={sw.relevance} color={LEVEL_COLORS[sw.relevance]} />
                  </div>
                ))}

                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 16, marginBottom: 8 }}>
                  Sugerowane zabezpieczenia ({suggestedControls.length})
                </div>
                {suggestedControls.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak sugestii</p>}
                {suggestedControls.map(sc => (
                  <div key={sc.control_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{sc.ref_id}</span> {sc.name}
                      {sc.applied_status && (
                        <Badge text={sc.applied_status} color="#16a34a" />
                      )}
                    </span>
                    <Badge text={sc.effectiveness} color={LEVEL_COLORS[sc.effectiveness]} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ WEAKNESSES TAB ═══════════ */}
      {tab === "weaknesses" && (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Nazwa</th>
                <th>Kategoria</th>
                <th>Opis</th>
                <th>Sys</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredWeaknesses.map(w => (
                <tr key={w.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>{w.ref_id}</td>
                  <td>{w.name}</td>
                  <td><Badge text={w.category} color={CATEGORY_COLORS[w.category]} /></td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.description}</td>
                  <td>{w.is_system ? "SYS" : ""}</td>
                  <td>
                    {!w.is_system && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => { setEditItem(w); setShowForm(true); }}>Edytuj</button>
                        <button className="btn btn-ghost btn-xs" style={{ color: "#dc2626" }} onClick={() => handleArchive("weakness", w.id)}>Arch.</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredWeaknesses.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak wynikow</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════ CONTROLS TAB ═══════════ */}
      {tab === "controls" && (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Nazwa</th>
                <th>Kategoria</th>
                <th>Typ</th>
                <th>Opis</th>
                <th>Sys</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredControls.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>{c.ref_id}</td>
                  <td>{c.name}</td>
                  <td><Badge text={c.category} color={CATEGORY_COLORS[c.category]} /></td>
                  <td><Badge text={c.implementation_type} color={CATEGORY_COLORS[c.implementation_type]} /></td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</td>
                  <td>{c.is_system ? "SYS" : ""}</td>
                  <td>
                    {!c.is_system && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => { setEditItem(c); setShowForm(true); }}>Edytuj</button>
                        <button className="btn btn-ghost btn-xs" style={{ color: "#dc2626" }} onClick={() => handleArchive("control", c.id)}>Arch.</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredControls.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak wynikow</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════ CORRELATIONS TAB ═══════════ */}
      {tab === "correlations" && (
        <div className="card" style={{ overflow: "auto" }}>
          {linksLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie korelacji...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {corrType !== "wc" && <th>Zagrozenie</th>}
                  {corrType !== "tc" && <th>Slabosc</th>}
                  {corrType !== "tw" && <th>Zabezpieczenie</th>}
                  <th>{corrType === "tw" ? "Istotnosc" : "Skutecznosc"}</th>
                  <th>Sys</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map(l => (
                  <tr key={l.id}>
                    {corrType !== "wc" && (
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>{l.threat_ref_id}</span>{" "}
                        <span style={{ fontSize: 12 }}>{l.threat_name}</span>
                      </td>
                    )}
                    {corrType !== "tc" && (
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>{l.weakness_ref_id}</span>{" "}
                        <span style={{ fontSize: 12 }}>{l.weakness_name}</span>
                      </td>
                    )}
                    {corrType !== "tw" && (
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>{l.control_ref_id}</span>{" "}
                        <span style={{ fontSize: 12 }}>{l.control_name}</span>
                      </td>
                    )}
                    <td><Badge text={l.relevance ?? l.effectiveness ?? "—"} color={LEVEL_COLORS[l.relevance ?? l.effectiveness ?? ""]} /></td>
                    <td>{l.is_system ? "SYS" : ""}</td>
                  </tr>
                ))}
                {filteredLinks.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>Brak korelacji</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══════════ COVERAGE TAB ═══════════ */}
      {tab === "coverage" && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: "0 0 16px" }}>Analiza pokrycia zagrozeniami wg kategorii aktywow</h3>
          {coverageLoading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>Analizowanie pokrycia...</div>
          ) : assetCategories.length === 0 ? (
            <div style={{ color: "var(--text-muted)" }}>Brak kategorii aktywow</div>
          ) : (
            <>
              {assetCategories
                .filter(ac => coverageData[ac.id] && coverageData[ac.id].total_threats > 0)
                .sort((a, b) => (coverageData[a.id]?.coverage_pct ?? 0) - (coverageData[b.id]?.coverage_pct ?? 0))
                .map(ac => {
                  const cov = coverageData[ac.id];
                  return (
                    <CoverageMeter
                      key={ac.id}
                      label={`${ac.name} (${cov.covered}/${cov.total_threats})`}
                      pct={cov.coverage_pct}
                      gaps={cov.gaps.length}
                    />
                  );
                })
              }
              {Object.keys(coverageData).length === 0 && (
                <div style={{ color: "var(--text-muted)" }}>Brak danych pokrycia — sprawdz czy tabele korelacji maja dane.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════ AI TAB ═══════════ */}
      {tab === "ai" && aiEnabled && (
        <AIAssistantPanel
          assetCategories={assetCategories}
          aiLoading={aiLoading}
          aiResult={aiResult}
          aiError={aiError}
          hasFeature={hasFeature}
          onAction={async (action, params) => {
            setAiLoading(true);
            setAiError(null);
            setAiResult(null);
            try {
              const res = await fetch(`${API}/api/v1/ai/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
              });
              if (!res.ok) {
                const text = await res.text();
                throw new Error(res.status === 503 ? "AI niedostepne" : res.status === 429 ? "Limit zapytan przekroczony" : text);
              }
              setAiResult(await res.json());
            } catch (e) {
              setAiError(e instanceof Error ? e.message : "Blad AI");
            } finally {
              setAiLoading(false);
            }
          }}
        />
      )}

      {/* ═══════════ FORM MODAL ═══════════ */}
      <FormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        tab={tab}
        editItem={editItem}
        saving={saving}
        onSave={handleSave}
        assetCategories={assetCategories}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Form Modal Component
   ══════════════════════════════════════════════════════════ */

function FormModal({
  open, onClose, tab, editItem, saving, onSave, assetCategories,
}: {
  open: boolean;
  onClose: () => void;
  tab: TabKey;
  editItem: ThreatRecord | WeaknessRecord | ControlRecord | null;
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  assetCategories: AssetCategory[];
}) {
  const [refId, setRefId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("BOTH");
  const [implType, setImplType] = useState("");
  const [ciaC, setCiaC] = useState(false);
  const [ciaI, setCiaI] = useState(false);
  const [ciaA, setCiaA] = useState(false);
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);

  useEffect(() => {
    if (open && editItem) {
      setRefId(editItem.ref_id);
      setName(editItem.name);
      setDescription(editItem.description ?? "");
      setCategory(editItem.category);
      setSelectedCatIds(editItem.asset_category_ids ?? []);
      if ("source" in editItem) setSource((editItem as ThreatRecord).source);
      if ("cia_impact" in editItem) {
        const cia = (editItem as ThreatRecord).cia_impact;
        setCiaC(cia?.C ?? false);
        setCiaI(cia?.I ?? false);
        setCiaA(cia?.A ?? false);
      }
      if ("implementation_type" in editItem) setImplType((editItem as ControlRecord).implementation_type);
    } else if (open) {
      setRefId(""); setName(""); setDescription(""); setCategory("");
      setSource("BOTH"); setImplType(""); setCiaC(false); setCiaI(false); setCiaA(false);
      setSelectedCatIds([]);
    }
  }, [open, editItem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      ref_id: refId, name, description: description || null,
      category, asset_category_ids: selectedCatIds,
    };
    if (tab === "threats") {
      data.source = source;
      data.cia_impact = { C: ciaC, I: ciaI, A: ciaA };
    }
    if (tab === "controls") {
      data.implementation_type = implType;
    }
    onSave(data);
  };

  const categories = tab === "threats" ? THREAT_CATEGORIES : tab === "weaknesses" ? WEAKNESS_CATEGORIES : CONTROL_CATEGORIES;
  const title = editItem ? "Edytuj wpis" : "Nowy wpis";

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="label">Ref ID</label>
            <input className="input" value={refId} onChange={e => setRefId(e.target.value)} required placeholder="np. T-100" disabled={!!editItem} />
          </div>
          <div>
            <label className="label">Kategoria</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)} required>
              <option value="">Wybierz...</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="label">Nazwa</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="Nazwa zagrozenia / slabosci / zabezpieczenia" />
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="label">Opis</label>
          <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Opcjonalny opis..." />
        </div>

        {tab === "threats" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <label className="label">Zrodlo</label>
              <select className="input" value={source} onChange={e => setSource(e.target.value)}>
                {THREAT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Wplyw CIA</label>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={ciaC} onChange={e => setCiaC(e.target.checked)} />
                  <span style={{ fontWeight: 600, color: "#dc2626" }}>C</span>onfidentiality
                </label>
                <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={ciaI} onChange={e => setCiaI(e.target.checked)} />
                  <span style={{ fontWeight: 600, color: "#f59e0b" }}>I</span>ntegrity
                </label>
                <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={ciaA} onChange={e => setCiaA(e.target.checked)} />
                  <span style={{ fontWeight: 600, color: "#16a34a" }}>A</span>vailability
                </label>
              </div>
            </div>
          </div>
        )}

        {tab === "controls" && (
          <div style={{ marginTop: 12 }}>
            <label className="label">Typ implementacji</label>
            <select className="input" value={implType} onChange={e => setImplType(e.target.value)} required>
              <option value="">Wybierz...</option>
              {CONTROL_IMPL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {assetCategories.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label className="label">Kategorie aktywow (M2M)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, maxHeight: 120, overflow: "auto", padding: 8, border: "1px solid var(--border)", borderRadius: 6 }}>
              {assetCategories.map(ac => (
                <label key={ac.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedCatIds.includes(ac.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedCatIds([...selectedCatIds, ac.id]);
                      else setSelectedCatIds(selectedCatIds.filter(x => x !== ac.id));
                    }}
                  />
                  {ac.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Anuluj</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Zapisywanie..." : editItem ? "Zapisz zmiany" : "Dodaj"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


/* ══════════════════════════════════════════════════════════
   AI Assistant Panel (rendered only when AI is enabled)
   ══════════════════════════════════════════════════════════ */

function AIAssistantPanel({
  assetCategories,
  aiLoading,
  aiResult,
  aiError,
  hasFeature,
  onAction,
}: {
  assetCategories: AssetCategory[];
  aiLoading: boolean;
  aiResult: Record<string, unknown> | null;
  aiError: string | null;
  hasFeature: (name: "scenario_generation" | "correlation_enrichment" | "natural_language_search" | "gap_analysis" | "entry_assist") => boolean;
  onAction: (action: string, params: Record<string, unknown>) => Promise<void>;
}) {
  const [aiMode, setAiMode] = useState<"scenarios" | "enrich" | "search" | "gap" | "assist">("scenarios");
  const [selectedCatId, setSelectedCatId] = useState<number | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [assistName, setAssistName] = useState("");
  const [assistDesc, setAssistDesc] = useState("");
  const [assistType, setAssistType] = useState<"threat" | "weakness" | "control">("threat");

  const modes = [
    { key: "scenarios", label: "Scenariusze ryzyka", feature: "scenario_generation" as const },
    { key: "enrich", label: "Wzbogac korelacje", feature: "correlation_enrichment" as const },
    { key: "search", label: "Wyszukiwanie NL", feature: "natural_language_search" as const },
    { key: "gap", label: "Analiza luk", feature: "gap_analysis" as const },
    { key: "assist", label: "Asystent wpisu", feature: "entry_assist" as const },
  ].filter(m => hasFeature(m.feature));

  const handleRun = () => {
    switch (aiMode) {
      case "scenarios":
        if (selectedCatId) onAction("generate-scenarios", { asset_category_id: Number(selectedCatId) });
        break;
      case "enrich":
        onAction("enrich-correlations", { scope: "all" });
        break;
      case "search":
        if (searchQuery.length >= 3) onAction("search", { query: searchQuery });
        break;
      case "gap":
        onAction("gap-analysis", selectedCatId ? { asset_category_id: Number(selectedCatId) } : {});
        break;
      case "assist":
        if (assistName) onAction("assist-entry", { entry_type: assistType, name: assistName, description: assistDesc });
        break;
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Left: Controls */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>AI Asystent</h3>

        {modes.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Brak wlaczonych funkcji AI.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {modes.map(m => (
                <button
                  key={m.key}
                  className={`btn ${aiMode === m.key ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: 12 }}
                  onClick={() => setAiMode(m.key as typeof aiMode)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Scenario generation form */}
            {aiMode === "scenarios" && (
              <div>
                <label className="label">Kategoria aktywa</label>
                <select className="input" value={selectedCatId} onChange={e => setSelectedCatId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Wybierz kategorie...</option>
                  {assetCategories.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                </select>
              </div>
            )}

            {/* Search form */}
            {aiMode === "search" && (
              <div>
                <label className="label">Pytanie</label>
                <input
                  className="input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="np. Jakie zagrozenia dotycza pracy zdalnej?"
                />
              </div>
            )}

            {/* Gap analysis */}
            {aiMode === "gap" && (
              <div>
                <label className="label">Kategoria aktywa (opcjonalnie)</label>
                <select className="input" value={selectedCatId} onChange={e => setSelectedCatId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Wszystkie kategorie</option>
                  {assetCategories.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                </select>
              </div>
            )}

            {/* Entry assist */}
            {aiMode === "assist" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label className="label">Typ wpisu</label>
                    <select className="input" value={assistType} onChange={e => setAssistType(e.target.value as typeof assistType)}>
                      <option value="threat">Zagrozenie</option>
                      <option value="weakness">Slabosc</option>
                      <option value="control">Zabezpieczenie</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Nazwa</label>
                    <input className="input" value={assistName} onChange={e => setAssistName(e.target.value)} placeholder="Nazwa wpisu..." />
                  </div>
                </div>
                <label className="label">Opis</label>
                <textarea className="input" value={assistDesc} onChange={e => setAssistDesc(e.target.value)} rows={2} placeholder="Opis wpisu..." />
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={handleRun}
              disabled={aiLoading}
            >
              {aiLoading ? "AI analizuje..." : "Uruchom AI"}
            </button>
          </>
        )}

        {aiError && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "var(--color-danger, #dc2626)", fontSize: "0.85rem" }}>
            {aiError}
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Wyniki AI</h3>
        {aiLoading && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
            AI analizuje dane...
          </div>
        )}
        {!aiLoading && !aiResult && !aiError && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Wybierz funkcje AI i kliknij "Uruchom AI" aby zobaczyc wyniki.
          </p>
        )}
        {aiResult && (
          <div style={{ maxHeight: 500, overflow: "auto" }}>
            <AIResultDisplay data={aiResult} mode={aiMode} />
          </div>
        )}
      </div>
    </div>
  );
}


/* ── AI Result Display ── */

function AIResultDisplay({ data, mode }: { data: Record<string, unknown>; mode: string }) {
  if (mode === "scenarios" && Array.isArray((data as { scenarios?: unknown[] }).scenarios)) {
    const scenarios = (data as { scenarios: Record<string, unknown>[] }).scenarios;
    return (
      <div>
        {scenarios.map((s, i) => (
          <div key={i} style={{ marginBottom: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {String(s.threat_ref_id ?? "")} {String(s.threat_name ?? `Scenariusz ${i + 1}`)}
            </div>
            {s.rationale && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0" }}>{String(s.rationale)}</p>}
            {Array.isArray(s.weaknesses) && s.weaknesses.length > 0 && (
              <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Slabosci:</span>{" "}
                {s.weaknesses.map((w: Record<string, unknown>) => String(w.name ?? w.ref_id ?? "")).join(", ")}
              </div>
            )}
            {Array.isArray(s.suggested_controls) && s.suggested_controls.length > 0 && (
              <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Zabezpieczenia:</span>{" "}
                {s.suggested_controls.map((c: Record<string, unknown>) => String(c.name ?? c.ref_id ?? "")).join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (mode === "enrich" && Array.isArray((data as { suggestions?: unknown[] }).suggestions)) {
    const suggestions = (data as { suggestions: Record<string, unknown>[] }).suggestions;
    return (
      <div>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12 }}>{suggestions.length} sugestii powiazań</p>
        {suggestions.map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
            <span>
              <strong>{String(s.threat_ref_id ?? "")}</strong> → {String(s.target_type ?? "")}: <strong>{String(s.target_ref_id ?? "")}</strong>
            </span>
            <span style={{ color: "var(--text-muted)" }}>{String(s.relevance ?? "")}</span>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "gap") {
    const gaps = data as { critical_gaps?: Record<string, unknown>[]; recommendations?: Record<string, unknown>[]; coverage_pct?: number };
    return (
      <div>
        {gaps.coverage_pct != null && (
          <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 12 }}>
            Pokrycie: {Number(gaps.coverage_pct).toFixed(0)}%
          </div>
        )}
        {Array.isArray(gaps.critical_gaps) && gaps.critical_gaps.length > 0 && (
          <>
            <h4 style={{ fontSize: "0.9rem", marginBottom: 8 }}>Krytyczne luki</h4>
            {gaps.critical_gaps.map((g, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
                <strong>{String(g.area ?? "")}</strong>: {String(g.description ?? "")}
              </div>
            ))}
          </>
        )}
        {Array.isArray(gaps.recommendations) && gaps.recommendations.length > 0 && (
          <>
            <h4 style={{ fontSize: "0.9rem", marginTop: 16, marginBottom: 8 }}>Rekomendacje</h4>
            {gaps.recommendations.map((r, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
                <strong>P{String(r.priority ?? "")}:</strong> {String(r.action ?? "")}
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // Fallback: show JSON
  return (
    <pre style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 400, overflow: "auto" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
