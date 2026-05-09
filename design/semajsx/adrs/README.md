# ADRs (Architecture Decision Records)

Lightweight records of important architectural decisions.

---

## What is an ADR?

A short document (1-2 pages) recording:

- **Context** - Why this decision?
- **Decision** - What we chose
- **Rationale** - Why this choice?
- **Consequences** - Impact (pros/cons)
- **Alternatives** - What we didn't choose

ADRs are **immutable** - once accepted, create new ADR to supersede instead of editing.

---

## When to Create

✅ **Create ADR for:**

- Significant architectural decisions
- Choosing between multiple alternatives
- Long-term impact decisions
- Need to explain rationale to future devs

❌ **Not ADR-worthy:**

- Tooling choices (prettier, etc.)
- Implementation details
- Maintenance tasks

**Examples**: "Use signals for reactivity", "Adopt monorepo structure", "TypeScript Native as type checker"

---

## Naming

```
NNNN-decision-title.md
```

Sequential numbering: `0001`, `0002`, `0003`...  
Examples: `0001-use-signals-for-reactivity.md`, `0002-monorepo-with-bun-workspaces.md`

---

## Status

- **Proposed** - Under discussion
- **Accepted** - Decision made
- **Deprecated** - Outdated, no replacement
- **Superseded** - Replaced by newer ADR

**Important**: Once accepted, don't edit. Create new ADR to supersede.

---

## Template

Use [template.md](./template.md) - includes:

- Context & Decision
- Rationale & Consequences
- Alternatives

---

## Existing ADRs

None yet. Create the first one!
