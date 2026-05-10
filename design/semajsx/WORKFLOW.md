# Development Workflow

Standard development workflow for SemaJSX, optimized for AI Agent execution.

## Overview

```
Requirement → Research → Design → Implementation → Test → Learn
```

**Purpose**: Flexible but structured approach ensuring quality, traceability, and knowledge preservation.

**Agent-Oriented**: Workflow emphasizes automated validation, dependency tracking, and task-based execution rather than time-based planning.

**Adapt to scale**: Use full process for major features, simplified for minor changes.

---

## Stages

### 1. Requirement

**Goal**: Define the problem and success criteria.

**Activities**:

- Clarify what problem to solve and why
- Define scope boundaries
- Identify success metrics
- Draft RFC for major features

**Output**:

- RFC document (`design/rfcs/YYYY-MM-feature.md`) for major features
- Task directory created (`tasks/feature-name/`)
- Initial `EVOLUTION.md` with Requirement section

**When**: All features (scope varies by size).

---

### 2. Research

**Goal**: Gather context and explore solution space.

**Activities**:

- Analyze existing codebase patterns
- Research external solutions (libraries, frameworks)
- Identify constraints and dependencies
- Document key findings

**Output**:

- Research notes in `tasks/feature-name/EVOLUTION.md` (Research section)
- Optional: `tasks/feature-name/research/` for detailed analysis

**When**: Unfamiliar territory, multiple solution paths, integration with external systems.

---

### 3. Design

**Goal**: Determine how to implement and document trade-offs.

**Activities**:

- Draft API designs
- Create architecture diagrams (if needed)
- Evaluate alternatives
- Record key decisions (ADRs)

**Output**:

- Design iterations in `EVOLUTION.md` (Design Iterations section)
- Final design in `tasks/feature-name/README.md`
- ADRs for significant decisions (`design/adrs/` or `tasks/feature-name/adr-*.md`)

**When**: After research, or directly for smaller features.

---

### 4. Implementation

**Goal**: Turn design into working code.

**Activities**:

- Write code following design
- Create unit tests alongside code
- Update examples
- Small atomic commits

**Output**:

- Source code (`packages/*/src/`)
- Tests (`*.test.ts`) collocated with source
- Examples (`packages/*/examples/`)

**Git**: Small atomic commits, reference task in commits.

---

### 5. Test

**Goal**: Validate implementation meets requirements.

**Activities**:

- Run full test suite
- Verify coverage targets (usually ≥80%)
- Type checking and linting
- Performance validation (if applicable)
- Manual testing of examples

**Validation Commands**:

```bash
bun run build        # Build passes
bun run test         # All tests pass
bun run typecheck    # TypeScript strict mode
bun run lint         # No lint errors
```

**Output**:

- All validations pass
- Coverage report
- Performance metrics (if applicable)

---

### 6. Learn

**Goal**: Extract knowledge and improve process.

**Activities**:

- Document what worked and what didn't
- Update `EVOLUTION.md` with Learnings section
- Finalize `README.md` as authoritative design doc
- Update CHANGELOG.md
- Clean up temporary files

**Output**:

- Complete `tasks/feature-name/README.md` (final design)
- Complete `tasks/feature-name/EVOLUTION.md` (full history)
- CHANGELOG.md updated
- Temporary files cleaned

---

## When to Use Each Stage

```rust
match change {
    // Full workflow - all stages with depth
    Major | Breaking | Architectural => {
        Requirement(RFC) >> Research(Deep) >> Design(Full)
            >> Impl >> Test >> Learn
    }

    // Simplified workflow - lighter documentation
    Minor | Enhancement | Refactor => {
        Requirement(Brief) >> Research(Quick) >> Design(Brief)
            >> Impl >> Test >> Learn(Brief)
    }

    // Minimal workflow - just fix and verify
    BugFix => Requirement(IssueRef) >> Research(AsNeeded) >> Impl >> Test,

    // Direct change - no workflow overhead
    Typo | DocsUpdate => Impl,
}
```

**Decision helper**:

```rust
match (scope, uncertainty) {
    (Large, High)  => full_workflow(),       // RFC + deep research + full design
    (Large, Low)   => simplified_workflow(), // brief research + design
    (Small, High)  => Research >> Impl >> Test,
    (Small, Low)   => Impl >> Test,
}
```

---

## Task Lifecycle

```
1. Create task directory
   └── tasks/feature-name/
       ├── EVOLUTION.md (start documenting)
       └── (research/, drafts/ as needed)

2. Work through stages
   └── Update EVOLUTION.md as you go

3. Complete task
   └── tasks/feature-name/
       ├── README.md     (final design - authoritative)
       ├── EVOLUTION.md  (full history - reference)
       └── (clean up temporary files)
```

---

## AI Agent Execution

This workflow is optimized for AI Agent-driven development.

### Agent Behavior by Stage

**Requirement**: Parse user request, create task directory, draft initial scope

**Research**: Search codebase, fetch external docs, document findings

**Design**: Generate alternatives, evaluate trade-offs, propose solution

**Implementation**: Write code and tests, atomic commits

**Test**: Run validation commands, fix failures, re-validate

**Learn**: Write retrospective, update docs, clean up

### Critical Rules

1. Always validate after implementation changes
2. Update `EVOLUTION.md` throughout the process
3. Never skip test stage
4. Document decisions as they're made, not after
5. Use complexity ratings, not time estimates

---

## Quick Reference

| I want to...         | Action                                             |
| -------------------- | -------------------------------------------------- |
| Start new feature    | Create `tasks/feature-name/`, start `EVOLUTION.md` |
| Record a decision    | Add to `EVOLUTION.md` or create ADR                |
| Propose major change | Create RFC in `design/rfcs/`                       |
| See design rationale | Check `tasks/feature-name/EVOLUTION.md`            |
| Find final design    | Check `tasks/feature-name/README.md`               |

See [DOCUMENTING.md](./DOCUMENTING.md) for documentation system details.
