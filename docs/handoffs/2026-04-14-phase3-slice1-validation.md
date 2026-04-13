# Phase 3 Slice 1 — Control-Boundary Knobs Landing

Date: 2026-04-14
Branch: `codex/dev-runtime-workspace`
Commit: `c8a20a2` — phase3: expose permission / fullAuto / sandbox policy knobs

## Result

**Phase 3 slice 1 is landed.** Every agent now accepts a
per-workspace or per-agent `policy` block in YAML that flows
end-to-end into the runtime factory. Default behavior is
unchanged, but for the first time a workspace can declare
"this reviewer is read-only" or "this coder surfaces
permission prompts" and the loop factory honors it.

## Validation

No real-runtime run this slice — the Codex CLI currently has
no bridge for "on-request" approval prompts to cross back into
agent-worker, so a `fullAuto: false` codex agent would block
mid-run waiting for human input that can't arrive. Same story
for Claude Code `permissionMode: default`. We ship the plumbing
now; the approval bridge is a separate future slice.

Instead, the slice is validated via three layers of white-box
tests:

### 1. Config resolution (4 tests, `config.test.ts`)

- Workspace-level `policy` propagates to every agent in
  the workspace.
- Agent-level `policy` overrides workspace-level
  field-by-field (workspace says `fullAuto: false` +
  `permissionMode: acceptEdits`, agent overrides
  `permissionMode: bypassPermissions`, resolved agent ends up
  with `{ permissionMode: "bypassPermissions", fullAuto: false }`
  — the agent's `permissionMode` wins, but the workspace's
  `fullAuto` still applies).
- Agent-only policy (no workspace-level) works.
- Absent policy → `resolved.policy === undefined` (factory
  fallback path).

### 2. Factory wiring (4 tests, `loop-factory-paths.test.ts`)

- `createLoopFromConfig({ type: "claude-code" })` with no
  `permissionMode` → loop's internal
  `options.permissionMode === "bypassPermissions"` (default
  fallback).
- Same config + `permissionMode: "acceptEdits"` →
  `options.permissionMode === "acceptEdits"` (override
  honored).
- `createLoopFromConfig({ type: "codex" })` with no policy
  → `options.fullAuto === true`, `options.sandbox ===
  undefined` (codex picks its own default at `ensureThread()`
  time).
- Same config + `fullAuto: false`, `sandbox: "read-only"` →
  both honored on the loop instance.

### 3. Worktree allowedPaths tightening

The Phase 1 integration test `"provisions per-agent git
worktrees when repo is set"` in `workspace-integration.test.ts`
still passes unchanged after the
`allowedPaths.push(workspace.repo.path)` line was removed from
`workspace-registry.ts`. This proves that coder workers never
needed filesystem access to the source repo root — git
handles the `.git` indirection from a worktree without any
filesystem reads against the canonical directory.

This is a strict tightening, not a breaking change: nothing in
the Phase 1 validation depended on the source path being in
`allowedPaths`.

## Test totals

- Project tests: 937 pass / 0 fail (up from 919 at Phase 2
  finish — 4 config tests + 4 factory tests + the Phase 1
  integration test still passing).
- Lint: clean on every file I touched (2 pre-existing
  warnings in `http-server.ts` left alone).
- Typecheck: clean on `packages/workspace`, `packages/agent`,
  `packages/agent-worker`, `packages/loop`.

## What's not validated yet (on purpose)

- **Real-runtime exercise of `fullAuto: false` / `permissionMode:
  default`** — blocks on approval UI that doesn't exist yet.
- **Flipped defaults** — all existing validation workspaces
  still expect the aggressive defaults. Flipping them belongs
  in a follow-up migration commit that audits each YAML and
  either explicitly opts into aggressive settings or switches
  to a task that doesn't need them.
- **Git-level guards** (`git push`, `--force`, branch
  allowlists) — bigger scope, designated as a Phase 3.5 slice
  in the design doc.
- **Bash-level `cwd` guard in `HostSandbox.executeCommand`** —
  same reason, bigger surface than a config knob, separate
  slice.

## Follow-up slices (ordered)

1. **Slice 2 — migrate + flip defaults**. Audit every
   validation YAML (`hierarchical-validation-2.yml`,
   `validation-worktree.yml`, `validation-continuity.yml`) and
   add explicit `policy: { permissionMode: bypassPermissions,
   fullAuto: true }` where needed. Then flip the factory
   fallback from `"bypassPermissions"` / `true` to
   `"default"` / `false`.
2. **Slice 3 — codex approval bridge**. Intercept codex's
   on-request approval prompts via MCP and surface them
   through the workspace channel so a human (or lead agent)
   can approve. Unblocks `fullAuto: false` end-to-end.
3. **Slice 4 — git policy**. Prohibit `git push` to protected
   branches, deny `--force` / `--force-with-lease`, allowlist
   remotes. Implement as a bash tool wrapper in the loop layer.
4. **Slice 5 — bash cwd guard**. Extend
   `HostSandbox.executeCommand` to refuse commands whose
   `cwd` escapes the allowed set, using the same path-check as
   the file tools.

## Phase 3 status

**Slice 1 done.** The control-boundary config surface exists
end-to-end and is validated by unit + integration tests. Every
subsequent slice builds on this without re-opening the type
design.
