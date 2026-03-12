import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";

export async function read(args: string[]): Promise<void> {
  const raw = args[0];
  if (!raw) {
    console.error("Usage: aw read <target> [N] [--wait <duration>] [--json]");
    process.exit(1);
  }

  const target = parseTarget(raw);
  const count = parseInt(args[1] ?? "1", 10) || 1;
  const wait = getFlag(args, "--wait") ?? "60s";
  const json = args.includes("--json");
  const timeoutMs = parseDuration(wait);

  try {
    const client = await AwClient.discover();
    const deadline = Date.now() + timeoutMs;
    let received = 0;

    if (target.workspace && target.channel) {
      // Channel stream
      const stream = await client.streamChannel(target.workspace, target.channel);
      for await (const msg of stream) {
        printEntry(msg, json);
        if (++received >= count) break;
        if (Date.now() >= deadline) break;
      }
    } else if (target.workspace) {
      // Default channel stream
      const ch = "general"; // will be routed to default
      const stream = await client.streamChannel(target.workspace, ch);
      for await (const msg of stream) {
        printEntry(msg, json);
        if (++received >= count) break;
        if (Date.now() >= deadline) break;
      }
    } else if (target.agent) {
      // Agent responses stream
      const stream = await client.streamResponses(target.agent);
      for await (const entry of stream) {
        printEntry(entry, json);
        if (++received >= count) break;
        if (Date.now() >= deadline) break;
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function printEntry(entry: any, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(entry));
  } else if (entry.text) {
    console.log(entry.text);
  } else if (entry.content) {
    const prefix = entry.from ? `[${entry.from}] ` : "";
    console.log(`${prefix}${entry.content}`);
  } else {
    console.log(JSON.stringify(entry));
  }
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function parseDuration(str: string): number {
  const match = str.match(/^(\d+)(ms|s|m|h)?$/);
  if (!match) return 60_000;
  const n = parseInt(match[1]!, 10);
  switch (match[2]) {
    case "ms": return n;
    case "s": return n * 1000;
    case "m": return n * 60_000;
    case "h": return n * 3_600_000;
    default: return n * 1000;
  }
}
