# MultiAgentCoordinationHarnessType — Design

> The harness type for multi-agent coordination work: channels and inboxes for cross-agent message passing, channel bridges to external platforms (Telegram first), team docs, and a lane vocabulary on top of the substrate Track / chronicle / timeline / status mechanisms. This is the type today's `Workspace`-the-class historically baked into the kernel; under [decision 006](../../decisions/006-harness-as-agent-environment.md) it is one peer `HarnessType` plugged into the universal `Harness` substrate, no longer privileged.

See [../harness.md](../harness.md) for the substrate this type plugs into.

## What the type contributes

- **Type-specific stores:** `ChannelStore`, `InboxStore`, `ChannelBridge`, plus the `adapters/` for external platforms (Telegram first; Slack / Webhook follow the same shape).
- **Track lane vocabulary:** `incident`, `feature thread`, `release lane`, `watch`, `migration`. Substrate provides the projection skeleton; this type names the lanes.
- **Chronicle / timeline / status entry schemas:** the coordination-flavored entry shapes — agent-to-agent message events, lead handoffs, channel decision logs, per-agent self-reported status. Substrate provides the projection mechanism; this type provides the entry vocabulary.
- **MCP tool groups (added on top of substrate tools):**
  - `channel_*` — `send`, `read`, `list`, `join`, `leave` over named channels. Channel messages are raw intake/audit; semantic state changes require extraction or reducer promotion into HarnessEvents.
  - `inbox_*` — migration/notification evidence tools (`my_inbox`, `my_inbox_ack`, `my_inbox_defer`, `my_status_set`) for legacy per-agent queues. Not a target long-term context lane; target dispatch reads HarnessEvents/invocations and context packets.
  - `team_*` — `members`, `doc_read / write / append / list / create`. Team doc surfaces are coordination-flavored.
  - `wait_inbox` — legacy blocking wait primitive for lead agents. Target orchestration should wait on tasks, invocations, HarnessEvents, or harness-defined completion conditions instead.
- **Capability invocations:** coordination-specific protected effects — channel sends to external platforms via the bridge, lead-handoff dispatch, team doc writes.
- **Hook implementations (`HarnessType` interface):**
  - `produceExtension(wake, events, workLog)` — captures coordination-flavored Wake-close state: outstanding inbox refs, pending channel reads, in-flight team-doc edits.
  - `consumeExtension(extension, packet)` — injects the coordination extension's content into the next Wake's `ContextPacket`.
- **Context packet sections:** coordination-flavored sections (relevant channel windows, inbox summary, team-doc references) layered on top of substrate-provided sections (events, resources, Track, prior Handoff core).
- **Config schema:** YAML coordination definition — channels list with adapters, channel bridge config, telegram credentials, lead-agent designation. The substrate config covers identity / tag / storage / chosen `harnessTypeId`; this type's loader fills in the rest.

## Key mechanisms (type-local)

**Inbox holds references, not content.** Channels own message bodies; each agent's inbox holds `{ messageId, state }`. Selective ack means an agent can ignore a message without dropping the conversation; messages remain in the channel log.

**`smartSend` cross-store orchestration.** Long messages create a `Resource` (substrate) and post a short channel reference (this type). This is the canonical seam between substrate Resource storage and type-contributed channel content.

**Anti-loop on the bridge.** Messages tagged `telegram:*` (or any `<platform>:*`) are not redelivered to the originating adapter. The same pattern supports Slack / Webhook without a dedicated anti-loop per adapter.

**Lead-agent intake migration.** `loop/lead-hooks.ts` + `loop/priority-queue.ts` (the three-lane immediate / normal / background queue with bandwidth quotas and background promotion) are migration-era scaffolding from when lead-agent intake lived inside the substrate. These move into the coordination type with the rest of channels-and-inbox; they remain transitional until reducers and extractors fully replace chronicle-driven lead updates.

## Non-goals (type-local)

- Owning cross-Harness federation. Channels are Harness-local; cross-Harness coordination goes through a higher-layer routing harness type, not by extending channels across substrate boundaries.
- Owning task-tracking. Tasks are a separate harness type's projection (decision 005), not a coordination concern. The coordination type's Track lanes can reference tasks but does not own task lifecycle.
- Owning runtime-local agent state (memory / todos / notes). That belongs to a personal harness type if retained at all.
- Owning git-flavored Wake-scoped resources (worktrees). Worktree provisioning is substrate; the coding harness type owns the *use* of it for git work. The coordination type's Wake-scoped resources are messaging-shaped (subscribed channel windows, dedicated inboxes), not source-control-shaped.
