/**
 * Terminal rendering for SemaJSX
 *
 * This module provides terminal/CLI rendering capabilities similar to Ink.
 * It uses Yoga for flexbox layout and renders to stdout/stderr.
 */

export { TerminalRenderer } from "./renderer";
export { render, print } from "./render";
export type { RenderResult, RenderOptions, PrintOptions } from "./render";
export type { TerminalNode, TerminalElement, TerminalText, TerminalStyle } from "./types";
export * from "./operations";
export * from "./properties";
export * from "./rendering";
export * from "./components";
export * from "./utils";

// Keyboard input API
export { onKeypress, useKeypress, parseKeyEvent } from "./keyboard";
export type { KeyEvent, KeyHandler } from "./keyboard";

// Hooks
export { useExit, isRawModeSupported } from "./hooks";

// Re-export helpers for convenience
export { when, resource, stream } from "@semajsx/core";
