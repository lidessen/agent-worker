# RFCs (Request for Comments)

Formal proposals for new features or significant changes.

---

## When to Create

✅ **Create RFC for:**

- Major features
- Breaking changes
- New concepts/paradigms
- Unclear scope needing discussion

❌ **Don't create RFC for:**

- Bug fixes
- Minor enhancements
- Documentation updates

---

## Process

```
Draft → Discussion → Review → Decision → Design Phase
```

1. **Draft**: Use [template.md](./template.md)
2. **Discussion**: Gather feedback, iterate
3. **Review**: Present to stakeholders
4. **Decision**: Accept, Reject, or Defer
5. **Design**: Create design doc in `../designs/`

---

## Naming

```
YYYY-MM-feature-name.md
```

Examples: `2025-08-signal-reactivity.md`, `2025-09-context-api.md`

---

## Status

- **Draft** - Work in progress
- **In Review** - Ready for feedback
- **Accepted** - Approved for implementation
- **Rejected** - Not moving forward
- **Superseded** - Replaced by newer RFC
- **Implemented** - Feature is complete

---

## Existing RFCs

| RFC                                                                        | Feature                  | Date    | Status      |
| -------------------------------------------------------------------------- | ------------------------ | ------- | ----------- |
| [2025-08-signal-reactivity.md](./2025-08-signal-reactivity.md)             | Signal-based Reactivity  | 2025-08 | Implemented |
| [2025-08-dual-rendering-targets.md](./2025-08-dual-rendering-targets.md)   | DOM + Terminal Rendering | 2025-08 | Implemented |
| [2025-09-context-api.md](./2025-09-context-api.md)                         | Context API              | 2025-09 | Implemented |
| [2025-10-terminal-logger.md](./2025-10-terminal-logger.md)                 | Terminal Logger          | 2025-10 | Implemented |
| [2025-11-ssr-island-architecture.md](./2025-11-ssr-island-architecture.md) | SSR Islands              | 2025-11 | Implemented |

---

## Template

Use [template.md](./template.md) for new RFCs.
