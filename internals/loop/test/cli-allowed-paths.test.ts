import { test, expect, describe } from "bun:test";
import { buildArgs as buildClaudeArgs } from "../src/loops/claude-code.ts";
import { buildArgs as buildCodexArgs } from "../src/loops/codex.ts";

describe("CLI loop allowedPaths → --add-dir", () => {
  test("claude-code buildArgs includes --add-dir for each allowed path", () => {
    const args = buildClaudeArgs("do stuff", {
      model: "sonnet",
      cwd: "/home/agent/sandbox",
      allowedPaths: ["/shared/workspace", "/mnt/extra"],
      permissionMode: "bypassPermissions",
    });

    expect(args).toContain("--add-dir");
    expect(args).toContain("/shared/workspace");
    expect(args).toContain("/mnt/extra");
  });

  test("claude-code buildArgs omits --add-dir when no allowedPaths", () => {
    const args = buildClaudeArgs("do stuff", {
      model: "sonnet",
      cwd: "/home/agent/sandbox",
    });

    expect(args).not.toContain("--add-dir");
  });

  test("codex buildArgs includes --add-dir for each allowed path", () => {
    const args = buildCodexArgs("do stuff", {
      model: "codex-mini",
      cwd: "/home/agent/sandbox",
      allowedPaths: ["/shared/workspace"],
      fullAuto: true,
    });

    expect(args).toContain("--add-dir");
    expect(args).toContain("/shared/workspace");
  });

  test("cursor accepts allowedPaths for SDK local cwd roots", async () => {
    const mod = await import("../src/loops/cursor.ts");
    const loop = new mod.CursorLoop({
      model: "auto",
      cwd: "/home/agent/sandbox",
      allowedPaths: ["/shared/workspace"],
    });
    expect(loop).toBeDefined();
    expect(loop.status).toBe("idle");
  });
});
