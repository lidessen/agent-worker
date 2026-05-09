import { beforeEach, describe, expect, it } from "vitest";
import { TerminalRenderer } from "@semajsx/terminal";
import { appendChild, createElement, createTextNode } from "@semajsx/terminal";
import { Writable } from "stream";

/**
 * Mock writable stream for testing
 */
class MockStream extends Writable {
  public output: string[] = [];
  public columns: number = 80;
  public rows: number = 24;

  override _write(chunk: any, _encoding: string, callback: () => void): void {
    this.output.push(chunk.toString());
    callback();
  }

  clear(): void {
    this.output = [];
  }
}

describe("TerminalRenderer", () => {
  let mockStream: MockStream;
  let renderer: TerminalRenderer;

  beforeEach(() => {
    mockStream = new MockStream();
    renderer = new TerminalRenderer(mockStream as any);
  });

  describe("constructor", () => {
    it("should create a renderer with root node", () => {
      const root = renderer.getRoot();

      expect(root).toBeDefined();
      expect(root.type).toBe("root");
      expect(root.stream).toBe(mockStream);
    });

    it("should set root dimensions from stream", () => {
      const customStream = new MockStream();
      customStream.columns = 120;
      customStream.rows = 40;

      const customRenderer = new TerminalRenderer(customStream as any);
      const root = customRenderer.getRoot();

      expect(root.yogaNode?.getWidth().value).toBe(120);
      expect(root.yogaNode?.getHeight().value).toBe(40);
    });
  });

  describe("render", () => {
    it("should render simple text", () => {
      const root = renderer.getRoot();
      const text = createTextNode("Hello World");

      appendChild(root, text);
      renderer.render();

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should render element with children", () => {
      const root = renderer.getRoot();
      const box = createElement("box");
      const text = createTextNode("Test");

      appendChild(box, text);
      appendChild(root, box);
      renderer.render();

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should only update when content changes", () => {
      const root = renderer.getRoot();
      const text = createTextNode("Hello");

      appendChild(root, text);
      renderer.render();

      mockStream.clear();

      // Render again without changes
      renderer.render();

      // Should not output again if nothing changed
      expect(mockStream.output.length).toBe(0);
    });
  });

  describe("clear", () => {
    it("should clear the terminal", () => {
      renderer.clear();

      expect(mockStream.output.length).toBeGreaterThan(0);
      // Check for ANSI escape sequences (could be various clear codes)
      const hasEscapeSequence = mockStream.output.some((o) => o.includes("\x1B"));
      expect(hasEscapeSequence).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should cleanup resources", () => {
      const root = renderer.getRoot();

      expect(root.yogaNode).toBeDefined();

      renderer.destroy();

      // After destroy, terminal should be cleared
      expect(mockStream.output.length).toBeGreaterThan(0);
    });
  });

  describe("layout calculation", () => {
    it("should calculate layout for nested elements", () => {
      const root = renderer.getRoot();
      const parent = createElement("box");
      const child = createElement("box");

      appendChild(parent, child);
      appendChild(root, parent);

      renderer.render();

      // After render, nodes should have computed positions
      expect(parent.x).toBeDefined();
      expect(parent.y).toBeDefined();
      expect(child.x).toBeDefined();
      expect(child.y).toBeDefined();
    });

    it("should respect flexbox layout", () => {
      const root = renderer.getRoot();
      const parent = createElement("box");
      const child1 = createElement("box");
      const child2 = createElement("box");

      // Set up flexbox layout - ROW direction
      if (parent.yogaNode) {
        parent.yogaNode.setFlexDirection(0); // ROW
        parent.yogaNode.setWidth(100);
        parent.yogaNode.setHeight(50);
      }
      if (child1.yogaNode) {
        child1.yogaNode.setWidth(40);
        child1.yogaNode.setHeight(20);
      }
      if (child2.yogaNode) {
        child2.yogaNode.setWidth(40);
        child2.yogaNode.setHeight(20);
      }

      appendChild(parent, child1);
      appendChild(parent, child2);
      appendChild(root, parent);

      renderer.render();

      // Children should be laid out horizontally
      expect(child1.x).toBeDefined();
      expect(child2.x).toBeDefined();
      // In row layout, child2 should be positioned after child1
      if (child1.x !== undefined && child2.x !== undefined && child1.width !== undefined) {
        expect(child2.x).toBeGreaterThanOrEqual(child1.x);
      }
    });
  });
});
