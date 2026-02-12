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
      { to: "/security-score", icon: "🎯", label: "Security Score" },
      { to: "/domains", icon: "🛡", label: "Domeny Bezpieczenstwa" },
    ],
  },
  {
    title: "Zarządzanie Ryzykiem",
    items: [
      { to: "/assets", icon: "🖥️", label: "Rejestr Aktywów" },
      { to: "/assets/graph", icon: "🔗", label: "Graf Aktywów" },
      { to: "/risks", icon: "⚠️", label: "Rejestr Ryzyk" },
      { to: "/reviews", icon: "🔄", label: "Przeglądy" },
      { to: "/actions", icon: "🎯", label: "Działania" },
    ],
  },
  {
    title: "Operacje Bezpieczeństwa",
    items: [
      { to: "/vulnerabilities", icon: "🔓", label: "Podatności" },
      { to: "/incidents", icon: "🚨", label: "Incydenty" },
    ],
  },
  {
    title: "Governance",
    items: [
      { to: "/policies", icon: "📜", label: "Polityki" },
      { to: "/exceptions", icon: "⚡", label: "Wyjątki" },
      { to: "/audits", icon: "🔍", label: "Audyty" },
    ],
  },
  {
    title: "Dostawcy & Awareness",
    items: [
      { to: "/vendors", icon: "🏭", label: "Dostawcy (TPRM)" },
      { to: "/awareness", icon: "🎓", label: "Awareness" },
    ],
  },
  {
    title: "Framework Engine",
    items: [
      { to: "/frameworks", icon: "📐", label: "Frameworki" },
      { to: "/assessments", icon: "📝", label: "Oceny" },
    ],
  },
  {
    title: "CIS Benchmark",
    items: [
      { to: "/cis", icon: "📋", label: "Lista Ocen CIS" },
      { to: "/cis/assess", icon: "✅", label: "Formularz CIS" },
    ],
  },
  {
    title: "Kontekst Organizacyjny",
    items: [
      { to: "/org-context", icon: "🏛️", label: "Kontekst Org." },
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
