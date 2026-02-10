import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  icon: string;
  label: string;
  badge?: { count: number; color: string };
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Dashboardy",
    items: [
      { to: "/", icon: "\u{1F4CA}", label: "Executive Summary" },
    ],
  },
  {
    title: "Zarz\u0105dzanie Ryzykiem",
    items: [
      { to: "/risks", icon: "\u26A0\uFE0F", label: "Rejestr Ryzyk", badge: { count: 3, color: "red" } },
      { to: "/reviews", icon: "\u{1F504}", label: "Przegl\u0105dy", badge: { count: 5, color: "yellow" } },
    ],
  },
  {
    title: "CIS Benchmark",
    items: [
      { to: "/cis", icon: "\u{1F4CB}", label: "Lista Ocen" },
      { to: "/cis/assess", icon: "\u2705", label: "Formularz Oceny" },
    ],
  },
  {
    title: "Konfiguracja",
    items: [
      { to: "/org-structure", icon: "\u{1F3E2}", label: "Struktura Org." },
      { to: "/catalogs", icon: "\u{1F4DA}", label: "Katalogi" },
      { to: "/dictionaries", icon: "\u{1F4D6}", label: "S\u0142owniki" },
      { to: "/audit", icon: "\u{1F4DD}", label: "Audit Trail" },
    ],
  },
];

const badgeClasses: Record<string, string> = {
  red: "bg-red-dim text-accent-red",
  yellow: "bg-yellow-dim text-accent-yellow",
  green: "bg-green-dim text-accent-green",
  blue: "bg-blue-dim text-accent-blue",
};

export default function Sidebar() {
  return (
    <nav className="w-[260px] min-w-[260px] bg-bg-sidebar border-r border-border flex flex-col h-screen overflow-y-auto">
      {/* Brand */}
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-accent-blue to-accent-purple rounded-lg flex items-center justify-center text-lg">
          🛡
        </div>
        <div>
          <h1 className="text-[15px] font-bold tracking-tight">SecurePosture</h1>
          <span className="text-[11px] text-text-muted">CISO Platform</span>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title} className="px-3 pt-4 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted px-2 mb-1.5">
            {section.title}
          </div>
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] mb-0.5 border transition-all duration-200 ${
                  isActive
                    ? "bg-blue-dim text-accent-blue border-accent-blue/20"
                    : "text-text-secondary border-transparent hover:bg-bg-card hover:text-text-primary"
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full font-mono ${
                    badgeClasses[item.badge.color] ?? ""
                  }`}
                >
                  {item.badge.count}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
