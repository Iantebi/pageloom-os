"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";
export type Background = "white" | "light-gray" | "warm-gray" | "pageloom-soft" | "dark";
export type Accent = "violet" | "blue" | "green" | "amber" | "rose" | "teal";

export type Appearance = { mode: ThemeMode; background: Background; accent: Accent; highContrast: boolean };

// PageLoom's original, pre-theme-system look: dark mode, its matching dark background, the brand
// purple as accent, high contrast off. `reset()` and every failed localStorage read fall back here.
export const DEFAULT_APPEARANCE: Appearance = { mode: "dark", background: "dark", accent: "violet", highContrast: false };

const STORAGE_KEY = "pageloom.appearance.v1";

// Kept in one place and reused by the inline bootstrap script in layout.tsx (as a literal, since
// that script runs before any module graph exists) - see BOOTSTRAP_SCRIPT below for the twin.
function resolveMode(mode: ThemeMode, systemPrefersDark: boolean): ResolvedMode {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  return mode;
}

function resolveBackground(background: Background, resolved: ResolvedMode): Background {
  // A light background can never pair with dark-mode's dark text, and vice versa - the picker in
  // the settings UI already restricts choices, but this keeps old/corrupt localStorage values safe.
  if (resolved === "dark") return "dark";
  return background === "dark" ? "white" : background;
}

function readStoredAppearance(): Appearance {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    const mode: ThemeMode = parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "system" ? parsed.mode : DEFAULT_APPEARANCE.mode;
    const accent: Accent = (["violet", "blue", "green", "amber", "rose", "teal"] as const).includes(parsed.accent as Accent) ? (parsed.accent as Accent) : DEFAULT_APPEARANCE.accent;
    const background: Background = (["white", "light-gray", "warm-gray", "pageloom-soft", "dark"] as const).includes(parsed.background as Background) ? (parsed.background as Background) : DEFAULT_APPEARANCE.background;
    const highContrast = typeof parsed.highContrast === "boolean" ? parsed.highContrast : DEFAULT_APPEARANCE.highContrast;
    return { mode, background, accent, highContrast };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function writeStoredAppearance(value: Appearance) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Non-critical UI preference - silently keep running with the in-memory value only.
  }
}

function applyToDocument(appearance: Appearance, resolved: ResolvedMode) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.bg = resolveBackground(appearance.background, resolved);
  root.dataset.accent = appearance.accent;
  if (appearance.highContrast) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  root.style.colorScheme = resolved;
  const themeColor = resolved === "dark" ? "#101210" : "#f7f7f5";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", themeColor);
}

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedMode;
  background: Background;
  accent: Accent;
  highContrast: boolean;
  setMode: (mode: ThemeMode) => void;
  setBackground: (background: Background) => void;
  setAccent: (accent: Accent) => void;
  setHighContrast: (value: boolean) => void;
  reset: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializers read localStorage (and the current OS preference) directly on first client
  // render - the inline bootstrap script in <head> already painted the correct theme into the DOM
  // before React ever ran, so this just brings React state into agreement with it immediately,
  // with no extra effect/render pass (and no window access during the server render, since these
  // initializers never run there for a "use client" component in the browser).
  const [appearance, setAppearance] = useState<Appearance>(() => (typeof window === "undefined" ? DEFAULT_APPEARANCE : readStoredAppearance()));
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedMode = resolveMode(appearance.mode, systemPrefersDark);

  useEffect(() => {
    applyToDocument(appearance, resolvedMode);
  }, [appearance, resolvedMode]);

  const update = useCallback((patch: Partial<Appearance>) => {
    setAppearance(previous => {
      const next = { ...previous, ...patch };
      writeStoredAppearance(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode: appearance.mode,
    resolvedMode,
    background: appearance.background,
    accent: appearance.accent,
    highContrast: appearance.highContrast,
    setMode: mode => update({ mode }),
    setBackground: background => update({ background }),
    setAccent: accent => update({ accent }),
    setHighContrast: highContrast => update({ highContrast }),
    reset: () => update(DEFAULT_APPEARANCE),
  }), [appearance, resolvedMode, update]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is missing");
  return value;
}

// Inline, synchronous, dependency-free bootstrap that runs in <head> before first paint (see
// layout.tsx). It duplicates the tiny bit of read/resolve logic above on purpose: this string is
// injected verbatim into the static HTML output, so it can't import from this module - it has to
// be a fully self-contained script. Wrapped in try/catch so a corrupt localStorage value (or
// localStorage being unavailable entirely, e.g. private browsing) never blocks rendering - it
// just falls through to PageLoom's shipped dark default.
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var KEY="${STORAGE_KEY}";var d=document.documentElement;var raw=window.localStorage.getItem(KEY);var a=raw?JSON.parse(raw):null;var mode=(a&&(a.mode==="light"||a.mode==="dark"||a.mode==="system"))?a.mode:"dark";var accent=(a&&["violet","blue","green","amber","rose","teal"].indexOf(a.accent)>-1)?a.accent:"violet";var background=(a&&["white","light-gray","warm-gray","pageloom-soft","dark"].indexOf(a.background)>-1)?a.background:"dark";var highContrast=a?!!a.highContrast:false;var systemDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var resolved=mode==="system"?(systemDark?"dark":"light"):mode;d.dataset.theme=resolved;d.dataset.bg=resolved==="dark"?"dark":(background==="dark"?"white":background);d.dataset.accent=accent;if(highContrast)d.dataset.contrast="high";d.style.colorScheme=resolved;var m=document.querySelector('meta[name="theme-color"]');var c=resolved==="dark"?"#101210":"#f7f7f5";if(m)m.setAttribute("content",c)}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.dataset.bg="dark";document.documentElement.dataset.accent="violet"}})();`;
