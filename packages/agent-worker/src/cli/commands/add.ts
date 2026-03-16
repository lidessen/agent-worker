import { AwClient } from "../../client.ts";
import type { RuntimeConfig, RuntimeType } from "../../types.ts";
import { wantsHelp } from "../output.ts";

export async function add(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log(
      "Usage: aw add <name> --runtime <type> [--model <id>] [--instructions <text>] [--cwd <path>]",
    );
    return;
  }
  const name = args[0];
  if (!name) {
    console.error(
      "Usage: aw add <name> --runtime <type> [--model <id>] [--instructions <text>] [--cwd <path>]",
    );
    process.exit(1);
  }

  const runtime: RuntimeConfig = {
    type: (getFlag(args, "--runtime") ?? "mock") as RuntimeType,
    model: getFlag(args, "--model"),
    instructions: getFlag(args, "--instructions"),
    cwd: getFlag(args, "--cwd"),
  };

  // Parse --env KEY=VALUE (repeatable)
  const envPairs = getAllFlags(args, "--env");
  if (envPairs.length > 0) {
    runtime.env = {};
    for (const pair of envPairs) {
      const [k, ...v] = pair.split("=");
      runtime.env[k!] = v.join("=");
    }
  }

  const runner = getFlag(args, "--runner");
  if (runner === "host" || runner === "sandbox") {
    runtime.runner = runner;
  }

  try {
    const client = await AwClient.discover();
    const info = await client.createAgent(name, runtime);
    console.log(`Added agent "${info.name}" (${runtime.type})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function getAllFlags(args: string[], flag: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) {
      results.push(args[i + 1]!);
      i++;
    }
  }
  return results;
}
