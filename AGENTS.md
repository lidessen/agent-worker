# Agent instructions

**See `CLAUDE.md` for the authoritative runtime, API, testing, and framework conventions.** This file is a pointer — it exists so non-Claude agents (codex, etc.) find the same rules.

## On entry: check for HANDOFF.md

If `HANDOFF.md` exists in the project root, **read it first, before anything else**. It is a state snapshot from the previous agent — it tells you where we are, what's verified, and your next action. Execute it, then archive it to `handoffs/archive/<date>-<from>→<to>.md`. Do not skip this and read other artifacts first; the handoff is designed to be the single entry point.

## Design-Driven Development

`design/` is the architectural source of truth. Read `design/DESIGN.md` for system shape, then the relevant per-package doc under `design/packages/<pkg>.md` before touching a package.

- If a task would change the system's shape (modules, connections, key mechanisms), write a proposal in `design/decisions/NNN-title.md` and wait for review before coding. Commit design changes separately from code changes.
- For non-trivial tasks, write a blueprint in `blueprints/<task>.md` following Plan → Build → Verify. Strip the TODO scaffold when done, keep the blueprint.
- Bug fixes and small config changes don't need a blueprint.
- Full methodology: `skills/attention-driven/`.
