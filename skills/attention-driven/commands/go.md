# attention-driven:go

Daily entrypoint for work. Use this when the user wants to continue, start, or
orient a task and did not explicitly pick a narrower command.

## 1. Resume

Pick exactly one source of compass, in this order:

1. **User named a feature** (e.g. `go feat-a`): resume only
   `features/feat-a/GOAL.md`, `features/feat-a/record.md`, and
   `features/feat-a/OPEN-STOPS.md` if present. Skip every other GOAL.
2. **`goals/GOAL.md` exists**: this is the project compass. Resume it. If
   `features/*/GOAL.md` also exist, list active feature names (one line
   each) as available context but do not load their records.
3. **Only `features/*/GOAL.md` exist** (multi-initiative project, no
   project compass):
   - If exactly one active feature (a `GOAL.md` not under `_done/`),
     resume it.
   - If multiple active features and the call is interactive, list them
     and ask which to resume. Do not load every feature's record.
   - If multiple active features and the call is non-interactive (loop,
     hook, agent-to-agent), do not block. Skip resume, state "multiple
     active features; name one to resume," and continue to Name the
     Mainline using whatever context the caller already supplied.
4. **No goal artifacts anywhere**: continue without forcing setup. Mention
   that goal continuity is unavailable only if it matters to the task.

When resuming, also read `OPEN-STOPS.md` for the selected compass if
present, and surface open STOPs before continuing.

For monthly records, use the current `record-YYYY-MM.md` if the project
rotates records; otherwise use the flat `record.md` next to the resumed
GOAL.

## 2. Name the Mainline

State briefly:

- the current principal tension, or `none visible`;
- which layer owns today's uncertainty: `goal`, `design`, `fact`, `reframe`,
  or `harness`;
- who owns the next decision if it is not obvious: `agent`, `reviewer`, or
  `human`;
- any secondary overlay, such as `fact` verification on a `design` blueprint.

Default output shape for ordinary work:

```markdown
Mainline: <the load-bearing 30% right now>
Route: <goal/design/fact/reframe/harness> (+ optional overlay)
Next move: <smallest useful correction> -> <observable check>
```

If decision ownership is the uncertain part, add:

```markdown
Decision owner: <agent/reviewer/human>; reason: <reversibility / review risk / escalation gate>
```

If the task crosses multiple layers, repeatedly failed, or asks to import or
adjust a working method, first name one extra line:

```markdown
Steering object: <what is being steered>; primary metric: <what this correction optimizes>
```

Use the primary metric to choose the "smallest" correction. Smallest can mean
least risky, fastest to observe, cheapest to reverse, best for continuity, or
clearest to the user, depending on the work.

Use `references/routing.md` when classification is ambiguous. Use
`references/control-loop.md` when the next action is unclear because
observations are noisy, the same gap recurs, or the current understanding may
be wrong. Use `references/decision.md` when decision ownership is the blocker.

Only use the full stuck frame when work is noisy, recurring, blocked, or not
converging:

```markdown
Stuck frame:
- Target:
- Observed gap:
- Likely disturbance or wrong assumption:
- Smallest correction:
- Next check:
```

Keep the stuck frame short. It is scratch by default and becomes durable only
when it is the load-bearing 30%.

## 3. Route

- `goal` -> use `commands/goal.md`.
- `design` -> use `commands/design.md`.
- `fact` -> use `commands/fact.md`.
- `reframe` -> use `commands/reframe.md`.
- `harness` -> use `commands/setup.md` or `commands/audit.md`.

Load only the selected command and references it asks for.

## 4. Work

Follow the selected layer. Do not force a full phase sequence if the work is
small. Do preserve the durable artifact when the task crosses an artifact
boundary:

- goal criteria/STOP -> goal record or GOAL edit protocol;
- shape change -> design decision and DESIGN update;
- non-trivial execution -> blueprint;
- progress claim -> fact evidence;
- context wiring -> managed setup block.

For ordinary choices inside the current goal/design, decide and act. Use a
reviewer role when the choice is uncertain but recoverable. Ask the human only
when an escalation gate is hit: goal/STOP change, authority gap, value judgment,
irreversible cost, external exposure, or system-shape risk.

## 5. Close

Do not stop in a half-applied state. Before ending a work session, close the
smallest active loop:

- done slice: correction applied, observation captured, claim stated honestly;
- handoff slice: work paused at a coherent boundary, current state and next
  check recorded in a durable artifact;
- blocked slice: blocker, failed observation, and required human/authority
  decision surfaced.

Do not claim done without evidence. Do not commit, publish, or hand off work
whose verification story is still implied. For long tasks, shrink the slice
until one of the three close states is true.

When autonomous decisions matter to future work, summarize the choice and
evidence. Do not ask the human to ratify reversible choices after the fact; ask
only for unresolved human-owned decisions.

If goal artifacts exist and this was a work session, draft a record entry in
chat before writing:

```markdown
## YYYY-MM-DD — <short title>
- What I did: ...
- Observations: ...
- Criteria check: C1 unclear (...), C2 ✓ (...), ...
- Judgment: <principal tension>; <path-level / goal-level / no change>.
```

Every ✓ or ✗ needs a session-local observation. If no observation touched a
criterion, mark it `unclear`.
