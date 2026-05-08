# Agent Runtime Harness Boundary

**Status:** adopted
**Date:** 2026-05-05

## Context

The current design grew from a standalone `/agents` product path. A standalone
agent owned inbox, todos, notes, memory, reminders, prompt assembly, run
coordination, and built-in tools. Workspace support was added later and reused
some agent-facing ideas, but the workspace event harness direction now makes
that split misleading.

In the harness model, context and tools are not properties of the agent. They
are supplied by the surrounding environment. A workspace is one such
environment: it decides which semantic events, resources, projections, policies,
and tools are visible for a run, then extracts durable facts from the result.
Future environments may not be workspaces, but they should still drive agents
through the same execution boundary.

The implementation may break existing standalone internals. Compatibility with
the historical `/agents` runtime is not a design constraint.

## Recommendation

Replace the conceptual split between standalone agents and workspace agents with
a runtime/harness split:

```text
HarnessEnvironment
  -> select RuntimeBinding
  -> ContextPacket
  -> ToolCapabilitySet
  -> RunPolicy
  -> AgentRuntime.run(...)
  -> RuntimeTrace / ExecutionResult / HandoffDraft / ArtifactCandidate refs
  -> HarnessEnvironment commits records and extracts durable facts
```

`AgentRuntime` is the execution subject. It owns only runtime-local execution:
adapting an already selected backend/runtime binding, session continuity files
when a backend needs them, loop invocation, streaming runtime telemetry, and
temporary run-scoped tool wiring. It must not choose provider/model/actor, own
long-term context, memory, workspace facts, task state, recovery policy, or
authority. Its stable input is a runtime binding, packet, capability grant, and
run policy; its stable output is a runtime trace, structured execution result,
and candidate return payloads.

`HarnessEnvironment` owns the long-lived semantics around a run. It selects the
runtime actor/backend binding, selects context, grants tools, resolves policy,
validates protected effects, stores execution records, handles retry/recovery,
commits Handoff/Artifact records, and extracts durable facts from committed
records/evidence. `WorkspaceHarness` is the first mature implementation and
uses the `WorkspaceEvent` core adopted in ADR 002.

This means `packages/agent` is no longer a peer product runtime next to
`packages/workspace`. Its useful pieces should be carved into one of two places:

- runtime-facing pieces become the shared `AgentRuntime` execution wrapper or
  tool transport helpers;
- personal/simple-agent pieces become an optional `PersonalHarness` only if the
  product still needs a non-workspace local agent.

The old `workspace-client.ts` direction should be removed in the target design.
An agent does not optionally consume a workspace as a tool bundle. A harness
constructs the packet and capability set, then invokes a runtime. Workspace
tools are exposed through the harness boundary, not imported by a standalone
agent that happens to call workspace APIs.

`/agents` stops being the root architectural concept. In the target design it is
listing/state only for runtime actors or harness members. Creation and dispatch
belong to harness endpoints: workspace channel/task APIs for `WorkspaceHarness`,
and personal-harness APIs only if that product path survives. `POST /agents` and
`POST /agents/:name/send` are migration/deprecation surfaces; they must either
route to an explicit `PersonalHarness` or fail with a clear harness-targeting
error. They must not preserve a hidden ManagedAgent path. Avoid conflating agent
identity, runtime backend, and harness membership.

Breaking migration is allowed. Prefer direct replacement over compatibility
shims. If a feature only exists to preserve historical standalone semantics, it
should be deleted or moved behind an explicit personal harness rather than
leaking into workspace orchestration.

## Target package boundaries

- `packages/loop` remains the backend adapter layer. It knows how to talk to
  Claude Code, Codex, Cursor, AI SDK, Mock, and future backends.
- `packages/agent` becomes the runtime execution boundary and migration source
  for simple-agent subsystems. It should not own workspace context or a second
  long-term memory model by default.
- `packages/workspace` remains the passive `WorkspaceHarness` kernel:
  WorkspaceEvents, resources, projections, execution records, protected
  invocation records, context packet builders, capability validation, and MCP
  tool surfaces.
- `packages/agent-worker` owns harness orchestration: lifecycle, registries,
  HTTP/CLI surface, workspace orchestrators, runtime creation, runner dispatch,
  extraction, retry, and recovery.
- `packages/web` should present harnesses and runtime actors separately instead
  of making standalone agent chat the default mental model.

## Migration order

1. Define the `AgentRuntime` input/output contract around `RuntimeBinding`,
   `ContextPacket`, `ToolCapabilitySet`, `RunPolicy`, `RuntimeTrace`,
   `ExecutionResult`, `HandoffDraft`, and `ArtifactCandidate` refs.
2. Route workspace attempts directly through `AgentRuntime`; remove any
   dependency on standalone `Agent`, `RunCoordinator`, `ContextEngine`, or
   `workspace-client.ts`.
3. Carve existing `packages/agent` subsystems into shared runtime helpers or an
   explicit `PersonalHarness`. Delete the rest.
4. Update `/agents` and Web UI semantics so they list runtime actors/harness
   members only. Dispatch is harness-owned; legacy `/agents` dispatch must be
   deleted, blocked, or explicitly mapped to `PersonalHarness`.
5. Remove compatibility shims once workspace dispatch and the optional personal
   harness use the new runtime contract.

## Alternatives seriously considered

**Keep two product paths.** Strongest case: it matches the current code and
preserves simple `/agents/:name/send` behavior. It loses because the old agent
path owns context, tools, and memory in exactly the place the harness model says
they should not live. It also forces every new workspace mechanism to explain
why standalone agents are exempt.

**Make every agent a hidden workspace member.** Strongest case: one harness
implementation, one semantic event model, one API family. It loses because a
workspace is only one harness implementation. Forcing every future local,
CI-oriented, or document-oriented environment to become a workspace would make
the workspace schema an accidental universal container.

**Delete standalone completely and expose only workspaces.** Strongest case:
the product becomes simpler immediately. It loses because the useful concept is
not "workspace only"; it is "harness supplies context/tools/policy to a
runtime." A personal or simple harness may still be valid, but it must be named
as a harness instead of hiding inside `Agent`.

**Keep `packages/agent` as the default owner of inbox/todos/memory and let
workspace be a special case.** Strongest case: minimal implementation churn. It
loses because it keeps the wrong dependency direction: harnesses would have to
adapt themselves to an agent-local memory model instead of controlling context
explicitly.

## Cold review

- **Completeness** — The proposal names `AgentRuntime` but could become too
  abstract unless its input/output contract is concrete. The migration order
  therefore starts by defining packet, capability, policy, trace, result,
  draft handoff payloads, and artifact candidates before deleting old
  subsystems.
- **Consistency** — ADR 002 said standalone `/agents` stays separate. This ADR
  supersedes only that point: the WorkspaceEvent harness core remains adopted,
  but standalone is no longer a peer architectural path.
- **Clarity** — "Agent" can mean identity, runtime backend, or human-facing
  member. The target docs must use `AgentRuntime`, `HarnessEnvironment`, and
  harness member/runtime actor distinctly.
- **Scope** — There is a risk of inventing many harness types before one works.
  Only `WorkspaceHarness` is first-class now; `PersonalHarness` is optional and
  should exist only if the product keeps simple non-workspace agents.
- **YAGNI** — Do not create a generic harness framework with plugin points
  before migration proves the runtime boundary. Start by making workspace
  dispatch call the runtime contract directly.

## Outcome

Adopted. Update the current design docs so the core model is
`HarnessEnvironment -> AgentRuntime`, with `WorkspaceHarness` as the first
mature harness implementation. Implementation may radically replace the old
standalone agent internals and should not carry historical compatibility shims.
