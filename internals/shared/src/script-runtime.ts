import { execaSync } from "execa";

export type ScriptRuntime = "bun" | "node-tsx";

export interface ScriptEntrypointCommand {
  runtime: ScriptRuntime;
  command: string;
  args: string[];
}

let cachedRuntime: ScriptRuntime | null = null;

function hasBun(): boolean {
  try {
    const result = execaSync("bun", ["--version"], {
      reject: false,
      stdio: "ignore",
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function resolveNodeCommand(): string {
  return process.release?.name === "node" ? process.execPath : "node";
}

export function getPreferredScriptRuntime(): ScriptRuntime {
  if (cachedRuntime) return cachedRuntime;
  cachedRuntime = hasBun() ? "bun" : "node-tsx";
  return cachedRuntime;
}

export function resolveScriptEntrypointCommand(
  entryPath: string,
  args: string[] = [],
): ScriptEntrypointCommand {
  const runtime = getPreferredScriptRuntime();
  if (runtime === "bun") {
    return {
      runtime,
      command: "bun",
      args: [entryPath, ...args],
    };
  }

  return {
    runtime,
    command: resolveNodeCommand(),
    args: ["--import", "tsx", entryPath, ...args],
  };
}
