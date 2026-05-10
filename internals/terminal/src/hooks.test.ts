import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useExit, isRawModeSupported } from "@semajsx/terminal";
import { createTerminalSession, setActiveSession } from "./context";

describe("Hooks", () => {
  describe("useExit", () => {
    beforeEach(() => {
      // Set up a render context so hooks work
      const ctx = createTerminalSession();
      setActiveSession(ctx);
    });

    afterEach(() => {
      setActiveSession(null);
    });

    it("should return a function", () => {
      const exit = useExit();
      expect(typeof exit).toBe("function");
    });

    it("should call the registered exit callback", () => {
      let called = false;
      const ctx = createTerminalSession();
      ctx.exitCallback = () => {
        called = true;
      };
      setActiveSession(ctx);

      const exit = useExit();
      exit();

      expect(called).toBe(true);
    });

    it("should not throw if no exit callback is registered", () => {
      const exit = useExit();
      expect(() => exit()).not.toThrow();
    });

    it("should not throw if no render context is active", () => {
      setActiveSession(null);
      const exit = useExit();
      expect(() => exit()).not.toThrow();
    });
  });

  describe("isRawModeSupported", () => {
    it("should return an object with supported and active properties", () => {
      const result = isRawModeSupported();
      expect(result).toHaveProperty("supported");
      expect(result).toHaveProperty("active");
      expect(typeof result.supported).toBe("boolean");
      expect(typeof result.active).toBe("boolean");
    });

    it("should report active as false when supported is false", () => {
      const result = isRawModeSupported();
      if (!result.supported) {
        expect(result.active).toBe(false);
      }
    });
  });
});
