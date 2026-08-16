import { GlobalTheme, Theme } from "@carbon/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "fdtdTheme";
const THEME_REQUEST_EVENT = "fdtd:theme-request";

type FdtdTheme = "light" | "dark";

const FdtdThemeContext = createContext<{ isDark: boolean; toggleTheme: () => void }>({
  isDark: false,
  toggleTheme: () => undefined,
});

function normalizeTheme(value: unknown): FdtdTheme | null {
  return value === "dark" || value === "g100"
    ? "dark"
    : value === "light" || value === "g10"
      ? "light"
      : null;
}

function initialTheme(): FdtdTheme {
  try {
    return normalizeTheme(window.localStorage.getItem(STORAGE_KEY)) ?? "light";
  } catch {
    return "light";
  }
}

export function FdtdThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<FdtdTheme>(initialTheme);
  const isDark = theme === "dark";
  const carbonTheme = isDark ? "g100" : "g10";

  useEffect(() => {
    const synchronizeTheme = (event: Event) => {
      const requested = normalizeTheme((event as CustomEvent<{ theme?: unknown }>).detail?.theme);
      if (requested) setTheme(requested);
    };
    window.addEventListener(THEME_REQUEST_EVENT, synchronizeTheme);
    return () => window.removeEventListener(THEME_REQUEST_EVENT, synchronizeTheme);
  }, []);

  useEffect(() => {
    const roots = [document.documentElement, document.body];
    roots.forEach((root) => {
      root.classList.remove("cds--white", "cds--g10", "cds--g90", "cds--g100");
      root.classList.add(`cds--${carbonTheme}`);
    });
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.carbonTheme = carbonTheme;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#161616" : "#f4f4f4");
    window.dispatchEvent(new CustomEvent("fdtd:theme-change", { detail: { theme } }));
    window.dispatchEvent(new CustomEvent("fdtd:theme-applied", { detail: { theme } }));
  }, [carbonTheme, isDark, theme]);

  const toggleTheme = () => {
    const nextTheme: FdtdTheme = isDark ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The theme still changes when storage is unavailable.
    }
    setTheme(nextTheme);
  };

  return (
    <FdtdThemeContext.Provider value={{ isDark, toggleTheme }}>
      <GlobalTheme theme={carbonTheme}>
        <Theme theme={carbonTheme} className="fdtd-theme" data-carbon-theme={carbonTheme}>
          {children}
        </Theme>
      </GlobalTheme>
    </FdtdThemeContext.Provider>
  );
}

export function useFdtdTheme() {
  return useContext(FdtdThemeContext);
}
