# Update Runtime SDKs

## Plan

Refresh the runtime-facing SDK packages to the latest registry versions while preserving the existing `AgentLoop` boundary:

- Verify current upstream versions for Claude Agent SDK, Vercel AI SDK packages, and Codex CLI/app-server.
- Update package manifests and `bun.lock` through Bun.
- Check whether current Codex app-server protocol generation still matches the integration's thread/turn usage.
- Run focused type/test verification for the loop package and summarize current usage recommendations.

## Build

- Latest versions verified on 2026-05-04:
  - `@anthropic-ai/claude-agent-sdk` 0.2.126
  - `ai` 6.0.174
  - `@ai-sdk/anthropic` 3.0.74
  - `@ai-sdk/openai` 3.0.58
  - `@ai-sdk/google` 3.0.67
  - `@ai-sdk/deepseek` 2.0.32
  - `@openai/codex` 0.128.0
- Local `codex --version` is already `codex-cli 0.128.0`.
- Generated Codex app-server TypeScript and JSON Schema into `/private/tmp/agent-worker-codex-protocol-check` and `/private/tmp/agent-worker-codex-schema-check`; the current `thread/start`, `thread/resume`, `turn/start`, `turn/interrupt`, and `thread/tokenUsage/updated` methods remain present.
- Codex loop options now expose current app-server turn controls: `approvalsReviewer`, `serviceTier`, `effort`, `summary`, `outputSchema`, and `sandboxPolicy`.
- Removed obsolete `experimentalRawEvents` and `persistExtendedHistory` request fields from `thread/start` / `thread/resume`.

## Verify

- `bun add` completed for root, `packages/loop`, `packages/agent`, and `packages/agent-worker`.
- `bunx tsgo -p packages/loop/tsconfig.json` passed.
- `bun test packages/loop/test/ai-sdk-loop.test.ts packages/loop/test/claude-code-loop.test.ts packages/loop/test/codex-loop.test.ts` passed: 66 pass, 0 fail.
- `bun test packages/loop/test/codex-loop.test.ts` passed after adding modern app-server turn-control coverage: 34 pass, 0 fail.
- `bun run typecheck` now passes through `packages/loop` and fails later in `packages/web/src/utils/time.test.ts` because `bun:test` is not resolved by that package's current TypeScript config.
- `bun test packages/loop/test` passes the runtime adapter tests, but the full loop suite still has expected environment failures in network/browser tests: `web_fetch` cannot reach external URLs, `web_browse` cannot write `/Users/lidessen/.agent-browser`, and one host sandbox test times out under the current sandbox.
