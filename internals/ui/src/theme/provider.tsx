/** @jsxImportSource @semajsx/dom */

/**
 * ThemeProvider component
 *
 * Wraps the application to provide theme context and inject CSS custom properties.
 * Components can access theme tokens via ctx.inject(ThemeContext).
 *
 * @example
 * ```tsx
 * import { ThemeProvider } from "@semajsx/ui/theme";
 *
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <Button>Themed button</Button>
 *     </ThemeProvider>
 *   );
 * }
 *
 * // With dark theme
 * <ThemeProvider theme="dark">
 *   <App />
 * </ThemeProvider>
 * ```
 */

import { context, Context } from "@semajsx/core";
import type { ContextType, JSXNode } from "@semajsx/core";
import { inject } from "@semajsx/style";
import { tokens } from "./tokens";
import { lightTheme, darkTheme } from "./themes";

/**
 * Theme context value provided to components
 */
export interface ThemeContextValue {
  /** The token refs for building custom styles */
  tokens: typeof tokens;
}

/**
 * Context for passing theme tokens through the component tree
 */
export const ThemeContext: ContextType<ThemeContextValue> =
  context<ThemeContextValue>("semajsx-theme");

interface ThemeProviderProps {
  /** Which built-in theme to apply: "light" (default) or "dark" */
  theme?: "light" | "dark";
  children?: JSXNode;
}

/**
 * ThemeProvider injects the base theme CSS variables and provides
 * token refs to descendant components via context.
 */
export function ThemeProvider(props: ThemeProviderProps): JSXNode {
  // Inject the base theme (light) CSS variables to :root
  inject(lightTheme);

  // If dark, also inject the dark theme class
  if (props.theme === "dark") {
    inject(darkTheme);
  }

  const value: ThemeContextValue = { tokens };

  return (
    <Context provide={[ThemeContext, value]}>
      <div class={props.theme === "dark" ? darkTheme : undefined}>{props.children}</div>
    </Context>
  );
}
