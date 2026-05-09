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

- [ ] Rename types in `internals/workspace/src/state/types.ts`:
      `Attempt → Wake`, plus all id-field renames listed in scope.
- [ ] Update `Handoff` schema: add core fields (`closingWakeId`,
      `taskRef`, `resources`, `workLogPointer?`, `extensions`); remove
      `nextSteps`, `fromAttemptId`, `toAttemptId`.
- [ ] Update `internals/workspace/src/state/store.ts` and
      `file-store.ts` to use new keys.
- [ ] Rename MCP tools: `attempt_list / attempt_get` →
      `wake_list / wake_get` in `internals/workspace/src/context/mcp/`.
      Keep `handoff_*` tool surface but update its payload shape.
- [ ] Update `internals/workspace/src/mcp-server.ts`'s per-run binding
      from `activeAttemptId` to `activeWakeId`.
- [ ] Update `internals/agent/src/runtime.ts` and types: `HandoffDraft`
      now carries the generic core fields (no extensions; that's still
      a harness-side concern).
- [ ] Update `packages/agent-worker/src/orchestrator.ts` and runner closure
      wiring to use the new field names.
- [ ] Update `internals/web` consumers — any surfaces displaying
      attempt ids switch to wake ids.
- [ ] Add round-trip test for the new `Handoff` shape with empty
      extensions map.
- [ ] Sweep call sites with grep: `attemptId`, `Attempt[A-Z]`,
      `fromAttemptId`, `toAttemptId` — ensure none remain (except in
      explicitly historical test fixtures or migration comments).
- [ ] `bun run typecheck` clean.
- [ ] `bun test` clean for the four packages above.

## Verify

(filled after Build completes)

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
