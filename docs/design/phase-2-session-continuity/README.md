# Phase 2 — Session Continuity

Date: 2026-04-13

Prerequisite reading:

- `docs/research/2026-04-12-daily-productivity-roadmap.md`
- `docs/research/2026-04-12-daily-productivity-design-review-round1.md`
- `docs/design/phase-1-worktree-isolation/README.md`
- Phase 1 validation: `docs/handoffs/2026-04-13-phase1-worktree-validation.md`

## Goal

Let long-running agents survive daemon restarts with their
working context intact. "Yesterday the agent was halfway through
a task, today it should pick up where it left off" — not
"yesterday's agent is gone, today a fresh agent reads the
chronicle and tries to reconstruct".

Per the roadmap, Phase 2 sits on top of the Phase 1 worktree
slice and is the blocker for "cross-day main driver" experience.

## What already works (after Phase 1)

- `FileWorkspaceStateStore` replays tasks/attempts/handoffs/
  artifacts on workspace init.
- Status store reloads on init.
- Chronicle + timeline are file-backed, read on demand.
- Workspace manifest + `restoreFromManifest` rebuild workspace
  runtimes after daemon restart.
- Worktrees survive daemon crash and reattach idempotently.
- Inbox entries are persisted via `InboxStore.load()`.

## What does NOT survive restart today (the inventory gap)

| Thing | Storage class | Wired? |
|-------|---------------|--------|
| Notes (markdown key/value) | `FileNotesStorage` exists | NO |
| Semantic memory snippets | `FileMemoryStorage` exists | NO |
| Codex `threadId` | `CodexLoop` field + setter | NO |
| Claude/AiSdk conversation history | nothing exists | NO |
| Agent `TodoManager` state | nothing exists | NO |

`FileNotesStorage` and `FileMemoryStorage` are already complete
implementations — they round-trip to `<key>.md` files and
`memories.json` respectively. They have NEVER been instantiated
in production because neither `AgentRegistry.create()` nor
`workspace-registry.ts` passes them to `AgentConfig`. The
in-memory defaults are always used. This is the cheapest win
of Phase 2.

## Decisions (frozen)

1. **Notes + memory default to file-backed for every
   daemon-managed agent with a persistent `agentDir`.** No new
   classes to write. Pass `new FileNotesStorage({basePath: ...})`
   and `new FileMemoryStorage({filePath: ...})` into
   `AgentConfig`.
2. **Codex `threadId` lives in a one-line file** per agent,
   `<agentDir>/thread.json` (`{"threadId": "thr_..."}`).
   Written when `ensureThread()` succeeds; read back via
   `CodexLoopOptions.threadId` when the loop is reconstructed.
3. **Full `Turn[]` conversation history persistence is out of
   scope for the MVP.** Rationale: chronicle + task ledger +
   notes give the agent enough context to resume, and real
   runtime providers (claude-code, codex) have their own session
   handling. Building a custom turn store would duplicate
   provider work we should be leaning on. Revisit only if
   validation shows agents can't resume cleanly.
4. **`TodoManager` state persistence is out of scope for the
   MVP.** Same rationale — todos are short-lived per-task,
   rebuilt from task ledger on next run.
5. **The slice must be backward-compatible.** In-memory defaults
   stay. File-backed storage only activates when `agentDir` is
   set (which is always true for daemon-managed agents, never
   true for one-shot in-process tests).

## Data flow after Phase 2

```
aw daemon start
  └─ WorkspaceRegistry.restoreFromManifest()
       └─ per workspace: create() with _restore=true
            └─ per agent: createAgentTools() + createOrchestrator()
                 └─ Agent constructor
                      ├─ notesStorage = new FileNotesStorage({
                      │   basePath: join(agentDir, "notes")
                      │ })  ← NEW
                      ├─ memory storage = new FileMemoryStorage({
                      │   filePath: join(agentDir, "memories.json")
                      │ })  ← NEW
                      └─ if runtime === "codex":
                          const threadId = readThreadFile(agentDir)
                          CodexLoopOptions.threadId = threadId   ← NEW
```

And on the runtime hot path, after Codex assigns a thread:

```
CodexLoop.ensureThread()
  └─ on success: writeThreadFile(agentDir, threadId)   ← NEW
```

## Integration points

### Slice 1: notes + memory (the cheap win)

- `packages/agent-worker/src/agent-registry.ts`
  - When building `AgentConfig`, pass `notesStorage:
    new FileNotesStorage({basePath: join(agentDir, "notes")})`
    whenever `agentDir` is set.
  - Same for `memory: { storage: new FileMemoryStorage({
    filePath: join(agentDir, "memories.json")}) }`.
- `packages/agent-worker/src/workspace-registry.ts`
  - Workspace-embedded agents flow through the registry via
    `createAgentLoop` → `ManagedAgent`. Verify `agentDir` is
    already passed down that path; if not, thread it through
    and attach the storage instances there.

### Slice 2: Codex thread persistence

- `packages/loop/src/loops/codex.ts`
  - Add a new option: `CodexLoopOptions.threadIdFile?: string`.
  - In `ensureThread()` on success, if `threadIdFile` is set,
    `fs.writeFile(threadIdFile, JSON.stringify({threadId}))`.
  - Best-effort; don't throw on write failure, just log.
- `packages/agent-worker/src/loop-factory.ts`
  - When constructing `CodexLoop`, compute
    `threadIdFile = join(agentDir, "thread.json")` and also
    read it synchronously to seed `CodexLoopOptions.threadId`
    if the file exists.

### Slice 3: validation

- Unit tests for:
  - `AgentRegistry.create()` with an `agentDir` produces an
    `Agent` whose `notesStorage` is a `FileNotesStorage` (not
    the in-memory default).
  - Same for memory.
  - Round-trip: write a note, kill the `Agent`, reconstruct,
    read the note back.
- Real-runtime validation:
  - New `validation-continuity.yml` — one long-lived agent
    with `runtime: codex`, give it a task that includes
    writing a note, SIGKILL daemon, restart, verify the note
    is still there and thread continues.

## Risks and open questions

- **Concurrent writes to `memories.json`.** `FileMemoryStorage`
  caches in memory and rewrites the whole file on every add.
  Two `Agent` instances pointing at the same file would race.
  Mitigation: `agentDir` is per-agent, so under normal use
  there is exactly one writer. Document this constraint.
- **Notes directory growing without bound.** Not a Phase 2
  blocker. Add a future `notes_gc` skill.
- **Codex thread IDs are not guaranteed stable across Codex
  CLI upgrades.** If the restored thread ID is stale, Codex
  will reject it and fall back to a new thread. That's
  acceptable — worst case the agent loses continuity for one
  turn.
- **`AgentRegistry` has no daemon-restart restore path today.**
  For workspace-embedded agents this is fine (the workspace
  restore path rebuilds them). For API-created global agents,
  they are lost on restart today and will still be lost after
  Phase 2 slice 1. That's a separate gap; document it, don't
  fix it here.
- **Long turn histories for claude-code and ai-sdk runtimes.**
  Those runtimes are stateless between runs by design — each
  `run()` is a fresh `query()` call. Session continuity for
  them relies on the prompt context (notes + chronicle + task
  ledger + recent channel messages) being rich enough. We
  commit to that model in this phase; if validation shows it's
  insufficient, revisit.

## MVP build order

1. **Slice 1** — notes + memory wiring in `AgentRegistry` and
   `workspace-registry` construction paths. Includes two
   targeted unit tests.
2. **Slice 2** — Codex thread persistence in `CodexLoop` and
   `loop-factory`. Includes a unit test that seeds a thread
   file and verifies the loop picks it up.
3. **Slice 3** — `validation-continuity.yml` real-runtime
   validation run. SIGKILL the daemon mid-task, restart,
   verify the agent resumes.

Each slice lands as its own commit. Stop after any slice if
validation surfaces a design issue.

## What Phase 2 does NOT do

- No turn history persistence.
- No todo persistence.
- No API-created agent restart restore.
- No new storage classes — only wiring existing ones.
- No inbox entry restore semantics changes.
- No changes to the workspace state store.
