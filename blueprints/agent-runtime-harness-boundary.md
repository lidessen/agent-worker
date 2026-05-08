# Agent Runtime Harness Boundary

## Plan

Implement the first narrow slice of ADR 003: introduce an explicit
`AgentRuntime` contract without preserving the old standalone agent as the
default execution model.

Scope:

- Add runtime boundary types in `packages/agent`: `RuntimeBinding`,
  `ContextPacket`, `ToolCapabilitySet`, `RunPolicy`, `RuntimeTrace`,
  `ExecutionResult`, `HandoffDraft`, and `ArtifactCandidate`.
- Add an `AgentRuntime` wrapper that adapts an already selected `AgentLoop`.
  It must not choose provider/model/actor and must not commit workspace
  Handoff/Artifact records.
- Update `packages/agent-worker` runtime wiring to create a `RuntimeBinding`
  beside the existing loop, so later workspace dispatch can call
  `AgentRuntime.run(...)`.
- Keep workspace orchestration semantics unchanged in this slice; only add the
  seam that the orchestrator will use next.
- Do not introduce `PersonalHarness` yet. Legacy `/agents` behavior remains
  implementation drift to remove in a later slice.

Verification:

- `bunx tsgo -p packages/agent/tsconfig.json`
- `bunx tsgo -p packages/agent-worker/tsconfig.json`
- focused tests for `AgentRuntime.run(...)` with `MockLoop`
- focused tests for runtime binding creation in `loop-factory`

## Build

- Added `packages/agent/src/runtime.ts` with the runtime boundary types and a
  thin `AgentRuntime` wrapper.
- Exported the new runtime contract from `packages/agent/src/index.ts`.
- Added `createRuntimeBindingFromConfig()` in
  `packages/agent-worker/src/loop-factory.ts` while preserving the existing
  `createLoopFromConfig()` callers.
- Added focused tests for packet rendering, runtime execution, run-scoped tool
  capability application, and runtime binding creation.

## Verify

- `bunx tsgo -p packages/agent/tsconfig.json` passed.
- `bunx tsgo -p packages/agent-worker/tsconfig.json` passed.
- `bun test packages/agent/test/runtime.test.ts packages/agent-worker/test/loop-factory-paths.test.ts` passed: 15 pass, 0 fail.
