export default function ReviewsPage() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3.5 mb-4">
        {[
          { value: "—", label: "Przeterminowane przeglądy", color: "text-accent-red" },
          { value: "—", label: "Do przeglądu w tym miesiącu", color: "text-accent-yellow" },
          { value: "—", label: "Aktualne", color: "text-accent-green" },
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
          Ryzyka Wymagające Przeglądu
        </div>
        <p className="text-sm text-text-secondary">
          Dane z API /api/v1/risk-reviews/overdue.
        </p>
      </div>
    </div>
  );
}
