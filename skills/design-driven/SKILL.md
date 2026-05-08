---
name: design-driven
description: Design-driven development methodology — the design/ directory is the single source of architectural truth; read it before coding, stay within its boundaries, and update it first when the system's shape changes. Use whenever starting development on this project, or when the user asks to create/update architecture docs, add a feature that may cross existing boundaries, refactor system structure, or understand the codebase architecture. Triggers on "design first", "update the design", "does this change the architecture", "write a design for", "what's the current design", or onboarding to a codebase's shape. Args — `/design-driven init` to configure a project, `bootstrap` to generate design from existing code, `audit` to reconcile design/ against current code.
argument-hint: "[init | bootstrap | audit]"
---

# Design-Driven Development

A mini methodology: design/ is the skeleton, code is the muscle. 
Human shapes the skeleton, agent builds the muscle.

design/ is also the institutional memory that outlives any single agent 
session. Agents are ephemeral, but the architectural skeleton persists — 
each new agent reads it, works within its boundaries, and leaves the 
codebase in a state the next agent can trust.

## Commands

When invoked with an argument, dispatch to the corresponding file:

- `/design-driven init` → Read and follow `commands/init.md`.
  One-time project plumbing: agent configs, empty directories, optional 
  hooks. Does not generate DESIGN.md.
- `/design-driven bootstrap` → Read and follow `commands/bootstrap.md`.
  Generate the initial `design/DESIGN.md` from an existing codebase. 
  Idempotently handles plumbing if `init` wasn't run first.
- `/design-driven audit` → Read and follow `commands/audit.md`.
  Reconcile an existing `design/` against the current code: find drift, 
  classify findings, propose updates or retroactive proposals.
- No argument → Continue with the methodology below (the normal loop).

**Which command when:**

- Brand new project, no code yet → `init`, then write DESIGN.md by hand
- Existing codebase, no `design/` → `bootstrap` (does init-style plumbing too)
- `design/` exists, starting a task → no argument (normal loop)
- `design/` exists and feels stale, or code has drifted → `audit`

## When to use this skill

design-driven is the right tool when the system has identifiable shape
worth committing to — modules, mechanisms, boundaries that won't be
rewritten next week. Most ongoing engineering work fits.

**When another phase is the better starting point:**

- **The destination is unclear, not just the path.** No falsifiable
  success criteria, no deadline, no measurable target → start at the
  strategy layer with `/goal-driven set`. design-driven becomes the
  right tool once shape is the question, not direction.
- **The shape itself is unsettled because the paradigm is new** (no
  industry precedent — AI-native systems, agent-first interfaces,
  post-mobile categories). Writing DESIGN.md prematurely will lock
  in a traditional skeleton dressed in new vocabulary. Use
  `/reframe` first to redraw the skeleton from the new paradigm's
  primitives; once it settles, graduate it into DESIGN.md.
- **The shape is volatile within a known paradigm** — you'd rewrite
  DESIGN.md weekly because the project is still exploring direction.
  goal-driven covers this phase. Bring in design-driven when shape
  stabilizes.
- **The work is one-off** — bug fix, script, throwaway prototype.
  No framework needed.

**Signals during design-driven work that warrant another skill:**

- A criterion in goal-driven keeps failing despite shape being right
  → may be a goal-level question (criterion wrong, the General Line
  questioned), not a design issue. Surface as a goal STOP.
- "Verified" bugs still ship → build-time discipline gap; layer
  evidence-driven over the Build/Verify phase via
  `/evidence-driven init`.
- Same class of bugs recurs because shape is wrong (not the code
  implementing it) → write a `design/decisions/NNN-*.md` proposal,
  don't keep patching.

## Directory Structure

```
project/
├── design/                                        ← Permanent skeleton
│   ├── DESIGN.md                                  ← System shape
│   ├── DESIGN-<aspect>.md                         ← Complex mechanisms (optional)
│   └── decisions/
│       ├── 001-outbox-over-direct-push.md         ← adopted
│       └── 002-split-memory-tiers.md              ← rejected
│
└── blueprints/                                    ← Implementation records
    ├── add-semantic-memory-search.md              ← done (clean, no TODO)
    └── refactor-agent-delegation.md               ← in-progress (has TODO)
```

Two directories, clear separation: `design/` is the architect's drawings 
(system shape, permanent), `blueprints/` is the builder's records 
(task-level approach, kept for reference).

## The 30/70 Principle

The design/ directory captures 30% — the critical skeleton. 
The agent has 70% freedom.

**The 30% (in design/):**
- Module boundaries — what exists, what each does and doesn't do
- Data flow — how information moves through the system
- Key mechanisms — patterns that define system behavior
- Tradeoffs — choices where you picked A over B, and why

**The 70% (agent decides freely):**
- API design, function signatures, error handling
- Data structures, algorithms, file organization
- Internal module architecture, naming, patterns

**Litmus test:** If changing it would change the system's *shape*, it's the 30%. 
If it changes *behavior within the same shape*, it's the 70%.

The 30% constraint applies across the **entire development cycle**, not 
just during "architecture tasks". design/ is a constant frame; every 
phase — coding, testing, reviewing, debugging, refactoring, releasing, 
deprecating — operates inside it. Design-driven isn't one stage of the 
workflow; it's the skeleton every stage hangs on.

## Across the development cycle

The 30/70 rule applies across every phase of work, but each phase
has its own specific application — the bullets below name the
concrete move per activity, not just the abstract principle.

- **Planning** — read DESIGN.md first; scope the task against existing 
  modules and non-goals
- **Coding** — stay within the owning module's boundaries
- **Testing** — test at module boundaries and named mechanisms; 
  internal behavior that isn't in DESIGN.md is 70% territory
- **Code review** — design-level comments (boundary violation, silent 
  shape drift, missing proposal) take priority over style nits
- **Debugging** — locate the bug in its module. If the real fix would 
  cross a boundary, that's a proposal signal, not a clever patch
- **Refactoring** — within a module: free. Crossing modules or 
  changing a mechanism: proposal first
- **Release / rollback** — shape changes ship together with their 
  adopted proposal; rollback preserves the skeleton
- **Deprecation** — removing a module or mechanism is a shape change 
  → proposal
- **Onboarding** — new contributors read DESIGN.md before the code

For activities not listed, derive the application yourself: ask
whether the action stays within the shape (70% — proceed) or changes
it (30% — proposal). The bullets above are common cases, not an
exhaustive checklist.

## The Loop

Every development task follows one path:

```
  ┌───────────────────────────────┐
  │  Read design/DESIGN.md        │  ← Always start here
  │  Understand the skeleton      │
  └────────────┬──────────────────┘
               │
       ┌───────▼────────┐
       │ Does this task  │
       │ change the      │
       │ system's shape? │
       └───┬─────────┬───┘
           │         │
          NO        YES
           │         │
           │    ┌────▼───────────────────┐
           │    │ Write proposal in      │
           │    │ design/decisions/      │  ← Context + proposal + alternatives
           │    └────┬───────────────────┘
           │         │
           │    ┌────▼───────────────────┐
           │    │ Human reviews          │  ← Wait. Don't code until approved.
           │    └────┬───────────────────┘
           │         │
           │    ┌────▼───────────────────┐
           │    │ Update design/DESIGN.md│  ← Commit design change separately
           │    └────┬───────────────────┘
           │         │
       ┌───▼─────────▼───┐
       │   Plan           │  ← Draw the blueprint, set up scaffolding
       ├──────────────────┤
       │   Build          │  ← Code freely, track progress on scaffolding
       ├──────────────────┤
       │   Verify         │  ← Check against blueprint, tear down scaffolding
       └──────────────────┘
```

**"Changes the shape"** = adding/removing/merging modules, changing how modules 
connect, altering a key mechanism, introducing a new architectural pattern. 
Use the 30/70 litmus test above: if you're unsure, it probably doesn't — just code.

## Implementation: Plan → Build → Verify → Close out

**Plan** — Before drafting, you need two things: **current state** and 
**pending claims** on the area you're about to touch.

*Current state* lives in:
- `design/DESIGN.md` — the shape
- The relevant source code — the implementation

*Pending claims* live in:
- `blueprints/` — `in-progress` files that may conflict with your work
- Recent done blueprints' `## Follow-ups` sections — scope-shaved work 
  that may be exactly what your task is, or what it depends on
- `design/decisions/` — any proposal currently in `proposed` state 
  blocks source edits in its area until resolved

Past blueprints are **records, not state**. Don't reconstruct current 
behavior by reading their Approach or (former) State sections — read 
DESIGN.md and the code. If those two disagree, that's drift; stop and 
run `/design-driven audit` rather than layer new work on a stale 
skeleton.

**If goal-driven is installed** (`goals/GOAL.md` exists), read it as 
part of Plan and decide which success criteria this task moves 
forward. Add a `**Serves:** C<n>, C<m>` line to the blueprint header 
(or `**Serves:** none` for infra cleanup that doesn't directly serve 
a criterion). This makes the blueprint → goal traceability visible 
in two directions: a future reader sees why the task exists; the 
goal-driven session-end record can cite the blueprint when checking 
that criterion. If the task doesn't visibly serve any criterion and 
isn't infra cleanup, that itself is a signal — pause and ask whether 
this task belongs in this initiative.

Then write `blueprints/<task-name>.md` with approach, scope, and 
verification criteria upfront — how will you know this task is done? 
The TODO and State sections are scaffolding: progress trackers, not 
specs. See `references/templates.md` for the format.

Size tasks to fit within a single session. A workable heuristic: a 
blueprint should fit in ~10 TODO items, and its State section should 
contain enough context that a fresh agent could resume from the 
blueprint alone. If a task blows past either, split it.

**Build** — Code freely within design/ boundaries, following the blueprint's 
approach. Check off TODO items as you go. If you discover a better approach 
mid-build, update the blueprint first, then continue. **Each completed TODO 
triggers a State update — immediately on check-off, rather than being 
deferred or optional.** State is the resumption surface; if the session dies between 
TODO 4 and TODO 5, a fresh agent should be able to read State and pick up 
at TODO 5 without inferring from code. When a build-time decision is 
borderline (technically 70% but not obvious), log it in State so review 
can catch it.

**Verify** — Check the implementation against the verification criteria 
defined in Plan. Confirm: does it stay within design/ boundaries? Is 
the scope respected?

Verification needs a *falsifiable* check, not a feeling. Automated tests 
are the default — and TDD (write the failing test first, then the code 
that makes it pass) is the strongest form when the task type allows. 
Other forms are accepted when tests don't fit the work: a contract trace 
that demonstrates the new behavior end-to-end, a manual checklist run 
with evidence captured, a comparison against a known-good state. The 
form depends on the task; the *falsifiability* doesn't. "Looks right to 
me" isn't verification.

For projects where build-time discipline materially affects outcome 
quality, the evidence-driven skill is a sibling overlay that deepens 
this falsifiability rule (TDD cycle, anti-cargo-cult guards, evidence-
trail State). Design-driven works alone without it; evidence-driven 
adds rigor on top when the work calls for it.

**If evidence-driven is installed** (its block is present in the 
project's agent configs), each Verification check-off must cite a 
falsifiable observation when ticked — `[x] tests pass — 14/14 in 
store.test.ts`, not bare `[x]`. The evidence can sit inline next to 
the check or be recorded in State and referenced by line. A 
verification ticked without an observation is rejected on review.

A failing test (or an observation during verify) that reveals something 
DESIGN.md doesn't account for is a **signal about design silence**, not 
a bug to patch around. Either fix DESIGN.md (doc-only drift), raise a 
proposal (shape-level), or add to Constraints / Non-goals — don't mute 
the test.

**Close out** — This step is what keeps DESIGN.md **current state** 
rather than a historical snapshot. Skipping it rots the skeleton 
silently; future tasks can no longer trust DESIGN.md, and the whole 
methodology collapses. Not optional.

Before tearing down scaffolding, reconcile:

- **Doc-only drift** — did this task make any statement in DESIGN.md 
  less accurate? A boundary widened, a mechanism gained a dimension, 
  a constraint became visible, a module's "doesn't" list needs an 
  addition. Update DESIGN.md now, commit separately from code. This 
  is the mechanism that lets the next task just read DESIGN.md and 
  trust it — no archaeology required.
- **Follow-ups** — scope-shaved items worth doing later. Add a 
  `## Follow-ups` section with names and one-line intents. These are 
  forward-looking pending claims — the next task in this area picks 
  them up via its pending-claims scan.
- **Recurring pattern** — if this task's approach is likely to repeat 
  (e.g., "every new read endpoint extends query() with a filter arg"), 
  promote it into DESIGN.md's Key Mechanisms so future tasks inherit 
  it without re-deriving.

Then strip the TODO and State sections (keep Follow-ups), mark status 
as `done`, commit the blueprint with the code.

The blueprint sits between design/ and code in granularity:

```
design/      "The system has a memory layer with shared facts and 
              per-conversation short-term context"

blueprint    "Add semantic search to memory: integrate embedding model, 
              build index on startup, query during context assembly. 
              Reuse existing IMemoryManager interface."

code         The actual embedder, vector store, query functions, tests
```

**Skip the blueprint** for bug fixes, small config changes, or tasks that 
take less time to do than to plan. Skipping the blueprint does not skip 
the design constraint — you still work inside DESIGN.md's boundaries, 
you just don't need a written plan to do it.

**After verify** — done blueprints stay in `blueprints/` as a historical 
record. They're not the next task's source of truth (DESIGN.md + code 
is); they're audit trails and the home for Follow-ups. The folder 
grows over time; if it gets unwieldy, move older ones under 
`blueprints/archive/` rather than deleting them.

## Proposals and Decisions

When a task requires changing the system's shape:

1. Draft the proposal in `design/decisions/NNN-title.md`, where `NNN` 
   is the next unused three-digit number — scan `design/decisions/`, 
   take max+1, pad to three digits (start at `001` if empty). Fill in 
   every section **except** Cold review. See `references/templates.md` 
   for the format.
2. **Dispatch an adversarial cold reviewer** before the human sees it.
   Use the Agent tool with the prompt in 
   `references/cold-review-prompt.md`, passing the DESIGN.md path and 
   the proposal path. The reviewer reads nothing else — no conversation 
   history, no drafts. Paste findings into the Cold review section; 
   address each inline (fix the proposal above, or write a rebuttal). 
   Don't skip this; see the rationale below.
3. Wait for the human to review. Do not edit source code until the 
   proposal is marked `adopted` or `rejected`.
4. If adopted: update DESIGN.md, mark proposal adopted, commit both 
   together.
5. If rejected: record why in Outcome, mark rejected.
6. Then implement freely within the (new) boundaries.

Adopted proposals update DESIGN.md — the proposal file stays as the reasoning 
record. Rejected proposals stay too — so the next person with the same idea 
can see why it was already considered.

**Why the proposal template is heavier than other artifacts** 
(Recommendation + alternatives with strongest cases + pre-mortem + 
adversarial cold review): skeleton rework is expensive, so shape 
decisions get more pressure-testing than implementation decisions. 
A thirty-minute pre-mortem plus a cold review pass is cheap next to 
an un-un-doable module split. If the template feels heavy for a 
given proposal, the proposal is probably too small to be a shape 
change — just code it.

**Why cold review by a subagent, not self-review by the author.** 
The author who just wrote the proposal is the worst person to find 
its blindspots: they already convinced themselves it's right. A 
neutral fresh reviewer is better; an adversarial fresh reviewer — 
explicitly told to assume there's a flaw and hunt for it, like QA 
testing a developer's feature — is better still. Self-check after 
you just wrote it is self-grading your own homework. See 
`references/cold-review-prompt.md` for the reviewer prompt.

## Reading an Existing Design

When design/DESIGN.md already exists, read it before every task. Pay attention to:

1. **Module boundaries** — Which module owns the thing you're touching?
2. **"Doesn't do"** — Is the task something a module explicitly doesn't do?
3. **Key mechanisms** — Does your approach align with established patterns?
4. **Non-goals** — Is the feature explicitly out of scope?

If the task fits within boundaries, just implement — no need to explain yourself.
If it conflicts, surface the conflict before writing code.

## Creating or Updating a Design

- No `design/DESIGN.md` yet → run `/design-driven bootstrap` to explore 
  the codebase and generate the first version. See `references/templates.md` 
  for the DESIGN.md structure and `references/writing-guide.md` for style.
- `design/DESIGN.md` exists but feels out of sync with the code → 
  run `/design-driven audit` to collect drift and reconcile.

## Example walkthrough

For a concrete end-to-end example — one task going through read → decide 
→ plan → build → verify — see `references/example.md`.
