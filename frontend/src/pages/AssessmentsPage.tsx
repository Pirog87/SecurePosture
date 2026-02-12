import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import type { AssessmentBrief, FrameworkBrief, OrgUnitTreeNode } from "../types";
import OrgUnitTreeSelect from "../components/OrgUnitTreeSelect";

function statusColor(s: string) {
  return s === "approved" ? "badge-green" : s === "in_progress" ? "badge-yellow" : "badge-gray";
}
function statusLabel(s: string) {
  return s === "approved" ? "Zatwierdzony" : s === "in_progress" ? "W trakcie" : s === "draft" ? "Szkic" : s;
}
function scoreColor(v: number | null) {
  if (v == null) return "var(--text-muted)";
  return v >= 75 ? "var(--green)" : v >= 50 ? "var(--yellow)" : v >= 25 ? "var(--orange)" : "var(--red)";
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [assessments, setAssessments] = useState<AssessmentBrief[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkBrief[]>([]);
  const [loading, setLoading] = useState(true);

  // New assessment form
  const [showForm, setShowForm] = useState(!!searchParams.get("framework_id"));
  const [orgTree, setOrgTree] = useState<OrgUnitTreeNode[]>([]);
  const [form, setForm] = useState({
    framework_id: searchParams.get("framework_id") ?? "",
    org_unit_id: "",
    title: "",
    assessor: "",
    implementation_group_filter: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<AssessmentBrief[]>("/api/v1/assessments"),
      api.get<FrameworkBrief[]>("/api/v1/frameworks?is_active=true"),
      api.get<OrgUnitTreeNode[]>("/api/v1/org-units/tree"),
    ])
      .then(([a, f, o]) => { setAssessments(a); setFrameworks(f); setOrgTree(o); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.framework_id) return;
    setCreating(true);
    try {
      const body = {
        framework_id: Number(form.framework_id),
        org_unit_id: form.org_unit_id ? Number(form.org_unit_id) : null,
        title: form.title || null,
        assessor: form.assessor || null,
        implementation_group_filter: form.implementation_group_filter || null,
        notes: form.notes || null,
      };
      const res = await api.post<{ id: number }>("/api/v1/assessments", body);
      navigate(`/assessments/${res.id}`);
    } catch {
      alert("Blad tworzenia oceny");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Oceny (Assessments)</h2>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? "Anuluj" : "Nowa ocena"}
          </button>
        </div>
      </div>

      {/* New Assessment Form */}
      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nowa ocena</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Framework *</label>
              <select className="form-control" value={form.framework_id}
                      onChange={e => setForm(f => ({ ...f, framework_id: e.target.value }))}>
                <option value="">-- Wybierz --</option>
                {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name} {fw.version ? `v${fw.version}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Jednostka org.</label>
              <OrgUnitTreeSelect
                tree={orgTree}
                value={form.org_unit_id ? Number(form.org_unit_id) : null}
                onChange={id => setForm(f => ({ ...f, org_unit_id: id ? String(id) : "" }))}
                placeholder="Cala organizacja"
                allowClear
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Tytul</label>
              <input className="form-control" value={form.title}
                     onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="np. Ocena Q1 2026" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Oceniajacy</label>
              <input className="form-control" value={form.assessor}
                     onChange={e => setForm(f => ({ ...f, assessor: e.target.value }))} placeholder="np. Jan Kowalski" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Filtr IG</label>
              <select className="form-control" value={form.implementation_group_filter}
                      onChange={e => setForm(f => ({ ...f, implementation_group_filter: e.target.value }))}>
                <option value="">Wszystkie</option>
                <option value="IG1">IG1</option>
                <option value="IG2">IG2</option>
                <option value="IG3">IG3</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Notatki</label>
              <input className="form-control" value={form.notes}
                     onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.framework_id || creating}>
              {creating ? "Tworzenie..." : "Utworz ocene"}
            </button>
            <button className="btn" onClick={() => setShowForm(false)}>Anuluj</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Ladowanie...</div>
      ) : assessments.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Brak ocen. Utworz nowa ocene klikajac "Nowa ocena".
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Framework</th>
                <th>Jednostka</th>
                <th>Data</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Wynik</th>
                <th style={{ textAlign: "right" }}>Ukonczenie</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map(a => (
                <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/assessments/${a.id}`)}>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{a.id}</td>
                  <td style={{ fontWeight: 600 }}>{a.framework_name ?? "—"}</td>
                  <td>{a.org_unit_name ?? "Cala org."}</td>
                  <td>{a.assessment_date}</td>
                  <td><span className={`badge ${statusColor(a.status)}`}>{statusLabel(a.status)}</span></td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: scoreColor(a.overall_score) }}>
                    {a.overall_score != null ? `${a.overall_score.toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>
                    {a.completion_pct != null ? `${a.completion_pct.toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
