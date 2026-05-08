# goal-driven:close — Project closure and retrospective

When a goal-driven initiative ends — achieved, abandoned, or superseded
by a different goal — run this command. It captures what was learned,
records the final state in GOAL.md, and archives `goals/` so the
material survives without being mistaken for active work.

If `goals/GOAL.md` doesn't exist, stop and ask whether the human meant
something else.

## Three end states

- **Achieved** — criteria met (or close enough that the human declares
  success). Common case.
- **Abandoned** — work stopped without meeting criteria. The reason
  matters and goes into the retrospective.
- **Superseded** — a Type B STOP led to a different goal taking the
  initiative's place. The new goal is the successor; this one is
  archived but referenced.

The end state is the human's call, not the agent's. Confirm in chat
before doing anything else.

## Steps

### 1. Read the full state

Load:
- `goals/GOAL.md` (compass + Revisions history)
- The full record (or all monthly records if rotated)
- `goals/OPEN-STOPS.md` if present

For long-running projects, the full record can be substantial. Skim
for the major beats: kickoff, pivots, resolved STOPs, biggest entries.
The retrospective is a synthesis, not a transcript.

### 2. Draft the retrospective

Compose a retrospective entry **in chat** — same protocol as any
record entry, evidence-based, no naked claims. Suggested structure:

```markdown
## YYYY-MM-DD — Retrospective (close: <achieved | abandoned | superseded>)

### Path actually walked
One paragraph or short bullets — what direction did the project actually
go through? Pivots, dead ends, the line that worked.

### Criteria final state
For each criterion in GOAL.md (including retired ones), the final
verdict with evidence:
- C1 ✓ achieved (final number, vs target)
- C2 ✗ not met (final number, why)
- C3 retired before completion (date and reason)

### Invariants
Any violations during the project, with context. If all held: say so.

### Open STOPs at close
If any STOPs are still open at close: list them. Closing a project
with open STOPs is allowed, but the retrospective should note why
they were left unresolved (e.g., "out of scope for the abandoned
direction").

### Most-important lesson
One paragraph — what would future-you do differently? Concrete enough
that a similar future project could benefit from it. If you can't
name a concrete lesson, the retrospective isn't done; keep thinking.

### Successor (if superseded)
The goal that takes this one's place. Reference by file path or by
the `/goal-driven set` invocation that produced it.
```

Get human confirmation before writing. Edit until they say yes.

### 3. Update GOAL.md

Append to the Revisions section:

```
- YYYY-MM-DD: project closed (<state>). See retrospective in record.
```

Add a status line at the top, near the north-star paragraph:

```
**Status:** closed (<state>) on YYYY-MM-DD
```

Don't delete content. The closed GOAL.md is a historical record.

### 4. Append the retrospective entry

Write the retrospective entry as the final entry in the current record
file (or in a new month's file if the close happens at month boundary).

If `OPEN-STOPS.md` exists with unresolved entries: leave it. The
retrospective already noted them; OPEN-STOPS is a working index, and
the historical fact that they were open at close is captured in the
retrospective itself.

### 5. Archive

Move the entire `goals/` directory to
`goals-archive/<short-project-name>-YYYY-MM/`. Pick a short, descriptive
name (`newsletter-2026-Q3`, `semantic-search-v1`, `rust-cli-learning`).

If the project shared `goals/` with parallel projects (rare — most
projects get their own `goals/`): only archive the closing files,
not the others. Use judgment; surface ambiguity to the human.

### 6. Commit

One commit, clear message: `goal-driven: close <project-name> (<state>)`.

### 7. Tell the human what's next

- The project is archived. New work shouldn't write to the closed files
  in `goals-archive/`.
- If a successor goal exists: confirm it has its own active `goals/`
  directory (run `/goal-driven set` if not).
- If nothing follows, the slot is empty — this is a normal end state,
  not a failure of the skill.

## When close is wrong

Don't close just because the project paused. Close is for terminal
states; pauses go into the record as ordinary entries (e.g.,
`## YYYY-MM-DD — Pausing for ~6 weeks`). Closing and re-running `set`
on resumption loses the audit trail.

Don't close to escape an inconvenient STOP. If a STOP is open and the
project hasn't reached a terminal state, close is rationalization. The
honest path is to resolve the STOP — even if resolution is "I decided
to abandon" — and only then close as `abandoned` with the resolved
STOP cited.
