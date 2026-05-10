# Setup Reference

Setup wires attention-driven behavior into project instruction files.

## Managed Blocks

Use delimited blocks so sync can replace only owned content:

```markdown
<!-- skill:attention-driven -->
...
<!-- /skill:attention-driven -->
```

Never edit user-owned content outside the markers.

## Target Files

Common targets:

- `CLAUDE.md`
- `AGENTS.md`
- `codex.md`
- `.cursor/rules/*.md`
- `.cursorrules`
- `.github/copilot-instructions.md`
- `.windsurfrules`

Only create a tool-specific instruction file when the user asks or the project
already uses that tool.

## Minimal Block Content

The managed block should:

- name `/attention-driven go` as the daily entrypoint;
- define goal/design/fact/reframe/setup ownership in one line each;
- point to durable artifacts instead of inlining all methodology;
- include the artifact policy: preserve 30%, leave 70% flexible.
- include the decision policy: agents decide/review ordinary 70% choices, and
  humans decide only the load-bearing 30% that changes goal, authority, values,
  irreversible cost, or system shape.
- make autonomous action the default inside accepted boundaries; escalation
  should name the gate it hit.

## Presets

Setup presets are not separate user-facing skills. Their useful pieces are:

- detect host agent tool;
- write managed blocks;
- sync current cross-cutting principles;
- audit drift without writing.

Avoid a personal-brand mental model in project instructions. The installed
thing is the attention-driven work protocol.

## Principal Contradiction In Setup

The load-bearing setup decision is what managed content gets injected. Tool
detection, marker spelling, and subcommand split are secondary and locally
repairable. Bad injected principles propagate to every consumer project, so
treat managed setup content like a public API.

Each managed principle should stand alone: a downstream project must be able to
act on it without reading this repo's history.
