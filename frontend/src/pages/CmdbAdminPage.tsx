import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "../services/api";
import type { AssetCategoryTreeNode, CategoryFieldDefinition, RelationshipType } from "../types";
import AssetCategoryTree from "../components/AssetCategoryTree";
import Modal from "../components/Modal";

/* ── Icon options for category picker ── */
const ICON_OPTIONS = [
  "HardDrive", "Server", "Monitor", "Laptop", "Smartphone", "Printer",
  "Database", "Network", "Globe", "Router", "Shield", "Code", "Layers",
  "AppWindow", "Cloud", "Settings", "Users", "User", "UsersGroup",
  "Briefcase", "FileText", "File", "Table", "Key", "Building", "MapPin",
  "Door", "Workflow", "GitBranch", "Headphones",
];

const FIELD_TYPES = [
  { value: "text", label: "Tekst" },
  { value: "number", label: "Liczba" },
  { value: "date", label: "Data" },
  { value: "boolean", label: "Tak/Nie" },
  { value: "select", label: "Lista wyboru" },
  { value: "multiselect", label: "Wielokrotny wybor" },
  { value: "reference", label: "Referencja do aktywa" },
  { value: "textarea", label: "Tekst wieloliniowy" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
];

const COLOR_PRESETS = [
  "#3B82F6", "#2563EB", "#1D4ED8", "#60A5FA",
  "#8B5CF6", "#7C3AED", "#A78BFA",
  "#10B981", "#059669", "#34D399", "#6EE7B7",
  "#F59E0B", "#D97706", "#FBBF24",
  "#EF4444", "#DC2626", "#F87171",
  "#06B6D4", "#0891B2", "#22D3EE",
  "#EC4899", "#DB2777", "#F97316",
  "#6366F1", "#14B8A6",
];

/* ═══════════════════════════════════════════════
   CmdbAdminPage — Category management + Form builder
   ═══════════════════════════════════════════════ */
export default function CmdbAdminPage() {
  // ── Category tree ──
  const [categoryTree, setCategoryTree] = useState<AssetCategoryTreeNode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategoryTreeNode | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(true);

  // ── Fields for selected category ──
  const [fields, setFields] = useState<CategoryFieldDefinition[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  // ── Relationship types ──
  const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);

  // ── Category form modal ──
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat, setEditCat] = useState<AssetCategoryTreeNode | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  // ── Field form modal ──
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editField, setEditField] = useState<CategoryFieldDefinition | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);

  // ── Active admin tab ──
  const [adminTab, setAdminTab] = useState<"fields" | "reltypes">("fields");

  // ── Flat categories for parent picker ──
  const flatCategories = useMemo(() => {
    const flat: AssetCategoryTreeNode[] = [];
    const walk = (nodes: AssetCategoryTreeNode[]) => {
      for (const n of nodes) { flat.push(n); walk(n.children); }
    };
    walk(categoryTree);
    return flat;
  }, [categoryTree]);

  // ═══════════════════ LOAD ═══════════════════

  const loadTree = useCallback(() => {
    setCategoryLoading(true);
    api.get<AssetCategoryTreeNode[]>("/api/v1/asset-categories/tree?include_inactive=true")
      .then(setCategoryTree)
      .catch(() => {})
      .finally(() => setCategoryLoading(false));
  }, []);

  useEffect(() => {
    loadTree();
    api.get<RelationshipType[]>("/api/v1/asset-categories/relationship-types/all").then(setRelTypes).catch(() => {});
  }, [loadTree]);

  // Load fields when category changes
  useEffect(() => {
    if (selectedCategory) {
      setFieldsLoading(true);
      api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${selectedCategory.id}/fields`)
        .then(setFields)
        .catch(() => setFields([]))
        .finally(() => setFieldsLoading(false));
    } else {
      setFields([]);
    }
  }, [selectedCategory?.id]);

  // ═══════════════════ CATEGORY CRUD ═══════════════════

  const openAddCategory = (parentId?: number | null) => {
    setEditCat(null);
    setShowCatForm(true);
  };

  const openEditCategory = (cat: AssetCategoryTreeNode) => {
    setEditCat(cat);
    setShowCatForm(true);
  };

  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCatSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: fd.get("name") as string,
      name_plural: (fd.get("name_plural") as string) || null,
      code: fd.get("code") as string,
      icon: (fd.get("icon") as string) || null,
      color: (fd.get("color") as string) || null,
      description: (fd.get("description") as string) || null,
      is_abstract: fd.get("is_abstract") === "true",
      sort_order: fd.get("sort_order") ? Number(fd.get("sort_order")) : 0,
      parent_id: fd.get("parent_id") ? Number(fd.get("parent_id")) : null,
    };
    try {
      if (editCat) {
        await api.put(`/api/v1/asset-categories/${editCat.id}`, body);
      } else {
        await api.post("/api/v1/asset-categories", body);
      }
      setShowCatForm(false);
      setEditCat(null);
      loadTree();
    } catch (err) {
      alert("Blad zapisu: " + err);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeactivateCategory = async (cat: AssetCategoryTreeNode) => {
    const action = cat.is_active ? "dezaktywowac" : "aktywowac";
    if (!confirm(`${action} kategorie "${cat.name}"?`)) return;
    try {
      if (cat.is_active) {
        await api.delete(`/api/v1/asset-categories/${cat.id}`);
      } else {
        await api.put(`/api/v1/asset-categories/${cat.id}`, { is_active: true });
      }
      loadTree();
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  // ═══════════════════ FIELD CRUD ═══════════════════

  const openAddField = () => {
    setEditField(null);
    setShowFieldForm(true);
  };

  const openEditField = (field: CategoryFieldDefinition) => {
    setEditField(field);
    setShowFieldForm(true);
  };

  const handleSaveField = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCategory) return;
    setFieldSaving(true);
    const fd = new FormData(e.currentTarget);

    // Parse options from textarea
    let optionsJson: unknown = null;
    const optionsRaw = (fd.get("options_raw") as string || "").trim();
    if (optionsRaw) {
      optionsJson = optionsRaw.split("\n").map(l => l.trim()).filter(Boolean);
    }

    const body: Record<string, unknown> = {
      category_id: selectedCategory.id,
      field_key: fd.get("field_key") as string,
      label: fd.get("label") as string,
      label_en: (fd.get("label_en") as string) || null,
      field_type: fd.get("field_type") as string,
      tab_name: (fd.get("tab_name") as string) || "Informacje",
      is_required: fd.get("is_required") === "true",
      is_unique: fd.get("is_unique") === "true",
      default_value: (fd.get("default_value") as string) || null,
      placeholder: (fd.get("placeholder") as string) || null,
      help_text: (fd.get("help_text") as string) || null,
      min_value: fd.get("min_value") ? Number(fd.get("min_value")) : null,
      max_value: fd.get("max_value") ? Number(fd.get("max_value")) : null,
      max_length: fd.get("max_length") ? Number(fd.get("max_length")) : null,
      options_json: optionsJson,
      reference_category_id: fd.get("reference_category_id") ? Number(fd.get("reference_category_id")) : null,
      show_in_list: fd.get("show_in_list") === "true",
      sort_order: fd.get("sort_order") ? Number(fd.get("sort_order")) : 0,
      column_width: fd.get("column_width") ? Number(fd.get("column_width")) : 150,
    };
    try {
      if (editField) {
        await api.put(`/api/v1/asset-categories/fields/${editField.id}`, body);
      } else {
        await api.post(`/api/v1/asset-categories/${selectedCategory.id}/fields`, body);
      }
      setShowFieldForm(false);
      setEditField(null);
      // Refresh fields
      const updated = await api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${selectedCategory.id}/fields`);
      setFields(updated);
    } catch (err) {
      alert("Blad zapisu pola: " + err);
    } finally {
      setFieldSaving(false);
    }
  };

  const handleDeactivateField = async (field: CategoryFieldDefinition) => {
    if (!selectedCategory || !confirm(`Usunac pole "${field.label}"?`)) return;
    try {
      await api.delete(`/api/v1/asset-categories/fields/${field.id}`);
      const updated = await api.get<CategoryFieldDefinition[]>(`/api/v1/asset-categories/${selectedCategory.id}/fields`);
      setFields(updated);
    } catch (err) {
      alert("Blad: " + err);
    }
  };

  // ═══════════════════ RENDER ═══════════════════

  // Group fields by tab for display
  const fieldsByTab = useMemo(() => {
    const map = new Map<string, CategoryFieldDefinition[]>();
    for (const f of fields) {
      const tab = f.tab_name || "Informacje";
      if (!map.has(tab)) map.set(tab, []);
      map.get(tab)!.push(f);
    }
    for (const [, flds] of map) flds.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [fields]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Left: Category Tree */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 220, maxWidth: 280, width: 250, borderRight: "1px solid var(--border)", background: "var(--bg-card)" }}>
        <AssetCategoryTree
          tree={categoryTree}
          selectedId={selectedCategory?.id ?? null}
          onSelect={(cat) => setSelectedCategory(cat as AssetCategoryTreeNode | null)}
          loading={categoryLoading}
        />
        <div style={{ padding: 8, borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-sm btn-primary" style={{ width: "100%", fontSize: 11 }} onClick={() => openAddCategory()}>
            + Nowa kategoria
          </button>
        </div>
      </div>

      {/* Right: Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 20px" }}>
        {/* Page title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0 8px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Administracja CMDB
          </h2>
          <span className="score-badge" style={{ background: "var(--purple-dim, rgba(139,92,246,0.15))", color: "var(--purple, #8B5CF6)", fontSize: 11 }}>
            Kategorie & Formularze
          </span>
        </div>

        {!selectedCategory ? (
          /* No category selected - show overview */
          <div style={{ marginTop: 20 }}>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Przegladaj kategorie</div>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Wybierz kategorie z drzewa po lewej stronie, aby zarzadzac jej polami formularza.
                Mozesz tez dodac nowa kategorie przyciskiem na dole panelu.
              </p>
            </div>

            {/* Admin tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 14 }}>
              {[
                { key: "fields" as const, label: "Statystyki kategorii" },
                { key: "reltypes" as const, label: `Typy relacji (${relTypes.length})` },
              ].map(t => (
                <div
                  key={t.key}
                  onClick={() => setAdminTab(t.key)}
                  style={{
                    padding: "8px 16px", fontSize: 13, cursor: "pointer",
                    borderBottom: adminTab === t.key ? "2px solid var(--blue)" : "2px solid var(--border)",
                    color: adminTab === t.key ? "var(--blue)" : "var(--text-muted)",
                    fontWeight: adminTab === t.key ? 600 : 400,
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>

            {adminTab === "fields" && (
              <div className="card">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Kategoria</th>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Kod</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Typ</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Aktywow</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Aktywna</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatCategories.map(cat => (
                      <tr key={cat.id} style={{ borderBottom: "1px solid var(--border)", opacity: cat.is_active ? 1 : 0.4 }}>
                        <td style={{ padding: "6px 10px" }}>
                          <span style={{ paddingLeft: cat.parent_id ? 16 : 0, fontWeight: cat.is_abstract ? 600 : 400 }}>
                            {cat.name}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{cat.code}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <span className="score-badge" style={{
                            background: cat.is_abstract ? "var(--orange-dim, rgba(245,158,11,0.15))" : "var(--green-dim, rgba(16,185,129,0.15))",
                            color: cat.is_abstract ? "var(--orange)" : "var(--green)", fontSize: 10,
                          }}>
                            {cat.is_abstract ? "Grupa" : "Konkretna"}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>{cat.asset_count}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>{cat.is_active ? "✓" : "✗"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>
                          <button className="btn btn-sm" style={{ fontSize: 11, marginRight: 4 }} onClick={() => openEditCategory(cat)}>Edytuj</button>
                          <button className="btn btn-sm" style={{ fontSize: 11, color: cat.is_active ? "var(--red)" : "var(--green)" }} onClick={() => handleDeactivateCategory(cat)}>
                            {cat.is_active ? "Dezaktywuj" : "Aktywuj"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {adminTab === "reltypes" && (
              <div className="card">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Kod</th>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Nazwa</th>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Nazwa odwrotna</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 500 }}>Kolor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relTypes.map(rt => (
                      <tr key={rt.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{rt.code}</td>
                        <td style={{ padding: "6px 10px" }}>{rt.name}</td>
                        <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{rt.name_reverse || "\u2014"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          {rt.color && (
                            <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: rt.color, verticalAlign: "middle" }} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Category selected - show details + form builder */
          <div style={{ marginTop: 8 }}>
            {/* Category header card */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>{selectedCategory.icon || "📁"}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{selectedCategory.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'JetBrains Mono',monospace" }}>{selectedCategory.code}</div>
                    </div>
                  </div>
                  {selectedCategory.description && (
                    <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4, marginBottom: 0 }}>{selectedCategory.description}</p>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <span className="score-badge" style={{
                      background: selectedCategory.is_abstract ? "var(--orange-dim, rgba(245,158,11,0.15))" : "var(--green-dim, rgba(16,185,129,0.15))",
                      color: selectedCategory.is_abstract ? "var(--orange)" : "var(--green)", fontSize: 10,
                    }}>
                      {selectedCategory.is_abstract ? "Grupa (abstrakcyjna)" : "Konkretna (przypisywalna)"}
                    </span>
                    <span className="score-badge" style={{ background: "var(--blue-dim)", color: "var(--blue)", fontSize: 10 }}>
                      {selectedCategory.asset_count} aktywow
                    </span>
                    {!selectedCategory.is_active && (
                      <span className="score-badge" style={{ background: "var(--red-dim, rgba(239,68,68,0.15))", color: "var(--red)", fontSize: 10 }}>
                        Nieaktywna
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => openEditCategory(selectedCategory)}>Edytuj kategorie</button>
                  <button className="btn btn-sm" style={{ color: selectedCategory.is_active ? "var(--red)" : "var(--green)" }} onClick={() => handleDeactivateCategory(selectedCategory)}>
                    {selectedCategory.is_active ? "Dezaktywuj" : "Aktywuj"}
                  </button>
                </div>
              </div>
            </div>

            {/* Form builder section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Definicja formularza ({fields.length} pol)</h3>
              {!selectedCategory.is_abstract && (
                <button className="btn btn-sm btn-primary" onClick={openAddField}>+ Dodaj pole</button>
              )}
            </div>

            {selectedCategory.is_abstract ? (
              <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 13 }}>
                Kategorie abstrakcyjne (grupy) nie maja wlasnych pol formularza.
                Pola definiuje sie na konkretnych podkategoriach.
              </div>
            ) : fieldsLoading ? (
              <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 13 }}>
                Ladowanie pol...
              </div>
            ) : fields.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 13 }}>
                Brak zdefiniowanych pol. Kliknij "Dodaj pole" aby rozpoczac budowe formularza.
              </div>
            ) : (
              /* Fields grouped by tab */
              [...fieldsByTab.entries()].map(([tabName, tabFields]) => (
                <div key={tabName} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 8 }}>
                      Zakladka
                    </span>
                    {tabName}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>#</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>Klucz</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>Etykieta</th>
                        <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>Typ</th>
                        <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>Wymagane</th>
                        <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>W liscie</th>
                        <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 500 }}>Zrodlo</th>
                        <th style={{ textAlign: "right", padding: "6px 8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabFields.map(field => (
                        <tr key={field.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-muted)" }}>{field.sort_order}</td>
                          <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{field.field_key}</td>
                          <td style={{ padding: "5px 8px", fontWeight: 500 }}>{field.label}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <span className="score-badge" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", fontSize: 10 }}>
                              {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                            </span>
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center", color: field.is_required ? "var(--red)" : "var(--text-muted)" }}>
                            {field.is_required ? "✓" : ""}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center", color: field.show_in_list ? "var(--green)" : "var(--text-muted)" }}>
                            {field.show_in_list ? "✓" : ""}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            {field.inherited_from_id ? (
                              <span style={{ fontSize: 9, color: "var(--purple)", background: "rgba(139,92,246,0.1)", padding: "2px 6px", borderRadius: 8 }}>
                                Odziedziczone
                              </span>
                            ) : (
                              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Wlasne</span>
                            )}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>
                            {!field.inherited_from_id && (
                              <>
                                <button className="btn btn-sm" style={{ fontSize: 10, padding: "2px 6px", marginRight: 4 }} onClick={() => openEditField(field)}>Edytuj</button>
                                <button className="btn btn-sm" style={{ fontSize: 10, padding: "2px 6px", color: "var(--red)" }} onClick={() => handleDeactivateField(field)}>Usun</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ═══ CATEGORY FORM MODAL ═══ */}
      <Modal open={showCatForm} onClose={() => { setShowCatForm(false); setEditCat(null); }} title={editCat ? `Edytuj: ${editCat.name}` : "Nowa kategoria"} wide>
        <form onSubmit={handleSaveCategory}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Nazwa *</label>
              <input name="name" className="form-control" required defaultValue={editCat?.name ?? ""} placeholder="np. Serwery" />
            </div>
            <div className="form-group">
              <label>Nazwa w l. mnogiej</label>
              <input name="name_plural" className="form-control" defaultValue={editCat?.name_plural ?? ""} placeholder="np. Serwery" />
            </div>
            <div className="form-group">
              <label>Kod (unikalny) *</label>
              <input name="code" className="form-control" required defaultValue={editCat?.code ?? ""} placeholder="np. servers" pattern="[a-z0-9_]+" title="Tylko male litery, cyfry i podkreslniki" />
            </div>
            <div className="form-group">
              <label>Kategoria nadrzedna</label>
              <select name="parent_id" className="form-control" defaultValue={editCat?.parent_id ?? (selectedCategory?.id ?? "")}>
                <option value="">Brak (glowny poziom)</option>
                {flatCategories.filter(c => !editCat || c.id !== editCat.id).map(c => (
                  <option key={c.id} value={c.id}>{c.parent_id ? "  " : ""}{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Ikona</label>
              <select name="icon" className="form-control" defaultValue={editCat?.icon ?? ""}>
                <option value="">Brak</option>
                {ICON_OPTIONS.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Kolor</label>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input name="color" className="form-control" defaultValue={editCat?.color ?? ""} placeholder="#3B82F6" style={{ flex: 1 }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                {COLOR_PRESETS.map(c => (
                  <span
                    key={c}
                    onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.parentElement?.querySelector('input[name="color"]') as HTMLInputElement);
                      if (input) input.value = c;
                    }}
                    style={{ width: 18, height: 18, borderRadius: 4, background: c, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Kolejnosc sortowania</label>
              <input name="sort_order" type="number" className="form-control" defaultValue={editCat?.sort_order ?? 0} />
            </div>
            <div className="form-group">
              <label>Typ kategorii</label>
              <select name="is_abstract" className="form-control" defaultValue={editCat?.is_abstract ? "true" : "false"}>
                <option value="false">Konkretna (przypisywalna do aktywow)</option>
                <option value="true">Abstrakcyjna (grupa/folder)</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Opis</label>
              <textarea name="description" className="form-control" rows={2} defaultValue={editCat?.description ?? ""} placeholder="Opcjonalny opis kategorii" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => { setShowCatForm(false); setEditCat(null); }}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={catSaving}>{catSaving ? "Zapisywanie..." : editCat ? "Zapisz zmiany" : "Utwórz kategorie"}</button>
          </div>
        </form>
      </Modal>

      {/* ═══ FIELD FORM MODAL ═══ */}
      <Modal open={showFieldForm} onClose={() => { setShowFieldForm(false); setEditField(null); }} title={editField ? `Edytuj pole: ${editField.label}` : "Nowe pole formularza"} wide>
        <form onSubmit={handleSaveField}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Klucz pola (field_key) *</label>
              <input name="field_key" className="form-control" required defaultValue={editField?.field_key ?? ""} placeholder="np. hostname" pattern="[a-z0-9_]+" title="Tylko male litery, cyfry i podkreslniki" />
              <small style={{ color: "var(--text-muted)", fontSize: 10 }}>Unikalny identyfikator pola w JSON-ie custom_attributes</small>
            </div>
            <div className="form-group">
              <label>Etykieta (PL) *</label>
              <input name="label" className="form-control" required defaultValue={editField?.label ?? ""} placeholder="np. Nazwa hosta" />
            </div>
            <div className="form-group">
              <label>Etykieta (EN)</label>
              <input name="label_en" className="form-control" defaultValue={editField?.label_en ?? ""} placeholder="np. Hostname" />
            </div>
            <div className="form-group">
              <label>Typ pola *</label>
              <select name="field_type" className="form-control" required defaultValue={editField?.field_type ?? "text"}>
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Zakladka</label>
              <input name="tab_name" className="form-control" defaultValue={editField?.tab_name ?? "Informacje"} placeholder="np. Informacje" />
              <small style={{ color: "var(--text-muted)", fontSize: 10 }}>Nazwa zakladki w formularzu (Informacje, Zarzadzanie, Bezpieczenstwo...)</small>
            </div>
            <div className="form-group">
              <label>Kolejnosc</label>
              <input name="sort_order" type="number" className="form-control" defaultValue={editField?.sort_order ?? 0} />
            </div>
            <div className="form-group">
              <label>Placeholder</label>
              <input name="placeholder" className="form-control" defaultValue={editField?.placeholder ?? ""} placeholder="np. Wpisz wartosc..." />
            </div>
            <div className="form-group">
              <label>Wartosc domyslna</label>
              <input name="default_value" className="form-control" defaultValue={editField?.default_value ?? ""} />
            </div>
            <div className="form-group">
              <label>Wymagane</label>
              <select name="is_required" className="form-control" defaultValue={editField?.is_required ? "true" : "false"}>
                <option value="false">Nie</option>
                <option value="true">Tak</option>
              </select>
            </div>
            <div className="form-group">
              <label>Unikalne</label>
              <select name="is_unique" className="form-control" defaultValue={editField?.is_unique ? "true" : "false"}>
                <option value="false">Nie</option>
                <option value="true">Tak</option>
              </select>
            </div>
            <div className="form-group">
              <label>Widoczne w liscie</label>
              <select name="show_in_list" className="form-control" defaultValue={editField?.show_in_list ? "true" : "false"}>
                <option value="false">Nie</option>
                <option value="true">Tak — pokaz jako kolumne w tabeli</option>
              </select>
            </div>
            <div className="form-group">
              <label>Szerokosc kolumny (px)</label>
              <input name="column_width" type="number" className="form-control" defaultValue={editField?.column_width ?? 150} />
            </div>
            <div className="form-group">
              <label>Min. wartosc (number)</label>
              <input name="min_value" type="number" className="form-control" defaultValue={editField?.min_value ?? ""} />
            </div>
            <div className="form-group">
              <label>Max. wartosc (number)</label>
              <input name="max_value" type="number" className="form-control" defaultValue={editField?.max_value ?? ""} />
            </div>
            <div className="form-group">
              <label>Max. dlugosc (text)</label>
              <input name="max_length" type="number" className="form-control" defaultValue={editField?.max_length ?? ""} />
            </div>
            <div className="form-group">
              <label>Kategoria referencyjna (reference)</label>
              <select name="reference_category_id" className="form-control" defaultValue={editField?.reference_category_id ?? ""}>
                <option value="">Brak</option>
                {flatCategories.filter(c => !c.is_abstract).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <small style={{ color: "var(--text-muted)", fontSize: 10 }}>Tylko dla typu "Referencja do aktywa"</small>
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Opcje (select / multiselect)</label>
              <textarea
                name="options_raw"
                className="form-control"
                rows={3}
                defaultValue={editField?.options_json ? formatOptionsForEdit(editField.options_json) : ""}
                placeholder={"Jedna opcja na linie, np.:\nProdukcja\nStaging\nDevelopment\nTest"}
              />
              <small style={{ color: "var(--text-muted)", fontSize: 10 }}>Kazda linia = jedna opcja. Dotyczy typow: Lista wyboru, Wielokrotny wybor.</small>
            </div>
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Tekst pomocy</label>
              <textarea name="help_text" className="form-control" rows={2} defaultValue={editField?.help_text ?? ""} placeholder="Dodatkowa informacja dla uzytkownika..." />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => { setShowFieldForm(false); setEditField(null); }}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={fieldSaving}>{fieldSaving ? "Zapisywanie..." : editField ? "Zapisz zmiany" : "Dodaj pole"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ── Helper: format options_json for editing ── */
function formatOptionsForEdit(json: unknown): string {
  if (!json) return "";
  let parsed = json;
  if (typeof json === "string") {
    try { parsed = JSON.parse(json); } catch { return String(json); }
  }
  if (Array.isArray(parsed)) {
    return parsed.map(item => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && "label" in item) return String((item as { label: string }).label);
      return String(item);
    }).join("\n");
  }
  return "";
}
