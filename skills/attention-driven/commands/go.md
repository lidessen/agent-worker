# attention-driven:go

Daily entrypoint for work. Use this when the user wants to continue, start, or
orient a task and did not explicitly pick a narrower command.

## 1. Resume

If `goals/GOAL.md` exists:

- Read it.
- Read `goals/OPEN-STOPS.md` if present.
- Read recent entries from the active record file:
  - `goals/record.md`, or
  - the current monthly record if the project uses monthly records.
- Surface open STOPs before continuing.

If no goal artifacts exist, continue without forcing setup. Mention that goal
continuity is unavailable only if it matters to the task.

## 2. Name the Mainline

State briefly:

- the current principal tension, or `none visible`;
- which layer owns today's uncertainty: `goal`, `design`, `fact`, `reframe`,
  or `harness`;
- any secondary overlay, such as `fact` verification on a `design` blueprint.

Default output shape for ordinary work:

```markdown
Mainline: <the load-bearing 30% right now>
Route: <goal/design/fact/reframe/harness> (+ optional overlay)
Next move: <smallest useful correction> -> <observable check>
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
be wrong.

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

## 5. Close

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
