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
            activeAttemptId?: string;
          };
          const owner = t.ownerLeadId ? ` owner=${t.ownerLeadId}` : "";
          const active = t.activeAttemptId ? ` active=${t.activeAttemptId}` : "";
          console.log(`[${t.id}] ${t.title} [${t.status}]${owner}${active}`);
        }
        break;
      }
      case "get": {
        // Pick the first positional argument after "get" that is neither a
        // workspace token (@...) nor a flag (--...) as the task id. This
        // matches the `ls` command's flexible argument scanning.
        const id = args.slice(1).find((a) => !a.startsWith("@") && !a.startsWith("--"));
        if (!id) {
          console.error("Usage: aw task get <id> [@workspace]");
          process.exit(1);
        }
        const detail = await client.getWorkspaceTask(workspace, id);
        const t = detail.task as {
          id: string;
          title: string;
          goal: string;
          status: string;
          ownerLeadId?: string;
          activeAttemptId?: string;
          acceptanceCriteria?: string;
          artifactRefs: string[];
        };
        console.log(`Task ${t.id}`);
        console.log(`  title:  ${t.title}`);
        console.log(`  status: ${t.status}`);
        if (t.ownerLeadId) console.log(`  owner:  ${t.ownerLeadId}`);
        if (t.activeAttemptId) console.log(`  active: ${t.activeAttemptId}`);
        console.log(`  goal:   ${t.goal}`);
        if (t.acceptanceCriteria) console.log(`  accept: ${t.acceptanceCriteria}`);
        if (detail.attempts.length > 0) {
          console.log(`  attempts (${detail.attempts.length}):`);
          for (const raw of detail.attempts) {
            const a = raw as { id: string; agentName: string; status: string };
            console.log(`    - ${a.id} ${a.agentName} [${a.status}]`);
          }
        }
        if (detail.handoffs.length > 0) {
          console.log(`  handoffs (${detail.handoffs.length}):`);
          for (const raw of detail.handoffs) {
            const h = raw as { id: string; kind: string; summary: string };
            console.log(`    - ${h.id} ${h.kind}: ${h.summary}`);
          }
        }
        if (detail.artifacts.length > 0) {
          console.log(`  artifacts (${detail.artifacts.length}):`);
          for (const raw of detail.artifacts) {
            const x = raw as { id: string; kind: string; title: string; ref: string };
            console.log(`    - ${x.id} ${x.kind}: ${x.title} (${x.ref})`);
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
        const id = args.slice(1).find((a) => !a.startsWith("--") && !a.startsWith("@"));
        if (!id) {
          console.error(
            "Usage: aw task update <id> [@workspace] [--status ...] [--title ...] [--goal ...]",
          );
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
        const id = args.slice(1).find((a) => !a.startsWith("--") && !a.startsWith("@"));
        const worker = getFlag(args, "--to") ?? getFlag(args, "--worker");
        if (!id || !worker) {
          console.error("Usage: aw task dispatch <id> --to <worker> [@workspace]");
          process.exit(1);
        }
        const result = await client.dispatchWorkspaceTask(workspace, id, { worker });
        const t = result.task as { id: string; status: string };
        const att = result.attempt as { id: string };
        console.log(`Dispatched task ${t.id} [${t.status}] to @${worker} as attempt ${att.id}`);
        break;
      }
      case "complete": {
        const id = args.slice(1).find((a) => !a.startsWith("--") && !a.startsWith("@"));
        if (!id) {
          console.error("Usage: aw task complete <id> [@workspace] [--summary '...']");
          process.exit(1);
        }
        const summary = getFlag(args, "--summary");
        const result = await client.completeWorkspaceTask(workspace, id, { summary });
        const t = result.task as { id: string; status: string; title: string };
        console.log(`Task ${t.id} [${t.status}]: ${t.title}`);
        break;
      }
      case "abort": {
        const id = args.slice(1).find((a) => !a.startsWith("--") && !a.startsWith("@"));
        if (!id) {
          console.error("Usage: aw task abort <id> [@workspace] [--reason '...']");
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
