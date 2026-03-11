import { test, expect, describe } from "bun:test";
import { HostRunner, SandboxRunner, createRunner } from "../src/runner.ts";

describe("HostRunner", () => {
  test("executes shell commands", async () => {
    const runner = new HostRunner();
    const result = await runner.exec("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  test("captures stderr", async () => {
    const runner = new HostRunner();
    const result = await runner.exec("echo err >&2");
    expect(result.stderr.trim()).toBe("err");
  });

  test("reports non-zero exit code", async () => {
    const runner = new HostRunner();
    const result = await runner.exec("exit 42");
    expect(result.exitCode).toBe(42);
  });

  test("respects cwd", async () => {
    const runner = new HostRunner({ cwd: "/tmp" });
    const result = await runner.exec("pwd");
    expect(result.stdout.trim()).toBe("/tmp");
  });
});

describe("SandboxRunner", () => {
  test("throws not implemented", async () => {
    const runner = new SandboxRunner();
    await expect(runner.exec("echo hi")).rejects.toThrow("not yet implemented");
  });
});

describe("createRunner", () => {
  test("defaults to host", () => {
    const runner = createRunner();
    expect(runner.kind).toBe("host");
  });

  test("creates sandbox runner", () => {
    const runner = createRunner({ kind: "sandbox" });
    expect(runner.kind).toBe("sandbox");
  });
});
