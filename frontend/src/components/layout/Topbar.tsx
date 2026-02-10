import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/": "Executive Summary",
  "/risks": "Rejestr Ryzyk",
  "/reviews": "Przegl\u0105dy Ryzyk",
  "/cis": "CIS Benchmark \u2014 Historia Ocen",
  "/cis/assess": "CIS Benchmark \u2014 Formularz Oceny",
  "/org-structure": "Struktura Organizacyjna",
  "/catalogs": "Katalogi",
  "/dictionaries": "S\u0142owniki",
  "/audit": "Audit Trail",
};

export default function Topbar() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? "SecurePosture";
  const now = new Date();
  const dateStr = now.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="px-7 py-3 border-b border-border flex items-center justify-between bg-bg-primary/70 backdrop-blur-xl min-h-[52px]">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      <div className="text-xs text-text-muted flex items-center gap-4">
        <span className="flex items-center gap-1">
          <span className="w-[7px] h-[7px] bg-accent-green rounded-full inline-block animate-pulse-dot" />
          Dane aktualne
        </span>
        <span>
          {dateStr}, {timeStr}
        </span>
      </div>
    </div>
  );
}
