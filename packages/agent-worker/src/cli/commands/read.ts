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

  const client = await AwClient.discover();
  const deadline = Date.now() + timeoutMs;
  let received = 0;

  // Target routing per DESIGN.md:
  //   alice         → agent responses (all)
  //   alice@review  → agent responses (workspace=review)
  //   @review       → default channel
  //   @review#design → named channel

  if (target.agent) {
    // Agent responses stream (optionally scoped to workspace)
    const consume = async (iter: AsyncIterable<any>) => {
      for await (const entry of iter) {
        printEntry(entry, json);
        if (++received >= count) break;
        if (Date.now() >= deadline) break;
      }
    };

    try {
      const stream = await client.streamResponses(target.agent, { workspace: target.workspace });
      await consume(stream);
    } catch {
      // SSE failed — fall back to cursor polling
      let cursor = 0;
      while (received < count && Date.now() < deadline) {
        const result = await client.readResponses(target.agent, { cursor, workspace: target.workspace });
        for (const entry of result.entries) {
          printEntry(entry, json);
          if (++received >= count) break;
        }
        cursor = result.cursor;
        if (received < count) await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } else if (target.workspace && target.channel) {
    // Named channel stream
    const consume = async (iter: AsyncIterable<any>) => {
      for await (const msg of iter) {
        printEntry(msg, json);
        if (++received >= count) break;
        if (Date.now() >= deadline) break;
      }
    };

    try {
      const stream = await client.streamChannel(target.workspace, target.channel);
      await consume(stream);
    } catch {
      // SSE failed — fall back to polling
      const result = await client.readChannel(target.workspace, target.channel, { limit: count });
      for (const msg of result.messages) {
        printEntry(msg, json);
        received++;
      }
    }
  } else if (target.workspace) {
    // Default channel stream — resolve default_channel from workspace info
    const wsInfo = await client.getWorkspace(target.workspace);
    const ch = wsInfo.default_channel ?? "general";

    const consume = async (iter: AsyncIterable<any>) => {
      for await (const msg of iter) {
        printEntry(msg, json);
        if (++received >= count) break;
        if (Date.now() >= deadline) break;
      }
    };

    try {
      const stream = await client.streamChannel(target.workspace, ch);
      await consume(stream);
    } catch {
      // SSE failed — fall back to polling
      const result = await client.readChannel(target.workspace, ch, { limit: count });
      for (const msg of result.messages) {
        printEntry(msg, json);
        received++;
      }
    }
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
