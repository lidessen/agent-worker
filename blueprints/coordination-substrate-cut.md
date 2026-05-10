# Coordination Substrate Cut

**Status:** build-ready (open questions resolved 2026-05-10)
**Date:** 2026-05-10
**Design context:** [decision 006](../design/decisions/006-harness-as-agent-environment.md) slice 2, [packages/harness.md](../design/packages/harness.md), [packages/harness-types/coordination.md](../design/packages/harness-types/coordination.md).

Second implementation slice of decision 006. Slice 1 renamed `Workspace` → `Harness` and landed the `HarnessType` interface + registry, but the renamed `Harness` class still holds channels / inbox / bridge / telegram inline. This slice **extracts coordination flavor out of the substrate** and registers it as a concrete `MultiAgentCoordinationHarnessType` peer.

After this slice, the substrate `Harness` class holds no coordination-specific state, and a future writing / coding / personal type can plug in by the same mechanism the coordination type uses.

## Approach

Three concept moves bundled, per the refactor-posture rule "the seam goes between concepts":

1. **Expand the `HarnessType` interface** so a type can contribute beyond Handoff hooks: type-specific stores, MCP tools, context-provider extension, config parsing, lifecycle (init/shutdown), and snapshot slice.
2. **Slim the `Harness` substrate class** — strip every coord-flavored field, method, and store. The substrate becomes name/tag/storage + substrate stores (documents, resources, chronicle, timeline) + state store (Task/Wake/Handoff) + worktree + type registry + lifecycle.
3. **Land `MultiAgentCoordinationHarnessType` as a peer package** at `internals/harness-coordination/`. Channels, inbox, status, bridge, telegram, priority queue, lead hooks, channel/inbox/team/wait_inbox MCP tools, and coord-specific config and prompt UI move there.

Bundling rationale: separating would either (a) ship a half-cut substrate that still imports coord modules (violating "names match terminal shape from day one"), or (b) ship a coord package that doesn't yet own its stores. Bundled, every name across substrate and coord reads as terminal after this slice.

Peer-package rationale (vs. subdirectory inside `internals/harness/`): decision 006's structural commitment is that types are **peers**, not subtypes — placing coord even at a subpath of harness signals the privilege the decision rejects. Mirroring the design layout (`design/packages/harness-types/coordination.md` is a peer to `harness.md`) keeps the code shape and the doc shape aligned. Cost: one extra workspace package; acceptable.

## Scope

### HarnessType interface expansion

Today (after slice 1):

```ts
export interface HarnessType<E = unknown> {
  readonly id: string;
  readonly label?: string;
  readonly schemaVersion?: number;
  produceExtension?(input: ProduceExtensionInput): Promise<E | undefined> | E | undefined;
  consumeExtension?(input: ConsumeExtensionInput<E>): Promise<ContextPacket> | ContextPacket;
}
```

Slice 2 adds (shapes are tentative — finalized during build):

```ts
export interface HarnessType<E = unknown, R = unknown> {
  readonly id: string;
  readonly label?: string;
  readonly schemaVersion?: number;

  // Existing Handoff hooks (slice 1).
  produceExtension?: ...;
  consumeExtension?: ...;

  // NEW — type-contributed stores, exposed back to callers via
  // `harness.typeRuntime` slot (typed by the type, opaque to substrate).
  contributeRuntime?(harness: Harness, config: HarnessConfig): R | Promise<R>;

  // NEW — MCP tools layered on top of substrate tools.
  contributeMcpTools?(ctx: HarnessMcpContext): McpToolDef[];

  // NEW — packet sections layered on top of substrate sections.
  contributeContextSections?(input: ContributeContextInput<R>): ContextPacketSection[];

  // NEW — lifecycle hooks for type-side init/shutdown (start telegram
  // adapter, close bridge, etc.).
  onInit?(harness: Harness, runtime: R, config: HarnessConfig): Promise<void> | void;
  onShutdown?(harness: Harness, runtime: R): Promise<void> | void;

  // NEW — type-flavored slice of snapshot. Substrate snapshot returns
  // its own shape; consumers that want a unified view stitch the two.
  snapshotExtension?(harness: Harness, runtime: R, opts?: unknown): Promise<unknown>;

  // NEW — config parsing for type-specific YAML (coord parses
  // channels/lead/queueConfig/connections; substrate doesn't know these).
  parseConfig?(raw: unknown): R extends never ? never : Partial<HarnessConfig>;
}
```

Two places where the typed runtime `R` reaches callers:

- `harness.typeRuntime` — typed slot the substrate stores after `contributeRuntime` returns.
- The type itself exposes `coordinationRuntime(harness)` (or similar) as a typed accessor — the substrate just stores the opaque blob.

### Substrate class slimming

Remove from `Harness`:

| Field / method | New home |
| --- | --- |
| `defaultChannel`, `lead`, `_onDemandAgents`, `agentChannels` | coord runtime |
| `channelStore`, `inboxStore`, `statusStore` | coord runtime |
| `bridge`, `bridgeImpl` (`ChannelBridge`) | coord runtime |
| `instructionQueue` (`InstructionQueue`) | coord runtime |
| `routeMessageToInboxes`, `enqueueToAgent` | coord routing module |
| `registerAgent`, `hasAgent`, `getAgentChannels`, `isLead` | coord runtime methods |
| coord-flavored fields on `HarnessStateSnapshot` | coord `snapshotExtension` |

Keep on `Harness`:

- `name`, `tag`, `storageDir`, `_sandboxBaseDir` (substrate identity)
- `stateStore` (Task/Wake/Handoff — substrate per decision 005)
- `harnessTypeId`, `harnessTypeRegistry`, **new** `typeRuntime` (substrate wiring)
- `contextProvider` — substrate-only after the cut (documents / resources / chronicle / timeline)
- `eventLog` (substrate)
- `harnessSandboxDir`, `agentSandboxDir`
- `pruneOrphanWorktreeRefs`, `recoverOrphanedWakes` (substrate)
- `init`, `shutdown` — substrate scope; type's `onInit` / `onShutdown` are invoked from these.

### `HarnessConfig` split

Today's `HarnessConfig` mixes substrate fields with coord fields (`channels`, `defaultChannel`, `connections`, `agents`, `lead`, `onDemandAgents`, `queueConfig`, `maxMessageLength`). After cut:

- Substrate `HarnessConfig` keeps: `name`, `tag`, `storage`, `storageDir`, `sandboxBaseDir`, `harnessTypeId`.
- Coord-specific config moves to `MultiAgentCoordinationConfig` parsed by coord's `parseConfig`. The harness file parser dispatches on `harnessTypeId`.
- Wire-up: the daemon's harness loader reads YAML/JSON, splits substrate fields from `extras`, asks the resolved type to `parseConfig(extras)`, and passes both into the `Harness` constructor.

### Coord package layout

```
internals/harness-coordination/
├── package.json              ← name "@agent-worker/harness-coordination"
├── tsconfig.json
└── src/
    ├── index.ts              ← exports type + runtime accessor
    ├── type.ts               ← MultiAgentCoordinationHarnessType (the singleton)
    ├── runtime.ts            ← CoordinationRuntime — what the type stores per harness
    ├── config.ts             ← parseConfig + MultiAgentCoordinationConfig schema
    ├── routing.ts            ← routeMessageToInboxes / enqueueToAgent (extracted)
    ├── snapshot.ts           ← snapshotExtension implementation
    ├── stores/
    │   ├── channel.ts        ← moved from harness
    │   ├── inbox.ts          ← moved from harness
    │   └── status.ts         ← moved from harness
    ├── bridge.ts             ← moved from context/bridge.ts
    ├── priority-queue.ts     ← moved from loop/
    ├── lead-hooks.ts         ← moved from loop/
    ├── adapters/
    │   └── telegram.ts       ← moved
    ├── mcp/
    │   ├── channel.ts        ← moved
    │   ├── inbox.ts          ← moved
    │   ├── team.ts           ← moved
    │   └── wait-inbox.ts     ← moved (today inlined elsewhere — verify during build)
    ├── prompt.tsx            ← moved if loop/prompt has coord-specific paths
    └── types.ts              ← Message, InboxEntry, Instruction, QueueConfig,
                                AgentStatus*, ChannelAdapter, ChannelBridgeInterface,
                                BridgeSubscriber
```

Substrate `internals/harness/src/types.ts` loses every type listed in `coord/types.ts`. The substrate `ContextProvider` interface drops `channels`, `inbox`, `status`; coord runtime exposes those.

### Daemon wiring

`packages/agent-worker/src/daemon.ts`:
- import `MultiAgentCoordinationHarnessType` from `@agent-worker/harness-coordination`.
- register it on the shared `HarnessTypeRegistry` at startup, alongside the default no-op.
- Harness config files with `harnessTypeId: "multi-agent-coordination"` (or coord-shaped legacy fields — see Migration) resolve to coord type; substrate config + coord config get assembled and passed to `new Harness(config, registry)`.

Per CLAUDE.md early-development posture: no transitional `harnessTypeId` defaulting heuristic. If existing harness configs predate the explicit `harnessTypeId` field, they update in this slice — every YAML on disk gets a `harnessTypeId: multi-agent-coordination` line. The default no-op type is for orphan recovery and substrate-only test fixtures, not a fallback for "unspecified coord."

### MCP tool registration becomes type-aware

Today `internals/harness/src/context/mcp/server.ts` (and `factory.ts`) register the full bag of tools (substrate + coord) as one set. After cut:

- Substrate mounts: `resource_*`, `task_*` (handoff/Wake), `wake_*`, plus generic chronicle/timeline if those remain substrate.
- Coord type's `contributeMcpTools` adds: `channel_*`, `inbox_*`, `team_*`, `wait_inbox`.
- `factory.createAgentTools` iterates the resolved type's contribution and union-merges with substrate tools.

### Tests

- Substrate-only tests stay in `internals/harness/test/`. They must run **without depending on `@agent-worker/harness-coordination`**.
- Coord-flavored tests (anything that uses channels / inbox / status / bridge / telegram / priority queue / lead) move to `internals/harness-coordination/test/`.
- A2A smoke `internals/harness/test/a2a/coordination-harness.ts` moves to coord package.
- New substrate test: construct a `Harness` with `DEFAULT_HARNESS_TYPE_ID` (no coord), run `init` / `shutdown`, verify substrate stores work and no coord references resolve.

### Out of scope (downstream slices)

- Coding / writing / manager / personal harness type implementations.
- Task-tracking as a separate harness type — `Task` records still live in substrate after this slice (decision 005's deferred consequence; needs its own slice).
- Removing the `lead-hooks` / `priority-queue` migration scaffolding — `coordination.md` documents these as transitional; full removal awaits reducer/extractor coverage.
- Cross-Harness federation / cross-type translation hooks.
- Splitting `loop/prompt.tsx` if it has substrate-leaking coord knowledge — investigate during build; if separable, move; if entangled, defer to a follow-on prompt-cleanup slice.
- Web UI changes — the existing UI mostly reads via HTTP and snapshots; the snapshot stitch (substrate + coord extension) is the only required UI-side touch.

## Resolved questions

1. **Typed-runtime accessor shape — kept as planned.** `harness.typeRuntime` slot (opaque to substrate) + typed accessor exported from the coord type module (`coordinationRuntime(harness)`). No generic `contribution<T>(typeId)` — only one type lives on a Harness, the slot does not need keying.

2. **`HarnessRuntime` interface — Plan A (drop coord fields entirely).** Substrate `HarnessRuntime` keeps only `name`, `tag`, `contextProvider`, `eventLog`, `storageDir`, `harnessSandboxDir`, `stateStore`, `init`, `shutdown`, `snapshotState`. **Drops:** `defaultChannel`, `bridge`, `instructionQueue`, `registerAgent`, `agentSandboxDir(name)`. Coord exports its own `CoordinationRuntime` interface and a `coordinationRuntime(harness)` accessor; callers that want coord access import from `@agent-worker/harness-coordination`. Plan B (composite `HarnessRuntime & CoordinationRuntime`) was rejected because it would force every substrate consumer to import the composite type and pull coord back into the substrate import graph — defeats the cut.

3. **`HarnessStateSnapshot` shape — Plan B (compose substrate + extensions).** New shape:

   ```ts
   interface HarnessStateSnapshot {
     substrate: HarnessSubstrateSnapshot; // { name, tag, harnessTypeId, documents, chronicle }
     typeExtensions: Record<string, unknown>; // keyed by HarnessType.id; coord fills in its slice
   }
   ```

   Coord's `snapshotExtension` returns `CoordinationSnapshot` (`defaultChannel`, `channels`, `queuedInstructions`, `agents` with inbox/channels). Consumers that want a "flat" view (web UI snapshot panel, debug printers) call a stitcher helper exported from coord:

   ```ts
   function stitchSnapshot(snap: HarnessStateSnapshot): FlatHarnessSnapshot
   ```

   Posture rule "land the new shape fully in one slice" wins over the smaller-churn Plan A; consumers update inside this slice.

4. **`prompt.tsx` / `prompt-ui.tsx` ownership — split, not duplicate.**
   - **Substrate** (`internals/harness/src/loop/prompt-ui.tsx`): unchanged. Pure rendering of `PromptSectionNode[]` via semajsx/prompt.
   - **Substrate** (`internals/harness/src/loop/prompt.tsx`): keeps `PromptSection` type, `assemblePrompt`, `soulSection` (instructions only), and a slimmed `PromptContext` carrying only `agentName`, `instructions`, `sandboxDir`, `harnessSandboxDir`, `worktrees`. Drops `provider`, `inboxEntries`, `currentInstruction`, `currentPriority`, `currentMessageId`, `currentChannel`, `stateStore`, `role`, `harnessName` — those are coord-shaped.
   - **Coord** (`internals/harness-coordination/src/prompt.tsx`): `inboxSection`, `responseGuidelines` (talks about `channel_send`, `no_action`, multi-agent peers), and `CoordinationPromptContext extends PromptContext` adding `provider: ContextProvider`, `inboxEntries`, `currentInstruction`/`currentPriority`/`currentMessageId`/`currentChannel`, `stateStore`, `role`, `harnessName`. `BASE_SECTIONS` itself moves to coord because two of its three sections are coord — substrate exposes `SUBSTRATE_BASE_SECTIONS = [soulSection]` and coord exports `COORDINATION_BASE_SECTIONS = [soulSection, responseGuidelines, inboxSection]` for callers.

## Verification expectations (filled during build)

### Behavior
- [ ] `bun run typecheck` clean across `internals/{harness,harness-coordination,agent,loop,shared}`, `packages/agent-worker`, `internals/web`.
- [ ] `bun test internals/harness/`: passes without `@agent-worker/harness-coordination` in scope.
- [ ] `bun test internals/harness-coordination/`: passes (coord-specific tests moved here).
- [ ] `bun test packages/agent-worker/`: passes (integration tests resolved against coord type registered in daemon).
- [ ] A2A smoke `bun internals/harness-coordination/test/a2a/coordination-harness.ts T1`: PASS.
- [ ] Live runtime smoke: `aw daemon start`, `aw harness create` (with `harnessTypeId: multi-agent-coordination`), send + read on a channel, register an agent, verify inbox routing.

### Design constraints
- [ ] Stays within module boundaries per [packages/harness.md](../design/packages/harness.md) and [packages/harness-types/coordination.md](../design/packages/harness-types/coordination.md).
- [ ] No transitional names: zero coord-flavored fields on substrate `Harness` class, zero coord types in `internals/harness/src/types.ts`.
- [ ] No transitional fields on `HarnessConfig`: substrate fields are substrate-only; coord fields live under coord's parsed config shape.
- [ ] Substrate package import graph contains no edge to `@agent-worker/harness-coordination` (verified by import scan or build dep check).
- [ ] Existing harness config files updated to declare `harnessTypeId: multi-agent-coordination` explicitly — no heuristic default-to-coord.
- [ ] Refactor posture honored: when slice 2 lands, the codebase reads as if substrate / coord were always separate.

## TODO scaffold (during build)

```
[x] Land expanded HarnessType interface in internals/harness/src/type/types.ts.
    (lifecycle slice: contributeRuntime + onInit + onShutdown landed.
    infrastructure-prep slice: contributeMcpTools + contributeContextSections
    + snapshotExtension + parseConfig added as optional protocol surface;
    consumers wire up during the cut.)
[x] Add `typeRuntime` slot + lifecycle wire-up in Harness class (init runs onInit; shutdown runs onShutdown).
[ ] Substrate ContextProvider drops channels/inbox/status; CompositeContextProvider becomes substrate-only.
[ ] Substrate types.ts loses Message / InboxEntry / Instruction / QueueConfig / AgentStatus* / ChannelAdapter / ChannelBridgeInterface / BridgeSubscriber / Priority / InboxState.
[ ] Substrate HarnessRuntime drops defaultChannel/bridge/instructionQueue/registerAgent/agentSandboxDir (per resolved Q #2).
[x] Substrate HarnessStateSnapshot reshapes to { substrate, typeExtensions } (per resolved Q #3); coord type contributes via snapshotExtension. Stitcher helper deferred until consumer demands it.
[ ] Substrate prompt.tsx slims PromptContext + retains soulSection + assemblePrompt; SUBSTRATE_BASE_SECTIONS = [soulSection] (per resolved Q #4).

[x] Create internals/harness-coordination/ — package.json, tsconfig, workspace registration via internals/* glob; path alias added to root tsconfig.
[x] Move stores/channel.ts, stores/inbox.ts, stores/status.ts.
[x] Move context/bridge.ts → src/bridge.ts.
[x] Move loop/priority-queue.ts, loop/lead-hooks.ts.
[x] Move adapters/telegram.ts.
[ ] Move context/mcp/{channel,inbox,team}.ts; locate wait_inbox.
[x] Move coord prompt sections (inboxSection + responseGuidelines + COORDINATION_BASE_SECTIONS) to coord; substrate keeps soulSection + assemblePrompt + SUBSTRATE_BASE_SECTIONS.
[ ] Extract routeMessageToInboxes / enqueueToAgent → src/routing.ts.
[~] Implement MultiAgentCoordinationHarnessType: snapshotExtension landed (snapshot reshape slice). contributeRuntime, contributeMcpTools, contributeContextSections, onInit, onShutdown, parseConfig still pending.
[ ] Implement coord parseConfig schema; wire into harness loader.

[x] Register coord type — done at the substrate factory level (createHarness pre-registers `multiAgentCoordinationHarnessType` in any registry passed to a Harness; daemon doesn't need a separate registration).
[ ] Update factory.createAgentTools to merge type-contributed tools.
[ ] Update HarnessStateSnapshot consumers (web UI snapshot view, debug printers) for new shape.
[ ] Update existing harness config YAML/JSON on disk (if any) to add `harnessTypeId: multi-agent-coordination`.

[ ] Move coord-flavored tests from internals/harness/test/ → internals/harness-coordination/test/.
[ ] Move a2a smoke (coordination-harness.ts) to coord package.
[ ] Add substrate-only construction test to internals/harness/test/.
[ ] /code-check (oxfmt + oxlint + tsgo).
[ ] bun test across affected packages.
[ ] A2A smoke.
[ ] Live runtime smoke.
[ ] Strip TODO scaffold; preserve Follow-ups; flip Status to done.
```

## Build

(filled during work)

## Verify

(filled during work)

## Follow-ups

(filled at close)
