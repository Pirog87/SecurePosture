export default function CisListPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <select className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-44">
          <option>Wszystkie jednostki</option>
        </select>
        <button className="px-4 py-2 rounded-md bg-accent-blue border border-accent-blue text-white text-[13px] font-medium">
          + Nowa ocena
        </button>
      </div>
      <div className="bg-bg-card border border-border rounded-[10px] p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          Historia Ocen CIS
        </div>
        <p className="text-sm text-text-secondary">
          Tabela ocen z API /api/v1/cis/assessments.
        </p>
      </div>
    </div>
  );
}
