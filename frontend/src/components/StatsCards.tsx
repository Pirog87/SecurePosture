/* ═══════════════════════════════════════════════════════════
   StatsCards — dynamic KPI cards that show filtered/total
   when a table is being filtered (e.g. "7 / 15").
   ═══════════════════════════════════════════════════════════ */

export interface StatCard {
  label: string;
  /** Computed from filtered data */
  value: number | string;
  /** Computed from ALL data (unfiltered) — shown when differs from value */
  total?: number | string;
  color: string;
  /** Optional: format value for display (e.g. toFixed) */
  formatValue?: (v: number | string) => string;
}

interface Props {
  cards: StatCard[];
  isFiltered?: boolean;
}

const mono: React.CSSProperties = {
  fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
};

export default function StatsCards({ cards, isFiltered }: Props) {
  return (
    <div className="grid-4" style={{ marginBottom: 16 }}>
      {cards.map((card, i) => {
        const displayVal = card.formatValue ? card.formatValue(card.value) : card.value;
        const displayTotal = card.total != null && card.formatValue ? card.formatValue(card.total) : card.total;
        const showDual = isFiltered && card.total != null && String(card.value) !== String(card.total);
        return (
          <div key={i} className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ ...mono, color: card.color }}>
              {showDual ? (
                <>
                  {displayVal}
                  <span style={{ fontSize: 16, opacity: 0.5, fontWeight: 400 }}> / {displayTotal}</span>
                </>
              ) : (
                displayVal
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
