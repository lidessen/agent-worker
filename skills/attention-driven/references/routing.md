# Routing

Attention-driven work starts by naming the principal 30%, not by selecting a
phase. Layers can run concurrently; route to the smallest layer that owns the
slow-changing question behind the current uncertainty.

## Mainline Table

| Question | Layer | Default action |
| --- | --- | --- |
| Why are we doing this? How far is enough? Are we off track? | goal | Read `GOAL.md` and recent records; surface STOPs before continuing. |
| What shape should the system have? Does this cross a boundary? | design | Read `design/DESIGN.md`; if shape changes, draft a decision before code. |
| How do we prove this claim works? | fact | Define falsifiable observations; prefer tests when behavior is deterministic. |
| What should this be when existing categories fail? | reframe | Strip to core functions, redraw the skeleton, then stress-test it. |
| Is the agent context/project wiring wrong? | harness | Run setup or audit; update managed instruction blocks. |

## Default Daily Route

`/attention-driven go` follows this sequence:

1. Read `goals/GOAL.md` if it exists.
2. Read the latest goal record entries and `OPEN-STOPS.md` if present.
3. Name the current principal 30% / principal tension, or say `none visible`.
4. Classify the user's task into one layer, with secondary overlays if needed.
5. Load only the command/reference files needed for that layer.
6. At close, draft a record entry if goal artifacts exist and this was a work
   session.

## Escalation Signals

- A task no longer serves a criterion -> goal STOP candidate.
- A task changes module boundaries, system mechanisms, or durable artifact
  ownership -> design decision candidate.
- A repeated bug is caused by shape, not implementation -> design candidate
  backed by fact evidence.
- A verification result contradicts a success criterion -> goal STOP candidate.
- An agent repeatedly loses context or violates project conventions -> harness
  setup/audit candidate.
- The design question itself sounds like old vocabulary forced onto a new
  category -> reframe candidate.

## Steering-Loop Routing

When the problem is not "which artifact?" but "why are we not converging?", use
the localized steering frame:

- unclear target -> `goal`;
- unclear system shape -> `design`;
- unclear observation or disputed gap -> `fact`;
- repeated disturbance from stale context or missing authority -> `harness`;
- wrong category lens -> `reframe`;
- repeated correction with no shrinking gap -> route upward instead of pushing
  harder at the same layer.
- no authority or permission to change the state -> `harness` to acquire
  context/authority, `goal` to narrow the target, or surface a blocker.

Respect loop speed. Fast execution errors route first to `fact` or local
implementation. Only repeated, evidenced fast-loop errors escalate to `design`.
Only repeated design/model failure escalates to `goal` or `reframe`.

The route should name the failed local responsibility, not just the document to
edit. Examples: "fact owns this because the observation is noisy"; "design owns
this because the system shape assumption is wrong"; "goal owns this because the
target is unobservable."

## When Gap Does Not Shrink

If the same correction fails twice, stop applying more force. Run a small
identification step:

```markdown
Assumption:
Contradicting observation:
Smallest distinguishing check:
```

Then route by what the check distinguishes:

- observation was wrong/noisy -> `fact`;
- local correction was wrong -> stay in execution;
- system-shape assumption was wrong -> `design`;
- target was wrong or unreachable -> `goal`;
- category lens was wrong -> `reframe`;
- authority/context was missing -> `harness`.

## Disturbance Handling

- One-off disturbance: handle locally and avoid durable ceremony.
- Repeated disturbance: record the pattern and route to the layer that owns it.
- Structural disturbance: change the durable shape, target, observation, or
  setup that allowed the disturbance to keep recurring.

## Explicit Overrides

If the user explicitly says `goal`, `design`, `fact`, `reframe`, `setup`, or
`audit`, honor that layer even if another layer might also apply. Still surface
blocking conflicts, such as an open STOP or an unapproved shape decision.
