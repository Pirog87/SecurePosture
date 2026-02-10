import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Risk, OrgUnitTreeNode, SecurityArea, Threat, Vulnerability, Safeguard, DictionaryTypeWithEntries } from "../types";
import Modal from "../components/Modal";

function riskColor(R: number) { return R >= 221 ? "var(--red)" : R >= 31 ? "var(--orange)" : "var(--green)"; }
function riskBg(R: number) { return R >= 221 ? "var(--red-dim)" : R >= 31 ? "var(--orange-dim)" : "var(--green-dim)"; }
function riskLabel(R: number) { return R >= 221 ? "Wysokie" : R >= 31 ? "Średnie" : "Niskie"; }

interface FormLookups {
  orgUnits: OrgUnitTreeNode[];
  areas: SecurityArea[];
  threats: Threat[];
  vulns: Vulnerability[];
  safeguards: Safeguard[];
  categories: { id: number; label: string }[];
  sensitivities: { id: number; label: string }[];
  criticalities: { id: number; label: string }[];
  statuses: { id: number; label: string }[];
  strategies: { id: number; label: string }[];
}

function flattenTree(nodes: OrgUnitTreeNode[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<FormLookups | null>(null);

  const loadRisks = () => {
    api.get<Risk[]>("/api/v1/risks").then(setRisks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadRisks(); }, []);

  const openForm = async () => {
    if (!lookups) {
      const [orgUnits, areas, threats, vulns, safeguards] = await Promise.all([
        api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree").catch(() => [] as OrgUnitTreeNode[]),
        api.get<SecurityArea[]>("/api/v1/security-areas").catch(() => [] as SecurityArea[]),
        api.get<Threat[]>("/api/v1/threats").catch(() => [] as Threat[]),
        api.get<Vulnerability[]>("/api/v1/vulnerabilities").catch(() => [] as Vulnerability[]),
        api.get<Safeguard[]>("/api/v1/safeguards").catch(() => [] as Safeguard[]),
      ]);
      const dictEntries = async (code: string) => {
        try {
          const d = await api.get<DictionaryTypeWithEntries>(`/api/v1/dictionaries/${code}/entries`);
          return d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label }));
        } catch { return []; }
      };
      const [categories, sensitivities, criticalities, statuses, strategies] = await Promise.all([
        dictEntries("asset_category"), dictEntries("sensitivity"), dictEntries("criticality"),
        dictEntries("risk_status"), dictEntries("risk_strategy"),
      ]);
      setLookups({ orgUnits, areas, threats, vulns, safeguards, categories, sensitivities, criticalities, statuses, strategies });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      org_unit_id: Number(fd.get("org_unit_id")),
      asset_name: fd.get("asset_name") as string,
      asset_category_id: fd.get("asset_category_id") ? Number(fd.get("asset_category_id")) : null,
      sensitivity_id: fd.get("sensitivity_id") ? Number(fd.get("sensitivity_id")) : null,
      criticality_id: fd.get("criticality_id") ? Number(fd.get("criticality_id")) : null,
      security_area_id: fd.get("security_area_id") ? Number(fd.get("security_area_id")) : null,
      threat_id: fd.get("threat_id") ? Number(fd.get("threat_id")) : null,
      vulnerability_id: fd.get("vulnerability_id") ? Number(fd.get("vulnerability_id")) : null,
      impact_level: Number(fd.get("impact_level")),
      probability_level: Number(fd.get("probability_level")),
      safeguard_rating: Number(fd.get("safeguard_rating")),
      status_id: fd.get("status_id") ? Number(fd.get("status_id")) : null,
      strategy_id: fd.get("strategy_id") ? Number(fd.get("strategy_id")) : null,
      owner: (fd.get("owner") as string) || null,
      planned_actions: (fd.get("planned_actions") as string) || null,
      safeguard_ids: [],
    };
    try {
      await api.post("/api/v1/risks", body);
      setShowForm(false);
      setLoading(true);
      loadRisks();
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const flatUnits = lookups ? flattenTree(lookups.orgUnits) : [];

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-control" style={{ width: 160 }}><option>Wszystkie piony</option></select>
          <select className="form-control" style={{ width: 160 }}>
            <option>Wszystkie statusy</option>
            <option>Zidentyfikowane</option><option>W analizie</option>
            <option>W mitygacji</option><option>Zaakceptowane</option><option>Zamknięte</option>
          </select>
          <select className="form-control" style={{ width: 140 }}>
            <option>Poziom ryzyka</option><option>Wysokie</option><option>Średnie</option><option>Niskie</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={openForm}>+ Dodaj ryzyko</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Ładowanie ryzyk...</div>
        ) : risks.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Brak ryzyk w systemie lub nie udało się połączyć z API.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>ID</th><th>Aktywo</th><th>Pion</th><th>Obszar</th><th>W</th><th>P</th><th>Z</th><th>Ocena (R)</th><th>Status</th><th>Właściciel</th></tr></thead>
            <tbody>
              {[...risks].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).map((r) => (
                <tr key={r.id} style={{ borderLeft: `3px solid ${riskColor(r.risk_score ?? 0)}` }}>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{r.id}</td>
                  <td style={{ fontWeight: 500 }}>{r.asset_name}</td>
                  <td>{r.org_unit_name}</td>
                  <td>{r.security_area_name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.impact_level}</td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.probability_level}</td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{r.safeguard_rating}</td>
                  <td>
                    <span className="score-badge" style={{ background: riskBg(r.risk_score ?? 0), color: riskColor(r.risk_score ?? 0) }}>
                      {(r.risk_score ?? 0).toFixed(1)} {riskLabel(r.risk_score ?? 0)}
                    </span>
                  </td>
                  <td><span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{r.status_name ?? "—"}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.owner ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Dodaj ryzyko" wide>
        {lookups ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group">
                <label>Jednostka organizacyjna</label>
                <select name="org_unit_id" className="form-control" required>
                  <option value="">Wybierz...</option>
                  {flatUnits.map(u => <option key={u.id} value={u.id}>{"  ".repeat(u.depth)}{u.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Kategoria aktywa</label>
                <select name="asset_category_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>Nazwa aktywa</label>
                <input name="asset_name" className="form-control" required placeholder="np. Laptopy konsultantów" />
              </div>
              <div className="form-group">
                <label>Wrażliwość</label>
                <select name="sensitivity_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.sensitivities.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Krytyczność</label>
                <select name="criticality_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.criticalities.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Obszar raportowania</label>
                <select name="security_area_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Zagrożenie</label>
                <select name="threat_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.threats.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Podatność</label>
                <select name="vulnerability_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.vulns.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Poziom wpływu (W)</label>
                <select name="impact_level" className="form-control" required defaultValue="2">
                  <option value="1">1 — Niski</option>
                  <option value="2">2 — Średni</option>
                  <option value="3">3 — Wysoki</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prawdopodobieństwo (P)</label>
                <select name="probability_level" className="form-control" required defaultValue="2">
                  <option value="1">1 — Niskie</option>
                  <option value="2">2 — Średnie</option>
                  <option value="3">3 — Wysokie</option>
                </select>
              </div>
              <div className="form-group">
                <label>Ocena zabezpieczeń (Z)</label>
                <select name="safeguard_rating" className="form-control" required defaultValue="0.25">
                  <option value="0.10">0,10 — Brak zabezpieczeń</option>
                  <option value="0.25">0,25 — Częściowe</option>
                  <option value="0.70">0,70 — Dobra jakość</option>
                  <option value="0.95">0,95 — Skuteczne, testowane</option>
                </select>
              </div>
              <div className="form-group">
                <label>Strategia postępowania</label>
                <select name="strategy_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.strategies.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Właściciel ryzyka</label>
                <input name="owner" className="form-control" placeholder="np. Jan Kowalski" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select name="status_id" className="form-control">
                  <option value="">Wybierz...</option>
                  {lookups.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Planowane działania</label>
              <textarea name="planned_actions" className="form-control" placeholder="Opisz planowane kroki mitygacyjne..." />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Zapisywanie..." : "Zapisz ryzyko"}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ładowanie danych formularza...</div>
        )}
      </Modal>
    </div>
  );
}
