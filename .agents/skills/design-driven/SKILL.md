---
name: design-driven
description: |
  Design-driven development methodology. The design/ directory is the single 
  source of architectural truth — read it before coding, stay within its 
  boundaries, and when the system's shape needs to change, update the design 
  first.

  Use this skill whenever starting any development work on this project. Also 
  use when the user asks to: create or update architecture docs, add a new 
  module or feature that might cross existing boundaries, refactor system 
  structure, or understand the codebase architecture. Trigger on phrases like 
  "design first", "update the design", "does this change the architecture", 
  "write a design for", "what's the current design", or when onboarding to 
  understand a codebase's shape.

  Supports arguments: `/design-driven init` to configure a project for 
  design-driven development, `/design-driven bootstrap` to generate 
  design from an existing codebase.
argument-hint: "[init | bootstrap]"
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

- `/design-driven init` → Read and follow `commands/init.md` in this skill directory.
  First-time project configuration (agent configs, hooks, directory structure).
- `/design-driven bootstrap` → Read and follow `commands/bootstrap.md` in this skill directory.
  Generate the initial `design/` directory from an existing codebase.
- No argument → Continue with the methodology below (the normal loop).

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
If you're unsure, it probably doesn't — just code.

## Implementation: Plan → Build → Verify

**Plan** — Read design/, understand the task, write a blueprint in 
`blueprints/<task-name>.md`. Define verification criteria upfront — how 
will you know this task is done? The TODO section is scaffolding: a 
progress tracker, not a spec. See `references/templates.md` for the format.

Size tasks to fit within a single session. If a task feels too large to 
hold in your head at once, split it into smaller blueprints.

**Build** — Code freely within design/ boundaries, following the blueprint's 
approach. Check off TODO items as you go. If you discover a better approach 
mid-build, update the blueprint first, then continue. Update the State 
section with decisions made and current progress, so work can resume if 
the session is interrupted.

**Verify** — Check the implementation against the verification criteria 
defined in Plan. Then confirm: does it stay within design/ boundaries? 
Is the scope respected? Once verified, tear down the scaffolding: remove 
the TODO and State sections, mark status as `done`.

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
take less time to do than to plan.

## Proposals and Decisions

When a task requires changing the system's shape:

1. Write a proposal in `design/decisions/NNN-title.md` 
   (see `templates.md` for the format)
2. Wait for the human to review
3. If adopted: update DESIGN.md, mark proposal adopted, commit both together
4. If rejected: record why in Outcome, mark rejected
5. Then implement freely within the (new) boundaries

Adopted proposals update DESIGN.md — the proposal file stays as the reasoning 
record. Rejected proposals stay too — so the next person with the same idea 
can see why it was already considered.

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

## Reading an Existing Design

When design/DESIGN.md already exists, read it before every task. Pay attention to:

1. **Module boundaries** — Which module owns the thing you're touching?
2. **"Doesn't do"** — Is the task something a module explicitly doesn't do?
3. **Key mechanisms** — Does your approach align with established patterns?
4. **Non-goals** — Is the feature explicitly out of scope?

If the task fits within boundaries, just implement — no need to explain yourself.
If it conflicts, surface the conflict before writing code.

## Creating a Design from Scratch

When no design/DESIGN.md exists, run `/design-driven bootstrap` to explore the 
codebase and generate the first version. See `references/templates.md` for the DESIGN.md 
structure and `references/writing-guide.md` for style guidance.
