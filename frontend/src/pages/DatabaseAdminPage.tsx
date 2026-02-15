import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "";

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  driver: string;
  connected: boolean;
}

interface TestResult {
  status: string;
  message: string;
  tables_found?: number;
  schema_initialized?: boolean;
}

interface InitResult {
  status: string;
  message: string;
  details?: string;
}

export default function DatabaseAdminPage() {
  const [current, setCurrent] = useState<DbConfig | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(3306);
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [driver, setDriver] = useState("mysql+asyncmy");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [initResult, setInitResult] = useState<InitResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/admin/db-config`).then(r => r.json())
      .then((cfg: DbConfig) => {
        setCurrent(cfg);
        setHost(cfg.host);
        setPort(cfg.port);
        setDatabase(cfg.database);
        setUser(cfg.user);
        setDriver(cfg.driver);
      })
      .catch(() => {});
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setInitResult(null);
    try {
      const res = await fetch(`${API}/api/v1/admin/db-config/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, database, user, password, driver }),
      });
      setTestResult(await res.json());
    } catch {
      setTestResult({ status: "error", message: "Nie można połączyć się z backendem" });
    } finally {
      setTesting(false);
    }
  };

  const handleInitSchema = async () => {
    if (!confirm("Czy na pewno chcesz zainicjalizować schemat bazy danych? Ta operacja utworzy wszystkie tabele i dane początkowe.")) return;
    setInitializing(true);
    setInitResult(null);
    try {
      const res = await fetch(`${API}/api/v1/admin/db-config/init-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, database, user, password, driver }),
      });
      setInitResult(await res.json());
    } catch {
      setInitResult({ status: "error", message: "Błąd połączenia z backendem" });
    } finally {
      setInitializing(false);
    }
  };

  const handleSave = async () => {
    if (!confirm("Zapisać nową konfigurację? Aplikacja będzie wymagała restartu.")) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API}/api/v1/admin/db-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, database, user, password, driver }),
      });
      const data = await res.json();
      setSaveMsg(data.message);
    } catch {
      setSaveMsg("Błąd zapisu konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const isNewDb = host !== current?.host || port !== current?.port || database !== current?.database;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Konfiguracja bazy danych</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Zarządzaj połączeniem z bazą danych. Możesz podłączyć się do nowej bazy i automatycznie utworzyć schemat.
      </p>

      {/* Current connection info */}
      {current && (
        <div style={{
          background: "var(--green-dim)", border: "1px solid var(--green)", borderRadius: 8,
          padding: "10px 14px", marginBottom: 20, fontSize: 12,
        }}>
          <strong>Aktywne połączenie:</strong> {current.user}@{current.host}:{current.port}/{current.database}
          <span style={{ marginLeft: 8, color: "var(--green)" }}>Połączono</span>
        </div>
      )}

      {/* Connection form */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Parametry połączenia</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label>Host (IP / hostname)</label>
            <input className="form-control" value={host} onChange={e => setHost(e.target.value)}
                   placeholder="192.168.1.100" />
          </div>
          <div className="form-group">
            <label>Port</label>
            <input className="form-control" type="number" value={port}
                   onChange={e => setPort(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Nazwa bazy danych</label>
            <input className="form-control" value={database} onChange={e => setDatabase(e.target.value)}
                   placeholder="secureposture" />
          </div>
          <div className="form-group">
            <label>Sterownik</label>
            <select className="form-control" value={driver} onChange={e => setDriver(e.target.value)}>
              <option value="mysql+asyncmy">MySQL (asyncmy)</option>
              <option value="mysql+aiomysql">MySQL (aiomysql)</option>
              <option value="postgresql+asyncpg">PostgreSQL (asyncpg)</option>
              <option value="sqlite+aiosqlite">SQLite (aiosqlite)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Użytkownik</label>
            <input className="form-control" value={user} onChange={e => setUser(e.target.value)}
                   placeholder="root" />
          </div>
          <div className="form-group">
            <label>Hasło</label>
            <input className="form-control" type="password" value={password}
                   onChange={e => setPassword(e.target.value)} placeholder="Hasło do bazy" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleTest} disabled={testing || !host || !database || !user}>
            {testing ? "Testowanie..." : "Testuj połączenie"}
          </button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className="card" style={{
          padding: "12px 16px", marginBottom: 16,
          background: testResult.status === "ok" ? "var(--green-dim)" : "var(--red-dim)",
          borderLeft: `3px solid ${testResult.status === "ok" ? "var(--green)" : "var(--red)"}`,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            {testResult.status === "ok" ? "Połączenie udane" : "Błąd połączenia"}
          </div>
          <div style={{ fontSize: 12 }}>{testResult.message}</div>
          {testResult.status === "ok" && (
            <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-muted)" }}>
              Tabel w bazie: <strong>{testResult.tables_found}</strong>
              {testResult.schema_initialized
                ? <span style={{ color: "var(--green)", marginLeft: 8 }}>Schemat istnieje</span>
                : <span style={{ color: "var(--orange)", marginLeft: 8 }}>Baza pusta — wymaga inicjalizacji</span>
              }
            </div>
          )}
        </div>
      )}

      {/* Schema initialization */}
      {testResult?.status === "ok" && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Inicjalizacja schematu</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            {testResult.schema_initialized
              ? "Baza zawiera tabele. Możesz ponownie uruchomić migracje aby zaktualizować schemat do najnowszej wersji."
              : "Baza jest pusta. Kliknij poniżej aby utworzyć wszystkie tabele, indeksy i dane początkowe."
            }
          </p>
          <button className="btn btn-primary" onClick={handleInitSchema} disabled={initializing}>
            {initializing ? "Inicjalizacja..." : (testResult.schema_initialized ? "Aktualizuj schemat" : "Utwórz schemat bazy")}
          </button>

          {initResult && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 6, fontSize: 12,
              background: initResult.status === "ok" ? "var(--green-dim)" : "var(--red-dim)",
              borderLeft: `3px solid ${initResult.status === "ok" ? "var(--green)" : "var(--red)"}`,
            }}>
              <strong>{initResult.status === "ok" ? "Sukces" : "Błąd"}:</strong> {initResult.message}
              {initResult.details && (
                <pre style={{ marginTop: 6, fontSize: 11, whiteSpace: "pre-wrap", opacity: 0.8, maxHeight: 120, overflow: "auto" }}>
                  {initResult.details}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save config */}
      {testResult?.status === "ok" && isNewDb && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Zapisz konfigurację</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Zapisanie nowej konfiguracji zaktualizuje plik .env. Po zapisie wymagany jest <strong>restart serwera</strong> aby
            aplikacja połączyła się z nową bazą.
          </p>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz i przełącz bazę"}
          </button>

          {saveMsg && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 6, fontSize: 12,
              background: "var(--blue-dim)", borderLeft: "3px solid var(--blue)",
            }}>
              {saveMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
