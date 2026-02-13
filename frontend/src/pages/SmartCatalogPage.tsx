import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import Modal from "../components/Modal";
import StatsCards, { type StatCard } from "../components/StatsCards";
import TableToolbar, { type ColumnDef } from "../components/TableToolbar";
import DataTable from "../components/DataTable";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { useTableFeatures } from "../hooks/useTableFeatures";
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
  { key: "weaknesses", label: "Podatnosci", icon: "🔓" },
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

function DetailRow({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right", color: color ?? undefined, fontWeight: color ? 500 : undefined }}>{value ?? "\u2014"}</span>
    </div>
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
   Column Definitions
   ══════════════════════════════════════════════════════════ */

const THREAT_COLUMNS: ColumnDef<ThreatRecord>[] = [
  { key: "ref_id", header: "Ref" },
  { key: "name", header: "Nazwa" },
  { key: "category", header: "Kategoria" },
  { key: "source", header: "Zrodlo" },
  { key: "cia_impact", header: "CIA", format: () => "" },
  { key: "is_system", header: "Typ", format: r => r.is_system ? "SYS" : "ORG" },
  { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
];

const WEAKNESS_COLUMNS: ColumnDef<WeaknessRecord>[] = [
  { key: "ref_id", header: "Ref" },
  { key: "name", header: "Nazwa" },
  { key: "category", header: "Kategoria" },
  { key: "is_system", header: "Typ", format: r => r.is_system ? "SYS" : "ORG" },
  { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
];

const CONTROL_COLUMNS: ColumnDef<ControlRecord>[] = [
  { key: "ref_id", header: "Ref" },
  { key: "name", header: "Nazwa" },
  { key: "category", header: "Kategoria" },
  { key: "implementation_type", header: "Typ impl." },
  { key: "is_system", header: "Typ", format: r => r.is_system ? "SYS" : "ORG" },
  { key: "description", header: "Opis", format: r => r.description ?? "", defaultVisible: false },
];

const LINK_COLUMNS: ColumnDef<LinkRecord>[] = [
  { key: "threat_ref_id", header: "Zagrozenie (Ref)", format: r => r.threat_ref_id ?? "" },
  { key: "threat_name", header: "Zagrozenie", format: r => r.threat_name ?? "" },
  { key: "weakness_ref_id", header: "Podatnosc (Ref)", format: r => r.weakness_ref_id ?? "" },
  { key: "weakness_name", header: "Podatnosc", format: r => r.weakness_name ?? "" },
  { key: "control_ref_id", header: "Zabezpieczenie (Ref)", format: r => r.control_ref_id ?? "" },
  { key: "control_name", header: "Zabezpieczenie", format: r => r.control_name ?? "" },
  { key: "relevance", header: "Istotnosc", format: r => r.relevance ?? "" },
  { key: "effectiveness", header: "Skutecznosc", format: r => r.effectiveness ?? "" },
  { key: "is_system", header: "Typ", format: r => r.is_system ? "SYS" : "ORG" },
];

/* ══════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════ */

export default function SmartCatalogPage() {
  const { aiEnabled, hasFeature } = useFeatureFlags();
  const [tab, setTab] = useState<TabKey>("threats");

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

  /* Modals */
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ThreatRecord | WeaknessRecord | ControlRecord | null>(null);
  const [saving, setSaving] = useState(false);

  /* Detail / Suggestions */
  const [selectedThreat, setSelectedThreat] = useState<ThreatRecord | null>(null);
  const [selectedWeakness, setSelectedWeakness] = useState<WeaknessRecord | null>(null);
  const [selectedControl, setSelectedControl] = useState<ControlRecord | null>(null);
  const [suggestedWeaknesses, setSuggestedWeaknesses] = useState<WeaknessSuggestion[]>([]);
  const [suggestedControls, setSuggestedControls] = useState<ControlSuggestion[]>([]);

  /* Correlations */
  const [corrType, setCorrType] = useState<"tw" | "tc" | "wc">("tw");
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkRecord | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editLink, setEditLink] = useState<LinkRecord | null>(null);

  /* Coverage */
  const [coverageData, setCoverageData] = useState<Record<number, CoverageResult>>({});
  const [coverageLoading, setCoverageLoading] = useState(false);

  /* Table features per tab */
  const [showFilters, setShowFilters] = useState(false);

  const threatTable = useTableFeatures<ThreatRecord>({ data: threats, storageKey: "catalog-threats", defaultSort: "ref_id" });
  const weaknessTable = useTableFeatures<WeaknessRecord>({ data: weaknesses, storageKey: "catalog-weaknesses", defaultSort: "ref_id" });
  const controlTable = useTableFeatures<ControlRecord>({ data: controls, storageKey: "catalog-controls", defaultSort: "ref_id" });
  const linkTable = useTableFeatures<LinkRecord>({ data: links, storageKey: "catalog-links", defaultSort: "threat_ref_id" });

  const { visible: threatCols, toggle: toggleThreatCol } = useColumnVisibility(THREAT_COLUMNS, "catalog-threats");
  const { visible: weaknessCols, toggle: toggleWeaknessCol } = useColumnVisibility(WEAKNESS_COLUMNS, "catalog-weaknesses");
  const { visible: controlCols, toggle: toggleControlCol } = useColumnVisibility(CONTROL_COLUMNS, "catalog-controls");
  const { visible: linkCols } = useColumnVisibility(LINK_COLUMNS, "catalog-links");

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

  /* Reset selections on tab change */
  useEffect(() => {
    setSelectedThreat(null);
    setSelectedWeakness(null);
    setSelectedControl(null);
    setSelectedLink(null);
    setSuggestedWeaknesses([]);
    setSuggestedControls([]);
  }, [tab]);

  /* ── Stats ── */

  const stats: StatCard[] = useMemo(() => {
    if (tab === "threats") return [
      { label: "Zagrozenia", value: threatTable.filteredCount, total: threatTable.totalCount, color: "#dc2626" },
      { label: "Systemowe", value: threatTable.filtered.filter(t => t.is_system).length, color: "#3b82f6" },
      { label: "Kategorie", value: new Set(threatTable.filtered.map(t => t.category)).size, color: "#8b5cf6" },
      { label: "Zewnetrzne", value: threatTable.filtered.filter(t => t.source === "EXTERNAL").length, color: "#f59e0b" },
    ];
    if (tab === "weaknesses") return [
      { label: "Podatnosci", value: weaknessTable.filteredCount, total: weaknessTable.totalCount, color: "#f59e0b" },
      { label: "Systemowe", value: weaknessTable.filtered.filter(w => w.is_system).length, color: "#3b82f6" },
      { label: "Kategorie", value: new Set(weaknessTable.filtered.map(w => w.category)).size, color: "#8b5cf6" },
    ];
    if (tab === "controls") return [
      { label: "Zabezpieczenia", value: controlTable.filteredCount, total: controlTable.totalCount, color: "#16a34a" },
      { label: "Systemowe", value: controlTable.filtered.filter(c => c.is_system).length, color: "#3b82f6" },
      { label: "Prewencyjne", value: controlTable.filtered.filter(c => c.implementation_type === "PREVENTIVE").length, color: "#16a34a" },
      { label: "Detektywne", value: controlTable.filtered.filter(c => c.implementation_type === "DETECTIVE").length, color: "#2563eb" },
    ];
    if (tab === "correlations") return [
      { label: "Korelacje", value: linkTable.filteredCount, total: linkTable.totalCount, color: "#8b5cf6" },
      { label: "Systemowe", value: linkTable.filtered.filter(l => l.is_system).length, color: "#3b82f6" },
      { label: "HIGH", value: linkTable.filtered.filter(l => (l.relevance ?? l.effectiveness) === "HIGH").length, color: "#dc2626" },
    ];
    return [];
  }, [tab, threatTable, weaknessTable, controlTable, linkTable]);

  const isFiltered = tab === "threats" ? threatTable.filteredCount !== threatTable.totalCount
    : tab === "weaknesses" ? weaknessTable.filteredCount !== weaknessTable.totalCount
    : tab === "controls" ? controlTable.filteredCount !== controlTable.totalCount
    : tab === "correlations" ? linkTable.filteredCount !== linkTable.totalCount
    : false;

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

  const handleSaveLink = async (formData: Record<string, unknown>) => {
    setSaving(true);
    try {
      const ep = corrType === "tw" ? "threat-weakness" : corrType === "tc" ? "threat-control" : "weakness-control";
      const isEdit = !!editLink;
      const url = isEdit ? `${API}/api/v1/links/${ep}/${editLink.id}` : `${API}/api/v1/links/${ep}`;
      await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setShowLinkForm(false);
      setEditLink(null);
      await fetchLinks(corrType);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Blad zapisu korelacji");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    if (!confirm("Usunac korelacje?")) return;
    const ep = corrType === "tw" ? "threat-weakness" : corrType === "tc" ? "threat-control" : "weakness-control";
    await fetch(`${API}/api/v1/links/${ep}/${linkId}`, { method: "DELETE" });
    setSelectedLink(null);
    await fetchLinks(corrType);
  };

  /* ── Render helpers ── */

  const renderThreatCell = (row: ThreatRecord, key: string): ReactNode | undefined => {
    if (key === "ref_id") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600 }}>{row.ref_id}</span>;
    if (key === "category") return <Badge text={row.category} color={CATEGORY_COLORS[row.category]} />;
    if (key === "source") return <Badge text={row.source} />;
    if (key === "cia_impact") return <CIABadge cia={row.cia_impact} />;
    if (key === "is_system") return <Badge text={row.is_system ? "SYS" : "ORG"} color={row.is_system ? "#3b82f6" : "#16a34a"} />;
    if (key === "name") return <span style={{ fontWeight: 500 }}>{row.name}</span>;
    return undefined;
  };

  const renderWeaknessCell = (row: WeaknessRecord, key: string): ReactNode | undefined => {
    if (key === "ref_id") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600 }}>{row.ref_id}</span>;
    if (key === "category") return <Badge text={row.category} color={CATEGORY_COLORS[row.category]} />;
    if (key === "is_system") return <Badge text={row.is_system ? "SYS" : "ORG"} color={row.is_system ? "#3b82f6" : "#16a34a"} />;
    if (key === "name") return <span style={{ fontWeight: 500 }}>{row.name}</span>;
    return undefined;
  };

  const renderControlCell = (row: ControlRecord, key: string): ReactNode | undefined => {
    if (key === "ref_id") return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600 }}>{row.ref_id}</span>;
    if (key === "category") return <Badge text={row.category} color={CATEGORY_COLORS[row.category]} />;
    if (key === "implementation_type") return <Badge text={row.implementation_type} color={CATEGORY_COLORS[row.implementation_type]} />;
    if (key === "is_system") return <Badge text={row.is_system ? "SYS" : "ORG"} color={row.is_system ? "#3b82f6" : "#16a34a"} />;
    if (key === "name") return <span style={{ fontWeight: 500 }}>{row.name}</span>;
    return undefined;
  };

  const renderLinkCell = (row: LinkRecord, key: string): ReactNode | undefined => {
    if (key === "threat_ref_id" || key === "weakness_ref_id" || key === "control_ref_id") {
      const v = (row as unknown as Record<string, unknown>)[key];
      return v ? <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600 }}>{String(v)}</span> : <span style={{ color: "var(--text-muted)" }}>—</span>;
    }
    if (key === "relevance") return row.relevance ? <Badge text={row.relevance} color={LEVEL_COLORS[row.relevance]} /> : <span style={{ color: "var(--text-muted)" }}>—</span>;
    if (key === "effectiveness") return row.effectiveness ? <Badge text={row.effectiveness} color={LEVEL_COLORS[row.effectiveness]} /> : <span style={{ color: "var(--text-muted)" }}>—</span>;
    if (key === "is_system") return <Badge text={row.is_system ? "SYS" : "ORG"} color={row.is_system ? "#3b82f6" : "#16a34a"} />;
    return undefined;
  };

  /* ── Render ── */

  if (loading) return <div className="page-loading">Ladowanie Smart Catalog...</div>;
  if (error) return <div className="card" style={{ color: "#dc2626", padding: 24 }}>Blad: {error}</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Smart Catalog</h2>
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

      {/* ═══════════ THREATS TAB ═══════════ */}
      {tab === "threats" && (
        <>
          <TableToolbar<ThreatRecord>
            filteredCount={threatTable.filteredCount}
            totalCount={threatTable.totalCount}
            unitLabel="zagrozenia"
            search={threatTable.search}
            onSearchChange={threatTable.setSearch}
            searchPlaceholder="Szukaj zagrozenia..."
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(f => !f)}
            hasActiveFilters={threatTable.hasActiveFilters}
            onClearFilters={threatTable.clearAllFilters}
            columns={THREAT_COLUMNS}
            visibleColumns={threatCols}
            onToggleColumn={toggleThreatCol}
            data={threatTable.filtered}
            exportFilename="zagrozenia"
            primaryLabel="Nowe zagrozenie"
            onPrimaryAction={() => { setEditItem(null); setShowForm(true); }}
          />
          <div style={{ display: "grid", gridTemplateColumns: selectedThreat ? "1fr 400px" : "1fr", gap: 14 }}>
            <DataTable<ThreatRecord>
              columns={THREAT_COLUMNS}
              visibleColumns={threatCols}
              data={threatTable.pageData}
              rowKey={r => r.id}
              selectedKey={selectedThreat?.id ?? null}
              onRowClick={r => {
                if (selectedThreat?.id === r.id) { setSelectedThreat(null); }
                else { setSelectedThreat(r); fetchSuggestions(r.id); }
              }}
              renderCell={renderThreatCell}
              sortField={threatTable.sortField}
              sortDir={threatTable.sortDir}
              onSort={threatTable.toggleSort}
              columnFilters={threatTable.columnFilters}
              onColumnFilter={threatTable.setColumnFilter}
              showFilters={showFilters}
              page={threatTable.page}
              totalPages={threatTable.totalPages}
              pageSize={threatTable.pageSize}
              totalItems={threatTable.totalCount}
              filteredItems={threatTable.filteredCount}
              onPageChange={threatTable.setPage}
              onPageSizeChange={threatTable.setPageSize}
              loading={loading}
              emptyMessage="Brak zagrozenia w katalogu."
              emptyFilteredMessage="Brak zagrozenia pasujacych do filtrow."
            />

            {/* Detail Panel */}
            {selectedThreat && (
              <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="card-title" style={{ margin: 0 }}>Szczegoly zagrozenia</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => { setEditItem(selectedThreat); setShowForm(true); }}>Edytuj</button>
                    {!selectedThreat.is_system && (
                      <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleArchive("threat", selectedThreat.id)}>Archiwizuj</button>
                    )}
                    <button className="btn btn-sm" onClick={() => setSelectedThreat(null)}>&#10005;</button>
                  </div>
                </div>

                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  <SectionHeader number={"\u2460"} label="Dane zagrozenia" />
                  <DetailRow label="Ref ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selectedThreat.ref_id}</span>} />
                  <DetailRow label="Nazwa" value={<strong>{selectedThreat.name}</strong>} />
                  <DetailRow label="Kategoria" value={<Badge text={selectedThreat.category} color={CATEGORY_COLORS[selectedThreat.category]} />} />
                  <DetailRow label="Zrodlo" value={<Badge text={selectedThreat.source} />} />
                  <DetailRow label="CIA" value={<CIABadge cia={selectedThreat.cia_impact} />} />
                  <DetailRow label="Typ" value={<Badge text={selectedThreat.is_system ? "Systemowy" : "Organizacyjny"} color={selectedThreat.is_system ? "#3b82f6" : "#16a34a"} />} />

                  {selectedThreat.description && (
                    <>
                      <SectionHeader number={"\u2461"} label="Opis" />
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset, var(--bg-alt))", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                        {selectedThreat.description}
                      </div>
                    </>
                  )}

                  {selectedThreat.asset_category_ids.length > 0 && (
                    <>
                      <SectionHeader number={"\u2462"} label="Kategorie aktywow" />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {selectedThreat.asset_category_ids.map(catId => {
                          const cat = assetCategories.find(c => c.id === catId);
                          return cat ? <Badge key={catId} text={cat.name} color="#64748b" /> : null;
                        })}
                      </div>
                    </>
                  )}

                  <SectionHeader number={"\u2463"} label={`Sugerowane podatnosci (${suggestedWeaknesses.length})`} />
                  {suggestedWeaknesses.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak sugestii</p>}
                  {suggestedWeaknesses.map(sw => (
                    <div key={sw.weakness_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12 }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{sw.ref_id}</span> {sw.name}
                      </span>
                      <Badge text={sw.relevance} color={LEVEL_COLORS[sw.relevance]} />
                    </div>
                  ))}

                  <SectionHeader number={"\u2464"} label={`Sugerowane zabezpieczenia (${suggestedControls.length})`} />
                  {suggestedControls.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak sugestii</p>}
                  {suggestedControls.map(sc => (
                    <div key={sc.control_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12 }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{sc.ref_id}</span> {sc.name}
                        {sc.applied_status && <Badge text={sc.applied_status} color="#16a34a" />}
                      </span>
                      <Badge text={sc.effectiveness} color={LEVEL_COLORS[sc.effectiveness]} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ WEAKNESSES TAB ═══════════ */}
      {tab === "weaknesses" && (
        <>
          <TableToolbar<WeaknessRecord>
            filteredCount={weaknessTable.filteredCount}
            totalCount={weaknessTable.totalCount}
            unitLabel="podatnosci"
            search={weaknessTable.search}
            onSearchChange={weaknessTable.setSearch}
            searchPlaceholder="Szukaj podatnosci..."
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(f => !f)}
            hasActiveFilters={weaknessTable.hasActiveFilters}
            onClearFilters={weaknessTable.clearAllFilters}
            columns={WEAKNESS_COLUMNS}
            visibleColumns={weaknessCols}
            onToggleColumn={toggleWeaknessCol}
            data={weaknessTable.filtered}
            exportFilename="podatnosci"
            primaryLabel="Nowa podatnosc"
            onPrimaryAction={() => { setEditItem(null); setShowForm(true); }}
          />
          <div style={{ display: "grid", gridTemplateColumns: selectedWeakness ? "1fr 400px" : "1fr", gap: 14 }}>
            <DataTable<WeaknessRecord>
              columns={WEAKNESS_COLUMNS}
              visibleColumns={weaknessCols}
              data={weaknessTable.pageData}
              rowKey={r => r.id}
              selectedKey={selectedWeakness?.id ?? null}
              onRowClick={r => setSelectedWeakness(selectedWeakness?.id === r.id ? null : r)}
              renderCell={renderWeaknessCell}
              sortField={weaknessTable.sortField}
              sortDir={weaknessTable.sortDir}
              onSort={weaknessTable.toggleSort}
              columnFilters={weaknessTable.columnFilters}
              onColumnFilter={weaknessTable.setColumnFilter}
              showFilters={showFilters}
              page={weaknessTable.page}
              totalPages={weaknessTable.totalPages}
              pageSize={weaknessTable.pageSize}
              totalItems={weaknessTable.totalCount}
              filteredItems={weaknessTable.filteredCount}
              onPageChange={weaknessTable.setPage}
              onPageSizeChange={weaknessTable.setPageSize}
              loading={loading}
              emptyMessage="Brak podatnosci w katalogu."
              emptyFilteredMessage="Brak podatnosci pasujacych do filtrow."
            />

            {/* Detail Panel */}
            {selectedWeakness && (
              <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="card-title" style={{ margin: 0 }}>Szczegoly podatnosci</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => { setEditItem(selectedWeakness); setShowForm(true); }}>Edytuj</button>
                    {!selectedWeakness.is_system && (
                      <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleArchive("weakness", selectedWeakness.id)}>Archiwizuj</button>
                    )}
                    <button className="btn btn-sm" onClick={() => setSelectedWeakness(null)}>&#10005;</button>
                  </div>
                </div>

                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  <SectionHeader number={"\u2460"} label="Dane podatnosci" />
                  <DetailRow label="Ref ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selectedWeakness.ref_id}</span>} />
                  <DetailRow label="Nazwa" value={<strong>{selectedWeakness.name}</strong>} />
                  <DetailRow label="Kategoria" value={<Badge text={selectedWeakness.category} color={CATEGORY_COLORS[selectedWeakness.category]} />} />
                  <DetailRow label="Typ" value={<Badge text={selectedWeakness.is_system ? "Systemowy" : "Organizacyjny"} color={selectedWeakness.is_system ? "#3b82f6" : "#16a34a"} />} />

                  {selectedWeakness.description && (
                    <>
                      <SectionHeader number={"\u2461"} label="Opis" />
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset, var(--bg-alt))", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                        {selectedWeakness.description}
                      </div>
                    </>
                  )}

                  {selectedWeakness.asset_category_ids.length > 0 && (
                    <>
                      <SectionHeader number={"\u2462"} label="Kategorie aktywow" />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {selectedWeakness.asset_category_ids.map(catId => {
                          const cat = assetCategories.find(c => c.id === catId);
                          return cat ? <Badge key={catId} text={cat.name} color="#64748b" /> : null;
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ CONTROLS TAB ═══════════ */}
      {tab === "controls" && (
        <>
          <TableToolbar<ControlRecord>
            filteredCount={controlTable.filteredCount}
            totalCount={controlTable.totalCount}
            unitLabel="zabezpieczen"
            search={controlTable.search}
            onSearchChange={controlTable.setSearch}
            searchPlaceholder="Szukaj zabezpieczen..."
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(f => !f)}
            hasActiveFilters={controlTable.hasActiveFilters}
            onClearFilters={controlTable.clearAllFilters}
            columns={CONTROL_COLUMNS}
            visibleColumns={controlCols}
            onToggleColumn={toggleControlCol}
            data={controlTable.filtered}
            exportFilename="zabezpieczenia"
            primaryLabel="Nowe zabezpieczenie"
            onPrimaryAction={() => { setEditItem(null); setShowForm(true); }}
          />
          <div style={{ display: "grid", gridTemplateColumns: selectedControl ? "1fr 400px" : "1fr", gap: 14 }}>
            <DataTable<ControlRecord>
              columns={CONTROL_COLUMNS}
              visibleColumns={controlCols}
              data={controlTable.pageData}
              rowKey={r => r.id}
              selectedKey={selectedControl?.id ?? null}
              onRowClick={r => setSelectedControl(selectedControl?.id === r.id ? null : r)}
              renderCell={renderControlCell}
              sortField={controlTable.sortField}
              sortDir={controlTable.sortDir}
              onSort={controlTable.toggleSort}
              columnFilters={controlTable.columnFilters}
              onColumnFilter={controlTable.setColumnFilter}
              showFilters={showFilters}
              page={controlTable.page}
              totalPages={controlTable.totalPages}
              pageSize={controlTable.pageSize}
              totalItems={controlTable.totalCount}
              filteredItems={controlTable.filteredCount}
              onPageChange={controlTable.setPage}
              onPageSizeChange={controlTable.setPageSize}
              loading={loading}
              emptyMessage="Brak zabezpieczen w katalogu."
              emptyFilteredMessage="Brak zabezpieczen pasujacych do filtrow."
            />

            {/* Detail Panel */}
            {selectedControl && (
              <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="card-title" style={{ margin: 0 }}>Szczegoly zabezpieczenia</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => { setEditItem(selectedControl); setShowForm(true); }}>Edytuj</button>
                    {!selectedControl.is_system && (
                      <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleArchive("control", selectedControl.id)}>Archiwizuj</button>
                    )}
                    <button className="btn btn-sm" onClick={() => setSelectedControl(null)}>&#10005;</button>
                  </div>
                </div>

                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  <SectionHeader number={"\u2460"} label="Dane zabezpieczenia" />
                  <DetailRow label="Ref ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selectedControl.ref_id}</span>} />
                  <DetailRow label="Nazwa" value={<strong>{selectedControl.name}</strong>} />
                  <DetailRow label="Kategoria" value={<Badge text={selectedControl.category} color={CATEGORY_COLORS[selectedControl.category]} />} />
                  <DetailRow label="Typ implementacji" value={<Badge text={selectedControl.implementation_type} color={CATEGORY_COLORS[selectedControl.implementation_type]} />} />
                  <DetailRow label="Typ" value={<Badge text={selectedControl.is_system ? "Systemowy" : "Organizacyjny"} color={selectedControl.is_system ? "#3b82f6" : "#16a34a"} />} />

                  {selectedControl.description && (
                    <>
                      <SectionHeader number={"\u2461"} label="Opis" />
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset, var(--bg-alt))", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                        {selectedControl.description}
                      </div>
                    </>
                  )}

                  {selectedControl.asset_category_ids.length > 0 && (
                    <>
                      <SectionHeader number={"\u2462"} label="Kategorie aktywow" />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {selectedControl.asset_category_ids.map(catId => {
                          const cat = assetCategories.find(c => c.id === catId);
                          return cat ? <Badge key={catId} text={cat.name} color="#64748b" /> : null;
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ CORRELATIONS TAB ═══════════ */}
      {tab === "correlations" && (
        <>
          <div className="toolbar" style={{ flexWrap: "wrap", gap: 8, marginBottom: 0 }}>
            <div className="toolbar-left" style={{ alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {linkTable.filteredCount !== linkTable.totalCount ? `${linkTable.filteredCount} / ${linkTable.totalCount}` : linkTable.totalCount} korelacji
              </span>
              <select className="form-control" value={corrType} onChange={e => setCorrType(e.target.value as "tw" | "tc" | "wc")} style={{ width: 260, padding: "5px 10px", fontSize: 12 }}>
                <option value="tw">Zagrozenie ↔ Podatnosc</option>
                <option value="tc">Zagrozenie ↔ Zabezpieczenie</option>
                <option value="wc">Podatnosc ↔ Zabezpieczenie</option>
              </select>
              <input
                className="form-control"
                style={{ width: 200, padding: "5px 10px", fontSize: 12 }}
                placeholder="Szukaj korelacji..."
                value={linkTable.search}
                onChange={e => linkTable.setSearch(e.target.value)}
              />
              {linkTable.hasActiveFilters && (
                <button className="btn btn-sm" style={{ fontSize: 11, color: "var(--red)" }} onClick={linkTable.clearAllFilters}>
                  Wyczysc filtry
                </button>
              )}
            </div>
            <div className="toolbar-right" style={{ alignItems: "center" }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditLink(null); setShowLinkForm(true); }}>
                + Nowa korelacja
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selectedLink ? "1fr 400px" : "1fr", gap: 14 }}>
            {linksLoading ? (
              <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie korelacji...</div>
            ) : (
              <DataTable<LinkRecord>
                columns={LINK_COLUMNS}
                visibleColumns={linkCols}
                data={linkTable.pageData}
                rowKey={r => r.id}
                selectedKey={selectedLink?.id ?? null}
                onRowClick={r => setSelectedLink(selectedLink?.id === r.id ? null : r)}
                renderCell={renderLinkCell}
                sortField={linkTable.sortField}
                sortDir={linkTable.sortDir}
                onSort={linkTable.toggleSort}
                columnFilters={linkTable.columnFilters}
                onColumnFilter={linkTable.setColumnFilter}
                showFilters={showFilters}
                page={linkTable.page}
                totalPages={linkTable.totalPages}
                pageSize={linkTable.pageSize}
                totalItems={linkTable.totalCount}
                filteredItems={linkTable.filteredCount}
                onPageChange={linkTable.setPage}
                onPageSizeChange={linkTable.setPageSize}
                loading={linksLoading}
                emptyMessage="Brak korelacji."
                emptyFilteredMessage="Brak korelacji pasujacych do filtrow."
              />
            )}

            {/* Detail Panel */}
            {selectedLink && (
              <div className="card" style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="card-title" style={{ margin: 0 }}>Szczegoly korelacji</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => { setEditLink(selectedLink); setShowLinkForm(true); }}>Edytuj</button>
                    {!selectedLink.is_system && (
                      <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => handleDeleteLink(selectedLink.id)}>Usun</button>
                    )}
                    <button className="btn btn-sm" onClick={() => setSelectedLink(null)}>&#10005;</button>
                  </div>
                </div>

                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  {selectedLink.threat_ref_id && (
                    <>
                      <SectionHeader number={"\u2460"} label="Zagrozenie" />
                      <DetailRow label="Ref ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selectedLink.threat_ref_id}</span>} />
                      <DetailRow label="Nazwa" value={<strong>{selectedLink.threat_name}</strong>} />
                    </>
                  )}

                  {selectedLink.weakness_ref_id && (
                    <>
                      <SectionHeader number={selectedLink.threat_ref_id ? "\u2461" : "\u2460"} label="Podatnosc" />
                      <DetailRow label="Ref ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selectedLink.weakness_ref_id}</span>} />
                      <DetailRow label="Nazwa" value={<strong>{selectedLink.weakness_name}</strong>} />
                    </>
                  )}

                  {selectedLink.control_ref_id && (
                    <>
                      <SectionHeader number={"\u2462"} label="Zabezpieczenie" />
                      <DetailRow label="Ref ID" value={<span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{selectedLink.control_ref_id}</span>} />
                      <DetailRow label="Nazwa" value={<strong>{selectedLink.control_name}</strong>} />
                    </>
                  )}

                  <SectionHeader number={"\u2463"} label="Parametry korelacji" />
                  {selectedLink.relevance && <DetailRow label="Istotnosc" value={<Badge text={selectedLink.relevance} color={LEVEL_COLORS[selectedLink.relevance]} />} />}
                  {selectedLink.effectiveness && <DetailRow label="Skutecznosc" value={<Badge text={selectedLink.effectiveness} color={LEVEL_COLORS[selectedLink.effectiveness]} />} />}
                  <DetailRow label="Typ" value={<Badge text={selectedLink.is_system ? "Systemowy" : "Organizacyjny"} color={selectedLink.is_system ? "#3b82f6" : "#16a34a"} />} />

                  {selectedLink.description && (
                    <>
                      <SectionHeader number={"\u2464"} label="Opis" />
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-inset, var(--bg-alt))", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                        {selectedLink.description}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
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

      {/* ═══════════ CATALOG ITEM FORM MODAL ═══════════ */}
      <FormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        tab={tab}
        editItem={editItem}
        saving={saving}
        onSave={handleSave}
        assetCategories={assetCategories}
      />

      {/* ═══════════ CORRELATION FORM MODAL ═══════════ */}
      <LinkFormModal
        open={showLinkForm}
        onClose={() => { setShowLinkForm(false); setEditLink(null); }}
        corrType={corrType}
        editLink={editLink}
        saving={saving}
        onSave={handleSaveLink}
        threats={threats}
        weaknesses={weaknesses}
        controls={controls}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Form Modal Component (Catalog Items)
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

  const isReadOnly = editItem?.is_system === true;
  const categories = tab === "threats" ? THREAT_CATEGORIES : tab === "weaknesses" ? WEAKNESS_CATEGORIES : CONTROL_CATEGORIES;
  const tabLabel = tab === "threats" ? "zagrozenia" : tab === "weaknesses" ? "podatnosci" : "zabezpieczenia";
  const title = isReadOnly ? `Podglad ${tabLabel} (systemowy)` : editItem ? `Edytuj ${tabLabel}` : `Nowe ${tabLabel}`;

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {isReadOnly && (
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "var(--blue)" }}>
          Wpis systemowy — tylko podglad. Aby edytowac, utworz kopie jako wpis organizacyjny.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Ref ID</span>
            <input className="form-control" value={refId} onChange={e => setRefId(e.target.value)} required placeholder="np. T-100" disabled={!!editItem} readOnly={isReadOnly} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Kategoria</span>
            <select className="form-control" value={category} onChange={e => setCategory(e.target.value)} required disabled={isReadOnly}>
              <option value="">Wybierz...</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nazwa</span>
          <input className="form-control" value={name} onChange={e => setName(e.target.value)} required placeholder="Nazwa wpisu" readOnly={isReadOnly} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Opis</span>
          <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Opcjonalny opis..." readOnly={isReadOnly} style={{ resize: "vertical" }} />
        </label>

        {tab === "threats" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Zrodlo</span>
              <select className="form-control" value={source} onChange={e => setSource(e.target.value)} disabled={isReadOnly}>
                {THREAT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Wplyw CIA</span>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={ciaC} onChange={e => setCiaC(e.target.checked)} disabled={isReadOnly} />
                  <span style={{ fontWeight: 600, color: "#dc2626" }}>C</span>onfidentiality
                </label>
                <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={ciaI} onChange={e => setCiaI(e.target.checked)} disabled={isReadOnly} />
                  <span style={{ fontWeight: 600, color: "#f59e0b" }}>I</span>ntegrity
                </label>
                <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={ciaA} onChange={e => setCiaA(e.target.checked)} disabled={isReadOnly} />
                  <span style={{ fontWeight: 600, color: "#16a34a" }}>A</span>vailability
                </label>
              </div>
            </div>
          </div>
        )}

        {tab === "controls" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Typ implementacji</span>
            <select className="form-control" value={implType} onChange={e => setImplType(e.target.value)} required disabled={isReadOnly}>
              <option value="">Wybierz...</option>
              {CONTROL_IMPL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}

        {assetCategories.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Kategorie aktywow</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 120, overflow: "auto", padding: 8, border: "1px solid var(--border)", borderRadius: 6 }}>
              {assetCategories.map(ac => (
                <label key={ac.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedCatIds.includes(ac.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedCatIds([...selectedCatIds, ac.id]);
                      else setSelectedCatIds(selectedCatIds.filter(x => x !== ac.id));
                    }}
                    disabled={isReadOnly}
                  />
                  {ac.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{isReadOnly ? "Zamknij" : "Anuluj"}</button>
          {!isReadOnly && (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Zapisywanie..." : editItem ? "Zapisz zmiany" : "Dodaj"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   Link / Correlation Form Modal
   ══════════════════════════════════════════════════════════ */

function LinkFormModal({
  open, onClose, corrType, editLink, saving, onSave, threats, weaknesses, controls,
}: {
  open: boolean;
  onClose: () => void;
  corrType: "tw" | "tc" | "wc";
  editLink: LinkRecord | null;
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  threats: ThreatRecord[];
  weaknesses: WeaknessRecord[];
  controls: ControlRecord[];
}) {
  const [threatId, setThreatId] = useState<number | "">("");
  const [weaknessId, setWeaknessId] = useState<number | "">("");
  const [controlId, setControlId] = useState<number | "">("");
  const [relevance, setRelevance] = useState("MEDIUM");
  const [effectiveness, setEffectiveness] = useState("MEDIUM");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open && editLink) {
      setThreatId(editLink.threat_id ?? "");
      setWeaknessId(editLink.weakness_id ?? "");
      setControlId(editLink.control_id ?? "");
      setRelevance(editLink.relevance ?? "MEDIUM");
      setEffectiveness(editLink.effectiveness ?? "MEDIUM");
      setDescription(editLink.description ?? "");
    } else if (open) {
      setThreatId(""); setWeaknessId(""); setControlId("");
      setRelevance("MEDIUM"); setEffectiveness("MEDIUM"); setDescription("");
    }
  }, [open, editLink]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = { description: description || null };
    if (corrType === "tw") {
      data.threat_id = Number(threatId);
      data.weakness_id = Number(weaknessId);
      data.relevance = relevance;
    } else if (corrType === "tc") {
      data.threat_id = Number(threatId);
      data.control_id = Number(controlId);
      data.effectiveness = effectiveness;
    } else {
      data.weakness_id = Number(weaknessId);
      data.control_id = Number(controlId);
      data.effectiveness = effectiveness;
    }
    onSave(data);
  };

  const isReadOnly = editLink?.is_system === true;
  const typeLabel = corrType === "tw" ? "Zagrozenie ↔ Podatnosc" : corrType === "tc" ? "Zagrozenie ↔ Zabezpieczenie" : "Podatnosc ↔ Zabezpieczenie";
  const title = isReadOnly ? `Podglad korelacji (${typeLabel})` : editLink ? `Edytuj korelacje (${typeLabel})` : `Nowa korelacja (${typeLabel})`;

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {isReadOnly && (
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "var(--blue)" }}>
          Korelacja systemowa — tylko podglad.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Left entity */}
          {corrType !== "wc" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Zagrozenie</span>
              <select className="form-control" value={threatId} onChange={e => setThreatId(e.target.value ? Number(e.target.value) : "")} required disabled={isReadOnly || !!editLink}>
                <option value="">Wybierz zagrozenie...</option>
                {threats.map(t => <option key={t.id} value={t.id}>{t.ref_id} — {t.name}</option>)}
              </select>
            </label>
          )}

          {/* Right entity */}
          {corrType === "tw" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Podatnosc</span>
              <select className="form-control" value={weaknessId} onChange={e => setWeaknessId(e.target.value ? Number(e.target.value) : "")} required disabled={isReadOnly || !!editLink}>
                <option value="">Wybierz podatnosc...</option>
                {weaknesses.map(w => <option key={w.id} value={w.id}>{w.ref_id} — {w.name}</option>)}
              </select>
            </label>
          )}

          {corrType === "tc" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Zabezpieczenie</span>
              <select className="form-control" value={controlId} onChange={e => setControlId(e.target.value ? Number(e.target.value) : "")} required disabled={isReadOnly || !!editLink}>
                <option value="">Wybierz zabezpieczenie...</option>
                {controls.map(c => <option key={c.id} value={c.id}>{c.ref_id} — {c.name}</option>)}
              </select>
            </label>
          )}

          {corrType === "wc" && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Podatnosc</span>
                <select className="form-control" value={weaknessId} onChange={e => setWeaknessId(e.target.value ? Number(e.target.value) : "")} required disabled={isReadOnly || !!editLink}>
                  <option value="">Wybierz podatnosc...</option>
                  {weaknesses.map(w => <option key={w.id} value={w.id}>{w.ref_id} — {w.name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Zabezpieczenie</span>
                <select className="form-control" value={controlId} onChange={e => setControlId(e.target.value ? Number(e.target.value) : "")} required disabled={isReadOnly || !!editLink}>
                  <option value="">Wybierz zabezpieczenie...</option>
                  {controls.map(c => <option key={c.id} value={c.id}>{c.ref_id} — {c.name}</option>)}
                </select>
              </label>
            </>
          )}
        </div>

        {/* Level selector */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{corrType === "tw" ? "Istotnosc" : "Skutecznosc"}</span>
          <select
            className="form-control"
            value={corrType === "tw" ? relevance : effectiveness}
            onChange={e => corrType === "tw" ? setRelevance(e.target.value) : setEffectiveness(e.target.value)}
            disabled={isReadOnly}
          >
            {RELEVANCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Opis (opcjonalnie)</span>
          <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Opis korelacji..." readOnly={isReadOnly} style={{ resize: "vertical" }} />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{isReadOnly ? "Zamknij" : "Anuluj"}</button>
          {!isReadOnly && (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Zapisywanie..." : editLink ? "Zapisz zmiany" : "Dodaj korelacje"}
            </button>
          )}
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
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Kategoria aktywa</span>
                <select className="form-control" value={selectedCatId} onChange={e => setSelectedCatId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Wybierz kategorie...</option>
                  {assetCategories.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                </select>
              </label>
            )}

            {/* Search form */}
            {aiMode === "search" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Pytanie</span>
                <input
                  className="form-control"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="np. Jakie zagrozenia dotycza pracy zdalnej?"
                />
              </label>
            )}

            {/* Gap analysis */}
            {aiMode === "gap" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Kategoria aktywa (opcjonalnie)</span>
                <select className="form-control" value={selectedCatId} onChange={e => setSelectedCatId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Wszystkie kategorie</option>
                  {assetCategories.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                </select>
              </label>
            )}

            {/* Entry assist */}
            {aiMode === "assist" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Typ wpisu</span>
                    <select className="form-control" value={assistType} onChange={e => setAssistType(e.target.value as typeof assistType)}>
                      <option value="threat">Zagrozenie</option>
                      <option value="weakness">Podatnosc</option>
                      <option value="control">Zabezpieczenie</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nazwa</span>
                    <input className="form-control" value={assistName} onChange={e => setAssistName(e.target.value)} placeholder="Nazwa wpisu..." />
                  </label>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Opis</span>
                  <textarea className="form-control" value={assistDesc} onChange={e => setAssistDesc(e.target.value)} rows={2} placeholder="Opis wpisu..." style={{ resize: "vertical" }} />
                </label>
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
            {s.rationale != null && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0" }}>{String(s.rationale)}</p>}
            {Array.isArray(s.weaknesses) && s.weaknesses.length > 0 && (
              <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Podatnosci:</span>{" "}
                {(s.weaknesses as Record<string, unknown>[]).map((w) => String(w.name ?? w.ref_id ?? "")).join(", ")}
              </div>
            )}
            {Array.isArray(s.suggested_controls) && s.suggested_controls.length > 0 && (
              <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Zabezpieczenia:</span>{" "}
                {(s.suggested_controls as Record<string, unknown>[]).map((c) => String(c.name ?? c.ref_id ?? "")).join(", ")}
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
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12 }}>{suggestions.length} sugestii powiazan</p>
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
