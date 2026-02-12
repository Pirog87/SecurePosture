import { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import type { Asset, CategoryFieldDefinition } from "../types";

/* ═══════════════════════════════════════════════
   DynamicAssetForm
   Renders a tabbed form based on field definitions
   ═══════════════════════════════════════════════ */

interface DynamicAssetFormProps {
  fields: CategoryFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  readOnly?: boolean;
}

export default function DynamicAssetForm({ fields, values, onChange, readOnly = false }: DynamicAssetFormProps) {
  // Group fields by tab
  const tabs = useMemo(() => {
    const tabMap = new Map<string, CategoryFieldDefinition[]>();
    for (const f of fields) {
      const tab = f.tab_name || "Informacje";
      if (!tabMap.has(tab)) tabMap.set(tab, []);
      tabMap.get(tab)!.push(f);
    }
    // Sort fields within each tab
    for (const [, flds] of tabMap) {
      flds.sort((a, b) => a.sort_order - b.sort_order);
    }
    return tabMap;
  }, [fields]);

  const tabNames = useMemo(() => [...tabs.keys()], [tabs]);
  const [activeTab, setActiveTab] = useState(tabNames[0] || "Informacje");

  // Ensure activeTab is valid
  const currentTab = tabNames.includes(activeTab) ? activeTab : tabNames[0] || "Informacje";
  const currentFields = tabs.get(currentTab) || [];

  if (fields.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Brak zdefiniowanych pol dla tej kategorii.
      </div>
    );
  }

  return (
    <div>
      {/* Tab headers (only show if more than 1 tab) */}
      {tabNames.length > 1 && (
        <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "1px solid var(--border)" }}>
          {tabNames.map(tab => (
            <div
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 14px", fontSize: 12, cursor: "pointer",
                borderBottom: currentTab === tab ? "2px solid var(--blue)" : "2px solid transparent",
                color: currentTab === tab ? "var(--blue)" : "var(--text-muted)",
                fontWeight: currentTab === tab ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {tab}
            </div>
          ))}
        </div>
      )}

      {/* Fields grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {currentFields.map(field => (
          <FieldRenderer
            key={field.field_key}
            field={field}
            value={values[field.field_key] ?? field.default_value ?? ""}
            onChange={val => onChange(field.field_key, val)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Individual field renderer ── */
function FieldRenderer({ field, value, onChange, readOnly }: {
  field: CategoryFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
}) {
  const spanTwo = field.field_type === "textarea";
  const gridStyle: React.CSSProperties = spanTwo ? { gridColumn: "span 2" } : {};

  const labelEl = (
    <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-muted)" }}>
      {field.label}
      {field.is_required && <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>}
      {field.inherited_from_id && (
        <span style={{ fontSize: 9, color: "var(--purple)", marginLeft: 4 }} title="Odziedziczone z kategorii nadrzednej">
          (dziedz.)
        </span>
      )}
    </label>
  );

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "6px 10px", fontSize: 13,
    background: readOnly ? "transparent" : "var(--bg-input, var(--bg-card))",
    border: readOnly ? "none" : "1px solid var(--border)",
    borderRadius: 6, color: "var(--text-primary)", outline: "none",
  };

  switch (field.field_type) {
    case "text":
    case "email":
    case "url":
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          {readOnly ? (
            <div style={{ fontSize: 13, padding: "4px 0" }}>{String(value || "") || "\u2014"}</div>
          ) : (
            <input
              type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
              value={String(value || "")}
              onChange={e => onChange(e.target.value || null)}
              placeholder={field.placeholder || undefined}
              required={field.is_required}
              maxLength={field.max_length || undefined}
              className="form-control"
              style={inputStyle}
            />
          )}
        </div>
      );

    case "number":
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          {readOnly ? (
            <div style={{ fontSize: 13, padding: "4px 0", fontFamily: "'JetBrains Mono',monospace" }}>
              {value != null && value !== "" ? String(value) : "\u2014"}
            </div>
          ) : (
            <input
              type="number"
              value={value != null && value !== "" ? String(value) : ""}
              onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
              placeholder={field.placeholder || undefined}
              required={field.is_required}
              min={field.min_value ?? undefined}
              max={field.max_value ?? undefined}
              className="form-control"
              style={inputStyle}
            />
          )}
        </div>
      );

    case "date":
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          {readOnly ? (
            <div style={{ fontSize: 13, padding: "4px 0" }}>{String(value || "") || "\u2014"}</div>
          ) : (
            <input
              type="date"
              value={String(value || "")}
              onChange={e => onChange(e.target.value || null)}
              required={field.is_required}
              className="form-control"
              style={inputStyle}
            />
          )}
        </div>
      );

    case "boolean":
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          {readOnly ? (
            <div style={{ fontSize: 13, padding: "4px 0" }}>
              {value === true ? "Tak" : value === false ? "Nie" : "\u2014"}
            </div>
          ) : (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={e => onChange(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>{value ? "Tak" : "Nie"}</span>
            </label>
          )}
        </div>
      );

    case "select": {
      const options = parseOptions(field.options_json);
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          {readOnly ? (
            <div style={{ fontSize: 13, padding: "4px 0" }}>{String(value || "") || "\u2014"}</div>
          ) : (
            <select
              value={String(value || "")}
              onChange={e => onChange(e.target.value || null)}
              required={field.is_required}
              className="form-control"
              style={inputStyle}
            >
              <option value="">Wybierz...</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
      );
    }

    case "multiselect": {
      const options = parseOptions(field.options_json);
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          {readOnly ? (
            <div style={{ fontSize: 13, padding: "4px 0" }}>{selected.join(", ") || "\u2014"}</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {options.map(opt => {
                const isChecked = selected.includes(opt.value);
                return (
                  <label key={opt.value} style={{
                    display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                    padding: "3px 8px", borderRadius: 12, cursor: "pointer",
                    background: isChecked ? "var(--blue-dim)" : "rgba(255,255,255,0.03)",
                    border: isChecked ? "1px solid var(--blue)" : "1px solid var(--border)",
                    color: isChecked ? "var(--blue)" : "var(--text-secondary)",
                  }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const next = isChecked
                          ? selected.filter(v => v !== opt.value)
                          : [...selected, opt.value];
                        onChange(next.length > 0 ? next : null);
                      }}
                      style={{ display: "none" }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    case "reference":
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          <ReferenceField
            field={field}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            inputStyle={inputStyle}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          {readOnly ? (
            <div style={{ fontSize: 13, padding: "4px 0", whiteSpace: "pre-wrap" }}>
              {String(value || "") || "\u2014"}
            </div>
          ) : (
            <textarea
              value={String(value || "")}
              onChange={e => onChange(e.target.value || null)}
              placeholder={field.placeholder || undefined}
              required={field.is_required}
              rows={3}
              className="form-control"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          )}
        </div>
      );

    default:
      return (
        <div className="form-group" style={gridStyle}>
          {labelEl}
          <input
            type="text"
            value={String(value || "")}
            onChange={e => onChange(e.target.value || null)}
            className="form-control"
            style={inputStyle}
          />
        </div>
      );
  }
}

/* ── Reference field: loads assets from a specific category ── */
function ReferenceField({ field, value, onChange, readOnly, inputStyle }: {
  field: CategoryFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  inputStyle: React.CSSProperties;
}) {
  const [refAssets, setRefAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (field.reference_category_id) {
      setLoading(true);
      api.get<Asset[]>(`/api/v1/assets?asset_category_id=${field.reference_category_id}`)
        .then(setRefAssets)
        .catch(() => setRefAssets([]))
        .finally(() => setLoading(false));
    }
  }, [field.reference_category_id]);

  const selectedName = useMemo(() => {
    if (!value) return null;
    const asset = refAssets.find(a => a.id === Number(value));
    return asset?.name || `Asset #${value}`;
  }, [value, refAssets]);

  if (readOnly) {
    return (
      <div style={{ fontSize: 13, padding: "4px 0" }}>
        {selectedName || "\u2014"}
      </div>
    );
  }

  return (
    <select
      value={value != null ? String(value) : ""}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      required={field.is_required}
      className="form-control"
      style={inputStyle}
      disabled={loading}
    >
      <option value="">{loading ? "Ladowanie..." : "Wybierz aktyw..."}</option>
      {refAssets.map(a => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

/* ── Parse options from JSON ── */
function parseOptions(json: unknown): { value: string; label: string }[] {
  if (!json) return [];
  // Could be a JSON string that needs parsing
  let parsed = json;
  if (typeof json === "string") {
    try { parsed = JSON.parse(json); } catch { return []; }
  }
  if (Array.isArray(parsed)) {
    return parsed.map(item => {
      if (typeof item === "string") return { value: item, label: item };
      if (typeof item === "object" && item !== null && "value" in item && "label" in item) {
        return { value: String(item.value), label: String(item.label) };
      }
      return { value: String(item), label: String(item) };
    });
  }
  return [];
}
