# Goal Reference

Goal is the direction and continuity layer.

## Artifacts

- `goals/GOAL.md`: stable compass. Changes rarely and only with explicit human
  confirmation.
- `goals/record.md` or `goals/record-YYYY-MM.md`: path history and session
  observations.
- `goals/OPEN-STOPS.md`: created only when multiple open STOPs need an index.
- `goals/stories/*.md`: optional interpretation for ambiguous criteria,
  tempting non-goals, or goal choices that need rationale.

## GOAL.md Sections

- General Line: one or two sentences describing success as a world-state.
- Success criteria: 2-5 falsifiable criteria with stable IDs.
- Invariants: constraints that must hold throughout the initiative.
- Non-goals: tempting wrong work, each with the reason it is out of scope.
- Revisions: deliberate changes with dates.

## Compass / Path Asymmetry

`GOAL.md` is the compass. Records are the path. The path mutates constantly:
what was tried, what worked, what failed, what changed this week. The compass
changes only when a criterion is the wrong measure or the General Line is
questioned by evidence.

If `GOAL.md` and the record change at the same rate, the project no longer has
a compass; it has a notebook.

## Permission Gradient

- `GOAL.md`: agent writes only at set time or explicit goal change; human
  approves each section or changed line.
- record: agent may append routine factual session records when observations
  and judgment are explicit. Ask first when the entry changes goal meaning,
  resolves a STOP, or asserts a controversial criterion verdict.
- `OPEN-STOPS.md`: agent may open/update the index when a STOP candidate is
  explicit. Human decides resolution.
- STOPs: agent surfaces; human decides whether to change path, change goal, or
  reject the agent's diagnosis.

The agent owns path movement and factual continuity. The human owns compass
changes. This prevents both "I'll write the goal later" and silent agent drift
without turning every record entry into an approval queue.

## Record Discipline

At session close, preserve the record when project convention or the user's
request expects durable continuity. If the session is interactive and ownership
is unclear, draft in chat before writing. A record entry should include:

- What I did.
- Observations.
- Criteria check with evidence for every ✓ or ✗.
- Judgment naming the principal tension and whether this is path-level,
  goal-level, or no change.

If no observation touched a criterion, mark it `unclear`. Do not write bare ✓
or ✗ verdicts.

Verdicts include time. Some criteria are true or false today; others are
trajectory claims toward a future date. Mark a trajectory `✓` only when evidence
shows it is on pace, and `✗` when evidence projects a miss. Optimism is not
evidence.

If a session is interrupted before a controversial record entry is confirmed,
append the draft with `[unconfirmed draft]` in the title. The next session
ratifies or revises it before continuing.

## STOPs

Type A: a criterion is failing now or predictably off track.

Type B: new evidence questions the General Line even if criteria are met.

STOPs are surfaced in chat and wait for human choice. They are not silently
logged and walked past.

## Stories

Stories interpret GOAL.md; they do not replace it. Create a story only when the
terse compass needs durable context. Story edits use paragraph-level human
approval.

Stories are topical synthesis, not chronological record. A record entry says
what happened; a story says what we now believe after absorbing many events.
Stories are mutable and paragraph-approved. GOAL changes are rarer and
line-approved.

## Structure Follows Need

Do not create every goal scaffold up front. A single `record.md` is enough until
volume hurts. Create `OPEN-STOPS.md` only when more than one open STOP needs an
index. Rotate monthly records only when one record becomes too long to scan.
`GOAL.md` is the exception: the compass is load-bearing from the start.

## Multi-Initiative Projects

A mature project rarely has a single project-level GOAL. The product compass
already lives elsewhere (PRD, roadmap), and the work that lands in the repo
is a stream of bounded initiatives: feature requests, migrations, redesigns.
Each initiative has its own short-lived compass and closes when criteria are
met.

For this shape, do not stuff every feature into `goals/`. Use a separate
top-level folder:

```
features/                 # or initiatives/; pick one and stay consistent
  <feat-a>/
    GOAL.md               # this initiative's General Line + criteria + Non-goals
    record.md
    OPEN-STOPS.md         # only when multiple open STOPs accumulate
  <feat-b>/
    ...
  _done/                  # archive closed initiatives here on close
    <feat-a>/
goals/                    # optional; only if a project-level compass exists
design/                   # shared across all initiatives
blueprints/               # shared pool, or nested (features/<name>/blueprints/) — pick one
```

Rules that stay the same:

- `design/` is shared. A feature only writes `design/decisions/NNN-*.md` when
  it actually changes system shape; most features don't.
- `harness/` (CLAUDE.md managed block) is shared.
- Each feature's `GOAL.md` follows the same compass / path asymmetry: stable
  criteria, mutable record.
- Closing an initiative moves the folder under `_done/`. Do not delete; the
  record is still evidence for future work.

Adopt this layout only when you actually have multiple parallel initiatives.
A single active feature does not need a `features/` tree — a top-level
`goals/GOAL.md` is simpler.

## With Other Layers

- Design changes that cross module boundaries need a design decision even when
  they resolve a goal STOP.
- Fact observations make goal verdicts credible.
- Reframe may question the General Line when the category itself shifts.
