import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Threat, Vulnerability, Safeguard, SecurityArea, DictionaryTypeWithEntries } from "../types";
import Modal from "../components/Modal";

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

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<{ id: number; name: string; catId: number | null; desc: string | null } | null>(null);

  // lookups for selects
  const [threatCategories, setThreatCategories] = useState<{ id: number; label: string }[]>([]);
  const [securityAreas, setSecurityAreas] = useState<SecurityArea[]>([]);
  const [safeguardTypes, setSafeguardTypes] = useState<{ id: number; label: string }[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  const loadAll = () => {
    Promise.all([
      api.get<Threat[]>("/api/v1/threats").catch(() => []),
      api.get<Vulnerability[]>("/api/v1/vulnerabilities").catch(() => []),
      api.get<Safeguard[]>("/api/v1/safeguards").catch(() => []),
    ]).then(([t, v, s]) => {
      setThreats(t); setVulns(v); setSafeguards(s);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const loadLookups = async () => {
    if (lookupsLoaded) return;
    const [areas, cats, types] = await Promise.all([
      api.get<SecurityArea[]>("/api/v1/security-areas").catch(() => [] as SecurityArea[]),
      api.get<DictionaryTypeWithEntries>("/api/v1/dictionaries/threat_category/entries").then(d => d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label }))).catch(() => []),
      api.get<DictionaryTypeWithEntries>("/api/v1/dictionaries/safeguard_type/entries").then(d => d.entries.filter(e => e.is_active).map(e => ({ id: e.id, label: e.label }))).catch(() => []),
    ]);
    setSecurityAreas(areas);
    setThreatCategories(cats);
    setSafeguardTypes(types);
    setLookupsLoaded(true);
  };

  const openAdd = async () => {
    await loadLookups();
    setEditItem(null);
    setShowForm(true);
  };

  const openEdit = async (item: { id: number; name: string; catId: number | null; desc: string | null }) => {
    await loadLookups();
    setEditItem(item);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      if (active === "threats") {
        const body = {
          name: fd.get("name") as string,
          category_id: fd.get("category_id") ? Number(fd.get("category_id")) : null,
          description: (fd.get("description") as string) || null,
        };
        if (editItem) {
          await api.put(`/api/v1/threats/${editItem.id}`, body);
        } else {
          await api.post("/api/v1/threats", body);
        }
      } else if (active === "vulns") {
        const body = {
          name: fd.get("name") as string,
          security_area_id: fd.get("security_area_id") ? Number(fd.get("security_area_id")) : null,
          description: (fd.get("description") as string) || null,
        };
        if (editItem) {
          await api.put(`/api/v1/vulnerabilities/${editItem.id}`, body);
        } else {
          await api.post("/api/v1/vulnerabilities", body);
        }
      } else {
        const body = {
          name: fd.get("name") as string,
          type_id: fd.get("type_id") ? Number(fd.get("type_id")) : null,
          description: (fd.get("description") as string) || null,
        };
        if (editItem) {
          await api.put(`/api/v1/safeguards/${editItem.id}`, body);
        } else {
          await api.post("/api/v1/safeguards", body);
        }
      }
      setShowForm(false);
      setLoading(true);
      loadAll();
    } catch (err) {
      alert("Błąd zapisu: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (tab: TabKey, id: number, name: string) => {
    if (!confirm(`Archiwizować "${name}"?`)) return;
    try {
      if (tab === "threats") await api.delete(`/api/v1/threats/${id}`);
      else if (tab === "vulns") await api.delete(`/api/v1/vulnerabilities/${id}`);
      else await api.delete(`/api/v1/safeguards/${id}`);
      setLoading(true);
      loadAll();
    } catch (err) {
      alert("Błąd: " + err);
    }
  };

  const items: { id: number; name: string; cat: string; catId: number | null; desc: string | null; active: boolean }[] =
    active === "threats" ? threats.map(t => ({ id: t.id, name: t.name, cat: t.category_name ?? "—", catId: t.category_id, desc: t.description, active: t.is_active })) :
    active === "vulns" ? vulns.map(v => ({ id: v.id, name: v.name, cat: v.security_area_name ?? "—", catId: v.security_area_id, desc: v.description, active: v.is_active })) :
    safeguards.map(s => ({ id: s.id, name: s.name, cat: s.type_name ?? "—", catId: s.type_id, desc: s.description, active: s.is_active }));

  const counts: Record<TabKey, number> = { threats: threats.length, vulns: vulns.length, controls: safeguards.length };

  const formTitle = editItem
    ? `Edytuj: ${editItem.name}`
    : active === "threats" ? "Dodaj zagrożenie" : active === "vulns" ? "Dodaj podatność" : "Dodaj zabezpieczenie";

  const catLabel = active === "threats" ? "Kategoria" : active === "vulns" ? "Obszar bezpieczeństwa" : "Typ zabezpieczenia";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className="btn btn-sm"
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
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Dodaj</button>
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
                  <td style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => openEdit({ id: i.id, name: i.name, catId: i.catId, desc: i.desc })}>✏️ Edytuj</button>
                    {i.active && <button className="btn btn-sm" onClick={() => handleArchive(active, i.id, i.name)}>🗑️</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={formTitle}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nazwa *</label>
            <input name="name" className="form-control" required defaultValue={editItem?.name ?? ""} key={editItem?.id ?? "new"} />
          </div>
          <div className="form-group">
            <label>{catLabel}</label>
            {active === "threats" ? (
              <select name="category_id" className="form-control" defaultValue={editItem?.catId ?? ""} key={(editItem?.id ?? "new") + "-cat"}>
                <option value="">Wybierz...</option>
                {threatCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            ) : active === "vulns" ? (
              <select name="security_area_id" className="form-control" defaultValue={editItem?.catId ?? ""} key={(editItem?.id ?? "new") + "-cat"}>
                <option value="">Wybierz...</option>
                {securityAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <select name="type_id" className="form-control" defaultValue={editItem?.catId ?? ""} key={(editItem?.id ?? "new") + "-cat"}>
                <option value="">Wybierz...</option>
                {safeguardTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            )}
          </div>
          <div className="form-group">
            <label>Opis</label>
            <textarea name="description" className="form-control" placeholder="Opcjonalny opis..." defaultValue={editItem?.desc ?? ""} key={(editItem?.id ?? "new") + "-desc"} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Zapisywanie..." : editItem ? "Zapisz zmiany" : "Dodaj"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
