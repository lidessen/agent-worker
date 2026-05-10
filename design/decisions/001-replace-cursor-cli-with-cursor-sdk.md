# 001 Replace Cursor CLI Loop with Cursor SDK

Status: accepted

## Context

`packages/loop` currently treats Cursor as a CLI subprocess runtime. The current
`CursorLoop` runs the `agent` command in print mode, asks for `stream-json`, and
injects workspace MCP by temporarily editing `.cursor/mcp.json` in the run cwd.
This creates three mismatches with the rest of the runtime direction:

- Cursor tool and text events are parsed from CLI output instead of a typed
  runtime API.
- MCP wiring mutates project files before each run and restores them after the
  process exits.
- Usage, lifecycle, cancellation, and reconnect semantics are mostly inferred
  by the wrapper.

Cursor now publishes `@cursor/sdk`, a TypeScript SDK for creating local and
cloud Cursor agents, sending prompts, streaming run events, cancelling runs, and
passing MCP servers inline. The SDK still supports local execution against a cwd,
so this can replace the current CLI implementation without changing how
agent-worker chooses the `cursor` runtime.

## Decision

Replace the current Cursor CLI implementation with a Cursor SDK implementation
inside `packages/loop`, keeping `RuntimeConfig.type: "cursor"` and the existing
`AgentLoop` contract.

The new `CursorLoop` should:

- use `Agent.create({ apiKey, model, local: { cwd }, mcpServers })` for local
  runs by default;
- call `agent.send(prompt, { mcpServers })` for each `run`;
- stream `run.stream()` and map Cursor SDK messages into existing `LoopEvent`
  variants;
- implement cancellation through `run.cancel()`;
- pass MCP servers as structured SDK config instead of writing `.cursor/mcp.json`;
- keep usage accounting runtime-local and best-effort unless the SDK exposes
  token usage in stream events;
- keep cloud Cursor agents out of scope for this replacement unless a later
  decision adds cloud runtime semantics to agent-worker.

The replacement is direct. Do not keep a parallel CLI fallback, compatibility
shim, or runtime option for the old Cursor CLI path.

## Design Impact

### `design/DESIGN.md`

The loop mechanism should stop grouping Cursor with CLI stdio runtimes. Cursor
becomes an SDK runtime like Claude Code, while Codex remains the JSON-RPC CLI /
app-server runtime.

The `CLI runtimes over stdio only` constraint should be narrowed to the runtimes
that still use CLI subprocesses. Cursor should be described as SDK-local with
structured MCP config.

### `design/packages/loop.md`

The Cursor module description should change from CLI runner and `.cursor/mcp.json`
mutation to SDK-backed agent execution.

The `AgentLoop` optional capability section already has `setMcpServers(serversObj)`
for SDK loops that accept structured MCP specs. Cursor should use that capability
instead of `setMcpConfig(path)`.

### `design/packages/agent-worker.md`

`loop-factory.ts` should route Cursor MCP configuration through the structured
server path. The current temp-file MCP config path should remain only for
runtimes that need config files.

## Implementation Plan After Approval

1. Add `@cursor/sdk` to `packages/loop`.
2. Replace `packages/loop/src/loops/cursor.ts` with an SDK adapter.
3. Add Cursor SDK option types to `packages/loop/src/types.ts`, including
   `apiKey`, local settings source, sandbox options if needed, and optional
   `agentId` resume support only if it is required for local continuity.
4. Update `packages/agent-worker/src/loop-factory.ts` so Cursor receives
   structured MCP servers and `CURSOR_API_KEY` from runtime env.
5. Remove Cursor-specific `.cursor/mcp.json` mutation code and tests.
6. Add focused Cursor SDK mapping tests using a mocked SDK surface rather than
   invoking the real Cursor service.
7. Update `design/DESIGN.md`, `design/packages/loop.md`, and
   `design/packages/agent-worker.md` after the proposal is approved.

## Verification

- `bunx tsgo -p packages/loop/tsconfig.json`
- Cursor loop unit tests for text, thinking, tool start/end, status/error, and
  cancellation mapping.
- Agent-worker loop factory tests proving Cursor no longer requires
  `setMcpConfig`.
- A local smoke test gated on `CURSOR_API_KEY` and `@cursor/sdk` availability.

## Consequences

Positive:

- Removes fragile CLI output parsing for Cursor.
- Removes temporary `.cursor/mcp.json` mutation from normal runs.
- Aligns Cursor with the repository's SDK/app-server runtime migration direction.
- Gives access to SDK-level lifecycle controls and run streaming.

Negative:

- Requires a Cursor API key for SDK authentication.
- The SDK is public beta, so event shapes and lifecycle semantics may still move.
- Local Cursor behavior may differ from the existing `agent -p --yolo` CLI
  defaults; permission and sandbox controls need explicit verification.

## Settled During Implementation

- Cursor uses SDK-local execution and structured MCP servers only.
- Cursor no longer receives temp MCP config files.
- Cursor SDK local runs load project settings by default; callers may override
  `settingSources` later if the config surface needs it.
- Usage remains estimated from text until Cursor SDK exposes token counts in the
  stream surface used here.
- Cloud Cursor agents remain out of scope.

## Follow-up Questions

- Should workspace policy grow a Cursor-specific sandbox/autonomy mapping, or
  should Cursor stay on SDK defaults until policy support is explicit?
- Should local Cursor agent continuity persist `agentId` in `stateDir`?
