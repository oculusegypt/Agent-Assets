import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const LS_THEME   = "acis_ui_theme";
const LS_COMPACT = "acis_ui_sidebar_compact";

type Theme = "dark" | "light";

interface UISettings {
  theme: Theme;
  sidebarCompact: boolean;
  setTheme: (t: Theme) => void;
  setSidebarCompact: (v: boolean) => void;
}

const UICtx = createContext<UISettings>({
  theme: "dark",
  sidebarCompact: false,
  setTheme: () => {},
  setSidebarCompact: () => {},
});

export function useUI() {
  return useContext(UICtx);
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}

async function saveToApi(key: string, value: string) {
  try {
    await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  } catch {}
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(LS_THEME) as Theme) || "dark";
  });
  const [sidebarCompact, setSidebarCompactState] = useState<boolean>(() => {
    return localStorage.getItem(LS_COMPACT) === "true";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    fetch(`${BASE}/api/settings`)
      .then(r => r.json())
      .then(d => {
        const settings: Array<{ key: string; value: string }> = d.settings || [];
        const dbTheme    = settings.find(s => s.key === "ui.theme")?.value as Theme | undefined;
        const dbCompact  = settings.find(s => s.key === "ui.sidebar_compact")?.value;
        const lsTheme    = localStorage.getItem(LS_THEME) as Theme | null;
        const lsCompact  = localStorage.getItem(LS_COMPACT);
        const finalTheme = lsTheme || dbTheme || "dark";
        const finalCompact = lsCompact !== null ? lsCompact === "true" : dbCompact === "true";
        setThemeState(finalTheme);
        setSidebarCompactState(finalCompact);
        applyTheme(finalTheme);
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(LS_THEME, t);
    applyTheme(t);
    saveToApi("ui.theme", t);
  }, []);

  const setSidebarCompact = useCallback((v: boolean) => {
    setSidebarCompactState(v);
    localStorage.setItem(LS_COMPACT, String(v));
    saveToApi("ui.sidebar_compact", String(v));
  }, []);

  return (
    <UICtx.Provider value={{ theme, sidebarCompact, setTheme, setSidebarCompact }}>
      {children}
    </UICtx.Provider>
  );
}
