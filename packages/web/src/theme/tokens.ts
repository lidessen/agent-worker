/**
 * Dark-first design tokens for @agent-worker/web
 *
 * All components reference these tokens via CSS custom properties,
 * enabling runtime theme switching.
 */

import { defineTokens, createTheme, inject } from "semajsx/style";
import type { TokenRefs } from "semajsx/style";

const tokenDefinition = {
  colors: {
    background: "#f3f3f3",
    backgroundElevated: "#ffffff",
    surface: "#f8f8f8",
    surfaceHover: "#f1f1f1",
    surfaceActive: "#e8e8e8",
    surfaceSecondary: "#ffffff",
    surfaceTertiary: "#f6f6f6",
    border: "#e1e1e1",
    borderSubtle: "#ececec",
    borderStrong: "#cfcfcf",
    borderHover: "#c5c5c5",
    text: "#1f1f1f",
    textMuted: "#555555",
    textDim: "#777777",

    primary: "#1f1f1f",
    primaryHover: "#000000",
    accent: "#3794ff",
    accentSoft: "rgba(55, 148, 255, 0.14)",
    panel: "#ffffff",
    panelHover: "#f8f8f8",
    panelStrong: "#f1f1f1",
    input: "#ffffff",
    badge: "#f3f3f3",
    surfaceOverlay: "rgba(31, 31, 31, 0.04)",
    headerSheen: "linear-gradient(180deg, rgba(31, 31, 31, 0.03) 0%, transparent 100%)",
    overlayScrim: "rgba(15, 23, 42, 0.24)",
    selectionBg: "rgba(55, 148, 255, 0.3)",
    selectionText: "#ffffff",
    scrollbarThumb: "rgba(121, 121, 121, 0.42)",
    buttonPrimary: "linear-gradient(180deg, #2b2b2b 0%, #1b1b1b 100%)",
    buttonPrimaryHover: "linear-gradient(180deg, #323232 0%, #222222 100%)",
    buttonPrimaryText: "#ffffff",
    buttonPrimaryBorder: "rgba(255, 255, 255, 0.08)",
    successTextStrong: "#1f6f35",
    successBorder: "rgba(56, 142, 60, 0.24)",
    warningBorder: "rgba(191, 102, 0, 0.24)",
    dangerBorder: "rgba(196, 43, 28, 0.24)",
    dangerSurface: "rgba(196, 43, 28, 0.1)",
    warningSurface: "rgba(191, 102, 0, 0.1)",
    successSurface: "rgba(56, 142, 60, 0.1)",

    success: "#388e3c",
    warning: "#bc6c00",
    danger: "#c42b1c",

    agentIdle: "#8a8a8a",
    agentRunning: "#388e3c",
    agentProcessing: "#0a84ff",
    agentError: "#c42b1c",
    agentCompleted: "#388e3c",
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
    sm: "6px",
    md: "8px",
    lg: "10px",
    xl: "14px",
    xxl: "18px",
    pill: "980px",
  },

  fonts: {
    base: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  },

  fontSizes: {
    xxs: "0.6875rem",
    xs: "0.75rem",
    sm: "0.8125rem",
    md: "0.875rem",
    lg: "1rem",
    xl: "1.5rem",
    xxl: "2.5rem",
  },

  fontWeights: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  transitions: {
    fast: "0.15s ease",
    normal: "0.25s cubic-bezier(0.25, 0.1, 0.25, 1)",
  },

  shadows: {
    panel: "0 8px 24px rgba(0, 0, 0, 0.08)",
    inset: "inset 0 1px 0 rgba(255, 255, 255, 0.65)",
    glow: "0 0 0 1px rgba(0, 0, 0, 0.02), 0 8px 24px rgba(0, 0, 0, 0.05)",
    focusRing: "0 0 0 3px rgba(55, 148, 255, 0.18)",
  },
} as const;

export const tokens: TokenRefs<typeof tokenDefinition> = defineTokens(tokenDefinition);

const lightTheme = createTheme(tokens);
const darkTheme = createTheme(tokens, {
  colors: {
    background: "#181818",
    backgroundElevated: "#1f1f1f",
    surface: "#252526",
    surfaceHover: "#2a2d2e",
    surfaceActive: "#313135",
    surfaceSecondary: "#1f1f1f",
    surfaceTertiary: "#2a2a2a",
    border: "#2b2b2b",
    borderSubtle: "#242628",
    borderStrong: "#3a3d41",
    borderHover: "#45494e",
    text: "#cccccc",
    textMuted: "#a9adb3",
    textDim: "#7d8187",
    primary: "#cccccc",
    primaryHover: "#ffffff",
    panel: "#202020",
    panelHover: "#252526",
    panelStrong: "#2a2d2e",
    input: "#1f1f1f",
    badge: "#2a2d2e",
    surfaceOverlay: "rgba(255, 255, 255, 0.04)",
    headerSheen: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%)",
    overlayScrim: "rgba(0, 0, 0, 0.6)",
    selectionBg: "rgba(55, 148, 255, 0.3)",
    selectionText: "#ffffff",
    scrollbarThumb: "rgba(121, 121, 121, 0.42)",
    buttonPrimary: "linear-gradient(180deg, #f6f6f6 0%, #e7e7e7 100%)",
    buttonPrimaryHover: "linear-gradient(180deg, #ffffff 0%, #ededed 100%)",
    buttonPrimaryText: "#111111",
    buttonPrimaryBorder: "rgba(255, 255, 255, 0.28)",
    successTextStrong: "#8be28d",
    successBorder: "rgba(48, 209, 88, 0.24)",
    warningBorder: "rgba(255, 214, 10, 0.16)",
    dangerBorder: "rgba(255, 69, 58, 0.24)",
    dangerSurface: "rgba(244, 71, 71, 0.12)",
    warningSurface: "rgba(255, 204, 2, 0.12)",
    successSurface: "rgba(108, 203, 95, 0.12)",
    success: "#30d158",
    warning: "#ffd60a",
    danger: "#ff453a",
    agentIdle: "#737373",
    agentRunning: "#30d158",
    agentError: "#ff453a",
    agentCompleted: "#30d158",
  },
  shadows: {
    panel: "0 10px 30px rgba(0, 0, 0, 0.2)",
    inset: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
    glow: "0 0 0 1px rgba(255, 255, 255, 0.02), 0 8px 24px rgba(0, 0, 0, 0.16)",
  },
});

inject(lightTheme);
inject(darkTheme);

const darkThemeClass = String(darkTheme);

function applySystemTheme() {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle(darkThemeClass, prefersDark);
  root.style.colorScheme = prefersDark ? "dark" : "light";
}

if (typeof window !== "undefined") {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  applySystemTheme();
  mql.addEventListener("change", applySystemTheme);

  // Cleanup on HMR to prevent listener accumulation
  if (import.meta.hot) {
    import.meta.hot.dispose(() => mql.removeEventListener("change", applySystemTheme));
  }
}
