import { createInterface } from "node:readline/promises";
import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";

export async function repl(args: string[]): Promise<void> {
  const raw = args[0];
  if (!raw) {
    console.error("Usage: aw repl <target> [--from <name>] [--json]");
    process.exit(1);
  }

  const target = parseTarget(raw);
  if (!target.agent && !target.workspace) {
    console.error("Target required (e.g., aw repl alice, aw repl @workspace)");
    process.exit(1);
  }

  const from = getFlag(args, "--from");
  const json = args.includes("--json");
  const client = await AwClient.discover();

  // Verify target exists
  const label = target.agent ?? `@${target.workspace}`;
  try {
    if (target.agent && !target.workspace) {
      await client.getAgent(target.agent);
    } else if (target.workspace) {
      await client.getWorkspace(target.workspace);
    }
  } catch {
    console.error(`"${label}" not found`);
    process.exit(1);
  }

  console.log(`Connected to ${label}. Type messages, .exit to quit.\n`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  let alive = true;

  // ── Background: stream responses ────────────────────────────────────
  const streamLoop = startResponseStream(client, target, json, label, rl, () => alive);

  // ── Foreground: read user input ─────────────────────────────────────
  rl.prompt();

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }
    if (trimmed === ".exit" || trimmed === ".quit") {
      alive = false;
      rl.close();
      return;
    }

    try {
      if (target.agent && !target.workspace) {
        await client.sendToAgent(target.agent, [{ content: trimmed, from }]);
      } else if (target.workspace) {
        await client.sendToWorkspace(target.workspace, {
          content: trimmed,
          from,
          agent: target.agent,
          channel: target.channel,
        });
      }
    } catch (err) {
      printAboveLine(`\x1b[31mSend failed: ${err instanceof Error ? err.message : err}\x1b[0m`, rl);
    }
    rl.prompt();
  });

  rl.on("close", () => {
    alive = false;
    console.log("\nBye.");
    process.exit(0);
  });

  await streamLoop;
}

// ── Response streaming ────────────────────────────────────────────────────

async function startResponseStream(
  client: AwClient,
  target: ReturnType<typeof parseTarget>,
  json: boolean,
  label: string,
  rl: ReturnType<typeof createInterface>,
  isAlive: () => boolean,
): Promise<void> {
  const print = (entry: any) => {
    const text = formatEntry(entry, json, label);
    if (text) printAboveLine(text, rl);
  };

  if (target.agent && !target.workspace) {
    // Agent responses stream
    await streamWithFallback(
      () => client.streamResponses(target.agent!),
      (cursor) => client.readResponses(target.agent!, { cursor }),
      print,
      isAlive,
    );
  } else if (target.workspace) {
    // Workspace channel stream
    const ch = target.channel ?? (await resolveDefaultChannel(client, target.workspace));
    // For workspace channels, use timestamp-based dedup since readChannel
    // doesn't support numeric cursors.
    let lastSeenId: string | undefined;
    await streamWithFallback(
      () => client.streamChannel(target.workspace!, ch),
      async (cursor) => {
        const result = await client.readChannel(target.workspace!, ch, {
          limit: 50,
          since: lastSeenId,
        });
        const msgs = result.messages;
        if (msgs.length > 0) {
          lastSeenId = msgs[msgs.length - 1]!.id;
        }
        return { entries: msgs, cursor };
      },
      print,
      isAlive,
    );
  }
}

async function streamWithFallback(
  startStream: () => Promise<AsyncIterable<any>>,
  poll: (cursor: number) => Promise<{ entries: any[]; cursor: number }>,
  onEntry: (entry: any) => void,
  isAlive: () => boolean,
): Promise<void> {
  try {
    const stream = await startStream();
    for await (const entry of stream) {
      if (!isAlive()) break;
      onEntry(entry);
    }
  } catch {
    // SSE failed — fall back to polling
    let cursor = 0;
    while (isAlive()) {
      try {
        const result = await poll(cursor);
        for (const entry of result.entries) {
          onEntry(entry);
        }
        cursor = result.cursor;
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function resolveDefaultChannel(client: AwClient, workspace: string): Promise<string> {
  try {
    const info = await client.getWorkspace(workspace);
    return info.default_channel ?? "general";
  } catch {
    return "general";
  }
}

// ── Output helpers ────────────────────────────────────────────────────────

/** Print text above the current readline prompt without disrupting user input. */
function printAboveLine(text: string, rl: ReturnType<typeof createInterface>): void {
  // Clear current line, print, then restore prompt
  process.stdout.write(`\r\x1b[K${text}\n`);
  rl.prompt(true);
}

function formatEntry(entry: any, json: boolean, label: string): string | null {
  if (json) return JSON.stringify(entry);

  if (entry.type === "text" && entry.text) {
    return `\x1b[36m${label}\x1b[0m ${entry.text}`;
  }
  if (entry.content) {
    const from = entry.from ? `\x1b[36m${entry.from}\x1b[0m` : `\x1b[36m${label}\x1b[0m`;
    return `${from} ${entry.content}`;
  }
  // Skip non-text events (state changes, run_start, etc.)
  return null;
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
