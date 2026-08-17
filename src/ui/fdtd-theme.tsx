import { useEffect } from "react";
import { useScientificTheme } from "@jorpago2/scientific-ui";

function normalizeTheme(value: unknown) {
  if (value === "dark" || value === "g100") return "dark";
  if (value === "light" || value === "g10") return "light";
  return null;
}

/** Keeps the legacy FDTD canvas/runtime theme protocol in sync with scientific-ui. */
export function FdtdThemeBridge() {
  const { isDark, resolvedTheme, setPreference } = useScientificTheme();
  const theme = isDark ? "dark" : "light";

  useEffect(() => {
    const synchronizeTheme = (event: Event) => {
      const requested = normalizeTheme((event as CustomEvent<{ theme?: unknown }>).detail?.theme);
      if (requested) setPreference(requested);
    };
    window.addEventListener("fdtd:theme-request", synchronizeTheme);
    return () => window.removeEventListener("fdtd:theme-request", synchronizeTheme);
  }, [setPreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.carbonTheme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#161616" : "#f4f4f4");
    window.dispatchEvent(new CustomEvent("fdtd:theme-change", { detail: { theme } }));
    window.dispatchEvent(new CustomEvent("fdtd:theme-applied", { detail: { theme } }));
  }, [isDark, resolvedTheme, theme]);

  return null;
}
