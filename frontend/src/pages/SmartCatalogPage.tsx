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
  { key: "correlations", label: "Mapa Powiazan", icon: "🔗" },
  { key: "coverage", label: "Analiza Luk i Skutecznosci", icon: "📊" },
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
  const [coverageExpanded, setCoverageExpanded] = useState<Record<number, boolean>>({});

  /* All links (for tri-panel, detail panels, inline linking) */
  const [allTWLinks, setAllTWLinks] = useState<LinkRecord[]>([]);
  const [allTCLinks, setAllTCLinks] = useState<LinkRecord[]>([]);
  const [allWCLinks, setAllWCLinks] = useState<LinkRecord[]>([]);
  const [allLinksLoaded, setAllLinksLoaded] = useState(false);
  const [triSearch, setTriSearch] = useState<{ threats: string; weaknesses: string; controls: string }>({ threats: "", weaknesses: "", controls: "" });
  const [triSelected, setTriSelected] = useState<{ type: "threat" | "weakness" | "control"; id: number } | null>(null);
  const [showQuickLink, setShowQuickLink] = useState(false);
  const [quickLinkType, setQuickLinkType] = useState<"tw" | "tc" | "wc">("tw");
  const [showEffectiveness, setShowEffectiveness] = useState(false);

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

  const fetchAllLinksData = useCallback(async () => {
    try {
      const [tw, tc, wc] = await Promise.all([
        fetch(`${API}/api/v1/links/threat-weakness`).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/v1/links/threat-control`).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/v1/links/weakness-control`).then(r => r.json()).catch(() => []),
      ]);
      setAllTWLinks(tw);
      setAllTCLinks(tc);
      setAllWCLinks(wc);
      setAllLinksLoaded(true);
    } catch { /* ignore */ }
  }, []);

  const getLinksForThreat = useCallback((threatId: number) => ({
    weaknesses: allTWLinks.filter(l => l.threat_id === threatId),
    controls: allTCLinks.filter(l => l.threat_id === threatId),
  }), [allTWLinks, allTCLinks]);

  const getLinksForWeakness = useCallback((weaknessId: number) => ({
    threats: allTWLinks.filter(l => l.weakness_id === weaknessId),
    controls: allWCLinks.filter(l => l.weakness_id === weaknessId),
  }), [allTWLinks, allWCLinks]);

  const getLinksForControl = useCallback((controlId: number) => ({
    threats: allTCLinks.filter(l => l.control_id === controlId),
    weaknesses: allWCLinks.filter(l => l.control_id === controlId),
  }), [allTCLinks, allWCLinks]);

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
    if (tab === "correlations") {
      fetchLinks(corrType);
      if (!allLinksLoaded) fetchAllLinksData();
    }
  }, [tab, corrType, fetchLinks, allLinksLoaded, fetchAllLinksData]);

  useEffect(() => {
    if (tab === "coverage" && assetCategories.length > 0) {
      fetchCoverage();
      if (!allLinksLoaded) fetchAllLinksData();
    }
  }, [tab, assetCategories, fetchCoverage, allLinksLoaded, fetchAllLinksData]);

  /* Load all links when viewing detail panels (for linked items) */
  useEffect(() => {
    if ((selectedThreat || selectedWeakness || selectedControl) && !allLinksLoaded) {
      fetchAllLinksData();
    }
  }, [selectedThreat, selectedWeakness, selectedControl, allLinksLoaded, fetchAllLinksData]);

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
        <h2 style={{ margin: 0 }}>Katalog Zagrozen, Podatnosci i Zabezpieczen</h2>
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

                  {/* ── Istniejace powiazania (z korelacji) ── */}
                  {allLinksLoaded && (() => {
                    const tLinks = getLinksForThreat(selectedThreat.id);
                    return (
                      <>
                        <SectionHeader number={"\u2463"} label={`Powiazane podatnosci (${tLinks.weaknesses.length})`} />
                        {tLinks.weaknesses.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak powiazan</p>}
                        {tLinks.weaknesses.map(l => (
                          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 12, cursor: "pointer", color: "var(--blue)" }}
                              onClick={() => {
                                const w = weaknesses.find(x => x.id === l.weakness_id);
                                if (w) { setTab("weaknesses"); setSelectedWeakness(w); }
                              }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{l.weakness_ref_id}</span> {l.weakness_name}
                            </span>
                            {l.relevance && <Badge text={l.relevance} color={LEVEL_COLORS[l.relevance]} />}
                          </div>
                        ))}

                        <SectionHeader number={"\u2464"} label={`Powiazane zabezpieczenia (${tLinks.controls.length})`} />
                        {tLinks.controls.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak powiazan</p>}
                        {tLinks.controls.map(l => (
                          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 12, cursor: "pointer", color: "var(--blue)" }}
                              onClick={() => {
                                const c = controls.find(x => x.id === l.control_id);
                                if (c) { setTab("controls"); setSelectedControl(c); }
                              }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{l.control_ref_id}</span> {l.control_name}
                            </span>
                            {l.effectiveness && <Badge text={l.effectiveness} color={LEVEL_COLORS[l.effectiveness]} />}
                          </div>
                        ))}
                      </>
                    );
                  })()}

                  <SectionHeader number={"\u2465"} label={`Sugerowane podatnosci (${suggestedWeaknesses.length})`} />
                  {suggestedWeaknesses.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak sugestii</p>}
                  {suggestedWeaknesses.map(sw => (
                    <div key={sw.weakness_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12 }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{sw.ref_id}</span> {sw.name}
                      </span>
                      <Badge text={sw.relevance} color={LEVEL_COLORS[sw.relevance]} />
                    </div>
                  ))}

                  <SectionHeader number={"\u2466"} label={`Sugerowane zabezpieczenia (${suggestedControls.length})`} />
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

                  {/* ── Powiazania ── */}
                  {allLinksLoaded && (() => {
                    const wLinks = getLinksForWeakness(selectedWeakness.id);
                    return (
                      <>
                        <SectionHeader number={"\u2463"} label={`Powiazane zagrozenia (${wLinks.threats.length})`} />
                        {wLinks.threats.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak powiazan</p>}
                        {wLinks.threats.map(l => (
                          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 12, cursor: "pointer", color: "var(--blue)" }}
                              onClick={() => {
                                const t = threats.find(x => x.id === l.threat_id);
                                if (t) { setTab("threats"); setSelectedThreat(t); fetchSuggestions(t.id); }
                              }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{l.threat_ref_id}</span> {l.threat_name}
                            </span>
                            {l.relevance && <Badge text={l.relevance} color={LEVEL_COLORS[l.relevance]} />}
                          </div>
                        ))}

                        <SectionHeader number={"\u2464"} label={`Powiazane zabezpieczenia (${wLinks.controls.length})`} />
                        {wLinks.controls.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak powiazan</p>}
                        {wLinks.controls.map(l => (
                          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 12, cursor: "pointer", color: "var(--blue)" }}
                              onClick={() => {
                                const c = controls.find(x => x.id === l.control_id);
                                if (c) { setTab("controls"); setSelectedControl(c); }
                              }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{l.control_ref_id}</span> {l.control_name}
                            </span>
                            {l.effectiveness && <Badge text={l.effectiveness} color={LEVEL_COLORS[l.effectiveness]} />}
                          </div>
                        ))}
                      </>
                    );
                  })()}
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

                  {/* ── Powiazania ── */}
                  {allLinksLoaded && (() => {
                    const cLinks = getLinksForControl(selectedControl.id);
                    return (
                      <>
                        <SectionHeader number={"\u2463"} label={`Powiazane zagrozenia (${cLinks.threats.length})`} />
                        {cLinks.threats.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak powiazan</p>}
                        {cLinks.threats.map(l => (
                          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 12, cursor: "pointer", color: "var(--blue)" }}
                              onClick={() => {
                                const t = threats.find(x => x.id === l.threat_id);
                                if (t) { setTab("threats"); setSelectedThreat(t); fetchSuggestions(t.id); }
                              }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{l.threat_ref_id}</span> {l.threat_name}
                            </span>
                            {l.effectiveness && <Badge text={l.effectiveness} color={LEVEL_COLORS[l.effectiveness]} />}
                          </div>
                        ))}

                        <SectionHeader number={"\u2464"} label={`Powiazane podatnosci (${cLinks.weaknesses.length})`} />
                        {cLinks.weaknesses.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak powiazan</p>}
                        {cLinks.weaknesses.map(l => (
                          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 12, cursor: "pointer", color: "var(--blue)" }}
                              onClick={() => {
                                const w = weaknesses.find(x => x.id === l.weakness_id);
                                if (w) { setTab("weaknesses"); setSelectedWeakness(w); }
                              }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{l.weakness_ref_id}</span> {l.weakness_name}
                            </span>
                            {l.effectiveness && <Badge text={l.effectiveness} color={LEVEL_COLORS[l.effectiveness]} />}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ CORRELATIONS TAB — TRI-PANEL VIEW ═══════════ */}
      {tab === "correlations" && (
        <div>
          {/* Info bar */}
          <div style={{
            background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 12, color: "var(--text-secondary)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span>
              <strong>Mapa powiazan</strong> — trojstronny widok zagrozen, podatnosci i zabezpieczen.
              Kliknij element w dowolnej kolumnie aby zobaczyc jego powiazania. Mozesz tworzyc nowe korelacje bezposrednio z tego widoku.
            </span>
          </div>

          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Korelacje: <strong>{allTWLinks.length + allTCLinks.length + allWCLinks.length}</strong>
              </span>
              <select className="form-control" value={corrType} onChange={e => { setCorrType(e.target.value as "tw" | "tc" | "wc"); setTriSelected(null); }} style={{ width: 260, padding: "5px 10px", fontSize: 12 }}>
                <option value="tw">Zagrozenie ↔ Podatnosc</option>
                <option value="tc">Zagrozenie ↔ Zabezpieczenie</option>
                <option value="wc">Podatnosc ↔ Zabezpieczenie</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditLink(null); setShowLinkForm(true); }}>
              + Nowa korelacja
            </button>
          </div>

          {/* ── Tri-panel: three columns ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Threats Column */}
            <div style={{ border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "rgba(220,38,38,0.08)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>⚡</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: "#dc2626" }}>Zagrozenia ({threats.length})</span>
              </div>
              <div style={{ padding: "8px 8px 4px" }}>
                <input className="form-control" style={{ fontSize: 11, padding: "4px 8px", marginBottom: 6 }}
                  placeholder="Szukaj zagrozen..." value={triSearch.threats}
                  onChange={e => setTriSearch(s => ({ ...s, threats: e.target.value }))} />
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto", padding: "0 4px 4px" }}>
                {threats
                  .filter(t => !triSearch.threats || t.ref_id.toLowerCase().includes(triSearch.threats.toLowerCase()) || t.name.toLowerCase().includes(triSearch.threats.toLowerCase()))
                  .map(t => {
                    const isSelected = triSelected?.type === "threat" && triSelected.id === t.id;
                    const isLinked = triSelected && triSelected.type !== "threat" && (
                      (triSelected.type === "weakness" && allTWLinks.some(l => l.threat_id === t.id && l.weakness_id === triSelected.id)) ||
                      (triSelected.type === "control" && allTCLinks.some(l => l.threat_id === t.id && l.control_id === triSelected.id))
                    );
                    return (
                      <div key={t.id} style={{
                        padding: "5px 8px", fontSize: 11, cursor: "pointer", borderRadius: 4, marginBottom: 2,
                        background: isSelected ? "rgba(220,38,38,0.15)" : isLinked ? "rgba(220,38,38,0.08)" : "transparent",
                        border: isLinked ? "1px solid rgba(220,38,38,0.3)" : "1px solid transparent",
                        fontWeight: isSelected || isLinked ? 600 : 400,
                      }} onClick={() => setTriSelected(isSelected ? null : { type: "threat", id: t.id })}>
                        <span style={{ fontFamily: "monospace", color: "#dc2626", marginRight: 4 }}>{t.ref_id}</span>
                        {t.name}
                        {isLinked && <span style={{ marginLeft: 4, color: "#dc2626" }}>●</span>}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Weaknesses Column */}
            <div style={{ border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "rgba(245,158,11,0.08)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🔓</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: "#f59e0b" }}>Podatnosci ({weaknesses.length})</span>
              </div>
              <div style={{ padding: "8px 8px 4px" }}>
                <input className="form-control" style={{ fontSize: 11, padding: "4px 8px", marginBottom: 6 }}
                  placeholder="Szukaj podatnosci..." value={triSearch.weaknesses}
                  onChange={e => setTriSearch(s => ({ ...s, weaknesses: e.target.value }))} />
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto", padding: "0 4px 4px" }}>
                {weaknesses
                  .filter(w => !triSearch.weaknesses || w.ref_id.toLowerCase().includes(triSearch.weaknesses.toLowerCase()) || w.name.toLowerCase().includes(triSearch.weaknesses.toLowerCase()))
                  .map(w => {
                    const isSelected = triSelected?.type === "weakness" && triSelected.id === w.id;
                    const isLinked = triSelected && triSelected.type !== "weakness" && (
                      (triSelected.type === "threat" && allTWLinks.some(l => l.weakness_id === w.id && l.threat_id === triSelected.id)) ||
                      (triSelected.type === "control" && allWCLinks.some(l => l.weakness_id === w.id && l.control_id === triSelected.id))
                    );
                    return (
                      <div key={w.id} style={{
                        padding: "5px 8px", fontSize: 11, cursor: "pointer", borderRadius: 4, marginBottom: 2,
                        background: isSelected ? "rgba(245,158,11,0.15)" : isLinked ? "rgba(245,158,11,0.08)" : "transparent",
                        border: isLinked ? "1px solid rgba(245,158,11,0.3)" : "1px solid transparent",
                        fontWeight: isSelected || isLinked ? 600 : 400,
                      }} onClick={() => setTriSelected(isSelected ? null : { type: "weakness", id: w.id })}>
                        <span style={{ fontFamily: "monospace", color: "#f59e0b", marginRight: 4 }}>{w.ref_id}</span>
                        {w.name}
                        {isLinked && <span style={{ marginLeft: 4, color: "#f59e0b" }}>●</span>}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Controls Column */}
            <div style={{ border: "1px solid rgba(22,163,74,0.2)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "rgba(22,163,74,0.08)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🛡</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: "#16a34a" }}>Zabezpieczenia ({controls.length})</span>
              </div>
              <div style={{ padding: "8px 8px 4px" }}>
                <input className="form-control" style={{ fontSize: 11, padding: "4px 8px", marginBottom: 6 }}
                  placeholder="Szukaj zabezpieczen..." value={triSearch.controls}
                  onChange={e => setTriSearch(s => ({ ...s, controls: e.target.value }))} />
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto", padding: "0 4px 4px" }}>
                {controls
                  .filter(c => !triSearch.controls || c.ref_id.toLowerCase().includes(triSearch.controls.toLowerCase()) || c.name.toLowerCase().includes(triSearch.controls.toLowerCase()))
                  .map(c => {
                    const isSelected = triSelected?.type === "control" && triSelected.id === c.id;
                    const isLinked = triSelected && triSelected.type !== "control" && (
                      (triSelected.type === "threat" && allTCLinks.some(l => l.control_id === c.id && l.threat_id === triSelected.id)) ||
                      (triSelected.type === "weakness" && allWCLinks.some(l => l.control_id === c.id && l.weakness_id === triSelected.id))
                    );
                    return (
                      <div key={c.id} style={{
                        padding: "5px 8px", fontSize: 11, cursor: "pointer", borderRadius: 4, marginBottom: 2,
                        background: isSelected ? "rgba(22,163,74,0.15)" : isLinked ? "rgba(22,163,74,0.08)" : "transparent",
                        border: isLinked ? "1px solid rgba(22,163,74,0.3)" : "1px solid transparent",
                        fontWeight: isSelected || isLinked ? 600 : 400,
                      }} onClick={() => setTriSelected(isSelected ? null : { type: "control", id: c.id })}>
                        <span style={{ fontFamily: "monospace", color: "#16a34a", marginRight: 4 }}>{c.ref_id}</span>
                        {c.name}
                        {isLinked && <span style={{ marginLeft: 4, color: "#16a34a" }}>●</span>}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* ── Selected item links panel ── */}
          {triSelected && (() => {
            const item = triSelected.type === "threat"
              ? threats.find(t => t.id === triSelected.id)
              : triSelected.type === "weakness"
                ? weaknesses.find(w => w.id === triSelected.id)
                : controls.find(c => c.id === triSelected.id);
            if (!item) return null;
            const typeLabel = triSelected.type === "threat" ? "Zagrozenie" : triSelected.type === "weakness" ? "Podatnosc" : "Zabezpieczenie";
            const typeColor = triSelected.type === "threat" ? "#dc2626" : triSelected.type === "weakness" ? "#f59e0b" : "#16a34a";

            const linkedWeaknesses = triSelected.type === "threat"
              ? allTWLinks.filter(l => l.threat_id === triSelected.id)
              : triSelected.type === "control"
                ? allWCLinks.filter(l => l.control_id === triSelected.id)
                : [];
            const linkedThreats = triSelected.type === "weakness"
              ? allTWLinks.filter(l => l.weakness_id === triSelected.id)
              : triSelected.type === "control"
                ? allTCLinks.filter(l => l.control_id === triSelected.id)
                : [];
            const linkedControls = triSelected.type === "threat"
              ? allTCLinks.filter(l => l.threat_id === triSelected.id)
              : triSelected.type === "weakness"
                ? allWCLinks.filter(l => l.weakness_id === triSelected.id)
                : [];

            return (
              <div style={{ border: `1px solid ${typeColor}30`, borderRadius: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: typeColor }}>{typeLabel}:</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{item.ref_id}</span>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => { setEditItem(item); setShowForm(true); }}>Edytuj</button>
                    <button className="btn btn-sm" onClick={() => setTriSelected(null)}>✕</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: triSelected.type === "weakness" ? "1fr 1fr" : triSelected.type === "threat" ? "1fr 1fr" : "1fr 1fr", gap: 16 }}>
                  {/* Linked threats (if not a threat) */}
                  {triSelected.type !== "threat" && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>
                        Powiazane zagrozenia ({linkedThreats.length})
                      </div>
                      {linkedThreats.map(l => (
                        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                          <span>
                            <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#dc2626" }}>{l.threat_ref_id}</span> {l.threat_name}
                          </span>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {(l.relevance || l.effectiveness) && <Badge text={(l.relevance ?? l.effectiveness)!} color={LEVEL_COLORS[(l.relevance ?? l.effectiveness)!]} />}
                            {!l.is_system && (
                              <button style={{ fontSize: 10, cursor: "pointer", color: "var(--red)", background: "none", border: "none" }}
                                onClick={() => handleDeleteLink(l.id)}>✕</button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button className="btn btn-sm" style={{ marginTop: 6, fontSize: 10, color: "#dc2626" }}
                        onClick={() => {
                          setEditLink(null);
                          setCorrType(triSelected.type === "weakness" ? "tw" : "tc");
                          setShowLinkForm(true);
                        }}>
                        + Powiaz z zagrozeniem
                      </button>
                    </div>
                  )}

                  {/* Linked weaknesses (if not a weakness) */}
                  {triSelected.type !== "weakness" && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 6 }}>
                        Powiazane podatnosci ({linkedWeaknesses.length})
                      </div>
                      {linkedWeaknesses.map(l => (
                        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                          <span>
                            <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#f59e0b" }}>{l.weakness_ref_id}</span> {l.weakness_name}
                          </span>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {(l.relevance || l.effectiveness) && <Badge text={(l.relevance ?? l.effectiveness)!} color={LEVEL_COLORS[(l.relevance ?? l.effectiveness)!]} />}
                            {!l.is_system && (
                              <button style={{ fontSize: 10, cursor: "pointer", color: "var(--red)", background: "none", border: "none" }}
                                onClick={() => handleDeleteLink(l.id)}>✕</button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button className="btn btn-sm" style={{ marginTop: 6, fontSize: 10, color: "#f59e0b" }}
                        onClick={() => {
                          setEditLink(null);
                          setCorrType(triSelected.type === "threat" ? "tw" : "wc");
                          setShowLinkForm(true);
                        }}>
                        + Powiaz z podatnoscia
                      </button>
                    </div>
                  )}

                  {/* Linked controls (if not a control) */}
                  {triSelected.type !== "control" && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", marginBottom: 6 }}>
                        Powiazane zabezpieczenia ({linkedControls.length})
                      </div>
                      {linkedControls.map(l => (
                        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                          <span>
                            <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#16a34a" }}>{l.control_ref_id}</span> {l.control_name}
                          </span>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {l.effectiveness && <Badge text={l.effectiveness} color={LEVEL_COLORS[l.effectiveness]} />}
                            {!l.is_system && (
                              <button style={{ fontSize: 10, cursor: "pointer", color: "var(--red)", background: "none", border: "none" }}
                                onClick={() => handleDeleteLink(l.id)}>✕</button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button className="btn btn-sm" style={{ marginTop: 6, fontSize: 10, color: "#16a34a" }}
                        onClick={() => {
                          setEditLink(null);
                          setCorrType(triSelected.type === "threat" ? "tc" : "wc");
                          setShowLinkForm(true);
                        }}>
                        + Powiaz z zabezpieczeniem
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Classic table view (collapsed by default) ── */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
              Widok tabelaryczny korelacji ({linkTable.totalCount})
            </summary>
            <div style={{ marginTop: 8 }}>
              <div className="toolbar" style={{ flexWrap: "wrap", gap: 8, marginBottom: 0 }}>
                <div className="toolbar-left" style={{ alignItems: "center" }}>
                  <input className="form-control" style={{ width: 200, padding: "5px 10px", fontSize: 12 }}
                    placeholder="Szukaj korelacji..." value={linkTable.search}
                    onChange={e => linkTable.setSearch(e.target.value)} />
                </div>
              </div>
              {linksLoading ? (
                <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ladowanie...</div>
              ) : (
                <DataTable<LinkRecord>
                  columns={LINK_COLUMNS} visibleColumns={linkCols} data={linkTable.pageData}
                  rowKey={r => r.id} selectedKey={selectedLink?.id ?? null}
                  onRowClick={r => setSelectedLink(selectedLink?.id === r.id ? null : r)}
                  renderCell={renderLinkCell}
                  sortField={linkTable.sortField} sortDir={linkTable.sortDir} onSort={linkTable.toggleSort}
                  columnFilters={linkTable.columnFilters} onColumnFilter={linkTable.setColumnFilter}
                  showFilters={showFilters}
                  page={linkTable.page} totalPages={linkTable.totalPages}
                  pageSize={linkTable.pageSize} totalItems={linkTable.totalCount}
                  filteredItems={linkTable.filteredCount}
                  onPageChange={linkTable.setPage} onPageSizeChange={linkTable.setPageSize}
                  loading={linksLoading} emptyMessage="Brak korelacji."
                  emptyFilteredMessage="Brak korelacji pasujacych do filtrow."
                />
              )}
            </div>
          </details>
        </div>
      )}

      {/* ═══════════ COVERAGE TAB — INTERACTIVE ═══════════ */}
      {tab === "coverage" && (
        <div>
          {/* Explanation header */}
          <div style={{
            background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: 8, padding: "14px 18px", marginBottom: 16, fontSize: 12, lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--blue)", marginBottom: 6 }}>
              Analiza Luk i Skutecznosci Zabezpieczen
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              Ta analiza pokazuje, dla kazdej kategorii aktywow:
            </div>
            <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "var(--text-secondary)" }}>
              <li><strong>Pokrycie</strong> — ile zagrozen przypisanych do kategorii ma powiazane zabezpieczenia (korelacje Zagrozenie↔Zabezpieczenie)</li>
              <li><strong>Luki</strong> — zagrozenia BEZ zabezpieczen. Kliknij luke aby od razu dodac brakujace zabezpieczenie</li>
              <li><strong>Skutecznosc</strong> — sredni poziom skutecznosci zastosowanych zabezpieczen (na podstawie ocen korelacji)</li>
            </ul>
          </div>

          {/* Coverage meters */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14 }}>Pokrycie wg kategorii aktywow</h3>
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
                    const isExpanded = coverageExpanded[ac.id] ?? false;
                    return (
                      <div key={ac.id} style={{ marginBottom: 16 }}>
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={() => setCoverageExpanded(prev => ({ ...prev, [ac.id]: !prev[ac.id] }))}
                        >
                          <CoverageMeter
                            label={`${ac.name} (${cov.covered}/${cov.total_threats})`}
                            pct={cov.coverage_pct}
                            gaps={cov.gaps.length}
                          />
                        </div>

                        {/* Expanded gap details */}
                        {isExpanded && cov.gaps.length > 0 && (
                          <div style={{
                            marginTop: 4, marginLeft: 8, padding: "10px 14px",
                            background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)",
                            borderRadius: 6,
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", marginBottom: 8 }}>
                              Luki — zagrozenia bez zabezpieczen ({cov.gaps.length})
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                              Te zagrozenia nie maja powiazanego zabezpieczenia. Kliknij "Dodaj zabezpieczenie" aby utworzyc korelacje.
                            </div>
                            {cov.gaps.map((gap, gi) => (
                              <div key={gi} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "6px 0", borderBottom: "1px solid var(--border)",
                              }}>
                                <span style={{ fontSize: 12 }}>
                                  <span style={{ color: "#dc2626", marginRight: 6 }}>⚠</span>
                                  {gap.ref_id && <span style={{ fontFamily: "monospace", fontWeight: 600, marginRight: 4 }}>{gap.ref_id}</span>}
                                  {gap.name ?? "Nieznane zagrozenie"}
                                </span>
                                <button
                                  className="btn btn-sm"
                                  style={{ fontSize: 10, color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)", background: "rgba(22,163,74,0.06)" }}
                                  onClick={() => {
                                    const threatItem = threats.find(t => t.ref_id === gap.ref_id);
                                    if (threatItem) {
                                      setCorrType("tc");
                                      setEditLink(null);
                                      setShowLinkForm(true);
                                    }
                                  }}
                                >
                                  + Dodaj zabezpieczenie
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {isExpanded && cov.gaps.length === 0 && (
                          <div style={{
                            marginTop: 4, marginLeft: 8, padding: "8px 14px", fontSize: 12,
                            background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)",
                            borderRadius: 6, color: "#16a34a",
                          }}>
                            ✓ Pelne pokrycie — wszystkie zagrozenia maja powiazane zabezpieczenia
                          </div>
                        )}
                      </div>
                    );
                  })
                }
                {Object.keys(coverageData).length === 0 && (
                  <div style={{ color: "var(--text-muted)" }}>Brak danych pokrycia — sprawdz czy tabele korelacji maja dane.</div>
                )}
              </>
            )}
          </div>

          {/* ── Control Effectiveness Assessment ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Ocena Skutecznosci Zabezpieczen</h3>
              <button className="btn btn-sm" onClick={() => setShowEffectiveness(!showEffectiveness)} style={{ fontSize: 11 }}>
                {showEffectiveness ? "Zwien" : "Rozwin analize"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Ocena skutecznosci kazdego zabezpieczenia na podstawie: ilosci pokrywanych zagrozen,
              sredniego poziomu skutecznosci (z korelacji) oraz pokrycia kategorii aktywow.
            </div>

            {showEffectiveness && allLinksLoaded && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)" }}>Zabezpieczenie</th>
                      <th style={{ textAlign: "center", padding: "8px 6px", color: "var(--text-muted)" }}>Pokrywa zagrozen</th>
                      <th style={{ textAlign: "center", padding: "8px 6px", color: "var(--text-muted)" }}>Pokrywa podatnosci</th>
                      <th style={{ textAlign: "center", padding: "8px 6px", color: "var(--text-muted)" }}>Sred. skutecznosc</th>
                      <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text-muted)" }}>Ocena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controls.map(c => {
                      const tcLinks = allTCLinks.filter(l => l.control_id === c.id);
                      const wcLinks = allWCLinks.filter(l => l.control_id === c.id);
                      const allEffs = [...tcLinks, ...wcLinks].map(l => l.effectiveness).filter(Boolean);
                      const effScore = allEffs.length > 0
                        ? allEffs.reduce((sum, e) => sum + (e === "HIGH" ? 3 : e === "MEDIUM" ? 2 : 1), 0) / allEffs.length
                        : 0;
                      const effLabel = effScore >= 2.5 ? "Skuteczne" : effScore >= 1.5 ? "Czesciowe" : effScore > 0 ? "Niewystarczajace" : "Brak oceny";
                      const effColor = effScore >= 2.5 ? "#16a34a" : effScore >= 1.5 ? "#f59e0b" : effScore > 0 ? "#dc2626" : "var(--text-muted)";
                      const barPct = effScore > 0 ? (effScore / 3) * 100 : 0;

                      return (
                        <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "6px" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#16a34a", marginRight: 4 }}>{c.ref_id}</span>
                            {c.name}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px" }}>
                            <span style={{ fontWeight: 600 }}>{tcLinks.length}</span>
                          </td>
                          <td style={{ textAlign: "center", padding: "6px" }}>
                            <span style={{ fontWeight: 600 }}>{wcLinks.length}</span>
                          </td>
                          <td style={{ textAlign: "center", padding: "6px" }}>
                            {allEffs.length > 0 ? (
                              <Badge text={effScore >= 2.5 ? "HIGH" : effScore >= 1.5 ? "MEDIUM" : "LOW"}
                                color={effColor} />
                            ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                          </td>
                          <td style={{ padding: "6px", minWidth: 160 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "var(--bg-alt)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", width: `${barPct}%`, background: effColor,
                                  borderRadius: 3, transition: "width 0.5s ease",
                                }} />
                              </div>
                              <span style={{ fontSize: 10, color: effColor, fontWeight: 600, whiteSpace: "nowrap" }}>{effLabel}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {showEffectiveness && !allLinksLoaded && (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 16 }}>Ladowanie danych korelacji...</div>
            )}
          </div>
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
        threats={threats}
        weaknesses={weaknesses}
        controls={controls}
        allTWLinks={allTWLinks}
        allTCLinks={allTCLinks}
        allWCLinks={allWCLinks}
        onLinksChanged={() => { fetchAllLinksData(); }}
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
  threats, weaknesses, controls, allTWLinks, allTCLinks, allWCLinks, onLinksChanged,
}: {
  open: boolean;
  onClose: () => void;
  tab: TabKey;
  editItem: ThreatRecord | WeaknessRecord | ControlRecord | null;
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  assetCategories: AssetCategory[];
  threats?: ThreatRecord[];
  weaknesses?: WeaknessRecord[];
  controls?: ControlRecord[];
  allTWLinks?: LinkRecord[];
  allTCLinks?: LinkRecord[];
  allWCLinks?: LinkRecord[];
  onLinksChanged?: () => void;
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

        {/* ── Inline linking section (only when editing existing item) ── */}
        {editItem && !isReadOnly && threats && weaknesses && controls && (
          <InlineLinkingSection
            tab={tab}
            editItemId={editItem.id}
            threats={threats}
            weaknesses={weaknesses}
            controls={controls}
            allTWLinks={allTWLinks ?? []}
            allTCLinks={allTCLinks ?? []}
            allWCLinks={allWCLinks ?? []}
            onLinksChanged={onLinksChanged}
          />
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
   Inline Linking Section (inside FormModal)
   ══════════════════════════════════════════════════════════ */

function InlineLinkingSection({
  tab, editItemId, threats, weaknesses, controls,
  allTWLinks, allTCLinks, allWCLinks, onLinksChanged,
}: {
  tab: TabKey;
  editItemId: number;
  threats: ThreatRecord[];
  weaknesses: WeaknessRecord[];
  controls: ControlRecord[];
  allTWLinks: LinkRecord[];
  allTCLinks: LinkRecord[];
  allWCLinks: LinkRecord[];
  onLinksChanged?: () => void;
}) {
  const [addingLink, setAddingLink] = useState(false);
  const [newLinkTarget, setNewLinkTarget] = useState<number | "">("");
  const [newLinkLevel, setNewLinkLevel] = useState("MEDIUM");
  const [linkSection, setLinkSection] = useState<"first" | "second">("first");

  const API = import.meta.env.VITE_API_URL ?? "";

  // Determine what links to show based on tab type
  const isTheat = tab === "threats";
  const isWeakness = tab === "weaknesses";
  const isControl = tab === "controls";

  // Get current links
  const linkedWeaknesses = isTheat ? allTWLinks.filter(l => l.threat_id === editItemId) : [];
  const linkedThreatsTW = isWeakness ? allTWLinks.filter(l => l.weakness_id === editItemId) : [];
  const linkedThreatsTC = isControl ? allTCLinks.filter(l => l.control_id === editItemId) : [];
  const linkedControlsTC = isTheat ? allTCLinks.filter(l => l.threat_id === editItemId) : [];
  const linkedControlsWC = isWeakness ? allWCLinks.filter(l => l.weakness_id === editItemId) : [];
  const linkedWeaknessesWC = isControl ? allWCLinks.filter(l => l.control_id === editItemId) : [];

  const firstLinks = isTheat ? linkedWeaknesses : isWeakness ? linkedThreatsTW : linkedThreatsTC;
  const secondLinks = isTheat ? linkedControlsTC : isWeakness ? linkedControlsWC : linkedWeaknessesWC;

  const firstLabel = isTheat ? "Powiazane podatnosci" : isWeakness ? "Powiazane zagrozenia" : "Powiazane zagrozenia";
  const secondLabel = isTheat ? "Powiazane zabezpieczenia" : isWeakness ? "Powiazane zabezpieczenia" : "Powiazane podatnosci";

  const firstColor = isTheat ? "#f59e0b" : "#dc2626";
  const secondColor = isTheat ? "#16a34a" : isWeakness ? "#16a34a" : "#f59e0b";

  const firstItems = isTheat ? weaknesses : isWeakness ? threats : threats;
  const secondItems = isTheat ? controls : isWeakness ? controls : weaknesses;

  const firstLinkedIds = new Set(firstLinks.map(l => l.weakness_id ?? l.threat_id ?? l.control_id));
  const secondLinkedIds = new Set(secondLinks.map(l => l.control_id ?? l.weakness_id ?? l.threat_id));

  const availableFirst = firstItems.filter(i => !firstLinkedIds.has(i.id));
  const availableSecond = secondItems.filter(i => !secondLinkedIds.has(i.id));

  const handleAddLink = async () => {
    if (!newLinkTarget) return;
    setAddingLink(true);
    try {
      let ep = "";
      const data: Record<string, unknown> = {};

      if (linkSection === "first") {
        if (isTheat) {
          ep = "threat-weakness";
          data.threat_id = editItemId;
          data.weakness_id = Number(newLinkTarget);
          data.relevance = newLinkLevel;
        } else if (isWeakness) {
          ep = "threat-weakness";
          data.threat_id = Number(newLinkTarget);
          data.weakness_id = editItemId;
          data.relevance = newLinkLevel;
        } else {
          ep = "threat-control";
          data.threat_id = Number(newLinkTarget);
          data.control_id = editItemId;
          data.effectiveness = newLinkLevel;
        }
      } else {
        if (isTheat) {
          ep = "threat-control";
          data.threat_id = editItemId;
          data.control_id = Number(newLinkTarget);
          data.effectiveness = newLinkLevel;
        } else if (isWeakness) {
          ep = "weakness-control";
          data.weakness_id = editItemId;
          data.control_id = Number(newLinkTarget);
          data.effectiveness = newLinkLevel;
        } else {
          ep = "weakness-control";
          data.weakness_id = Number(newLinkTarget);
          data.control_id = editItemId;
          data.effectiveness = newLinkLevel;
        }
      }

      await fetch(`${API}/api/v1/links/${ep}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setNewLinkTarget("");
      setNewLinkLevel("MEDIUM");
      onLinksChanged?.();
    } catch (e) {
      alert("Blad dodawania powiazania: " + (e instanceof Error ? e.message : e));
    } finally {
      setAddingLink(false);
    }
  };

  const handleRemoveLink = async (linkId: number, ep: string) => {
    try {
      await fetch(`${API}/api/v1/links/${ep}/${linkId}`, { method: "DELETE" });
      onLinksChanged?.();
    } catch { /* ignore */ }
  };

  return (
    <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--blue)", marginBottom: 12 }}>
        Powiazania z innymi elementami katalogu
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* First group */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: firstColor, marginBottom: 6 }}>
            {firstLabel} ({firstLinks.length})
          </div>
          {firstLinks.map(l => {
            const ref = l.weakness_ref_id ?? l.threat_ref_id ?? l.control_ref_id;
            const nm = l.weakness_name ?? l.threat_name ?? l.control_name;
            const level = l.relevance ?? l.effectiveness;
            const ep = isTheat ? "threat-weakness" : isWeakness ? "threat-weakness" : "threat-control";
            return (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                <span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{ref}</span> {nm}
                </span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {level && <Badge text={level} color={LEVEL_COLORS[level]} />}
                  {!l.is_system && (
                    <button style={{ fontSize: 10, cursor: "pointer", color: "var(--red)", background: "none", border: "none" }}
                      onClick={() => handleRemoveLink(l.id, ep)}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
          {/* Add new link */}
          <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
            <select className="form-control" style={{ flex: 1, fontSize: 11, padding: "3px 6px" }}
              value={linkSection === "first" ? newLinkTarget : ""} onChange={e => { setLinkSection("first"); setNewLinkTarget(e.target.value ? Number(e.target.value) : ""); }}>
              <option value="">+ Dodaj...</option>
              {availableFirst.map(i => <option key={i.id} value={i.id}>{i.ref_id} — {i.name}</option>)}
            </select>
            {linkSection === "first" && newLinkTarget && (
              <>
                <select className="form-control" style={{ width: 80, fontSize: 11, padding: "3px 6px" }}
                  value={newLinkLevel} onChange={e => setNewLinkLevel(e.target.value)}>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
                <button className="btn btn-sm" style={{ fontSize: 10 }} disabled={addingLink} onClick={handleAddLink}>
                  {addingLink ? "..." : "Dodaj"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Second group */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: secondColor, marginBottom: 6 }}>
            {secondLabel} ({secondLinks.length})
          </div>
          {secondLinks.map(l => {
            const ref = l.control_ref_id ?? l.weakness_ref_id ?? l.threat_ref_id;
            const nm = l.control_name ?? l.weakness_name ?? l.threat_name;
            const level = l.effectiveness ?? l.relevance;
            const ep = isTheat ? "threat-control" : isWeakness ? "weakness-control" : "weakness-control";
            return (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                <span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{ref}</span> {nm}
                </span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {level && <Badge text={level} color={LEVEL_COLORS[level]} />}
                  {!l.is_system && (
                    <button style={{ fontSize: 10, cursor: "pointer", color: "var(--red)", background: "none", border: "none" }}
                      onClick={() => handleRemoveLink(l.id, ep)}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
          {/* Add new link */}
          <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
            <select className="form-control" style={{ flex: 1, fontSize: 11, padding: "3px 6px" }}
              value={linkSection === "second" ? newLinkTarget : ""} onChange={e => { setLinkSection("second"); setNewLinkTarget(e.target.value ? Number(e.target.value) : ""); }}>
              <option value="">+ Dodaj...</option>
              {availableSecond.map(i => <option key={i.id} value={i.id}>{i.ref_id} — {i.name}</option>)}
            </select>
            {linkSection === "second" && newLinkTarget && (
              <>
                <select className="form-control" style={{ width: 80, fontSize: 11, padding: "3px 6px" }}
                  value={newLinkLevel} onChange={e => setNewLinkLevel(e.target.value)}>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
                <button className="btn btn-sm" style={{ fontSize: 10 }} disabled={addingLink} onClick={handleAddLink}>
                  {addingLink ? "..." : "Dodaj"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
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
