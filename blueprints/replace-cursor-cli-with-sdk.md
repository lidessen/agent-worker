# Replace Cursor CLI with SDK

## Plan

Replace the `cursor` loop implementation directly with `@cursor/sdk`, without a
CLI fallback or compatibility mode.

Scope:

- Keep external runtime type `cursor`.
- Replace `packages/loop/src/loops/cursor.ts` with an SDK-backed adapter.
- Add the `@cursor/sdk` dependency to `packages/loop`.
- Route Cursor MCP servers through `setMcpServers`, not temp config files.
- Update design docs to stop classifying Cursor as a CLI stdio runtime.
- Update focused tests around Cursor event mapping and loop factory behavior.

Verification:

- `bunx tsgo -p packages/loop/tsconfig.json`
- focused Cursor loop tests
- focused loop-factory path tests

## Build

- Added `@cursor/sdk@1.0.12`.
- Replaced `CursorLoop` with an SDK-backed implementation.
- Routed Cursor MCP through `setMcpServers` and structured SDK config.
- Removed Cursor from CLI-loop mock coverage and added SDK-focused Cursor tests.
- Updated design docs and the accepted decision record.

## Verify

- `bunx tsgo -p packages/loop/tsconfig.json` passed.
- `bunx tsgo -p packages/agent-worker/tsconfig.json` passed.
- `bun test packages/loop/test/cursor-loop.test.ts packages/loop/test/cli-allowed-paths.test.ts packages/agent-worker/test/loop-factory-paths.test.ts` passed: 19 pass, 0 fail.
- `bun test packages/loop/test/cli-loops.test.ts` passed: 8 pass, 0 fail.
