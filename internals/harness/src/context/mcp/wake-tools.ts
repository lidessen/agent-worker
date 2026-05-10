/**
 * Wake-scoped MCP tools — injected into a worker's toolset at the start of
 * each run, closure-bound to the run's active Wake. The Wake id is captured
 * here once; tools that mutate the Wake (worktree_create / worktree_remove)
 * reach back through the harness state store rather than re-querying
 * "the active Wake" so a multi-tool turn against a single Wake sees
 * consistent state.
 *
 * Lifecycle: created per-run by the orchestrator via `createWakeTools(...)`.
 * Discarded at the end of the run. On the next run a fresh closure is built
 * with whatever the active Wake is at that moment (which may have
 * transitioned to a different Wake id, or no Wake at all if the agent is
 * between dispatches).
 *
 * Renamed from attempt-tools.ts per
 * design/decisions/005-session-orchestration-model.md.
 */

import { join } from "node:path";
import type { Worktree, HarnessStateStore } from "../../state/index.ts";
import { provisionWorktree, removeWorktree } from "../../worktree.ts";

/** Tool surface bound to a single Wake. */
export interface WakeScopedTools {
  worktree_create: (args: {
    name: string;
    repo: string;
    branch: string;
    base_branch?: string;
  }) => Promise<string>;
  worktree_list: () => Promise<string>;
  worktree_remove: (args: { name: string }) => Promise<string>;
}

export interface CreateWakeToolsOptions {
  /** Harness state store — the Wake is read/updated here. */
  stateStore: HarnessStateStore;
  /** Harness key (`name` or `name:tag`) — used for filesystem path layout. */
  harnessKey: string;
  /** Daemon data directory — root of the harness-data tree. */
  dataDir: string;
}

/**
 * Build the Wake-scoped tool set bound to a specific Wake. Caller
 * (orchestrator) decides whether `wakeId` is set; when the agent has no
 * active Wake the orchestrator should pass an empty tool object instead of
 * calling this factory.
 */
export function createWakeTools(
  agentName: string,
  wakeId: string,
  opts: CreateWakeToolsOptions,
): WakeScopedTools {
  const { stateStore, harnessKey, dataDir } = opts;
  const safeKey = harnessKey.replace(/:/g, "--");
  const worktreesRoot = join(dataDir, "harness-data", safeKey, "worktrees", wakeId);

  /**
   * Re-read the Wake before any mutation so concurrent tool calls inside a
   * single turn see each other's writes. Throws if the Wake has been
   * concurrently transitioned to a terminal state — in that case any
   * further worktree mutation is a logic error from the caller.
   */
  async function loadWake(): Promise<{
    wake: import("../../state/types.ts").Wake;
  }> {
    const wake = await stateStore.getWake(wakeId);
    if (!wake) {
      throw new Error(`Wake ${wakeId} not found.`);
    }
    if (wake.agentName !== agentName) {
      throw new Error(
        `Wake ${wakeId} belongs to @${wake.agentName}, not @${agentName}.`,
      );
    }
    if (wake.status !== "running") {
      throw new Error(
        `Wake ${wakeId} is ${wake.status}; cannot mutate worktrees on a non-running Wake.`,
      );
    }
    return { wake };
  }

  return {
    async worktree_create(args): Promise<string> {
      // Validate inputs up front — caller decided the branch name and the
      // worktree's Wake-scoped slug, runtime doesn't generate either.
      if (!args.name || typeof args.name !== "string") {
        return "Error: 'name' is required and must be a string.";
      }
      if (!args.repo || typeof args.repo !== "string") {
        return "Error: 'repo' is required and must be an absolute path to a git repository.";
      }
      if (!args.branch || typeof args.branch !== "string") {
        return "Error: 'branch' is required (caller decides naming convention).";
      }
      const baseBranch = args.base_branch ?? "main";

      const { wake } = await loadWake();
      const existing = wake.worktrees ?? [];
      if (existing.some((w) => w.name === args.name)) {
        return `Error: Wake ${wakeId} already has a worktree named "${args.name}". Pick a different name or call worktree_remove first.`;
      }

      const worktreePath = join(worktreesRoot, args.name);
      try {
        await provisionWorktree(args.repo, worktreePath, args.branch, baseBranch);
      } catch (err) {
        return `Error provisioning worktree: ${err instanceof Error ? err.message : String(err)}`;
      }

      const entry: Worktree = {
        name: args.name,
        repoPath: args.repo,
        branch: args.branch,
        baseBranch,
        path: worktreePath,
        createdAt: Date.now(),
      };

      try {
        await stateStore.updateWake(wakeId, {
          worktrees: [...existing, entry],
        });
      } catch (err) {
        // Best-effort rollback so we don't leak a worktree the Wake
        // doesn't know about.
        try {
          await removeWorktree(args.repo, worktreePath);
        } catch {
          /* swallow secondary failure */
        }
        return `Error recording worktree on Wake: ${err instanceof Error ? err.message : String(err)}`;
      }

      return `worktree[${entry.name}]: ${entry.path} (branch ${entry.branch} from ${entry.baseBranch})`;
    },

    async worktree_list(): Promise<string> {
      const { wake } = await loadWake();
      const worktrees = wake.worktrees ?? [];
      if (worktrees.length === 0) return "No worktrees on this Wake.";
      return worktrees
        .map(
          (wt) =>
            `- ${wt.name}: ${wt.path} (branch ${wt.branch} from ${wt.baseBranch}, repo ${wt.repoPath})`,
        )
        .join("\n");
    },

    async worktree_remove(args): Promise<string> {
      if (!args.name || typeof args.name !== "string") {
        return "Error: 'name' is required.";
      }
      const { wake } = await loadWake();
      const existing = wake.worktrees ?? [];
      const target = existing.find((w) => w.name === args.name);
      if (!target) {
        return `Error: Wake ${wakeId} has no worktree named "${args.name}".`;
      }
      try {
        await removeWorktree(target.repoPath, target.path);
      } catch (err) {
        return `Error removing worktree: ${err instanceof Error ? err.message : String(err)}`;
      }
      try {
        await stateStore.updateWake(wakeId, {
          worktrees: existing.filter((w) => w.name !== args.name),
        });
      } catch (err) {
        return `Worktree removed but could not update Wake record: ${err instanceof Error ? err.message : String(err)}`;
      }
      return `Removed worktree[${target.name}]. Branch ${target.branch} preserved.`;
    },
  };
}

/** Tool definition metadata for the Wake-scoped tools — same shape as `HARNESS_TOOL_DEFS`. */
export const WAKE_TOOL_DEFS = {
  worktree_create: {
    description:
      "Provision a git worktree for the current Wake. Caller decides `name` (Wake-scoped unique) and `branch` name. Harness runtime allocates the path. Provisioned worktrees are torn down automatically when the Wake transitions to a terminal status.",
    parameters: {
      name: {
        type: "string",
        description: "Wake-scoped unique identifier for this worktree (e.g. 'main', 'core').",
      },
      repo: {
        type: "string",
        description: "Absolute path to the source git repository.",
      },
      branch: {
        type: "string",
        description: "Branch name to create or attach. Caller decides naming.",
      },
      base_branch: {
        type: "string",
        description: "Branch to fork from when creating a new branch. Defaults to 'main'.",
      },
    },
    required: ["name", "repo", "branch"],
  },
  worktree_list: {
    description: "List the worktrees attached to the current Wake.",
    parameters: {},
    required: [],
  },
  worktree_remove: {
    description:
      "Remove a worktree from the current Wake before it ends. Branch is preserved; only the working directory is unlinked. Cleanup is automatic on Wake terminal status, so this is mostly for recovering from a mistaken create.",
    parameters: {
      name: {
        type: "string",
        description: "Worktree name to remove (matches `worktree_create.name`).",
      },
    },
    required: ["name"],
  },
} as const;
