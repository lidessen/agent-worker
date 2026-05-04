/**
 * Thin wrapper over `git worktree` for attempt-scoped execution isolation.
 *
 * Design: docs/design/phase-1-worktree-isolation/README.md
 *
 * Callers provision worktrees through attempt-scoped MCP tools during a
 * running attempt. Branch naming is chosen by the caller; runtime code
 * allocates the worktree path. This module only executes git commands and
 * stays narrow on purpose.
 */

import { execa } from "execa";
import { existsSync, realpathSync } from "node:fs";
import { dirname, basename, join } from "node:path";

/**
 * macOS aliases `/var/folders/...` through `/private/`, so a caller
 * that passed a mkdtemp path sees git echo back the canonical form.
 * Canonicalise both sides before comparing so equality works even
 * when the worktree directory doesn't exist yet (in which case we
 * resolve the parent and append the last segment).
 */
function canonical(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    try {
      return join(realpathSync(dirname(p)), basename(p));
    } catch {
      return p;
    }
  }
}

export interface WorktreeEntry {
  path: string;
  branch: string;
  prunable: boolean;
}

/**
 * Run a git command inside the given repo, throwing on non-zero exit
 * with a clear, caller-facing error message.
 */
async function git(repoPath: string, args: string[]): Promise<string> {
  const result = await execa("git", ["-C", repoPath, ...args], { reject: false });
  if (result.exitCode !== 0) {
    const cmd = ["git", "-C", repoPath, ...args].join(" ");
    throw new Error(
      `git command failed (${cmd}): ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result.stdout;
}

/** Verify that `repoPath` points at an existing git repository. */
export async function assertGitRepo(repoPath: string): Promise<void> {
  if (!existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
  await git(repoPath, ["rev-parse", "--git-dir"]);
}

/** Parse `git worktree list --porcelain` into structured records. */
export async function listWorktrees(repoPath: string): Promise<WorktreeEntry[]> {
  await assertGitRepo(repoPath);
  const out = await git(repoPath, ["worktree", "list", "--porcelain"]);
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> | null = null;
  for (const raw of out.split("\n")) {
    const line = raw.trimEnd();
    if (line === "") {
      if (current?.path) {
        entries.push({
          path: current.path,
          branch: current.branch ?? "",
          prunable: current.prunable ?? false,
        });
      }
      current = null;
      continue;
    }
    if (!current) current = {};
    if (line.startsWith("worktree ")) {
      current.path = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      // git prints "refs/heads/branch-name"
      const ref = line.slice("branch ".length);
      current.branch = ref.replace(/^refs\/heads\//, "");
    } else if (line === "prunable") {
      current.prunable = true;
    }
  }
  if (current?.path) {
    entries.push({
      path: current.path,
      branch: current.branch ?? "",
      prunable: current.prunable ?? false,
    });
  }
  return entries;
}

/** Prune worktree metadata for directories that no longer exist. */
export async function pruneWorktrees(repoPath: string): Promise<void> {
  await assertGitRepo(repoPath);
  await git(repoPath, ["worktree", "prune"]);
}

/**
 * Ensure a worktree at `worktreePath` exists on `branch`, forked from
 * `baseBranch` if the branch is new. Idempotent and restart-safe:
 *
 *   1. If the worktree is already registered on the correct branch,
 *      no-op.
 *   2. If git knows about the worktree but the directory is gone
 *      (prunable), prune first then re-provision.
 *   3. If the branch already exists (from a prior run), attach the
 *      worktree without creating a new branch.
 *   4. Otherwise, create the branch off of `baseBranch` as part of
 *      `git worktree add -b`.
 */
export async function provisionWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseBranch: string,
): Promise<void> {
  await assertGitRepo(repoPath);

  // Idempotency: check existing worktrees. Canonicalise paths so
  // /var vs /private/var (macOS) comparisons succeed even when the
  // worktree directory has been removed out from under us.
  const wtExists = existsSync(worktreePath);
  const wtCanon = canonical(worktreePath);
  const existing = await listWorktrees(repoPath);
  const match = existing.find((w) => canonical(w.path) === wtCanon);

  if (match && match.branch === branch && wtExists && !match.prunable) {
    return; // Already good.
  }

  if (match && (!wtExists || match.prunable)) {
    // Stale registration — physically absent or marked prunable.
    // `git worktree prune` alone won't remove a fresh stale ref,
    // so use `remove --force` which tolerates a missing directory.
    try {
      await git(repoPath, ["worktree", "remove", "--force", worktreePath]);
    } catch {
      // Fall back to prune; if that still fails we'll surface it
      // on the add below.
    }
    await pruneWorktrees(repoPath).catch(() => {});
  }

  // Does the branch already exist?
  let branchExists = false;
  try {
    await git(repoPath, ["rev-parse", "--verify", `refs/heads/${branch}`]);
    branchExists = true;
  } catch {
    branchExists = false;
  }

  if (branchExists) {
    await git(repoPath, ["worktree", "add", worktreePath, branch]);
  } else {
    await git(repoPath, ["worktree", "add", "-b", branch, worktreePath, baseBranch]);
  }
}

/**
 * Remove a worktree. Uses `--force` so uncommitted changes are
 * discarded — callers who care about preserving work should commit
 * before calling this.
 */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await assertGitRepo(repoPath);
  // Use `|| true` equivalent — if the worktree is already gone we
  // still want to prune stray metadata, so catch and continue.
  try {
    await git(repoPath, ["worktree", "remove", "--force", worktreePath]);
  } catch (err) {
    // If the worktree doesn't exist any more, that's fine. Anything
    // else bubbles up after the prune attempt below.
    if (!(err instanceof Error) || !/not a working tree/i.test(err.message)) {
      await pruneWorktrees(repoPath).catch(() => {
        // prune is best-effort on the error path
      });
      throw err;
    }
  }
  await pruneWorktrees(repoPath).catch(() => {
    // Best-effort: missing refs shouldn't block removal.
  });
}
