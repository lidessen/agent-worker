This project is in early development. Do not add backward-compatibility shims, deprecated aliases, or dual-path code when making changes. Breaking changes are acceptable — just update all callers directly.

## Refactor posture

When a task is a refactor, three rules together:

1. **Reuse useful code and designs** — MCP scaffolding, capability boundary, JSONL replay, worktree provisioning, channel/inbox/team/resource/chronicle tools, and similar load-bearing pieces stay. Don't rewrite for the sake of "feeling cleaner". Test: if you'd write something materially different from scratch, rewrite it; otherwise keep it.
2. **No historical baggage in the new shape** — no transitional fields kept "until follow-on blueprint lands", no migration-source markers, no `nextSteps`-style legacy properties left dangling, no two competing shapes of the same concept living side by side.
3. **Land the new shape fully in one slice** — every caller, test, doc string, prompt-text reference moves over together. The codebase should read as if the new shape was always the design.

If splitting work into multiple slices feels necessary, the seam goes between *concepts* (e.g. "drop Artifact entirely" / "move Task to harness-layer projection") — not between "do the rename" and "clean up the residue".

## Design-Driven Development

`design/` is the architectural source of truth. Read `design/DESIGN.md` first for system shape, then the relevant per-package doc under `design/packages/<pkg>.md` before touching a package — the module boundaries, data flow, and "doesn't do" lists are there.

- If a task would change the system's shape (add/remove/merge modules, change how modules connect, introduce a new key mechanism), write a proposal in `design/decisions/NNN-title.md` and wait for review before coding. Commit design changes separately from code.
- For non-trivial tasks, follow Plan → Build → Verify: write a blueprint in `blueprints/<task>.md`, track progress with a TODO scaffold, then strip the TODO and keep the blueprint when done.
- Bug fixes, small config tweaks, or tasks shorter to do than to plan don't need a blueprint.
- See `skills/attention-driven/` for the full methodology.

## Skill Authoring

`skills/` is the source of truth for agent skills; `.claude/skills` and `.agents/skills` are projections. Follow the Agent Skills format when editing a skill.

- `SKILL.md` frontmatter is YAML with `name`, `description`, and optional `argument-hint` or metadata.
- Prefer a compact single-line `description`; front-load concrete trigger phrases and keep it roughly under 800 characters. Quote only when YAML needs it, such as when the text contains `: `, `#`, brackets, or other syntax-sensitive characters.
- Do not put long prose, argument details, or methodology background in `description`; put them in the body or `commands/` and `references/`.
- The body of `SKILL.md` is an agent prompt, not human documentation. Keep it under 500 lines when practical and dispatch details to sibling files.

## Bun runtime

Bun is the runtime, package manager, and test runner for `packages/agent-worker` and friends. Use Node.js APIs for library code that needs broad compatibility.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` for `@agent-worker/*` packages.
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`.
- Use `bun add <pkg>` (in the target package directory) to add dependencies. Don't hand-edit package.json for dependency changes.
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`.
- Use `bunx <package> <command>` instead of `npx <package> <command>`.
- Bun automatically loads .env, so don't use dotenv.

## APIs

- HTTP servers: Use `hono` + `@hono/node-server`. Don't use `express` or `Bun.serve()`.
- Subprocess execution: Use `execa`. Don't use `Bun.$`.
- File I/O: Use `node:fs` / `node:fs/promises`. Don't use `Bun.file`.
- `WebSocket` is built-in. Don't use `ws`.

## Testing

Two test runners coexist by package:

- `@agent-worker/*` packages → `bun test` (bun:test).
- `@semajsx/*` packages and the `semajsx` umbrella → `vitest` (root `vitest.config.ts`).

Don't mix them within a single package.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Project Structure

```
internals/         # Private workspace packages (not published)
  agent/           # Agent runtime (inbox, todo, memory, tools)
  loop/            # Loop implementations (ai-sdk, claude-code, codex, cursor)
  workspace/       # Workspace config, MCP server, context providers
  shared/          # Event bus, JSONL, CLI colors
  web/             # Web UI (SPA, semajsx)
  core, dom, signal, style, ui, …   # SemaJSX framework internals (@semajsx/*)
packages/          # Published to npm
  agent-worker/    # Daemon, CLI, HTTP API, orchestrator (umbrella over @agent-worker/*)
  semajsx/         # Umbrella package re-exporting all @semajsx/* internals
apps/
  docs/            # SemaJSX documentation site (consumes the published `semajsx` package)
design/
  DESIGN.md        # Top-level architectural source of truth (see Design-Driven Development above)
  packages/        # Per-package design docs (agent.md, agent-worker.md, loop.md, shared.md, web.md, workspace.md)
  decisions/       # Proposals for shape-changing decisions (adopted + rejected)
  semajsx/         # SemaJSX framework's own design docs (DESIGN.md, ROADMAP.md, RFCs, ADRs)
skills/            # Source of truth for agent skills; .claude/skills, .agents/skills are projections
articles/, slides/ # Long-form content
blueprints/        # Task-level implementation records (plan/build/verify)
```

## Daemon

- Default port: 7420
- Local connections (127.0.0.1/localhost) skip auth — no token needed
- Start: `bun packages/agent-worker/src/cli/index.ts daemon start -d`
- Status: `bun packages/agent-worker/src/cli/index.ts status`
- Web UI served from `internals/web/dist/` via static file fallback

## Web UI (`internals/web/`)

- SPA built with **semajsx**, NOT React. Framework conventions (component shape, signals, cleanup, tokens) live in `design/packages/web.md` — read it before touching `internals/web/`.
- Build: `cd internals/web && bun run build`

## Naming Conventions

- CN (中国) 版本的后缀放到最后，例如 `BIGMODEL_CN` 而非 `CN_BIGMODEL`。

<!-- skill:attention-driven -->
## Attention-driven work

Start ordinary work with `/attention-driven go`.
It should name the mainline, route, and next observable move.

- goal keeps direction, criteria, records, and STOPs.
- design keeps system shape, boundaries, decisions, and blueprints.
- fact keeps falsifiable observations for progress claims.
- reframe changes the lens before design stabilizes.
- setup/audit keep project context wired for future agents.

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
