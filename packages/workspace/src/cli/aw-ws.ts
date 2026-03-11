#!/usr/bin/env bun
/**
 * aw-ws — workspace CLI for agent-worker.
 *
 * Inspired by moniro/agent-worker CLI design.
 *
 * Usage:
 *   aw-ws run <file> [--tag <tag>]           Run a workspace (one-shot, exits when done)
 *   aw-ws start <file> [--tag <tag>]         Start a persistent workspace
 *   aw-ws send <target> <message>            Send a message
 *   aw-ws peek [target]                      View conversation / channel messages
 *   aw-ws status [target]                    Show status
 *   aw-ws ls [target]                        List agents / channels
 *   aw-ws doc read <target>                  Read a shared document
 *   aw-ws doc write <target> --content "…"   Write a shared document
 *   aw-ws doc append <target> --content "…"  Append to a shared document
 *   aw-ws doc ls                             List shared documents
 *   aw-ws log [--follow] [--json]            View workspace events
 *   aw-ws stop [target]                      Stop workspace or agent
 *   aw-ws validate <file>                    Validate a workspace config
 *
 * Target syntax:
 *   alice           → agent "alice" in current workspace
 *   alice@review    → agent "alice" in workspace "review"
 *   @review         → broadcast to workspace "review"
 *   #general        → channel "general"
 */
import { WorkspaceDaemon } from "./daemon.ts";
import { loadWorkspaceDef } from "../config/index.ts";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { c, fmtTime } from "@agent-worker/shared";

// ── Paths ─────────────────────────────────────────────────────────────────

const AW_WS_DIR = `${tmpdir()}/aw-ws`;
const META_PATH = `${AW_WS_DIR}/current.json`;

// ── Target parsing ────────────────────────────────────────────────────────

interface Target {
  agent?: string;
  workspace?: string;
  channel?: string;
}

/**
 * Parse target syntax:
 *   "alice"          → { agent: "alice" }
 *   "alice@review"   → { agent: "alice", workspace: "review" }
 *   "@review"        → { workspace: "review" }
 *   "#general"       → { channel: "general" }
 */
function parseTarget(raw: string): Target {
  if (raw.startsWith("#")) {
    return { channel: raw.slice(1) };
  }
  if (raw.startsWith("@")) {
    return { workspace: raw.slice(1) };
  }
  if (raw.includes("@")) {
    const [agent, workspace] = raw.split("@", 2);
    return { agent, workspace };
  }
  return { agent: raw };
}

// ── Socket helper ─────────────────────────────────────────────────────────

interface Meta {
  socketPath: string;
  eventsPath: string;
  workspace: string;
  tag?: string;
  agents: string[];
  pid: number;
  startedAt: string;
}

async function loadMeta(): Promise<Meta> {
  if (!existsSync(META_PATH)) {
    console.error(
      `${c.red}No running workspace found.${c.reset} Start one with: aw-ws start <file>`,
    );
    process.exit(1);
  }
  return JSON.parse(await Bun.file(META_PATH).text());
}

async function daemonFetch(path: string, options?: RequestInit): Promise<Response> {
  const meta = await loadMeta();
  return fetch(`http://localhost${path}`, {
    ...options,
    unix: meta.socketPath,
  } as RequestInit);
}

// ── Commands ──────────────────────────────────────────────────────────────

async function cmdStart(args: string[], oneShot: boolean): Promise<void> {
  let source: string | undefined;
  let tag: string | undefined;
  const vars: Record<string, string> = {};
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tag" && args[i + 1]) {
      tag = args[++i];
    } else if (args[i] === "--var" && args[i + 1]) {
      const kv = args[++i];
      const eqIdx = kv.indexOf("=");
      if (eqIdx > 0) vars[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (!args[i].startsWith("-")) {
      source = args[i];
    }
  }

  if (!source) {
    console.error(
      `${c.red}Usage:${c.reset} aw-ws ${oneShot ? "run" : "start"} <config.yaml> [--tag <tag>] [--var key=value] [--dry-run]`,
    );
    process.exit(1);
  }

  if (!existsSync(source)) {
    console.error(`${c.red}File not found:${c.reset} ${source}`);
    process.exit(1);
  }

  const loadOpts = {
    tag,
    vars: Object.keys(vars).length > 0 ? vars : undefined,
    skipSetup: dryRun,
  };

  if (dryRun) {
    const resolved = await loadWorkspaceDef(source, loadOpts);
    console.log(`${c.bold}Workspace:${c.reset} ${resolved.def.name}`);
    if (tag) console.log(`${c.bold}Tag:${c.reset} ${tag}`);
    console.log(
      `${c.bold}Channels:${c.reset} ${(resolved.def.channels ?? ["general"]).join(", ")}`,
    );
    console.log(`${c.bold}Agents:${c.reset}`);
    for (const agent of resolved.agents) {
      const model = agent.model ? ` -m ${c.cyan}${agent.model.full}${c.reset}` : "";
      console.log(`  ${c.cyan}${agent.name}${c.reset} -b ${agent.runtime ?? "auto"}${model}`);
    }
    if (resolved.kickoff) {
      console.log(`${c.bold}Kickoff:${c.reset}`);
      console.log(`  ${c.dim}${resolved.kickoff.slice(0, 200)}${c.reset}`);
    }
    return;
  }

  // Ensure directory exists
  const { mkdirSync } = await import("node:fs");
  mkdirSync(AW_WS_DIR, { recursive: true });

  const daemon = new WorkspaceDaemon({
    source: await Bun.file(source).text(),
    loadOpts,
    dataDir: AW_WS_DIR,
  });

  const result = await daemon.start();

  // Write meta for client commands
  await Bun.write(
    META_PATH,
    JSON.stringify(
      {
        socketPath: result.socketPath,
        eventsPath: result.eventsPath,
        workspace: result.resolved.def.name,
        tag,
        agents: result.resolved.agents.map((a) => a.name),
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`${c.green}Workspace started${c.reset}`);
  console.log(`  name:      ${c.cyan}${result.resolved.def.name}${c.reset}`);
  if (tag) console.log(`  tag:       ${c.cyan}${tag}${c.reset}`);
  console.log(
    `  channels:  ${c.cyan}${(result.resolved.def.channels ?? ["general"]).join(", ")}${c.reset}`,
  );
  console.log(`  agents:`);
  for (const agent of result.resolved.agents) {
    const model = agent.model ? ` -m ${agent.model.full}` : "";
    console.log(`    ${c.cyan}${agent.name}${c.reset} -b ${agent.runtime ?? "auto"}${model}`);
  }
  console.log(`  socket:    ${c.dim}${result.socketPath}${c.reset}`);
  if (result.resolved.kickoff) {
    console.log(`  kickoff:   ${c.dim}sent${c.reset}`);
  }
  console.log();

  if (oneShot) {
    console.log(`${c.dim}Running one-shot... will exit when agents are idle.${c.reset}`);
    // Poll until all agents idle, then stop
    const pollIdle = async (): Promise<void> => {
      let idleCount = 0;
      while (idleCount < 3) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const res = await daemonFetch("/status");
          const data = (await res.json()) as {
            agents: Array<{ status: string; inboxCount: number }>;
          };
          const allIdle = data.agents.every((a) => a.status === "idle" && a.inboxCount === 0);
          if (allIdle) {
            idleCount++;
          } else {
            idleCount = 0;
          }
        } catch {
          break;
        }
      }
    };
    await pollIdle();
    console.log(`\n${c.green}All agents idle. Stopping workspace.${c.reset}`);
    await daemon.shutdown();
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(META_PATH);
    } catch {
      /* ignore */
    }
    return;
  }

  console.log(`${c.dim}Press Ctrl+C to stop.${c.reset}`);

  const shutdown = async () => {
    console.log(`\n${c.yellow}Shutting down workspace...${c.reset}`);
    await daemon.shutdown();
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(META_PATH);
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => {});
}

async function cmdSend(args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error(`${c.red}Usage:${c.reset} aw-ws send <target> <message> [--from <name>]`);
    process.exit(1);
  }

  const target = parseTarget(args[0]);
  let from: string | undefined;
  let content: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      from = args[++i];
    } else if (!args[i].startsWith("-")) {
      content = args[i];
    }
  }

  if (!content) {
    console.error(`${c.red}Usage:${c.reset} aw-ws send <target> "message"`);
    process.exit(1);
  }

  const body: Record<string, string | undefined> = {
    content,
    from: from ?? "user",
  };

  // Route based on target type
  if (target.channel) {
    body.channel = target.channel;
  } else if (target.agent) {
    body.to = target.agent;
  }

  const res = await daemonFetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    sent: boolean;
    messageId: string;
    channel: string;
    error?: string;
  };

  if (data.error) {
    console.error(`${c.red}Error:${c.reset} ${data.error}`);
    process.exit(1);
  }

  const targetStr = target.channel
    ? `#${target.channel}`
    : target.agent
      ? `@${target.agent}`
      : `#${data.channel}`;
  console.log(`${c.green}Sent${c.reset} → ${targetStr} [${c.dim}${data.messageId}${c.reset}]`);
}

async function cmdPeek(args: string[]): Promise<void> {
  let limit = 20;
  let targetStr: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    } else if (!args[i].startsWith("-")) {
      targetStr = args[i];
    }
  }

  if (targetStr) {
    const target = parseTarget(targetStr);

    if (target.channel) {
      // Read channel
      const res = await daemonFetch(`/channel?name=${target.channel}&limit=${limit}`);
      const data = (await res.json()) as {
        channel: string;
        messages: Array<{
          id: string;
          from: string;
          content: string;
          timestamp: string;
          mentions: string[];
          to?: string;
        }>;
      };

      console.log(`${c.bold}#${data.channel}${c.reset} (${data.messages.length} messages)\n`);
      printMessages(data.messages);
      return;
    }

    if (target.agent) {
      // Show agent inbox
      const res = await daemonFetch(`/inbox?agent=${target.agent}`);
      const data = (await res.json()) as {
        agent: string;
        entries: Array<{
          messageId: string;
          channel: string;
          priority: string;
          state: string;
          from?: string;
          content?: string;
          enqueuedAt: string;
        }>;
      };

      console.log(`${c.bold}@${data.agent} inbox${c.reset} (${data.entries.length} entries)\n`);

      if (data.entries.length === 0) {
        console.log(`  ${c.dim}(empty)${c.reset}`);
        return;
      }

      for (const entry of data.entries) {
        const priorityColor =
          entry.priority === "immediate" ? c.red : entry.priority === "normal" ? c.yellow : c.dim;

        console.log(
          `  [${c.dim}${entry.messageId.slice(0, 8)}${c.reset}] ` +
            `${priorityColor}${entry.priority}${c.reset} ` +
            `#${entry.channel} from:${entry.from ?? "?"}`,
        );
        if (entry.content) {
          console.log(`    ${entry.content.slice(0, 120)}`);
        }
      }
      return;
    }
  }

  // Default: show default channel
  const res = await daemonFetch(`/channel?name=general&limit=${limit}`);
  const data = (await res.json()) as {
    channel: string;
    messages: Array<{
      id: string;
      from: string;
      content: string;
      timestamp: string;
      mentions: string[];
      to?: string;
    }>;
  };

  console.log(`${c.bold}#${data.channel}${c.reset} (${data.messages.length} messages)\n`);
  printMessages(data.messages);
}

function printMessages(
  messages: Array<{
    id: string;
    from: string;
    content: string;
    timestamp: string;
    mentions: string[];
    to?: string;
  }>,
): void {
  for (const msg of messages) {
    const ts = `${c.dim}${fmtTime(new Date(msg.timestamp).getTime())}${c.reset}`;
    const dm = msg.to ? ` ${c.magenta}→ @${msg.to}${c.reset}` : "";
    console.log(`${ts} ${c.cyan}@${msg.from}${c.reset}${dm}`);
    for (const line of msg.content.split("\n")) {
      console.log(`  ${line}`);
    }
    console.log();
  }
}

async function cmdStatus(args: string[]): Promise<void> {
  const targetStr = args.find((a) => !a.startsWith("-"));

  const res = await daemonFetch("/status");
  const data = (await res.json()) as {
    name: string;
    tag?: string;
    agents: Array<{
      name: string;
      runtime?: string;
      model?: string;
      status: string;
      currentTask?: string;
      inboxCount: number;
      channels: string[];
    }>;
    channels: string[];
    loops: Array<{ name: string; running: boolean }>;
  };

  // If target is a specific agent, show only that agent
  if (targetStr) {
    const target = parseTarget(targetStr);
    if (target.agent) {
      const agent = data.agents.find((a) => a.name === target.agent);
      if (!agent) {
        console.error(`${c.red}Agent not found:${c.reset} ${target.agent}`);
        process.exit(1);
      }
      printAgentStatus(agent);
      return;
    }
  }

  // Full workspace status
  console.log(
    `${c.bold}Workspace:${c.reset} ${c.cyan}${data.name}${c.reset}${data.tag ? ` ${c.dim}(tag: ${data.tag})${c.reset}` : ""}`,
  );
  console.log(`${c.bold}Channels:${c.reset} ${data.channels.map((ch) => `#${ch}`).join(", ")}`);

  console.log(`\n${c.bold}Agents (${data.agents.length}):${c.reset}`);
  for (const agent of data.agents) {
    printAgentStatus(agent);
  }
}

function printAgentStatus(agent: {
  name: string;
  runtime?: string;
  model?: string;
  status: string;
  currentTask?: string;
  inboxCount: number;
  channels: string[];
}): void {
  const statusColor =
    agent.status === "running" ? c.green : agent.status === "idle" ? c.dim : c.yellow;
  const task = agent.currentTask ? ` — ${c.dim}${agent.currentTask}${c.reset}` : "";
  const inbox = agent.inboxCount > 0 ? ` ${c.yellow}[${agent.inboxCount} pending]${c.reset}` : "";
  const backend = agent.runtime
    ? ` ${c.dim}-b ${agent.runtime}${agent.model ? ` -m ${agent.model}` : ""}${c.reset}`
    : "";

  console.log(
    `  ${c.cyan}@${agent.name}${c.reset} ${statusColor}${agent.status}${c.reset}${task}${inbox}${backend}`,
  );
  console.log(`    channels: ${agent.channels.map((ch) => `#${ch}`).join(", ")}`);
}

async function cmdLs(args: string[]): Promise<void> {
  const targetStr = args.find((a) => !a.startsWith("-"));

  if (targetStr === "channels" || targetStr === "ch") {
    const res = await daemonFetch("/channels");
    const data = (await res.json()) as { channels: string[] };
    for (const ch of data.channels) {
      console.log(`  #${c.cyan}${ch}${c.reset}`);
    }
    return;
  }

  if (targetStr === "docs" || targetStr === "doc") {
    const res = await daemonFetch("/docs");
    const data = (await res.json()) as { docs: string[] };
    if (data.docs.length === 0) {
      console.log(`  ${c.dim}(no documents)${c.reset}`);
    } else {
      for (const doc of data.docs) {
        console.log(`  ${c.cyan}${doc}${c.reset}`);
      }
    }
    return;
  }

  // Default: list agents
  const res = await daemonFetch("/status");
  const data = (await res.json()) as {
    name: string;
    tag?: string;
    agents: Array<{
      name: string;
      runtime?: string;
      model?: string;
      status: string;
      inboxCount: number;
    }>;
  };

  console.log(
    `${c.bold}${data.name}${c.reset}${data.tag ? ` ${c.dim}(tag: ${data.tag})${c.reset}` : ""}\n`,
  );

  for (const agent of data.agents) {
    const statusColor =
      agent.status === "running" ? c.green : agent.status === "idle" ? c.dim : c.yellow;
    const inbox = agent.inboxCount > 0 ? ` ${c.yellow}[${agent.inboxCount}]${c.reset}` : "";
    const backend = agent.runtime ? ` ${c.dim}(${agent.runtime})${c.reset}` : "";

    console.log(
      `  ${c.cyan}@${agent.name}${c.reset} ${statusColor}${agent.status}${c.reset}${inbox}${backend}`,
    );
  }
}

async function cmdDoc(args: string[]): Promise<void> {
  const subcmd = args[0];

  if (!subcmd || subcmd === "ls" || subcmd === "list") {
    const res = await daemonFetch("/docs");
    const data = (await res.json()) as { docs: string[] };
    if (data.docs.length === 0) {
      console.log(`  ${c.dim}(no documents)${c.reset}`);
    } else {
      for (const doc of data.docs) {
        console.log(`  ${c.cyan}${doc}${c.reset}`);
      }
    }
    return;
  }

  if (subcmd === "read") {
    const name = args[1];
    if (!name) {
      console.error(`${c.red}Usage:${c.reset} aw-ws doc read <name>`);
      process.exit(1);
    }
    const res = await daemonFetch(`/doc?name=${encodeURIComponent(name)}`);
    const data = (await res.json()) as {
      name: string;
      content: string | null;
    };
    if (data.content === null) {
      console.error(`${c.red}Document not found:${c.reset} ${name}`);
      process.exit(1);
    }
    console.log(data.content);
    return;
  }

  if (subcmd === "write" || subcmd === "append") {
    const name = args[1];
    let content: string | undefined;
    let file: string | undefined;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--content" && args[i + 1]) {
        content = args[++i];
      } else if (args[i] === "--file" && args[i + 1]) {
        file = args[++i];
      }
    }

    if (!name || (!content && !file)) {
      console.error(
        `${c.red}Usage:${c.reset} aw-ws doc ${subcmd} <name> --content "..." | --file <path>`,
      );
      process.exit(1);
    }

    const body = content ?? (await Bun.file(file!).text());

    const res = await daemonFetch("/doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        content: body,
        mode: subcmd,
      }),
    });

    const data = (await res.json()) as { ok: boolean; error?: string };
    if (data.error) {
      console.error(`${c.red}Error:${c.reset} ${data.error}`);
      process.exit(1);
    }
    console.log(
      `${c.green}Document ${subcmd === "append" ? "appended" : "written"}:${c.reset} ${name}`,
    );
    return;
  }

  console.error(`${c.red}Unknown doc command:${c.reset} ${subcmd}. Use: read, write, append, ls`);
  process.exit(1);
}

async function cmdLog(args: string[]): Promise<void> {
  let follow = false;
  let jsonOutput = false;

  for (const arg of args) {
    if (arg === "--follow" || arg === "-f") follow = true;
    else if (arg === "--json") jsonOutput = true;
  }

  const cursorPath = `${AW_WS_DIR}/log-cursor`;
  let cursor = 0;
  try {
    cursor = parseInt(await Bun.file(cursorPath).text(), 10) || 0;
  } catch {
    /* first read */
  }

  const typeColors: Record<string, string> = {
    workspace_started: c.green,
    kickoff: c.cyan,
    instruction_start: c.blue,
    instruction_end: c.blue,
    agent_text: c.magenta,
    tool_call: c.yellow,
    error: c.red,
  };

  while (true) {
    const res = await daemonFetch(`/log?cursor=${cursor}`);
    const data = (await res.json()) as {
      entries: Array<{ ts: number; type: string; [key: string]: unknown }>;
      cursor: number;
    };

    if (data.entries.length > 0) {
      for (const entry of data.entries) {
        if (jsonOutput) {
          console.log(JSON.stringify(entry));
        } else {
          const ts = `${c.dim}${fmtTime(entry.ts)}${c.reset}`;
          const color = typeColors[entry.type] ?? c.reset;
          const tag = `${color}[${entry.type}]${c.reset}`;
          const agent = entry.agent ? ` ${c.cyan}@${entry.agent}${c.reset}` : "";

          switch (entry.type) {
            case "workspace_started":
              console.log(`${ts} ${tag} ${entry.name}${entry.tag ? ` (tag: ${entry.tag})` : ""}`);
              console.log(`  agents: ${(entry.agents as string[]).join(", ")}`);
              break;
            case "kickoff":
              console.log(`${ts} ${tag} #${entry.channel}: ${entry.content}`);
              break;
            case "instruction_start":
              console.log(`${ts} ${tag}${agent} "${(entry.instruction as string).slice(0, 100)}"`);
              break;
            case "instruction_end":
              console.log(`${ts} ${tag}${agent} ${entry.status}`);
              break;
            case "agent_text":
              console.log(`${ts} ${tag}${agent} ${(entry.text as string).slice(0, 120)}`);
              break;
            case "tool_call":
              console.log(`${ts} ${tag}${agent} ${entry.tool}`);
              break;
            case "error":
              console.log(`${ts} ${tag}${agent} ${entry.error}`);
              break;
            default:
              console.log(`${ts} ${tag}${agent} ${JSON.stringify(entry)}`);
          }
        }
      }
      cursor = data.cursor;
      await Bun.write(cursorPath, String(cursor));
    }

    if (!follow) break;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function cmdValidate(args: string[]): Promise<void> {
  const source = args.find((a) => !a.startsWith("-"));

  if (!source) {
    console.error(`${c.red}Usage:${c.reset} aw-ws validate <config.yaml>`);
    process.exit(1);
  }

  if (!existsSync(source)) {
    console.error(`${c.red}File not found:${c.reset} ${source}`);
    process.exit(1);
  }

  try {
    const resolved = await loadWorkspaceDef(source, { skipSetup: true });
    console.log(`${c.green}Valid${c.reset} workspace config\n`);
    console.log(`  name:      ${c.cyan}${resolved.def.name}${c.reset}`);
    console.log(`  channels:  ${(resolved.def.channels ?? ["general"]).join(", ")}`);
    console.log(`  agents:`);
    for (const agent of resolved.agents) {
      const model = agent.model ? ` -m ${c.cyan}${agent.model.full}${c.reset}` : "";
      console.log(`    ${c.cyan}${agent.name}${c.reset} -b ${agent.runtime ?? "auto"}${model}`);
    }
    if (resolved.def.setup?.length) {
      console.log(`  setup:     ${resolved.def.setup.length} step(s) ${c.dim}(skipped)${c.reset}`);
    }
    if (resolved.def.kickoff) {
      console.log(`  kickoff:   ${c.dim}defined${c.reset}`);
    }
  } catch (err) {
    console.error(`${c.red}Invalid:${c.reset} ${err}`);
    process.exit(1);
  }
}

async function cmdStop(args: string[]): Promise<void> {
  try {
    await daemonFetch("/stop", { method: "POST" });
    console.log(`${c.green}Workspace stopped.${c.reset}`);
  } catch {
    console.log(`${c.yellow}Workspace not reachable (may already be stopped).${c.reset}`);
  }
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(META_PATH);
    await unlink(`${AW_WS_DIR}/log-cursor`).catch(() => {});
  } catch {
    /* ignore */
  }
}

function printHelp(): void {
  const bin = "aw-ws";
  console.log(`
${c.bold}${bin}${c.reset} — workspace CLI for agent-worker

${c.bold}Workspace Commands:${c.reset}
  ${c.cyan}run${c.reset} <file> [options]                  Run workspace (one-shot, exits when idle)
  ${c.cyan}start${c.reset} <file> [options]                Start persistent workspace
    --tag <tag>                          Instance tag for isolation
    --var key=value                      Template variable (repeatable)
    --dry-run                            Show config without starting

${c.bold}Communication:${c.reset}
  ${c.cyan}send${c.reset} <target> "message" [--from name] Send a message
  ${c.cyan}peek${c.reset} [target] [--limit N]             View conversation / inbox

${c.bold}Status:${c.reset}
  ${c.cyan}status${c.reset} [target]                       Show workspace / agent status
  ${c.cyan}ls${c.reset} [channels|docs]                    List agents, channels, or docs

${c.bold}Documents:${c.reset}
  ${c.cyan}doc read${c.reset} <name>                       Read a shared document
  ${c.cyan}doc write${c.reset} <name> --content "…"        Write a shared document
  ${c.cyan}doc append${c.reset} <name> --content "…"       Append to a shared document
  ${c.cyan}doc ls${c.reset}                                 List shared documents

${c.bold}Debug:${c.reset}
  ${c.cyan}log${c.reset} [--follow] [--json]               View workspace events
  ${c.cyan}validate${c.reset} <file>                       Validate a workspace config

${c.bold}Lifecycle:${c.reset}
  ${c.cyan}stop${c.reset}                                   Stop the running workspace

${c.bold}Target Syntax:${c.reset}
  alice                                   Agent "alice"
  alice@review                            Agent "alice" in workspace "review"
  @review                                 Broadcast to workspace
  #general                                Channel "general"

${c.bold}Examples:${c.reset}
  ${bin} start examples/review.yaml --tag pr-123
  ${bin} run examples/chat.yaml
  ${bin} send #general "@alice Please review the code"
  ${bin} send alice "Fix the bug"                        # DM to alice
  ${bin} peek #code-review --limit 10
  ${bin} peek alice                                       # show alice's inbox
  ${bin} status
  ${bin} status alice
  ${bin} ls
  ${bin} ls channels
  ${bin} doc read spec.md
  ${bin} doc write notes.md --content "# Notes"
  ${bin} log --follow
  ${bin} validate examples/review.yaml
  ${bin} stop
`);
}

// ── Main ──────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "run":
  case "r":
    await cmdStart(args, true);
    break;
  case "start":
    await cmdStart(args, false);
    break;
  case "send":
  case "s":
    await cmdSend(args);
    break;
  case "peek":
  case "p":
    await cmdPeek(args);
    break;
  case "status":
  case "st":
    await cmdStatus(args);
    break;
  case "ls":
    await cmdLs(args);
    break;
  case "doc":
    await cmdDoc(args.slice(0));
    break;
  case "log":
  case "l":
    await cmdLog(args);
    break;
  case "validate":
  case "v":
    await cmdValidate(args);
    break;
  case "stop":
    await cmdStop(args);
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`${c.red}Unknown command: ${cmd}${c.reset}`);
    printHelp();
    process.exit(1);
}
