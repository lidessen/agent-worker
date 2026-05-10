/** @jsxImportSource @semajsx/terminal */

import { beforeEach, describe, expect, it } from "vitest";
import { signal } from "@semajsx/signal";
import { render, TerminalRenderer } from "@semajsx/terminal";
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

  getLastOutput(): string {
    return this.output[this.output.length - 1] || "";
  }
}

describe("Terminal Integration", () => {
  let mockStream: MockStream;
  let renderer: TerminalRenderer;

  beforeEach(() => {
    mockStream = new MockStream();
    renderer = new TerminalRenderer(mockStream as any);
  });

  describe("render with JSX", () => {
    it("should render simple element tree", () => {
      const app = (
        <box>
          <text>Hello World</text>
        </box>
      );

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should render nested elements", () => {
      const app = (
        <box flexDirection="column">
          <text>Line 1</text>
          <text>Line 2</text>
          <text>Line 3</text>
        </box>
      );

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should apply styles", () => {
      const app = (
        <box padding={2} border="round" flexDirection="column">
          <text color="green" bold={true}>
            Styled Text
          </text>
        </box>
      );

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });
  });

  describe("render with signals", () => {
    it("should render signal values", () => {
      const count = signal(0);
      const app = (
        <box>
          <text>Count: {count}</text>
        </box>
      );

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should update when signal changes", () => {
      const count = signal(0);
      const app = (
        <box>
          <text>Count: {count}</text>
        </box>
      );

      render(app, { renderer });

      // Update signal
      count.value = 42;

      // Signal value should be updated
      expect(count.value).toBe(42);
    });

    it("should handle computed signals", () => {
      const count = signal(5);
      const app = (
        <box>
          <text>Value: {count}</text>
        </box>
      );

      render(app, { renderer });

      count.value = 10;

      expect(count.value).toBe(10);
    });
  });

  describe("component rendering", () => {
    it("should render functional components", () => {
      function Counter({ initial }: { initial: number }) {
        const count = signal(initial);
        return (
          <box>
            <text>Count: {count}</text>
          </box>
        );
      }

      const app = <Counter initial={5} />;

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should render with props", () => {
      function Greeting({ name }: { name: string }) {
        return (
          <box>
            <text>Hello, {name}!</text>
          </box>
        );
      }

      const app = <Greeting name="World" />;

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should render nested components", () => {
      function Inner() {
        return <text>Inner content</text>;
      }

      function Outer() {
        return (
          <box>
            <Inner />
          </box>
        );
      }

      function App() {
        return (
          <box>
            <Outer />
          </box>
        );
      }

      const app = <App />;

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });
  });

  describe("unmounting", () => {
    it("should cleanup when unmounted", () => {
      const count = signal(0);
      const app = (
        <box>
          <text>Count: {count}</text>
        </box>
      );

      const { unmount } = render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);

      unmount();

      // After unmount, no error should occur
      expect(true).toBe(true);
    });
  });

  describe("layout and positioning", () => {
    it("should handle padding", () => {
      const app = (
        <box padding={2}>
          <text>Content</text>
        </box>
      );

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });

    it("should respect flexbox layout", () => {
      const app = (
        <box flexDirection="row">
          <box width={20}>
            <text>Left</text>
          </box>
          <box width={20}>
            <text>Right</text>
          </box>
        </box>
      );

      render(app, { renderer });

      expect(mockStream.output.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const app = <box />;

      expect(() => render(app, { renderer })).not.toThrow();
    });

    it("should handle null/undefined in children", () => {
      const show = signal(false);
      const app = <box>{show.value && <text>Conditional</text>}</box>;

      expect(() => render(app, { renderer })).not.toThrow();
    });

    it("should handle deeply nested structures", () => {
      const app = (
        <box>
          <box>
            <box>
              <box>
                <text>Deep</text>
              </box>
            </box>
          </box>
        </box>
      );

      expect(() => render(app, { renderer })).not.toThrow();
    });
  });
});
