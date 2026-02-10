export default function CatalogsPage() {
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[
          { label: "Zagrożenia", count: "—", color: "red" },
          { label: "Podatności", count: "—", color: "yellow" },
          { label: "Zabezpieczenia", count: "—", color: "green" },
        ].map((tab) => (
          <button
            key={tab.label}
            className="px-3 py-1.5 rounded-md border border-border bg-bg-card text-text-primary text-xs font-medium flex items-center gap-1.5 hover:bg-bg-card-hover transition-colors"
          >
            {tab.label}
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full font-mono ${
                tab.color === "red"
                  ? "bg-red-dim text-accent-red"
                  : tab.color === "yellow"
                    ? "bg-yellow-dim text-accent-yellow"
                    : "bg-green-dim text-accent-green"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <div className="bg-bg-card border border-border rounded-[10px] p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          Katalogi
        </div>
        <p className="text-sm text-text-secondary">
          Dane z API /api/v1/threats, /api/v1/vulnerabilities, /api/v1/safeguards.
        </p>
      </div>
    </div>
  );
}
