export default function OrgStructurePage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-[13px] text-text-secondary">
          Hierarchia: Organizacja → Pion → Dział → Zespół
        </span>
        <button className="px-4 py-2 rounded-md bg-accent-blue border border-accent-blue text-white text-[13px] font-medium">
          + Dodaj jednostkę
        </button>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-3.5">
        <div className="bg-bg-card border border-border rounded-[10px] p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
            Drzewo Struktury
          </div>
          <p className="text-sm text-text-secondary">
            Dane z API /api/v1/org-units/tree.
          </p>
        </div>
        <div className="bg-bg-card border border-border rounded-[10px] p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
            Szczegóły Jednostki
          </div>
          <p className="text-sm text-text-secondary">
            Wybierz jednostkę z drzewa, aby zobaczyć szczegóły.
          </p>
        </div>
      </div>
    </div>
  );
}
