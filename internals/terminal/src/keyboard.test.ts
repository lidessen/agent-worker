import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseKeyEvent, onKeypress } from "@semajsx/terminal";
import { createTerminalSession, setActiveSession } from "./context";

describe("Keyboard Input API", () => {
  describe("parseKeyEvent", () => {
    it("should parse arrow keys", () => {
      expect(parseKeyEvent(Buffer.from("\u001b[A")).key).toBe("up");
      expect(parseKeyEvent(Buffer.from("\u001b[B")).key).toBe("down");
      expect(parseKeyEvent(Buffer.from("\u001b[C")).key).toBe("right");
      expect(parseKeyEvent(Buffer.from("\u001b[D")).key).toBe("left");
    });

    it("should parse Ctrl+C", () => {
      const event = parseKeyEvent(Buffer.from("\u0003"));
      expect(event.key).toBe("c");
      expect(event.ctrl).toBe(true);
    });

    it("should parse Escape", () => {
      const event = parseKeyEvent(Buffer.from("\u001b"));
      expect(event.key).toBe("escape");
      expect(event.ctrl).toBe(false);
      expect(event.meta).toBe(false);
    });

    it("should parse Enter/Return", () => {
      expect(parseKeyEvent(Buffer.from("\r")).key).toBe("return");
      expect(parseKeyEvent(Buffer.from("\n")).key).toBe("return");
    });

    it("should parse Space", () => {
      const event = parseKeyEvent(Buffer.from(" "));
      expect(event.key).toBe("space");
    });

    it("should parse Tab", () => {
      const event = parseKeyEvent(Buffer.from("\t"));
      expect(event.key).toBe("tab");
    });

    it("should parse Backspace", () => {
      const event = parseKeyEvent(Buffer.from("\u007f"));
      expect(event.key).toBe("backspace");
    });

    it("should parse regular characters", () => {
      const event = parseKeyEvent(Buffer.from("a"));
      expect(event.key).toBe("a");
      expect(event.ctrl).toBe(false);
      expect(event.shift).toBe(false);
    });

    it("should detect shift from uppercase letters", () => {
      const event = parseKeyEvent(Buffer.from("A"));
      expect(event.key).toBe("A");
      expect(event.shift).toBe(true);
    });

    it("should parse Ctrl+A through Ctrl+Z", () => {
      // Ctrl+A = 0x01
      const event = parseKeyEvent(Buffer.from("\u0001"));
      expect(event.key).toBe("a");
      expect(event.ctrl).toBe(true);
    });

    it("should parse Meta/Alt + key", () => {
      const event = parseKeyEvent(Buffer.from("\u001bx"));
      expect(event.key).toBe("x");
      expect(event.meta).toBe(true);
    });

    it("should parse navigation keys", () => {
      expect(parseKeyEvent(Buffer.from("\u001b[H")).key).toBe("home");
      expect(parseKeyEvent(Buffer.from("\u001b[F")).key).toBe("end");
      expect(parseKeyEvent(Buffer.from("\u001b[5~")).key).toBe("pageup");
      expect(parseKeyEvent(Buffer.from("\u001b[6~")).key).toBe("pagedown");
      expect(parseKeyEvent(Buffer.from("\u001b[3~")).key).toBe("delete");
      expect(parseKeyEvent(Buffer.from("\u001b[2~")).key).toBe("insert");
    });

    it("should include raw string in event", () => {
      const event = parseKeyEvent(Buffer.from("x"));
      expect(event.raw).toBe("x");
    });
  });

  describe("onKeypress", () => {
    beforeEach(() => {
      setActiveSession(createTerminalSession());
    });

    afterEach(() => {
      setActiveSession(null);
    });

    it("should return a noop unsubscribe if no context is active", () => {
      setActiveSession(null);
      const unsub = onKeypress(() => {});
      expect(typeof unsub).toBe("function");
      expect(() => unsub()).not.toThrow();
    });

    it("should register and unregister a listener", () => {
      const handler = () => {};
      const unsub = onKeypress(handler);
      expect(typeof unsub).toBe("function");
      unsub();
      // Should not throw when called again
      unsub();
    });
  });
});
