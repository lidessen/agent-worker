# Documentation System

This document describes how documentation is organized in SemaJSX.

---

## Quick Index

| Type         | Purpose              | Location                                          |
| ------------ | -------------------- | ------------------------------------------------- |
| **Internal** | How we build SemaJSX | Root (`*.md`) + `design/` + `tasks/`              |
| **User**     | How to use SemaJSX   | `README.md`, `packages/*/README.md`, `apps/docs/` |

### Internal Documentation

**Core Guides**:
[CLAUDE.md](./CLAUDE.md) |
[CONTRIBUTING.md](./CONTRIBUTING.md) |
[MONOREPO_ARCHITECTURE.md](./MONOREPO_ARCHITECTURE.md) |
[TESTING.md](./TESTING.md) |
[WORKFLOW.md](./WORKFLOW.md)

**Design & Decisions**:
[design/rfcs/](./design/rfcs/) |
[design/designs/](./design/designs/) |
[design/adrs/](./design/adrs/) |
[tasks/](./tasks/)

### User Documentation

**Main**: [README.md](./README.md) | [CHANGELOG.md](./CHANGELOG.md)

**Packages**:
[semajsx](./packages/semajsx/README.md) |
[core](./packages/core/README.md) |
[signal](./packages/signal/README.md) |
[dom](./packages/dom/README.md) |
[ssr](./packages/ssr/README.md) |
[terminal](./packages/terminal/README.md) |
[logger](./packages/logger/README.md) |
[utils](./packages/utils/README.md)

---

## Core Principles

1. **Separate concerns**: Formal documents vs. working documents
2. **Organize by purpose**: Tasks by feature, docs by type
3. **Preserve evolution**: Keep valuable history, discard noise
4. **Reduce duplication**: Single source of truth for each topic

---

## Directory Structure

```
project/
├── WORKFLOW.md              # Development workflow
├── DOCUMENTING.md           # This file
│
├── design/                # Formal documents (permanent, reviewed)
│   ├── rfcs/               # Feature proposals
│   ├── adrs/               # Architecture decisions (cross-cutting)
│   └── guides/             # User guides (optional)
│
├── tasks/                   # Task workspaces (by feature/task)
│   ├── signal-system/
│   │   ├── README.md       # Final design (authoritative)
│   │   ├── EVOLUTION.md    # Evolution record (history)
│   │   ├── adr-*.md        # Task-specific decisions (optional)
│   │   └── research/       # Valuable research (optional)
│   │
│   ├── context-api/
│   └── ssr-islands/
│
└── packages/*/              # Code and collocated docs
    ├── README.md           # Package usage guide
    └── examples/           # Usage examples
```

---

## Two Categories of Documents

### Formal Documents (`design/`)

**Purpose**: Permanent, reviewed, organization-wide significance.

| Type  | Location         | Content                              | Lifecycle                  |
| ----- | ---------------- | ------------------------------------ | -------------------------- |
| RFC   | `design/rfcs/`   | Feature proposals, requirements      | Permanent after acceptance |
| ADR   | `design/adrs/`   | Cross-cutting architecture decisions | Permanent, append-only     |
| Guide | `design/guides/` | User tutorials (if needed)           | Updated with releases      |

**Characteristics**:

- Reviewed before merge
- Stable after acceptance
- Referenced by multiple tasks
- Formal structure (templates)

### Task Workspaces (`tasks/`)

**Purpose**: Working documents for specific features/tasks.

| File           | Purpose      | Content                                       |
| -------------- | ------------ | --------------------------------------------- |
| `README.md`    | Final design | API, usage, architecture (authoritative)      |
| `EVOLUTION.md` | History      | Requirements, research, iterations, learnings |
| `adr-*.md`     | Decisions    | Task-specific architectural choices           |
| `research/`    | Analysis     | Competitive analysis, deep dives              |

**Characteristics**:

- Organized by feature/task
- Evolves during development
- Contains both final state and history
- Self-contained (task-scoped)

---

## Document Lifecycle

### Creation

```
New Task
    │
    ▼
Create tasks/feature-name/
    │
    ├── Start EVOLUTION.md
    │   - Requirement section
    │   - Research section (as you go)
    │
    ├── (Optional) Major feature?
    │   └── Create design/rfcs/YYYY-MM-feature.md
    │
    └── (Optional) Cross-cutting decision?
        └── Create design/adrs/NNN-decision.md
```

### Evolution

```
During Development
    │
    ├── Update EVOLUTION.md
    │   - Add research findings
    │   - Document design iterations
    │   - Record decisions with rationale
    │
    ├── Create drafts (in task directory)
    │   - Delete or consolidate when done
    │
    └── Write code + tests
```

### Completion

```
Task Complete
    │
    ├── Finalize README.md (authoritative design)
    │
    ├── Complete EVOLUTION.md
    │   - Add Learnings section
    │   - Clean up prose
    │
    ├── Clean up
    │   - Delete obsolete drafts
    │   - Keep valuable research
    │
    └── Update CHANGELOG.md
```

---

## EVOLUTION.md Structure

The evolution record captures the journey, not just the destination.

```markdown
# Feature Name - Evolution

## 1. Requirement

- Problem statement
- Success criteria
- Scope boundaries

## 2. Research

- Existing solutions analyzed
- Key findings
- Constraints identified

## 3. Design Iterations

### v1 - Initial Approach

- Description
- Problems discovered

### v2 - Refinement

- Changes from v1
- Rationale

### v3 - Final (see README.md)

- Summary of final approach

## 4. Decisions

- Key choices made
- Alternatives considered
- Trade-offs accepted

## 5. Learnings

- What worked well
- What to do differently
- Knowledge to preserve
```

---

## README.md Structure (Final Design)

The authoritative document for "how it works now."

```markdown
# Feature Name

Brief description.

## API

### `functionName(args)`

Description and usage.

## Architecture

How components interact.

## Usage Examples

// Example code

## Limitations

Known constraints.
```

---

## Document Management

### Promotion

Move valuable content from temporary to permanent locations:

- Research insight → `EVOLUTION.md` Research section
- Design draft → Consolidate into `README.md`
- Repeated decision → Extract to `design/adrs/`

### Cleanup

After task completion:

- Delete obsolete drafts
- Consolidate scattered notes into `EVOLUTION.md`
- Remove duplicate information
- Keep only valuable research materials

### Consolidation

Periodically:

- Merge related ADRs if they form a coherent topic
- Archive completed tasks that are no longer relevant
- Update cross-references

---

## Relationship Between Documents

```
design/rfcs/feature.md          tasks/feature/              packages/*/
        │                            │                          │
        │  "What & Why"              │  "How"                   │  "Code"
        │                            │                          │
        └──────────────► README.md ◄─────────────────► Implementation
                         (design)                        (source)
                             │
                             │
                       EVOLUTION.md
                         (history)
```

- **RFC** → Defines requirements (input to task)
- **README.md** → Final design (synced with code)
- **EVOLUTION.md** → How we got here (reference)
- **Code** → Implementation (source of truth for behavior)

---

## When to Create What

| Situation              | Action                                             |
| ---------------------- | -------------------------------------------------- |
| Starting new feature   | Create `tasks/feature-name/`, start `EVOLUTION.md` |
| Major feature proposal | Create RFC in `design/rfcs/`                       |
| Cross-cutting decision | Create ADR in `design/adrs/`                       |
| Task-specific decision | Add to `EVOLUTION.md` or `tasks/feature/adr-*.md`  |
| Research findings      | Add to `EVOLUTION.md` Research section             |
| Design complete        | Write `tasks/feature/README.md`                    |
| Task complete          | Complete `EVOLUTION.md` Learnings section          |

---

## Templates

### RFC Template

See `design/rfcs/template.md`

### ADR Template

See `design/adrs/template.md`

### Task README Template

```markdown
# Feature Name

Brief description of what this feature does.

## API

### Core Functions

#### `functionName(param: Type): ReturnType`

Description.

**Parameters:**

- `param` - Description

**Returns:** Description

**Example:**
// usage code here

## Architecture

Describe how components work together.

## Usage

### Basic Usage

// example code here

### Advanced Usage

// example code here

## Limitations

- Known limitation 1
- Known limitation 2
```

### EVOLUTION Template

```markdown
# Feature Name - Evolution

## 1. Requirement

### Problem

What problem are we solving?

### Success Criteria

How do we know we're done?

### Scope

What's in and out of scope?

## 2. Research

### Existing Solutions

- Solution A: pros/cons
- Solution B: pros/cons

### Key Findings

- Finding 1
- Finding 2

### Constraints

- Constraint 1
- Constraint 2

## 3. Design Iterations

### v1 - [Date] Initial Approach

Description of first attempt.

**Issues:**

- Problem discovered

### v2 - [Date] Refinement

Changes made and why.

### v3 - Current

See README.md for final design.

## 4. Decisions

### Decision 1: [Topic]

**Choice:** X
**Alternatives:** Y, Z
**Rationale:** Why X over Y and Z

## 5. Learnings

### What Worked

- Thing 1
- Thing 2

### What to Improve

- Area 1
- Area 2

### For Future Reference

- Insight 1
- Insight 2
```

---

## Quick Reference

| I need to...                  | Go to                            |
| ----------------------------- | -------------------------------- |
| Understand a feature's design | `tasks/feature/README.md`        |
| See why decisions were made   | `tasks/feature/EVOLUTION.md`     |
| Find feature requirements     | `design/rfcs/` or `EVOLUTION.md` |
| See cross-cutting decisions   | `design/adrs/`                   |
| Learn how to use a package    | `packages/*/README.md`           |

See [WORKFLOW.md](./WORKFLOW.md) for development process.
