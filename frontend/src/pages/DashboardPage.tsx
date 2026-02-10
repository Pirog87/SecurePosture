export default function DashboardPage() {
  return (
    <div>
      <div className="grid grid-cols-4 gap-3.5 mb-4">
        {[
          { value: "—", label: "Ogólny Wynik", color: "text-accent-blue" },
          { value: "—", label: "Ryzyka Krytyczne", color: "text-accent-red" },
          { value: "—", label: "Ryzyka Średnie", color: "text-accent-orange" },
          { value: "—", label: "CIS Maturity Avg", color: "text-accent-yellow" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-bg-card border border-border rounded-[10px] p-5">
            <div className={`text-3xl font-bold font-mono tracking-tight ${kpi.color}`}>
              {kpi.value}
            </div>
            <div className="text-xs text-text-secondary mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-bg-card border border-border rounded-[10px] p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          Dashboard Executive Summary
        </div>
        <p className="text-sm text-text-secondary">
          Podłącz dane z API, aby wyświetlić heatmapę ryzyk, score ring i top 5 ryzyk krytycznych.
        </p>
      </div>
    </div>
  );
}
