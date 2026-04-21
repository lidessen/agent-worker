# harness:init — First-time project setup

Set up the foundational context architecture for a new or un-configured 
project. The goal is to give any agent working in this project the right 
information at the right layer from day one.

## Process

### 1. Understand the project

Before writing anything, explore:

```
Shape        What is this project? (language, framework, monorepo/single)
             Look at: package manifests, build config, directory structure

Scale        How complex is it? (single service, multi-module, microservices)
             This determines how much L1/L2 structure is needed

Tooling      Which AI tools does the team use?
             Look at: existing CLAUDE.md, .cursorrules, AGENTS.md, etc.

Workflow     How does the team develop? (PR flow, CI, deploy)
             Look at: .github/, Makefile, scripts/, CI config
```

### 2. Design the layer structure

Based on project complexity, decide what goes where:

**Small project** (single module, <10k LOC):
- L1: CLAUDE.md with build commands + key conventions
- L2: Probably not needed yet
- L3: Code speaks for itself

**Medium project** (multiple modules, 10k–100k LOC):
- L1: CLAUDE.md with architecture overview + build commands
- L2: design/DESIGN.md for module boundaries (consider design-driven skill)
- L3: Supporting docs as needed

**Large project** (many modules, >100k LOC):
- L1: CLAUDE.md (lean — pointers to L2, not content)
- L2: design/ directory, installed skills, per-module docs
- L3: Reference files, scripts, detailed specs

### 3. Write L1 — CLAUDE.md

Create CLAUDE.md with only what changes agent decisions:

1. **One-line project description** — what is this
2. **Build/test/run commands** — the exact commands, no explanation
3. **Architecture** — module boundaries and how they connect (or pointer 
   to design/ if it exists). ASCII diagram if helpful.
4. **Non-obvious conventions** — naming patterns, file organization rules, 
   architectural constraints that aren't visible from code structure

Run the litmus test on every line before including it.

If other AI tool configs exist (.cursorrules, etc.), update them too — 
but keep the source of truth in one place and point others to it.

### 4. Set up L2 if needed

For medium+ projects, the most common L2 need is architectural documentation 
— a `design/` directory with module boundaries, data flow, key mechanisms, 
and decision records. This gives the agent the structural awareness to work 
within the system's shape rather than guessing. The design-driven skill can 
help bootstrap this.

Also check:
- Are installed skills' L1 metadata (description) precise enough for 
  trigger matching?
- Are there existing docs that should be promoted to L2?

### 5. Set up hooks if applicable

Hooks are zero-cost in context but high-value in consistency. Two flavors:

**Prompt hooks** — Inject a reminder into the agent's context after an 
action. Lightweight, no scripts needed, and the agent applies judgment 
rather than rigid checks. Best for checks that need context awareness 
(layer integrity, architectural boundaries, description quality). Example:
```json
{
  "type": "prompt",
  "prompt": "If you just edited CLAUDE.md, check: does every line pass 
  the L1 litmus test? Would removing it cause a worse decision?"
}
```

**Script hooks** — Run a command that exits 0 (pass) or 2 (block). Best 
for mechanical checks that don't need judgment (linting, format validation, 
forbidden patterns).

Common hook suggestions:
- **Consistency after change** — prompt hook on Stop (end of turn), 
  reminding to check all files that reference what was just changed. 
  Put this on Stop, not PostToolUse — the agent may be mid-way through 
  a batch of related edits. One of the highest-value hooks for any project.
- **Layer integrity** — prompt hook after editing L1 artifacts, reminding 
  to verify the change earns its place in L1
- **Design-code separation** — script or prompt hook before commit, 
  reminding that design/ changes should be committed separately
- **Lint/format gates** — script hook to run project linters pre-commit

### 6. Review with the human

Present the proposed structure:

```
L1 (always loaded)
  └── CLAUDE.md — [summary of contents, token estimate]

L2 (on activation)
  └── [whatever was set up]

L3 (on demand)
  └── [whatever was set up]

Hooks
  └── [whatever was set up]
```

Call out any judgment calls you made about what belongs at which layer.
Don't commit until the human confirms.
