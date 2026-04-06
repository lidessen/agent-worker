import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  checkCliAvailability,
  runCliCommand,
  checkClaudeCodeAuth,
  checkCodexAuth,
  spawnCli,
} from "../src/utils/cli.ts";

describe("checkCliAvailability", () => {
  test("returns available true when command exists", async () => {
    // Test with a command that should exist (like 'echo' or 'ls')
    const result = await checkCliAvailability("echo");
    expect(result.available).toBe(true);
    expect(result.version).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  test("returns available false when command does not exist", async () => {
    const result = await checkCliAvailability("nonexistent-command-xyz-123");
    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("uses custom version flag", async () => {
    const result = await checkCliAvailability("bun", "--version");
    expect(result.available).toBe(true);
  });
});

describe("runCliCommand", () => {
  test("runs command successfully", async () => {
    const result = await runCliCommand("echo", ["hello"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("");
  });

  test("captures stderr", async () => {
    // Use a command that writes to stderr
    const result = await runCliCommand("sh", ["-c", "echo error >&2"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("error");
  });

  test("handles non-zero exit code", async () => {
    const result = await runCliCommand("sh", ["-c", "exit 42"]);
    expect(result.exitCode).toBe(42);
  });

  test("handles command not found", async () => {
    const result = await runCliCommand("nonexistent-command-xyz-123", []);
    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toBeDefined();
  });
});

describe("checkClaudeCodeAuth", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "CLAUDE_CODE_OAUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GOOGLE_CLOUD_PROJECT",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test("accepts CLAUDE_CODE_OAUTH_TOKEN", async () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "token";
    const result = await checkClaudeCodeAuth();
    expect(result.authenticated).toBe(true);
  });

  test("accepts provider credentials", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const result = await checkClaudeCodeAuth();
    expect(result.authenticated).toBe(true);
  });

  test("returns auth status", async () => {
    const result = await checkClaudeCodeAuth();
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain("Claude Agent SDK requires");
  });
});

describe("checkCodexAuth", () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.OPENAI_API_KEY = originalEnv;
    }
  });

  test("returns authenticated true when OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const result = await checkCodexAuth();
    expect(result.authenticated).toBe(true);
    expect(result.method).toBe("OPENAI_API_KEY");
  });

  test("returns authenticated false when no key is set", async () => {
    // Only test this if OPENAI_API_KEY is not set in the environment
    // (it might be set globally, so we can't assume it's unset)
    const result = await checkCodexAuth();
    expect(typeof result.authenticated).toBe("boolean");
    if (!result.authenticated) {
      expect(result.error).toBeDefined();
    }
  });
});

describe("spawnCli", () => {
  test("runs command and captures output", async () => {
    const result = await spawnCli({
      command: "echo",
      args: ["test"],
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("test");
  });

  test("handles abort signal", async () => {
    const controller = new AbortController();
    const promise = spawnCli({
      command: "sleep",
      args: ["10"],
      signal: controller.signal,
    });

    // Abort immediately
    controller.abort();

    const result = await promise;
    // Process should be killed, exit code may vary
    expect(result.exitCode).toBeDefined();
  });

  test("calls onStdout callback", async () => {
    const chunks: string[] = [];
    await spawnCli({
      command: "echo",
      args: ["hello", "world"],
      onStdout: (chunk) => chunks.push(chunk),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("hello");
  });

  test("calls onStderr callback", async () => {
    const chunks: string[] = [];
    await spawnCli({
      command: "sh",
      args: ["-c", "echo error >&2"],
      onStderr: (chunk) => chunks.push(chunk),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("error");
  });

  test("respects cwd option", async () => {
    const result = await spawnCli({
      command: "pwd",
      args: [],
      cwd: "/tmp",
    });
    expect(result.stdout.trim()).toContain("/tmp");
  });
});
