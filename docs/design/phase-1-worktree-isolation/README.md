# Phase 1 — Execution Isolation via Git Worktrees

Date: 2026-04-13 (v1 per-agent)
Updated: 2026-04-14 (v2 per-agent repo)
Updated: 2026-04-14 (v3 attempt-scoped, tool-based)

Prerequisite reading:

- `docs/research/2026-04-12-daily-productivity-roadmap.md`
- `docs/research/2026-04-12-daily-productivity-design-review-round1.md`
- `docs/design/workspace-led-hierarchical-agent-system/README.md`

## Goal

Give an agent a dedicated, isolated git worktree **when the task
calls for it**, not before. Multiple coders can work on the same
repo in parallel without clobbering each other, and tasks that
don't need code work never touch git at all. Worktree creation
is an explicit tool call from the worker, bound to the current
attempt; the attempt's terminal status triggers automatic
cleanup.

Three constraints from the v3 design review:

1. Not every task needs coding — worktrees can't be
   pre-provisioned at workspace-create time.
2. Coding doesn't always need a worktree — some workers write
   to plain sandbox dirs. Worktree is optional per attempt.
3. Worktree is a tool — workers create them dynamically,
   attached to the current attempt, with lifecycle bound to
   the attempt's terminal transition.

## Decisions (frozen for v3)

1. **Worktree is attempt-scoped, not agent-scoped.** One attempt
   can have 0..N worktrees. They live as long as the attempt is
   non-terminal.
2. **Workspace is git-unaware.** Zero repo fields on
   `WorkspaceDef`, `AgentDef`, `WorkspaceConfig`, or `Workspace`
   runtime. The workspace never looks at git except to prune
   orphan refs at init time.
3. **Worktrees are created via MCP tools, not YAML config.**
   Tools are injected into the worker's toolset at the start
   of each run, closure-bound to the run's active attempt. When
   the attempt terminates, the closure is discarded.
4. **Branch names come from the caller, not from runtime.**
   `worktree_create` takes `branch` as a required parameter.
   Skills, instructions, or lead-side prompts decide naming
   conventions. Runtime is a dumb provisioner.
5. **Worktree paths come from runtime.** Runtime owns path
   allocation to avoid filesystem collisions:
   `{daemonDir}/workspace-data/{workspaceKey}/worktrees/{attemptId}/{name}`.
   Caller provides an attempt-scoped unique `name`.
6. **Per-run cwd resolution.** The orchestrator looks up the
   agent's active attempt each run and picks cwd:
   - 0 worktrees → sandbox
   - 1 worktree → that worktree (regardless of `name`)
   - multi-worktree → `name === "main"`, else sandbox
     (worker uses explicit `cd` paths for the others)
7. **`task_dispatch` does not touch worktrees.** No `worktree`
   parameter. The worker creates whatever it needs mid-run. This
   keeps lead coordination decoupled from runtime details.
8. **Cleanup is driven by `state store` events, not by
   `ManagedWorkspace` bookkeeping.** The store emits
   `attempt.terminal` when `updateAttempt` flips a running
   attempt to any terminal status. `workspace-registry`
   subscribes on create and runs `removeWorktree` for each
   recorded worktree on that attempt. Branches are preserved.
9. **Crash recovery is fail-fast.** `workspace.init()` marks
   running attempts as failed during orphan recovery, which
   fires `attempt.terminal`, which triggers cleanup. Work in
   progress is lost; committed work lives on the branch. Next
   retry is a fresh attempt with a fresh worktree.
10. **Legacy configs are rejected at load time.** Any
    `WorkspaceDef.repo`, `AgentDef.worktree`, `worktree: true`
    form fails loud with a migration hint. Silent degradation
    is worse than a clear error.

## Data model

### YAML (config layer)

```yaml
name: multi-coder
agents:
  coordinator:
    runtime: claude-code
    # no git-related config at all
  coder-a:
    runtime: claude-code
    allowed_paths:                  # already-existing mechanism, optional
      - /path/to/read-only-reference
  reviewer:
    runtime: codex
```

No `workspace.repo`. No `agent.worktree`. No `agent.repo`. No
`agent.coding_repos`. A workspace is a pure collaboration
container.

### Types

```ts
// packages/workspace/src/state/types.ts

export interface Worktree {
  /** Attempt-scoped unique identifier. Caller-provided. */
  name: string;
  /** Canonical absolute path to the source git repository. */
  repoPath: string;
  /** Branch name, caller-provided — runtime does not generate. */
  branch: string;
  /** Base branch the new branch was forked from. */
  baseBranch: string;
  /** Absolute path to the provisioned working directory. */
  path: string;
  /** Epoch ms of provisioning. */
  createdAt: number;
}

export interface Attempt {
  // existing fields...
  /**
   * Worktrees provisioned by this attempt via `worktree_create`.
   * Each is removed on attempt terminal transition.
   */
  worktrees?: readonly Worktree[];
}
```

**Gone**: `AgentDef.worktree`, `ResolvedAgent.worktree`,
`WorkspaceDef.repo`, `WorkspaceConfig.repo`,
`WorkspaceConfig.worktreeRepos`, `Workspace.agentWorktreePaths`,
`Workspace.setAgentWorktreePath`, `Workspace.getAgentWorktreePath`,
`Attempt.worktreePath`.

## Tool interface (attempt-scoped MCP tools)

Injected into a worker's toolset at the start of each run,
closure-bound to the run's active attempt. Removed when the
attempt terminates (closure discarded on next tool rebuild).

### `worktree_create`

```ts
worktree_create({
  name: string,          // required, attempt-scoped unique
  repo: string,          // required, absolute or config-relative
  branch: string,        // required, caller decides naming
  base_branch?: string,  // default "main"
}) → { name: string; path: string; branch: string; repoPath: string; baseBranch: string }
```

Provisions the worktree at
`{daemonDir}/workspace-data/{wsKey}/worktrees/{attemptId}/{name}`,
updates the state store with the new entry on `attempt.worktrees`,
returns the resolved struct. Errors:

- `name` collision within the same attempt → error
- `repo` not a git repo → error
- `provisionWorktree` failure (branch conflict, permission) →
  bubble up

### `worktree_list`

```ts
worktree_list() → Worktree[]
```

Returns the current attempt's worktree array. Empty when the
attempt has no worktrees.

### `worktree_remove`

```ts
worktree_remove({ name: string }) → void
```

Removes a specific worktree before the attempt terminates (rare,
mostly for recovering from a mistaken `worktree_create`). The
attempt-terminal cleanup runs unconditionally on whatever's left.

## Lifecycle

```
lead calls task_dispatch(worker=X, taskId=T)
  → store.createAttempt(...) → attempt Aid
  → store.updateTask(T, activeAttemptId=Aid, status=in_progress)
  → enqueue dispatch instruction on X's queue
  (attempt has no worktrees yet)

X first run
  → orchestrator: activeAttempt = store.findActiveAttempt(X) = Aid
  → attempt.worktrees is empty → cwd = X.sandboxDir
  → tools = { base, ...createAttemptTools(X, Aid, workspace) }
  → X model reasons about the task, decides to open a worktree
  → X calls worktree_create(name="main", repo=..., branch=..., base_branch=...)
      → validate: no name clash
      → compute path = .../worktrees/Aid/main
      → provisionWorktree(repo, path, branch, baseBranch)
      → store.updateAttempt(Aid, worktrees=[{...}])
      → return { path, ... }
  → X has two options from here:
    (a) this run: "cd {path} && git ..." explicitly in bash,
        do the work, attempt_update completed, done in one run
    (b) this run: channel_send "setup done", let the run end,
        next run auto-picks-up worktree cwd because attempt.worktrees
        now has main

X subsequent run (if path b above, or multi-turn task)
  → orchestrator: Aid.worktrees has "main" → cwd = main.path
  → X's bash defaults to the worktree
  → X edits, commits, tests, handoff_create, attempt_update

attempt_update status=completed
  → store.updateAttempt(Aid, status=completed)
  → store emits "attempt.terminal" { attempt: {Aid, worktrees:[...]} }
  → workspace-registry subscriber:
      for each wt: removeWorktree(wt.repoPath, wt.path)
      best-effort, swallow individual errors
  → branches are preserved (committed work stays)
  → lead can git log / git diff from anywhere to inspect

workspace.stop()
  → stop all loops
  → scan non-terminal attempts with worktrees
  → for each: removeWorktree
  → workspace.shutdown()

daemon kill -9 → restart
  → workspace.init()
    → store replay restores attempts + worktrees
    → orphan recovery: every running attempt → mark failed
      → emits attempt.terminal for each
      → subscriber cleans up worktrees automatically
    → pruneWorktrees across the unique set of known repoPaths
      (collected from store's all-attempts worktrees) for dangling
      refs from aborted provisioning
```

**Cwd resolution** (orchestrator, per-run):

```ts
function resolveRunCwd(agent, attempt): string {
  const worktrees = attempt?.worktrees ?? [];
  if (worktrees.length === 0) return agent.sandboxDir;
  if (worktrees.length === 1) return worktrees[0].path;
  const main = worktrees.find(w => w.name === "main");
  if (main) return main.path;
  // multi-worktree with no "main" → worker must cd explicitly
  return agent.sandboxDir;
}
```

## State store event

New emitter on `WorkspaceStateStore`:

```ts
interface WorkspaceStateStore {
  // existing...
  on(event: "attempt.terminal", cb: (attempt: Attempt) => Promise<void>): () => void;
}
```

`updateAttempt` detects when the status transition crosses from
non-terminal to terminal and fires the event with the **post-update
attempt snapshot** (so the handler sees the final worktrees
array). Handlers run sequentially, errors are logged and
swallowed.

Implementation lives on the `InMemoryWorkspaceStateStore` base
class; `FileWorkspaceStateStore` inherits it. Events are not
persisted — they're in-process-only, and crash recovery relies
on orphan-recovery re-firing them on restart.

## Tool injection contract

The orchestrator's per-run setup becomes:

```ts
async tick() {
  // ...dequeue instruction...

  // NEW: resolve attempt and assemble tools per-run
  const activeAttempt = await store.findActiveAttempt(agentName);
  const runTools = {
    ...baseTools,
    ...(activeAttempt
      ? createAttemptTools(agentName, activeAttempt.id, workspace)
      : {}),
  };
  loop.setTools(runTools);  // or pass via mcp config

  // ...continue to buildPrompt / onInstruction...
}
```

`createAttemptTools(agentName, attemptId, workspace)` closures over
all three and returns a fresh object every call. The tool
implementation holds references to the workspace state store
but doesn't cache attempt state — it re-reads on each tool call
to avoid stale data across a multi-tool turn.

Only `worktree_create` / `worktree_list` / `worktree_remove` go
through this factory for now. `artifact_create`, `handoff_create`,
`attempt_update` stay in `createWorkspaceTools` (they already work,
touching them risks regressions unrelated to worktree design).

## Integration points (files to change)

- `packages/workspace/src/state/types.ts` — `Worktree` interface,
  `Attempt.worktrees`, delete `Attempt.worktreePath`.
- `packages/workspace/src/state/store.ts` + `file-store.ts` —
  event emitter, `on("attempt.terminal", ...)`, emit in
  `updateAttempt`.
- `packages/workspace/src/state/store.ts` — `findActiveAttempt(agentName)`
  helper (queries running attempts for the agent).
- `packages/workspace/src/config/types.ts` — delete `AgentDef.worktree`,
  `ResolvedAgent.worktree`, `WorktreeSpec`.
- `packages/workspace/src/config/loader.ts` — delete worktree
  resolution, add rejection for legacy forms (`workspace.repo`,
  `agent.worktree`).
- `packages/workspace/src/types.ts` — delete
  `WorkspaceConfig.worktreeRepos`.
- `packages/workspace/src/workspace.ts` — delete
  `_worktreeRepos`, `setAgentWorktreePath`, `getAgentWorktreePath`,
  `agentWorktreePaths`. `init()` orphan recovery collects unique
  repos from store instead of config.
- `packages/workspace/src/context/mcp/attempt-tools.ts` — NEW
  file, exports `createAttemptTools(agentName, attemptId, workspace)`.
- `packages/workspace/src/context/mcp/server.ts` — no change to
  `createWorkspaceTools`, but orchestrator now splices in
  `createAttemptTools` per-run.
- `packages/workspace/src/loop/prompt.tsx` — `PromptContext.worktrees?: Worktree[]`,
  delete singular `worktreeDir`/`worktreeBranch`/`baseBranch`.
- `packages/workspace/src/context/mcp/prompts.tsx` — render a
  "Worktrees" list instead of the singular Directories entry.
- `packages/agent-worker/src/workspace-registry.ts` —
  **delete** the Phase-1 provisioning loop inside `create()`,
  **delete** `agentWorktreePath` lookup, **add** subscription to
  `store.on("attempt.terminal")` for cleanup, **rewrite**
  `createRunner` closure to resolve cwd per-run from
  `findActiveAttempt`.
- `packages/agent-worker/src/managed-workspace.ts` — delete
  `_worktrees`, `_agentScopes` that depend on static worktree.
  Keep `agentRunnerScope` interface but the returned data is
  snapshot of the last run (sandbox-only for agents without an
  active attempt).
- `packages/agent-worker/src/daemon.ts` —
  `handleGetWorkspaceAgentScopes` now returns per-run scopes
  (possibly empty). Documentation note.
- `packages/agent-worker/src/orchestrator.ts` — threads
  `attemptId` through to `PromptContext`.

## Tests

Replace the existing worktree test set with:

1. `worktree.test.ts` — keep, unchanged. Still the thin
   `git worktree` wrapper.
2. `task-tools.test.ts` — delete the `agentWorktreePath`
   stamp tests. Replace with:
   - `worktree_create` happy path
   - `worktree_create` name collision
   - `worktree_create` repo not-a-git-repo
   - `worktree_list` returns current attempt's worktrees
   - `worktree_remove` removes a specific entry
   - multi-worktree on one attempt
3. `state-store.test.ts` — new:
   - `updateAttempt` emits `attempt.terminal` on running →
     completed
   - `updateAttempt` does NOT emit when already terminal →
     terminal (idempotent path)
   - subscriber runs for terminal transitions; errors don't
     break the transition itself
4. `workspace-integration.test.ts` — rewrite the "provisions
   per-agent git worktrees" test:
   - mock runtime calls `worktree_create` via the tool path
   - assert the worktree dir exists, branch exists, allowedPaths
     still excludes the repo root
   - assert `attempt_update status=completed` triggers cleanup
   - multi-repo: one attempt → two `worktree_create` calls on
     two different repos
5. `config.test.ts` — delete per-agent worktree resolution
   cases, keep the legacy rejection cases with updated hint
   text.

## Acceptance criteria

- Tasks that don't need coding never touch git at any level
  (no workspace config, no runtime code path, no file creation).
- A worker can call `worktree_create` mid-run and receive a
  usable path within the current run.
- On the next run, the orchestrator automatically uses that
  worktree as cwd (one-worktree case) or the one named "main"
  (multi-worktree case).
- Multiple `worktree_create` calls on the same attempt produce
  multiple entries in `attempt.worktrees`, each with a distinct
  `name`.
- Terminal `attempt_update` triggers `removeWorktree` for each
  entry without requiring explicit cleanup calls from the
  worker.
- Branches are preserved after cleanup so the lead can run
  `git log <branch>` from anywhere to review the work.
- A `kill -9` of the daemon followed by restart marks all
  running attempts as failed, triggers cleanup via the
  terminal event, and frees all worktrees.

## What this phase does NOT do

- **No merge automation.** Workers commit to their own
  branches. Merging back to base is the lead's or user's job.
- **No per-attempt branch GC.** Old branches accumulate until
  the user cleans up; a future `ws rm --discard` or
  `skill: worktree_gc` can take this on.
- **No cwd rewrite mid-run.** If a worker creates a worktree in
  the middle of a turn, it must `cd` explicitly; the cwd only
  updates on the next run.
- **No mid-run cwd stack or context pushing.** Workers use
  absolute paths when they need to step outside the default
  cwd.
- **No unified `attempt-scoped` factory for all tools.** Only
  `worktree_*` tools use the new injection pattern in this
  phase. `artifact_*` / `handoff_*` / `attempt_update` stay in
  `createWorkspaceTools`. A future cleanup can unify them.

## Decisions recorded (v3)

From the 2026-04-14 design discussion:

1. **`coding_repos` advisory field**: rejected. Use the existing
   `allowed_paths` mechanism.
2. **Branch naming**: caller decides; `worktree_create` takes
   `branch` as a required parameter.
3. **Multi-worktree**: first-class — `attempt.worktrees` is an
   array keyed by attempt-scoped `name`.
4. **Tool injection = lifecycle binding**: attempt-scoped tools
   are closure-bound to `attemptId` at injection time, which
   happens per-run via the orchestrator.
5. **State store event for cleanup**: new
   `on("attempt.terminal")` on `WorkspaceStateStore`. Not
   reusing the general event bus (which is UI-facing); this is
   an internal notification for workspace lifecycle.
6. **Factory refactor scope**: only `worktree_*` tools move to
   the new attempt-scoped pattern. Existing attempt-aware
   tools (`artifact_*`, `handoff_*`, `attempt_update`) stay
   put.
7. **`name` field for worktree identity**: attempt-scoped
   unique, caller-provided.
8. **Multi-worktree cwd fallback**: require explicit
   `name === "main"` for the auto-cwd. No "main" + multiple
   worktrees → fallback to sandbox (worker uses explicit
   `cd`).
9. **Crash recovery**: fail-fast. Orphan recovery marks
   running attempts as failed, which fires `attempt.terminal`,
   which cleans worktrees. No reattach.
10. **`task_dispatch` shape**: no `worktree` parameter. Workers
    create worktrees themselves after dispatch.

## Migration plan

This is a breaking change to the workspace YAML surface. No
backwards-compat:

- `workspace.repo` → rejected at load
- `agent.worktree: true` → rejected at load (already was in v2)
- `agent.worktree: { repo: ..., base_branch: ... }` → rejected
  at load (v2 form)

All three rejection messages point to the new model: "worktrees
are created via the `worktree_create` MCP tool during a run, not
declared in config. See
`docs/design/phase-1-worktree-isolation/README.md`."

`validation-worktree.yml` is rewritten to have no worktree
config at all. The worker's instructions tell it to call
`worktree_create` when starting its task.
