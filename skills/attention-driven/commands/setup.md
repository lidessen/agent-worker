# attention-driven:setup

Setup layer: wire attention-driven instructions into a project.
Setup owns continuity wiring: the next agent should enter with enough
direction, system shape, observations, authority, and artifact policy to
continue.

Read `references/setup.md` and `references/harness.md` before editing project
instruction files.

## Modes

- `init`: create missing scaffolding and managed instruction blocks.
- `sync`: refresh managed blocks to current attention-driven wording.
- `audit`: report drift without writing. For full drift checks, use
  `commands/audit.md`.
- no argument: default to audit unless the user clearly asked to write.

## Detect Targets

Write only to agent instruction files the project actually uses:

- `CLAUDE.md`
- `AGENTS.md` or `codex.md`
- `.cursor/rules/*.md` or `.cursorrules`
- `.github/copilot-instructions.md`
- `.windsurfrules`
- any explicitly named instruction file

If multiple files exist, update each unless the user scopes the target.

## Managed Block

Use one managed block:

```markdown
<!-- skill:attention-driven -->
## Attention-driven work

Start ordinary work with `/attention-driven go`.
It should name the mainline, route, and next observable move.

- goal owns direction, criteria, records, and STOPs.
- design owns system shape, boundaries, decisions, and blueprints.
- fact owns falsifiable observations for progress claims.
- reframe changes the paradigm-level lens before design stabilizes.
- setup/audit keep this project harness current for future agents.

Preserve only the load-bearing 30% in durable artifacts. If history was wrong,
correct the current artifact or create the next one; do not repair old records
for their own sake.

Do not route every decision to the human. Let agents decide and review ordinary
70% choices; escalate only goal, authority, value, irreversible, or
system-shape decisions.

Default to action inside accepted boundaries: decide reversible local choices,
use reviewer roles for uncertain recoverable choices, and ask the human only
when an escalation gate is named.
<!-- /skill:attention-driven -->
```

Replace only content inside those markers. Never touch user-owned content
outside the markers.

## Scaffolding

Create only what is load-bearing for the selected setup:

- `goals/GOAL.md` and `goals/record.md` only through `goal set`.
- `features/<name>/GOAL.md` and `features/<name>/record.md` only through
  `goal set <name>` in multi-initiative projects. Do not create a
  `features/` tree until the second concurrent initiative actually
  appears — one feature uses `goals/` directly.
- `design/` only through design bootstrap/init.
- `concepts/` only through reframe init.
- hooks only when the user asks for mechanical enforcement.

Setup should not manufacture empty artifact trees just because the merged skill
knows about them.
