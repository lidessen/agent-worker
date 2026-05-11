# Attention-Driven System Protocol

**Status:** adopted
**Date:** 2026-05-12

## Context

`skills/attention-driven/` is useful as an agent working method, but skill
text is not a strong enough control surface for the system we are building.
Prompt instructions can be forgotten, locally overruled by task pressure, or
lost when a runtime changes. The durable form of the method must live in the
harness protocol itself.

The short-term product goal is also easy to misread. `agent-worker` should
replace the user's daily need to open Claude Code or Codex directly, but it
must not try to clone those products. Claude Code and Codex are runtime
bindings. They are not the product shape.

The short-term target is the subset that sits in both sets:

- useful enough to replace the user's direct Claude Code / Codex entry point;
- necessary for the final harness system.

Everything outside that intersection is deferred, even if Claude Code or
Codex supports it.

## Decision

Adopt `attention-driven` as a system protocol, not only as an agent skill.

The product direction is:

> Short term: a work-entry replacement subset for Claude Code / Codex.
> Long term: an attention-driven harness system with self-awareness,
> self-adaptation, and self-organization.

This means the system optimizes for requirement intake, bounded Wake
execution, observation, recovery, verification, blocked-work handling, and
cross-runtime continuity. It does not optimize for complete CLI parity,
message-shaped chat parity, IDE parity, or reproducing each backend runtime's
native user experience.

## Protocol Pillars

### Self-Awareness

The system must know whether it is still advancing the goal. Awareness is not
"more logs"; it is structured state the harness can act on:

- current requirement / Wake / Handoff state;
- pending authorization and blocked work;
- active requirements and active agents;
- intervention counts and rescue signals;
- silent time, context pressure, failed extraction, and missing evidence;
- goal record criteria, STOP conditions, and monitor readings.

The monitor, EventBus, HarnessEvents, Wake/Handoff records, and goal records
are part of one awareness surface. A future implementation can split storage
or UI, but the semantic subject is the same: observable progress against the
current goal.

### Self-Adaptation

The system must change execution strategy when observations show the current
path is not converging. Adaptation is harness-owned and bounded by authority:

- switch runtime binding when the selected runtime is unavailable, weak, or
  context-constrained;
- split or shrink a requirement when a Wake stalls;
- route back from build to design, fact, or reframe when the gap is not an
  execution gap;
- continue unrelated Wakes while one requirement is pending authorization;
- request human input only at authority, value, irreversible, or goal/STOP
  boundaries.

Runtime bindings expose capability. They do not decide the work protocol.

### Self-Organization

The system must organize agents around the current requirement instead of
forcing a fixed workflow catalog. The stable substrate is Wake, Handoff,
HarnessEvent, Resource, Track projection, capability boundary, and runtime
binding. Roles, reviewers, parallel workers, fallback paths, and handoff
chains are generated from current state and policy.

This keeps the mechanism core small: the harness observes state, chooses the
next bounded Wake or review, commits evidence, and repeats. New roles or
workflows are acceptable only when they compile back to these mechanisms.

## Short-Term Scope Rule

For every proposed feature that resembles Claude Code / Codex behavior, ask:

> Does this serve both the short-term work-entry replacement and the long-term
> attention-driven harness?

If not, defer it.

In scope now:

- requirement intake;
- one bounded Wake through a selected runtime binding;
- event and monitor visibility;
- pending authorization and blocked-work state;
- Handoff / recovery across Wakes;
- evidence-backed completion;
- cross-runtime continuity through harness records, not backend session magic.

Out of scope for now:

- complete Claude Code / Codex CLI parity;
- replicating native chat UX;
- IDE feature parity;
- backend-specific interaction polish that does not strengthen the harness
  protocol;
- workflow catalogs that do not reduce to Wake / Handoff / Event / Resource /
  capability-boundary mechanisms.

## Consequences

- `attention-driven` skill text remains useful as operator guidance, but the
  system should progressively move its durable parts into harness routing,
  monitor signals, decision ownership, verification gates, and recovery
  records.
- Future design reviews should reject "Claude Code does X, so we need X" as
  insufficient justification. The stronger justification is "X helps the work
  entry replacement and strengthens the eventual harness protocol."
- Implementation slices should prefer small vertical mechanisms that make the
  system more aware, adaptive, or self-organizing.
- Prompt-only enforcement is not enough for load-bearing behavior. If a rule
  matters to system shape, it needs a state transition, event, monitor metric,
  validation gate, or durable record.

## References

- `skills/attention-driven/` — current method entrypoint and routing language.
- `goals/GOAL.md` — project goal and C1-C4 monitor criteria.
- `design/DESIGN.md` — current harness/runtime architecture.
- `design/decisions/004-observability-monitor.md` — self-awareness monitor.
- `design/decisions/005-session-orchestration-model.md` — work-entry surface.
- `design/decisions/006-harness-as-agent-environment.md` — substrate +
  HarnessType boundary.
