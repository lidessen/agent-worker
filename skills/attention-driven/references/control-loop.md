# Control Loop

This reference localizes the engineering-cybernetics lens into attention-driven
work. It is not a sixth layer, command entrypoint, or required artifact. Use it
when work is noisy, recurring, blocked, or when a working method is being
imported or adjusted for a project.

The point is not to make the skill mathematical or to carry control theory
vocabulary into daily work. The point is to borrow the operating principle:
define what is being steered, observe deviation, apply a bounded correction,
reject disturbance, and keep the work stable under uncertainty.

Attention-driven exists to engineer forward motion across many kinds of work:
code, design, writing, research, project steering, and agent setup. Treat the
work itself as the controlled system.

## Engineering-Cybernetics Reading

Use this reading of engineering cybernetics:

- It is about controlled or guided systems with direct engineering use.
- Its core problems are analysis, design, and uncertainty.
- It does not assume the system to be controlled is fully known.
- It expects properties, requirements, and disturbances to change during
  operation.
- It values feedback because open-loop planning cannot keep a changing system
  on target by itself.

In attention-driven, "engineering" means a repeatable way to move work toward
a target under imperfect knowledge. The target may be code, design, writing,
research, or a project harness.

Do not expose the source vocabulary unless it helps. In normal attention-driven
work, say `target`, `current shape`, `observation`, `gap`, and `correction`
rather than `reference signal`, `plant`, `sensor`, `error`, and `actuator`.
Those source terms are scaffolding for understanding, not the user-facing form
of the skill.

## Learning And Localization

When learning from engineering cybernetics, another methodology, or a mature
project, do not copy the surface form first. Learn the operating principle:
what problem it solved, what variables it cared about, what feedback it trusted,
and what disturbances it was built to survive.

Then localize it:

1. Name the local control problem.
2. Identify the principle that transfers.
3. Drop source-specific ceremony that does not reduce the local gap.
4. Translate the principle into the smallest local artifact or action.
5. Observe whether the translated form improves control.

This is concrete analysis, not template adoption. A borrowed form that does not
fit the local system is a disturbance, not a method. Understanding means the
agent can explain the principle in local terms, modify it without losing its
force, and use it without carrying the old vocabulary everywhere.

For major method imports into a project, use `references/control-review.md`
instead of relying on one perspective.

## Localized Stack

The merged skill is one steering entrypoint with several responsibilities:

| Responsibility | Layer | Question |
| --- | --- | --- |
| target keeping | goal | What should the system approach, and what counts as enough? |
| shape modeling | design | What system are we steering, where are its boundaries, and which mechanisms matter? |
| observation | fact | What check can detect the state or the gap? |
| correction | execution/design/setup | What change can actually move the system? |
| disturbance handling | fact/design/goal | What external or hidden force keeps moving the state away from target? |
| lens replacement | reframe | Is the old category unable to describe or guide the work? |
| continuity wiring | harness/setup | Will the next agent enter with enough authority and context to keep going? |

Do not flatten these into equal documents. The route depends on which
responsibility is failing right now.

## Engineering Work As Steered Work

Before acting, define the local steering problem:

- Boundary: what system is being steered, and what is outside the system.
- State variables: what must be true for the work to be healthy.
- Target: what state the work is trying to approach.
- Primary metric: what this correction optimizes now: correctness,
  convergence speed, maintainability, continuity, reversibility, or user
  understanding.
- Observation: how the agent knows the current state.
- Gap: which difference matters most now.
- Control authority: what actions the agent/human can actually take.
- Disturbances: what can move the system without being chosen.
- Settling condition: what observation means the loop can stop.

If any of these is missing, the work is not yet steerable. Do not compensate
with more effort; define the missing part.

If the target cannot be observed and current actions cannot change it, do not
begin execution. Route to fact, goal, or harness until the work is steerable.

`Current shape` is local:

- Code: module boundaries, call path, and runtime state.
- Writing: argument skeleton and evidence distribution.
- Research: working hypothesis, unknowns, and source coverage.
- Project steering: target, blockers, authority, and cadence.

The 30/70 rule is the bandwidth rule for this steering posture. Put high
attention on the slow variables that dominate future behavior: target, system
shape, observation quality, and authority. Use lower attention for local
corrections that can be retried cheaply.

## Loop

Use this loop when work feels noisy, recurring, or hard to steer:

1. Name the target.
2. Name the current observation.
3. Name the gap.
4. Choose the smallest correction that can reduce the gap.
5. Apply it inside the current 30/70 boundary.
6. Observe again before declaring convergence.
7. Stop only at a closed, handoff, or blocked state.

Do not optimize the correction before you know the gap. Do not change the goal
when one correction failed once. Do not keep applying the same correction when
the gap is not shrinking.

Smallest means smallest relative to the primary metric. It may be the fastest
check, the least risky change, the most reversible probe, the clearest user
signal, or the correction that best preserves continuity.

Stopping is part of control. A session that ends after applying a correction but
before observation leaves the next agent in an unstable state. If the full task
is too large, close a smaller loop and record where control resumes.

## Multi-Rate Control

Different layers run at different speeds. A stable workflow keeps them
separated:

| Loop | Speed | What changes | Artifact |
| --- | --- | --- | --- |
| goal | slow | target, criteria, STOPs | `GOAL.md`, records |
| design | medium | system shape, boundaries, mechanisms | `design/`, decisions, blueprints |
| fact | fast | observations, gap checks | tests, traces, review findings |
| execution | fastest | local correction choices | code, prose, commands |
| reframe | rare | category/lens replacement | concepts |
| harness | slow | continuity context and authority | instruction blocks, hooks |

Do not let fast-loop noise rewrite slow-loop state. A failed test usually
changes code or fact checks, not the goal. Repeated fast-loop failure can
escalate to design. Repeated design failure can escalate to goal or reframe.

## Feedforward And Feedback

Good work uses both:

- Feedforward: blueprint, plan, design decision, setup instruction. It chooses
  a correction before the next observation.
- Feedback: fact evidence, record entry, audit finding, user response. It says
  whether the correction reduced the gap.

Feedforward without feedback becomes fantasy planning. Feedback without
feedforward becomes thrashing. Keep the pair small: one intended correction,
one observation that can confirm or reject it.

This is why a blueprint is not the same thing as evidence. A blueprint is
the intended correction. A test, trace, review finding, or user response is
the observed result. A record entry is the memory that lets the next loop
compare target, action, and observation without rediscovering the path.

## Observing And Changing

If a state cannot be observed, route to `fact` and improve the observation before
arguing about progress. If a state cannot be changed by available actions, route
to `goal` or `harness`: either redefine the target, acquire authority, or admit
the system is outside this workflow's control.

Common failures:

- Unobservable goal: "make it better" without a criterion or proxy.
- Unobservable design: boundary words with no code path to inspect.
- Unobservable done: no test, trace, capture, or review signal.
- Uncontrollable plan: depends on resources, permissions, or humans the agent
  cannot influence.

## Model Identification

When the system does not respond as expected, the model may be wrong. Run a
small identification step before another correction:

- What did we assume about the system?
- Which observation contradicted that assumption?
- Is the mismatch local behavior, system shape, category model, or goal target?
- What is the smallest experiment or audit that distinguishes those cases?

In attention-driven terms, identification often appears as fact isolation,
design audit, reframe stress test, or goal review.

Identification should usually be smaller than redesign. First isolate which
assumption failed; only then change the durable model.

Hard trigger: if the same correction fails twice without shrinking the gap, stop
applying more force. Identify the failed assumption before continuing:

```markdown
Assumption:
Contradicting observation:
Smallest distinguishing check:
```

## Disturbance Rejection

A disturbance is not just "something went wrong." It is a force that moves the
system away from target while the work is being steered:

- requirement changes while implementation is underway;
- stale design docs keep new agents steering from an old model;
- flaky tests make the observation unreliable;
- missing permissions make an intended correction unavailable;
- context loss makes the next agent lose prior observations;
- local polish consumes bandwidth meant for the principal 30%.

Handle disturbances by making them observable and bounded. Record the one that
matters, choose the smallest rejection mechanism, and verify that the gap
shrinks. Do not build a general anti-disturbance framework unless repeated
observations prove the disturbance is structural.

## Stability Before Cleverness

Prefer changes that make the next observation clearer. A clever action that
changes many variables at once may look efficient but destroys feedback quality.

Stable attention-driven work has these properties:

- the target is explicit;
- the observation is falsifiable;
- the correction is local enough to attribute effect;
- the loop has a stopping condition;
- large uncertainty triggers adaptation rather than blind persistence.

## Failure Modes

- Oscillation: repeatedly switching strategy because each observation is read as
  a goal-level signal. Fix by separating fast and slow loops.
- Overshoot: a broad rewrite when a local correction would reduce the gap. Fix
  by choosing the smallest correction first.
- Drift: many small local fixes move the system away from the target. Fix by
  checking records/design against the target.
- Observation lag: decisions use stale observations. Fix by refreshing facts
  before acting.
- Observation noise: conflicting observations get averaged into vague
  confidence. Fix by isolating the check.
- Observation too slow: the work changes faster than facts arrive. Fix by
  shortening the loop or reducing correction size.
- Correction saturation: the available action cannot move the gap. Fix by
  changing authority, scope, or target.
- Integral windup: accumulated unresolved follow-ups make the next correction
  too large. Fix by pruning or re-slicing pending claims.
- Over-control: too much artifact ceremony for a small gap. Fix by shrinking
  the artifact.

## Escalation Handling

Treat uncertainty as normal. When the system behaves differently from the model,
do not just push harder:

- if observations are noisy, improve the observation (`fact`);
- if the target is wrong, surface a STOP (`goal`);
- if the system shape is wrong, open a decision (`design`);
- if the category model is wrong, reframe (`reframe`);
- if the agent lacks context, fix setup (`harness`).

## Robustness

Prefer steering forms that keep working under common disturbances:

- goal records tolerate interrupted sessions;
- design docs tolerate new agents by naming boundaries;
- blueprints tolerate context loss through State;
- fact evidence tolerates skepticism because it can be rerun;
- setup blocks tolerate tool differences by pointing to durable artifacts.

Robustness is not extra ceremony. It is the minimum structure that keeps the
work stable when the agent, context window, requirements, or observations
change.

## Steering Snapshot

For tangled work, write a short snapshot before acting:

```markdown
Steering snapshot:
- System:
- Target:
- Observation:
- Gap:
- Disturbance:
- Smallest correction:
- Next check:
- Escalation if gap does not shrink:
```

This is scratch unless it becomes the load-bearing 30%. Promote it only if a
future agent needs it to continue.

## Translation Appendix

This table is for translation, not for template copying. Keep these source
terms out of daily entrypoints unless they clarify a hard problem.

| Control concept | Attention-driven concept |
| --- | --- |
| controlled system | the project, initiative, codebase, article, or agent workflow being steered |
| desired state / reference | target, goal criterion, design invariant, accepted shape, or done claim |
| sensor | observation source: record entry, test, trace, audit, user feedback, review finding |
| error | gap between target and observed state |
| controller | attention allocation: where the agent/human should act next |
| actuator | correction: code change, design decision, goal STOP, fact check, setup update |
| disturbance | changing requirements, model error, stale docs, flaky tests, missing context |
| stability | repeated work converges instead of oscillating between rewrites |
| adaptation | update the steering model when system properties were assumed wrong |

## Source Notes

The lens is inspired by H. S. Tsien's *Engineering Cybernetics* and later
summaries that frame it around engineering applications, analysis, design,
uncertainty, feedback, and systems with changing properties. Keep this as a
working abstraction, not a claim that the skill implements formal control
theory.
