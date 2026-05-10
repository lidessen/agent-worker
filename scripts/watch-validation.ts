#!/usr/bin/env bun
/**
 * watch-validation.ts — companion observability script for the
 * harness-led hierarchical validation checklist.
 *
 * Polls the validation harness's task ledger once per second and
 * prints every state transition + every new handoff (with the
 * resources it referenced). Run in a second terminal while the real
 * claude-code / codex agents drive the harness.
 *
 * Usage:
 *   bun run scripts/watch-validation.ts
 *   bun run scripts/watch-validation.ts --harness hierarchical-validation
 *
 * Checklist: docs/design/harness-led-hierarchical-agent-system/validation-checklist.md
 */

import { ensureDaemon } from "../packages/agent-worker/src/client.ts";

function parseArgs(): { harness: string; pollMs: number } {
  const args = process.argv.slice(2);
  let harness = "hierarchical-validation";
  let pollMs = 1000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--harness" && args[i + 1]) {
      harness = args[i + 1]!;
      i++;
    } else if (args[i] === "--poll-ms" && args[i + 1]) {
      pollMs = parseInt(args[i + 1]!, 10);
      i++;
    }
  }
  return { harness, pollMs };
}

function fmtTime(d = new Date()): string {
  return d.toTimeString().slice(0, 8);
}

function color(code: number, text: string): string {
  return process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
}
const dim = (s: string) => color(2, s);
const bold = (s: string) => color(1, s);
const red = (s: string) => color(31, s);
const green = (s: string) => color(32, s);
const yellow = (s: string) => color(33, s);
const blue = (s: string) => color(34, s);
const cyan = (s: string) => color(36, s);

interface TaskSummary {
  id: string;
  status: string;
  title: string;
  activeWakeId?: string;
}

async function main() {
  const { harness, pollMs } = parseArgs();
  console.log(dim(`[${fmtTime()}] connecting to daemon…`));

  const client = await ensureDaemon();
  console.log(
    dim(`[${fmtTime()}] watching @${harness} (poll every ${pollMs}ms — ctrl-c to stop)`),
  );

  const taskState = new Map<string, TaskSummary>();
  const seenHandoffs = new Set<string>();
  let lastChronicleCount = 0;

  async function tick() {
    try {
      const result = await client.listHarnessTasks(harness);

      for (const raw of result.tasks) {
        const t = raw as TaskSummary;
        const prev = taskState.get(t.id);
        if (!prev) {
          console.log(
            `${dim(`[${fmtTime()}]`)} ${green("task_new")}     ${bold(t.id)} [${yellow(t.status)}] ${t.title}`,
          );
        } else if (prev.status !== t.status) {
          console.log(
            `${dim(`[${fmtTime()}]`)} ${cyan("task_status")} ${bold(t.id)} ${prev.status} → ${yellow(t.status)}`,
          );
        } else if (prev.activeWakeId !== t.activeWakeId) {
          const change = t.activeWakeId ? `active=${t.activeWakeId}` : "active=cleared";
          console.log(`${dim(`[${fmtTime()}]`)} ${cyan("task_active")} ${bold(t.id)} ${change}`);
        }
        taskState.set(t.id, t);

        const detail = await client.getHarnessTask(harness, t.id);
        for (const raw of detail.handoffs) {
          const h = raw as {
            id: string;
            kind: string;
            summary: string;
            createdBy: string;
            resources?: string[];
          };
          if (!seenHandoffs.has(h.id)) {
            seenHandoffs.add(h.id);
            const resourcesNote =
              h.resources && h.resources.length > 0 ? ` resources=${h.resources.join(",")}` : "";
            console.log(
              `${dim(`[${fmtTime()}]`)} ${blue("handoff")}     ${bold(h.id)} [${h.kind}] by ${h.createdBy}: ${h.summary.slice(0, 120)}${resourcesNote}`,
            );
          }
        }
      }

      // Chronicle — print new entries since last tick.
      const chronicle = await client.readHarnessChronicle(harness, {
        category: "task",
        limit: 200,
      });
      if (chronicle.entries.length > lastChronicleCount) {
        const fresh = chronicle.entries.slice(lastChronicleCount);
        for (const entry of fresh) {
          console.log(
            `${dim(`[${fmtTime()}]`)} ${dim("chronicle")} ${dim(entry.author)} ${entry.content}`,
          );
        }
        lastChronicleCount = chronicle.entries.length;
      }
    } catch (err) {
      console.error(
        red(`[${fmtTime()}] poll failed: ${err instanceof Error ? err.message : String(err)}`),
      );
    }
  }

  process.on("SIGINT", () => {
    console.log(dim(`\n[${fmtTime()}] stopping watch`));
    process.exit(0);
  });
  process.on("SIGTERM", () => process.exit(0));

  // Initial snapshot + poll loop.
  while (true) {
    await tick();
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
