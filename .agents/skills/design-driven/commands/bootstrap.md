# design-driven:bootstrap — Bootstrap design from existing codebase

Generate the initial `design/` directory and DESIGN.md files by exploring 
the current codebase. Use when adopting design-driven on a project that 
already has code but no design docs.

## Process

### 1. Explore

Don't rush. Understand the project before writing anything.

```
Shape       What are the major pieces? (packages, services, modules)
            Look at: directory structure, package manifests, build config

Boundaries  How do the pieces talk to each other?
            Look at: imports, HTTP clients, event emitters, message queues

Entry       Where does execution start?
            Look at: main files, server startup, CLI entry points

Mechanisms  What are the 2-3 things that make this system unique?
            Look at: actual source code of the core logic, not glue code.
            This is the most important step — skim won't cut it.

Docs        What's already documented?
            Look at: README, CLAUDE.md, existing design docs, doc comments
            Build on what exists, don't duplicate.
```

### 2. Draft

Create both directories with the initial files:

- `design/DESIGN.md` — always. System shape, modules, data flow, 
  key mechanisms, key decisions, constraints, non-goals.
- `design/DESIGN-<aspect>.md` — only if a complex mechanism deserves 
  its own page. Most projects don't need this on day one.
- `design/decisions/` — create the directory with .gitkeep.
- `blueprints/` — create the directory with .gitkeep. This is where 
  task-level implementation records will live.

Follow the format and principles in the main SKILL.md. Remember:
- Module descriptions: two lines max (does / doesn't)
- Mechanisms: describe the pattern, not the schema
- Decisions: only record real tradeoffs with rejected alternatives
- ASCII diagrams: "what talks to what" in 5 seconds
- Under 200 lines per file

### 3. Review

Present the draft to the human. This is the first version of the 
architectural skeleton — it sets the foundation for all future work. 
Don't commit until the human has reviewed and approved.

Things to call out explicitly:
- Any boundaries you weren't sure about
- Any mechanisms you may have misunderstood
- Any decisions you inferred but couldn't confirm from the code

### 4. Wire up

After the design is approved, run the Setup steps from the main skill:
- Update AI agent configs (CLAUDE.md, .cursorrules, etc.) to reference 
  the new `design/` directory
- Set up the pre-commit reminder if the human wants it

### 5. Commit

Commit the `design/` directory, `blueprints/` directory, and the config 
updates together as the initial design-driven setup.
