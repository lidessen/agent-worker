# ADR-NNNN: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded
**Superseded by**: ADR-XXXX (if applicable)
**Related RFC**: `design/rfcs/YYYY-MM-DD-feature.md` (if applicable)
**Related Design**: `design/designs/feature-design.md` (if applicable)

---

## Context

### What is the issue we're facing?

Describe the technical, business, or architectural context that requires a decision:

- What problem are we trying to solve?
- What constraints exist?
- What forces are at play?
- Why do we need to make a decision now?

### Current Situation

- How does the system work today?
- What are the pain points?
- What triggered this decision?

---

## Decision

**We will [decision statement].**

Be clear and specific about what you're deciding. Use active voice.

### Examples:

- "We will use TypeScript for all new code."
- "We will adopt a monorepo structure using Bun workspaces."
- "We will implement signals using fine-grained reactivity."

---

## Rationale

### Why did we make this decision?

List the key reasons supporting this decision:

1. **Reason 1**: [Explanation]
   - Supporting evidence
   - Relevant data or examples

2. **Reason 2**: [Explanation]
   - Supporting evidence
   - Relevant data or examples

3. **Reason 3**: [Explanation]
   - Supporting evidence
   - Relevant data or examples

### Key Factors Considered

| Factor               | Weight | Impact on Decision               |
| -------------------- | ------ | -------------------------------- |
| Performance          | High   | Significant improvement expected |
| Developer Experience | High   | Simplifies workflow              |
| Maintainability      | Medium | Easier to maintain long-term     |
| Cost                 | Low    | Minimal additional cost          |

---

## Consequences

### Positive Consequences

What benefits do we expect from this decision?

- ✅ **Benefit 1**: [Description]
- ✅ **Benefit 2**: [Description]
- ✅ **Benefit 3**: [Description]

### Negative Consequences

What drawbacks or costs come with this decision?

- ❌ **Drawback 1**: [Description]
  - **Mitigation**: How we'll address this

- ❌ **Drawback 2**: [Description]
  - **Mitigation**: How we'll address this

### Neutral Consequences

Changes that are neither clearly positive nor negative:

- ⚪ **Change 1**: [Description]
  - **Implication**: What this means

- ⚪ **Change 2**: [Description]
  - **Implication**: What this means

---

## Alternatives Considered

### Alternative A: [Name]

**Description**: What this alternative entailed

**Pros**:

- Pro 1
- Pro 2

**Cons**:

- Con 1
- Con 2

**Why not chosen**: Primary reason for rejection

### Alternative B: [Name]

**Description**: What this alternative entailed

**Pros**:

- Pro 1
- Pro 2

**Cons**:

- Con 1
- Con 2

**Why not chosen**: Primary reason for rejection

### Do Nothing

**What happens if we don't make a change?**

- Consequence 1
- Consequence 2

**Why this is not acceptable**: Reason

---

## Implementation

### What needs to change?

- [ ] Code changes required
- [ ] Documentation updates required
- [ ] Testing strategy needed
- [ ] Team training needed
- [ ] Migration path defined

### Timeline

- **Decision Date**: YYYY-MM-DD
- **Implementation Start**: YYYY-MM-DD
- **Target Completion**: YYYY-MM-DD
- **Review Date**: YYYY-MM-DD (when we'll review if this was the right decision)

### Owner

- **Decision Owner**: [Name/Role]
- **Implementation Owner**: [Name/Role]

---

## Compliance

### Does this decision require changes to:

- [ ] Architecture documentation
- [ ] API contracts
- [ ] Security policies
- [ ] Coding standards
- [ ] Deployment procedures
- [ ] Testing strategy

### Stakeholder Communication

Who needs to be informed about this decision?

- [ ] Engineering team
- [ ] Product team
- [ ] Design team
- [ ] External users/community

---

## Validation

### How will we validate this decision?

Define success criteria and how you'll measure them:

- **Metric 1**: [How we'll measure success]
- **Metric 2**: [How we'll measure success]
- **Metric 3**: [How we'll measure success]

### Review Trigger

When should we review this decision?

- Time-based: Review in 6 months
- Event-based: Review after X projects use this
- Metric-based: Review if success metrics not met

---

## Related Decisions

### Dependencies

This decision depends on:

- ADR-XXXX: [Title]
- ADR-YYYY: [Title]

### Influences

This decision influences:

- ADR-ZZZZ: [Title]
- Future decision area: [Description]

### Conflicts

This decision conflicts with or supersedes:

- ADR-WWWW: [Title] - [How resolved]

---

## Notes

### Assumptions

- Assumption 1: [What we're assuming]
- Assumption 2: [What we're assuming]

### Constraints

- Constraint 1: [What limits our options]
- Constraint 2: [What limits our options]

### Risks

| Risk   | Impact          | Mitigation         |
| ------ | --------------- | ------------------ |
| Risk 1 | High/Medium/Low | How we'll mitigate |
| Risk 2 | High/Medium/Low | How we'll mitigate |

---

## References

- [Link to related documents]
- [Link to research]
- [Link to discussions]
- [Link to external resources]

---

## Change History

| Date       | Change        | Author |
| ---------- | ------------- | ------ |
| YYYY-MM-DD | Initial draft | [Name] |
| YYYY-MM-DD | Accepted      | [Name] |
| YYYY-MM-DD | Updated       | [Name] |

---

## Template Notes

**Remove this section when creating a real ADR**

### When to Create an ADR

Create an ADR when:

- Making significant architectural decisions
- Choosing between multiple viable alternatives
- Decisions will have long-term impact
- Need to explain rationale to future developers

### ADR Numbering

- Use sequential numbering: 0001, 0002, 0003, etc.
- Never reuse numbers
- Keep chronological order

### ADR Status Lifecycle

1. **Proposed**: Initial draft, under discussion
2. **Accepted**: Decision made and approved
3. **Deprecated**: No longer recommended but not replaced
4. **Superseded**: Replaced by a newer decision (link to new ADR)

### Writing Tips

- **Be concise**: 1-2 pages is ideal
- **Be specific**: Avoid vague language
- **Be honest**: Document trade-offs
- **Be practical**: Focus on actionable information
- **Think future**: Write for people 2 years from now

### Examples of Good ADRs

- ADR-0001: Use Signals for Reactivity
- ADR-0002: Adopt Monorepo with Bun Workspaces
- ADR-0003: TypeScript Native (tsgo) as Default Type Checker
