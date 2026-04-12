import { test, expect, describe, afterAll } from "bun:test";
import { createHostSandbox } from "../src/sandbox/host.ts";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("HostSandbox", () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), "host-sandbox-test-")));
  const extraDir = realpathSync(mkdtempSync(join(tmpdir(), "host-sandbox-extra-")));

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(extraDir, { recursive: true, force: true });
  });

  const sandbox = createHostSandbox({ cwd: tmpDir, allowedPaths: [extraDir] });

  test("executeCommand runs in cwd", async () => {
    const result = await sandbox.executeCommand("pwd");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(tmpDir);
  });

  test("executeCommand returns exit code on failure", async () => {
    const result = await sandbox.executeCommand("exit 42");
    expect(result.exitCode).toBe(42);
  });

  test("writeFiles creates files on real filesystem", async () => {
    const filePath = join(tmpDir, "test-dir", "hello.txt");
    await sandbox.writeFiles([{ path: filePath, content: "hello world" }]);

    // Verify file exists on real filesystem (not via sandbox)
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("hello world");
  });

  test("readFile reads from real filesystem", async () => {
    const filePath = join(tmpDir, "test-dir", "hello.txt");
    const content = await sandbox.readFile(filePath);
    expect(content).toBe("hello world");
  });

  test("executeCommand can access files written by writeFiles", async () => {
    const filePath = join(tmpDir, "script.sh");
    await sandbox.writeFiles([{ path: filePath, content: "echo 'from script'" }]);

    const result = await sandbox.executeCommand(`bash ${filePath}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("from script");
  });

  test("writeFiles to allowedPaths succeeds", async () => {
    const filePath = join(extraDir, "extra.txt");
    await sandbox.writeFiles([{ path: filePath, content: "extra content" }]);
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("extra content");
  });

  test("readFile from allowedPaths succeeds", async () => {
    const filePath = join(extraDir, "extra.txt");
    const content = await sandbox.readFile(filePath);
    expect(content).toBe("extra content");
  });

  test("writeFiles rejects paths outside sandbox boundary", async () => {
    const outsidePath = join(tmpdir(), "outside-sandbox.txt");
    await expect(sandbox.writeFiles([{ path: outsidePath, content: "nope" }])).rejects.toThrow(
      "outside sandbox boundary",
    );
  });

  test("readFile rejects paths outside sandbox boundary", async () => {
    await expect(sandbox.readFile("/etc/passwd")).rejects.toThrow("outside sandbox boundary");
  });
});
