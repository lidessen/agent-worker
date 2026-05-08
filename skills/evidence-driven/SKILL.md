---
name: evidence-driven
description: Evidence-driven methodology for the execution layer — every claim of progress requires a falsifiable observation; "looks right to me" is rejected. Use for production code, regression-prone systems, or any task where build-time discipline materially affects outcome quality. Triggers on "set up TDD", "build discipline", "no progress without evidence", "test-first", "verify rigorously", "production code workflow". Do NOT trigger for prototypes, exploratory spikes, throwaway scripts, or doc-only changes. Pairs with design-driven (which defines what to verify; evidence-driven defines how) — each works alone. Args — `/evidence-driven init` to wire up agent configs and optional pre-commit hooks. No periodic-audit command; it's an always-on overlay.
argument-hint: "[init | <task description>]"
---

# Evidence-Driven

A discipline overlay for the execution layer. Where goal-driven owns
*why* and design-driven owns *what shape*, evidence-driven owns *prove
it works*.

The thesis is one line: **no progress claim survives without falsifiable
evidence**. Every State update, every Verify check-off, every "this is
done" must carry an observation that could in principle have shown the
opposite. A test that can't fail isn't evidence; a checklist run with no
captured output isn't evidence; "I tried it and it seemed fine" isn't
evidence.

## Position in the layered stack

```
concept:         reframe           (what shape in a new paradigm; only when no precedent)
strategy:        goal-driven       (why; success criteria; when to STOP)
architecture:    design-driven     (what shape; module boundaries; mechanisms)
execution:       evidence-driven   (prove it works; falsifiability; rigor)
task tracking:   external          (issue tracker / TODO — operational layer)
```

The methodology layers are concurrent, not sequential. Information
flows in both directions: build observations feed back to design (shape
proposal), design adoptions feed back to goal (criterion check), reframe
graduates settled skeletons into design once the concept stabilizes,
and so on. Evidence-driven is the discipline that makes those upstream
signals trustworthy — without it, every claim "the code works" is
unfalsifiable and the whole feedback loop breaks down. Reframe (the
concept layer) only enters the stack when the project is in unsettled
paradigm territory; once it closes, the stack reverts to the three
core layers.

## Commands

Two entry points: one for project setup (one-time), one for applying
the discipline to an actual task (per task).

- `/evidence-driven init` → Read and follow `commands/init.md`.
  One-time scaffolding: agent config snippet, optional pre-commit
  hooks, optional CI integration notes. No artifacts of its own.
- `/evidence-driven [task description]` → Apply the discipline to the
  named task (or ask for it, if no description given). Walks the
  workflow described in **When invoked on a task** below.

**Why these two and nothing else.** Unlike goal-driven and design-driven,
evidence-driven has no phase boundaries — it's a discipline applied
during work, not a periodic phase. Sub-actions like "plan", "verify",
"write a test", "check rigor" are all moments inside the bare-invocation
workflow, not separate commands. Users shouldn't have to choose which
verb fits where; one entry point per task is the natural shape.

There is also no audit command. Evidence-quality drift surfaces during
design-driven's audit when both skills are installed (it walks the
same blueprints), or by ad-hoc user request. A dedicated periodic
audit would manufacture phase boundaries the discipline doesn't
have.

## When to use this skill

**Good fit:**
- Production code paths with real users
- Regression-prone systems (large refactors, cross-cutting changes)
- Anything where an undetected bug has material cost (data loss,
  user-visible failures, security)
- Work that other agents or future-you will need to verify months later
  without context

**Bad fit:**
- Prototypes meant to be thrown away
- Exploratory spikes where the question is "is this approach viable"
  rather than "does this work correctly"
- One-off scripts that run once and are deleted
- Documentation-only changes (the discipline applies to behavior, not
  prose)
- Domains where the cost of test infrastructure exceeds the cost of
  occasional bugs (highly experimental research code, rapid prototyping
  contexts)

If you find yourself contorting work to fit the discipline, the work
isn't a fit. Use a lighter approach and accept the tradeoff explicitly.

## The four principles

### 1. Falsifiability is non-negotiable

Every Verify check-off needs an observation that could have failed. A
test that passes regardless of the code under test is theater; a
checklist item that's marked `✓` without a capture of what was checked
is theater; "looks right to me" is theater.

Concrete falsifiability questions to ask before claiming done:
- **Could this evidence have shown the opposite?** If no, it's not
  evidence.
- **What input would make this test fail?** If you can't name one
  realistic case, the test isn't catching anything.
- **If the implementation were silently wrong tomorrow, would this
  check catch it?** If no, the check is decorative.

This principle is upstream of TDD specifically. TDD is one practical
way to ensure falsifiability (you literally see the test fail before
making it pass). But other forms can also satisfy the principle: a
contract trace that demonstrates an end-to-end flow, a manual checklist
where each item captures actual observed output, a known-good
comparison. The form is flexible; the falsifiability isn't.

### 2. TDD as the default for code that can be unit-tested

When the work is code with deterministic inputs and outputs (most
backend logic, pure functions, well-defined APIs), TDD is the
strongest form of falsifiability:

1. Write a test that demonstrates the change you're about to make.
2. Run it. Confirm it fails — and fails *for the right reason*. (A
   test that fails because of a syntax error in the test isn't proving
   anything.)
3. Write the minimal code to make it pass.
4. Refactor with the test as a safety net.

Why TDD specifically: writing the test first forces you to think about
the contract before the implementation. You can't write a test for a
behavior you can't articulate, so vague work surfaces immediately.

When TDD doesn't fit:
- UI work where the verification is "does it look right" (use snapshot
  tests + visual review, with the visual review captured)
- Glue / integration code where mocking everything makes the test
  meaningless (use integration paths with capture)
- Throwaway exploration (skip the discipline; you're not in this
  skill's territory)
- Anything where setting up the test costs more than the bug it
  catches (judgment call; document the tradeoff)

The point of TDD is the falsifiability + design pressure it produces,
not the ritual. If a different form gives you the same effect, use it.

### 3. State updates are evidence trail, not progress meter

Design-driven says: update State on every TODO check-off. Evidence-
driven adds: **what you write in State must be specific enough to be
falsifiable later**.

Anti-pattern (hollow State):
```
## State
- TODO 1 done
- TODO 2 done
- Working on TODO 3
```

This tells the next agent (or future-you) nothing. "Done" how? What
changed? What's now true that wasn't before? An out-of-date hollow
State is worse than no State.

Pattern (evidence-trail State):
```
## State
- TODO 1 done — added `limit: number` parameter to `query()` in
  store.ts:42; existing callers default to no limit (passes existing
  test suite, 14/14 pass)
- TODO 2 done — wired handler at routes.ts:88 calls `query({limit})`;
  manual test with curl showed expected JSON
- Working on TODO 3 — adding integration test that exercises limit=5
```

This is auditable: the next agent can re-run those checks, find the
exact code locations, and verify each claim. State becomes evidence,
not just progress signaling.

**State needs a durable home.** Design-driven's blueprint State
section is the canonical surface, but other persistent locations
work: an external task system's update field, a scratch markdown
the agent maintains, a Notion or wiki page if that's the project's
convention. The chat history is **not** a State surface — it doesn't
survive session boundaries. If the task you're applying rigor to has
no persistent surface available and the work won't fit in one
session, either create one (the simplest move is suggesting
design-driven to bootstrap a blueprint) or evidence-driven can't
deliver on its own thesis. Better to admit that than to write
"evidence" into chat that evaporates.

### 4. Anti-cargo-cult: the "would this have caught X" check

Tests can be written that pass but catch nothing. Common patterns:
- Asserting on the *act* of calling something rather than its effect
  (mocked-out test that confirms the mock was called)
- Coverage-driven tests that exercise code without checking results
- Tests that pass even after deleting the code under test

The check: **before claiming a test as evidence, articulate what
specific failure it catches.** "This test catches the case where
`limit=0` returns everything instead of nothing." If you can't name
the specific failure, the test isn't doing the work.

Same principle for non-test evidence: every checklist item, every
manual capture, every trace should be tied to a specific risk it
addresses. Generic "ran it and it worked" entries don't qualify.

## When invoked on a task

`/evidence-driven [task description]` triggers a structured workflow.
If no task description is given, ask the user what task to apply
rigor to. Then walk Plan → Build → Verify, with TDD discipline and
evidence-trail State.

### Plan

In chat, produce four things:

1. **Risks** — what could fail in this code? Skim DESIGN.md if
   present for module-level constraints; consult any blueprint Scope
   for boundaries. Each risk is a concrete failure mode, not a
   category.
2. **Tests / checks** — for each risk, the specific test (or trace,
   or manual check) that catches it. Name the test and what failure
   it surfaces. Reuse blueprint Verification items if present.
3. **TDD sequence** — the order: which test to write first, which
   implementation step it drives, which test next. The sequence is
   the working contract for Build.
4. **Evidence checklist for done** — what observations confirm each
   Verify check. This is the rubric for the Verify step.

Confirm with the user before moving to Build. The plan is the
working contract; if the user disagrees with the framing, this is
where to surface it cheaply.

### Build

Walk the TDD sequence from Plan, one step at a time:

1. Write the next test from the sequence
2. Run it; confirm it fails *for the right reason* (not a syntax
   error in the test itself)
3. Write the minimal code to make it pass
4. Run again; confirm pass
5. Update State (in blueprint if present, in chat otherwise) with
   what changed at what file:line, and which test now passes
6. Repeat for the next step

If a step reveals a flaw in the Plan (a missing risk, a wrong test
sequencing), pause and update Plan before continuing. Don't silently
deviate.

### Verify

Walk the evidence checklist from Plan. Each item gets a concrete
observation captured — test output, trace excerpt, manual run
result. Naked check-offs are forbidden; if no observation supports
an item, it's `unclear`, not `✓`.

If a Verify item fails: the work isn't done. Either fix the
implementation or surface a blocker. Don't claim done with an
outstanding `✗`.

### Consuming context from design-driven

When design-driven is installed and the task has a blueprint:
- Skim DESIGN.md for the touched module's boundaries and constraints
- Read the blueprint in full — Approach, Scope, Verification, TODO,
  State are the working surface
- Skim relevant `design/decisions/` if the task area has past
  decisions

Plan output **augments the blueprint's Verification section in place**
— each existing check gets sub-bullets specifying test name, what
failure each test catches, and the risk it covers. Example:

```markdown
## Verification
### Behavior
- [ ] Returns paginated results (limit and offset honored)
  - Test: `test_pagination.py::test_limit_honored` — fails if limit
    silently ignored. Catches "limit param dropped at handler".
  - Test: `test_pagination.py::test_offset_honored` — fails if all
    pages return same first item.
- [ ] Returns empty array on out-of-range page
  - Test: `test_pagination.py::test_out_of_range` — fails if returns
    500 instead of empty array.
```

Don't change Approach, Scope, Design constraints, or TODO main items
— those are design-driven's territory. Build phase TODOs may gain
TDD sub-steps inline ("write test first / then implement") without
restructuring the TODO list.

When no blueprint exists: Plan output stays in chat as the working
contract — but only if the task fits in a single session. If the work
spans sessions, the State and Plan need a durable home or they're
lost on resume. Either suggest invoking design-driven to bootstrap a
blueprint, or commit to keeping a scratch markdown the agent updates
each session. Don't pretend chat is a persistence layer.

When design-driven isn't installed at all: Plan output goes wherever
the project's task structure already lives (Linear comment, GitHub
issue description, scratch markdown). The discipline doesn't require
any specific artifact format — it requires a falsifiable contract
somewhere durable. If no such surface exists *and* the task isn't
single-session, evidence-driven is the wrong tool until one does.

## With design-driven

Evidence-driven assumes design-driven's blueprint structure exists. The
blueprint's `Verify` section defines *what to check*; evidence-driven
defines *how to check rigorously*.

Concrete division of labor when both are installed:

| Concern | Lives in |
|---|---|
| Blueprint format (TODO, State, Verify, Follow-ups sections) | design-driven |
| Falsifiable-Verify baseline + State-on-every-TODO baseline | design-driven (and independently restated in this skill's Principles 1 and 3, so evidence-driven works alone if design-driven isn't installed) |
| TDD cycle, evidence anti-patterns, cargo-cult guards | evidence-driven |
| State entry quality (specific, auditable, not hollow) | evidence-driven |
| What counts as "real" falsifiable evidence | evidence-driven |
| Pre-commit hooks / CI integration patterns | evidence-driven |

Pattern: design-driven says "here's the artifact and the baseline
rules"; evidence-driven says "here's how the rules become real
discipline under pressure."

When design-driven isn't installed: evidence-driven still works as a
discipline you bring to whatever task structure exists (Linear ticket,
GitHub issue, a markdown checklist). The principles don't depend on
blueprint format.

**Handoff back to design-driven.** An evidence finding that a class of
bugs recurs because the shape is wrong (not the code implementing it)
is a design proposal trigger — write a `design/decisions/NNN-*.md`,
don't keep rewriting the same tests. evidence-driven catches symptoms;
design-driven addresses root.

## With reframe

Light, surgical overlap. Reframe is conceptual exploration, not
execution — most of its phases (essence extraction, primitive
listing, transfer learning, flesh planning) don't engage
evidence-driven at all. But two phases borrow the discipline:

- **Phase 4 — Skeleton Stress Test.** Each "did the skeleton hold
  when this crutch was removed?" verdict is exactly the kind of
  claim that needs falsifiable evidence. "It held" without an
  observation is theater. The Stress Tests log entry should record
  the specific scenario probed and what behavior was (or would be)
  observed — not a summary judgment.
- **Phase 7 — Comprehension Test.** "Users understood the flow"
  is a claim that demands evidence at least as much as "the code
  works". The lightest credible artifact (narration / wireframe /
  mock / thin prototype) plus a captured user observation is the
  evidence pattern. "Looks intuitive to me" isn't.

When reframe and evidence-driven are both installed, the concept
document's Stress Tests and Comprehension Tests entries should
follow this skill's rule: every verdict cites the observation that
could have shown the opposite. This carries forward when the
concept graduates into design-driven — those captured observations
become the seed for the blueprint's Verification section.

Handoff direction is always concept → design → evidence → code.
Evidence-driven doesn't read or write `concepts/` files; it just
raises the signal-to-noise ratio of the verdicts inside them.

## With goal-driven

Indirect — through design-driven. Evidence-driven doesn't read
`goals/GOAL.md` and doesn't write to `goals/record*`. Its loop is the
build/verify cycle, which lives below the strategic layer.

But: evidence-driven's discipline makes the upward feedback loop
trustworthy. When build observations should trigger a design proposal
or a goal STOP, those observations are only credible if they have
evidence behind them. A "naked" State claim ("this approach isn't
working") propagates much less reliably than an evidenced one ("approach
X measured P95 720ms across three storage backends; below is the
trace").

So while there's no direct cross-reference, evidence-driven raises the
signal-to-noise ratio of the cross-skill feedback channels.

**Handoff back to goal-driven.** An evidence finding that a criterion
fails its spirit even when the literal threshold is met — latency
hits the target number but tail-latency is bad UX, coverage hits 90%
but production bugs keep shipping — is a goal-level question, not an
evidence-quality one. Surface as a Type A STOP candidate; the
criterion may need restating.

## When to skip

- Prototypes / spikes where the question is viability, not correctness
- Throwaway code that won't survive the week
- Documentation-only PRs
- Highly experimental research where rigid discipline kills iteration
- Solo work on personal projects where you accept the tradeoff
  explicitly

The discipline has a real cost. Don't apply it where the cost exceeds
the value, and don't apologize for skipping it in those cases. Use the
right tool for the job.

## A test of the principle

Before you claim a piece of work is done, ask:

> If a future agent — or future-you, six months later — reads only
> what I've written, can they tell whether this *actually* works?

If the answer is "they'd have to take my word for it", the discipline
hasn't been applied. Either add evidence, or admit the work isn't done
yet.

This question is the heart of the skill. Everything else is a way of
making that question easy to answer "yes".
