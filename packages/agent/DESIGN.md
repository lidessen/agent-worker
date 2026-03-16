# @agent-worker/agent — Design

## What this package does

Agent is an always-on asynchronous message recipient built on top of `@agent-worker/loop`. It receives messages, maintains conversation context across multiple loop runs, and provides the LLM with tools (todo, notes, memory) and external MCP connections.

The agent model is **messaging**, not request/response. Messages are delivered to the agent, the agent may read them, respond, take notes, or ignore them — like a person in a group chat. There is no guarantee that every message gets explicitly handled or that tasks reach completion. The agent stays responsive to new input at all times.

Loop handles a single prompt → response cycle. Agent handles the continuous loop of receiving, thinking, and acting.

## Architecture

```
              push()              debounce
Message ──────────→ Inbox ──────────────────→ wake agent
                      │
                      ├── unread messages (with peek preview)
                      └── read/archived messages

Agent (processing)
  │
  ├── assemble prompt (context engine)
  │     ├── system instructions
  │     ├── inbox peek (unread count + short previews)
  │     ├── memory (auto-injected)
  │     ├── notes (key list)
  │     ├── conversation history (rolling)
  │     ├── todo state (working memory)
  │     └── current focus (derived from shouldContinue)
  │
  ├── loop.run(prompt)
  │     ├── AI SDK path: tools injected directly
  │     └── CLI path: tools via agent MCP server
  │     LLM can call:
  │       inbox.read(id)  — read full message
  │       inbox.peek()    — refresh inbox summary
  │       send(target, content) — send message (with guard)
  │
  ├── after run: update context
  │     ├── append turns
  │     ├── read todo/notes/inbox state
  │     └── extract memory (optional)
  │
  ├── shouldContinue?
  │     ├── unread messages    → process next (always preempts)
  │     ├── todos pending      → continue working
  │     └── both empty         → idle
  │
  └── (loop back to assemble prompt)
```

## State machine

```
         push()       debounce         no unread + no pending todos
idle ───────────→ waiting ──────→ processing ──────────────────────→ idle
                                    ↑    │
                                    │    ↓ (recoverable error)
                                    └─ error
                                         │
                                         └─→ stop() → stopped
```

Five states:

- **idle** — nothing to do, waiting for messages
- **waiting** — messages arrived, debounce timer running (collecting more messages)
- **processing** — consuming messages and/or completing todos
- **error** — last run failed, can resume() or stop()
- **stopped** — explicitly shut down, terminal

## Two paths: AI SDK vs CLI

The fundamental tension: some loops (AI SDK) let us control tools and prompts directly. Others (CLI-based: Claude Code, Codex, Cursor) manage their own tools — we can't inject TS functions. The agent detects this via capability checking on the `AgentLoop` interface, not by type-checking concrete classes.

**Solution: a single agent MCP server** that exposes todo, notes, and memory as MCP tools. CLI loops connect to this server. AI SDK loops can use direct tool injection (faster, no IPC) or the same MCP server (for consistency).

```
AI SDK path (direct):
  Agent ──→ inject tools (todo, notes, memory) as AI SDK tools
       ──→ loop.run(prompt)
       ←── observe tool results directly (in-process)

CLI path (MCP bridge):
  Agent ──→ start agent MCP server (stdio or SSE)
       ──→ loop.run(prompt, { mcpServers: [agentMcp] })
       ←── MCP server updates shared state as LLM calls tools
       ←── read state after run completes
```

Both paths use the **same state manager**. The difference is transport:

- AI SDK: tool functions call state manager in-process
- CLI: MCP server receives tool calls, forwards to state manager

### Prompt carries state IN, tools carry state OUT

Before each run, the agent assembles a prompt that includes current state (memory, notes, todos, conversation). This is the "read" path — the LLM sees current state in the prompt.

During a run, the LLM can modify state via tools (add todos, write notes). This is the "write" path — state changes flow back through tool calls.

After each run, the agent reads the updated state and reassembles the prompt for the next run.

## Agent MCP server

A lightweight MCP server that the agent owns and controls. Exposes all built-in tool namespaces:

```
agent MCP server
  ├── agent_inbox    — peek, read, wait
  ├── agent_send     — send (with guard)
  ├── agent_todo     — add, complete, list
  ├── agent_notes    — write, read, list, delete
  └── agent_memory   — search (read-only for LLM)
```

Lifecycle:

1. Agent creates the MCP server at `init()` time
2. For CLI loops: server URL/transport is passed as an MCP connection
3. For AI SDK loops: server is optional — direct tools are used by default
4. Server stops at `agent.stop()`

The MCP server holds a reference to the agent's state manager. When the LLM calls a tool via MCP, the server updates the state manager synchronously and returns the result. The agent reads the updated state after the run.

## Inbox

The inbox replaces the simple queue from earlier designs. Messages have `unread`/`read` status. "Read" means the message content has been delivered into the agent's context, not that it has been acted on or handled.

```ts
interface InboxMessage {
  id: string;
  content: string;
  from?: string; // sender identifier (user, agent name, system)
  timestamp: number;
  status: "unread" | "read";
}
```

### Peek: smart preview in prompt

At every checkpoint, the context engine injects an inbox peek. The peek is designed to be token-efficient:

- **Short messages** (< `peekThreshold`, default 200 chars): full content included, auto-marked `read` (delivered in full)
- **Long messages**: first `peekThreshold` chars + `...` + message ID. Stays `unread` until LLM calls `inbox.read(id)` to get full content

Example prompt injection:

```
📥 Inbox (3 unread):
• [msg_1] from:user — "Fix the login bug" ✓
• [msg_2] from:user — "Also the signup page has issues with validat..." (truncated, inbox.read("msg_2") for full)
• [msg_3] from:scheduler — "Deploy reminder: staging is 2 commits behind" ✓
```

Short messages (msg_1, msg_3) are delivered in full — auto-marked `read`. Long messages (msg_2) are only previewed; the LLM must call `inbox.read()` to get the full content.

"Read" = the message content was delivered to the agent's context. It does **not** mean the agent has acted on, acknowledged, or responded to it. The agent may choose to act on it, ignore it, or come back to it later.

### Debounce: batch incoming messages

When the agent is **idle** and messages arrive via `push()`, we don't wake immediately. Instead:

```
push(msg1) → start debounce timer (default: 200ms)
push(msg2) → reset timer
push(msg3) → reset timer
             ... timer fires → wake agent
             agent sees all 3 messages in inbox peek
```

This prevents the agent from starting work after seeing only the first message of a burst. If a user sends 3 rapid messages, the agent sees all 3 before deciding what to do.

When the agent is **already processing**, new messages just land in the inbox. The agent sees them at the next checkpoint (peek is refreshed). No debounce needed — the agent is already running.

```ts
interface InboxConfig {
  /** Debounce delay for wake-up. Default: 200ms */
  debounceMs?: number;
  /** Messages shorter than this are auto-read in peek. Default: 200 chars */
  peekThreshold?: number;
}
```

## Built-in tools

### Inbox (tool)

The LLM interacts with the inbox via tools:

| action | params       | effect                                                                                    |
| ------ | ------------ | ----------------------------------------------------------------------------------------- |
| `peek` | —            | Return inbox summary (same format as prompt injection, refreshed)                         |
| `read` | `id`         | Read full content of a message, mark as `read`                                            |
| `wait` | `timeoutMs?` | Register a non-blocking reminder — notified when a new message arrives or timeout expires |

Peek is also auto-injected into the prompt at each checkpoint, so the LLM doesn't need to call `peek` explicitly unless it wants to check for new messages mid-run.

#### Wait: async reminder pattern

`inbox.wait(timeoutMs?)` is **non-blocking**. It registers a reminder via `ReminderManager` and returns immediately. The LLM can continue working on other tasks. When a new message arrives (or timeout expires), the reminder fires:

- **Message arrives**: `inbox.push()` fires all `inbox_wait` reminders. The message is already visible via peek — no extra notification needed.
- **Timeout expires**: A system notification is pushed into the inbox (`⏰ Reminder timed out: ...`), waking the agent if idle.

While reminders are pending, the processing loop waits instead of going idle — this prevents the agent from shutting down prematurely.

```
LLM calls send("user", "Which database do you prefer: Postgres or SQLite?")
LLM calls inbox.wait(60000)
  → Returns immediately: { status: "reminder_set", reminderId: "reminder_1" }
  → LLM continues with other work (or has nothing to do — loop waits)
  → User pushes: "Postgres" → enters inbox as unread, fires the reminder
  → Processing loop resumes, LLM sees the message via peek
LLM continues working
```

```ts
interface ReminderResult {
  id: string;
  label: string;
  reason: "completed" | "timeout";
  message?: string;
}
```

This is built on the general-purpose `ReminderManager` — see the `agent_reminder` tool for arbitrary async reminders (scheduled checks, background task completion, etc.).

### Send

The LLM can send messages outward at any time. Where messages go is the caller's responsibility — the agent emits a `"send"` event with target and content.

| action | params                        | effect                      |
| ------ | ----------------------------- | --------------------------- |
| `send` | `target`, `content`, `force?` | Send a message (with guard) |

#### Send guard: check for new messages before sending

When the LLM calls `send()`, the agent checks if new unread messages arrived since the last peek/read:

```
LLM calls send("user", "Here's my analysis...")
  → Agent checks: any new unread since last peek?
  → YES (first attempt):
      Return: "⚠ 2 new unread messages arrived. Call inbox.peek() to review,
               or call send() again with force=true to send anyway."
  → NO, or force=true:
      Send goes through. Agent emits "send" event.
```

The guard only triggers **once per send attempt** per new-message batch. If the LLM calls `send()` again with the same content (or with `force=true`), it goes through. This avoids infinite loops while giving the LLM a chance to notice incoming messages.

Why: without this guard, the agent might send a response based on stale context while the user has already sent a follow-up or correction.

### Todo

The agent's **temporary working memory** — a scratchpad of what it's currently trying to do. Not tied to any specific message. Not a task queue, not a ticket system.

Todos are how the agent tracks its own train of thought across multiple runs. The agent might add todos after reading a message, complete some, abandon others when a new message changes priorities, or rewrite the whole list. They're disposable and expected to be messy.

```ts
interface TodoItem {
  id: string;
  text: string;
  status: "pending" | "done";
}
```

| action     | params | effect                                   |
| ---------- | ------ | ---------------------------------------- |
| `add`      | `text` | Add a new pending item                   |
| `complete` | `id`   | Mark item as done                        |
| `clear`    | —      | Discard all todos (reset working memory) |
| `list`     | —      | Return current state                     |

Lifecycle:

- Persists across runs — not scoped to a single message
- New messages may cause the agent to rewrite or clear todos entirely
- When `maxRuns` is hit, remaining todos are abandoned (agent goes idle or processes next message)
- Pending todos drive the continue condition, but messages always preempt them

### Notes

Persistent key-value store. LLM-controlled — it decides what to save and when to read back.

```ts
interface NotesStorage {
  read(key: string): Promise<string | null>;
  write(key: string, content: string): Promise<void>;
  list(): Promise<string[]>;
  delete(key: string): Promise<void>;
}
```

Default implementation: file-based (`{notesDir}/{key}.md`). User can provide a custom `NotesStorage` for database, API, or any other backend.

| action   | params           | effect               |
| -------- | ---------------- | -------------------- |
| `write`  | `key`, `content` | Persist a note       |
| `read`   | `key`            | Retrieve a note      |
| `list`   | —                | Return all note keys |
| `delete` | `key`            | Remove a note        |

Notes persist across messages, across agent restarts. Simple CRUD — no relevance scoring, no automatic selection. The LLM reads what it needs.

### Memory (optional, auto-managed)

Automatic working memory that the agent extracts and injects without explicit LLM action. **Memory is optional** — disabled by default, enabled when `memory` config is provided.

```ts
interface MemoryEntry {
  id: string;
  text: string;
  source: string; // which message/run produced this
  timestamp: number;
}

interface MemoryStorage {
  add(entry: Omit<MemoryEntry, "id">): Promise<string>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  list(limit?: number): Promise<MemoryEntry[]>;
  remove(id: string): Promise<void>;
}
```

Default implementation: file-based (single JSON file, keyword-match search). User can provide a custom `MemoryStorage` for vector search, database, etc.

**Extraction via completion API** — at each checkpoint (by default), the agent extracts memories using a completion/prefix-completion call. This is cheap and fast compared to a full chat round-trip:

```
// Prefix (conversation context) → completion (extracted memories)
[conversation turns as prefix]
---
Key facts and decisions from this conversation:
1.                                    ← model completes from here
```

Compatible with any completion API — DeepSeek prefix completion, OpenAI completions, Anthropic, etc. The extraction model is configurable separately from the main agent model (use a cheap/fast model).

Extraction strategies:

- **"completion"** (default when enabled): prefix-completion call to extract memories
- **"custom"**: user provides `extractMemories(turns: Turn[]) => Promise<string[]>`

**By default, memory runs at every checkpoint** (configurable via `extractAt`). Both extraction and recall happen as part of context reassembly. Since we use a cheap completion API, this is feasible:

```
Checkpoint (before each run / before each step):
  1. Extract: feed recent turns to completion model → new memory entries
  2. Recall: keyword-match current focus against memory store → relevant entries
  3. Inject recalled memories into assembled prompt
```

This is closer to how memory actually works — continuous encoding and association, not batch processing at the end. The agent is constantly:

- **Encoding**: "this seems important, remember it" (extract from recent context)
- **Associating**: "this reminds me of..." (recall by relevance to current focus)

The completion call is lightweight (small model, short prefix). If it's still too expensive for some use cases, extraction frequency is configurable:

```ts
interface MemoryConfig {
  /** When to extract. Default: "checkpoint" */
  extractAt?: "checkpoint" | "idle" | "never";
  // ...
}
```

**LLM access** — the LLM can search memories (read-only) via the `agent_memory` tool, but cannot directly add/remove them. Memory management is the agent's job.

## Rolling context engine

Context is not a fixed window that truncates. It's a **budget-based assembly** that's recomputed at every checkpoint.

### Checkpoints

Context is reassembled at:

1. **Before each run** — always (both AI SDK and CLI)
2. **Before each step** — AI SDK only, if using step-level control

### Token budget allocation

```
Total budget: maxContextTokens (configurable, default: 8000 tokens)

┌──────────────────────────────────┐
│ 1. System instructions           │  ← always full, fixed cost
├──────────────────────────────────┤
│ 2. Inbox peek                    │  ← unread count + smart previews
├──────────────────────────────────┤
│ 3. Current focus                 │  ← derived from shouldContinue()
├──────────────────────────────────┤
│ 4. Todo state                    │  ← always full, small fixed cost
├──────────────────────────────────┤
│ 5. Notes (key list)              │  ← just the list of note keys, not content
├──────────────────────────────────┤
│ 6. Memory (auto-injected)        │  ← budget share, most relevant first
├──────────────────────────────────┤
│ 7. Conversation history          │  ← remaining budget, most recent first
└──────────────────────────────────┘
```

Allocation order:

1. **Fixed sections** (instructions, inbox peek, current focus, todos, note keys) — always included in full, all small
2. **Memory** — up to `memoryBudget` tokens (default: 20% of remaining), most relevant first
3. **Conversation history** — fills remaining budget, most recent turns first

If total exceeds budget, conversation history shrinks first, then memory. Fixed sections are never trimmed.

### Why rolling, not truncation or compaction

**Truncation** (drop oldest N turns) loses information suddenly. A fact mentioned 10 turns ago disappears even if it's critical.

**Compaction** (summarize old turns) is expensive (requires LLM call) and lossy (summary misses details the LLM might need).

**Rolling** (budget-based reassembly) is better because:

- Memory captures important facts from old conversations — they survive even when turns are dropped
- Notes persist the LLM's explicit knowledge — they never age out
- Each checkpoint re-evaluates what's relevant, not just what's recent
- Token budget is precise — no surprises about context length

### Token counting

Approximate token counting for budget management. We don't need exact counts (that requires model-specific tokenizers). A simple heuristic: `chars / 4` (rough average for English/code). Configurable via `tokenEstimator: (text: string) => number`.

### Step-level context (AI SDK only)

Agent stays on top of `@agent-worker/loop` — it never bypasses it. For step-level context reassembly, we use AI SDK's built-in `prepareStep` hook, which `ToolLoopAgent` already supports:

```ts
// AI SDK's PrepareStepFunction (already exists in ai@6.x)
type PrepareStepFunction<TOOLS> = (options: {
  steps: StepResult<TOOLS>[]; // steps executed so far
  stepNumber: number;
  model: LanguageModel;
  messages: ModelMessage[]; // messages for this step
  experimental_context: unknown;
}) => PrepareStepResult<TOOLS>;

// PrepareStepResult — can override per step:
//   model, system, messages, activeTools, toolChoice, providerOptions
```

AiSdkLoop exposes this as a pass-through option. The agent provides a `prepareStep` function that reassembles context between steps:

```ts
// AiSdkLoop option (added to @agent-worker/loop)
interface AiSdkLoopOptions {
  // ... existing options ...
  /** AI SDK prepareStep — called before each step within a run. */
  prepareStep?: PrepareStepFunction<ToolSet>;
}
```

The agent registers `prepareStep` to inject updated context:

```
Run (with prepareStep):
  step 1: ToolLoopAgent calls prepareStep → agent reassembles context
           → model generates with fresh context
           → tool calls → execute tools
  step 2: ToolLoopAgent calls prepareStep → agent reassembles context
           → model generates with fresh context
           → tool calls → execute tools
  ...
  step N: prepareStep → model generates → no tool calls → run complete
```

This keeps the boundary clean: AiSdkLoop and ToolLoopAgent own the step loop and tool execution. Agent provides `prepareStep` to adjust context. No bypassing.

CLI loops always operate at run-level granularity only — context is reassembled between `loop.run()` calls.

## Continue condition

After each run completes, the agent evaluates whether to run again:

```
function shouldContinue(): "next_message" | "next_todo" | "idle" {
  // 1. Unseen messages in inbox → always prioritize new input
  if (inbox.unread.length > 0) return "next_message"

  // 2. Pending todos → continue current train of thought
  if (todos.pending.length > 0) return "next_todo"

  // 3. Nothing to do → go idle
  return "idle"
}
```

**Messages always preempt todos.** The agent stays responsive to new input. When a new message arrives mid-task, the agent sees it in the next prompt and can decide to pivot, acknowledge and continue, rewrite its todos, or ignore it. Old todos may be abandoned or rewritten — this is expected, not an error.

For CLI loops: same logic. The MCP server has been updating todo state as the LLM called tools during the run. After the run, the agent reads the updated state and evaluates.

### Current focus

The "current focus" section in the prompt is derived from `shouldContinue()`:

- **`"next_message"`** → current focus = the unread message(s) being delivered. The prompt says: "New messages arrived: [message content]"
- **`"next_todo"`** → current focus = summary of pending todos. The prompt says: "Your current working memory: [todo list]"

This is not a persistent field — it's computed fresh at each checkpoint based on the agent's current state. There is no "current task" object in the data model.

### Safety: maxRuns

A `maxRuns` cap (default: 10) prevents infinite loops. When hit, the agent marks remaining todos as abandoned and moves to the next message (or idle).

## Toolkit: tool assembly

How tools reach the LLM depends on the loop type:

### AI SDK loops — direct injection

```ts
interface ToolKitConfig {
  tools?: ToolSet; // user-defined AI SDK tools
  mcp?: McpConnection[]; // external MCP servers
  includeBuiltins?: boolean; // todo, notes, memory. Default: true
}
```

Tool sources, merged in order:

1. **Built-in** — `agent_inbox`, `agent_send`, `agent_todo`, `agent_notes`, `agent_memory`
2. **MCP tools** — fetched from connected MCP servers
3. **User tools** — passed directly in config

**The `agent_*` prefix is reserved.** Built-in tools cannot be overridden by MCP or user tools. If a collision is detected on `agent_*` names, `init()` throws. User and MCP tools should use their own namespace (e.g., `my_*`, `mcp_*`, or unprefixed).

### CLI loops — MCP bridge

CLI loops receive tools via the agent MCP server:

```ts
// Agent starts MCP server exposing builtins
const mcpServer = new AgentMcpServer(stateManager);
await mcpServer.start();

// CLI loop is configured to connect to it
const loop = new ClaudeCodeLoop({
  // The agent adds its MCP server to the CLI's MCP connections
  extraArgs: ["--mcp-config", mcpConfigPath],
});
```

External MCP servers (user-provided) are also passed through to the CLI loop. The agent MCP server is just one more MCP connection from the CLI's perspective.

## AgentLoop interface

Agent depends on a capability interface, not concrete loop classes. This decouples `@agent-worker/agent` from specific backends — adding a new loop runtime doesn't require changing agent types.

```ts
type LoopCapability = "directTools" | "prepareStep";

interface AgentLoop {
  supports: LoopCapability[];
  run(prompt: string): LoopRun;
  cancel(): void;
  get status(): LoopStatus;
  preflight?(): Promise<PreflightResult>;
  cleanup?(): Promise<void>;

  // ── Capability surfaces (only present when declared in supports) ──

  /** Set tools for next run. Present when supports includes "directTools". */
  setTools?(tools: ToolSet): void;

  /** Set prepareStep hook. Present when supports includes "prepareStep". */
  setPrepareStep?(fn: PrepareStepFunction): void;

  /** Add MCP server config for CLI loops. Present when supports is empty (CLI). */
  setMcpConfig?(configPath: string): void;
}
```

Each loop declares what it supports and exposes the matching surface:

- `AiSdkLoop`: `supports: ["directTools", "prepareStep"]` → implements `setTools()`, `setPrepareStep()`
- `ClaudeCodeLoop`, `CodexLoop`, `CursorLoop`: `supports: []` → implements `setMcpConfig()`

The agent calls these during `init()`:

```ts
if (loop.supports.includes("directTools")) {
  loop.setTools!(builtinTools);
}
if (loop.supports.includes("prepareStep")) {
  loop.setPrepareStep!(contextEngine.prepareStep);
}
if (loop.setMcpConfig) {
  loop.setMcpConfig!(agentMcpConfigPath);
}
```

Extensible — new capabilities add new optional methods, no type union changes.

## Agent config

```ts
interface AgentConfig {
  /** Display name */
  name?: string;

  /** System instructions prepended to every prompt */
  instructions?: string;

  /** Which loop backend to use */
  loop: AgentLoop;

  /** Tool assembly config (AI SDK loops only) */
  toolkit?: ToolKitConfig;

  /** Max loop.run() calls per message. Default: 10 */
  maxRuns?: number;

  /** Inbox config */
  inbox?: InboxConfig;

  /** Context engine config */
  context?: {
    /** Total token budget for assembled prompt. Default: 8000 */
    maxTokens?: number;
    /** Memory budget as fraction of remaining. Default: 0.20 */
    memoryBudget?: number;
    /** Custom token estimator. Default: chars/4 */
    tokenEstimator?: (text: string) => number;
  };

  /** Notes storage backend. Default: file-based */
  notesStorage?: NotesStorage;

  /** Memory config. Optional — disabled when not provided */
  memory?: {
    /** Storage backend. Default: file-based */
    storage?: MemoryStorage;
    /** Extraction model — completion API endpoint or model instance. */
    extractionModel?: string | LanguageModel;
    /** Custom extraction function (alternative to model-based extraction) */
    extractMemories?: (turns: Turn[]) => Promise<string[]>;
    /** When to extract. Default: "checkpoint" */
    extractAt?: "checkpoint" | "idle" | "never";
    /** Max memories to inject per prompt. Default: 10 */
    maxInjected?: number;
  };
}
```

## Agent public API

```ts
class Agent {
  // ── Lifecycle ──
  constructor(config: AgentConfig);
  async init(): Promise<void>; // start MCP server, connect external MCP, assemble tools
  async stop(): Promise<void>; // stop processing, stop MCP server, cleanup

  // ── Messaging ──
  push(message: string): void; // enqueue to inbox, debounced wake
  push(message: Message): void; // with metadata (from, etc.)

  // ── State ──
  get state(): AgentState; // idle | processing | error | stopped
  get inbox(): readonly InboxMessage[]; // all messages (read-only view)
  get todos(): readonly TodoItem[]; // current todo state
  get context(): readonly Turn[]; // conversation history
  get notes(): NotesStorage; // access notes directly

  // ── Events ──
  on(event: "stateChange", fn: (state: AgentState) => void): void;
  on(event: "event", fn: (event: LoopEvent) => void): void;
  on(event: "runStart", fn: (info: RunInfo) => void): void;
  on(event: "runEnd", fn: (result: LoopResult) => void): void;
  on(event: "messageReceived", fn: (message: InboxMessage) => void): void;
  on(event: "send", fn: (target: string, content: string) => void): void;
  on(event: "contextAssembled", fn: (prompt: AssembledPrompt) => void): void;
}
```

## File structure

```
packages/agent/
  src/
    agent.ts           — Agent class: state machine, message dispatch, run loop
    inbox.ts           — Inbox: messages, read/unread, peek, debounced wake
    send.ts            — SendTool: outbound messaging with guard
    context-engine.ts  — ContextEngine: budget-based prompt assembly
    todo.ts            — TodoTool: in-memory state + tool definition
    notes.ts           — NotesTool: persistent storage + tool definition
    memory.ts          — MemoryManager: auto-extraction, search, injection
    toolkit.ts         — ToolKit: merge builtins + MCP + user tools
    mcp-server.ts      — AgentMcpServer: expose builtins to CLI loops
    mcp-client.ts      — MCP client: connect external servers, wrap as AI SDK tools
    storage/
      file-notes.ts    — Default file-based NotesStorage
      file-memory.ts   — Default file-based MemoryStorage
    types.ts           — All type definitions
    index.ts           — Public exports
  test/
    agent.test.ts
    inbox.test.ts
    send.test.ts
    context-engine.test.ts
    todo.test.ts
    notes.test.ts
    memory.test.ts
    mcp-server.test.ts
```

## Design decisions

1. **Agent stays on top of loop**: Agent never bypasses `@agent-worker/loop`. For AI SDK step-level context, we use AI SDK's built-in `prepareStep` (which can override `system`, `messages`, `activeTools` per step). AiSdkLoop passes it through to `ToolLoopAgent`. Agent provides the function, loop owns execution.

2. **MCP server transport**: SSE/HTTP. Agent starts a local HTTP server, CLI connects via `--mcp-server http://localhost:PORT`. Portable, no stdin/stdout conflict with CLI's NDJSON protocol.

3. **Memory extraction**: Optional. Uses completion/prefix-completion API (cheap, fast). Extraction model is configurable separately — use a small model like DeepSeek for extraction while using Claude for the main agent.

4. **Notes in context**: Just inject the key list (not content). LLM uses `notes.read(key)` to fetch what it needs. Keeps context small, LLM decides what's relevant.

5. **Messages preempt todos**: `shouldContinue()` checks inbox before todos. New messages always interrupt ongoing tasks. Prevents starvation.

6. **Peek = read for short messages**: If a message fits in the peek preview, it's marked `read` — the full content was delivered into the agent's context. "Read" means delivered, not handled. The agent may ignore it.

7. **`agent_*` namespace is reserved**: Built-in tools cannot be overridden. User/MCP tools must use other prefixes. `init()` throws on collision.

8. **`inbox.wait()` is non-blocking**: Registers a reminder and returns immediately. The processing loop waits for the reminder instead of going idle. When a message arrives, the reminder fires and the agent resumes naturally. Timeout reminders push a system notification into the inbox.

9. **Messaging model, not task model**: The agent is an always-on async recipient. "Read" means delivered, not handled. Todos are working memory, not a task queue. Messages may be ignored. No guarantee of completion or response.

## What this package does NOT do

- **No HTTP server** — embedding in a server is the caller's job
- **No auth** — no API keys, no user management
- **No daemon** — no process management, no PID files
- **No tool execution sandbox** — that's loop's responsibility (bash-tool)
- **No model selection** — caller picks the loop backend and model
- **No vector database** — default memory uses simple keyword search; user can plug in vector search via custom MemoryStorage

## Example usage

```ts
import { Agent } from "@agent-worker/agent";
import { AiSdkLoop } from "@agent-worker/loop";
import { anthropic } from "@ai-sdk/anthropic";

// ── AI SDK with all features ──

const agent = new Agent({
  name: "researcher",
  instructions: "You are a research assistant.",
  loop: new AiSdkLoop({
    model: anthropic("claude-sonnet-4-20250514"),
  }),
  maxRuns: 5,
  memory: {
    extractionModel: "deepseek:deepseek-chat", // cheap model for memory extraction
  },
});

await agent.init();
agent.on("event", (e) => console.log(e));
agent.push("Research the top 3 AI frameworks released in 2025");

// ── CLI loop with MCP bridge ──

const cliAgent = new Agent({
  name: "coder",
  instructions: "You are a coding assistant.",
  loop: new ClaudeCodeLoop({
    permissionMode: "acceptEdits",
  }),
  maxRuns: 3,
  // Notes stored in project directory
  notesStorage: new FileNotesStorage({ dir: "./.agent-notes" }),
});

await cliAgent.init();
// Agent starts MCP server, configures CLI to connect to it
// LLM inside Claude Code can now use agent_todo, agent_notes, agent_memory tools
cliAgent.push("Refactor the auth module to use JWT tokens");

// ── Custom storage backends ──

const customAgent = new Agent({
  name: "support",
  instructions: "You are a customer support agent.",
  loop: new AiSdkLoop({ model: anthropic("claude-haiku-4-5-20251001") }),
  notesStorage: {
    async read(key) {
      return db.notes.get(key);
    },
    async write(key, content) {
      await db.notes.set(key, content);
    },
    async list() {
      return db.notes.keys();
    },
    async delete(key) {
      await db.notes.delete(key);
    },
  },
  memory: {
    storage: {
      async add(entry) {
        return vectorDb.insert(entry);
      },
      async search(query, limit) {
        return vectorDb.search(query, limit);
      },
      async list(limit) {
        return vectorDb.recent(limit);
      },
      async remove(id) {
        await vectorDb.delete(id);
      },
    },
    extractionModel: "deepseek:deepseek-chat",
  },
});
```
