# Harness Reference

Harness is the context and lifecycle layer: how a project teaches agents to work
without bloating every prompt.

## Context Layers

- L1: always-present orientation, such as `CLAUDE.md`, `AGENTS.md`, skill
  metadata, and key project invariants.
- L2: activated working context, such as skill bodies, design docs, blueprints,
  and plans.
- L3: on-demand implementation detail, such as code, scripts, examples,
  fixtures, and large references.

Keep L1 small and stable. Move volatile details to L2/L3.

Most harness problems are layer violations: L3 details pollute L1, or L1 lacks
the small orientation needed for judgment. `CLAUDE.md` / `AGENTS.md` are L1
anchors; every line should change agent decisions or point to lower-layer
context.

## Artifact Lifecycle

Agents are ephemeral. Continuity lives in artifacts:

- goal records for why and trajectory;
- design docs for shape;
- blueprints for resumable task state;
- fact evidence for trust;
- setup blocks for future agent entry.

Design for succession, not persistence. Do not try to make one agent live
forever; make artifacts good enough that the next agent can continue. Raising
abstraction level extends effective lifecycle: L1 spans the project, L2 spans a
task or design slice, L3 lives inside execution.

## Harness Problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Agent loses architecture | L1 missing shape | Add pointer to design or concise boundary rule. |
| Agent drowns in context | L1 contains L3 detail | Move detail to references or code. |
| Agent breaks boundaries | no design source | Add or refresh design docs. |
| Agent repeats a mistake | missing durable rule | Add setup block, hook, or reference. |

## Setup Principle

Instruction files should point to durable artifacts, not duplicate them. Prefer
"read `design/DESIGN.md`" over copying design contents into `CLAUDE.md`.

## Finite Human Bandwidth

Agent output can scale faster than human review. Outputs intended for human
review should be skeleton-grade: surface the 20-30% whose failure invalidates
the rest, and make details collapsible or cheap to replace. If must-review
volume grows linearly with agent output, the harness is preparing the human for
review failure.

The same applies to decisions. A good harness maximizes agent initiative inside
accepted boundaries: routine choices are made by the agent, uncertain 70%
choices can be checked by a reviewer role, and only the principal decisions
reach the human. Escalation is for authority, values, irreversible cost, goal
change, or system-shape risk, not for every choice the agent could make.
