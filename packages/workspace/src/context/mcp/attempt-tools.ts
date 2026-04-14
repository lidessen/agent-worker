/**
 * Attempt-scoped MCP tools — injected into a worker's toolset
 * at the start of each run, closure-bound to the run's active
 * attempt. The attempt id is captured here once; tools that
 * mutate the attempt (worktree_create / worktree_remove) reach
 * back through the workspace state store rather than re-querying
 * "the active attempt" so a multi-tool turn against a single
 * attempt sees consistent state.
 *
 * Lifecycle: created per-run by the orchestrator via
 * `createAttemptTools(...)`. Discarded at the end of the run.
 * On the next run a fresh closure is built with whatever the
 * active attempt is at that moment (which may have transitioned
 * to a different attempt id, or no attempt at all if the agent
 * is between dispatches).
 *
 * See docs/design/phase-1-worktree-isolation/README.md (v3).
 */

import { join } from "node:path";
import type { Worktree, WorkspaceStateStore } from "../../state/index.ts";
import { provisionWorktree, removeWorktree } from "../../worktree.ts";

/** Tool surface bound to a single attempt. */
export interface AttemptScopedTools {
  worktree_create: (args: {
    name: string;
    repo: string;
    branch: string;
    base_branch?: string;
  }) => Promise<string>;
  worktree_list: () => Promise<string>;
  worktree_remove: (args: { name: string }) => Promise<string>;
}

export interface CreateAttemptToolsOptions {
  /** Workspace state store — the attempt is read/updated here. */
  stateStore: WorkspaceStateStore;
  /** Workspace key (`name` or `name:tag`) — used for filesystem path layout. */
  workspaceKey: string;
  /** Daemon data directory — root of the workspace-data tree. */
  dataDir: string;
}

/**
 * Build the attempt-scoped tool set bound to a specific attempt.
 * Caller (orchestrator) decides whether `attemptId` is set; when
 * the agent has no active attempt the orchestrator should pass an
 * empty tool object instead of calling this factory.
 */
export function createAttemptTools(
  agentName: string,
  attemptId: string,
  opts: CreateAttemptToolsOptions,
): AttemptScopedTools {
  const { stateStore, workspaceKey, dataDir } = opts;
  const safeKey = workspaceKey.replace(/:/g, "--");
  const worktreesRoot = join(dataDir, "workspace-data", safeKey, "worktrees", attemptId);

  /**
   * Re-read the attempt before any mutation so concurrent
   * tool calls inside a single turn see each other's writes.
   * Throws if the attempt has been concurrently transitioned
   * to a terminal state — in that case any further worktree
   * mutation is a logic error from the caller.
   */
  async function loadAttempt(): Promise<{
    attempt: import("../../state/types.ts").Attempt;
  }> {
    const attempt = await stateStore.getAttempt(attemptId);
    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found.`);
    }
    if (attempt.agentName !== agentName) {
      throw new Error(
        `Attempt ${attemptId} belongs to @${attempt.agentName}, not @${agentName}.`,
      );
    }
    if (attempt.status !== "running") {
      throw new Error(
        `Attempt ${attemptId} is ${attempt.status}; cannot mutate worktrees on a non-running attempt.`,
      );
    }
    return { attempt };
  }

  return {
    async worktree_create(args): Promise<string> {
      // Validate inputs up front — caller decided the branch
      // name and the worktree's attempt-scoped slug, runtime
      // doesn't generate either.
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

      const { attempt } = await loadAttempt();
      const existing = attempt.worktrees ?? [];
      if (existing.some((w) => w.name === args.name)) {
        return `Error: attempt ${attemptId} already has a worktree named "${args.name}". Pick a different name or call worktree_remove first.`;
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
        await stateStore.updateAttempt(attemptId, {
          worktrees: [...existing, entry],
        });
      } catch (err) {
        // Best-effort rollback so we don't leak a worktree the
        // attempt doesn't know about.
        try {
          await removeWorktree(args.repo, worktreePath);
        } catch {
          /* swallow secondary failure */
        }
        return `Error recording worktree on attempt: ${err instanceof Error ? err.message : String(err)}`;
      }

      return `worktree[${entry.name}]: ${entry.path} (branch ${entry.branch} from ${entry.baseBranch})`;
    },

    async worktree_list(): Promise<string> {
      const { attempt } = await loadAttempt();
      const worktrees = attempt.worktrees ?? [];
      if (worktrees.length === 0) return "No worktrees on this attempt.";
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
      const { attempt } = await loadAttempt();
      const existing = attempt.worktrees ?? [];
      const target = existing.find((w) => w.name === args.name);
      if (!target) {
        return `Error: attempt ${attemptId} has no worktree named "${args.name}".`;
      }
      try {
        await removeWorktree(target.repoPath, target.path);
      } catch (err) {
        return `Error removing worktree: ${err instanceof Error ? err.message : String(err)}`;
      }
      try {
        await stateStore.updateAttempt(attemptId, {
          worktrees: existing.filter((w) => w.name !== args.name),
        });
      } catch (err) {
        return `Worktree removed but could not update attempt record: ${err instanceof Error ? err.message : String(err)}`;
      }
      return `Removed worktree[${target.name}]. Branch ${target.branch} preserved.`;
    },
  };
}

/** Tool definition metadata for the attempt-scoped tools — same shape as `WORKSPACE_TOOL_DEFS`. */
export const ATTEMPT_TOOL_DEFS = {
  worktree_create: {
    description:
      "Provision a git worktree for the current attempt. Caller decides `name` (attempt-scoped unique) and `branch` name. Workspace runtime allocates the path. Provisioned worktrees are torn down automatically when the attempt transitions to a terminal status.",
    parameters: {
      name: {
        type: "string",
        description: "Attempt-scoped unique identifier for this worktree (e.g. 'main', 'core').",
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
    description: "List the worktrees attached to the current attempt.",
    parameters: {},
    required: [],
  },
  worktree_remove: {
    description:
      "Remove a worktree from the current attempt before it ends. Branch is preserved; only the working directory is unlinked. Cleanup is automatic on attempt terminal status, so this is mostly for recovering from a mistaken create.",
    parameters: {
      name: {
        type: "string",
        description: "Worktree name to remove (matches `worktree_create.name`).",
      },
    },
    required: ["name"],
  },
} as const;
