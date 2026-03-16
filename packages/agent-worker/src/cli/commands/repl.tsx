/** @jsxImportSource semajsx/terminal */
import { signal, computed } from "semajsx";
import { render, onKeypress, useExit, onCleanup } from "semajsx/terminal";
import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

interface Message {
  from: string;
  content: string;
}

// ── Spinner ───────────────────────────────────────────────────────────────

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ANSI helpers for inline colored text within a single <text> node
const c = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  cyanBold: (s: string) => `\x1b[1m\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[1m\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
};

function ReplApp({
  client,
  target,
  from,
  json,
  label,
}: {
  client: AwClient;
  target: ReturnType<typeof parseTarget>;
  from: string | undefined;
  json: boolean;
  label: string;
}) {
  const messages = signal<Message[]>([]);
  const input = signal("");
  const error = signal("");
  const activity = signal("");
  const spinnerIdx = signal(0);

  // ── Spinner timer ───────────────────────────────────────────────────
  const spinnerTimer = setInterval(() => {
    if (activity.value) {
      spinnerIdx.value = (spinnerIdx.value + 1) % SPINNER.length;
    }
  }, 80);
  onCleanup(() => clearInterval(spinnerTimer));

  // ── Computed display lines ──────────────────────────────────────────
  // Status: spinner + activity text (single <text>, needs ANSI for mixed colors)
  const statusLine = computed([activity, spinnerIdx], (text: string, idx: number) => {
    if (!text) return "";
    return `${c.cyan(SPINNER[idx]!)} ${c.dim(text)}`;
  });

  // Prompt: "> input█" (single <text>, dynamic content needs ANSI)
  const promptLine = computed([input], (v: string) => `${c.green(">")} ${v}${c.gray("█")}`);

  // Messages: each msg is a static <text> with inline ANSI for mixed styling
  const messageList = computed([messages], (msgs: Message[]) =>
    msgs.map((msg) => <text>{`${c.cyanBold(msg.from)} ${highlightMentions(msg.content)}`}</text>),
  );

  // Error line
  const errorLine = computed([error], (v: string) => (v ? c.red(`Error: ${v}`) : ""));

  const exit = useExit();

  // ── Keyboard input ──────────────────────────────────────────────────
  const specialKeys = new Set([
    "up",
    "down",
    "left",
    "right",
    "home",
    "end",
    "pageup",
    "pagedown",
    "delete",
    "insert",
    "tab",
    "escape",
  ]);

  onKeypress((event) => {
    if (event.key === "return") {
      const text = input.value.trim();
      if (!text) return;
      if (text === ".exit" || text === ".quit") {
        exit();
        return;
      }
      input.value = "";
      sendMessage(client, target, text, from).catch((err) => {
        error.value = err instanceof Error ? err.message : String(err);
      });
    } else if (event.key === "backspace") {
      input.value = input.value.slice(0, -1);
    } else if (event.ctrl && event.key === "u") {
      input.value = "";
    } else if (event.key === "space") {
      input.value += " ";
    } else if (!event.ctrl && !event.meta && !specialKeys.has(event.key)) {
      // Accept single chars, multi-char IME input, and Unicode
      input.value += event.key;
    }
  });

  // ── Stream responses & events in background ─────────────────────────
  const controller = new AbortController();
  onCleanup(() => controller.abort());

  streamResponses(client, target, json, label, messages, controller.signal);
  streamAgentStatus(client, target, activity, controller.signal);

  return (
    <box flexDirection="column" width="100%">
      <text bold color="cyan" paddingLeft={1}>
        {`${label} ${c.dim("— .exit to quit")}`}
      </text>
      {statusLine}
      <box flexDirection="column" marginTop={1}>
        {messageList}
      </box>
      {errorLine}
      <text marginTop={1} paddingLeft={1}>
        {promptLine}
      </text>
    </box>
  );
}

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
    // For workspace events, show which agent is active
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
    // Get current cursor to skip historical events
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
  messages: ReturnType<typeof signal<Message[]>>,
  abortSignal: AbortSignal,
): Promise<void> {
  const push = (entry: any) => {
    const msg = formatEntry(entry, json, label);
    if (msg) messages.value = [...messages.value, msg];
  };

  if (target.agent && !target.workspace) {
    // Get current cursor so we only show new messages
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

    // Read existing messages to get the latest id, so we skip history
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

function formatEntry(entry: any, json: boolean, label: string): Message | null {
  if (json) return { from: label, content: JSON.stringify(entry) };

  if (entry.type === "text" && entry.text) {
    return { from: label, content: entry.text };
  }
  if (entry.content) {
    return { from: entry.from ?? label, content: entry.content };
  }
  return null;
}

function highlightMentions(text: string): string {
  return text.replace(/@[\w-]+/g, (match) => c.yellow(match));
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
  const client = await AwClient.discover();

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

  const { waitUntilExit } = render(
    <ReplApp client={client} target={target} from={from} json={json} label={label} />,
  );

  await waitUntilExit();
  console.log("\nBye.");
  process.exit(0);
}
