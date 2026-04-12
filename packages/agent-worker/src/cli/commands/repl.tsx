/** @jsxImportSource semajsx/terminal */
import { signal, type RuntimeComponent } from "semajsx";
import { render, Static, TextInput } from "semajsx/terminal";
import { AwClient, ensureDaemon } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

interface Message {
  id: string;
  from: string;
  content: string;
}

// ── Spinner ───────────────────────────────────────────────────────────────

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ANSI helpers
const c = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  cyanBold: (s: string) => `\x1b[1m\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[1m\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function highlightMentions(text: string): string {
  return text.replace(/@[\w-]+/g, (match) => c.yellow(match));
}

const ReplApp: RuntimeComponent<{
  client: AwClient;
  target: ReturnType<typeof parseTarget>;
  from: string | undefined;
  json: boolean;
  label: string;
  onExit: () => void;
}> = ({ client, target, from, json, label, onExit }, ctx) => {
  const messages = signal<Message[]>([]);
  const input = signal("");
  const activity = signal("");
  const spinnerIdx = signal(0);
  const error = signal("");

  // ── Spinner timer ───────────────────────────────────────────────────
  const spinnerTimer = setInterval(() => {
    if (activity.value) {
      spinnerIdx.value = (spinnerIdx.value + 1) % SPINNER.length;
    }
  }, 80);
  ctx.onCleanup(() => clearInterval(spinnerTimer));

  // ── Status line (dynamic, re-renders) ─────────────────────────────
  const statusLine = () => {
    const text = activity.value;
    if (!text) return "";
    const idx = spinnerIdx.value;
    return `${c.cyan(SPINNER[idx]!)} ${c.dim(text)}`;
  };

  // ── Submit handler ────────────────────────────────────────────────
  const onSubmit = (text: string) => {
    text = text.trim();
    if (!text) return;
    if (text === ".exit" || text === ".quit") {
      onExit();
      return;
    }
    input.value = "";
    sendMessage(client, target, text, from).catch((err) => {
      error.value = err instanceof Error ? err.message : String(err);
    });
  };

  // ── Stream responses & events in background ─────────────────────────
  const controller = new AbortController();
  ctx.onCleanup(() => controller.abort());

  const seenIds = new Set<string>();
  const pushMessage = (entry: any) => {
    const msg = formatEntry(entry, json, label);
    if (!msg) return;
    if (seenIds.has(msg.id)) return;
    seenIds.add(msg.id);
    messages.value = [...messages.value, msg];
  };

  streamResponses(client, target, json, label, pushMessage, controller.signal);
  streamAgentStatus(client, target, activity, controller.signal);

  return (
    <box flexDirection="column" width="100%">
      <Static
        items={messages}
        render={(msg: Message) => (
          <text>{`${c.cyanBold(msg.from)} ${highlightMentions(msg.content)}`}</text>
        )}
      />
      <text>{statusLine()}</text>
      <text>{error.value ? c.red(`Error: ${error.value}`) : ""}</text>
      <TextInput value={input} onSubmit={onSubmit} placeholder="Type a message..." />
    </box>
  );
};

// ── Message sending ───────────────────────────────────────────────────────

async function sendMessage(
  client: AwClient,
  target: ReturnType<typeof parseTarget>,
  content: string,
  from: string | undefined,
): Promise<void> {
  if (target.agent && !target.workspace) {
    await client.sendToAgent(target.agent, [{ content, from }]);
  } else if (target.workspace) {
    await client.sendToWorkspace(target.workspace, {
      content,
      from,
      agent: target.agent,
      channel: target.channel,
    });
  }
}

// ── Agent status streaming ────────────────────────────────────────────────

async function streamAgentStatus(
  client: AwClient,
  target: ReturnType<typeof parseTarget>,
  activity: ReturnType<typeof signal<string>>,
  abortSignal: AbortSignal,
): Promise<void> {
  if (!target.agent && !target.workspace) return;

  const update = (event: any) => {
    const agent = event.agent ? `${event.agent}: ` : "";
    // Normalize: workspace events have "workspace.agent_*" prefix
    const type = (event.type as string).replace(/^workspace\.agent_/, "");
    switch (type) {
      case "state_change":
        activity.value = event.state === "idle" ? "" : `${agent}${event.state}`;
        break;
      case "run_start":
        activity.value = `${agent}thinking...`;
        break;
      case "run_end":
        activity.value = "";
        break;
      case "thinking":
        activity.value = `${agent}thinking...`;
        break;
      case "tool_call_start":
        activity.value = `${agent}${event.name}`;
        break;
      case "tool_call_end":
        activity.value = `${agent}thinking...`;
        break;
      case "error":
        activity.value = "";
        break;
    }
  };

  try {
    const current = target.workspace
      ? await client.readWorkspaceEvents(target.workspace)
      : await client.readAgentEvents(target.agent!);
    const startCursor = current.cursor;

    const stream = target.workspace
      ? await client.streamWorkspaceEvents(target.workspace, startCursor)
      : await client.streamAgentEvents(target.agent!, startCursor);
    for await (const event of stream) {
      if (abortSignal.aborted) break;
      update(event);
    }
  } catch {
    // Ignore — status is best-effort
  }
}

// ── Response streaming ────────────────────────────────────────────────────

async function streamResponses(
  client: AwClient,
  target: ReturnType<typeof parseTarget>,
  json: boolean,
  label: string,
  push: (entry: any) => void,
  abortSignal: AbortSignal,
): Promise<void> {
  if (target.agent && !target.workspace) {
    const current = await client.readResponses(target.agent!);
    const startCursor = current.cursor;

    await streamWithFallback(
      () => client.streamResponses(target.agent!, { cursor: startCursor }),
      (cursor) => client.readResponses(target.agent!, { cursor }),
      push,
      () => !abortSignal.aborted,
    );
  } else if (target.workspace) {
    const ch = target.channel ?? (await resolveDefaultChannel(client, target.workspace));

    const existing = await client.readChannel(target.workspace!, ch, { limit: 1 });
    let lastSeenId: string | undefined =
      existing.messages.length > 0
        ? existing.messages[existing.messages.length - 1]!.id
        : undefined;

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
      push,
      () => !abortSignal.aborted,
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

let msgCounter = 0;

function formatEntry(entry: any, json: boolean, label: string): Message | null {
  if (json) {
    return { id: entry.id ?? `msg-${++msgCounter}`, from: label, content: JSON.stringify(entry) };
  }

  if (entry.type === "text" && entry.text) {
    return { id: entry.id ?? `msg-${++msgCounter}`, from: label, content: entry.text };
  }
  if (entry.content) {
    return {
      id: entry.id ?? `msg-${++msgCounter}`,
      from: entry.from ?? label,
      content: entry.content,
    };
  }
  return null;
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// ── Entry point ───────────────────────────────────────────────────────────

export async function repl(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw repl <target> [--from <name>] [--json]");
    return;
  }
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
  const client = await ensureDaemon();

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

  console.log(`${c.cyanBold(label)} ${c.dim("— .exit to quit")}\n`);

  const { waitUntilExit } = render(
    <ReplApp
      client={client}
      target={target}
      from={from}
      json={json}
      label={label}
      onExit={() => process.exit(0)}
    />,
  );

  await waitUntilExit();
  console.log("\nBye.");
  process.exit(0);
}
