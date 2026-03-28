import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { ensureDaemon } from "../../client.ts";
import { wantsHelp } from "../output.ts";

export async function create(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw create <config.yaml> [--tag <tag>] [--var KEY=VALUE]");
    return;
  }
  const source = args[0];
  if (!source) {
    console.error("Usage: aw create <config.yaml> [--tag <tag>] [--var KEY=VALUE]");
    process.exit(1);
  }

  const tag = getFlag(args, "--tag");
  const vars = parseVars(args);

  try {
    // Read YAML from file, derive fallback name from filename
    const yaml = await readFile(source, "utf-8");
    const name = basename(source)
      .replace(/\.(ya?ml)$/, "")
      .replace(/^_/, "");
    const configDir = resolve(dirname(source));
    const sourcePath = resolve(source);
    const client = await ensureDaemon();
    const info = await client.createWorkspace(yaml, { name, configDir, sourcePath, tag, vars });
    const key = info.tag ? `${info.name}:${info.tag}` : info.name;
    console.log(`Created workspace @${key}`);
    console.log(`  Agents:   ${info.agents.join(", ")}`);
    console.log(`  Channels: ${info.channels.join(", ")}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function parseVars(args: string[]): Record<string, string> | undefined {
  const vars: Record<string, string> = {};
  let found = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--var" && i + 1 < args.length) {
      const [k, ...v] = args[i + 1]!.split("=");
      vars[k!] = v.join("=");
      found = true;
      i++;
    }
  }
  return found ? vars : undefined;
}
