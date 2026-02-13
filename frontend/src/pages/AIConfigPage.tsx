import { useEffect, useState, useCallback } from "react";
import StatsCards, { type StatCard } from "../components/StatsCards";

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
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
}

interface UsageStats {
  requests_count: number;
  tokens_used: number;
  cost_usd: number;
  acceptance_rate: number | null;
  by_action: Record<string, number>;
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
  last_test_at: null,
  last_test_ok: null,
  last_test_error: null,
};

const PROVIDER_OPTIONS = [
  { value: "none", label: "Brak (wylaczone)" },
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "openai_compatible", label: "OpenAI-compatible (OpenAI, vLLM, Ollama)" },
];

const FEATURE_LABELS: Record<string, string> = {
  feature_scenario_generation: "Generowanie scenariuszy ryzyka",
  feature_correlation_enrichment: "Wzbogacanie korelacji",
  feature_natural_language_search: "Wyszukiwanie w jezyku naturalnym",
  feature_gap_analysis: "Analiza luk bezpieczenstwa",
  feature_entry_assist: "Asystent tworzenia wpisow",
};

/* ══════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════ */

export default function AIConfigPage() {
  const [config, setConfig] = useState<AIConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const res = await fetch(`${API}/api/v1/ai/usage-stats?days=30`);
      if (res.ok) {
        setUsage(await res.json());
      }
    } catch {
      // Not critical
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchUsage();
  }, [fetchConfig, fetchUsage]);

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.api_key) delete payload.api_key; // Don't overwrite if empty

      const res = await fetch(`${API}/api/v1/admin/ai-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSuccess("Konfiguracja zapisana");
        fetchConfig();
      } else {
        const body = await res.text();
        setError(`Blad zapisu: ${body}`);
      }
    } catch (e) {
      setError(`Blad: ${e}`);
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
      fetchConfig(); // Refresh last_test_* fields
    } catch (e) {
      setTestResult({ success: false, message: `Blad polaczenia: ${e}` });
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
      }
    } catch (e) {
      setError(`Blad: ${e}`);
    }
  };

  if (loading) return <div className="p-6">Ladowanie konfiguracji AI...</div>;

  const stats: StatCard[] = [
    {
      label: "Status AI",
      value: config.is_active ? "Aktywne" : "Nieaktywne",
      color: config.is_active ? "var(--color-success)" : "var(--color-muted)",
    },
    {
      label: "Provider",
      value: PROVIDER_OPTIONS.find((p) => p.value === config.provider_type)?.label ?? config.provider_type,
    },
    {
      label: "Zapytan (30d)",
      value: usage?.requests_count ?? 0,
    },
    {
      label: "Koszt (30d)",
      value: `$${(usage?.cost_usd ?? 0).toFixed(4)}`,
    },
  ];

  return (
    <div className="p-4" style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>
        Integracja AI — Konfiguracja
      </h1>
      <p style={{ color: "var(--color-muted)", marginBottom: 24, fontSize: "0.9rem" }}>
        AI jest opcjonalnym pluginem. System dziala w pelni bez AI.
        Elementy AI w interfejsie pojawiaja sie dopiero po aktywacji.
      </p>

      <StatsCards cards={stats} />

      {/* ── Alert messages ── */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid var(--color-danger)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "var(--color-danger)" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid var(--color-success)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "var(--color-success)" }}>
          {success}
        </div>
      )}

      {/* ── Provider section ── */}
      <section style={{ background: "var(--color-surface)", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}>Dostawca AI</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Typ providera</span>
            <select
              value={form.provider_type}
              onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
              className="input"
            >
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Model</span>
            <input
              className="input"
              value={form.model_name}
              onChange={(e) => setForm({ ...form, model_name: e.target.value })}
              placeholder={form.provider_type === "anthropic" ? "claude-sonnet-4-5-20250929" : "gpt-4o"}
            />
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>API Endpoint</span>
          <input
            className="input"
            value={form.api_endpoint}
            onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })}
            placeholder={form.provider_type === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com"}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
            API Key {config.api_key_masked && `(aktualny: ${config.api_key_masked})`}
          </span>
          <input
            className="input"
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder="Zostaw puste aby nie zmieniac"
          />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz konfiguracje"}
          </button>
          <button className="btn btn-secondary" onClick={testConnection} disabled={testing || form.provider_type === "none"}>
            {testing ? "Testowanie..." : "Testuj polaczenie"}
          </button>
          {config.id > 0 && (
            <button
              className={`btn ${config.is_active ? "btn-danger" : "btn-success"}`}
              onClick={() => toggleActive(!config.is_active)}
            >
              {config.is_active ? "Dezaktywuj AI" : "Aktywuj AI"}
            </button>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 6,
            background: testResult.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: testResult.success ? "var(--color-success)" : "var(--color-danger)",
            fontSize: "0.85rem",
          }}>
            {testResult.success ? "Polaczenie OK" : "Blad"}: {testResult.message}
          </div>
        )}

        {/* Last test info */}
        {config.last_test_at && (
          <div style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--color-muted)" }}>
            Ostatni test: {new Date(config.last_test_at).toLocaleString("pl-PL")}
            {config.last_test_ok ? " — OK" : ` — Blad: ${config.last_test_error}`}
          </div>
        )}
      </section>

      {/* ── Parameters section ── */}
      <section style={{ background: "var(--color-surface)", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}>Parametry</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Max tokens</span>
            <input
              className="input"
              type="number"
              value={form.max_tokens}
              onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) || 4000 })}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Temperature</span>
            <input
              className="input"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0.3 })}
            />
          </label>
        </div>
      </section>

      {/* ── Rate limits section ── */}
      <section style={{ background: "var(--color-surface)", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}>Limity</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Na uzytkownika / godzina</span>
            <input
              className="input"
              type="number"
              value={form.max_requests_per_user_per_hour}
              onChange={(e) => setForm({ ...form, max_requests_per_user_per_hour: parseInt(e.target.value) || 20 })}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Na uzytkownika / dzien</span>
            <input
              className="input"
              type="number"
              value={form.max_requests_per_user_per_day}
              onChange={(e) => setForm({ ...form, max_requests_per_user_per_day: parseInt(e.target.value) || 100 })}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>Na organizacje / dzien</span>
            <input
              className="input"
              type="number"
              value={form.max_requests_per_org_per_day}
              onChange={(e) => setForm({ ...form, max_requests_per_org_per_day: parseInt(e.target.value) || 500 })}
            />
          </label>
        </div>
      </section>

      {/* ── Features section ── */}
      <section style={{ background: "var(--color-surface)", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}>Funkcje AI</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginBottom: 16 }}>
          Wlacz/wylacz poszczegolne funkcje AI. Wylaczone funkcje nie beda widoczne w interfejsie.
        </p>

        {Object.entries(FEATURE_LABELS).map(([key, label]) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={(form as Record<string, unknown>)[key] as boolean}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: "0.9rem" }}>{label}</span>
          </label>
        ))}

        <button className="btn btn-primary" onClick={saveConfig} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? "Zapisywanie..." : "Zapisz zmiany"}
        </button>
      </section>

      {/* ── Usage stats section ── */}
      {usage && usage.requests_count > 0 && (
        <section style={{ background: "var(--color-surface)", borderRadius: 8, padding: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}>Statystyki uzycia (30 dni)</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Zapytan</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{usage.requests_count}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Tokenow</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{usage.tokens_used.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Koszt</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>${usage.cost_usd.toFixed(4)}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Akceptacja</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                {usage.acceptance_rate != null ? `${usage.acceptance_rate.toFixed(0)}%` : "—"}
              </div>
            </div>
          </div>

          {Object.keys(usage.by_action).length > 0 && (
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginBottom: 8 }}>Wg typu:</div>
              {Object.entries(usage.by_action).map(([action, count]) => (
                <div key={action} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "0.85rem" }}>
                  <span>{action}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
