# Internal Development Documentation

Documentation for **contributors, maintainers, and AI assistants** building SemaJSX.

**For users**: See [README.md](../README.md), package READMEs, and [apps/docs/content/](../apps/docs/content/)

---

## Structure

```
design/
├── rfcs/                # Feature proposals
├── designs/             # Technical designs
├── adrs/                # Architecture decisions
└── ROADMAP.md           # Project roadmap
```

---

## Documents

### [workflow.md](./workflow.md)

Development process: Discovery → Design → Implementation → Verification → Archive

### [rfcs/](./rfcs/)

Feature proposals and requirements. Create when proposing major features or breaking changes.

**Existing**: None yet

### [designs/](./designs/)

Technical design documents with implementation details.

**Existing**:

- [context-api-design.md](./designs/context-api-design.md)
- [logger-api-design.md](./designs/logger-api-design.md)
- [ssr-html-entry-build.md](./designs/ssr-html-entry-build.md)

### [adrs/](./adrs/)

Architecture Decision Records for significant technical choices.

**Existing**: None yet

---

## Quick Start

**New contributor?**

1. Read [workflow.md](./workflow.md)
2. Check [CONTRIBUTING.md](../CONTRIBUTING.md)
3. Review existing [designs/](./designs/)

**Designing a feature?**

1. Create RFC in `rfcs/` (for major features)
2. Draft design in `.workspace/drafts/`
3. Finalize in `designs/`
4. Record key decisions in `adrs/`

**AI assistant?**
Start with [CLAUDE.md](../CLAUDE.md), then [workflow.md](./workflow.md)

---

## Temporary Workspace

Use `.workspace/` for drafts and experiments (git-ignored):

- `research/` - Research materials
- `drafts/` - Design iterations
- `discussions/` - Meeting notes
- `experiments/` - Prototype code

---

See [DOCUMENTING.md](../DOCUMENTING.md) for complete documentation index.
