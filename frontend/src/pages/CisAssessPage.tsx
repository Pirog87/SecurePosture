export default function CisAssessPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2 items-center">
          <select className="px-3 py-2 rounded-md border border-border bg-bg-secondary text-text-primary text-[13px] w-48">
            <option>Cała organizacja</option>
          </select>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-blue-dim text-accent-blue">
            Robocza
          </span>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-1.5 rounded-md border border-border bg-bg-card text-text-primary text-[13px] font-medium">
            Zapisz roboczą
          </button>
          <button className="px-4 py-1.5 rounded-md bg-accent-blue border border-accent-blue text-white text-[13px] font-medium">
            Zatwierdź
          </button>
        </div>
      </div>
      <div className="bg-bg-card border border-border rounded-[10px] p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          Formularz Oceny CIS Benchmark
        </div>
        <p className="text-sm text-text-secondary">
          18 kontroli CIS z sub-kontrolami — dane z API /api/v1/cis/controls.
        </p>
      </div>
    </div>
  );
}
