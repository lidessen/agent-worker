# Design Documents

Technical design documents for features and systems.

---

## When to Create

✅ **Create design doc for:**

- Major features (with or without RFC)
- Architectural changes
- Complex implementations
- Multiple viable approaches

❌ **Don't create for:**

- Simple bug fixes
- Trivial features
- Documentation-only changes

---

## Lifecycle

```
RFC (if major) → Draft Design → Review → Approve → Implement → Mark Implemented
```

**Multiple iterations?** Use `.workspace/drafts/` for versions, then move final here.

---

## Naming

```
feature-name-design.md
```

Examples: `context-api-design.md`, `logger-api-design.md`

---

## What to Include

1. **Overview** - High-level summary
2. **Design Principles** - Guiding principles
3. **Architecture** - System structure, data flow
4. **API Design** - Public interfaces, examples
5. **Implementation Details** - Algorithms, edge cases
6. **Alternatives** - What you didn't choose and why
7. **Testing** - How to verify

See [template.md](./template.md) for full structure.

---

## Status

- **Draft** - Work in progress
- **In Review** - Ready for feedback
- **Approved** - Ready for implementation
- **Implemented** - Feature is built
- **Deprecated** - No longer relevant

---

## Existing Designs

| Document                                             | Feature         | Status      |
| ---------------------------------------------------- | --------------- | ----------- |
| [context-api-design.md](./context-api-design.md)     | Context API     | Implemented |
| [logger-api-design.md](./logger-api-design.md)       | Terminal Logger | Implemented |
| [ssr-html-entry-build.md](./ssr-html-entry-build.md) | SSR HTML Entry  | Implemented |
