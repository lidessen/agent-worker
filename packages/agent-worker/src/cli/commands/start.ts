import { AwClient } from "../../client.ts";

export async function start(args: string[]): Promise<void> {
  const source = args[0];
  if (!source) {
    console.error("Usage: aw start <config.yaml> [--tag <tag>] [--var KEY=VALUE]");
    process.exit(1);
  }

  const tag = getFlag(args, "--tag");
  const vars = parseVars(args);

  try {
    // Read YAML from file
    const yaml = await Bun.file(source).text();
    const client = await AwClient.discover();
    const info = await client.startWorkspace(yaml, { tag, vars });
    const key = info.tag ? `${info.name}:${info.tag}` : info.name;
    console.log(`Started workspace @${key}`);
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
