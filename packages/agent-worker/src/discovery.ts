import { join } from "node:path";
import { homedir } from "node:os";
import type { DaemonInfo } from "./types.ts";

/** Default data directory: ~/.agent-worker */
export function defaultDataDir(): string {
  return join(homedir(), ".agent-worker");
}

/** Path to daemon.json discovery file. */
export function daemonInfoPath(dataDir?: string): string {
  return join(dataDir ?? defaultDataDir(), "daemon.json");
}

/** Write daemon discovery info. */
export async function writeDaemonInfo(info: DaemonInfo, dataDir?: string): Promise<void> {
  const dir = dataDir ?? defaultDataDir();
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  await Bun.write(join(dir, "daemon.json"), JSON.stringify(info, null, 2));
}

/** Read daemon discovery info. Returns null if not found. */
export async function readDaemonInfo(dataDir?: string): Promise<DaemonInfo | null> {
  const path = daemonInfoPath(dataDir);
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    return JSON.parse(await file.text()) as DaemonInfo;
  } catch {
    return null;
  }
}

/** Remove daemon discovery file. */
export async function removeDaemonInfo(dataDir?: string): Promise<void> {
  const path = daemonInfoPath(dataDir);
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(path);
  } catch {
    /* doesn't exist */
  }
}

/** Generate a random auth token. */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
