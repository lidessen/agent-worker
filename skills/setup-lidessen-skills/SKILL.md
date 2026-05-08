---
name: setup-lidessen-skills
description: Operational deployer for the lidessen skills collection — wires harness config (CLAUDE.md / AGENTS.md / .cursor/) in a target project, injects cross-cutting principles (e.g. principal contradiction first), and reconciles when lidessen evolves. Triggers on "/setup-lidessen-skills", "set up lidessen skills", "wire lidessen into this project", "sync lidessen principles", "install lidessen skills". Use after cloning or symlinking lidessen skills into a project, when adopting the collection, or when lidessen has new content the project hasn't picked up. Args — `init` to scaffold, `sync` to re-align with current lidessen, `audit` to check drift without writing. Pairs with harness (portable methodology); this is the lidessen-specific application layer.
argument-hint: "[init | sync | audit]"
---

# Setup lidessen skills

Operational deployer for the lidessen skills collection. The lidessen *methodology* lives in the individual skills (harness, design-driven, goal-driven, reframe, evidence-driven, etc.); this skill does the *wiring* to land them in a target project — detect the host tool, write to the right harness file, and inject the cross-cutting principles that span multiple lidessen skills.

## Position relative to harness

`harness` (and any general-purpose harness skill) teaches *how to think about agent context* — portable methodology, applies to any project regardless of skill collection. This skill is the lidessen-specific operational layer that *applies* harness-style structure to a project adopting the lidessen collection. Read harness for the why; run this skill to do the wiring.

## Boundary — what this skill does and doesn't

**Does:**
- Detect host tool (Claude Code / Codex / Cursor / other) by config-file presence
- Create or update the project's harness config with a delimited "Lidessen" section
- Inject canonical cross-cutting principles from `references/cross-cutting-principles.md`
- Maintain a version marker so subsequent `sync` / `audit` runs can detect drift

**Doesn't:**
- Teach lidessen methodology (each skill's own SKILL.md owns that)
- Copy or install skill files (use clone / symlink / your package manager)
- Modify per-skill content (each skill is its own concern)

## Tool detection

Detect host tool in priority order before any subcommand writes:

1. `CLAUDE.md` exists at project root → Claude Code
2. `AGENTS.md` exists at project root → Codex
3. `.cursor/` directory exists → Cursor
4. None of the above → ask the user explicitly which tool they're configuring

The detected tool determines the target file:

| Tool | Target file |
|---|---|
| Claude Code | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| Cursor | `.cursor/rules/lidessen.md` (created if missing) |
| Other | ask the user where to write |

If multiple host configs are present, prefer the one the user names; fall back to priority order.

## Delimited section format

The lidessen-managed content lives inside paired markers so reruns can replace cleanly without disturbing surrounding content:

```
<!-- lidessen-setup:begin v=<N> -->
... lidessen-managed content ...
<!-- lidessen-setup:end -->
```

**Invariant:** content outside the markers belongs to the user and must never be touched. Content inside the markers is wholly owned by this skill and is replaced on every `sync`. Users who need to override a principle should do so *outside* the markers — typically by adding a contrary note in their own section that consumers of CLAUDE.md will read alongside.

## Subcommands

Dispatch by argument:

- `init` — Scaffold the lidessen section in a project that doesn't yet have one. See `commands/init.md`.
- `sync` — Replace the lidessen section with current canonical content; bumps version. See `commands/sync.md`.
- `audit` — Read-only drift check; never writes. See `commands/audit.md`.

If invoked with no argument, default to `audit` — it is the safe read-only operation and surfaces enough information for the user to decide whether they want `init` or `sync`.

## Principal contradiction (this skill)

Per the canonical principle — the load-bearing decision in this skill is **what gets injected** (the canonical content in `references/cross-cutting-principles.md`). Tool detection, marker format, subcommand split are all secondary; getting them wrong is locally repairable, but injecting the wrong content propagates into every consumer project. Treat `references/cross-cutting-principles.md` with the discipline due a public API.
