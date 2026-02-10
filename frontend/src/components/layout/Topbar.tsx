import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/": "Executive Summary",
  "/assets": "Rejestr Aktywów",
  "/assets/graph": "Graf Relacji Aktywów",
  "/risks": "Rejestr Ryzyk",
  "/reviews": "Przeglądy Ryzyk",
  "/cis": "CIS Benchmark — Historia Ocen",
  "/cis/assess": "CIS Benchmark — Formularz Oceny",
  "/org-structure": "Struktura Organizacyjna",
  "/catalogs": "Katalogi",
  "/dictionaries": "Słowniki",
  "/actions": "Działania",
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
    <div className="topbar">
      <h2>{title}</h2>
      <div className="meta">
        <span>
          <span className="live-dot" />
          Dane aktualne
        </span>
        <span>{dateStr}, {timeStr}</span>
      </div>
    </div>
  );
}
