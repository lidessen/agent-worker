import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import {
  provisionWorktree,
  removeWorktree,
  listWorktrees,
  pruneWorktrees,
  assertGitRepo,
} from "../src/worktree.ts";

/** Initialise a throwaway git repo with a single commit on `main`. */
async function makeScratchRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "aw-worktree-test-"));
  await execa("git", ["-C", dir, "init", "-b", "main"]);
  await execa("git", ["-C", dir, "config", "user.email", "t@example.com"]);
  await execa("git", ["-C", dir, "config", "user.name", "tester"]);
  writeFileSync(join(dir, "README.md"), "scratch\n");
  await execa("git", ["-C", dir, "add", "README.md"]);
  await execa("git", ["-C", dir, "commit", "-m", "initial"]);
  return dir;
}

describe("worktree", () => {
  let repo: string;
  let base: string;
  let wt: string;

  beforeEach(async () => {
    // Canonicalise the temp roots up front — macOS tmpdir routes
    // /var/folders through a /private/ symlink, and git echoes the
    // canonical path back in `git worktree list`, so test assertions
    // that compare paths need to start from the canonical form.
    repo = realpathSync(await makeScratchRepo());
    base = realpathSync(mkdtempSync(join(tmpdir(), "aw-worktree-host-")));
    wt = join(base, "coder-a");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(base, { recursive: true, force: true });
  });

  test("assertGitRepo passes for a valid repo", async () => {
    await expect(assertGitRepo(repo)).resolves.toBeUndefined();
  });

  test("assertGitRepo throws when the path is not a git repo", async () => {
    const notRepo = mkdtempSync(join(tmpdir(), "aw-not-a-repo-"));
    try {
      await expect(assertGitRepo(notRepo)).rejects.toThrow();
    } finally {
      rmSync(notRepo, { recursive: true, force: true });
    }
  });

  test("provisionWorktree creates a worktree on a new branch", async () => {
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    expect(existsSync(wt)).toBe(true);
    expect(existsSync(join(wt, "README.md"))).toBe(true);

    const list = await listWorktrees(repo);
    const entry = list.find((w) => w.path === wt);
    expect(entry).toBeDefined();
    expect(entry!.branch).toBe("ws/coder-a");
  });

  test("provisionWorktree is idempotent on repeated calls", async () => {
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    // Second call should be a no-op; nothing should throw.
    await provisionWorktree(repo, wt, "ws/coder-a", "main");

    const list = await listWorktrees(repo);
    const matches = list.filter((w) => w.path === wt);
    expect(matches).toHaveLength(1);
  });

  test("provisionWorktree reattaches to an existing branch", async () => {
    // Create the branch out-of-band first, then ensure provisioning
    // uses it instead of trying to recreate it.
    await execa("git", ["-C", repo, "branch", "ws/coder-a"]);
    await provisionWorktree(repo, wt, "ws/coder-a", "main");

    const list = await listWorktrees(repo);
    const entry = list.find((w) => w.path === wt);
    expect(entry?.branch).toBe("ws/coder-a");
  });

  test("provisionWorktree recovers from stale worktree state via prune", async () => {
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    // Nuke the worktree directory behind git's back.
    rmSync(wt, { recursive: true, force: true });

    // Should prune metadata and re-provision cleanly.
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    expect(existsSync(wt)).toBe(true);
  });

  test("removeWorktree deletes the directory and prunes metadata", async () => {
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    await removeWorktree(repo, wt);

    expect(existsSync(wt)).toBe(false);
    const list = await listWorktrees(repo);
    expect(list.find((w) => w.path === wt)).toBeUndefined();
  });

  test("removeWorktree is tolerant of an already-gone worktree", async () => {
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    rmSync(wt, { recursive: true, force: true });
    // Should not throw even though the working tree is already missing.
    await removeWorktree(repo, wt);
  });

  test("pruneWorktrees clears dangling refs", async () => {
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    rmSync(wt, { recursive: true, force: true });
    await pruneWorktrees(repo);
    const list = await listWorktrees(repo);
    // Only the main worktree should remain.
    expect(list.find((w) => w.path === wt)).toBeUndefined();
  });

  test("two worktrees on distinct branches coexist", async () => {
    const wtB = join(base, "coder-b");
    await provisionWorktree(repo, wt, "ws/coder-a", "main");
    await provisionWorktree(repo, wtB, "ws/coder-b", "main");

    const list = await listWorktrees(repo);
    const branches = list.map((w) => w.branch).sort();
    expect(branches).toContain("ws/coder-a");
    expect(branches).toContain("ws/coder-b");

    // Edits on one branch don't collide with the other.
    writeFileSync(join(wt, "a.txt"), "a\n");
    writeFileSync(join(wtB, "b.txt"), "b\n");
    expect(existsSync(join(wt, "a.txt"))).toBe(true);
    expect(existsSync(join(wtB, "a.txt"))).toBe(false);
    expect(existsSync(join(wtB, "b.txt"))).toBe(true);
  });
});
