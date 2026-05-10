# Single-Agent Chat HarnessType

**Status:** proposed
**Date:** 2026-05-10

## Context

`goals/GOAL.md` declares the system handles "any kind of requirement
(coding, writing, decision-making, …)". The cheapest, most universal
form of that — *one user, one capable model, one conversation thread,
with tools* — is exactly the Claude Code / Codex day-to-day
experience. Today the system has no first-class shape for it.

What exists is the agent-chat page in the web UI: a 1:1-looking view
that secretly routes through coord-flavored infrastructure (channels,
inbox, priority queue, telegram bridge, on-demand mention rules,
multi-agent prompt sections). The result is friction:

- Sending a "private" message actually publishes a DM into `#general`
  visible to every other agent in the channel.
- The user's `_global.yml` agents are role-specialized for multi-agent
  collaboration (史官 / 中书 / 工部 / 礼部 …); none are
  prompt-configured to behave as a generic single-agent chat partner.
- "Why didn't the agent reply?" is opaque — `no_action` selections
  appear as silence; pending-vs-seen inbox state is hidden.
- Coord overhead (channel routing, queue priority computation,
  on-demand-mention indexing, inbox loading) runs on every turn even
  though no other agent is involved.

Decision 006 made the substrate type-agnostic and gave the system a
`HarnessType` protocol slot precisely so additional types can land
as peers. The coord type was the first concrete plug-in. A
single-agent chat type is the second, and is structurally what GOAL's
"any kind of requirement" needs as the *baseline* productive form.

## Recommendation

Add a new `HarnessType` `single-agent-chat`, lives in a new peer
package `internals/harness-chat/` (`@agent-worker/harness-chat`).
Its runtime owns one agent and one conversation thread; no channels,
no inbox, no priority queue, no bridge, no on-demand mention index.
A chat turn is a one-shot dispatch — the agent loop runs once per
user message and streams a response — not a polling orchestrator.

A coord-typed harness and a chat-typed harness coexist as siblings in
the registry. The web UI dispatches on `harness.harnessTypeId` and
renders a chat-shaped view (conversation transcript, message input,
streaming reply, no channel sidebar) when the type is
`single-agent-chat`. Coord harnesses keep their channel-shaped view.

The substrate's `HarnessType` protocol absorbs all the type-flavored
behavior; nothing new in substrate beyond the protocol slots already
landed.

## Substrate criterion (per decision 006)

A piece is substrate iff every imaginable HarnessType wants it.
Applying the criterion to the chat type's needs:

- **Substrate (already in place, used by both types):** storage
  backend, document/resource/timeline/chronicle stores, kernel
  state store (Task / Wake / Handoff), worktree provisioning,
  sandbox path layout, `ContextProvider` shape, MCP hub, capability
  boundary, event log.
- **Coord-only (existing):** channels, inbox, status, bridge,
  instruction queue, agent roster, lead designation, defaultChannel,
  channel-to-inbox routing, telegram adapter, channel/inbox/team
  MCP tools.
- **Chat-only (new):** conversation thread, idle/thinking state
  machine, single-agent dispatch, optional streaming surface.

The chat type does **not** import or reuse any coord runtime piece.
Cross-type boundary stays clean.

## ChatRuntime shape

```ts
class ChatRuntime {
  readonly agentName: string;          // single agent's name
  readonly runtime: string;            // claude-code | codex | cursor | ai-sdk | mock
  readonly model?: ResolvedModel;      // resolved model spec
  readonly instructions?: string;      // agent's system prompt

  // Conversation thread, persisted via storage backend.
  // Each turn: { id, role: "user" | "assistant", content, ts, runId? }.
  readonly conversation: ConversationStore;

  // Simple state machine; no priority queue, no backoff, no quota.
  state: "idle" | "thinking";

  // Lifecycle
  load(): Promise<void>;        // restore conversation from disk
  shutdown(): Promise<void>;    // flush
}
```

`ConversationStore` is a substrate-style append-only JSONL writer
keyed on the harness storage dir; nothing fancy.

## HarnessType wiring

```ts
export const singleAgentChatHarnessType: HarnessType<unknown, ChatRuntime> = {
  id: "single-agent-chat",
  label: "single-agent chat",

  contributeRuntime({ harness, config }) {
    return new ChatRuntime({
      agentName: config.agent?.name ?? "assistant",
      runtime: config.agent?.runtime,
      model: config.agent?.model,
      instructions: config.agent?.instructions,
      storage: harness.storage,
    });
  },

  async onInit({ runtime }) {
    if (runtime) await runtime.load();
  },

  async onShutdown({ runtime }) {
    if (runtime) await runtime.shutdown();
  },

  contributeMcpTools({ harness, agentName }) {
    // Chat agents get the substrate's universal tool slice
    // (resource_*, chronicle_*, task_*/wake_*/handoff_*, worktree_*)
    // automatically via factory.buildAgentToolSet's substrate path.
    // The chat type adds nothing of its own at the MCP layer for
    // slice 1 — `claude-code` / `codex` / `cursor` runtimes bring
    // their own built-in tool surface; AI-SDK runtimes wrap the
    // substrate tools.
    return [];
  },

  snapshotExtension({ runtime }) {
    if (!runtime) return undefined;
    return {
      agentName: runtime.agentName,
      state: runtime.state,
      turnCount: runtime.conversation.size,
    };
  },
};
```

Note that `produceExtension` / `consumeExtension` (handoff hooks)
remain absent — there's nothing cross-Wake to carry, since chat is
a single conversation that doesn't hand off.

## Dispatch model (no orchestrator)

A chat turn is straightforward:

```ts
async function chatTurn(harness: Harness, userText: string): Promise<AsyncIterable<TextChunk>> {
  const runtime = chatRuntime(harness);
  if (runtime.state !== "idle") throw new Error("agent is busy");
  runtime.state = "thinking";
  try {
    runtime.conversation.append({ role: "user", content: userText });
    const loop = await createAgentLoop(runtime.runtime, runtime.model);
    const promptSections = buildChatPromptSections(runtime); // includes history
    const stream = loop.run(buildPrompt(promptSections, userText));
    // Stream chunks to caller; collect into final assistant content.
    const final = yield* stream;
    runtime.conversation.append({ role: "assistant", content: final });
  } finally {
    runtime.state = "idle";
  }
}
```

No polling, no backoff, no quota; the orchestrator's complexity
budget was earned by multi-agent coordination, not chat. If a chat
turn fails the failure surfaces immediately to the caller — error
handling is request-scoped, not loop-scoped.

## Daemon HTTP surface

Same URL space as coord harnesses; new endpoints layered on:

- `POST /harnesses/:key/turn` — body `{content: string}`. Returns
  `{turnId, content}` after the agent finishes (non-streaming).
- `POST /harnesses/:key/turn/stream` — same input; returns SSE with
  `{kind: "chunk", text}` followed by `{kind: "done", turnId}`.
- `GET /harnesses/:key/conversation?since=cursor` — paginated history.

These are gated to chat-typed harnesses; coord harnesses respond 405
(method not allowed). Coord's `/send` likewise is rejected for chat
harnesses. The substrate Harness's `/status`, `/events`, `/docs`
remain available to both types because they're substrate-level.

## YAML config schema

```yaml
# Chat harness
name: my-claude-chat
harnessTypeId: single-agent-chat
agent:
  runtime: claude-code
  model: opus
  instructions: |
    You are my coding assistant. ...
storage: file
```

vs the existing coord schema (unchanged):

```yaml
name: my-team
# harnessTypeId defaults to multi-agent-coordination
channels: [...]
agents: { maintainer: { ... }, codex: { ... } }
```

`harnessTypeId` is the type discriminator. `factory.createHarness` —
which today defaults `harnessTypeId` to coord — keeps that default
(unchanged behavior for everyone not opting in to chat) and accepts
the chat type explicitly when set.

## Web UI shape

Sidebar list of harnesses adds a small icon discriminator: a "team"
glyph for coord harnesses, a "chat" glyph for chat harnesses. The
existing harness page `#/harnesses/:key` reads the harness's
`harnessTypeId` and renders one of two views:

- **Coord view (existing):** channel sidebar, member list, message
  list, channel input.
- **Chat view (new):** conversation transcript with role-tagged
  bubbles, single message input at the bottom, streaming "thinking"
  indicator that disappears when the response settles, no channel
  sidebar.

Creating a chat harness goes through the existing "New harness"
dialog, with a "Type" dropdown (`team` / `chat`) gating the
field set shown.

## Persistence

Conversation history lands in `<dataDir>/harness-data/<key>/conversation.jsonl`
(append-only JSONL, one turn per line). Loading on `onInit`
replays the file in O(file-size) — fine for tens of thousands of
turns. No paging or trimming for slice 1; long conversations are a
later concern.

## Integration with the Monitor (decision 004)

- **C1:** `activeAgents` increments while a chat is `thinking`;
  `activeRequirements` increments when a chat has a turn pending
  (i.e. user message arrived and chat is `idle` for an instant
  before flipping to `thinking`).
- **C2 binding inventory:** chat harness contributes one binding
  (the agent), classified by runtime+provider exactly like coord
  bindings.
- **C3 interventions:** `harness.completed` doesn't apply (chats
  don't "complete"); a chat-turn failure can map to a `rescue`
  intervention.
- **C4 silence:** chat being `idle` with no pending turn is "no
  unfinished requirement", same as coord idle.

No monitor changes needed for slice 1 — the existing event /
sample plumbing covers chat shape because chat harnesses are
HarnessType peers and `iterManaged()` already yields them.

## Alternatives seriously considered

- **Stay with coord, add a chat preset.** Cheapest path: a YAML
  preset `chat-default.yml` that registers a single agent, no
  channels, configured to always reply. Web UI tweaks the
  agent-chat page. Rejected: the underlying routing still goes
  through inbox / priority queue / mention indexing, the user's
  "private" message is still posted to a channel, and every coord
  prompt section the agent receives includes inbox / channel
  references that don't apply. The UX symptom is fixed, the
  structural mismatch is not.
- **Make chat a sub-mode of coord.** A bool on coord runtime
  ("simpleMode = no channels, one agent"). Rejected: violates the
  HarnessType protocol's purpose (each type is its own contributor)
  and propagates branching `if (simpleMode)` through coord's code
  paths. Decision 006's whole point was that types are peers, not
  flags on a privileged kernel.
- **Reuse the orchestrator with single-agent config.** Coord
  orchestrator polls inbox at 2s; for a chat that's a 0–2s
  perceived latency on every message. Rejected: the orchestrator's
  shape (poll, queue, pause, resume, backoff) is appropriate for
  multi-agent dispatch and excessive for direct-response chat. A
  one-shot dispatcher is simpler and lower-latency.

## Implementation plan

Three slices, each independently verifiable:

1. **`internals/harness-chat/` skeleton + ChatRuntime + type
   wiring.** New peer package. `ChatRuntime` class
   (conversation store, simple state machine, lifecycle).
   `singleAgentChatHarnessType` exposing
   `contributeRuntime`, `onInit`, `onShutdown`,
   `snapshotExtension`. `chatRuntime(harness)` typed accessor.
   `factory.createHarness` learns to register both the coord type
   and the chat type. No HTTP, no UI yet. Verifiable by:
   construct a chat harness via `new Harness(...)`, append turns
   to its conversation, restart, reload — turns persist.
2. **Chat dispatcher + daemon HTTP routes.** `chatTurn(harness,
   text, opts)` runs the agent loop once and returns a response
   (non-streaming first; streaming variant follows). Daemon adds
   `POST /harnesses/:key/turn` for chat-typed harnesses, gated by
   type id; coord harnesses 405 on the route, chat harnesses 405
   on `/send`. Verifiable by: create a chat harness via
   `POST /harnesses`, call `/turn` with a user message, get a
   response back from the configured runtime.
3. **Web UI chat-harness page.** Sidebar discriminates chat vs team
   by `harnessTypeId`. Harness page renders chat view (transcript +
   input + thinking indicator) for chat-typed harnesses, channel
   view (existing) for coord. New-harness dialog gains a Type
   dropdown. Verifiable by: create a chat harness via the dialog,
   click into it, send a message, watch the streamed reply appear
   in the transcript.

After slice 3, single-agent chat is a first-class shape coexisting
with coord. The agent-chat page (which today routes through coord)
can be deprecated in a follow-up.

## Non-goals

- Migrating existing coord-shaped agent-chat usage. The current
  `/agents/:name/send` path stays; users adopt chat harnesses for
  new chat use cases. A separate decision can deprecate the legacy
  path once chat is mature.
- Multi-turn parallelism (chat with N concurrent threads). One
  conversation per chat harness; create a new chat harness for a
  separate thread.
- Cross-harness conversation continuity. Each chat is local.
- Tool-permission UX redesign. Existing per-runtime tool approval
  paths apply; chat harness inherits them.
- C2 fallback config schema. Independent track; a chat harness
  binding is classified by the same rules as a coord binding.

## References

- `006-harness-as-agent-environment.md` — the HarnessType protocol
  and substrate ↔ type cut this depends on.
- `005-session-orchestration-model.md` — Task / Wake / Handoff
  primitives. Chat doesn't use them in slice 1; a future
  enhancement could persist conversations as a Task with each
  turn as a Wake, but is unnecessary for the chat shape.
- `goals/GOAL.md` — "any kind of requirement". Chat is the
  baseline single-requirement productive form.
