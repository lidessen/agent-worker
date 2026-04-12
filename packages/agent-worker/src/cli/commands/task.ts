import { ensureDaemon } from "../../client.ts";
import { wantsHelp } from "../output.ts";

/**
 * `aw task <ls|get> [...args]` — read-only view of the workspace task ledger.
 *
 * Mutation (create, update, dispatch) stays in the agent-facing MCP tools
 * for now; exposing it to the CLI invites confusion over who owns the
 * ledger. Keep the CLI strictly observational.
 */
export async function task(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    printUsage();
    return;
  }

  const sub = args[0];
  if (!sub || !["ls", "get"].includes(sub)) {
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
        const id = args[1];
        if (!id || id.startsWith("@") || id.startsWith("--")) {
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
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function printUsage(): void {
  console.log(
    `Usage: aw task <ls|get> [options]

  aw task ls [@workspace] [--status draft,open] [--owner <name>]
  aw task get <id> [@workspace]`,
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
  return idx >= 0 ? args[idx + 1] : undefined;
}
