import chalk from "chalk";
import stringWidth from "string-width";
import sliceAnsi from "slice-ansi";
import type { TerminalElement, TerminalText } from "../types";
import { collectText } from "../operations";
import { getChalkColor } from "../utils/colors";

/**
 * Render a text node
 */
export function renderTextNode(
  node: TerminalText,
  writeAt: (x: number, y: number, text: string) => void,
  terminalWidth: number,
): void {
  const { content, x = 0, y = 0, width = 0 } = node;

  let text = content;
  const maxWidth = width || terminalWidth - x;

  // Truncate if needed
  if (stringWidth(text) > maxWidth) {
    text = sliceAnsi(text, 0, maxWidth);
  }

  // Write to buffer at position
  writeAt(x, y, text);
}

/**
 * Render a text element (collects and styles all text content)
 */
export function renderTextElement(
  node: TerminalElement,
  writeAt: (x: number, y: number, text: string) => void,
): void {
  const { style, x = 0, y = 0 } = node;

  const text = collectText(node);
  if (!text) return;

  // Apply text styling
  let styledText = text;
  if (style.color) {
    styledText = getChalkColor(style.color)(styledText);
  }
  if (style.bold) {
    styledText = chalk.bold(styledText);
  }
  if (style.italic) {
    styledText = chalk.italic(styledText);
  }
  if (style.underline) {
    styledText = chalk.underline(styledText);
  }
  if (style.strikethrough) {
    styledText = chalk.strikethrough(styledText);
  }
  if (style.dim) {
    styledText = chalk.dim(styledText);
  }

  writeAt(x, y, styledText);
}
