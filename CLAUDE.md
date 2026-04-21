This project is in early development. Do not add backward-compatibility shims, deprecated aliases, or dual-path code when making changes. Breaking changes are acceptable — just update all callers directly.

## Design-Driven Development

`design/` is the architectural source of truth. Read `design/DESIGN.md` first for system shape, then the relevant per-package doc under `design/packages/<pkg>.md` before touching a package — the module boundaries, data flow, and "doesn't do" lists are there.

- If a task would change the system's shape (add/remove/merge modules, change how modules connect, introduce a new key mechanism), write a proposal in `design/decisions/NNN-title.md` and wait for review before coding. Commit design changes separately from code.
- For non-trivial tasks, follow Plan → Build → Verify: write a blueprint in `blueprints/<task>.md`, track progress with a TODO scaffold, then strip the TODO and keep the blueprint when done.
- Bug fixes, small config tweaks, or tasks shorter to do than to plan don't need a blueprint.
- See `.claude/skills/design-driven/` for the full methodology.

## Bun runtime

Bun is the runtime, package manager, and test runner. Use Node.js APIs for library code that needs broad compatibility.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun add <pkg>` (in the target package directory) to add dependencies. Don't hand-edit package.json for dependency changes.
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- HTTP servers: Use `hono` + `@hono/node-server`. Don't use `express` or `Bun.serve()`.
- Subprocess execution: Use `execa`. Don't use `Bun.$`.
- File I/O: Use `node:fs` / `node:fs/promises`. Don't use `Bun.file`.
- `WebSocket` is built-in. Don't use `ws`.

## Testing

Use `bun test` to run tests. semajsx (vendor/semajsx/) uses vitest — don't mix them.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Project Structure

```
packages/
  agent-worker/    # Daemon, CLI, HTTP API, orchestrator
  agent/           # Agent runtime (inbox, todo, memory, tools)
  loop/            # Loop implementations (ai-sdk, claude-code, codex, cursor)
  workspace/       # Workspace config, MCP server, context providers
  shared/          # Event bus, JSONL, CLI colors
  web/             # Web UI (SPA, semajsx)
vendor/
  semajsx/         # Git submodule — signal-based JSX framework
design/
  DESIGN.md        # Top-level architectural source of truth (see Design-Driven Development above)
  packages/        # Per-package design docs (agent.md, agent-worker.md, loop.md, shared.md, web.md, workspace.md)
  decisions/       # Proposals for shape-changing decisions (adopted + rejected)
blueprints/        # Task-level implementation records (plan/build/verify)
```

## Daemon

- Default port: 7420
- Local connections (127.0.0.1/localhost) skip auth — no token needed
- Start: `bun packages/agent-worker/src/cli/index.ts daemon start -d`
- Status: `bun packages/agent-worker/src/cli/index.ts status`
- Web UI served from `packages/web/dist/` via static file fallback

## Web UI (`packages/web/`)

- SPA built with **semajsx**, NOT React. Framework conventions (component shape, signals, cleanup, tokens) live in `design/packages/web.md` — read it before touching `packages/web/`.
- Build: `cd packages/web && bun run build`

## Naming Conventions

- CN (中国) 版本的后缀放到最后，例如 `BIGMODEL_CN` 而非 `CN_BIGMODEL`。
