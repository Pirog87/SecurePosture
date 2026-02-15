import { useEffect, useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL ?? "";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface AIConfig {
  id: number;
  provider_type: string;
  api_endpoint: string | null;
  api_key_masked: string | null;
  model_name: string | null;
  is_active: boolean;
  max_tokens: number;
  temperature: number;
  max_requests_per_user_per_hour: number;
  max_requests_per_user_per_day: number;
  max_requests_per_org_per_day: number;
  feature_scenario_generation: boolean;
  feature_correlation_enrichment: boolean;
  feature_natural_language_search: boolean;
  feature_gap_analysis: boolean;
  feature_entry_assist: boolean;
  feature_interpret: boolean;
  feature_translate: boolean;
  feature_evidence: boolean;
  feature_security_area_map: boolean;
  feature_cross_mapping: boolean;
  feature_coverage_report: boolean;
  feature_document_import: boolean;
  feature_management_report: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
}

interface UsageStats {
  requests_count: number;
  tokens_used: number;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  acceptance_rate: number | null;
  by_action: Record<string, number>;
  requests_with_tracking: number;
}

const EMPTY_CONFIG: AIConfig = {
  id: 0,
  provider_type: "none",
  api_endpoint: null,
  api_key_masked: null,
  model_name: null,
  is_active: false,
  max_tokens: 4000,
  temperature: 0.3,
  max_requests_per_user_per_hour: 20,
  max_requests_per_user_per_day: 100,
  max_requests_per_org_per_day: 500,
  feature_scenario_generation: true,
  feature_correlation_enrichment: true,
  feature_natural_language_search: true,
  feature_gap_analysis: true,
  feature_entry_assist: true,
  feature_interpret: true,
  feature_translate: true,
  feature_evidence: true,
  feature_security_area_map: true,
  feature_cross_mapping: true,
  feature_coverage_report: true,
  feature_document_import: true,
  feature_management_report: true,
  last_test_at: null,
  last_test_ok: null,
  last_test_error: null,
};

const PROVIDER_OPTIONS = [
  { value: "none", label: "Brak (wyłączone)" },
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "openai_compatible", label: "OpenAI-compatible (OpenAI, vLLM, Ollama)" },
];

const FEATURE_TOGGLES: { key: string; label: string; desc: string; group: string; promptKeys?: string[] }[] = [
  // Smart Catalog
  { key: "feature_scenario_generation", label: "Generowanie scenariuszy ryzyka", desc: "AI tworzy scenariusze zagrożeń dla kategorii aktywów", group: "catalog", promptKeys: ["scenario_gen"] },
  { key: "feature_correlation_enrichment", label: "Wzbogacanie korelacji", desc: "AI sugeruje brakujące powiązania threat-weakness-control", group: "catalog", promptKeys: ["enrichment"] },
  { key: "feature_natural_language_search", label: "Wyszukiwanie w języku naturalnym", desc: "Wyszukiwanie w katalogach za pomocą pytań w języku naturalnym", group: "catalog", promptKeys: ["search"] },
  { key: "feature_gap_analysis", label: "Analiza luk bezpieczeństwa", desc: "AI analizuje pokrycie i identyfikuje luki", group: "catalog", promptKeys: ["gap_analysis"] },
  { key: "feature_entry_assist", label: "Asystent tworzenia wpisów", desc: "AI podpowiada klasyfikację i powiązania nowych wpisów", group: "catalog", promptKeys: ["assist"] },
  // Framework / Document
  { key: "feature_interpret", label: "Interpretacja wymagań", desc: "AI wyjaśnia wymagania z frameworków w praktycznym kontekście", group: "framework", promptKeys: ["interpret"] },
  { key: "feature_translate", label: "Tłumaczenie wymagań", desc: "AI tłumaczy wymagania na wybrany język z zachowaniem terminologii", group: "framework", promptKeys: ["translate"] },
  { key: "feature_evidence", label: "Generowanie dowodów audytowych", desc: "AI generuje listę dowodów jakich może wymagać audytor", group: "framework", promptKeys: ["evidence"] },
  { key: "feature_security_area_map", label: "Mapowanie obszarów bezpieczeństwa", desc: "AI przypisuje wymagania do obszarów bezpieczeństwa", group: "framework", promptKeys: ["security_area_map"] },
  { key: "feature_cross_mapping", label: "Cross-mapping frameworków", desc: "AI mapuje wymagania między różnymi standardami", group: "framework", promptKeys: ["cross_mapping"] },
  { key: "feature_coverage_report", label: "Raporty pokrycia", desc: "AI generuje raporty zarządcze o pokryciu między frameworkami", group: "framework", promptKeys: ["coverage_report"] },
  { key: "feature_document_import", label: "Import dokumentów AI", desc: "AI analizuje dokumenty PDF/DOCX i wyodrębnia strukturę frameworka", group: "framework", promptKeys: ["document_import", "document_import_continuation"] },
  // Raporty
  { key: "feature_management_report", label: "Raport zarządczy AI", desc: "AI generuje kompleksowy raport zarządczy na podstawie danych o ryzykach, aktywach i stanie bezpieczeństwa", group: "reports", promptKeys: ["management_report"] },
];

const ACTION_LABELS: Record<string, string> = {
  SCENARIO_GEN: "Scenariusze ryzyka",
  ENRICHMENT: "Wzbogacanie korelacji",
  SEARCH: "Wyszukiwanie NLP",
  GAP_ANALYSIS: "Analiza luk",
  ASSIST: "Asystent wpisów",
  INTERPRET: "Interpretacja wymagań",
  TRANSLATE: "Tłumaczenia",
  EVIDENCE: "Dowody audytowe",
  SECURITY_AREA_MAP: "Mapowanie obszarów",
  CROSS_MAPPING: "Cross-mapping",
  COVERAGE_REPORT: "Raporty pokrycia",
  DOCUMENT_IMPORT: "Import dokumentów",
  MANAGEMENT_REPORT: "Raport zarządczy",
};

/* ══════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════ */

export default function AIConfigPage() {
  const [config, setConfig] = useState<AIConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; response_time_ms?: number } | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  // Form fields (separate from saved config for editing)
  const [form, setForm] = useState({
    provider_type: "none",
    api_endpoint: "",
    api_key: "",
    model_name: "",
    max_tokens: 4000,
    temperature: 0.3,
    max_requests_per_user_per_hour: 20,
    max_requests_per_user_per_day: 100,
    max_requests_per_org_per_day: 500,
    feature_scenario_generation: true,
    feature_correlation_enrichment: true,
    feature_natural_language_search: true,
    feature_gap_analysis: true,
    feature_entry_assist: true,
    feature_interpret: true,
    feature_translate: true,
    feature_evidence: true,
    feature_security_area_map: true,
    feature_cross_mapping: true,
    feature_coverage_report: true,
    feature_document_import: true,
    feature_management_report: true,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/admin/ai-config`);
      if (res.ok) {
        const data: AIConfig = await res.json();
        setConfig(data);
        setForm({
          provider_type: data.provider_type,
          api_endpoint: data.api_endpoint ?? "",
          api_key: "",
          model_name: data.model_name ?? "",
          max_tokens: data.max_tokens,
          temperature: data.temperature,
          max_requests_per_user_per_hour: data.max_requests_per_user_per_hour,
          max_requests_per_user_per_day: data.max_requests_per_user_per_day,
          max_requests_per_org_per_day: data.max_requests_per_org_per_day,
          feature_scenario_generation: data.feature_scenario_generation,
          feature_correlation_enrichment: data.feature_correlation_enrichment,
          feature_natural_language_search: data.feature_natural_language_search,
          feature_gap_analysis: data.feature_gap_analysis,
          feature_entry_assist: data.feature_entry_assist,
          feature_interpret: data.feature_interpret,
          feature_translate: data.feature_translate,
          feature_evidence: data.feature_evidence,
          feature_security_area_map: data.feature_security_area_map,
          feature_cross_mapping: data.feature_cross_mapping,
          feature_coverage_report: data.feature_coverage_report,
          feature_document_import: data.feature_document_import,
          feature_management_report: data.feature_management_report,
        });
      }
    } catch {
      // Config doesn't exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/ai/usage-stats?days=${days}`);
      if (res.ok) {
        setUsage(await res.json());
      }
    } catch {
      // Not critical
    }
  }, [days]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.api_key) delete payload.api_key;

      const res = await fetch(`${API}/api/v1/admin/ai-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSuccess("Konfiguracja zapisana");
        fetchConfig();
        fetchUsage();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const body = await res.text();
        setError(`Błąd zapisu: ${body}`);
      }
    } catch (e) {
      setError(`Błąd: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/api/v1/admin/ai-config/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      fetchConfig();
    } catch (e) {
      setTestResult({ success: false, message: `Błąd połączenia: ${e}` });
    } finally {
      setTesting(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    try {
      const endpoint = active ? "activate" : "deactivate";
      const res = await fetch(`${API}/api/v1/admin/ai-config/${endpoint}`, { method: "POST" });
      if (res.ok) {
        setSuccess(active ? "AI aktywowane" : "AI dezaktywowane");
        fetchConfig();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e) {
      setError(`Błąd: ${e}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Ładowanie konfiguracji AI...
      </div>
    );
  }

  const providerLabel = PROVIDER_OPTIONS.find((p) => p.value === config.provider_type)?.label ?? config.provider_type;
  const totalActions = usage ? Object.values(usage.by_action).reduce((a, b) => a + b, 0) : 0;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1000 }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Integracja AI</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
          AI jest opcjonalnym pluginem. System działa w pełni bez AI — elementy AI pojawiają się dopiero po aktywacji.
        </p>
      </div>

      {/* ── Alert messages ── */}
      {error && (
        <div className="card" style={{ background: "var(--red-dim)", borderColor: "var(--red)", marginBottom: 16, padding: "12px 16px" }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-sm" style={{ float: "right", padding: "2px 8px", fontSize: 11 }}>×</button>
        </div>
      )}
      {success && (
        <div className="card" style={{ background: "var(--green-dim)", borderColor: "var(--green)", marginBottom: 16, padding: "12px 16px" }}>
          <span style={{ color: "var(--green)", fontSize: 13 }}>{success}</span>
        </div>
      )}

      {/* ── KPI Cards Row ── */}
      <div className="grid-2" style={{ marginBottom: 20, maxWidth: 500 }}>
        {/* Status */}
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 12,
            background: config.is_active ? "var(--green-dim)" : "rgba(255,255,255,0.06)",
            color: config.is_active ? "var(--green)" : "var(--text-muted)",
            fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: config.is_active ? "var(--green)" : "var(--text-muted)" }} />
            {config.is_active ? "Aktywne" : "Nieaktywne"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Status AI</div>
        </div>

        {/* Provider/Model */}
        <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--blue)" }}>
            {providerLabel}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {config.model_name || "—"}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        {/* ════ LEFT COLUMN ════ */}
        <div>
          {/* ── Provider ── */}
          <div className="card">
            <div className="card-title">Dostawca AI</div>

            <div className="form-group">
              <label>Typ providera</label>
              <select
                className="form-control"
                value={form.provider_type}
                onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
              >
                {PROVIDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Model</label>
              <input
                className="form-control"
                value={form.model_name}
                onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                placeholder={form.provider_type === "anthropic" ? "claude-sonnet-4-5-20250929" : "gpt-4o"}
              />
            </div>

            <div className="form-group">
              <label>API Endpoint</label>
              <input
                className="form-control"
                value={form.api_endpoint}
                onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })}
                placeholder={form.provider_type === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com"}
              />
            </div>

            <div className="form-group">
              <label>
                API Key
                {config.api_key_masked && (
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                    {" "}(aktualny: {config.api_key_masked})
                  </span>
                )}
              </label>
              <input
                className="form-control"
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="Zostaw puste aby nie zmieniać"
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>
                {saving ? "Zapisywanie..." : "Zapisz"}
              </button>
              <button
                className="btn"
                onClick={testConnection}
                disabled={testing || form.provider_type === "none"}
                style={testing ? { opacity: 0.7 } : undefined}
              >
                {testing ? "Testowanie..." : "Testuj połączenie"}
              </button>
              {config.id > 0 && (
                <button
                  className={config.is_active ? "btn btn-danger" : "btn"}
                  onClick={() => toggleActive(!config.is_active)}
                  style={!config.is_active ? { color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" } : undefined}
                >
                  {config.is_active ? "Dezaktywuj" : "Aktywuj AI"}
                </button>
              )}
            </div>

            {/* Test result */}
            {testResult && (
              <div style={{
                marginTop: 12, padding: "8px 12px", borderRadius: 6, fontSize: 13,
                background: testResult.success ? "var(--green-dim)" : "var(--red-dim)",
                color: testResult.success ? "var(--green)" : "var(--red)",
              }}>
                {testResult.success ? "OK" : "Błąd"}: {testResult.message}
                {testResult.response_time_ms != null && (
                  <span style={{ opacity: 0.7 }}> ({testResult.response_time_ms}ms)</span>
                )}
              </div>
            )}

            {config.last_test_at && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                Ostatni test: {new Date(config.last_test_at).toLocaleString("pl-PL")}
                {config.last_test_ok ? " — OK" : ` — ${config.last_test_error}`}
              </div>
            )}
          </div>

          {/* ── Parameters & Limits ── */}
          <div className="card">
            <div className="card-title">Parametry modelu</div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label>Max tokens</label>
                <input
                  className="form-control"
                  type="number"
                  value={form.max_tokens}
                  onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) || 4000 })}
                />
              </div>
              <div className="form-group">
                <label>Temperature</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0.3 })}
                />
              </div>
            </div>

            <div className="card-title" style={{ marginTop: 8 }}>Limity zapytań</div>

            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label>Użytkownik / h</label>
                <input
                  className="form-control"
                  type="number"
                  value={form.max_requests_per_user_per_hour}
                  onChange={(e) => setForm({ ...form, max_requests_per_user_per_hour: parseInt(e.target.value) || 20 })}
                />
              </div>
              <div className="form-group">
                <label>Użytkownik / dzień</label>
                <input
                  className="form-control"
                  type="number"
                  value={form.max_requests_per_user_per_day}
                  onChange={(e) => setForm({ ...form, max_requests_per_user_per_day: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div className="form-group">
                <label>Organizacja / dzień</label>
                <input
                  className="form-control"
                  type="number"
                  value={form.max_requests_per_org_per_day}
                  onChange={(e) => setForm({ ...form, max_requests_per_org_per_day: parseInt(e.target.value) || 500 })}
                />
              </div>
            </div>

            <button className="btn btn-primary btn-sm" onClick={saveConfig} disabled={saving}>
              {saving ? "Zapisywanie..." : "Zapisz parametry"}
            </button>
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div>
          {/* ── Features ── */}
          <div className="card">
            <div className="card-title">Funkcje AI</div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>
              Włącz/wyłącz poszczególne możliwości AI. Wyłączone nie będą widoczne w UI.
            </p>

            {/* Smart Catalog group */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
              Smart Catalog
            </div>
            {FEATURE_TOGGLES.filter((ft) => ft.group === "catalog").map((ft) => (
              <FeatureToggle key={ft.key} ft={ft} form={form} setForm={setForm} />
            ))}

            {/* Framework / Document group */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8, marginTop: 16 }}>
              Frameworki / Dokumenty
            </div>
            {FEATURE_TOGGLES.filter((ft) => ft.group === "framework").map((ft) => (
              <FeatureToggle key={ft.key} ft={ft} form={form} setForm={setForm} />
            ))}

            {/* Raporty group */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8, marginTop: 16 }}>
              Raporty
            </div>
            {FEATURE_TOGGLES.filter((ft) => ft.group === "reports").map((ft) => (
              <FeatureToggle key={ft.key} ft={ft} form={form} setForm={setForm} />
            ))}

            <button className="btn btn-primary btn-sm" onClick={saveConfig} disabled={saving} style={{ marginTop: 4 }}>
              {saving ? "Zapisywanie..." : "Zapisz funkcje"}
            </button>
          </div>

          {/* ── Connection info ── */}
          <div className="card">
            <div className="card-title">Informacje o połączeniu</div>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                <InfoRow label="Provider" value={providerLabel} />
                <InfoRow label="Model" value={config.model_name ?? "—"} />
                <InfoRow label="Endpoint" value={config.api_endpoint ?? "—"} />
                <InfoRow label="API Key" value={config.api_key_masked ?? "nie ustawiony"} />
                <InfoRow label="Status" value={
                  config.is_active
                    ? <span className="score-badge badge-green">Aktywne</span>
                    : <span className="score-badge badge-red">Nieaktywne</span>
                } />
                <InfoRow label="Ostatni test" value={
                  config.last_test_at
                    ? <>{new Date(config.last_test_at).toLocaleString("pl-PL")} {config.last_test_ok
                        ? <span className="score-badge badge-green" style={{ marginLeft: 6 }}>OK</span>
                        : <span className="score-badge badge-red" style={{ marginLeft: 6 }}>Błąd</span>
                      }</>
                    : "—"
                } />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Usage Stats ── */}
      <div className="card" style={{ marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="card-title" style={{ margin: 0 }}>Statystyki użycia</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                className={`btn btn-sm ${d === days ? "btn-primary" : ""}`}
                onClick={() => setDays(d)}
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {(!usage || usage.requests_count === 0) ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
            Brak danych o użyciu AI w wybranym okresie.
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
              <StatBox label="Zapytań" value={String(usage.requests_count)} color="var(--blue)" />
              <StatBox label="Tokeny IN" value={(usage.tokens_input ?? 0).toLocaleString("pl-PL")} color="var(--cyan, #06b6d4)" />
              <StatBox label="Tokeny OUT" value={(usage.tokens_output ?? 0).toLocaleString("pl-PL")} color="var(--purple)" />
              <StatBox label="Koszt" value={`$${usage.cost_usd.toFixed(4)}`} color="var(--orange)" />
              <StatBox label="Akceptacja" value={usage.acceptance_rate != null ? `${usage.acceptance_rate.toFixed(0)}%` : "—"} color="var(--green)" />
            </div>

            {/* Tracking coverage note */}
            {usage.requests_with_tracking < usage.requests_count && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, padding: "6px 10px", background: "var(--bg-subtle)", borderRadius: 4 }}>
                Śledzenie tokenów/kosztów dostępne dla {usage.requests_with_tracking} z {usage.requests_count} zapytań.
                {usage.requests_with_tracking === 0 && " Koszty pojawią się po pierwszym udanym zapytaniu AI z nowym kodem."}
              </div>
            )}

            {/* Usage by action — bar chart */}
            {totalActions > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10 }}>
                  Rozkład wg typu
                </div>
                {Object.entries(usage.by_action)
                  .sort(([, a], [, b]) => b - a)
                  .map(([action, count]) => {
                    const pct = totalActions > 0 ? (count / totalActions * 100) : 0;
                    return (
                      <div key={action} className="bar-row">
                        <div className="bar-label">{ACTION_LABELS[action] ?? action}</div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            data-value={count}
                            style={{ width: `${Math.max(pct, 3)}%`, background: "var(--blue)" }}
                          />
                        </div>
                        <div className="bar-score">{count}</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helper components ── */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", color: "var(--text-muted)", fontSize: 12, width: 110, verticalAlign: "top" }}>{label}</td>
      <td style={{ padding: "6px 0", fontWeight: 500, wordBreak: "break-all" }}>{value}</td>
    </tr>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FeatureToggle({ ft, form, setForm }: { ft: { key: string; label: string; desc: string; promptKeys?: string[] }; form: any; setForm: any }) {
  const checked = !!form[ft.key];
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [defaultText, setDefaultText] = useState("");
  const [promptMeta, setPromptMeta] = useState<{ display_name: string; is_customized: boolean } | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const loadPrompt = async (promptKey: string) => {
    if (expandedPrompt === promptKey) {
      setExpandedPrompt(null);
      return;
    }
    try {
      const res = await fetch(`${API}/api/v1/admin/ai-prompts/${promptKey}`);
      if (!res.ok) throw new Error("Nie znaleziono promptu");
      const data = await res.json();
      setEditText(data.prompt_text);
      setDefaultText(data.default_text || "");
      setPromptMeta({ display_name: data.display_name, is_customized: data.is_customized });
      setExpandedPrompt(promptKey);
    } catch {
      alert("Nie udało się załadować promptu");
    }
  };

  const savePrompt = async () => {
    if (!expandedPrompt) return;
    setSavingPrompt(true);
    try {
      await fetch(`${API}/api/v1/admin/ai-prompts/${expandedPrompt}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_text: editText }),
      });
      setPromptMeta(prev => prev ? { ...prev, is_customized: true } : prev);
      alert("Prompt zapisany!");
    } catch {
      alert("Błąd zapisu promptu");
    } finally {
      setSavingPrompt(false);
    }
  };

  const resetPrompt = async (promptKey: string) => {
    if (!confirm("Przywrócić domyślny prompt? Twoje zmiany zostaną utracone.")) return;
    try {
      await fetch(`${API}/api/v1/admin/ai-prompts/${promptKey}/reset`, { method: "POST" });
      // Reload the prompt
      const res = await fetch(`${API}/api/v1/admin/ai-prompts/${promptKey}`);
      if (res.ok) {
        const data = await res.json();
        setEditText(data.prompt_text);
        setPromptMeta({ display_name: data.display_name, is_customized: false });
      }
    } catch {
      alert("Błąd resetowania promptu");
    }
  };

  return (
    <div style={{
      marginBottom: 10, borderRadius: 6,
      background: checked ? "var(--blue-dim)" : "var(--bg-subtle)",
      border: "1px solid",
      borderColor: checked ? "rgba(59,130,246,0.2)" : "transparent",
      transition: "all 0.15s",
    }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "8px 10px" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setForm({ ...form, [ft.key]: e.target.checked })}
          style={{ width: 16, height: 16, marginTop: 1, accentColor: "var(--blue)", flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{ft.label}</div>
            {ft.promptKeys && ft.promptKeys.length > 0 && (
              <div style={{ display: "flex", gap: 4 }}>
                {ft.promptKeys.map(pk => (
                  <button
                    key={pk}
                    className="btn btn-sm"
                    style={{ fontSize: 10, padding: "2px 8px", lineHeight: 1.4 }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); loadPrompt(pk); }}
                  >
                    {expandedPrompt === pk ? "Zwiń prompt" : ft.promptKeys!.length > 1 ? `Prompt: ${pk.replace("document_import_continuation", "kontynuacja").replace("document_import", "główny")}` : "Edytuj prompt"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ft.desc}</div>
        </div>
      </label>

      {/* Inline prompt editor */}
      {expandedPrompt && (
        <div style={{ padding: "0 10px 10px 36px" }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
            padding: 10, marginTop: 4,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                Prompt systemowy: {promptMeta?.display_name ?? expandedPrompt}
              </div>
              {promptMeta?.is_customized && (
                <span className="score-badge badge-blue" style={{ fontSize: 9 }}>Zmodyfikowany</span>
              )}
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              style={{
                width: "100%", minHeight: 180, fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11, padding: 8, borderRadius: 4, border: "1px solid var(--border)",
                background: "var(--bg-subtle)", color: "var(--text)", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-sm" style={{ fontSize: 10 }}
                  onClick={() => setEditText(defaultText)}>
                  Wstaw domyślny
                </button>
                <button className="btn btn-sm" style={{ fontSize: 10, color: "var(--orange)" }}
                  onClick={() => resetPrompt(expandedPrompt)}>
                  Reset do domyślnego
                </button>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setExpandedPrompt(null)}>Anuluj</button>
                <button className="btn btn-sm btn-primary" style={{ fontSize: 10 }} onClick={savePrompt} disabled={savingPrompt}>
                  {savingPrompt ? "Zapisuję..." : "Zapisz prompt"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      background: "var(--bg-subtle)", textAlign: "center",
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* AIPromptsSection removed — prompt editing is now inline in each FeatureToggle */
