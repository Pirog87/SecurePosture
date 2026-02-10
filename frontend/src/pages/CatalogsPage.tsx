import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Threat, Vulnerability, Safeguard } from "../types";

type TabKey = "threats" | "vulns" | "controls";

const tabs: { key: TabKey; label: string; icon: string; badge: string }[] = [
  { key: "threats", label: "Zagrożenia", icon: "🔴", badge: "badge-red" },
  { key: "vulns", label: "Podatności", icon: "🟡", badge: "badge-yellow" },
  { key: "controls", label: "Zabezpieczenia", icon: "🟢", badge: "badge-green" },
];

const headers: Record<TabKey, string[]> = {
  threats: ["ID", "Nazwa zagrożenia", "Kategoria", "Status", "Akcje"],
  vulns: ["ID", "Nazwa podatności", "Obszar", "Status", "Akcje"],
  controls: ["ID", "Nazwa zabezpieczenia", "Typ", "Status", "Akcje"],
};

export default function CatalogsPage() {
  const [active, setActive] = useState<TabKey>("threats");
  const [threats, setThreats] = useState<Threat[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [safeguards, setSafeguards] = useState<Safeguard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Threat[]>("/api/v1/threats").catch(() => []),
      api.get<Vulnerability[]>("/api/v1/vulnerabilities").catch(() => []),
      api.get<Safeguard[]>("/api/v1/safeguards").catch(() => []),
    ]).then(([t, v, s]) => {
      setThreats(t); setVulns(v); setSafeguards(s);
    }).finally(() => setLoading(false));
  }, []);

  const items: { id: number; name: string; cat: string; active: boolean }[] =
    active === "threats" ? threats.map(t => ({ id: t.id, name: t.name, cat: t.category_name ?? "—", active: t.is_active })) :
    active === "vulns" ? vulns.map(v => ({ id: v.id, name: v.name, cat: v.security_area_name ?? "—", active: v.is_active })) :
    safeguards.map(s => ({ id: s.id, name: s.name, cat: s.type_name ?? "—", active: s.is_active }));

  const counts: Record<TabKey, number> = { threats: threats.length, vulns: vulns.length, controls: safeguards.length };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`btn btn-sm${active === tab.key ? "" : ""}`}
            style={active === tab.key ? { background: "var(--bg-card-hover)", borderColor: "var(--border-light)" } : undefined}
            onClick={() => setActive(tab.key)}
          >
            {tab.icon} {tab.label}
            <span className={tab.badge} style={{ marginLeft: 4, fontSize: 10, padding: "2px 7px", borderRadius: 10, fontFamily: "'JetBrains Mono',monospace" }}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Brak danych lub brak połączenia z API.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>{headers[active].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{i.id}</td>
                  <td style={{ fontWeight: 500 }}>{i.name}</td>
                  <td>{i.cat}</td>
                  <td>
                    <span className="score-badge" style={{
                      background: i.active ? "var(--green-dim)" : "var(--red-dim)",
                      color: i.active ? "var(--green)" : "var(--red)",
                    }}>
                      {i.active ? "Aktywny" : "Archiwalny"}
                    </span>
                  </td>
                  <td><button className="btn btn-sm">✏️ Edytuj</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
