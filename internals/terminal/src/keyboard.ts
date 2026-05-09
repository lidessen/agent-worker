import { signal, type ReadableSignal } from "@semajsx/signal";
import { getActiveSession } from "./context";

/**
 * Represents a parsed keyboard event
 */
export interface KeyEvent {
  /** The raw character or key name */
  key: string;
  /** Whether Ctrl was held */
  ctrl: boolean;
  /** Whether Shift was held (inferred from uppercase for letters) */
  shift: boolean;
  /** Whether Meta/Alt was held */
  meta: boolean;
  /** The raw input string from stdin */
  raw: string;
}

/**
 * Keyboard handler callback
 */
export type KeyHandler = (event: KeyEvent) => void;

/**
 * Parse raw stdin data into a KeyEvent
 */
export function parseKeyEvent(data: Buffer): KeyEvent {
  const raw = data.toString();
  const event: KeyEvent = {
    key: "",
    ctrl: false,
    shift: false,
    meta: false,
    raw,
  };

  // ESC sequences
  if (raw === "\u001b[A") {
    event.key = "up";
    return event;
  }
  if (raw === "\u001b[B") {
    event.key = "down";
    return event;
  }
  if (raw === "\u001b[C") {
    event.key = "right";
    return event;
  }
  if (raw === "\u001b[D") {
    event.key = "left";
    return event;
  }
  if (raw === "\u001b[H" || raw === "\u001b[1~") {
    event.key = "home";
    return event;
  }
  if (raw === "\u001b[F" || raw === "\u001b[4~") {
    event.key = "end";
    return event;
  }
  if (raw === "\u001b[5~") {
    event.key = "pageup";
    return event;
  }
  if (raw === "\u001b[6~") {
    event.key = "pagedown";
    return event;
  }
  if (raw === "\u001b[3~") {
    event.key = "delete";
    return event;
  }
  if (raw === "\u001b[2~") {
    event.key = "insert";
    return event;
  }

  // Meta/Alt + key (ESC followed by a character)
  if (raw.length === 2 && raw[0] === "\u001b") {
    event.meta = true;
    event.key = raw[1]!;
    return event;
  }

  // Single ESC
  if (raw === "\u001b") {
    event.key = "escape";
    return event;
  }

  // Ctrl+C
  if (raw === "\u0003") {
    event.key = "c";
    event.ctrl = true;
    return event;
  }

  // Enter / Return
  if (raw === "\r" || raw === "\n") {
    event.key = "return";
    return event;
  }

  // Tab
  if (raw === "\t") {
    event.key = "tab";
    return event;
  }

  // Backspace
  if (raw === "\u007f" || raw === "\u0008") {
    event.key = "backspace";
    return event;
  }

  // Space
  if (raw === " ") {
    event.key = "space";
    return event;
  }

  // Ctrl+A through Ctrl+Z (except Ctrl+C handled above)
  if (raw.length === 1) {
    const code = raw.charCodeAt(0);
    if (code >= 1 && code <= 26) {
      event.ctrl = true;
      event.key = String.fromCharCode(code + 96); // a-z
      return event;
    }
  }

  // Regular character
  if (raw.length === 1) {
    event.key = raw;
    // Infer shift from uppercase letter
    if (raw >= "A" && raw <= "Z") {
      event.shift = true;
    }
    return event;
  }

  // Fallback
  event.key = raw;
  return event;
}

/**
 * Install the keyboard handler on stdin for the active render context.
 * Called automatically by render() when setting up keyboard input.
 */
export function installKeyboardHandler(): void {
  const ctx = getActiveSession();
  if (!ctx || ctx.keyboardInstalled) return;
  ctx.keyboardInstalled = true;

  ctx.stdinHandler = (data: Buffer) => {
    const event = parseKeyEvent(data);
    ctx.lastKeySignal.value = event;
    // Copy array to avoid mutation during iteration
    const listeners = [...ctx.keyboardListeners];
    for (const listener of listeners) {
      listener(event);
    }
  };

  if (process.stdin.isTTY) {
    process.stdin.on("data", ctx.stdinHandler);
  }
}

/**
 * Uninstall the keyboard handler for the active render context.
 * Called during cleanup/unmount.
 */
export function uninstallKeyboardHandler(): void {
  const ctx = getActiveSession();
  if (!ctx || !ctx.keyboardInstalled) return;
  ctx.keyboardInstalled = false;

  if (ctx.stdinHandler) {
    process.stdin.removeListener("data", ctx.stdinHandler);
    ctx.stdinHandler = null;
  }

  ctx.keyboardListeners = [];
}

/**
 * Subscribe to keyboard events with a callback.
 * Returns an unsubscribe function.
 *
 * @example
 * ```tsx
 * const unsub = onKeypress((event) => {
 *   if (event.key === "up") moveUp();
 *   if (event.key === "down") moveDown();
 *   if (event.key === "return") confirm();
 * });
 *
 * // Later: unsub();
 * ```
 */
export function onKeypress(handler: KeyHandler): () => void {
  const ctx = getActiveSession();
  if (!ctx) return () => {};

  ctx.keyboardListeners.push(handler);
  installKeyboardHandler();

  return () => {
    const idx = ctx.keyboardListeners.indexOf(handler);
    if (idx !== -1) {
      ctx.keyboardListeners.splice(idx, 1);
    }
  };
}

/**
 * Get a readonly signal of the last keypress event.
 * Useful for reactive UIs that need to respond to any key.
 *
 * @example
 * ```tsx
 * const lastKey = useKeypress();
 * // lastKey.value is null initially, then updated on each keypress
 * ```
 */
export function useKeypress(): ReadableSignal<KeyEvent | null> {
  const ctx = getActiveSession();
  if (!ctx) {
    // Return a dead signal if no render context is active
    return signal(null);
  }
  installKeyboardHandler();
  return ctx.lastKeySignal;
}
