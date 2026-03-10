import { test, expect, describe } from "bun:test";
import { ClaudeCodeLoop } from "../src/loops/claude-code.ts";

describe("ClaudeCodeLoop", () => {
  test("starts with idle status", () => {
    const loop = new ClaudeCodeLoop();
    expect(loop.status).toBe("idle");
  });

  test("cancel before run is a no-op", () => {
    const loop = new ClaudeCodeLoop();
    loop.cancel();
    expect(loop.status).toBe("idle");
  });

  test("run transitions to running status", () => {
    const loop = new ClaudeCodeLoop();
    loop.run("test prompt");
    expect(loop.status).toBe("running");
    loop.cancel();
  });

  test("throws error when run is called while already running", () => {
    const loop = new ClaudeCodeLoop();
    loop.run("first prompt");
    expect(() => loop.run("second prompt")).toThrow("Already running");
    loop.cancel();
  });

  test("cancel transitions status to cancelled", () => {
    const loop = new ClaudeCodeLoop();
    loop.run("test prompt");
    loop.cancel();
    expect(loop.status).toBe("cancelled");
  });

  test("accepts options in constructor", () => {
    const loop = new ClaudeCodeLoop({
      model: "opus",
      instructions: "Be concise",
      allowedTools: ["bash", "readFile"],
      permissionMode: "acceptEdits",
      extraArgs: ["--test"],
    });
    expect(loop.status).toBe("idle");
  });

  test("run returns LoopRun with async iterator and result promise", () => {
    const loop = new ClaudeCodeLoop();
    const run = loop.run("test prompt");

    expect(Symbol.asyncIterator in run).toBe(true);
    expect(run.result).toBeInstanceOf(Promise);

    loop.cancel();
  });

  test("can cancel multiple times safely", () => {
    const loop = new ClaudeCodeLoop();
    loop.run("test prompt");
    loop.cancel();
    loop.cancel();
    expect(loop.status).toBe("cancelled");
  });

  describe("preflight", () => {
    test("returns preflight result", async () => {
      const loop = new ClaudeCodeLoop();
      const result = await loop.preflight();

      expect(result).toHaveProperty("ok");
      expect(typeof result.ok).toBe("boolean");
      if (result.ok) {
        expect(result).toHaveProperty("version");
      } else {
        expect(result).toHaveProperty("error");
      }
    });

    test("preflight does not change status", async () => {
      const loop = new ClaudeCodeLoop();
      expect(loop.status).toBe("idle");
      await loop.preflight();
      expect(loop.status).toBe("idle");
    });
  });

  describe("status transitions", () => {
    test("cancel during run sets cancelled", () => {
      const loop = new ClaudeCodeLoop();
      loop.run("test prompt");
      expect(loop.status).toBe("running");
      loop.cancel();
      expect(loop.status).toBe("cancelled");
    });

    test("status stays cancelled after cancel + await", async () => {
      const loop = new ClaudeCodeLoop();
      const run = loop.run("test prompt");
      loop.cancel();

      try {
        await run.result;
      } catch {
        /* expected */
      }

      expect(loop.status).toBe("cancelled");
    });
  });

  describe("options handling", () => {
    test("builds args with model option", () => {
      const loop = new ClaudeCodeLoop({ model: "sonnet" });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with instructions option", () => {
      const loop = new ClaudeCodeLoop({ instructions: "Be helpful" });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with allowedTools option", () => {
      const loop = new ClaudeCodeLoop({ allowedTools: ["bash", "readFile"] });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with permissionMode acceptEdits", () => {
      const loop = new ClaudeCodeLoop({ permissionMode: "acceptEdits" });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with permissionMode bypassPermissions", () => {
      const loop = new ClaudeCodeLoop({ permissionMode: "bypassPermissions" });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with default permissionMode (no skip-permissions)", () => {
      const loop = new ClaudeCodeLoop({ permissionMode: "default" });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with extraArgs option", () => {
      const loop = new ClaudeCodeLoop({ extraArgs: ["--verbose", "--debug"] });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with all options combined", () => {
      const loop = new ClaudeCodeLoop({
        model: "opus",
        instructions: "Be concise",
        allowedTools: ["bash"],
        permissionMode: "bypassPermissions",
        extraArgs: ["--verbose"],
      });
      loop.run("test prompt");
      loop.cancel();
    });

    test("handles empty prompt", () => {
      const loop = new ClaudeCodeLoop();
      loop.run("");
      loop.cancel();
    });
  });
});
