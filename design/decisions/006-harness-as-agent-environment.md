# Harness as Agent Environment

**Status:** adopted
**Date:** 2026-05-10 (proposed) — 2026-05-10 (adopted)

## Context

Decision 005 already named the harness layer as the place where context, tools,
policy, and Handoff hooks live, and identified `WorkspaceHarness`,
`TaskTrackingHarness`, and `PersonalHarness` as peer harnesses. In code,
however, the central abstraction is still a `Workspace` class that bakes in
multi-agent-coordination flavor (channels, inbox, chronicle, channel bridge,
telegram adapter) alongside genuinely universal substrate (events, signals,
resources, Wake/Handoff records, capability boundary, MCP hub). Every other
harness type is forced to be a projection on top of this privileged center,
even when its needs (coding harness's worktrees + branch state, writing
harness's citation library, manager harness's delegation roster) overlap
zero with channels and inbox. The name "Workspace" reinforces the lock-in:
it reads as one specific kind of room, not as the agent's shapeable work
environment that the General Line actually requires.

## Recommendation

Rename and reshape: `Workspace` → `Harness` (the agent's work environment),
with `HarnessType` as the shape primitive that determines what a given
`Harness` instance *contains*. A `Harness` is `universal substrate +
HarnessType`. **A `Harness` instance has exactly one `HarnessType` for its
lifetime**, fixed at construction from harness config; types are not
swapped or composed mid-life. The daemon's existing `HarnessRegistry`
holds *Harness instances* (lifecycle); a new `HarnessTypeRegistry` holds
*types* (templates) and is consulted at Harness construction.

**Substrate criterion** — a piece is substrate iff (a) every imaginable
harness type wants it as mechanism (even when its content vocabulary
differs), and (b) replacing it would force the type to reinvent it.
Substrate by this criterion: WorkspaceEvent stream, Signals, Resources,
Documents, Wake/Handoff/CapabilityInvocation records and boundary, MCP
hub, EventBus, JSONL, plus the **mechanism** of Track / chronicle /
timeline / status (projection skeletons). The `HarnessType` plugs in
(i) type-specific stores (channels, inbox, channel bridge, telegram
adapter for the coordination type; worktrees for a coding type), (ii)
the **content vocabulary** of the universal projection mechanisms (Track
lane names, chronicle/timeline/status entry schemas), (iii) type-specific
MCP tools, (iv) type-specific capability invocations, and (v) the
`produceExtension` / `consumeExtension` hooks for Handoffs. Today's
`Workspace` content splits along this line: the mechanism stays in the
substrate, the coordination-flavored stores (channels, inbox, channel
bridge, telegram adapter) move into a `MultiAgentCoordinationHarnessType`.
"Workspace" survives only as a user-facing label for "a Harness whose
type is multi-agent coordination", not as a class or module name. The
hook protocol from decision 005 lands as one slot of `HarnessType`'s
interface, not as a sidecar.

## Alternatives seriously considered

- **Do nothing — keep `Workspace` as the central class, add `HarnessType` as a
  sidecar.** Strongest case: zero rename churn; all current callers, tests,
  prompts, web UI keep working unchanged; the hook-protocol slice ships in
  days instead of weeks. Rejected: it permanently locks coordination flavor
  into the kernel name, every new harness type pays a cognitive tax of
  being modeled "on top of Workspace", and the General Line's "shapeable
  work environment" stays a documentation aspiration that the code
  contradicts. The cost only grows as more harness types land.

- **Split into base `Harness` + subclass `MultiAgentHarness`, etc.**
  Strongest case: inheritance is the obvious OOP move; subclasses feel
  natural for "one type of Harness". Rejected: a Harness's type is
  composition (which stores, which tools, which hooks), not behavior
  override; inheritance forces single-type identity per instance and makes
  cross-type operations (e.g. a Harness gaining a coding capability mid-task)
  awkward. Composition via `HarnessType` registration scales better and
  matches how 005 already describes the layer.

- **Keep `Workspace` as-is structurally, just rename the class to `Harness`
  without separating universal substrate from coordination flavor.**
  Strongest case: smaller diff; no need to draw the substrate/type-specific
  line. Rejected: solves the naming complaint while leaving the structural
  one — a writing harness still inherits ChannelStore. The General Line
  asks for both fixes; doing only the rename is cosmetics.

## Pre-mortem

A year from now this is being ripped out because the universal/type-specific
boundary turned out wrong: too many things we marked "type-specific" wanted
to leak across types (e.g. a manager harness wants to read a coding harness's
branch state), and the registry-of-types abstraction became a barrier rather
than a seam. The repair would be either flattening type-specific stores into
the substrate (regressing this proposal) or introducing a cross-type query
interface that re-couples them. Mitigation: the substrate intentionally
includes the *mechanism* for type-specific projections (Resource refs,
WorkspaceEvent stream, Track skeleton) — cross-type reads go through these
shared surfaces, not through direct cross-type-store imports. If we still
end up needing direct reads, that's a signal a piece is genuinely universal
and should be promoted into the substrate, not a signal the framing failed.

## Consequences

Adoption invalidates the in-flight `blueprints/handoff-extension-hook-protocol.md`
draft (it slotted `harness/` next to `Workspace`; under 006 the harness
layer *is* the central thing). That blueprint must be rewritten on top of
the new shape and lands as a downstream slice after 006.

Rename surface, all moving together in slice 1:

- Class / module: `Workspace` → `Harness`, `WorkspaceOrchestrator` → `HarnessOrchestrator`,
  `WorkspaceMcpHub` → `HarnessMcpHub`, `ManagedWorkspace` → `ManagedHarness`,
  `WorkspaceRegistry` → `HarnessRegistry` (collides with the existing
  daemon-level `HarnessRegistry` from DESIGN.md — they unify; the daemon
  `HarnessRegistry` was always meant to hold Harness instances, never types).
- Event type: `WorkspaceEvent` → `HarnessEvent` (the misnomer the reviewer
  caught — the event stream belongs to every Harness, not Workspace
  specifically).
- HTTP routes: `/workspaces/...` → `/harnesses/...`.
- CLI: `aw workspace ...` → `aw harness ...`.
- Web UI labels and JSONL file paths follow the rename.
- Design docs updated together: `DESIGN.md` sub-scope table, top-level
  diagram, Modules section, Key Mechanisms wording; `design/packages/workspace.md`
  becomes `design/packages/harness.md` covering the universal substrate;
  a new `design/packages/harness-types/coordination.md` (or sibling) covers
  the `MultiAgentCoordinationHarnessType` content. Decision 005's text
  about `WorkspaceHarness` is revised to read "the Harness with the
  coordination type" without invalidating its claims.

Per CLAUDE.md refactor posture: this lands fully — no `Workspace` aliases,
no transitional fields, no two competing shapes. The codebase reads as if
`Harness` was always the name.

## Cold review

Findings from an adversarial reviewer in a fresh context (subagent), with
in-line responses.

- **Completeness — `HarnessType` lifecycle (who registers, when, against
  which Harness, single vs composable) was unspecified, and its relation
  to the existing daemon `HarnessRegistry` was unclear.**
  *Fixed.* Recommendation now says: one HarnessType per Harness, fixed at
  construction from harness config; daemon's existing `HarnessRegistry`
  holds Harness instances, new `HarnessTypeRegistry` holds types. The
  pre-mortem's "gain a coding capability mid-task" hint was misleading —
  cross-type capability borrowing happens through cross-Harness collaboration
  (a manager Harness delegating to a coding Harness), not through one
  Harness instance changing type. The pre-mortem now reads consistently
  with single-type-per-instance.

- **Consistency — DESIGN.md still calls WorkspaceEvent stream and capability
  boundary `WorkspaceHarness`-specific; "WorkspaceEvent" name itself becomes
  a misnomer; orchestrator/registry/managed/HTTP/CLI rename surface was
  unaddressed.**
  *Fixed.* New Consequences section enumerates the full rename surface
  including `WorkspaceEvent → HarnessEvent`, the orchestrator/registry/
  managed renames, HTTP routes, CLI verbs, and the design-doc reorganization
  (`design/packages/workspace.md → harness.md` with a sibling for the
  coordination harness type's content).

- **Clarity — "universal substrate" was defined by enumeration, not by
  criterion; chronicle/timeline/status were called type-specific without
  justification when their *mechanism* feels universal.**
  *Fixed.* Recommendation now states the substrate criterion explicitly
  (every harness type wants it as mechanism + replacing it forces
  reinvention) and resolves the chronicle/timeline/status borderline by
  splitting mechanism (substrate) from content vocabulary (type-provided),
  same pattern as Track. Channels / inbox / channel bridge / telegram
  remain type-specific because they aren't projection-mechanisms — they're
  multi-agent-room intake surfaces a solo writing/personal Harness has no
  need for.

- **Scope — proposal bundles (a) rename, (b) substrate/type extraction,
  and (c) hook protocol; (c) has its own pending blueprint and should be
  separable.**
  *Partial fix.* Adoption only requires (a)+(b); they cannot split because
  rename without substrate cut produces a worse intermediate state
  ("Harness" that still bakes in coordination flavor — the exact thing
  we're fixing). The Consequences section now records that the in-flight
  hook-protocol blueprint is **invalidated** by 006 and the new (c)
  blueprint lands downstream after 006 adoption. So 006 unbundles (c) by
  deferring it, not by including it.

- **YAGNI — writing-harness / manager-harness examples are anticipatory;
  with N=1 implemented harness type, the substrate boundary is being drawn
  against hypotheticals; smaller first move (just rename) might be right.**
  *Defended.* Decision 005 names `TaskTrackingHarness` as the immediate
  next type and explicitly moves Task out of today's kernel — that move
  forces the question "what does TaskTrackingHarness inherit?" right now,
  not against a hypothetical. The substrate cut is concrete pressure, not
  speculation. The "rename only" smaller-first-move was already
  alternative #3 and rejected as cosmetics in the same Alternatives
  section the reviewer read; the YAGNI critique surfaces a real risk
  (boundary may be drawn slightly wrong with N=1) but the pre-mortem's
  promotion-to-substrate path is the planned correction mechanism. The
  writing-harness / manager-harness mentions in Context are illustrative
  for the General Line's "shapeable work environment", not roadmap items;
  Recommendation no longer leans on them.

## Outcome

Adopted 2026-05-10.

Design-layer changes landing alongside adoption (separate commit from code):
- `design/DESIGN.md` — sub-scope table, top-level diagram, Modules section, Key Mechanisms revised; `WorkspaceHarness` references replaced with "the Harness with the coordination type".
- `design/packages/workspace.md` renamed to `design/packages/harness.md`, rewritten to cover the universal substrate only.
- New `design/packages/harness-types/coordination.md` covers the `MultiAgentCoordinationHarnessType` content (channels, inbox, channel bridge, telegram adapter).
- Decision 005 text revised in place where it says `WorkspaceHarness`.
- The in-flight `blueprints/handoff-extension-hook-protocol.md` is deleted; the rewrite lands as a downstream blueprint after slice 1 (rename + substrate cut) ships.

Code changes deferred to slice 1 (a separate blueprint), per "design changes commit separately from code".
