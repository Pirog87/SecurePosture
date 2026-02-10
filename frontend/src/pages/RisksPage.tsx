export default function RisksPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <select className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-40">
            <option>Wszystkie piony</option>
          </select>
          <select className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-40">
            <option>Wszystkie statusy</option>
          </select>
          <select className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-36">
            <option>Poziom ryzyka</option>
          </select>
        </div>
        <button className="px-4 py-2 rounded-md bg-accent-blue border border-accent-blue text-white text-[13px] font-medium">
          + Dodaj ryzyko
        </button>
      </div>
      <div className="bg-bg-card border border-border rounded-[10px] p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          Rejestr Ryzyk
        </div>
        <p className="text-sm text-text-secondary">
          Tabela ryzyk zostanie załadowana z API /api/v1/risks.
        </p>
      </div>
    </div>
  );
}
