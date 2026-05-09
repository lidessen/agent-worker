/** @jsxImportSource @semajsx/terminal */
import { computed, signal } from "@semajsx/signal";
import type { ReadableSignal } from "@semajsx/signal";
import type { JSXNode, RuntimeComponent, WritableSignal } from "@semajsx/core";
import { onKeypress } from "../keyboard";

export interface TextInputProps {
  /**
   * Writable signal holding the current input value.
   * The component reads and writes this signal directly.
   */
  value: WritableSignal<string>;
  /**
   * Callback when Enter is pressed.
   */
  onSubmit?: (value: string) => void;
  /**
   * Callback when value changes (in addition to updating the signal).
   */
  onChange?: (value: string) => void;
  /**
   * Text to display when value is empty.
   */
  placeholder?: string;
  /**
   * Whether the input is focused and accepts keyboard events.
   * @default true
   */
  focus?: boolean;
  /**
   * Whether to show cursor and allow navigation with arrow keys.
   * @default true
   */
  showCursor?: boolean;
  /**
   * Replace each character with the mask string. Useful for passwords.
   */
  mask?: string;
  /**
   * Color of the input text.
   */
  color?: string;
  /**
   * Color of the placeholder text.
   * @default "gray"
   */
  placeholderColor?: string;
}

const SPECIAL_KEYS = new Set([
  "up",
  "down",
  "pageup",
  "pagedown",
  "tab",
  "escape",
  "delete",
  "insert",
  "home",
  "end",
]);

/**
 * TextInput component — a single-line text input for terminal UIs.
 *
 * Accepts a WritableSignal for the value, making it reactive and
 * compatible with semajsx's signal-based architecture.
 *
 * @example
 * ```tsx
 * const query = signal("");
 * <TextInput value={query} onSubmit={(v) => search(v)} />
 * ```
 *
 * @example
 * ```tsx
 * // Password input
 * const password = signal("");
 * <TextInput value={password} mask="*" />
 * ```
 *
 * @example
 * ```tsx
 * // With placeholder
 * const name = signal("");
 * <TextInput value={name} placeholder="Type something..." />
 * ```
 */
export const TextInput: RuntimeComponent<TextInputProps> = (
  {
    value,
    onSubmit,
    onChange,
    placeholder,
    focus = true,
    showCursor = true,
    mask,
    color,
    placeholderColor = "gray",
  }: TextInputProps,
  ctx,
): JSXNode => {
  const cursorOffset = signal(value.value.length);

  // Clamp cursor when value changes externally (e.g. parent resets to "")
  const unsubValue = value.subscribe((val) => {
    if (cursorOffset.value > val.length) {
      cursorOffset.value = val.length;
    }
  });
  ctx.onCleanup(unsubValue);

  const unsub = onKeypress((event) => {
    if (!focus) return;

    const current = value.value;

    if (event.key === "return") {
      onSubmit?.(current);
      return;
    }

    if (event.key === "left" && showCursor) {
      cursorOffset.value = Math.max(0, cursorOffset.value - 1);
      return;
    }

    if (event.key === "right" && showCursor) {
      cursorOffset.value = Math.min(current.length, cursorOffset.value + 1);
      return;
    }

    if ((event.key === "home" || (event.ctrl && event.key === "a")) && showCursor) {
      cursorOffset.value = 0;
      return;
    }

    if ((event.key === "end" || (event.ctrl && event.key === "e")) && showCursor) {
      cursorOffset.value = current.length;
      return;
    }

    if (event.key === "backspace") {
      if (cursorOffset.value > 0) {
        const before = current.slice(0, cursorOffset.value - 1);
        const after = current.slice(cursorOffset.value);
        cursorOffset.value = Math.max(0, cursorOffset.value - 1);
        const next = before + after;
        value.value = next;
        onChange?.(next);
      }
      return;
    }

    if (event.key === "delete") {
      if (cursorOffset.value < current.length) {
        const before = current.slice(0, cursorOffset.value);
        const after = current.slice(cursorOffset.value + 1);
        const next = before + after;
        value.value = next;
        onChange?.(next);
      }
      return;
    }

    // Ctrl+U: clear line before cursor
    if (event.ctrl && event.key === "u") {
      const after = current.slice(cursorOffset.value);
      cursorOffset.value = 0;
      value.value = after;
      onChange?.(after);
      return;
    }

    // Ctrl+K: clear line after cursor
    if (event.ctrl && event.key === "k") {
      const next = current.slice(0, cursorOffset.value);
      value.value = next;
      onChange?.(next);
      return;
    }

    // Skip special keys and ctrl/meta combos
    if (event.ctrl || event.meta) return;
    if (SPECIAL_KEYS.has(event.key)) return;

    // Insert printable characters (single char, IME multi-char, space)
    const char = event.key === "space" ? " " : event.key;
    if (char) {
      const before = current.slice(0, cursorOffset.value);
      const after = current.slice(cursorOffset.value);
      cursorOffset.value += char.length;
      const next = before + char + after;
      value.value = next;
      onChange?.(next);
    }
  });

  ctx.onCleanup(unsub);

  // Build the display string with cursor — reactive via signals
  const display = computed([value, cursorOffset], (val: string, offset: number) => {
    // Empty: show placeholder
    if (!val && !focus) {
      return placeholder
        ? `\x1b[${placeholderColorCode(placeholderColor)}m${placeholder}\x1b[0m`
        : "";
    }

    if (!val && placeholder && focus) {
      if (!showCursor) {
        return `\x1b[${placeholderColorCode(placeholderColor)}m${placeholder}\x1b[0m`;
      }
      // Show cursor on first placeholder character
      const first = placeholder[0] ?? " ";
      const rest = placeholder.slice(1);
      return `\x1b[7m${first}\x1b[0m\x1b[${placeholderColorCode(placeholderColor)}m${rest}\x1b[0m`;
    }

    const displayValue = mask ? mask.repeat(val.length) : val;

    if (!showCursor || !focus) {
      return displayValue;
    }

    // Render with cursor (inverse char at cursor position)
    const clampedOffset = Math.min(offset, displayValue.length);
    const before = displayValue.slice(0, clampedOffset);
    const cursorChar = clampedOffset < displayValue.length ? displayValue[clampedOffset] : " ";
    const after = displayValue.slice(clampedOffset + 1);
    return `${before}\x1b[7m${cursorChar}\x1b[0m${after}`;
  });

  return <text color={color}>{display as ReadableSignal<string>}</text>;
};

function placeholderColorCode(color: string): string {
  const codes: Record<string, string> = {
    black: "30",
    red: "31",
    green: "32",
    yellow: "33",
    blue: "34",
    magenta: "35",
    cyan: "36",
    white: "37",
    gray: "90",
    grey: "90",
  };
  return codes[color] ?? "90";
}
