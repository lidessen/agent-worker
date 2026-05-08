# reframe:close — Concept closure and retrospective

When a concept document reaches a terminal state — skeleton settled
and ready to graduate to architecture, abandoned because the reframe
didn't pay off, or superseded by a different framing — run this
command. It captures what was learned, marks the document closed,
and moves it under `concepts/archive/` so the workspace stays focused
on active explorations.

If `concepts/` doesn't exist or contains no document matching the
target, stop and ask whether the user meant something else.

## Three end states

- **Settled** — the skeleton holds, both stress tests (Phase 4) and
  comprehension tests (Phase 7) pass, the concept is ready to
  graduate into the project's architecture (e.g. fold into
  `design/DESIGN.md`). Most common.
- **Abandoned** — the reframe didn't pay off; the team decided the
  traditional shape was the right answer for this domain. The
  reasoning matters and goes into the retrospective.
- **Superseded** — a different framing took over (different
  paradigm, different essence). The new concept is the successor;
  this one is archived but referenced.

The end state is the user's call, not the agent's. Confirm in chat
before doing anything else.

## Steps

### 1. Identify the target

If the user named a target, find `concepts/<slug>.md`. If not, list
all active concept documents (frontmatter `status: active`) and ask
which to close.

### 2. Read the full document

Load the entire file. Skim for the major beats: essence iterations,
skeleton versions, stress test outcomes, transfer log entries,
comprehension test outcomes, open tensions. The retrospective
synthesizes — it doesn't transcribe.

### 3. Draft the retrospective

Compose a retrospective entry **in chat** before writing it. Suggested
structure:

```markdown
## Retrospective — YYYY-MM-DD (close: <settled | abandoned | superseded>)

### Path actually walked
One paragraph. From initial essence to final skeleton — the major
pivots, dead ends, the version that worked.

### Skeleton, final form
The skeleton as it stands at close. Cite the version (e.g. v3) and
which primitives load-bear which essence functions.

### Stress test verdict
For each crutch removed during testing: did the skeleton hold?
Where did it bend? Where did it concede (i.e. functions that stay
traditional — the boundary of the reframe)?

### Comprehension verdict
What evidence shows users can navigate the projected flesh? Cite
specific Comprehension Tests entries. If users struggled, which of
the three feedback paths (flesh / skeleton / essence) was walked,
and what changed as a result?

### Lessons
One or two paragraphs. What would future-you do differently? What
generalizes beyond this concept? Concrete enough that a similar
future reframe could benefit. If you can't name a concrete lesson,
the retrospective isn't done; keep thinking.

### Open tensions at close
Anything unresolved. For settled closures these should be minor; for
abandoned/superseded closures they explain why this reframe didn't
finish.

### Successor (if superseded)
The concept document that takes this one's place, by file path.
```

Get user confirmation before writing.

### 4. Append the retrospective to the document

Add the retrospective as the final section of the concept document
(after `## Open Tensions`, before any session log). Don't delete
prior content — the closed document is a historical record, valuable
for "why did we end up with this shape?" questions later.

### 5. Update frontmatter

Flip `status: active` → `status: closed` and add a `closed:` field:

```yaml
---
target: AI-native CRM
paradigm: AI-native
status: closed
opened: 2026-05-08
closed: 2026-09-12
end_state: settled       # settled | abandoned | superseded
---
```

### 6. Move to archive

Move the file from `concepts/<slug>.md` to
`concepts/archive/<slug>.md`. Keep the slug — no renaming. The
archived path is now the historical reference; any cross-link from
DESIGN.md or future concept docs should point there.

### 7. Graduate the skeleton (settled state only)

If `end_state: settled`, the skeleton is ready to enter the
project's architecture layer. Two follow-up moves, on the user's
preference:

- **Fold into design-driven** — add the skeleton's load-bearing
  shape to `design/DESIGN.md` (or write a `design/decisions/NNN-*.md`
  proposing the architectural change). Reference the archived
  concept document as historical context.
- **Generate a blueprint** — if implementation can start now, write a
  `blueprints/<feature>.md` whose Verify section anchors to the
  skeleton's stress-test outcomes.

For abandoned or superseded closures, skip this step.

### 8. Commit

One commit, clear message: `reframe: close <slug> (<end_state>)`.

### 9. Tell the user what's next

- The concept is archived; future work shouldn't write to files in
  `concepts/archive/`.
- If `end_state: settled`, confirm the skeleton has been folded into
  architecture (or scheduled to be).
- If `end_state: superseded`, confirm the successor concept document
  exists and is `status: active`.
- If nothing follows, the slot is empty — a normal end state.

## When close is wrong

Don't close just because the reframe paused. Close is for terminal
states; pauses go into the document's session log as ordinary
entries. Closing and re-opening loses the audit trail.

Don't close to escape an unresolved tension. If a tension is open
and the concept hasn't reached a terminal state, close is
rationalization. The honest path is to resolve the tension — even
if resolution is "we decided this aspect stays traditional" — and
only then close.
