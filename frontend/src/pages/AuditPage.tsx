export default function AuditPage() {
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <select className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-40">
          <option>Wszystkie moduły</option>
        </select>
        <input
          type="date"
          className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-40"
          defaultValue="2026-01-01"
        />
        <input
          type="date"
          className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-40"
          defaultValue="2026-02-10"
        />
      </div>
      <div className="bg-bg-card border border-border rounded-[10px] p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          Audit Trail
        </div>
        <p className="text-sm text-text-secondary">
          Dane z API /api/v1/audit-log.
        </p>
      </div>
    </div>
  );
}
