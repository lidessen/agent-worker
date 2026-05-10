/**
 * Terminal hooks for interactive CLI applications
 */

import { getActiveSession } from "./context";

/**
 * Set the exit callback on the active render context.
 * Called internally by render().
 */
export function setExitCallback(callback: (() => void) | null): void {
  const ctx = getActiveSession();
  if (ctx) {
    ctx.exitCallback = callback;
  }
}

/**
 * Programmatic exit hook - allows components to trigger unmount.
 *
 * Returns a function that, when called, unmounts the terminal app
 * (equivalent to pressing Ctrl+C).
 *
 * @example
 * ```tsx
 * function App() {
 *   const exit = useExit();
 *
 *   onKeypress((event) => {
 *     if (event.key === "q") exit();
 *   });
 *
 *   return <text>Press q to quit</text>;
 * }
 * ```
 */
export function useExit(): () => void {
  return () => {
    const ctx = getActiveSession();
    if (ctx?.exitCallback) {
      ctx.exitCallback();
    }
  };
}

/**
 * Check whether stdin raw mode is supported and/or active.
 *
 * Useful for graceful degradation in non-TTY environments (CI, pipes).
 *
 * @example
 * ```tsx
 * const { supported, active } = isRawModeSupported();
 * if (!supported) {
 *   print(<text>Interactive mode not available</text>);
 * }
 * ```
 */
export function isRawModeSupported(): { supported: boolean; active: boolean } {
  const supported = Boolean(process.stdin.isTTY && process.stdin.setRawMode);
  const active = supported && Boolean(process.stdin.isRaw);
  return { supported, active };
}
