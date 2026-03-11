import { test, expect, describe } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import {
  writeDaemonInfo,
  readDaemonInfo,
  removeDaemonInfo,
  generateToken,
} from "../src/discovery.ts";
import type { DaemonInfo } from "../src/types.ts";

function tmpDataDir(): string {
  const dir = join(tmpdir(), `aw-disc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("discovery", () => {
  test("write and read daemon info", async () => {
    const dir = tmpDataDir();
    const info: DaemonInfo = {
      pid: 12345,
      host: "127.0.0.1",
      port: 8080,
      token: "test-token",
      startedAt: Date.now(),
    };

    await writeDaemonInfo(info, dir);
    const read = await readDaemonInfo(dir);
    expect(read).toEqual(info);
  });

  test("returns null when no daemon.json exists", async () => {
    const dir = tmpDataDir();
    const read = await readDaemonInfo(dir);
    expect(read).toBeNull();
  });

  test("removes daemon.json", async () => {
    const dir = tmpDataDir();
    const info: DaemonInfo = {
      pid: 1,
      host: "127.0.0.1",
      port: 3000,
      token: "x",
      startedAt: 0,
    };

    await writeDaemonInfo(info, dir);
    await removeDaemonInfo(dir);
    const read = await readDaemonInfo(dir);
    expect(read).toBeNull();
  });

  test("generateToken produces hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});
