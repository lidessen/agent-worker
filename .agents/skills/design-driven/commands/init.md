# design-driven:init — First-time project setup

Configure a project for design-driven development. Run once when adopting 
the methodology on an existing or new project.

The specifics depend on the project and the AI tools being used — figure 
out what fits and implement it. The goals below are what matter.

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
- Design changes get their own commit, separate from code changes
- For non-trivial tasks, follow Plan → Build → Verify: write a blueprint 
  in `blueprints/`, track progress with TODO (scaffolding), verify against 
  the blueprint when done, then strip the TODO and keep the blueprint

Check which of these files already exist in the project and update them. 
Don't create config files for tools the project doesn't use.

### 2. Directory structure

Create these directories with .gitkeep so the convention is visible from 
day one:

- `design/` and `design/decisions/` — architectural skeleton and decision records
- `blueprints/` — task-level implementation records

### 3. Initial design

If no design/DESIGN.md exists yet, run the `init` command to explore the 
codebase and generate the first version. If the project is brand new, 
write DESIGN.md from scratch following the format in the main skill.

### 4. Hooks (optional)

Set up hooks to reinforce design-driven discipline. For hook types and 
general methodology (prompt vs script, consistency checks), the harness 
skill covers this — here are the design-driven-specific hooks:

**Boundary check** — After editing source files, remind to verify the 
change stays within design/ boundaries. Especially useful when files 
span multiple modules.

**Design-code separation** — Before commit, check whether files under 
`design/` are staged together with source files. If so, remind that 
design changes should be committed separately. Don't block — just remind.

### 5. Commit

Commit the `design/` directory, `blueprints/` directory, agent config 
updates, and hook together as the initial design-driven setup.
