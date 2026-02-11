import { useLocation } from "react-router-dom";
import { useTheme, type ThemeName } from "../../contexts/ThemeContext";

const titles: Record<string, string> = {
  "/": "Executive Summary",
  "/assets": "Rejestr Aktywow",
  "/assets/graph": "Graf Relacji Aktywow",
  "/risks": "Rejestr Ryzyk",
  "/reviews": "Przeglady Ryzyk",
  "/cis": "CIS Benchmark — Historia Ocen",
  "/cis/assess": "CIS Benchmark — Formularz Oceny",
  "/org-structure": "Struktura Organizacyjna",
  "/catalogs": "Katalogi",
  "/dictionaries": "Slowniki",
  "/actions": "Dzialania",
  "/audit": "Audit Trail",
  "/frameworks": "Frameworki",
  "/assessments": "Oceny",
  "/vulnerabilities": "Podatnosci",
  "/incidents": "Incydenty",
  "/policies": "Polityki",
  "/exceptions": "Rejestr Wyjatkow",
  "/audits": "Audyty",
  "/vendors": "Dostawcy (TPRM)",
  "/awareness": "Awareness",
  "/security-score": "Security Score",
  "/domains": "Domeny Bezpieczenstwa",
};

const themeOptions: { value: ThemeName; label: string; icon: string }[] = [
  { value: "dark", label: "Ciemny", icon: "\u{1F319}" },
  { value: "light", label: "Jasny", icon: "\u2600\uFE0F" },
  { value: "material", label: "Material", icon: "\u{1F3A8}" },
];

export default function Topbar() {
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
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
        <div className="theme-switcher">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              className={`theme-btn${theme === opt.value ? " active" : ""}`}
              onClick={() => setTheme(opt.value)}
              title={opt.label}
            >
              {opt.icon}
            </button>
          ))}
        </div>
        <span>
          <span className="live-dot" />
          Dane aktualne
        </span>
        <span>{dateStr}, {timeStr}</span>
      </div>
    </div>
  );
}
