# design-driven:audit — Reconcile design/ against current code

Run periodically, or when DESIGN.md feels out of sync with the code. 
Produces a drift report and, if drift exists, either in-place updates 
to DESIGN.md (for changes that just missed the doc) or retroactive 
proposals in `design/decisions/` (for shape changes that happened in 
code without review).

If `design/DESIGN.md` does not exist, stop and ask the user whether 
they meant `/design-driven bootstrap` instead.

## When to run

- DESIGN.md hasn't been touched in months while the code kept moving
- You notice a module in the code that isn't in DESIGN.md (or vice versa)
- A task is blocked because DESIGN.md contradicts what's there
- Routine hygiene before a major release or onboarding a new contributor

## Phase 1 — Collect drift

Re-use the fact-check logic from `bootstrap.md` Phase 3, but with the 
existing DESIGN.md as input rather than a fresh draft.

### 1.1 Fact-check each DESIGN.md claim against the code

For each section, confirm from the source:

- **Modules** — do the names, paths, and "does / doesn't" boundaries 
  still match the code? Flag: additions, removals, renames, boundary 
  creep (a module doing what its "doesn't do" list forbids).
- **Data flow** — trace the happy path. Does every arrow still 
  correspond to a real call, import, or message?
- **Key mechanisms** — re-read the core source for each. Still 
  accurate, or has the code moved on?
- **Key decisions** — can you still find the "picked A over B" in 
  the code? Did any rejected alternative quietly get adopted?
- **Constraints / non-goals** — still honored, or violated somewhere?

For large codebases, delegate per-section fact-checking to Explore 
subagents in parallel, but synthesize the findings yourself.

### 1.2 Find undocumented additions

Walk the code looking for things that *should* be in DESIGN.md 
but aren't:

- New top-level modules, services, or packages
- New major mechanisms (new patterns, new shared abstractions)
- New external integrations that shape the system
- New constraints (perf/compliance/platform) that the team has been 
  quietly designing around

### 1.3 Check blueprints for signals

Scan recent `blueprints/` (especially `done` ones from the last few 
months). If multiple blueprints keep bumping into the same "design 
says X but we needed Y" edge, that's a signal DESIGN.md is describing 
a system that no longer exists.

## Phase 2 — Classify each finding

Sort each drift item into one of three buckets. This is the most 
important step — the bucket determines what you do next.

- **Doc-only drift** — the code is fine, DESIGN.md just fell behind. 
  Example: a module was renamed; a module's "doesn't do" list needs 
  an addition; a mechanism gained a minor detail.
  → Fix in-place in DESIGN.md.
- **Shape-level drift** — the system's shape genuinely changed in 
  code and it wasn't proposed at the time. Example: a new top-level 
  module appeared; a mechanism was replaced; a non-goal was violated.
  → Write a retroactive proposal in `design/decisions/NNN-title.md` 
  with `Status: adopted (retroactive)`. Don't pretend it didn't 
  happen — record what changed, when, and why (as best you can 
  reconstruct from commits).
- **Code-should-change** — the code drifted in a direction the 
  design explicitly rejects, and you think the design is still 
  right. Example: a module started owning state it explicitly 
  said it wouldn't.
  → Raise to the human. Do **not** silently "fix" it in the audit — 
  that's a real code change, not a doc reconciliation.

## Phase 3 — Present, commit

### 3.1 Present findings

Group by bucket. For each:

- **Doc-only:** show the diff you propose to DESIGN.md
- **Shape-level retroactive:** show the proposal draft
- **Code-should-change:** list without taking action; ask the human 
  how to handle each (write a task, open a proposal in the other 
  direction, or accept the drift and update DESIGN.md)

Call out anything ambiguous — when in doubt between doc-only and 
shape-level, err toward shape-level (write the proposal) so the 
change gets acknowledged rather than quietly laundered.

### 3.2 Apply and commit

After the human approves the findings:

- Apply the DESIGN.md diffs
- Commit retroactive proposals with their adopted status
- Commit doc changes separately from any code changes the audit 
  triggers — same separation rule as the normal loop

## What audit is *not*

- Not a refactor — you're reconciling docs, not restructuring code
- Not a free pass to rewrite DESIGN.md from scratch — if it's that 
  broken, stop and ask whether to re-bootstrap instead
- Not a substitute for proposals in real time — going forward, 
  shape changes should still get proposed up front; audit is the 
  safety net, not the default path
