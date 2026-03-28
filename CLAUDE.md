This project is in early development. Do not add backward-compatibility shims, deprecated aliases, or dual-path code when making changes. Breaking changes are acceptable — just update all callers directly.

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
  web/             # Web UI design document
```

## Daemon

- Default port: 7420
- Local connections (127.0.0.1/localhost) skip auth — no token needed
- Start: `bun packages/agent-worker/src/cli/index.ts daemon start -d`
- Status: `bun packages/agent-worker/src/cli/index.ts status`
- Web UI served from `packages/web/dist/` via static file fallback

## Web UI (`packages/web/`)

- SPA built with semajsx framework, NOT React
- Only depends on `semajsx` umbrella package (not individual @semajsx/* packages)
- `jsxImportSource: semajsx/dom` — all .tsx files need `/** @jsxImportSource semajsx/dom */`
- Build: `cd packages/web && bun run build`
- Auto-connects to same origin (daemon serves the SPA)

### semajsx patterns (NOT React)

Components return JSXNode, not functions:
```tsx
// WRONG — crashes with "Invalid component return type: function"
return () => <div>...</div>

// RIGHT
return <div>...</div>
```

Reactive content — pass signals directly, not wrapper functions:
```tsx
// WRONG — function children are ignored with a warning
<span>{() => count.value}</span>

// RIGHT — signal auto-subscribes
<span>{count}</span>

// RIGHT — derived value via computed
<span>{computed(count, v => v + 1)}</span>
```

Conditional rendering:
```tsx
// WRONG
{condition.value ? <A /> : null}

// RIGHT
{when(conditionSignal, () => <A />)}
```

Event handlers ARE functions (this is correct):
```tsx
<button onclick={() => doThing()}>Click</button>
```

Cleanup via `onCleanup` (not useEffect/MutationObserver):
```tsx
import { onCleanup } from "semajsx/dom";

function MyComponent() {
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  // ...
}
```

Tokens need injection:
```tsx
import { defineAndInjectTokens } from "semajsx/style";
const tokens = defineAndInjectTokens({ colors: { bg: "#000" } });
// defineTokens() alone does NOT inject CSS variables
```

Don't return raw DOM nodes from components:
```tsx
// WRONG — crashes
const el = document.createElement("div");
el.innerHTML = html;
return el;

// RIGHT — use ref callback
return <div ref={(el: HTMLDivElement) => { el.innerHTML = html; }} />;
```

## Naming Conventions

- CN (中国) 版本的后缀放到最后，例如 `BIGMODEL_CN` 而非 `CN_BIGMODEL`。
