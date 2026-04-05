import { test, expect, describe } from "bun:test";
import { ClaudeCodeLoop, buildOptions, mapClaudeMessage } from "../src/loops/claude-code.ts";

describe("ClaudeCodeLoop", () => {
  const originalOauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

  function restoreOauthToken() {
    if (originalOauthToken === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    else process.env.CLAUDE_CODE_OAUTH_TOKEN = originalOauthToken;
  }

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

  test("advertises hooks capability", () => {
    const loop = new ClaudeCodeLoop();
    expect(loop.supports).toContain("hooks");
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
    test("accepts CLAUDE_CODE_OAUTH_TOKEN by default", async () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "oauth-token";
      const previousAnthropic = process.env.ANTHROPIC_API_KEY;
      const previousAwsRegion = process.env.AWS_REGION;
      const previousAwsAccessKey = process.env.AWS_ACCESS_KEY_ID;
      const previousGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const previousGoogleProject = process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AWS_REGION;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.GOOGLE_CLOUD_PROJECT;

      try {
        await expect(new ClaudeCodeLoop().preflight()).resolves.toEqual({ ok: true });
      } finally {
        restoreOauthToken();
        if (previousAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = previousAnthropic;
        if (previousAwsRegion === undefined) delete process.env.AWS_REGION;
        else process.env.AWS_REGION = previousAwsRegion;
        if (previousAwsAccessKey === undefined) delete process.env.AWS_ACCESS_KEY_ID;
        else process.env.AWS_ACCESS_KEY_ID = previousAwsAccessKey;
        if (previousGoogleCreds === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousGoogleCreds;
        if (previousGoogleProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
        else process.env.GOOGLE_CLOUD_PROJECT = previousGoogleProject;
      }
    });

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
    test("passes configured hooks into SDK options", async () => {
      const loop = new ClaudeCodeLoop();
      const hook = async () => ({ continue: true });
      const hooks = {
        Notification: [{ hooks: [hook] }],
      };

      loop.setHooks(hooks);

      const options = buildOptions({
        system: "Be helpful",
        opts: {},
        hooks: hooks as any,
        abortController: new AbortController(),
      });

      expect(options.hooks).toEqual(hooks);
    });

    test("maps hook lifecycle system messages into hook events", () => {
      const toolNames = new Map<string, string>();

      expect(
        mapClaudeMessage(
          {
            type: "system",
            subtype: "hook_started",
            hook_name: "workspace-notify",
            hook_event: "Notification",
          } as any,
          toolNames,
        ).events,
      ).toEqual([
        {
          type: "hook",
          phase: "started",
          name: "workspace-notify",
          hookEvent: "Notification",
        },
      ]);

      expect(
        mapClaudeMessage(
          {
            type: "system",
            subtype: "hook_response",
            hook_name: "workspace-notify",
            hook_event: "Notification",
            output: "done",
            stdout: "ok",
            stderr: "",
            outcome: "success",
          } as any,
          toolNames,
        ).events,
      ).toEqual([
        {
          type: "hook",
          phase: "response",
          name: "workspace-notify",
          hookEvent: "Notification",
          output: "done",
          stdout: "ok",
          stderr: "",
          outcome: "success",
        },
      ]);
    });

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
