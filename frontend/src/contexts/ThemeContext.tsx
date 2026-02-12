import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "dark" | "light" | "material";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const THEMES: Record<ThemeName, Record<string, string>> = {
  dark: {
    "--bg-primary": "#0a0e1a",
    "--bg-secondary": "#111827",
    "--bg-card": "#1a2035",
    "--bg-card-hover": "#1f2847",
    "--bg-sidebar": "#0d1220",
    "--bg-subtle": "rgba(255,255,255,0.04)",
    "--bg-inset": "rgba(255,255,255,0.02)",
    "--border": "#2a3554",
    "--border-light": "#374167",
    "--text-primary": "#e8ecf4",
    "--text-secondary": "#8896b3",
    "--text-muted": "#5a6a8a",
    "--green": "#22c55e",
    "--green-dim": "rgba(34,197,94,0.15)",
    "--yellow": "#eab308",
    "--yellow-dim": "rgba(234,179,8,0.15)",
    "--orange": "#f97316",
    "--orange-dim": "rgba(249,115,22,0.15)",
    "--red": "#ef4444",
    "--red-dim": "rgba(239,68,68,0.15)",
    "--blue": "#3b82f6",
    "--blue-dim": "rgba(59,130,246,0.12)",
    "--purple": "#8b5cf6",
    "--purple-dim": "rgba(139,92,246,0.12)",
    "--cyan": "#06b6d4",
    "--shadow": "0 4px 24px rgba(0,0,0,0.3)",
  },
  light: {
    "--bg-primary": "#f0f2f5",
    "--bg-secondary": "#ffffff",
    "--bg-card": "#ffffff",
    "--bg-card-hover": "#f5f7fa",
    "--bg-sidebar": "#1e293b",
    "--bg-subtle": "rgba(0,0,0,0.04)",
    "--bg-inset": "rgba(0,0,0,0.02)",
    "--border": "#e2e8f0",
    "--border-light": "#cbd5e1",
    "--text-primary": "#1e293b",
    "--text-secondary": "#475569",
    "--text-muted": "#94a3b8",
    "--green": "#16a34a",
    "--green-dim": "rgba(22,163,74,0.10)",
    "--yellow": "#ca8a04",
    "--yellow-dim": "rgba(202,138,4,0.10)",
    "--orange": "#ea580c",
    "--orange-dim": "rgba(234,88,12,0.10)",
    "--red": "#dc2626",
    "--red-dim": "rgba(220,38,38,0.10)",
    "--blue": "#2563eb",
    "--blue-dim": "rgba(37,99,235,0.08)",
    "--purple": "#7c3aed",
    "--purple-dim": "rgba(124,58,237,0.08)",
    "--cyan": "#0891b2",
    "--shadow": "0 4px 24px rgba(0,0,0,0.08)",
  },
  material: {
    "--bg-primary": "#fafafa",
    "--bg-secondary": "#ffffff",
    "--bg-card": "#ffffff",
    "--bg-card-hover": "#f5f5f5",
    "--bg-sidebar": "#1a237e",
    "--bg-subtle": "rgba(0,0,0,0.05)",
    "--bg-inset": "rgba(0,0,0,0.03)",
    "--border": "#e0e0e0",
    "--border-light": "#bdbdbd",
    "--text-primary": "#212121",
    "--text-secondary": "#616161",
    "--text-muted": "#9e9e9e",
    "--green": "#2e7d32",
    "--green-dim": "rgba(46,125,50,0.10)",
    "--yellow": "#f9a825",
    "--yellow-dim": "rgba(249,168,37,0.10)",
    "--orange": "#ef6c00",
    "--orange-dim": "rgba(239,108,0,0.10)",
    "--red": "#c62828",
    "--red-dim": "rgba(198,40,40,0.10)",
    "--blue": "#1565c0",
    "--blue-dim": "rgba(21,101,192,0.08)",
    "--purple": "#6a1b9a",
    "--purple-dim": "rgba(106,27,154,0.08)",
    "--cyan": "#00838f",
    "--shadow": "0 2px 12px rgba(0,0,0,0.12)",
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem("sp-theme") as ThemeName) || "dark";
  });

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem("sp-theme", t);
  };

  useEffect(() => {
    const vars = THEMES[theme];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
