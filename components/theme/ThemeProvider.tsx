"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const STORAGE_KEY = "retailos:theme:v1";
const ThemeContext = createContext<ThemeContextValue | null>(null);
const listeners = new Set<() => void>();

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

function getSnapshot(): Theme {
  if (typeof document === "undefined") return "dark";
  const appliedTheme = document.documentElement.dataset.theme;
  if (isTheme(appliedTheme)) return appliedTheme;
  try {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(savedTheme) ? savedTheme : "dark";
  } catch {
    return "dark";
  }
}

function getServerSnapshot(): Theme {
  return "dark";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The theme still works for this page session when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Re-apply the resolved preference after hydration so the CSS root and React state cannot drift apart.
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    applyTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={theme === "light"}
      title={`Switch to ${nextTheme} theme`}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "min-w-10 header-theme-toggle" : ""}`}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      <span>{compact ? (theme === "dark" ? "Light" : "Dark") : `${theme === "dark" ? "Light" : "Dark"} theme`}</span>
    </button>
  );
}
