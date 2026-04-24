# design-driven:init — First-time project setup

One-time plumbing for a project adopting design-driven development: 
agent configs, empty directories, optional hooks. Run once when adopting 
the methodology.

This command does **not** generate DESIGN.md. For that, run 
`/design-driven bootstrap` after init — or instead of init, since 
bootstrap handles plumbing idempotently.

If the project doesn't yet have an overall agent context architecture 
(CLAUDE.md, layer structure), consider setting that up first — the harness 
skill covers this. Design-driven focuses specifically on the architectural 
documentation layer (L2).

## Steps

### 1. AI agent config (most important)

Add design-driven instructions to every AI agent config the project uses.
Common locations:

- `CLAUDE.md` — Claude Code
- `.cursorrules` — Cursor
- `AGENTS.md` or `codex.md` — Codex / OpenAI agents
- `.github/copilot-instructions.md` — GitHub Copilot
- `.windsurfrules` — Windsurf
- Any other agent instruction file the project uses

The instruction should communicate:

- The `design/` directory contains the architectural source of truth — 
  read it before starting any development task
- If your change would alter the system's shape, propose a design change 
  in `design/decisions/` and get approval before coding
- **Commit rhythm:** design changes get their own commit, separate from 
  code. Blueprints can be committed together with the code they describe 
  (or just before, so the plan-record predates the build).
- For non-trivial tasks, follow Plan → Build → Verify: write a blueprint 
  in `blueprints/`, track progress with TODO (scaffolding), verify against 
  the blueprint when done, then strip the TODO and keep the blueprint

Check which of these files already exist in the project and update them. 
Don't create config files for tools the project doesn't use.

A minimal paste-ready snippet — append it to each agent config, adjusted 
for the project's tone:

```markdown
## Design-driven development

Before any non-trivial work, read `design/DESIGN.md` to understand the 
system's shape (modules, boundaries, mechanisms). Stay within those 
boundaries.

If the task would change the shape (add/remove/merge modules, change 
how they connect, alter a key mechanism), stop and write a proposal in 
`design/decisions/NNN-title.md` — don't edit source code until it's 
marked adopted. Design changes commit separately from code.

For non-trivial tasks, write a blueprint in `blueprints/<task-name>.md` 
with verification criteria up front. Track progress via its TODO 
section; strip TODO and State after verify, keep the rest as a record.

Skip the blueprint for bug fixes, small config changes, or anything 
that takes less time to do than to plan.
```

Trim or expand to match the project's conventions; the goal is the 
rules land in the config, not a specific wording.

### 2. Directory structure

Create these directories with `.gitkeep` so the convention is visible from 
day one:

- `design/` and `design/decisions/` — architectural skeleton and decision records
- `blueprints/` — task-level implementation records

### 3. Hooks (optional)

Set up hooks to reinforce design-driven discipline. The harness skill 
covers hook methodology (prompt vs script, consistency checks) and the 
hookify skill can generate the config — here are the design-driven-specific 
hooks worth wiring, in rough order of value:

**Proposal gate (PreToolUse on Edit/Write)** — If any file under 
`design/decisions/` has `Status: proposed`, block edits to source files 
(paths outside `design/` and `blueprints/`) until the proposal is marked 
`adopted` or `rejected`. This is the strongest lever: proposal review is 
the easiest step to skip, and a hook makes it structural rather than advisory.

**Boundary reminder (SessionStart or PreToolUse)** — When work begins on 
a source file, remind the agent to read `design/DESIGN.md` first. Concrete 
form: a PreToolUse hook on Edit/Write that echoes "Check which module this 
file belongs to in design/DESIGN.md before editing" when `design/` exists.

**Design-code separation (pre-commit reminder)** — Check whether files 
under `design/` are staged together with source files. If so, remind that 
design changes should be committed separately. Don't block — just remind.

Ask the user which of these they want before generating configs. For the 
concrete hook JSON, delegate to the hookify skill.

### 4. Commit

Commit the `design/` and `blueprints/` directories, agent config updates, 
and any hook configs together as the initial design-driven setup.

### 5. Next step

If the project already has code but no DESIGN.md, run 
`/design-driven bootstrap` to generate the first version. 
If the project is brand new, write DESIGN.md by hand following 
`../references/templates.md`.
