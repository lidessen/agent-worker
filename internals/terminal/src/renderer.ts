import Yoga from "yoga-layout-prebuilt";
import ansiEscapes from "ansi-escapes";
import stringWidth from "string-width";
import sliceAnsi from "slice-ansi";
import type { TerminalNode, TerminalElement, TerminalText, TerminalRoot } from "./types";
import { renderBorder, renderBackground, renderTextNode, renderTextElement } from "./rendering";

/**
 * Terminal renderer instance
 */
export class TerminalRenderer {
  private root: TerminalRoot;
  private buffer: string[] = [];
  private previousOutput: string = "";
  private lastOutputHeight: number = 0;
  private resizeHandler: (() => void) | null = null;
  private resizeCallback: (() => void) | null = null;

  constructor(stream: NodeJS.WriteStream = process.stdout) {
    this.root = {
      type: "root",
      stream,
      parent: null,
      children: [],
      yogaNode: Yoga.Node.create(),
    };

    // Set root dimensions to terminal size
    const { columns, rows } = stream;
    if (this.root.yogaNode) {
      this.root.yogaNode.setWidth(columns || 80);
      this.root.yogaNode.setHeight(rows || 24);
      // Set default flexbox properties to prevent children from stretching
      this.root.yogaNode.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
      this.root.yogaNode.setAlignItems(Yoga.ALIGN_FLEX_START);
    }

    // Hide cursor for cleaner rendering
    this.root.stream.write(ansiEscapes.cursorHide);

    // Listen for terminal resize events to update root dimensions and re-render
    this.resizeHandler = () => {
      const { columns, rows } = this.root.stream;
      if (this.root.yogaNode) {
        this.root.yogaNode.setWidth(columns || 80);
        this.root.yogaNode.setHeight(rows || 24);
      }
      // Trigger re-render if callback is registered
      if (this.resizeCallback) {
        this.resizeCallback();
      }
    };
    this.root.stream.on("resize", this.resizeHandler);
  }

  /**
   * Set a callback to be called on terminal resize (triggers re-render).
   */
  setResizeCallback(callback: (() => void) | null): void {
    this.resizeCallback = callback;
  }

  /**
   * Get the root node
   */
  getRoot(): TerminalRoot {
    return this.root;
  }

  /**
   * Render the tree to terminal
   */
  render(): void {
    // Calculate layout
    if (this.root.yogaNode) {
      this.root.yogaNode.calculateLayout(
        this.root.stream.columns || 80,
        this.root.stream.rows || 24,
        Yoga.DIRECTION_LTR,
      );
    }

    // Update positions
    this.updatePositions(this.root, 0, 0);

    // Render to buffer
    this.buffer = [];
    const height = this.root.stream.rows || 24;
    for (let i = 0; i < height; i++) {
      this.buffer[i] = "";
    }

    // Render children
    for (const child of this.root.children) {
      this.renderNode(child);
    }

    // Output to terminal
    this.output();
  }

  /**
   * Update positions of nodes based on yoga layout
   */
  private updatePositions(node: TerminalNode, parentX: number, parentY: number): void {
    if (node.yogaNode) {
      node.x = Math.round(parentX + node.yogaNode.getComputedLeft());
      node.y = Math.round(parentY + node.yogaNode.getComputedTop());
      node.width = Math.round(node.yogaNode.getComputedWidth());
      node.height = Math.round(node.yogaNode.getComputedHeight());

      // If this element has a border, add border size to width/height
      // and offset children by 1 to account for border thickness
      let childOffsetX = node.x || 0;
      let childOffsetY = node.y || 0;

      if (node.type === "element" && node.style.border && node.style.border !== "none") {
        // Expand width and height to include border (1 char on each side)
        node.width += 2;
        node.height += 2;
        // Offset children by 1 to leave room for border
        childOffsetX += 1;
        childOffsetY += 1;
      }

      for (const child of node.children) {
        this.updatePositions(child, childOffsetX, childOffsetY);
      }
    } else {
      // Text nodes don't have yoga nodes - inherit parent position
      node.x = parentX;
      node.y = parentY;

      for (const child of node.children) {
        this.updatePositions(child, parentX, parentY);
      }
    }
  }

  /**
   * Render a single node
   */
  private renderNode(node: TerminalNode): void {
    if (node.type === "text") {
      this.renderText(node);
    } else if (node.type === "element") {
      this.renderElement(node);
    }
  }

  /**
   * Render a text node
   */
  private renderText(node: TerminalText): void {
    const { y = 0, x = 0 } = node;

    if (y >= this.buffer.length || x < 0) return;

    renderTextNode(node, this.writeAt.bind(this), this.root.stream.columns || 80);
  }

  /**
   * Render an element node
   */
  private renderElement(node: TerminalElement): void {
    const { style, tagName } = node;

    // Render border if specified
    if (style.border && style.border !== "none") {
      renderBorder(node, this.writeAt.bind(this));
    }

    // Render background
    if (style.backgroundColor) {
      renderBackground(node, this.writeAt.bind(this));
    }

    // For text elements, collect and render all text content at once
    if (tagName === "text") {
      renderTextElement(node, this.writeAt.bind(this));
    } else {
      // For other elements, render children normally
      for (const child of node.children) {
        this.renderNode(child);
      }
    }
  }

  /**
   * Write text at a specific position in the buffer
   */
  private writeAt(x: number, y: number, text: string): void {
    if (y < 0 || y >= this.buffer.length) return;

    const row = this.buffer[y] || "";
    const width = stringWidth(text);
    const rowWidth = stringWidth(row);

    // Pad row if needed
    if (rowWidth < x) {
      this.buffer[y] = row + " ".repeat(x - rowWidth) + text;
    } else {
      // Replace characters at position
      this.buffer[y] = sliceAnsi(row, 0, x) + text + sliceAnsi(row, x + width);
    }
  }

  /**
   * Output the buffer to terminal
   */
  private output(): void {
    // Remove trailing empty lines from buffer (only output actual content)
    let lastNonEmptyIndex = -1;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const line = this.buffer[i];
      if (line && line.trim() !== "") {
        lastNonEmptyIndex = i;
        break;
      }
    }

    // Get only the lines with content
    const contentLines = lastNonEmptyIndex >= 0 ? this.buffer.slice(0, lastNonEmptyIndex + 1) : [];
    const output = contentLines.join("\n");

    // Only update if changed
    if (output !== this.previousOutput) {
      // Erase previous output if there was any
      // eraseLines moves cursor up and erases, so we're ready to write at the start position
      if (this.lastOutputHeight > 0) {
        this.root.stream.write(ansiEscapes.eraseLines(this.lastOutputHeight));
      }

      // Write new output (cursor is already at the right position after eraseLines)
      this.root.stream.write(output);

      // Calculate and store output height (number of actual lines rendered)
      this.lastOutputHeight = contentLines.length;
      this.previousOutput = output;
    }
  }

  /**
   * Commit text permanently above the dynamic render area.
   *
   * The committed lines are written to stdout and will NOT be erased
   * on subsequent re-renders. The dynamic content renders below them.
   *
   * Used by the Static component to permanently output completed items.
   */
  commitStaticOutput(lines: string): void {
    // Erase current dynamic output
    if (this.lastOutputHeight > 0) {
      this.root.stream.write(ansiEscapes.eraseLines(this.lastOutputHeight));
    }

    // Write static content permanently (with trailing newline)
    this.root.stream.write(lines + "\n");

    // Re-write dynamic output below
    if (this.previousOutput) {
      this.root.stream.write(this.previousOutput);
    }
  }

  /**
   * Clear the rendered output
   */
  clear(): void {
    if (this.lastOutputHeight > 0) {
      this.root.stream.write(ansiEscapes.eraseLines(this.lastOutputHeight));
      this.lastOutputHeight = 0;
    }
    this.previousOutput = "";
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Final render to ensure latest state is shown
    this.render();

    // Move cursor to line after output
    this.root.stream.write("\n");

    // Show cursor again on cleanup
    this.root.stream.write(ansiEscapes.cursorShow);

    // Remove resize listener
    if (this.resizeHandler) {
      this.root.stream.removeListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }

    // Free yoga layout
    if (this.root.yogaNode) {
      this.root.yogaNode.freeRecursive();
    }
  }
}
