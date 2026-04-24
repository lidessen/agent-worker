# Templates

Reference templates for blueprints, proposals, and DESIGN.md structure.
Load this file when you need to create one of these artifacts.

## Blueprint format

```markdown
# <Task Name>

**Status:** in-progress | done
**Date:** YYYY-MM-DD
**Design context:** Which design/ sections this task relates to

## Approach
What this task builds and the approach chosen. More detailed than design/ 
but still not code — think "which pieces to build, in what order, how they 
connect" rather than "which functions to call".

## Scope
What's in / what's out for this task specifically.

## Verification                  ← Define done criteria upfront
### Behavior
- [ ] Functional check 1 (e.g., "returns expected shape", "tests pass")
- [ ] Functional check 2

### Design constraints
- [ ] Stays within module boundaries as defined in DESIGN.md
- [ ] Honors relevant Constraints and Non-goals
- [ ] If shape changed: an adopted proposal exists in design/decisions/

## TODO                          ← Scaffolding — removed at close out
- [ ] Step 1 description
- [ ] Step 2 description
- [ ] ...

## State                         ← Scaffolding — removed at close out
Decisions made during build, current progress, and anything needed to 
resume if the session is interrupted. Update this as you go.

## Follow-ups                    ← Kept after close out (if any)
Items that got scope-shaved but remain worth doing. Names and one-line 
intents, not full blueprints.
- `<task-name>` — one-line intent
```

## Proposal format

Keep it tight — aim for under 80 lines. If a proposal touches multiple 
independent modules or mechanisms, split it into separate proposals 
before drafting. Mega-proposals are where "didn't think it through" 
hides — each independent shape change deserves its own pressure test.

**Filename:** `design/decisions/NNN-kebab-title.md`, where `NNN` is the 
next unused three-digit number — scan the directory, take max+1, pad 
to three digits (start at `001` if empty).

```markdown
# <Title>

**Status:** proposed | adopted | rejected | adopted (retroactive)
**Date:** YYYY-MM-DD

## Context
One paragraph: what situation prompted this proposal.

## Recommendation
The proposed shape change, and one paragraph on why it's the right one. 
Same level as DESIGN.md — module boundaries, data flow, mechanisms. 
No implementation details.

## Alternatives seriously considered
Each alternative: the shape it would take, plus its strongest case — 
the scenario where it would beat the recommendation. If you can't name 
a strongest case, you didn't seriously consider it; either think harder 
or drop it. Include "do nothing / keep current shape" as one alternative.

## Pre-mortem
A year from now, this proposal has been adopted and is being ripped 
out. Why? Name the most plausible failure mode — the assumption that 
turned out wrong, the constraint that tightened, the scaling axis that 
wasn't accounted for. If nothing comes to mind, the shape hasn't been 
stressed enough yet — keep thinking.

## Cold review
Filled in by an **adversarial reviewer in a fresh context** — a 
subagent dispatched via the Agent tool, or the author in a cleared 
session. Not by the current author in the current session.

The author must NOT pre-fill this. "Self-check after you just wrote 
it" is self-grading your own homework — a neutral fresh reviewer is 
already better, and an adversarial one (instructed to assume the 
proposal has a flaw and hunt for it) is better still. That's the 
gate; everything less leaks through.

How to run it: hand `references/cold-review-prompt.md` to a subagent, 
with paths to DESIGN.md and this proposal. The reviewer returns 
findings on Completeness / Consistency / Clarity / Scope / YAGNI — 
each specific enough that "yes, that's fine" isn't a valid dismissal. 
Paste findings here. Address each inline: fix the proposal above, or 
write a one-sentence rebuttal. Silent dismissal isn't allowed — a 
future reader should be able to see what was raised and what the 
author did about it.

## Outcome
(Filled in after decision)
If adopted: which DESIGN.md sections were updated.
If rejected: why, in one paragraph.
```

Use `adopted (retroactive)` only during audit, when the shape change 
already happened in code without a proposal at the time — the file 
records the change after the fact. Retroactive proposals still go 
through Pre-mortem and Cold review, using what's now known from the 
code; skipping them defeats the point of filing the record at all.

## DESIGN.md structure

```markdown
# Project — Design

> One sentence: what is this system.

## Architecture
(ASCII diagram: modules and how they connect)

## Modules
(Each: does / doesn't do — two lines max)

## Data Flow
(ASCII diagram: the main happy path, ONE path only)

## Key Mechanisms
(2-3 patterns that define how the system works.
 Describe the pattern and why it matters, not the implementation.)

## Key Decisions
(Choices where you picked A over B, and what you rejected.)

## Constraints
(Hard limits)

## Non-goals
(What this system explicitly doesn't do)
```

Split into additional DESIGN-<aspect>.md files only when a mechanism is 
complex enough that folding it into DESIGN.md would push DESIGN.md past 
~200 lines. The guiding principle: `design/` is L1 context — loaded every 
time the agent works on the project — so keep the total small enough to 
read in one pass. If you find yourself wanting many DESIGN-<aspect>.md 
files, that is usually a signal that DESIGN.md is mixing abstraction 
levels, or that some content belongs in module-level docs (L2) rather 
than the architectural skeleton.
