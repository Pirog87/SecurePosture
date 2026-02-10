import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  icon: string;
  label: string;
  badge?: { count: number; cls: string };
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Dashboardy",
    items: [
      { to: "/", icon: "📊", label: "Executive Summary" },
      { to: "/domains", icon: "🛡", label: "Domeny Bezpieczenstwa" },
    ],
  },
  {
    title: "Zarządzanie Ryzykiem",
    items: [
      { to: "/assets", icon: "🖥️", label: "Rejestr Aktywów" },
      { to: "/assets/graph", icon: "🔗", label: "Graf Aktywów" },
      { to: "/risks", icon: "⚠️", label: "Rejestr Ryzyk", badge: { count: 3, cls: "badge-red" } },
      { to: "/reviews", icon: "🔄", label: "Przeglądy", badge: { count: 5, cls: "badge-yellow" } },
      { to: "/actions", icon: "🎯", label: "Działania" },
    ],
  },
  {
    title: "CIS Benchmark",
    items: [
      { to: "/cis", icon: "📋", label: "Lista Ocen" },
      { to: "/cis/assess", icon: "✅", label: "Formularz Oceny" },
    ],
  },
  {
    title: "Konfiguracja",
    items: [
      { to: "/org-structure", icon: "🏢", label: "Struktura Org." },
      { to: "/catalogs", icon: "📚", label: "Katalogi" },
      { to: "/dictionaries", icon: "📖", label: "Słowniki" },
      { to: "/audit", icon: "📝", label: "Audit Trail" },
    ],
  },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="shield">🛡</div>
        <div className="brand-text">
          <h1>SecurePosture</h1>
          <span>CISO Platform</span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="sidebar-section">
          <div className="sidebar-section-label">{section.title}</div>
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `sidebar-item${isActive ? " active" : ""}`
              }
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span className={`badge ${item.badge.cls}`}>
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
