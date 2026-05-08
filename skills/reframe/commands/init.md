# reframe:init — First-time project setup

One-time plumbing for a project adopting reframe: create the
`concepts/` working directory and tell agent configs how to recognize
an active concept document.

This command does **not** start a reframe. To start one, run `/reframe`
(no argument) after init — or skip init and let the no-arg flow create
the directory inline.

If the project doesn't yet have an overall agent context architecture
(CLAUDE.md, layer structure), set that up first — the harness skill
covers this. Reframe attaches to the design layer (L2) but only
during exploration of unsettled territory.

## Steps

### 1. AI agent config

Add a reframe-aware instruction to every agent config the project
uses. Common locations:

- `CLAUDE.md` — Claude Code
- `.cursorrules` — Cursor
- `AGENTS.md` or `codex.md` — Codex / OpenAI agents
- `.github/copilot-instructions.md` — GitHub Copilot
- `.windsurfrules` — Windsurf

The instruction should communicate:

- `concepts/` may contain in-progress redefinition documents for
  systems whose design is not yet settled
- Before working on a system whose name matches an active concept
  document, read that document — it captures essence, primitives,
  and skeleton the rest of the codebase should align with
- For brand-new design work in unsettled territory (AI-native,
  agent-first, post-mobile paradigms), invoke `/reframe` rather than
  jumping straight to design-driven

A minimal paste-ready snippet — append to each agent config and tune
to the project's tone:

```markdown
## Reframe — designing in unsettled territory

If a task involves designing in territory where the industry hasn't
settled on shape (AI-native, agent-first, post-mobile paradigms),
invoke `/reframe` instead of jumping straight to architecture.

`concepts/` holds active redefinition documents. Before building or
modifying a system whose target matches an active concept document
(check `status: active` in the frontmatter), read the document first
— its skeleton is what the rest of the codebase aligns with. Don't
bypass a settled concept doc.
```

Check which configs already exist; only update those.

### 2. Directory structure

Create:

- `concepts/` with `.gitkeep` — active concept documents live here
- `concepts/archive/` with `.gitkeep` — closed documents land here
  via `/reframe close`

```
concepts/
  .gitkeep
  archive/
    .gitkeep
```

### 3. Optional: design-driven crosswalk

If the project also uses design-driven, add a one-liner to `design/DESIGN.md`
(or wherever the architectural skeleton lives) noting that:

> Systems whose category is still forming live under `concepts/` until
> closed. When a concept is closed via `/reframe close`, fold its
> resolved skeleton into DESIGN.md and link the archived concept doc
> as historical context.

This prevents the two skills from drifting apart — concepts/ is the
*pre-architectural* sketchbook; design/ is the architecture once it
settles.

### 4. Commit

Commit the empty directories, agent config updates, and any DESIGN.md
crosswalk together as the initial reframe setup.

### 5. Next step

To start a reframe immediately after init, run `/reframe` (no
argument) and answer "what would you like to reframe?".
