import { signal, type WritableSignal } from "@semajsx/signal";
import type { KeyEvent, KeyHandler } from "./keyboard";
import type { TerminalRenderer } from "./renderer";

/**
 * Per-render session that holds all mutable state for a terminal render instance.
 *
 * Named "TerminalSession" to distinguish from core's ContextMap (provide/inject).
 * ContextMap is for component dependency injection; TerminalSession is for
 * render lifecycle state (keyboard, cleanup, exit coordination).
 */
export interface TerminalSession {
  /** Keyboard listener callbacks */
  keyboardListeners: KeyHandler[];
  /** Signal holding the last keypress event */
  lastKeySignal: WritableSignal<KeyEvent | null>;
  /** Whether the keyboard handler is installed on stdin */
  keyboardInstalled: boolean;
  /** The stdin data handler (if installed) */
  stdinHandler: ((data: Buffer) => void) | null;
  /** Exit callback for useExit() */
  exitCallback: (() => void) | null;
  /** Signal for ExitHint component coordination */
  exitingSignal: WritableSignal<boolean>;
  /** Renderer instance for static output */
  renderer: TerminalRenderer | null;
}

/**
 * The active terminal session. Set by render(), cleared on unmount.
 */
let activeSession: TerminalSession | null = null;

/**
 * Create a fresh terminal session
 */
export function createTerminalSession(): TerminalSession {
  return {
    keyboardListeners: [],
    lastKeySignal: signal(null),
    keyboardInstalled: false,
    stdinHandler: null,
    exitCallback: null,
    exitingSignal: signal(false),
    renderer: null,
  };
}

/**
 * Set the active terminal session
 */
export function setActiveSession(session: TerminalSession | null): void {
  activeSession = session;
}

/**
 * Get the active terminal session, or null if no render is active
 */
export function getActiveSession(): TerminalSession | null {
  return activeSession;
}
