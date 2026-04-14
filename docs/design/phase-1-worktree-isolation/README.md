# Phase 1 — Execution Isolation via Git Worktrees

Date: 2026-04-13

Prerequisite reading:

- `docs/research/2026-04-12-daily-productivity-roadmap.md`
- `docs/research/2026-04-12-daily-productivity-design-review-round1.md`
- `docs/design/workspace-led-hierarchical-agent-system/README.md`

## Goal

Let agents work on code in a dedicated, isolated `git worktree` so
multi-coder parallelism is safe. Each worktree-enabled agent gets
its own branch on its own repo; the workspace itself stays
runtime-agnostic and holds zero git knowledge. The agent's loop
cwd is its worktree. The prompt surfaces worktree path, branch,
and base branch so the model knows where it is.

Per the roadmap this is Phase 1 of three (isolation → continuity
→ control boundaries), and it must land first because without it
the multi-coder story is fundamentally unsafe.

## Decisions (frozen)

1. **Worktree is per-agent, not per-attempt.** Branch name is
   deterministic: `{workspaceKey}/{agentName}` (colons in key
   normalized to `--`). Survives daemon restarts.
2. **Worktree location is under daemon state**, nested inside
   the per-workspace data directory:
   `{daemonDir}/workspace-data/{workspaceKey}/worktrees/{agentName}`.
   Nesting under `workspace-data/{key}` keeps everything for a
   single workspace (state store, channels, inbox, chronicle,
   sandbox, worktrees) under one root, so `aw rm @name`'s
   blanket `rm -rf` correctly cleans the worktrees along with
   the rest of the workspace state.
3. **Workspace is not git-bound.** A workspace may have 0..N
   repos, one per opted-in agent. Two agents can share a repo
   (they'll get separate branches) or point at completely
   different repos. Agents that don't opt in never touch git at
   all.
4. **Opt-in per agent via per-agent repo spec.** Each agent that
   wants a worktree declares its own repo:

   ```yaml
   agents:
     coder-a:
       worktree:
         repo: /path/to/repo
         base_branch: main   # optional, default "main"
   ```

   Leads typically don't declare a `worktree` block — they
   coordinate in the sandbox.
5. **Sandbox still exists** alongside worktree. Both are passed
   through to the prompt. Sandbox holds personal scratch files;
   worktree holds code work. When both are present the loop cwd
   is the worktree.
6. **Provisioning is synchronous** inside
   `workspace-registry.create()` — a sequential loop over agents,
   no locks needed.
7. **Legacy `workspace.repo` block is rejected at load time** with
   a migration hint. So is `worktree: true`. The config loader
   fails loud — no silent degradation.

## Data model

### `WorkspaceDef` (YAML layer)

```yaml
name: multi-repo

agents:
  coordinator:
    runtime: claude-code
    # no worktree block → coordinates in sandbox, no git

  coder-a:
    runtime: claude-code
    worktree:
      repo: /abs/or/relative/path/to/repo-a
      base_branch: main          # optional, default "main"

  coder-b:
    runtime: codex
    worktree:
      repo: /path/to/repo-b      # different repo is fine
```

Relative `repo` paths are anchored to the config file directory,
matching the `data_dir` resolution rule.

### Type surface

- `packages/workspace/src/config/types.ts`:
  - new `WorktreeSpec { repo: string; base_branch?: string }`
  - `AgentDef.worktree?: WorktreeSpec`
  - `ResolvedAgent.worktree?: { repoPath: string; baseBranch: string }`
    (fully resolved — path absolute, base branch defaulted)
  - No `WorkspaceDef.repo` field — workspace is not git-aware.
- `packages/workspace/src/types.ts`:
  - `WorkspaceConfig.worktreeRepos?: readonly string[]` — the
    union of unique repo paths targeted by any agent's worktree
    spec. Used only for crash-recovery pruning at `init()`
    time; the workspace runtime itself never talks to git
    directly.
- `packages/workspace/src/loop/prompt.tsx` `PromptContext`:
  - `worktreeDir?`, `worktreeBranch?`, `baseBranch?`
- `packages/agent-worker/src/orchestrator.ts` orchestrator config:
  - same three fields, threaded into the `PromptContext` assembly

`Attempt.worktreePath?: string` already exists in
`packages/workspace/src/state/types.ts`. `task_dispatch` now
looks up the worker's worktree path via the
`agentWorktreePath` dep injected by `createWorkspaceTools` and
stamps it onto the freshly-created Attempt so the ledger shows
where the work happened.

## New module: `packages/workspace/src/worktree.ts`

Thin wrapper over `git worktree`, using `execa` per CLAUDE.md:

```ts
export async function provisionWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseBranch: string,
): Promise<void>;

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<void>;

export async function listWorktrees(
  repoPath: string,
): Promise<Array<{ path: string; branch: string; prunable: boolean }>>;

export async function pruneWorktrees(repoPath: string): Promise<void>;
```

Idempotency rules for `provisionWorktree`:

1. If `repoPath` is not a git repo → throw early with a clear error.
2. If a worktree at `worktreePath` already exists AND its branch
   matches `branch` → no-op (reattach).
3. If the worktree path is stale (refs exist but directory missing)
   → run `pruneWorktrees(repoPath)` and retry.
4. If the branch already exists (from a prior run) → use
   `git worktree add {path} {branch}` (no `-b` flag).
5. Otherwise → `git worktree add -b {branch} {path} {baseBranch}`.

## Lifecycle and integration points

```
YAML load
  └─ WorkspaceDef.repo + AgentDef.worktree
       └─ resolveWorkspaceDef → ResolvedWorkspace
            └─ toWorkspaceConfig → WorkspaceConfig.repo (baseBranch defaulted)
                 └─ workspace-registry.create() [PER AGENT, SEQUENTIAL]
                      ├─ if workspace.repo && agent.worktree:
                      │   ├─ compute worktreePath + branch
                      │   ├─ provisionWorktree(...)
                      │   ├─ agentCwd = worktreePath    (overrides sandboxDir)
                      │   ├─ allowedPaths += [repo.path] (read-only reference)
                      │   └─ record {repoPath, worktreePath} on ManagedWorkspace
                      ├─ createOrchestrator({ worktreeDir, worktreeBranch, baseBranch, ...})
                      └─ orchestrator assembles PromptContext with worktree fields

workspace-registry.remove() / stop()
  └─ ManagedWorkspace.stop()
       └─ for each recorded worktree: removeWorktree(repoPath, worktreePath)

workspace.init() (daemon restart path)
  └─ already recovers orphaned attempts
  └─ NEW: if workspace.repo, run pruneWorktrees(repo.path) (best-effort, non-blocking)
```

Critical wiring site:
`packages/agent-worker/src/workspace-registry.ts`, inside the
per-agent loop in `create()` (around lines 389–411 as of the current
HEAD), right after `agentCwd` is computed.

Prompt wiring site:
`packages/workspace/src/context/mcp/prompts.tsx`, inside the
"Directories" line-group of `workspacePromptSection`. Render
worktree/branch/base-branch fields conditionally — when absent,
the existing sandbox-only layout is unchanged.

## Risks and open questions

- **Branch name collisions across restarts** — handled by the
  idempotent `provisionWorktree` (reattaches if branch+path already
  match). Workspaces with tags get the tag in their key, so two
  instances of the same workspace config don't collide.
- **Repo path not a git repo** — fail fast at workspace creation
  with a clear error, not mid-run.
- **Crash during provisioning** — worktree dir and ref may exist
  without the other. `pruneWorktrees` on next init handles the
  "ref exists but dir gone" case. The "dir exists but ref gone"
  case is rarer and handled by re-provisioning, which will find the
  existing dir and fail — we accept this failure and surface it.
- **Shutdown ordering** — `removeWorktree` must run before
  `workspace.shutdown()` inside `ManagedWorkspace.stop()`. We
  inject a new step between loop-stop and `workspace.shutdown()`.
- **Concurrent provisioning** — not a concern because provisioning
  is sequential inside the per-agent `for` loop. Document this so
  nobody refactors it into `Promise.all` later.
- **Stale uncommitted work in the worktree** — intentional. If the
  daemon crashes mid-run, the next restart reattaches to the same
  worktree and branch, and the agent can continue (or commit/reset
  as a recovery step).

## MVP slice (build order)

1. `packages/workspace/src/worktree.ts` — the provisioner module
   with an accompanying `worktree.test.ts` that round-trips
   provision/remove/prune against a temp `git init` repo.
2. Type surface additions: `config/types.ts`, `types.ts`,
   `factory.ts`, `loop/prompt.tsx`.
3. Config resolver updates so `WorkspaceDef.repo` → `WorkspaceConfig.repo`.
4. Prompt rendering in `context/mcp/prompts.tsx`.
5. Orchestrator config threading (orchestrator.ts).
6. `workspace-registry.ts` wiring in `create()` and lifecycle
   integration in `ManagedWorkspace.stop()`.
7. `pruneWorktrees` call in `Workspace.init()` orphan recovery.
8. Integration test: construct a workspace with two coder agents
   pointing at a temp repo, verify two branches exist and both
   worktrees are populated.
9. New validation YAML
   `docs/design/phase-1-worktree-isolation/validation-worktree.yml`
   — a two-agent workspace that provisions worktrees against a
   throwaway test repo. Use the same iterative validation loop we
   used for hierarchical-validation round 2–5.

## Acceptance criteria (matches roadmap)

- Two coder agents in the same workspace can modify the same repo
  on separate branches in parallel without overwriting each other.
- Any agent's default shell/file operations land in its worktree,
  never in the shared repo root.
- Lead can list each agent's worktree path and branch from the
  task ledger / prompt.
- Daemon restart reattaches to existing worktrees rather than
  rebuilding them, preserving uncommitted work.
- Graceful `ws rm @name` cleans up worktrees via `removeWorktree`.

## What this phase does NOT do

- No per-attempt worktree. That layer will come in Phase 1.5 once
  we have a real multi-attempt task ledger workload.
- No merge automation. Branches stay parked on the agent's branch;
  merge back to base is out of scope.
- No approval policy on writes. Control-boundary work is Phase 3.
- No session/thread continuity from the underlying runtime. Phase 2.
