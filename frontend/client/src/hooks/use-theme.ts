import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("kangpos-theme") as Theme | null;
    return stored ?? "light";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("kangpos-theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggleTheme };
}

export function initTheme() {
  const stored = localStorage.getItem("kangpos-theme") as Theme | null;
  applyTheme(stored ?? "light");
}
