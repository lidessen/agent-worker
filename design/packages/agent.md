# packages/agent — Design

> Standalone agent runtime: a long-lived messaging recipient that turns an inbox + todos + notes + memory into loop runs. Workspace mode does not use this package.

See [../DESIGN.md](../DESIGN.md) for how this package fits the two-path daemon.

## Internal shape

```
                 push(msg)                      tool calls
 external ─────────────► Inbox ─┐        ┌────────────► TodoManager
                                │        │              NotesStorage
                                ▼        │              MemoryManager
                       RunCoordinator ───┤              ReminderManager
                       shouldContinue    │              InboxReader / Send
                             │           │                   ▲
                             ▼           │                   │
                       ContextEngine ────┘                   │
                       .assemble ─► AssembledPrompt          │
                             │                               │
                             ▼                               │
                       loop.run({system, prompt}) ──► LoopEvent stream
                             │                               │
                             ├─ hook stream ─► context-pressure / checkpoint
                             └─ post-run: Turns, memory extraction, state refresh
```

## Modules

**`agent.ts`** — `Agent` lifecycle + state machine. _Does:_ ctor wires subsystems, `init` / `stop` / `push`, state getters, event emitter (`send`, `messageReceived`, `idle`, `processing`, `error`), debounced wake, classifies context-pressure and dispatches hooks. _Doesn't:_ make loop decisions (that's RunCoordinator) or assemble prompts.

**`run-coordinator.ts`** — The processing loop. _Does:_ `shouldContinue` priority (unread inbox → pending todos → pending reminders → idle), `executeRun` (assemble prompt → `loop.run` → stream events → append Turn → memory checkpoint). _Doesn't:_ know about the inbox format or the memory backend.

**`context-engine.ts`** — Prompt builder. _Does:_ compose `[ROLE] [AWARENESS] [INBOX] [TODOS] [REMINDERS] [NOTES] [MEMORY]` (in that order), allocate memory token budget (default ~20% of remainder), derive `currentFocus` from `shouldContinue`. _Doesn't:_ mutate state; pure read.

**`inbox.ts`** — Message queue. _Does:_ push / peek preview / mark read / list unread, 200ms debounce wake, fire reminder rules on arrival. _Doesn't:_ persist (storage is external JSONL via ManagedAgent).

**`todo.ts`** — Working memory list. _Does:_ add / complete / clear / list; prompt format. _Doesn't:_ schedule or persist.

**`memory.ts` + `storage/file-memory.ts`** — Long-term recall. _Does:_ schedule extractions on `checkpoint | event | idle`, de-dup by hash, keyword recall, inject into `[MEMORY]`; JSON-per-entry file persistence. _Doesn't:_ embed or semantic-search.

**`notes.ts` + `storage/file-notes.ts`** — Key-value scratch. _Does:_ get / set / list keyed markdown files, path sanitization. _Doesn't:_ version or index.

**`reminder.ts`** — Timeout watchdogs. _Does:_ register pending async notifications with optional deadlines; keeps state out of `idle` while waiting. _Doesn't:_ fire actions itself — surfaces via `shouldContinue`.

**`send.ts`** — Outbound guard. _Does:_ check for new inbound messages before emitting `send`, so a reply isn't sent into stale context.

**`tool-registry.ts`** — Built-in tools source of truth. _Does:_ define `agent_inbox` / `agent_send` / `agent_todo` / `agent_notes` / `agent_reminder` / `agent_memory` schemas + handler factory. _Doesn't:_ transport them.

**`toolkit.ts`** — AI SDK merger. _Does:_ combine built-in + user tools, validate no collision with reserved `agent_` prefix.

**`bridge/`** — Capability-routed tool transport. _Does:_ `wiring.ts` detects loop `supports` flags and picks a path: direct AI SDK tools, `prepareStep` hook, runtime hooks, or HTTP MCP server (`mcp-server.ts` + `tool-adapter.ts`); `claude-sdk-mcp.ts` builds native MCP server specs for Claude Code SDK; `claude-default-hooks.ts` registers inbox-peek and todo-change hooks. _Doesn't:_ know which loop it's wiring beyond the capability flags.

**`workspace-client.ts`** — MCP HTTP client for talking to a workspace's tools. Only used when a standalone agent chooses to consume workspace tools (optional; most standalone agents don't).

## State machine

```
        push()          debounce        no unread, no todos, no reminders
 idle ─────────► waiting ──────► processing ───────────────────────────► idle
                                    ↑ │
                                    │ ▼ (recoverable)
                                    └─ error ──stop()──► stopped
```

Five states. `error` is resumable; `stopped` is terminal. Debounce buffers bursts of arrivals into one run.

## Two wiring paths (direct vs MCP bridge)

The bridge picks the tool transport once at `init()`:

- **Direct** (AI SDK loop with `supports: directTools`) — built-in tool handlers called in-process; state mutations visible immediately.
- **MCP bridge** (CLI loops: Claude Code, Codex, Cursor) — boot a local MCP server, pass its address via `setMcpConfig` / `setMcpServers`; tool calls arrive over the transport and mutate the same in-process state managers.

Both paths share the same `TodoManager` / `MemoryManager` / `Inbox` / `NotesStorage` instances. Only the transport differs. Prompt carries state **in** (assembled snapshot); tools carry state **out** (mutations during the run).

## Lifecycle hooks

- **`onContextPressure(ctx)`** — fires once per threshold crossing (soft ~70%, hard ~90%, absolute limit). Returns `"continue" | "end" | "compact"`. `compact` flushes history, seeds the next run with a summary, and auto-restarts.
- **`onCheckpoint(ctx)`** — reserved for run-boundary extensions (currently wired for memory checkpoints; broader use staged).

Runtime-specific token accounting comes from `LoopCapability` on the loop, not from the agent.

## Key mechanisms

**Messaging, not request/response.** No promise per `push`; the LLM may choose to respond, note, or ignore. `Inbox.peek` always shows unread count so the LLM can triage before reading full messages.

**State in prompt, state out via tools.** Every run re-assembles a fresh prompt from current state — no hidden deltas. All mutations route through the tool layer (direct or MCP), so history is reconstructible from the event stream alone.

**Memory is extract-on-stream.** Memory checkpoints are scheduled from loop events (text / thinking / tool complete) via a 250ms batching timer, chained on a promise to avoid concurrent writes. Recall is keyword-search over JSON files, budget-capped.

## Non-goals

- Participating in channels or multi-agent coordination (that's `packages/workspace/`).
- Semantic / embedding memory.
- Cross-agent persistent state — each `Agent` instance owns its own subsystems.
- Guaranteed message processing — the LLM decides what to handle.
