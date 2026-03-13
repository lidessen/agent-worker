This project is in early development. Do not add backward-compatibility shims, deprecated aliases, or dual-path code when making changes. Breaking changes are acceptable — just update all callers directly.

Bun is the runtime, package manager, and test runner. Use Node.js APIs for library code that needs broad compatibility.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- HTTP servers: Use `hono` + `@hono/node-server`. Don't use `express` or `Bun.serve()`.
- Subprocess execution: Use `execa`. Don't use `Bun.$`.
- File I/O: Use `node:fs` / `node:fs/promises`. Don't use `Bun.file`.
- `WebSocket` is built-in. Don't use `ws`.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```
