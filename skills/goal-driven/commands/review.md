# goal-driven:review — Strategic checkpoint plus protocol maintenance

Two things at once: a strategic re-assessment of where the project
stands against GOAL, and a maintenance pass on the protocol's health.
The per-session loop is too close to the ground to catch slow drift in
either dimension; review is the regular zoom-out.

If `goals/GOAL.md` does not exist or is still a stub, stop and ask
whether the human meant `/goal-driven set` instead.

## When to run

- ≥ 2 weeks since the last review
- ≥ 30 new record entries since the last review
- The midpoint of an explicit project timeline (e.g., month 3 of a
  6-month initiative — don't wait for the end to find out you're off)
- A new agent picks up the project (sanity-check inherited state)
- The human says "things feel off" or "I'm not sure where we are"
- Before a major decision that depends on knowing where you actually stand

## Phase 1 — Strategic checkpoint

Read GOAL.md and the record in order. The point is to re-establish
situational awareness, not to find drift (that's Phase 2). Ask:

**Trajectory of each criterion.** For criteria with deadlines or pace
expectations, project current pace forward. Are we on track for the
date the criterion is supposed to land? Use the criterion's domain to
reason about expected curve shape (linear, S-curve, step), not just
linear extrapolation. Surface any criterion whose trajectory has
visibly diverged.

**Current principal tension.** Among active criteria, risks, and open
questions, which one dominates right now? Name it explicitly, even if
recent entries didn't. The principal tension shifts as a project moves
through phases — re-identify from current evidence.

**The implicit theory of getting there.** Most projects start with an
unstated theory ("if we ship 4 articles per week, organic growth
follows"; "if we get pgvector under 500ms, the feature is viable"). Has
the theory survived contact with reality? If not, the record-level
path adjustments may be patching a flawed premise — surface this even
if no single entry shows it.

**STOP candidates the per-session loop missed.** Based on trajectory +
theory check, are there STOPs that should already have triggered? A
silent ✗ that's been running for weeks, or ✓ verdicts that have been
quietly ignoring the underlying theory's failure.

**Stories drift (only if `goals/stories/` exists).** Stories interpret
GOAL.md; they go stale when understanding moves on but the story
doesn't. Look for: stories untouched for many months while related
criteria have shifted; recent STOPs that should have triggered a story
update but didn't; criteria that have been ambiguous through several
STOPs but have no story to clarify. Surface candidates for refresh or
new-story creation; don't unilaterally write — story changes go through
the paragraph-echo protocol with human approval.

Surface findings in chat. Don't write yet — the strategic findings get
combined with Phase 2's maintenance findings in Phase 3's report.

## Phase 2 — Surface drift

The point of this phase is to make slow protocol drift visible while
it's still cheap to correct. Drift comes in recognizable patterns; for
each, ask whether it's happening here. Record findings in conversation;
don't write to files yet.

**Index sync (only if `OPEN-STOPS.md` exists).** Every line in
OPEN-STOPS should resolve to a real STOP entry that's still open;
every unresolved STOP entry in the records should appear as a line in
OPEN-STOPS. Mismatches mean the protocol was violated somewhere — the
review fixes the index, but also note when the violation happened so the
underlying habit can be addressed.

**Criteria going silent.** A criterion is "stale" when it *should* be
observable but isn't — not when a counter says "no references in N
entries." Some criteria can't be measured early (no churn before
customers; no recall before evaluation runs); their early silence is
correct. For each active criterion, ask: should this be observable by
now? If yes and recent entries are silent or all-`unclear`, surface it
— either it's quietly going un-instrumented, or it stopped mattering. A
criterion that's been ✓ many times without an ✗ ever is worth a sanity
check on bar height. Surface candidates; don't classify — the human
knows whether silence is unmeasured-yet-mattering or on-its-way-out.

**Verdicts without evidence.** Scan recent entries for `✓` or `✗`
without a parenthetical citing observation from that session. Many
naked verdicts in a row mean the discipline is decaying — surface this
prominently, since it's the leading indicator of the whole skill failing.

**Rotation skipped or misfiled (only if using monthly records).** The
most recent record file should match the current month, and the
month's first entry should be a carry-over summary. If neither, rotation
happened wrong or not at all.

**GOAL.md contradicting itself.** Read end-to-end as if you'd never seen
it. Look for criteria conflicting with each other, invariants conflicting
with criteria, non-goals contradicting the General Line, recent edits
that didn't make it into Revisions. The skill assumes GOAL.md is
internally consistent because it changes rarely; once that assumption
breaks, every later criteria check is judging against confused targets.

**Cross-skill drift (only if design-driven is installed).** Recent
`design/decisions/` adopted but not mentioned in the record — a shape
change the goal layer missed. Design decisions that would violate GOAL
invariants. Goal pivots logged in record that crossed module boundaries
without opening a design proposal. None are errors per se; they're worth
the human's attention.

## Phase 3 — Report and propose

Compile findings from both phases into a single report posted in chat:

```
## Review findings — YYYY-MM-DD

### Strategic checkpoint (Phase 1)

**Trajectory** — per criterion: on pace / off pace / unclear, with the
projection that supports the verdict.

**Principal tension** — the dominant tension this period, named
explicitly.

**Theory of getting there** — the implicit theory, whether evidence
still supports it, what's been quietly contradicting it.

**STOP candidates** — any the per-session loop should have triggered.

### Protocol drift (Phase 2)

**Open STOPs sync** — orphans or missing index entries.

**Stale criteria** — candidates for retirement or instrumentation.

**Naked verdicts** — count of evidence-free ✓/✗ in recent entries.

**Rotation** — ok or issue.

**GOAL.md consistency** — findings or "consistent".

**Cross-check with design-driven** — findings, no issues, or n/a.
```

For each finding (either phase), propose a specific action. Strategic
findings often resolve as STOP candidates the human accepts or rejects;
drift findings often resolve as small fixes the human approves and the
agent applies.

## Phase 4 — Apply changes (after human approval)

Review doesn't silently rewrite things. Each proposed action needs human
approval in chat.

### 4.1 Sync fixes

For OPEN-STOPS sync issues:
- If a STOP exists but isn't indexed: add the line to OPEN-STOPS.
- If OPEN-STOPS lists a STOP that was actually resolved: append the
  `→ resolved` follow-up to the original record entry (date the review
  if unclear when), then remove the OPEN-STOPS line.
- If a "STOP" entry is ambiguous (was it a real STOP or just a
  judgment?), surface it; don't guess.

### 4.2 Criterion retirement

Retiring a criterion is a GOAL.md change — it requires the same
line-by-line confirmation as `set` edits.

- Don't delete; mark `RETIRED YYYY-MM-DD (reason)`. Keep the ID. Old
  record entries reference C2; if C2 disappears, the references break.
- Add a Revisions line: `- YYYY-MM-DD: retired C<N> (reason)`.

### 4.3 Naked verdict followup

Don't retroactively edit old entries to add evidence — that's
fabrication. Instead:

- Note the issue in the next record entry's Observations.
- Tighten the protocol: agent re-reads SKILL.md's evidence rule and
  states: "I'll be stricter about evidence going forward."
- If a specific verdict was clearly wrong (e.g., "C2 ✓" three weeks ago
  but ongoing failures suggest C2 was never ✓), surface that as a
  Type A STOP candidate now.

### 4.4 Rotation fix

If May entries are in `record-2026-04.md`:
- Move them to the correct file (cut from April, paste into a new
  May file).
- Add a carry-over entry at the top of May.
- Note in the review's own record entry that rotation was missed.

### 4.5 GOAL.md inconsistency

Each inconsistency is a small GOAL change. Same line-by-line confirmation
protocol as `set`. Do not bulk-edit GOAL.md.

### 4.6 STOP candidates from strategic phase

If Phase 1 surfaced STOP candidates, walk through them with the human
the same way Moment 3 of the per-session protocol does — Type A vs
Type B, options for the human, wait for decision. The fact that the
candidate came from review, not the per-session loop, doesn't change
how it's resolved.

### 4.7 Review's own record entry

Review always logs a record entry summarizing what was found and what
was applied:

```markdown
## YYYY-MM-DD — Review
- What I did: ran /goal-driven review.
- Observations: <summary of strategic findings + drift findings>.
- Criteria check: per-criterion verdicts from Phase 1's trajectory
  pass — these are real verdicts, not placeholders.
- Judgment: <principal tension>; <STOP candidates raised, if any>; <N>
  drift fixes applied.
```

This makes review visible in the timeline. Future reviews can see when
the last one happened and what state it left things in.

### 4.8 Commit

If files changed (OPEN-STOPS, GOAL.md, records), commit them as one:
"goal-driven: review YYYY-MM-DD — <one-line summary>".

## What review is NOT

- **Not a re-set.** Don't propose new criteria during review. If the
  human wants to add one, they'll request it; review's job is to
  surface what's drifting against the existing GOAL, not redesign it.
- **Not unilateral STOPs.** Review surfaces STOP candidates; the human
  decides. "We've been failing C2 silently for a month" is a candidate,
  not an enacted STOP.
- **Not a code review.** Review reads `goals/`. If the underlying work
  has problems unrelated to the goal layer, that's outside scope.
- **Not a close.** A review may surface that the project should end,
  but ending is `/goal-driven close`'s job. Review reports the finding;
  the human chooses to close.
