/**
 * Lidessen design tokens for @agent-worker/web
 *
 * Monochrome oklch palette, Geist + Noto Sans SC typography.
 * Light is the base theme; dark is applied by toggling darkThemeClass
 * on <html> based on the user's system preference.
 *
 * All components reference tokens via CSS custom properties so the
 * swap happens at the CSS variable layer — no component changes needed.
 */

import { defineTokens, createTheme, inject } from "semajsx/style";
import type { TokenRefs } from "semajsx/style";

const tokenDefinition = {
  colors: {
    background: "oklch(1 0 0)",
    backgroundElevated: "oklch(0.985 0 0)",
    surface: "oklch(0.985 0 0)",
    surfaceHover: "oklch(0.965 0 0)",
    surfaceActive: "oklch(0.94 0 0)",
    surfaceSecondary: "oklch(0.985 0 0)",
    surfaceTertiary: "oklch(0.975 0 0)",
    border: "oklch(0 0 0 / 0.08)",
    borderSubtle: "oklch(0 0 0 / 0.05)",
    borderStrong: "oklch(0 0 0 / 0.16)",
    borderHover: "oklch(0 0 0 / 0.22)",
    text: "oklch(0.145 0 0)",
    textMuted: "oklch(0.38 0 0)",
    textDim: "oklch(0.55 0 0)",

    primary: "oklch(0.145 0 0)",
    primaryHover: "oklch(0.24 0 0)",
    accent: "oklch(0.145 0 0)",
    accentSoft: "oklch(0.145 0 0 / 0.08)",
    panel: "oklch(1 0 0)",
    panelHover: "oklch(0.985 0 0)",
    panelStrong: "oklch(0.965 0 0)",
    input: "oklch(1 0 0)",
    badge: "oklch(0.985 0 0)",
    surfaceOverlay: "oklch(0 0 0 / 0.04)",
    headerSheen: "linear-gradient(180deg, oklch(0 0 0 / 0.03) 0%, transparent 100%)",
    overlayScrim: "oklch(0.145 0 0 / 0.48)",
    selectionBg: "oklch(0.75 0.16 240 / 0.3)",
    selectionText: "oklch(0.145 0 0)",
    scrollbarThumb: "oklch(0 0 0 / 0.16)",
    buttonPrimary: "oklch(0.145 0 0)",
    buttonPrimaryHover: "oklch(0.24 0 0)",
    buttonPrimaryText: "oklch(0.985 0 0)",
    buttonPrimaryBorder: "oklch(0 0 0 / 0.08)",
    successTextStrong: "oklch(0.48 0.14 150)",
    successBorder: "oklch(0.58 0.14 150 / 0.3)",
    warningBorder: "oklch(0.62 0.14 65 / 0.3)",
    dangerBorder: "oklch(0.58 0.18 25 / 0.3)",
    dangerSurface: "oklch(0.58 0.18 25 / 0.08)",
    warningSurface: "oklch(0.62 0.14 65 / 0.08)",
    successSurface: "oklch(0.58 0.14 150 / 0.08)",

    success: "oklch(0.58 0.14 150)",
    warning: "oklch(0.62 0.14 65)",
    danger: "oklch(0.58 0.18 25)",

    agentIdle: "oklch(0.72 0 0)",
    agentRunning: "oklch(0.58 0.14 150)",
    agentProcessing: "oklch(0.55 0.14 240)",
    agentError: "oklch(0.58 0.18 25)",
    agentCompleted: "oklch(0.58 0.14 150)",
  },

  space: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    xxl: "2rem",
    xxxl: "3rem",
  },

  radii: {
    sm: "4px",
    md: "6px",
    lg: "9px",
    xl: "12px",
    xxl: "16px",
    pill: "9999px",
  },

  fonts: {
    base: '"Geist", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    mono: '"Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace',
  },

  fontSizes: {
    xxs: "0.6875rem",
    xs: "0.75rem",
    sm: "0.8125rem",
    md: "0.875rem",
    lg: "1rem",
    xl: "1.5rem",
    xxl: "2rem",
  },

  fontWeights: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  transitions: {
    fast: "120ms cubic-bezier(0.2, 0, 0, 1)",
    normal: "220ms cubic-bezier(0.2, 0, 0, 1)",
  },

  shadows: {
    panel: "0 1px 2px oklch(0 0 0 / 0.04), 0 2px 6px oklch(0 0 0 / 0.06)",
    inset: "inset 0 1px 0 oklch(1 0 0 / 0.6)",
    glow: "0 0 0 1px oklch(0 0 0 / 0.05)",
    focusRing: "0 0 0 3px oklch(0 0 0 / 0.1)",
  },
} as const;

export const tokens: TokenRefs<typeof tokenDefinition> = defineTokens(tokenDefinition);

const lightTheme = createTheme(tokens);
const darkTheme = createTheme(tokens, {
  colors: {
    background: "oklch(0.145 0 0)",
    backgroundElevated: "oklch(0.185 0 0)",
    surface: "oklch(0.205 0 0)",
    surfaceHover: "oklch(0.235 0 0)",
    surfaceActive: "oklch(0.265 0 0)",
    surfaceSecondary: "oklch(0.185 0 0)",
    surfaceTertiary: "oklch(0.205 0 0)",
    border: "oklch(1 0 0 / 0.08)",
    borderSubtle: "oklch(1 0 0 / 0.05)",
    borderStrong: "oklch(1 0 0 / 0.16)",
    borderHover: "oklch(1 0 0 / 0.24)",
    text: "oklch(0.985 0 0)",
    textMuted: "oklch(0.78 0 0)",
    textDim: "oklch(0.58 0 0)",
    primary: "oklch(0.985 0 0)",
    primaryHover: "oklch(0.92 0 0)",
    accent: "oklch(0.985 0 0)",
    accentSoft: "oklch(1 0 0 / 0.08)",
    panel: "oklch(0.185 0 0)",
    panelHover: "oklch(0.205 0 0)",
    panelStrong: "oklch(0.235 0 0)",
    input: "oklch(0.185 0 0)",
    badge: "oklch(0.205 0 0)",
    surfaceOverlay: "oklch(1 0 0 / 0.04)",
    headerSheen: "linear-gradient(180deg, oklch(1 0 0 / 0.03) 0%, transparent 100%)",
    overlayScrim: "oklch(0.145 0 0 / 0.72)",
    selectionBg: "oklch(0.75 0.16 240 / 0.3)",
    selectionText: "oklch(0.985 0 0)",
    scrollbarThumb: "oklch(1 0 0 / 0.16)",
    buttonPrimary: "oklch(0.985 0 0)",
    buttonPrimaryHover: "oklch(0.92 0 0)",
    buttonPrimaryText: "oklch(0.145 0 0)",
    buttonPrimaryBorder: "oklch(0 0 0 / 0.4)",
    successTextStrong: "oklch(0.82 0.19 148)",
    successBorder: "oklch(0.78 0.19 148 / 0.3)",
    warningBorder: "oklch(0.82 0.17 78 / 0.3)",
    dangerBorder: "oklch(0.70 0.22 25 / 0.3)",
    dangerSurface: "oklch(0.70 0.22 25 / 0.08)",
    warningSurface: "oklch(0.82 0.17 78 / 0.08)",
    successSurface: "oklch(0.78 0.19 148 / 0.08)",
    success: "oklch(0.78 0.19 148)",
    warning: "oklch(0.82 0.17 78)",
    danger: "oklch(0.70 0.22 25)",
    agentIdle: "oklch(0.42 0 0)",
    agentRunning: "oklch(0.78 0.19 148)",
    agentError: "oklch(0.70 0.22 25)",
    agentCompleted: "oklch(0.78 0.19 148)",
  },
  shadows: {
    panel: "0 1px 2px oklch(0 0 0 / 0.4), 0 2px 6px oklch(0 0 0 / 0.3)",
    inset: "inset 0 1px 0 oklch(1 0 0 / 0.04)",
    glow: "0 0 0 1px oklch(1 0 0 / 0.04)",
    focusRing: "0 0 0 3px oklch(0.985 0 0 / 0.16)",
  },
});

inject(lightTheme);
inject(darkTheme);

import { signal } from "semajsx/signal";

const darkThemeClass = String(darkTheme);

export type ThemeMode = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "aw:theme";

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(THEME_STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export const themeMode = signal<ThemeMode>(readStoredTheme());

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const resolvedTheme = signal<"light" | "dark">(resolve(themeMode.value));

function apply() {
  if (typeof document === "undefined") return;
  const mode = resolvedTheme.value;
  const root = document.documentElement;
  root.classList.toggle(darkThemeClass, mode === "dark");
  root.style.colorScheme = mode;
}

export function setTheme(mode: ThemeMode) {
  themeMode.value = mode;
  if (mode === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
  else window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  resolvedTheme.value = resolve(mode);
}

export function toggleTheme() {
  setTheme(resolvedTheme.value === "dark" ? "light" : "dark");
}

if (typeof window !== "undefined") {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");

  const onSystemChange = () => {
    if (themeMode.value === "system") {
      resolvedTheme.value = resolve("system");
    }
  };
  mql.addEventListener("change", onSystemChange);
  resolvedTheme.subscribe(apply);
  apply();

  // Cleanup on HMR to prevent listener accumulation
  if (import.meta.hot) {
    import.meta.hot.dispose(() => mql.removeEventListener("change", onSystemChange));
  }
}
