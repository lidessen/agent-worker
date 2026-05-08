# packages/agent — Design

> `AgentRuntime` execution boundary plus migration source for the historical standalone agent implementation. A runtime executes a bounded run supplied by a harness; it does not own long-term context, tools, memory, task state, recovery, or authority.

See [../DESIGN.md](../DESIGN.md) and [../decisions/003-agent-runtime-harness-boundary.md](../decisions/003-agent-runtime-harness-boundary.md) for the runtime/harness split.

## Target shape

```
HarnessEnvironment
  ├─ selects ContextPacket
  ├─ grants ToolCapabilitySet
  ├─ resolves RunPolicy
  └─ selects RuntimeBinding
        │
        ▼
AgentRuntime.run(binding, packet, capabilities, policy)
  ├─ render packet to backend prompt
  ├─ wire run-scoped tools / MCP servers
  ├─ call AgentLoop.run(...)
  ├─ stream RuntimeTrace / LoopEvent telemetry
  └─ return ExecutionResult + HandoffDraft + ArtifactCandidate refs
        │
        ▼
HarnessEnvironment commits records and extracts durable facts
```

`AgentRuntime` is deliberately thin. Its job is to adapt a harness-built run to
the already selected backend/runtime binding and report what happened. It may
keep runtime-local session files when a backend needs them, such as provider
thread ids, but those files are not the long-term semantic context model.

## Runtime contract

Inputs:

- `RuntimeBinding` — backend/runtime actor selected by the harness or daemon
  harness registry; the runtime adapts it but does not choose it.
- `ContextPacket` — bounded context selected by the harness.
- `ToolCapabilitySet` — tools granted for this run, including transport shape
  (`direct`, structured MCP, config-file MCP) and run-scoped bindings.
- `RunPolicy` — backend controls resolved by the harness, such as sandbox,
  approval, permission mode, cwd, allowed paths, env, and resolved model/runtime
  options.

Outputs:

- `RuntimeTrace` — runtime-local event stream and audit refs.
- `ExecutionResult` — terminal status, usage, errors, and backend session refs.
- `HandoffDraft` — structured execution report payload when the run is
  task-shaped. It is not a committed workspace `Handoff` record.
- `ArtifactCandidate` refs — observed outputs or evidence refs produced by the
  run. They are not committed workspace `Artifact` records.

Non-outputs:

- no direct workspace state mutation;
- no durable semantic memory writes;
- no committed `Handoff` / `Artifact` record creation;
- no task/attempt dispatch decisions;
- no retry/recovery ownership;
- no authority decisions for protected effects.

Those belong to the harness that invoked the runtime. The harness validates and
commits Handoff/Artifact records, assigns record ids, and decides which outputs
become durable semantic facts.

## Migration source: historical standalone Agent

The current package still contains the old standalone implementation:

- `Agent` lifecycle and state machine;
- `RunCoordinator` over inbox, todos, reminders, and idle work;
- `ContextEngine` that renders dashboard-style prompts;
- `Inbox`, `TodoManager`, `NotesStorage`, `MemoryManager`,
  `ReminderManager`;
- built-in `agent_*` tools and bridge transports;
- `workspace-client.ts`, which lets a standalone agent call workspace tools.

These pieces are not the target architecture as a bundle. They should be split:

- backend-neutral loop/tool transport helpers can move under `AgentRuntime`;
- inbox/todos/notes/memory/reminders can move behind an explicit
  `PersonalHarness` if the simple local-agent product remains;
- `workspace-client.ts` should be removed in the target design because a
  workspace supplies context/tools to a runtime instead of being consumed by a
  standalone agent.

## Modules

**Runtime boundary.** The target module owns `AgentRuntime.run(...)`, prompt
rendering from a packet, run-scoped tool wiring, backend session refs, trace
collection, and result normalization.

**Tool transport helpers.** Direct AI SDK tools, structured MCP server specs,
and config-file MCP setup are transport details. They should be reusable by any
harness that grants a compatible `ToolCapabilitySet`.

**Historical personal-agent subsystems.** `inbox.ts`, `todo.ts`, `notes.ts`,
`memory.ts`, `reminder.ts`, `context-engine.ts`, and `run-coordinator.ts` are
migration candidates for `PersonalHarness`, not default runtime state.

**Deprecated workspace client.** `workspace-client.ts` is a historical bridge
from the old standalone model. Target workspace execution flows through
`WorkspaceHarness -> AgentRuntime`, so this client should not remain a core
dependency.

## Key mechanisms

**State is supplied, not owned.** The runtime receives a packet and capability
grant for one run. It does not decide which long-term facts matter and does not
maintain a hidden memory model.

**Tools are granted per run.** Tool capability is fixed before invocation and
bound to the run/attempt identity supplied by the harness. Any protected effect
still goes through the harness capability boundary.

**Runtime session continuity stays runtime-local.** Provider-specific resume
ids, thread files, and token accounting belong in the runtime adapter because
each backend measures and resumes differently. These refs can be returned to
the harness as evidence but are not universal context.

**Personal agent is a harness, not the default agent.** If the product keeps a
simple non-workspace agent, it should be implemented as `PersonalHarness`:
inbox/todos/notes/memory are harness state, packet builder output is runtime
input, and result extraction updates personal harness state.

## Non-goals

- Owning workspace context or workspace tools directly.
- Keeping a second long-term semantic memory model inside `AgentRuntime`.
- Making `RunCoordinator` / `ContextEngine` the default path for workspace
  attempts.
- Preserving historical standalone behavior through compatibility shims.
