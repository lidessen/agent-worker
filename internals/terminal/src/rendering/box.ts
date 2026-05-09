import chalk from "chalk";
import cliBoxes from "cli-boxes";
import type { TerminalElement } from "../types";
import { getChalkColor, getChalkBgColor } from "../utils/colors";

/**
 * Render a border around an element
 */
export function renderBorder(
  node: TerminalElement,
  writeAt: (x: number, y: number, text: string) => void,
): void {
  const { style, x = 0, y = 0, width = 0, height = 0 } = node;
  const boxStyle = style.border || "single";

  if (boxStyle === "none") return;

  const box = cliBoxes[boxStyle] || cliBoxes.single;
  let borderChar = chalk;

  if (style.borderColor) {
    borderChar = getChalkColor(style.borderColor);
  }

  // Top border
  const topLine = borderChar(box.topLeft + box.top.repeat(Math.max(0, width - 2)) + box.topRight);
  writeAt(x, y, topLine);

  // Side borders with spacing
  for (let i = 1; i < height - 1; i++) {
    // Render left border, middle spaces, and right border as a single line
    const middleSpaces = " ".repeat(Math.max(0, width - 2));
    const sideLine = borderChar(box.left) + middleSpaces + borderChar(box.right);
    writeAt(x, y + i, sideLine);
  }

  // Bottom border
  if (height > 1) {
    const bottomLine = borderChar(
      box.bottomLeft + box.bottom.repeat(Math.max(0, width - 2)) + box.bottomRight,
    );
    writeAt(x, y + height - 1, bottomLine);
  }
}

/**
 * Render background color
 */
export function renderBackground(
  node: TerminalElement,
  writeAt: (x: number, y: number, text: string) => void,
): void {
  const { style, x = 0, y = 0, width = 0, height = 0 } = node;

  if (!style.backgroundColor) return;

  const bg = getChalkBgColor(style.backgroundColor);

  for (let i = 0; i < height; i++) {
    const line = bg(" ".repeat(width));
    writeAt(x, y + i, line);
  }
}
