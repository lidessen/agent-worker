# Templates

File formats for goal-driven artifacts. Load this when creating any of
these files.

## GOAL.md

```markdown
# <Initiative name>

> One sentence: what this is. The reader should know in 10 seconds whether
> this initiative is theirs to care about.

## General Line
One or two sentences. The world-state when this is done. Outcome, not
activity. Avoid "build X" — say what X enables.

## Success criteria
Each criterion has a stable ID (C1, C2, ...). IDs are never reused. When a
criterion is retired, mark it `RETIRED YYYY-MM-DD (reason)` but leave the
line in place — old record entries reference it.

- **C1** — <falsifiable statement, with how it's measured>
- **C2** — <falsifiable statement, with how it's measured>
- **C3** — <soft criterion, paired with proxy>
  - Proxy: <observable indicator that stands in for the soft criterion>

Aim for 2–5 active criteria. More than 5 usually means some are path-level.

## Invariants
What must stay true regardless of path. Violating an invariant is a STOP
signal even if criteria are on track.

- <invariant 1>
- <invariant 2>

0–4 invariants is typical.

## Non-goals
Forbidden zones — types of work that, even when tempting, this
initiative declines. Each line names a specific *tempting* path and the
reason it's out of scope. Not inverted goals ("don't ship slow
search" delimits nothing). Test: would an honest reviewer ever lobby
for this? If no, it's not a non-goal worth listing.

- <forbidden zone 1> — <one-line reason>
- <forbidden zone 2> — <one-line reason>

## Revisions
Lightweight log of GOAL.md changes (git has the full diff; this is for
human readability).

- YYYY-MM-DD: <change in one line, e.g., "added C4 (中文召回 ≥ 65%) after
  C1 found insufficient for non-English text">
- YYYY-MM-DD: <retired C2; replaced with C2' to include cold start>
```

Keep total length under ~80 lines. If GOAL.md grows past that, the goal
is probably too compound — split into separate initiatives.

## Record entry

Each work session ends with one entry. Format:

```markdown
## YYYY-MM-DD — <one-line title of what happened>
- What I did: <factual recount of the session's work>
- Observations: <what was learned, measured, or noticed>
- Criteria check:
  - C1 ✓ (specific evidence from this session)
  - C2 ✗ (specific evidence)
  - C3 unclear (no observation this session)
- Judgment: <path-level adjustment | goal-level concern | no change>
- Next: <one line on what's next, if known>
```

Rules:
- Every ✓ and ✗ MUST have parenthetical evidence from this session.
- `unclear` is the default when nothing happened on a criterion. Bare
  ✓ is forbidden.
- Judgment names the principal tension this session — which criterion,
  risk, or open question is currently binding — rather than summarizing
  all of them flatly. The tension may shift session-to-session.
- Title is a one-line summary; the entry should be readable in 30 seconds.
- Length: 5–15 lines. If much longer, split into multiple entries or push
  detail elsewhere.

## STOP entry

A STOP is just a record entry with a STOP marker. Two flavors:

```markdown
## YYYY-MM-DD — STOP [Type A] C<N> failing — <one-line summary>
- What I did: <attempted X / observed Y>
- Observations: C<N> measured at <value>, threshold <target>. Third
  attempt this period.
- Criteria check:
  - C1 ✓ (...)
  - C2 ✗ (720ms vs 500ms target — same as last 2 attempts)
- Judgment: STOP Type A. Path X consistently fails C2.
- Options for human:
  - (a) Try path Y instead (different storage)
  - (b) Relax C2 to <new value> — would be GOAL change
  - (c) I'm wrong about the measurement
- Status: open
```

Type B (General Line questioned):

```markdown
## YYYY-MM-DD — STOP [Type B] General Line may be wrong — <one-line>
- What I did: <whatever surfaced the doubt>
- Observations: <new evidence>
- Criteria check: <usually all ✓ or close>
- Judgment: STOP Type B. Criteria served, but the goal itself may not
  matter as stated.
- Options for human:
  - (a) Reframe the General Line (deliberate GOAL change)
  - (b) Stay course — evidence is too weak to redirect
- Status: open
```

When resolved, append at the bottom of the original entry (do not delete
the entry, do not edit Status in place — append):

```
→ resolved YYYY-MM-DD: <one-line decision>. <Optional: reference to
  GOAL revision or design decision adopted as part of resolution>
- Status: resolved
```

The original Status: open line stays; the new Status: resolved line is
the latest. Reading top-to-bottom, the entry tells the story.

## OPEN-STOPS.md

```markdown
# Open STOPs

Index of unresolved STOPs across all records. Maintained by agent.

- 2026-05-02 [Type B] General Line questioned by user feedback → see record-2026-05.md
- 2026-04-27 [Type A] C2 violated 3rd time this month → see record-2026-04.md
```

If empty:

```markdown
# Open STOPs

No open STOPs.
```

Sync rule: every line here MUST resolve to a STOP entry whose status is
still `open`. When the entry's status flips to `resolved`, the line is
removed here in the same agent action.

## Carry-over entry (month rollover)

First entry of every new month (unless month started with a STOP or other
event):

```markdown
## YYYY-MM-01 — Carry-over from <previous month>
- Open STOPs: <list, or "none">
- Current path: <one line — what's being walked>
- Last month closed with: <one line — most recent state>
- Criteria check: all unclear (nothing measured this session)
- Judgment: no change. Resuming work.
```

This anchors the new file so the next session has context within the
current month's record alone.

## Carry-over GOAL revision (after resolved STOP)

When a STOP resolution involves changing GOAL.md, the agent:

1. Updates GOAL.md (with line-by-line human confirmation, same as `set`).
2. Adds a line to GOAL.md's Revisions section:
   `YYYY-MM-DD: <change> (resolves STOP from <date>)`
3. Appends to the original STOP entry: `→ resolved YYYY-MM-DD: GOAL
   updated to <change>. See Revisions.`
4. Removes the line from OPEN-STOPS.

All four steps happen together; partial application leaves the system
inconsistent.

## Story file (opt-in)

A story is a topic-organized explanatory document that interprets one
aspect of GOAL.md. File name is kebab-case description; content is
narrative prose, freely editable.

Filename: `goals/stories/<topic>.md`. Suggested patterns (none
enforced — agent picks names that fit, human approves):

- `why-<choice>.md` — explaining a specific choice
- `what-<term>-means.md` — clarifying ambiguous semantics
- `<topic>-rationale.md` — broader background
- `<topic>-history.md` — evolution narrative

```markdown
# <Topic name as a sentence or fragment>

<One paragraph: what this story explains and why it matters here.>

<One or more paragraphs of explanatory prose. Cite specific criteria,
observations, or trade-offs by name. Reference STOP dates or record
entries that informed this understanding.>

<If applicable, a paragraph on how the understanding evolved — the
original framing vs. what's known now, and what triggered the shift.>

---
_Last updated: YYYY-MM-DD_
```

Length: typically 1–3 paragraphs. Long stories aren't wrong but suggest
the topic might split. A story longer than ~50 lines deserves a look —
it may be a topic that should become two stories, or an overgrown one
that's drifted into journal-like running commentary (which belongs in
record, not stories).
