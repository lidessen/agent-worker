# MultiAgentCoordinationHarnessType — Design

> The harness type for multi-agent coordination work: channels and inboxes for cross-agent message passing, channel bridges to external platforms (Telegram first), team docs, and a lane vocabulary on top of the substrate Track / chronicle / timeline / status mechanisms. This is the type today's `Workspace`-the-class historically baked into the kernel; per [decision 006](../../decisions/006-harness-as-agent-environment.md) (implemented), it is one peer `HarnessType` plugged into the universal `Harness` substrate, no longer privileged. Lives in `@agent-worker/harness-coordination`.

See [../harness.md](../harness.md) for the substrate this type plugs into.

## CoordinationRuntime

The single owner of every coord-flavored piece of state. Constructed by `multiAgentCoordinationHarnessType.contributeRuntime({ harness, config })` and stashed on `harness.typeRuntime`. Callers reach it through the typed accessor `coordinationRuntime(harness): CoordinationRuntime` exported from the package; the accessor throws when the harness is plugged into a different type or lacks the runtime.

Holds (all readonly fields except where noted):

- `channelStore`, `inboxStore`, `statusStore` — coord-flavored data stores; substrate's `CompositeContextProvider` sources its `channels` / `inbox` / `status` slots from these.
- `bridge: ChannelBridge` — channel-event bridge; external adapters (Telegram et al.) attach here.
- `instructionQueue: InstructionQueue` — three-lane priority queue (immediate / normal / background) the orchestrator dispatches from.
- `defaultChannel: string`, `lead: string | undefined` — coord shape designations.
- `agentChannels: ReadonlyMap<string, ReadonlySet<string>>` — agent → joined-channels view.
- `agentsConfig: string[]`, `connectionsConfig: ChannelAdapter[]` — cached `HarnessConfig` slices used by `onInit`.

Methods:

- `isLead(name)`, `hasAgent(name)`, `getAgentChannels(name)` — agent-roster queries.
- `registerAgent(name, channels?)` — joins channels (lead auto-joins all), loads the agent's persisted inbox, seeds an idle status entry.
- `load()` — called from the type's `onInit`; loads `statusStore`, `channelStore` index, and per-agent inboxes.
- `shutdown()` — called from the type's `onShutdown`; tears down the bridge.

Routing (`routeMessageToInboxes` / `enqueueToAgent`) is private; the constructor wires `channelStore.on("message", …)` so routing fires automatically when channels emit. Substrate is uninvolved.

## What the type contributes via the protocol

- **`contributeRuntime`** constructs and returns a `CoordinationRuntime` from `{ harness, config }`, reading the substrate's shared `harness.storage` to seed the coord stores.
- **`onInit`** runs `runtime.load()`, registers configured agents (`runtime.registerAgent` per `runtime.agentsConfig`), and attaches configured channel adapters (`runtime.bridge.addAdapter` per `runtime.connectionsConfig`).
- **`onShutdown`** runs `runtime.shutdown()`.
- **`contributeMcpTools({ harness, runtime, agentName })`** returns the coord-flavored per-agent tool set as `Array<{ name, def, handler }>`. `factory.buildAgentToolSet` merges these with substrate tools at the per-agent boundary. Tool groups:
  - `channel_*` — `send`, `read`, `list`, `join`, `leave` over named channels. Channel messages are raw intake/audit; semantic state changes require extraction or reducer promotion into HarnessEvents.
  - `my_inbox*` / `no_action` / `my_status_set` — per-agent inbox + status surface for the orchestrator's polling loop.
  - `team_*` — `members`, `doc_read / write / append / list / create`. Team doc surfaces are coord-flavored even though the underlying `documents` store is substrate.
  - `wait_inbox` — blocking-wait primitive for lead agents that wait for worker output.
- **`COORDINATION_TOOL_DEFS`** — static def catalog mirroring `contributeMcpTools`'s output, used by `stdio-entry` (which has no live `Harness`) merged with substrate's `HARNESS_TOOL_DEFS`.
- **`snapshotExtension({ harness, runtime, opts })`** returns the coord slice of `HarnessStateSnapshot.typeExtensions["multi-agent-coordination"]`: `defaultChannel`, `channels`, `queuedInstructions`, and the per-agent `agents` array (each with `status` / `currentTask` / `channels` / recent `inbox` / recent `recentActivity`).
- **Prompt sections** — `inboxSection` and `responseGuidelines` exported from `prompt.tsx`. The orchestrator composes coord agents' base prompt as `[soulSection, ...COORDINATION_BASE_SECTIONS, ...HARNESS_PROMPT_SECTIONS]`; substrate's `soulSection` is prepended at the use site (the alternative — coord re-importing `soulSection` through the substrate barrel — hits a TDZ circularity, since substrate's barrel re-exports `createHarness` which loads the coord package).
- **Handoff hooks (`produceExtension` / `consumeExtension`)** — capture coord-flavored Wake-close state (outstanding inbox refs, pending channel reads, in-flight team-doc edits) and inject them into the next Wake's `ContextPacket`. (Hook bodies remain TODO; the protocol slot is wired.)
- **Lane / entry vocabulary on substrate projections** — Track lane names (`incident`, `feature thread`, `release lane`, `watch`, `migration`) and chronicle / timeline / status entry schemas (agent-to-agent message events, lead handoffs, channel decision logs, per-agent self-reported status). Substrate provides the projection mechanism; coord names the lanes and entry shapes.
- **Capability invocations** — coord-specific protected effects: channel sends to external platforms via the bridge, lead-handoff dispatch, team doc writes.
- **Config schema** — YAML coordination definition: channels list, default channel, lead-agent designation, on-demand agent set, connections (adapter configs), priority queue config. Substrate covers identity / tag / storage / `harnessTypeId`; coord fills in the rest. (`parseConfig` is the formal protocol slot; today substrate's loader still owns the YAML projection and coord reads from the resulting `HarnessConfig` directly. Tightening this is a future cleanup.)

## Key mechanisms (type-local)

**Inbox holds references, not content.** Channels own message bodies; each agent's inbox holds `{ messageId, state }`. Selective ack means an agent can ignore a message without dropping the conversation; messages remain in the channel log.

**`provider.send` cross-store orchestration.** Long messages create a `Resource` (substrate) and post a short channel reference (coord). The substrate `CompositeContextProvider.send` enforces the length limit and writes through `channels.append`; the underlying store is owned by `CoordinationRuntime.channelStore`. This is the canonical seam between substrate Resource storage and coord-contributed channel content.

**Anti-loop on the bridge.** Messages tagged `telegram:*` (or any `<platform>:*`) are not redelivered to the originating adapter. The same pattern supports Slack / Webhook without a dedicated anti-loop per adapter.

**Lead-agent intake.** `lead-hooks.ts` + `priority-queue.ts` (the three-lane immediate / normal / background queue with bandwidth quotas and background promotion) live in this type. The lead orchestrator role is built on top of these: lead agents auto-join all channels at registration time and receive a fallback `normal`-priority entry when no addressed `@mention` matches.

**`harness.contextProvider` stays composite.** A deliberate scope decision in the ownership cut: provider's `channels` / `inbox` / `status` slots are sourced from coord's runtime when present. Substrate is type-agnostic in *ownership*; the provider is a routed view. Non-coord harnesses get `noopChannelStore` / `noopInboxStore` / `noopStatusStore` whose mutating methods reject so they can't silently route.

## Non-goals (type-local)

- Owning cross-Harness federation. Channels are Harness-local; cross-Harness coordination goes through a higher-layer routing harness type, not by extending channels across substrate boundaries.
- Owning task-tracking. Tasks are a separate harness type's projection (decision 005), not a coordination concern. The coordination type's Track lanes can reference tasks but does not own task lifecycle.
- Owning runtime-local agent state (memory / todos / notes). That belongs to a personal harness type if retained at all.
- Owning git-flavored Wake-scoped resources (worktrees). Worktree provisioning is substrate; the coding harness type owns the *use* of it for git work. The coordination type's Wake-scoped resources are messaging-shaped (subscribed channel windows, dedicated inboxes), not source-control-shaped.
