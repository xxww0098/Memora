import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "memora_theme";

/** Resolve the effective theme (light | dark) based on mode */
function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyTheme(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored ?? "system";
  });

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
    applyTheme(resolveTheme(m));
  }, []);

  // Apply on mount + listen for system preference changes
  useEffect(() => {
    applyTheme(resolveTheme(mode));

    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(resolveTheme("system"));
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  return { mode, setMode, resolved: resolveTheme(mode) };
}
