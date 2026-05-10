# Artifact Policy

Attention-driven artifacts exist to preserve the 30% that future agents and
humans need to stay aligned. They are not a complete transcript of thinking.

## The 30/70 Rule

This is the core law of attention-driven work: hold the important 30% tightly and
give the remaining 70% room. Most attention should go to the principal
contradiction: the slow-changing choice that determines the shape of the rest.

Capture the 30%:

- Goal compass, success criteria, invariants, STOPs.
- Current system shape, module boundaries, key mechanisms, non-goals.
- Active execution plan when a task is too large to finish safely from
  chat alone.
- Falsifiable observations that support or reject progress claims.
- Project harness wiring that affects how future agents operate.

Leave the 70% flexible:

- Local execution strategy.
- Function names, helper layout, internal data structures, or equivalent local
  detail.
- Test style details as long as the evidence is real.
- Exact prose shape inside non-load-bearing historical records.

## Attention Allocation

The principle is asymmetric:

- Spend roughly 70% of attention on the 30% that forms the skeleton.
- Spend roughly 30% of attention on the remaining 70% of execution detail.

The 70% side is close to fire-and-forget: do it, verify the relevant claim, and
move on. Do not over-optimize wording, local structure, or historical neatness
when the skeleton is sound.

## Same Pattern Across Layers

- `goal`: record the compass and the output that matters; leave path tactics
  flexible.
- `design`: preserve shape through design and blueprint; leave local execution
  details free inside the boundary.
- `fact`: preserve the observation that proves or falsifies the claim; leave
  the proof form flexible.
- `reframe`: preserve the primitive skeleton; let projected flesh change.
- `harness`: preserve entry context and routing; let command mechanics evolve.

This also applies when maintaining attention-driven instructions. Improvements
to commands, setup, or wording are execution-level changes. They must not
disturb the core method.

## Steering Artifact Test

An artifact earns its keep when it improves local steering:

- target: what should be true;
- system shape: what assumption matters;
- observation: what is currently seen;
- gap: what difference matters;
- correction: what change will be applied;
- next check: how we will know whether the gap shrank.

If an artifact records none of these, it is probably ceremony. If an artifact
records all of them, keep it even if the prose is rough.

Artifacts also have loop speed. Slow-loop artifacts (`GOAL.md`, `DESIGN.md`,
managed setup blocks) should change rarely and deliberately. Fast-loop artifacts
(tests, traces, State notes) can change often. Do not promote fast-loop noise
into slow-loop state without repeated evidence.

Use artifacts as working memory. A good artifact lets the next agent recover
the target, current shape, latest observation, and next correction without
replaying the whole session. It does not need to preserve every local tactic.

## Current State Over Perfect History

`GOAL.md`, `design/DESIGN.md`, active blueprints, open STOPs, and managed
instruction blocks are current-state artifacts. Keep them accurate.

Records, adopted/rejected decisions, closed blueprints, closed concepts, and
old review notes are historical artifacts. Do not rewrite them just to make the
past look consistent. If they misled current work, add a new record, decision,
blueprint, or correction note that supersedes them.

## Stop State

Do not leave work in an ambiguous middle state. Every session should stop at one
of three states:

- Closed: the slice is complete, evidence exists, and the claim matches the
  evidence.
- Handoff: the slice is intentionally paused at a coherent boundary, with
  current state, next action, and next check recorded.
- Blocked: the blocking fact, missing authority, or required decision is named.

For code this may mean tests run and changes committed or an explicit handoff
note. For design it may mean a proposal is ready for review or the unresolved
question is named. For writing or research it may mean the current synthesis and
next source/check are recorded. The form varies; the loop must be closed.

## Artifact Selection

- Use a goal record when the important fact is "what happened and what it means
  for the goal."
- Use a design decision when the important fact is "the system shape changed or
  was deliberately not changed."
- Use a blueprint when the important fact is "this task needs a durable plan,
  resumable state, and verification criteria."
- Use fact evidence when the important fact is "this claim was observed and
  could have failed."
- Use setup/audit artifacts when the important fact is "future agents should
  enter with different context."

## Burden Rule

If maintaining an artifact becomes more work than the alignment it preserves,
shrink the artifact. The correct response is not more ceremony; it is a smaller
load-bearing skeleton.
