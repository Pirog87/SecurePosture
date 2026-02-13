import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import Modal from "../components/Modal";

interface AuditProgram {
  id: number;
  name: string;
  year: number;
  description: string | null;
  status: string;
  prepared_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  engagement_count: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  submitted: "#8b5cf6",
  approved: "#22c55e",
  active: "#3b82f6",
  completed: "#6b7280",
  archived: "#6b7280",
};

export default function AuditProgramsPage() {
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), description: "", prepared_by: "" });
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get<AuditProgram[]>("/api/v1/audit-programs/")
      .then(setPrograms)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post("/api/v1/audit-programs/", {
        name: form.name,
        year: form.year,
        description: form.description || null,
        prepared_by: form.prepared_by || null,
      });
      setShowModal(false);
      setForm({ name: "", year: new Date().getFullYear(), description: "", prepared_by: "" });
      load();
    } catch {
      alert("Błąd tworzenia programu");
    }
  };

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Programy Audytów</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nowy program
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Wczytywanie...</div>
      ) : programs.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          Brak programów audytów. Utwórz roczny plan audytów.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 16 }}>
          {programs.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{ padding: 16, cursor: "pointer" }}
              onClick={() => navigate(`/audit-engagements?program_id=${p.id}`)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{p.name}</h3>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Rok: {p.year}</div>
                </div>
                <span className="badge" style={{ backgroundColor: `${STATUS_COLORS[p.status]}20`, color: STATUS_COLORS[p.status] }}>
                  {p.status}
                </span>
              </div>
              {p.description && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0" }}>{p.description}</p>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                <span>{p.engagement_count} zadań audytowych</span>
                {p.approved_by && <span>Zatwierdzony: {p.approved_by}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Nowy program audytów" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>Nazwa * <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. Program Audytów IT 2026" /></label>
            <label>Rok <input className="form-control" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></label>
            <label>Opis <textarea className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></label>
            <label>Przygotował <input className="form-control" value={form.prepared_by} onChange={(e) => setForm({ ...form, prepared_by: e.target.value })} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim()}>Utwórz</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
