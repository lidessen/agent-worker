import { ensureDaemon } from "../../client.ts";
import { wantsHelp } from "../output.ts";

/**
 * `aw task <ls|get|new|update|dispatch>` — operator surface for the
 * workspace task ledger. Read paths (ls, get) are strictly observational.
 * Mutation paths (new, update, dispatch) let a human drive the system
 * without needing an agent in the loop.
 */
export async function task(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    printUsage();
    return;
  }

  const sub = args[0];
  const validSubs = ["ls", "get", "new", "update", "dispatch", "complete", "abort"];
  if (!sub || !validSubs.includes(sub)) {
    printUsage();
    process.exit(1);
  }

  const workspace = extractWorkspace(args) ?? "global";

  try {
    const client = await ensureDaemon();

    switch (sub) {
      case "ls": {
        const status = getFlag(args, "--status");
        const owner = getFlag(args, "--owner");
        const result = await client.listWorkspaceTasks(workspace, {
          status: status ?? undefined,
          ownerLeadId: owner ?? undefined,
        });
        if (result.tasks.length === 0) {
          console.log("No tasks.");
          return;
        }
        for (const raw of result.tasks) {
          const t = raw as {
            id: string;
            title: string;
            status: string;
            ownerLeadId?: string;
            activeWakeId?: string;
          };
          const owner = t.ownerLeadId ? ` owner=${t.ownerLeadId}` : "";
          const active = t.activeWakeId ? ` active=${t.activeWakeId}` : "";
          console.log(`[${t.id}] ${t.title} [${t.status}]${owner}${active}`);
        }
        break;
      }
      case "get": {
        const id = findTaskId(args);
        if (!id) {
          console.error("Usage: aw task get <id> [@workspace]");
          process.exit(1);
        }
        if (!looksLikeTaskId(id)) {
          console.error(
            `Error: '${id}' does not look like a task id (expected task_<hex>). ` +
              "Use 'aw task ls' to see valid ids.",
          );
          process.exit(1);
        }
        const detail = await client.getWorkspaceTask(workspace, id);
        const t = detail.task as {
          id: string;
          title: string;
          goal: string;
          status: string;
          ownerLeadId?: string;
          activeWakeId?: string;
          acceptanceCriteria?: string;
        };
        console.log(`Task ${t.id}`);
        console.log(`  title:  ${t.title}`);
        console.log(`  status: ${t.status}`);
        if (t.ownerLeadId) console.log(`  owner:  ${t.ownerLeadId}`);
        if (t.activeWakeId) console.log(`  active: ${t.activeWakeId}`);
        console.log(`  goal:   ${t.goal}`);
        if (t.acceptanceCriteria) console.log(`  accept: ${t.acceptanceCriteria}`);
        if (detail.wakes.length > 0) {
          console.log(`  wakes (${detail.wakes.length}):`);
          for (const raw of detail.wakes) {
            const w = raw as { id: string; agentName: string; status: string };
            console.log(`    - ${w.id} ${w.agentName} [${w.status}]`);
          }
        }
        if (detail.handoffs.length > 0) {
          console.log(`  handoffs (${detail.handoffs.length}):`);
          for (const raw of detail.handoffs) {
            const h = raw as { id: string; kind: string; summary: string; resources: string[] };
            console.log(`    - ${h.id} ${h.kind}: ${h.summary}`);
            if (h.resources && h.resources.length > 0) {
              console.log(`      resources: ${h.resources.join(", ")}`);
            }
          }
        }
        break;
      }
      case "new": {
        // First positional after "new" that isn't a flag / workspace → title.
        const title = args.slice(1).find((a) => !a.startsWith("--") && !a.startsWith("@"));
        const goal = getFlag(args, "--goal");
        if (!title || !goal) {
          console.error(
            "Usage: aw task new <title> --goal '...' [@workspace] [--status ...] [--owner ...]",
          );
          process.exit(1);
        }
        const result = await client.createWorkspaceTask(workspace, {
          title,
          goal,
          status: getFlag(args, "--status"),
          ownerLeadId: getFlag(args, "--owner"),
          acceptanceCriteria: getFlag(args, "--accept"),
          sourceKind: "cli",
        });
        const t = result.task as { id: string; status: string };
        console.log(`Created task ${t.id} [${t.status}]: ${title}`);
        break;
      }
      case "update": {
        const id = findTaskId(args);
        if (!id) {
          console.error(
            "Usage: aw task update <id> [@workspace] [--status ...] [--title ...] [--goal ...]",
          );
          process.exit(1);
        }
        if (!looksLikeTaskId(id)) {
          console.error(`Error: '${id}' does not look like a task id (expected task_<hex>).`);
          process.exit(1);
        }
        const patch = {
          status: getFlag(args, "--status"),
          title: getFlag(args, "--title"),
          goal: getFlag(args, "--goal"),
          ownerLeadId: getFlag(args, "--owner"),
          acceptanceCriteria: getFlag(args, "--accept"),
        };
        const hasAny = Object.values(patch).some((v) => v !== undefined);
        if (!hasAny) {
          console.error("Provide at least one of --status/--title/--goal/--owner/--accept");
          process.exit(1);
        }
        const result = await client.updateWorkspaceTask(workspace, id, patch);
        const t = result.task as { id: string; status: string; title: string };
        console.log(`Updated task ${t.id} [${t.status}]: ${t.title}`);
        break;
      }
      case "dispatch": {
        const id = findTaskId(args);
        const worker = getFlag(args, "--to") ?? getFlag(args, "--worker");
        if (!id || !worker) {
          console.error("Usage: aw task dispatch <id> --to <worker> [@workspace]");
          process.exit(1);
        }
        if (!looksLikeTaskId(id)) {
          console.error(`Error: '${id}' does not look like a task id (expected task_<hex>).`);
          process.exit(1);
        }
        const result = await client.dispatchWorkspaceTask(workspace, id, { worker });
        const t = result.task as { id: string; status: string };
        const w = result.wake as { id: string };
        console.log(`Dispatched task ${t.id} [${t.status}] to @${worker} as Wake ${w.id}`);
        break;
      }
      case "complete": {
        const id = findTaskId(args);
        if (!id) {
          console.error("Usage: aw task complete <id> [@workspace] [--summary '...']");
          process.exit(1);
        }
        if (!looksLikeTaskId(id)) {
          console.error(`Error: '${id}' does not look like a task id (expected task_<hex>).`);
          process.exit(1);
        }
        const summary = getFlag(args, "--summary");
        const result = await client.completeWorkspaceTask(workspace, id, { summary });
        const t = result.task as { id: string; status: string; title: string };
        console.log(`Task ${t.id} [${t.status}]: ${t.title}`);
        break;
      }
      case "abort": {
        const id = findTaskId(args);
        if (!id) {
          console.error("Usage: aw task abort <id> [@workspace] [--reason '...']");
          process.exit(1);
        }
        if (!looksLikeTaskId(id)) {
          console.error(`Error: '${id}' does not look like a task id (expected task_<hex>).`);
          process.exit(1);
        }
        const reason = getFlag(args, "--reason");
        const result = await client.abortWorkspaceTask(workspace, id, { reason });
        const t = result.task as { id: string; status: string; title: string };
        console.log(`Task ${t.id} [${t.status}]: ${t.title}`);
        break;
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function printUsage(): void {
  console.log(
    `Usage: aw task <ls|get|new|update|dispatch|complete|abort> [options]

  aw task ls [@workspace] [--status draft,open] [--owner <name>]
  aw task get <id> [@workspace]
  aw task new <title> --goal '...' [@workspace] [--status ...] [--owner ...] [--accept ...]
  aw task update <id> [@workspace] [--status ...] [--title ...] [--goal ...] [--owner ...]
  aw task dispatch <id> --to <worker> [@workspace]
  aw task complete <id> [@workspace] [--summary '...']
  aw task abort <id> [@workspace] [--reason '...']`,
  );
}

function extractWorkspace(args: string[]): string | undefined {
  for (const arg of args) {
    if (arg.startsWith("@")) return arg.slice(1);
  }
  return undefined;
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx < 0) return undefined;
  const value = args[idx + 1];
  // Guard against the next arg being another flag: `aw task ls --status --owner foo`
  // used to silently pass "--owner" as the status value.
  if (!value || value.startsWith("--") || value.startsWith("@")) return undefined;
  return value;
}

/**
 * Find the first positional task id in the args. Skips --flag tokens and
 * @workspace tokens, and also skips any token that immediately follows a
 * known flag (because that token is the flag's value).
 *
 * Also validates that the candidate looks like a real task id prefix so
 * the user gets a clear error on typos like `aw task complete --summary 'x'`
 * (which would otherwise silently treat "x" as the id and return a 404).
 */
function findTaskId(args: string[]): string | undefined {
  // Any token that *follows* a flag is that flag's value, not the id.
  const valueIndices = new Set<number>();
  for (let i = 1; i < args.length; i++) {
    if (args[i]!.startsWith("--")) {
      valueIndices.add(i + 1);
    }
  }
  for (let i = 1; i < args.length; i++) {
    if (valueIndices.has(i)) continue;
    const a = args[i]!;
    if (a.startsWith("--") || a.startsWith("@")) continue;
    return a;
  }
  return undefined;
}

function looksLikeTaskId(id: string): boolean {
  // Store ids use a `task_<hex>` prefix. Accept either that exact shape or
  // anything containing an underscore followed by hex as a rough sanity
  // check so operator errors fail fast.
  return /^task_[0-9a-f]{6,}$/i.test(id);
}
