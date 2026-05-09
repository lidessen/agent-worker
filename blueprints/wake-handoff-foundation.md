# Wake / Handoff Foundation

First implementation slice of [decision 005](../design/decisions/005-session-orchestration-model.md).
Lays the schema foundation: rename `Attempt → Wake`, restructure `Handoff`
into the generic core plus a typed extension map (with no producer / consumer
hooks yet), and rename the workspace MCP tools accordingly. Behavior changes
(extension hooks, context-budget signaling, auto-checkpoint, task-tracking
harness, orchestrator UI) are explicit non-goals here — they are downstream
blueprints that build on this foundation.

## Plan

Bring the workspace kernel's runtime-boundary records into alignment with
decision 005, without introducing any new behavior. After this slice the
schema and tool names are correct; the system still works the same way it
does today.

### Scope

- **Type rename: `Attempt → Wake`** in `internals/workspace/src/state/types.ts`.
  All field renames follow:
    - `attemptId` → `wakeId`
    - `activeAttemptId` → `activeWakeId`
    - `fromAttemptId` → `closingWakeId` (on Handoff)
    - `toAttemptId?` removed (not part of the new generic core; the next
      Wake is identified by its own `wakeId`, not by a back-link from the
      Handoff)
    - `createdByAttemptId` → `createdByWakeId` (on Resource / current
      Artifact)
- **`Handoff` schema migration to the generic core shape**:
    - Keep core fields: `summary`, `pending`, `decisions`, `blockers`,
      `kind: 'progress' | 'blocked' | 'completed' | 'aborted'`
    - Add: `closingWakeId` (renamed), `taskRef` (replaces implicit task
      pointer; still references current `Task` records during migration),
      `resources: ResourceRef[]` (replaces the implicit Artifact links),
      `workLogPointer?: string` (placeholder; populated when the work-log
      aggregator lands in a later blueprint)
    - Add: `extensions: Record<string, HandoffExtensionPayload>` — opaque
      JSON map keyed by `harnessTypeId`. This slice does NOT define hook
      execution; the field is reserved to accept future harness-type
      extensions without further schema migration.
    - Drop `nextSteps` field (folded into `pending`)
- **MCP tool surface rename**:
    - `attempt_list` → `wake_list`
    - `attempt_get` → `wake_get`
    - `worktree_*` tools keep their names; the per-run binding switches
      from `activeAttemptId` to `activeWakeId`
    - `handoff_*` tools updated to write the new core + reserved
      `extensions: {}`
    - `task_*` and `artifact_*` tools unchanged this slice (separate
      blueprints handle their migration)
- **Storage migration**:
    - `internals/workspace/src/state/file-store.ts` reads old records
      under their previous shape, writes new records in the new shape.
      No on-disk reshape of historical data — old `attemptId` / `fromAttemptId`
      keys remain readable; new writes use the new keys. (This is a dev-only
      project; once all new writes are in place we expect to wipe storage
      directories rather than maintain a converter.)
- **All call sites updated**: `internals/agent` (HandoffDraft), `packages/agent-worker`
  (orchestrator, runner, MCP hub), `internals/web` (any UI surfaces showing
  attempt ids).

### Out of scope (downstream blueprints)

- `HandoffExtension` producer / consumer hooks — the type system
  defines the storage shape, but no hook is registered or invoked.
- Context-budget signaling on `LoopEvent`.
- Auto-checkpoint behavior (signal → checkpoint → close Wake).
- Task-tracking harness (Task records stay in the kernel for now,
  flagged as migration source per the adopted decision 005).
- Artifact → Resource merge.
- Session orchestrator CLI / UI surfaces.

### Verification

- `bun run typecheck` clean across `internals/workspace`,
  `internals/agent`, `packages/agent-worker`, `internals/web`.
- `bun test` for `internals/workspace`, `internals/agent`,
  `packages/agent-worker`, `internals/loop` — existing tests still pass
  after rename.
- New focused test in `internals/workspace`:
    - Creating a Wake → writing a Handoff with empty `extensions: {}`
      → reading both back round-trip.
    - Verify `taskRef` field is populated; `extensions` map is preserved
      verbatim across read/write (opaque payload).
- Manual smoke: `bun internals/workspace/test/a2a/workspace-harness.ts T1`
  still runs successfully against the renamed types.

## Build

- Renamed `Attempt → Wake` across `internals/workspace/src/state/`
  (`types.ts`, `store.ts`, `file-store.ts`, `index.ts` re-exports). All
  id-field renames applied: `attemptId → wakeId`,
  `activeAttemptId → activeWakeId`, `fromAttemptId → closingWakeId` (on
  Handoff), `createdByAttemptId → createdByWakeId` (on Artifact).
  Dropped `toAttemptId` from Handoff.
- Added the new `Handoff` core fields (`closingWakeId`, `resources`,
  `workLogPointer?`, `extensions`). Dropped `nextSteps` (folded into
  `pending`). Kept `artifactRefs`, `touchedPaths`, `runtimeRefs` as
  transitional fields with explicit comments flagging the cleanup
  trajectory.
- Renamed `internals/workspace/src/context/mcp/attempt-tools.ts` →
  `wake-tools.ts` (via `git mv`); rewrote internals to use `Wake`
  vocabulary (`createWakeTools`, `WakeScopedTools`, `WAKE_TOOL_DEFS`).
- Renamed all four MCP tools in `task.ts`: `attempt_create / list / get
  / update` → `wake_create / list / get / update`. Updated tool
  descriptions and `formatWake` / `formatHandoff` / `formatArtifact`
  output. `task_dispatch` now writes `Wake id: <wake_id>` into the
  dispatch instruction (was "Attempt id: <att_id>").
- Updated `internals/workspace/src/context/mcp/server.ts`: rebound
  `activeAttemptId → activeWakeId`, swapped the import to
  `wake-tools.ts`, replaced `ATTEMPT_TOOL_DEFS` with `WAKE_TOOL_DEFS`,
  updated all 4 task-tool registrations.
- Updated `internals/workspace/src/workspace.ts`:
  `recoverOrphanedAttempts → recoverOrphanedWakes`,
  `pruneOrphanWorktreeRefs` walks `listAllWakes`. Updated all comments.
- Updated `internals/workspace/src/loop/lead-hooks.ts`:
  `activeAttemptId → activeWakeId`, `activeAttemptChanged →
  activeWakeChanged`, header text "Active attempt changes" → "Active
  wake changes", folded `nextSteps` rendering into the `pending`
  rendering branch.
- Updated `internals/workspace/src/context/mcp/prompts.tsx`: worker /
  lead instruction prose now talks about Wake ids and `wake_*` tool
  calls; ledger formatter uses `activeWakeId`.
- Updated `internals/workspace/src/loop/prompt.tsx`,
  `worktree.ts`, `types.ts`, `config/types.ts`, and the `index.ts`
  re-export — type names, comments, and field names all migrated.
- Updated `internals/agent/src/runtime.ts` `HandoffDraft`: now carries
  the generic-core fields (`completed`, `pending`, `decisions`,
  `blockers`, `resources`); dropped `nextSteps` and the
  `ArtifactCandidate` references in favor of resource refs. Doc-string
  notes the harness-side `produceExtension` step.
- Updated `packages/agent-worker/src/`: `daemon.ts` (HTTP dispatch +
  close paths now read/write Wake fields, response shape uses `wakes`
  not `attempts`), `orchestrator.ts` (`findActiveWake` for prompt
  worktrees), `managed-workspace.ts` (worktree sweep walks
  `listAllWakes`, `Wake` type import), `workspace-registry.ts`
  (subscribes to `wake.terminal`, per-run tool rebuild uses
  `activeWakeId`), `client.ts` (response shapes renamed), `cli/index.ts`
  + `cli/commands/task.ts` (help text + ls/get/dispatch output).
- Updated `internals/web/src/api/types.ts`: `AttemptSummary →
  WakeSummary`, `TaskDetail.attempts → TaskDetail.wakes`, Handoff
  schema reflects core+resources+extensions, Artifact
  `createdByAttemptId → createdByWakeId`.
- Updated `internals/web/src/pages/workspace.tsx`: task-detail
  rendering uses `wakes` instead of `attempts`, Handoff renders
  `pending` instead of the dropped `nextSteps`, ledger row uses
  `activeWakeId`.
- Updated tests across `internals/workspace/test/` (state.test.ts,
  file-store.test.ts, lead-hooks.test.ts, task-tools.test.ts,
  workspace.test.ts, prompt.test.ts) and
  `packages/agent-worker/test/` (orchestrator.test.ts,
  workspace-integration.test.ts) to use the new method/field names
  (most via a single `sed` pass; assertion strings adjusted by hand).
- Added a round-trip test in `internals/workspace/test/state.test.ts`
  ("createHandoff round-trips an opaque per-harness extension
  payload") that writes a Handoff with both a populated `extensions`
  map and `resources` / `workLogPointer` fields, then reads it back
  and verifies all three are preserved verbatim.
- Updated `scripts/watch-validation.ts` and the `claude-code` loop
  comment to use the new vocabulary.
- Final grep sweep returns only intentional rename callouts in three
  comment lines in `internals/workspace/src/state/types.ts`.

## Verify

- **Typecheck NOT YET RUN**: `bun install` reproducibly hangs at
  "Resolving dependencies" on this machine in the harness's
  background-execution path (same issue surfaced after the semajsx
  merge — see commit `712fe9b`). The user opted to "park" the install
  problem for now; once `bun install` succeeds, run:
    - `bun run typecheck` (covers all six `@agent-worker/*` packages
      in the per-package enumeration).
    - `bun test` for `internals/shared`, `internals/loop`,
      `internals/agent`, `internals/workspace`,
      `packages/agent-worker`.
    - `bun run lint` (the `@semajsx/*` side runs through vitest, not
      affected by this slice).
- The rename was structural and mechanical (sed-driven for the bulk
  test files, carefully hand-edited for code with semantic field
  shape changes). High confidence the diff is internally consistent —
  the final straggler-grep returns only comment annotations of the
  form "Wake … (renamed from fromAttemptId)". Remaining risk: a few
  test descriptions still say "attempt" (cosmetic), and any callers
  outside this monorepo's tracked code (none expected) would break.

---

## Follow-on blueprints (planned, not yet drafted)

After this foundation lands, the natural sequence of decision-005
implementation blueprints is:

1. **Handoff extension hook protocol** — define `produceExtension` /
   `consumeExtension` signatures on the `HarnessType` interface; wire
   the orchestrator to call them at Wake close / start. No concrete
   harness implementation yet.
2. **Context-budget signaling** — extend `LoopEvent` with an
   approaching-exhaustion variant (or extend `usage`); per-runtime
   adapters (`ai-sdk`, `claude-code`, `codex`, `cursor`) emit it.
3. **Coding-harness extension** — first concrete `HandoffExtension`
   schema and hooks: branch, modified files, build / test status, CI refs.
   Validates the extension protocol end-to-end.
4. **Auto-checkpoint behavior** — orchestrator listens for the
   context-budget signal, runs the harness's `produceExtension`, closes
   the Wake with the new Handoff (core + coding extension), and
   surfaces the resume prompt.
5. **Task-tracking harness** — `Task` moves out of the workspace kernel
   into a harness-layer projection over WorkspaceEvents; existing
   `task_*` tools migrate to the new harness; kernel `Task` records
   removed.
6. **Session orchestrator surface** — CLI commands (`aw session new /
   list / resume`) and minimum web UI for cross-runtime task list +
   binding picker. The user-facing shape from decision 005.
7. **Artifact → Resource merge** — flagged cleanup; remove `Artifact`
   in favor of `Resource` everywhere.
