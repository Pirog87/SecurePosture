import { useEffect, useState } from "react";
import { api } from "../services/api";

interface TestTemplate {
  id: number;
  ref_id: string | null;
  name: string;
  description: string | null;
  test_steps: string[];
  test_type: string;
  category: string | null;
  difficulty: string;
  estimated_hours: number | null;
  tags: string[];
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  technical: "#3b82f6",
  organizational: "#8b5cf6",
  legal: "#f59e0b",
  physical: "#22c55e",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  basic: "#22c55e",
  intermediate: "#f59e0b",
  advanced: "#ef4444",
};

export default function TestTemplatesPage() {
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    api.get<TestTemplate[]>("/api/v1/test-templates/")
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Katalog Testów Audytowych</h2>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          className="form-control"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj testów..."
          style={{ flex: 1 }}
        />
        <select className="form-control" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">Wszystkie kategorie</option>
          <option value="technical">Technical</option>
          <option value="organizational">Organizational</option>
          <option value="legal">Legal</option>
          <option value="physical">Physical</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          {templates.length === 0
            ? "Katalog testów jest pusty. Szablony testów zostaną dodane wraz z importem frameworków."
            : "Brak wyników dla podanych filtrów."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((t) => (
            <div key={t.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  {t.ref_id && <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", marginRight: 8 }}>{t.ref_id}</span>}
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {t.category && (
                    <span className="badge" style={{ backgroundColor: `${CATEGORY_COLORS[t.category] || "#6b7280"}20`, color: CATEGORY_COLORS[t.category] || "#6b7280" }}>
                      {t.category}
                    </span>
                  )}
                  <span className="badge" style={{ backgroundColor: `${DIFFICULTY_COLORS[t.difficulty]}20`, color: DIFFICULTY_COLORS[t.difficulty] }}>
                    {t.difficulty}
                  </span>
                  <span className="badge">{t.test_type}</span>
                </div>
              </div>
              {t.description && <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>{t.description}</p>}
              {t.test_steps.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <strong>Kroki:</strong>
                  <ol style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                    {t.test_steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              )}
              {t.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {t.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 10, padding: "2px 6px", backgroundColor: "var(--bg-subtle)", borderRadius: 4, color: "var(--text-muted)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
