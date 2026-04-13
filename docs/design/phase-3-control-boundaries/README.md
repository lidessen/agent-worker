# Phase 3 — Control Boundaries

Date: 2026-04-14

Prerequisite reading:

- `docs/research/2026-04-12-daily-productivity-roadmap.md`
- `docs/research/2026-04-12-daily-productivity-design-review-round1.md`
- `docs/design/phase-1-worktree-isolation/README.md`
- `docs/design/phase-2-session-continuity/README.md`

## Goal

> 让 agent-worker 更像日常主力工具, 而不是默认全自动后端

Today every agent is launched with the most permissive settings
its runtime allows:

- `ClaudeCodeLoop` gets `permissionMode: "bypassPermissions"`,
  hard-coded in `loop-factory.ts:110`.
- `CodexLoop` gets `fullAuto: true` → `approvalPolicy: "never"`
  and `sandbox: "workspace-write"`, hard-coded in
  `loop-factory.ts:125`.
- `HostSandbox.executeCommand` places zero restrictions on
  bash — paths are enforced for `readFile`/`writeFile` but any
  `bash` call can write anywhere in the filesystem.
- The Phase 1 worktree wiring pushes `workspace.repo.path` into
  `allowedPaths` alongside the worktree, so a worker has formal
  access to the canonical repo directory, not just its own
  branch's working copy.

For evaluation workloads this is fine. For daily-driver use it
isn't. Phase 3 adds the **control knobs** that let a user tune a
workspace's autonomy level, and ships the minimum surgical
safety fixes that are too blunt to leave off.

## Frozen decisions

1. **Don't name modes yet.** The design review round 1
   explicitly said: define the control dimensions first, name
   them later. No `mode: assist | delegate | auto` field in
   this phase — just the dimensions.
2. **Dimensions we control in the MVP**:
   - `permissionMode` — claude-code's approval gate
     (`default | acceptEdits | bypassPermissions`)
   - `fullAuto` — codex's auto-approval flag
     (boolean → `approvalPolicy: "never" | "on-request"`)
   - `sandbox` — codex's shell sandbox
     (`read-only | workspace-write | danger-full-access`)
3. **Precedence**: `AgentDef.policy` > `WorkspaceDef.policy` >
   daemon default. Per-agent wins over workspace-level because a
   workspace may need a risk-taking coder alongside a read-only
   reviewer.
4. **Default stays aggressive for this commit.** Flipping the
   default to conservative would break the existing validation
   workspaces (hierarchical-validation, phase1-worktree,
   phase2-continuity) that rely on silent `bash` / `write`. We
   ship the knobs first, then flip the default in a follow-up
   once every validation config has been migrated. This is a
   narrow intentional exception to the "default should be safe"
   roadmap rule — safe defaults without opt-in knobs are
   useless, and safe defaults with a breaking migration on the
   same commit is unnecessarily risky.
5. **Drop the `workspace.repo.path` entry from `allowedPaths`
   during worktree provisioning.** Worktrees exist precisely so
   the worker doesn't need the canonical repo path. Removing it
   is a strict tightening that no current validation depends on
   (Phase 1 ran two coders end-to-end without touching anything
   outside their worktrees). Ship this in the same commit as
   the knobs.
6. **Out of scope for Phase 3 MVP**:
   - A bash-level guard in `HostSandbox.executeCommand` (large
     surface, needs its own design).
   - Git-specific guards (`git push`, `--force`, branch
     allowlists). These belong in a Phase 3.5 git-policy slice.
   - An approval UI. Claude Code and Codex already render their
     own prompts when the mode demands it — we reuse theirs.
   - Mode-level tool-surface variation (observer can't write,
     etc.). Different phase.

## Data model

### `PolicyDef` (new type, YAML layer)

```ts
export interface PolicyDef {
  /** Approval gate for claude-code. Default: "bypassPermissions" */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  /** Codex fullAuto — when false, codex uses "on-request" approval. Default: true */
  fullAuto?: boolean;
  /** Codex shell sandbox. Default: "workspace-write" when fullAuto=true. */
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
}
```

Added to:
- `WorkspaceDef.policy?: PolicyDef`
- `AgentDef.policy?: PolicyDef`

Agent-level wins on a field-by-field merge — not a full
replacement. A workspace that says `fullAuto: false` and an
agent that says `permissionMode: "acceptEdits"` ends up with
both constraints applied.

### Resolved form (runtime layer)

`ResolvedAgent.policy?: PolicyDef` — the fully merged
workspace + agent policy, with undefined fields inheriting from
daemon defaults.

`RuntimeConfig` gets three optional fields (one per dimension)
rather than a nested `policy` object, to match the existing
flat shape:

```ts
RuntimeConfig.permissionMode?: ...
RuntimeConfig.fullAuto?: boolean
RuntimeConfig.sandbox?: ...
```

### loop-factory wiring

The aggressive defaults at `loop-factory.ts:110` and `:125`
become fallbacks:

```ts
// claude-code
permissionMode: config.permissionMode ?? "bypassPermissions",

// codex
fullAuto: config.fullAuto ?? true,
sandbox: config.sandbox,  // undefined → CodexLoop picks workspace-write
                          // for fullAuto=true; user can override
```

## Worktree allowedPaths tightening

At `workspace-registry.ts:436`, delete the
`allowedPaths.push(workspace.repo.path)` line that ships today.
The worker's `allowedPaths` after this change:

- Its own worktree (already the cwd)
- The shared workspace sandbox (unchanged)
- ~~The source repo root~~ — **removed**

The worker can still run `git commit` / `git log` inside its
worktree (git handles the `.git` indirection itself) without
any filesystem access to the source repo directory. Phase 1
validation proved this.

## Integration points

### 1. Config types

- `packages/workspace/src/config/types.ts`: declare `PolicyDef`,
  add `policy?: PolicyDef` to `WorkspaceDef` and `AgentDef`,
  add `policy?: PolicyDef` to `ResolvedAgent`.

### 2. Config resolver

- `packages/workspace/src/config/loader.ts`: in the per-agent
  loop, merge `def.policy` (workspace) with `agentDef.policy`
  (agent) field-by-field; store the result on
  `ResolvedAgent.policy`.

### 3. Runtime config

- `packages/agent-worker/src/types.ts`: add
  `permissionMode?`, `fullAuto?`, `sandbox?` to `RuntimeConfig`.

### 4. Registry → factory plumbing

- `packages/agent-worker/src/workspace-registry.ts`:
  `createAgentLoop` accepts the resolved policy and forwards
  it into `createLoopFromConfig`.

### 5. Factory

- `packages/agent-worker/src/loop-factory.ts`: stop hard-coding
  `bypassPermissions` / `fullAuto: true`; fall back to them only
  when `config.permissionMode` / `config.fullAuto` are absent.

### 6. Worktree tightening

- `packages/agent-worker/src/workspace-registry.ts:436`: remove
  the `allowedPaths.push(workspace.repo.path)` line.

## Tests

1. Config-level unit tests:
   - `loadWorkspaceDef` parses a `policy` block at both
     workspace and agent scope.
   - Merge: workspace `fullAuto: false` + agent
     `permissionMode: "acceptEdits"` → both surface on the
     resolved agent.
   - Agent override: workspace `fullAuto: false` + agent
     `fullAuto: true` → agent wins.
2. Factory-level unit test:
   - `createLoopFromConfig({type: "claude-code", permissionMode:
     "default"})` constructs a `ClaudeCodeLoop` whose internal
     permissionMode is `"default"` (observable via the loop's
     internal options).
   - Same for codex `fullAuto: false`.
3. Integration test for the tightening:
   - Extend the existing Phase 1
     `workspace-integration.test.ts` "provisions per-agent git
     worktrees" scenario to assert `workspace.repo.path` is NOT
     in the agent runner's `allowedPaths` after the change.

## Risks and open questions

- **Conservative defaults later**: the follow-up commit that
  flips `bypassPermissions` / `fullAuto: true` to
  `"default"` / `false` will need to migrate every validation
  YAML. We stage it after this slice to keep the test surface
  small.
- **Does Codex honor `fullAuto: false`?**: the CodexLoop code
  passes `approvalPolicy: "on-request"`, which makes the
  codex app-server surface approval prompts. For agent-worker's
  headless model, those prompts would block the run. A future
  phase needs to decide whether agent-worker intercepts them
  (add an approval MCP tool) or just forbids `fullAuto: false`
  for codex until then. For this MVP we document the risk and
  let the knob exist.
- **Claude Code "default" mode blocks on unknown file
  operations**: same concern — the tooling exists but
  agent-worker has no UI to surface the blocks.
- **Tightening `allowedPaths`** could break a validation
  workspace in the wild if anyone was relying on source-repo
  access. Phase 1 validation and the integration test did not
  need it, so this is almost certainly safe, but we call it
  out explicitly in the commit message.

## MVP build order

1. Declare `PolicyDef` types + `policy?` on `WorkspaceDef` /
   `AgentDef` / `ResolvedAgent`.
2. Resolver merge in `loader.ts`.
3. Add `permissionMode` / `fullAuto` / `sandbox` to
   `RuntimeConfig`.
4. Thread resolved policy through
   `workspace-registry.createAgentLoop` →
   `createLoopFromConfig`.
5. Flip factory hard-codes to fallbacks.
6. Delete the `allowedPaths.push(workspace.repo.path)` line.
7. Config unit tests (3).
8. Factory unit test for permissionMode + fullAuto plumbing.
9. Integration test update for the allowedPaths tightening.
10. Commit. Default behavior on existing workspaces is
    unchanged because every new field is optional and the
    factory fallback is identical to the old hard-code.

## What Phase 3 MVP does NOT do

- Flip defaults. That's a follow-up migration commit.
- Add git-level policy (`git push` / force-push guards).
- Add a bash-level cwd guard in `HostSandbox.executeCommand`.
- Add a `mode` field. The design review froze this decision.
- Surface an approval UI.
- Add role-based tool-surface variation.
