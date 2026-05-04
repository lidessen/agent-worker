# packages/workspace — Design

> The workspace kernel: named channels, per-agent inbox, prioritized instruction queue, kernel ledger (`Task → Attempt → Handoff → Artifact`), on-demand worktrees, and the MCP tool server that exposes all of this to agents. Passive — the orchestrator in `packages/agent-worker/` drives it.

See [../DESIGN.md](../DESIGN.md) for how the orchestrator consumes this package.

## Internal shape

```
┌───────────────────────── Workspace ─────────────────────────┐
│                                                              │
│   ChannelStore (append-only JSONL per channel)               │
│      ├─ emit("message")                                      │
│      ▼                                                       │
│   InboxStore (per-agent message references)                  │
│      ├─ selective ack / defer / peek                         │
│      ▼                                                       │
│   InstructionQueue (immediate / normal / background lanes)   │
│      ├─ bandwidth + starvation policy                        │
│      ▼                                                       │
│   (consumed externally by WorkspaceOrchestrator)             │
│                                                              │
│   StatusStore   TimelineStore   ResourceStore                │
│   ChronicleStore   DocumentStore   (all via CompositeContextProvider)
│                                                              │
│   WorkspaceStateStore                                        │
│     Task ─► Attempt ─► Handoff                               │
│                │                                             │
│                └─► Artifact(s)                               │
│                                                              │
│   ChannelBridge ──► adapters/ (Telegram, Webhook, …)         │
│                                                              │
│   WorkspaceMcpHub (per-agent HTTP MCP sessions)              │
└──────────────────────────────────────────────────────────────┘
        │                       │
        ▼                       ▼
  worktree.ts              workspace.assemblePrompt(sections, ctx)
  (git worktree add/       ─► renderPromptDocument(...)
   remove/list)
```

## Modules

**Top-level.**
- `workspace.ts` — the `Workspace` class: wires all stores, channel bridge, instruction queue, state store; registers agents; lifecycle `init / stop`.
- `factory.ts` — `createWorkspace()` builds shared infrastructure; `createAgentTools()` binds tools + prompt sections to an agent identity.
- `mcp-server.ts` — `WorkspaceMcpHub`: HTTP MCP server, per-agent session scoping, identity extraction, per-run tool rebinding with `activeAttemptId`.
- `worktree.ts` — thin wrapper over `git worktree add/remove/list`; callers provide branch names, while runtime allocates attempt-scoped paths under `workspace-data/<workspaceKey>/worktrees/<attemptId>/<name>`.
- `types.ts` — `Message`, `InboxEntry`, `Instruction`, `Priority`, `EventKind`, `TimelineEvent`, `Resource`, `Document`, `ChannelAdapter`, `WorkspaceConfig`.
- `utils.ts` — `nanoid`, `extractMentions`, `extractAddressedMentions`.

**`context/`** — stores + providers. `provider.ts` composes a `CompositeContextProvider` over independent stores; `storage.ts` abstracts `MemoryStorage` (tests) vs `FileStorage` (prod); `bridge.ts` routes channel events to external adapters with anti-loop guards. `stores/` has one file per store (channel, inbox, document, resource, status, timeline, chronicle). `mcp/` holds the tool implementations and prompt sections.

**`state/`** — kernel ledger. `types.ts` defines `Task / Attempt / Handoff / Artifact`; `store.ts` is the interface; `file-store.ts` is the on-disk implementation. The store itself is passive — mutations happen via MCP tools and orchestrator lifecycle calls.

**`loop/`** — dispatch primitives used by the orchestrator. `priority-queue.ts` implements the three-lane `InstructionQueue` with bandwidth quotas and background promotion. `prompt.tsx` defines composable `PromptSection` building blocks. `lead-hooks.ts` wires workspace-lead task management (chronicle append, handoff creation on specific events).

**`config/`** — YAML workspace loader. Parses the definition, interpolates templates (`${{ workspace.tag }}`), resolves model/connection specs, handles secrets.

**`adapters/`** — external-platform bridges. Today: Telegram. Each implements `ChannelAdapter`: subscribe to `ChannelBridge`, map inbound external messages to channel appends, push channel appends back to the platform with anti-loop tagging.

## Prompt assembly

`assemblePrompt(sections, ctx)` runs each `PromptSection` function, concatenates non-null JSX results, and renders via `renderPromptDocument`. Sections are independent and composable.

`BASE_SECTIONS`:
1. **soul** — agent identity and custom instructions from YAML.
2. **responseGuidelines** — communication rules, identity affirmation, `no_action` semantics.
3. **inbox** — pending inbox entries excluding the current message, grouped by channel with previews.

The orchestrator extends `BASE_SECTIONS` with workspace sections (state ledger, conversation context, docs, worktrees for the active attempt, chronicle). Per-agent sections stack on top.

## MCP tool surface

Tools are grouped; each group has a narrow purpose:

- `channel_*` — `send`, `read`, `list`, `join`, `leave` over named channels.
- `inbox_*` — `my_inbox`, `my_inbox_ack`, `my_inbox_defer`, `my_status_set`. Independent per-agent queue with selective ack.
- `task_*` — `create`, `update`, `list`, `dispatch`, `get`. Kernel `Task` CRUD + instruction dispatch into the queue.
- `attempt_*` + `worktree_*` — `attempt_list`, `attempt_get`, `worktree_create`, `worktree_remove`, `worktree_list`. `worktree_*` are only visible while an attempt is active.
- `handoff_*` + `artifact_*` — structured shift records and output references on the ledger.
- `resource_*` — content-addressed blob storage; used by `smartSend` to offload long messages.
- `team_*` — `members`, `doc_read / write / append / list / create`.
- `chronicle_*` — `append`, `read` on the immutable team decision log.
- `wait_inbox` — blocking wait primitive for lead agents.

## Kernel ledger semantics

- **Task** — a unit of work (`title`, `goal`, `status: draft → open → in_progress → completed | failed | aborted`, `ownerLeadId`, `activeAttemptId`, `artifacts`, `sourceRefs`).
- **Attempt** — one execution of a task by one agent (`status: running → completed | failed | cancelled | handed_off`, `worktrees[]`, `output`). Lifecycle-bound resources hang off here.
- **Handoff** — immutable shift record (`kind: progress | blocked | completed | aborted`, `fromAttemptId`, `toAttemptId?`, `summary`, `completed`, `pending`, `nextSteps`, `decisions`, `blockers`).
- **Artifact** — reference to a concrete output (`kind: file | commit | url | patch`, `ref`, `checksum`, `createdByAttemptId`).

Relations: `Task.activeAttemptId → Attempt`; `Attempt → Handoff` via `fromAttemptId`; any of them → `Artifact` via `createdByAttemptId`.

## Worktree lifecycle

Worktrees are created on-demand via the `worktree_create` tool inside a running attempt, not preallocated. The caller chooses the branch name; runtime owns collision-free path allocation under the attempt. On attempt terminal status (`completed | failed | cancelled | handed_off`), worktrees for that attempt are removed; **branches are left as audit trail.** Per-run tool rebinding in `WorkspaceMcpHub` attaches the `activeAttemptId`, which is why `worktree_*` tools appear iff an attempt is active.

## Instruction queue policy

Three lanes: `immediate | normal | background`.

- **Bandwidth:** 4 consecutive `immediate` dispatches force 1 `normal` if pending; 8 consecutive high-priority dispatches force 1 `background`. Prevents lane starvation.
- **Promotion:** `background` items promote to `normal` after a wait threshold or when their `preemptionCount` reaches the configured threshold. The current code does not yet increment `preemptionCount`, so wait-time promotion is the operative path.
- **Planned cooperative preemption:** `shouldYield()` is the intended scheduler signal for a future explicit checkpoint/yield tool. The queue can answer whether a higher-priority item is waiting, but current orchestration only preempts at run boundaries; it does not transparently interrupt or resume arbitrary in-flight LLM work.

## Multi-instance via tag

A workspace defined by one YAML can run multiple isolated instances (`--tag pr-123`, `--tag staging`). Tag isolates everything — channels, inbox, docs, resources, status, timeline, chronicle. Tag is available in templates as `${{ workspace.tag }}` and in factory as `tag` (drives `storageDir`, default `/tmp/agent-worker-<name>-<tag>/`).

## Key mechanisms

**Passive kernel.** Every component here either stores, indexes, or routes. The polling, error-handling, and dispatch live in `WorkspaceOrchestrator` over in `packages/agent-worker/`. This separation is intentional: orchestration can be swapped (e.g. a different dispatcher) without touching kernel invariants.

**Append-only everywhere.** Channels, chronicle, timeline, inbox — all JSONL append. Reads are tails + filters. This makes event replay and crash recovery trivial and keeps stores lock-free for the single-writer case.

**Inbox holds references, not content.** Channels own the message bodies; each agent's inbox holds `{ messageId, state }`. Selective ack means an agent can ignore a message without dropping the conversation; messages remain in the channel log.

**Composite provider pattern.** Stores are behind narrow interfaces (`ChannelStoreInterface`, `InboxStoreInterface`, …). `CompositeContextProvider` fans method calls to the right store. This is the seam that lets tests swap `MemoryStorage` for `FileStorage` without touching tool code. `smartSend` is the canonical cross-store orchestration: long messages create a `Resource` and post a short channel reference.

**WorkspaceMcpHub is the workspace tool boundary.** Workspace agents do not mutate kernel state by importing stores directly. They see tools through `WorkspaceMcpHub` or direct AI SDK tool injection built from the same tool factories. The hub scopes each session to an agent identity, exposes channel/inbox/task/resource/team/chronicle tools, and rebuilds attempt-scoped worktree tools only when an `activeAttemptId` exists. External debug clients use supervisor endpoints rather than impersonating normal agents.

**Anti-loop on the bridge.** Messages tagged `telegram:*` (or any `<platform>:*`) are not redelivered to the originating adapter. The same pattern supports Slack / Webhook without a dedicated anti-loop per adapter.

## Non-goals

- Polling the instruction queue (orchestrator's job).
- Running loops (orchestrator calls `loop.run` with an assembled prompt).
- Holding any standalone-agent state (`Agent`, memory, todos — those live in `packages/agent/`).
- Cross-workspace communication — channels are workspace-local.
- Transactional multi-store writes — eventual consistency via the event log is the contract.
