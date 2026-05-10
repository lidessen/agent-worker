# Harness Rename + HarnessType Registry

**Status:** done
**Date:** 2026-05-10
**Design context:** [decision 006](../design/decisions/006-harness-as-agent-environment.md) (substrate + HarnessType), [decision 005](../design/decisions/005-session-orchestration-model.md) (Wake / Handoff core+extension), [packages/harness.md](../design/packages/harness.md), [packages/harness-types/coordination.md](../design/packages/harness-types/coordination.md).

First implementation slice of decision 006. Renames `Workspace` to `Harness` across the entire codebase and lands the `HarnessType` interface + `HarnessTypeRegistry` as the load-bearing abstraction the substrate cut (slice 2) will plug a concrete `MultiAgentCoordinationHarnessType` into.

This slice **does not** extract channels/inbox/bridge into a coordination type yet — the renamed `Harness` class still holds them inline. What lands is the seam: the registry exists, the hooks fire at Handoff write/read sites against a single registered default no-op type, and the names match the terminal shape from day one.

## Approach

Two concept moves bundled, per the refactor-posture rule "the seam goes between concepts, not between rename and registry-cleanup":

1. **Rename pass.** `Workspace` → `Harness` across packages, modules, classes, types, HTTP routes, CLI verbs, web UI labels, JSONL paths, MCP tool descriptions, prompt text, tests, and config templates. No behavior change. Mechanical.

2. **Registry landing.** New `internals/harness/src/type/` module with `HarnessType` interface, `HarnessTypeRegistry`, default no-op type, and hook-invocation helpers. Wire helpers into the three Handoff write sites and into `ContextPacketBuilder` for the read site. Add `harnessTypeId?: string` to the `Handoff` record. The default type is registered at process startup; it's the only registered type after this slice — observable behavior is identical to today's.

Bundling rationale: separating the two would ship code where the class is still `Workspace` but holds a `HarnessTypeRegistry`, which violates "names match terminal shape from day one." Bundled, every name in the codebase reads as terminal after slice 1.

## Scope

### Rename surface

| Old | New |
| --- | --- |
| `internals/workspace/` | `internals/harness/` |
| `Workspace` (class in workspace.ts) | `Harness` (class in harness.ts) |
| `ManagedWorkspace` | `ManagedHarness` |
| `WorkspaceOrchestrator` | `HarnessOrchestrator` |
| `WorkspaceMcpHub` | `HarnessMcpHub` |
| `WorkspaceRegistry` (daemon-side) | `HarnessRegistry` (unified — there was already a daemon-level `HarnessRegistry` slot per DESIGN.md; they merge) |
| `WorkspaceEvent` | `HarnessEvent` |
| `WorkspaceStateStore` | `HarnessStateStore` |
| `WorkspaceConfig` / `WorkspaceDef` | `HarnessConfig` / `HarnessDef` |
| `workspace-registry.ts` | `harness-registry.ts` |
| `managed-workspace.ts` | `managed-harness.ts` |
| `recoverOrphanedWakes` (workspace.ts → harness.ts) | unchanged method name; file moves |
| `/workspaces/...` HTTP routes | `/harnesses/...` |
| `aw workspace ...` CLI | `aw harness ...` |
| `[agent][@workspace[:tag]][#channel]` CLI target syntax | `[agent][@harness[:tag]][#channel]` |
| `workspace-data/<name>/` storage path | `harness-data/<name>/` |
| `${{ workspace.tag }}` template | `${{ harness.tag }}` |
| `workspace.json` manifest filename | `harness.json` |
| `workspaces.json` daemon manifest | `harnesses.json` |
| Web UI labels saying "workspace" | "Harness" |
| MCP tool descriptions / prompt text mentioning "workspace" | "Harness" |
| Test file names referencing workspace | mirror the rename |
| `package.json` "name": `@agent-worker/workspace` | `@agent-worker/harness` |

`packages/agent-worker/` is **not** renamed — it's the daemon package, not the substrate. Its internal references update; its name stays.

`/workspaces/...` HTTP routes are renamed without a backwards-compat alias. Per CLAUDE.md early-development posture, breaking the API is acceptable; callers (CLI, web UI) update in this slice.

### Registry landing

New module `internals/harness/src/type/`:

```
type/
├── types.ts        ← HarnessType, ProduceExtensionInput, ConsumeExtensionInput
├── registry.ts     ← HarnessTypeRegistry (in-memory map, process-scoped singleton)
├── default.ts      ← DEFAULT_HARNESS_TYPE_ID, defaultHarnessType (no-op)
├── helpers.ts      ← runProduceExtension, runConsumeExtension; HandoffExtensionConsumeError
└── index.ts        ← public re-exports
```

Public types match the harness.md design doc:

```ts
export const DEFAULT_HARNESS_TYPE_ID = "default" as const;

export interface ProduceExtensionInput {
  wake: Wake;
  events: HarnessEvent[];
  workLog?: unknown;       // reserved; populated when the work-log slice lands
  draft: HandoffDraft;
}

export interface ConsumeExtensionInput<E = unknown> {
  extension: E | undefined;
  packet: ContextPacket;
}

export interface HarnessType<E = unknown> {
  readonly id: string;
  readonly label?: string;
  readonly schemaVersion?: number;
  produceExtension?(input: ProduceExtensionInput): Promise<E | undefined> | E | undefined;
  consumeExtension?(input: ConsumeExtensionInput<E>): Promise<ContextPacket> | ContextPacket;
}

export interface HarnessTypeRegistry {
  register(type: HarnessType): void;
  get(id: string): HarnessType | undefined;
  resolve(id: string | undefined): HarnessType;     // falls back to default
  list(): HarnessType[];
}
```

Failure semantics, codified in helpers per decision 005 + 006:

- `runProduceExtension` catches hook throws, logs via the harness event log, returns `undefined` (Handoff core still writes; missing extension recoverable).
- `runConsumeExtension` rethrows hook throws as `HandoffExtensionConsumeError` — Wake-startup blocker.

`Handoff` record schema gains:

```ts
export interface Handoff {
  // ...existing fields...
  /** HarnessType id whose hooks produced/should consume this Handoff's
   *  extension. Optional — defaults to DEFAULT_HARNESS_TYPE_ID for orphan
   *  recovery and any flow that has not declared a type. */
  harnessTypeId?: string;
}
```

Wire-up:

- **Three Handoff write sites** call `runProduceExtension` and persist `extensions[id] = payload` plus `harnessTypeId`:
  - `internals/harness/src/context/mcp/task.ts` — `handoff_create` MCP tool
  - `packages/agent-worker/src/daemon.ts` — HTTP close-task path
  - `internals/harness/src/harness.ts` — `recoverOrphanedWakes` (uses `DEFAULT_HARNESS_TYPE_ID`)
- **One Handoff read site** calls `runConsumeExtension`:
  - `internals/harness/src/context/builder.ts` (or wherever `ContextPacketBuilder` reads prior Handoffs) — when a previous Handoff exists for the task, run consume against the in-progress packet.
- **Registry instantiation:** `Daemon` constructor (in `packages/agent-worker/src/daemon.ts`) creates one `HarnessTypeRegistry`, registers the default type, and passes it through `HarnessRegistry` → `ManagedHarness` → `Harness` constructor.
- **`MultiAgentCoordinationHarnessType` is NOT registered** in this slice. Slice 2 extracts the channels/inbox content out of the `Harness` class and registers it as that concrete type. For now there's only the default, which is enough to land the seam without behavior change.

### Out of scope (downstream slices)

- Substrate cut: extracting channels/inbox/bridge/adapters from the `Harness` class into a registered `MultiAgentCoordinationHarnessType`. (slice 2)
- Concrete `produceExtension` / `consumeExtension` payload schemas (coding harness, etc.). (slice 3+)
- Work-log schema and producer. `produceExtension` receives `workLog: undefined` until that lands.
- Context-budget signaling on `LoopEvent` and auto-checkpoint behavior.
- Task-tracking harness type — `Task` records still live in the substrate this slice.
- Session orchestrator CLI / UI surfaces.
- Cross-harness-type translation hooks.

## Verification

### Behavior

- [x] `bun run typecheck` clean across `internals/{harness,agent,loop,shared}`, `packages/agent-worker`, `internals/web`.
- [x] `bun test internals/harness/ internals/agent/ internals/loop/ internals/shared/ packages/agent-worker/`: 935 pass, 0 fail (baseline 922; +13 new harness-type tests).
- [x] Manual a2a smoke: `bun internals/harness/test/a2a/coordination-harness.ts T1` PASS.
- [ ] CLI / HTTP runtime probes (`aw harness ls`, `curl /harnesses`) — not exercised in this slice's verification. The renamed handlers compile and type-check; integration tests cover orchestrator + daemon paths. A live runtime smoke is reasonable as part of the next slice (substrate cut) when more change touches the live surface.
- [x] One round-trip test landed in `internals/harness/test/state.test.ts` (`createHandoff round-trips an opaque per-harness extension payload`) covering the new `harnessTypeId` field. The richer "register fake type → produce → consume → packet section" path is exercised by the 13 new tests in `harness-type.test.ts`. End-to-end through the MCP tool boundary belongs to a downstream slice once `consumeExtension` has a live caller.

### Design constraints

- [x] Stays within module boundaries per [packages/harness.md](../design/packages/harness.md) and [packages/agent-worker.md](../design/packages/agent-worker.md).
- [x] No transitional names: zero `Workspace` PascalCase identifiers remain in source. Remaining `[Ww]orkspace` hits are all intentional (Bun/npm `"workspace:*"` protocol, Codex `sandbox: "workspace-write"` external mode, generic English in soul-chat example, test mock strings). Decision text in `design/decisions/00{2,3,4,5}.md` preserves history under explicit forward-reference notes.
- [x] No transitional fields on `Handoff` beyond what already shipped in `wake-handoff-foundation`. The new `harnessTypeId?: string` is the terminal shape, not a migration prop.
- [x] Failure semantics for produce/consume hooks match decision 005 + 006 contracts: produce-throw is logged + swallowed (Handoff core still writes); consume-throw rethrows as `HandoffExtensionConsumeError`.
- [x] An adopted proposal exists in `design/decisions/`: 006 ✓.

## Build

- **A — Rename pass.** `git mv internals/workspace → internals/harness`; `package.json` `name` → `@agent-worker/harness`; root `tsconfig.json` paths target updated. Bulk PascalCase rename `Workspace` → `Harness` across `.ts` / `.tsx` in `internals/{harness,agent,loop,shared}`, `packages/agent-worker`, `internals/web`, `scripts`. Follow-up lowercase pass for camel/kebab/file-name occurrences. UPPERCASE pass for `WORKSPACE_PROMPT_SECTIONS` → `HARNESS_PROMPT_SECTIONS` and `WORKSPACE_TOOL_DEFS` → `HARNESS_TOOL_DEFS`. File renames via `git mv`: `workspace.ts` → `harness.ts`; `managed-workspace.ts` → `managed-harness.ts`; `workspace-registry.ts` → `harness-registry.ts`; `workspace-client.ts` → `harness-client.ts`; web UI `workspace-card.tsx` / `create-workspace-dialog.tsx` / `workspace-settings-view.tsx` / `workspaces.ts` / `workspace-data.ts` / `workspace.tsx`+`.style.ts` to their `harness-*` counterparts; test files mirror. The a2a smoke `workspace-harness.ts` renamed to `coordination-harness.ts` (it specifically tests the multi-agent coordination flavor).

- **B — `type/` module + registry threading.**
  - New module `internals/harness/src/type/`: `types.ts` (`HarnessType`, `ProduceExtensionInput`, `ConsumeExtensionInput`, `HarnessTypeRegistry`), `registry.ts` (`InMemoryHarnessTypeRegistry`, factory `createHarnessTypeRegistry` seeded with default), `default.ts` (`DEFAULT_HARNESS_TYPE_ID`, `defaultHarnessType`), `helpers.ts` (`runProduceExtension`, `runConsumeExtension`, `HandoffExtensionConsumeError`, `ProduceLogger`), `index.ts` re-exports. Re-exported from package root.
  - `Handoff` and `CreateHandoffInput` gained optional `harnessTypeId?: string`. Both `FileHarnessStateStore` and `InMemoryHarnessStateStore` propagate it on `createHandoff`.
  - `HarnessConfig` gained optional `harnessTypeId`. `Harness` class constructor accepts an optional `harnessTypeRegistry` argument (defaults to a fresh registry seeded with the default no-op type) and exposes `harnessTypeId` + `harnessTypeRegistry` as readonly fields.
  - Registry threaded through: `factory.ts:createHarness(config, registry?)` accepts the registry; `factory.ts:createAgentTools` reads it off the Harness; `mcp-server.ts:createAgentServer` reads it off the Harness; `daemon.ts` HTTP `tool-call` and `harness-registry.ts` per-run tool rebuild both read it off the resolved Harness.

- **C — Hook wire-up.** `runProduceExtension` is invoked at all three Handoff write sites:
  1. `internals/harness/src/context/mcp/task.ts` (`handoff_create` MCP tool) — fetches the closing Wake, runs the hook, attaches `extensions[id]: payload` and stamps `harnessTypeId` on the persisted Handoff.
  2. `packages/agent-worker/src/daemon.ts` HTTP close-task path — same pattern; the closing Wake is fetched first when present.
  3. `internals/harness/src/harness.ts` `recoverOrphanedWakes` — orphan handoffs stamp `harnessTypeId: DEFAULT_HARNESS_TYPE_ID`.

  `runConsumeExtension` helper landed but **no live caller** — see Verify note on this. Slice ships the helper with unit-test coverage; first runtime caller wires up in the auto-checkpoint / resume blueprint (decision 005 follow-on #4) when prior-Handoff visibility is plumbed into packet assembly.

- **Tests.** New `internals/harness/test/harness-type.test.ts` (13 tests) covers registry semantics, default fallback, both helpers, both failure-semantic contracts. Existing `state.test.ts` round-trip test extended to assert `harnessTypeId` field persistence.

## Verify

- `bun run typecheck` clean across `internals/{harness,agent,loop,shared}` and `packages/agent-worker`. Pre-existing baseline failures in unrelated packages (`internals/terminal` etc.) are unchanged.
- `bun test internals/harness/ internals/agent/ internals/loop/ internals/shared/ packages/agent-worker/`: **935 pass, 0 fail** (baseline 922 → +13 new harness-type tests; the two CWD-path baseline fails were artifacts of running from `internals/workspace/` and disappear when running from project root).
- A2A smoke `bun internals/harness/test/a2a/coordination-harness.ts T1`: PASS.
- Straggler-grep audit: every remaining `[Ww]orkspace` hit is intentional (Bun/npm `"workspace:*"` protocol, Codex `sandbox: "workspace-write"` external mode, generic English ("chat workspace" in `internals/prompt/examples/soul-chat.tsx`), test mock strings (`workspace.channel_read` as a fake MCP server name), comment references in design/decisions/00{2,3,4,5}.md preserved as historical record under forward-reference notes).
- Failure semantics directly tested: `runProduceExtension swallows hook throws and returns undefined`; `runConsumeExtension rethrows hook throws as HandoffExtensionConsumeError`.
- **Did NOT verify in this slice (acceptable, called out):** live `aw` CLI invocation and HTTP probe of `/harnesses`. The renamed handlers compile and existing integration tests exercise the underlying paths; a live-daemon smoke is reasonable in the next slice when substrate-cut behavior changes invite end-to-end re-validation.

## Follow-ups

- **Wire `runConsumeExtension` to a live read site.** Today no code path reads prior Handoffs at packet-build time; `Wake.inputHandoffId` is set but never consumed. The auto-checkpoint / resume blueprint (decision 005 follow-on #4) is the natural home — when it plumbs prior-Handoff visibility into packet assembly, `runConsumeExtension` plugs in there.
- **Substrate cut (slice 2 of decision 006).** Extract `ChannelStore`, `InboxStore`, `ChannelBridge`, `adapters/telegram`, channel/inbox/team/wait_inbox/chronicle MCP tools out of the `Harness` class into a registered `MultiAgentCoordinationHarnessType`. Today's behavior (everything inline on the `Harness` class) is the temporary state this rename slice deliberately preserved; slice 2 makes the substrate boundary load-bearing.
- **Live runtime smoke after slice 2.** Once channels/inbox move to a registered type, run the daemon end-to-end (CLI + HTTP probe of `/harnesses`, `aw harness ls`, send/read on a channel) to validate that the type-contributed surfaces still mount correctly.
- **`task.ts` Wake-fallback in `handoff_create`.** Current code uses `(await store.getWake(closingWakeId)) ?? { id: closingWakeId } as Wake` as a last-resort fallback when the Wake lookup fails; ideally it errors instead. Defer until concrete payload schemas land — they'll surface whether the fallback is acceptable (a no-op produce hook tolerates it) or needs a stricter contract.
