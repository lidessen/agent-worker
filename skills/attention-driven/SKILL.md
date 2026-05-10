---
name: attention-driven
description: Use go/setup/audit/goal/design/fact/reframe/close as the stable entrypoint for ordinary agent work. Use when starting or resuming work, changing system shape, recording progress, verifying claims, or closing work with a durable record.
argument-hint: "[go | setup | audit | goal | design | fact | reframe | close]"
---

# Attention-Driven

`attention-driven` is the stable entrypoint for agent work. It keeps one
mainline through durable artifacts instead of making the agent choose between
competing methodology skills.

## Core Law

Hold the load-bearing 30% and give the remaining 70% freedom. Spend most
attention on the slow-changing skeleton: the goal line, design shape, fact
claim, or reframe primitive that determines the rest. Treat the surrounding
execution detail as flexible and cheap to retry.

Apply the same rule to decisions. Maximize system agency for reversible and
local choices: make them, review them with another role when useful, verify the
claim, and move on. Escalate only the load-bearing 30% to the human: goal
changes, irreversible tradeoffs, authority gaps, value judgments, or decisions
whose failure would invalidate the rest.

Model work as something that can be steered: name the target, understand the
current shape, observe the gap, make the smallest useful correction, and look
again. If the gap does not shrink, improve the observation, change the
correction, reject the disturbance, or update the understanding instead of
pushing harder.

Keep loop speeds separate. Goals and harness setup are slow; design is medium;
fact checks and execution are fast. Fast-loop noise should not rewrite
slow-changing artifacts until repeated observations show the model is wrong.

Read the layer names as local steering responsibilities, not as phases:

- `goal` keeps direction and success criteria.
- `design` keeps the current system shape and boundaries.
- `fact` keeps observations that can prove or falsify claims.
- `reframe` changes the lens when the old category cannot guide the work.
- `harness` keeps project context wired so future agents can continue.

The same rule applies when maintaining attention-driven instructions. Command
names, artifact wording, and setup mechanics may improve, but those execution
improvements must not disturb the core method: find the principal 30%, preserve
it durably, and let the agent move freely inside it.

When learning from an external theory or method, absorb its operating principle
before borrowing its form. Localize it to the concrete problem, keep what
improves steering, and discard ceremony that does not reduce the current gap.

## Commands

When invoked with an argument, dispatch to the corresponding command file:

- `/attention-driven go` -> read `commands/go.md`.
  Daily entrypoint: resume context, identify the mainline, route to the
  smallest needed layer, and close with a record draft when goal artifacts
  exist.
- `/attention-driven setup` -> read `commands/setup.md`.
  Install or sync the project harness instructions and managed blocks.
- `/attention-driven audit` -> read `commands/audit.md`.
  Check drift across goal, design, fact, reframe, and harness artifacts.
- `/attention-driven goal ...` -> read `commands/goal.md`.
  Set, review, or maintain `GOAL.md`, records, STOPs, and stories.
- `/attention-driven design ...` -> read `commands/design.md`.
  Work on system shape, decisions, design bootstrap, and blueprints.
- `/attention-driven fact ...` -> read `commands/fact.md`.
  Add falsifiable verification discipline to execution work.
- `/attention-driven reframe ...` -> read `commands/reframe.md`.
  Redraw shape when the paradigm is unsettled.
- `/attention-driven close` -> read `commands/close.md`.
  Close a goal initiative or reframe concept.
- No argument -> behave like `go`.

## Layer Vocabulary

Use these names consistently:

- `goal`: why, how far, criteria, records, STOPs, principal tension.
- `design`: current system shape, boundaries, decisions, blueprints.
- `fact`: observations that can prove or falsify a progress claim.
- `reframe`: pre-design exploration when the category has no stable shape.
- `harness`: the project context, instructions, hooks, and artifact wiring
  that let future agents resume without rediscovery.

## Routing Rule

First ask: "What is the principal 30% right now?"

- Direction or success is unclear -> `goal`.
- System shape or module boundaries change -> `design`.
- A progress/completion claim needs proof -> `fact`.
- The shape cannot be stated because the paradigm is unsettled -> `reframe`.
- Agent context or project wiring is missing/stale -> `harness` via `setup`
  or `audit`.

Read `references/routing.md` for the full routing table when the task is
ambiguous.

## Artifact Rule

Preserve only the load-bearing 30% as durable artifacts: current goal plus
recorded output, design plus blueprint/execution direction, fact evidence,
reframe primitive, and setup wiring. Leave the 70% strategy flexible and mostly
fire-and-forget.

Do not ask the human to decide every local tradeoff. Use agent judgment and
agent review for ordinary 70% decisions; surface the few decisions that change
direction, authority, values, or system shape.

If an older decision, blueprint, record entry, or concept note was wrong, do
not repair history for its own sake. Correct the current artifact or create the
next one that supersedes it. Read `references/artifact-policy.md` before
editing durable workflow artifacts.

## Progressive Loading

Keep this file as the entrypoint. Load command files for actions and reference
files only when the command needs the detail:

- `references/goal.md` for goal/record/STOP/story semantics.
- `references/design.md` for 30/70 design, decisions, blueprints.
- `references/writing-guide.md` for design artifact prose.
- `references/fact.md` for falsifiability, TDD, evidence trails.
- `references/reframe.md` for reframe phases and closure.
- `references/harness.md` and `references/setup.md` for project wiring.
- `references/templates.md` for artifact templates.
- `references/control-loop.md` for the localized engineering-control lens:
  target, shape, observation, gap, correction, disturbance, stability, and
  adaptation.
- `references/control-review.md` for three-role dialectical review in
  research-like design/proposal work or method imports into a project.
- `references/migration-audit.md` for temporary notes recovered from the old
  split skills that have not yet earned a permanent home.
