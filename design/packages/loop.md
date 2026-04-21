# packages/loop — Design

> The backend abstraction. `AgentLoop` is a minimal streaming interface (`run → LoopEvent`); implementations adapt AI SDK or a CLI subprocess behind it. Nothing in this package knows about agents, workspaces, or inboxes.

See [../DESIGN.md](../DESIGN.md) for how loops are picked at agent-create time.

## Internal shape

```
                         consumer (agent or workspace runner)
                                   │
                                   ▼ loop.run(input)
                      ┌─────────────────────────────┐
                      │  AgentLoop (interface)       │
                      │  run / cancel / status       │
                      │  setTools / setMcpConfig     │
                      │  supports[]                  │
                      └────┬──────────┬──────────────┘
                           │          │
              ┌────────────┘          └────────────┐
              ▼                                    ▼
        loops/ai-sdk                        loops/{claude-code, codex, cursor, mock}
              │                                    │
              │ direct tools + prepareStep         │ setMcpConfig(path)
              │                                    │   └─ CLI subprocess
              │                                    │      (stdio JSON-RPC or SDK)
              ▼                                    ▼
       providers/* (model resolve)         utils/cli*, utils/stream-parse
       tools/* (grep, web_*)                utils/claude-sdk-hooks
       sandbox/host                          utils/mcp-*
                           │                       │
                           └─────────┬─────────────┘
                                     ▼
                         LoopEvent stream (text, thinking,
                         tool_call_*, usage, hook, error)
```

## Modules

**`loops/`** — One subdirectory per backend.
- `ai-sdk` — wraps AI SDK `ToolLoopAgent`; uses `experimental_onToolCallStart/Finish` and `onStepFinish` callbacks; supports `prepareStep` for dynamic tool subset.
- `claude-code` — `@anthropic-ai/claude-agent-sdk` `query()`; maps `SDKMessage` to `LoopEvent`; supports hooks and an MCP servers object.
- `codex` — JSON-RPC stdio subprocess to the `codex` CLI; turns surfaced via `turn/start`; persists `threadId` to a file for session continuity.
- `cursor` — CLI runner; injects MCP config into `.cursor/mcp.json` before spawn, restores after; usage estimated from text length.
- `mock` — deterministic test loop.

**`providers/`** — Model resolution. `ProviderAdapter(modelId, env?)` returns a `LanguageModel`; `ProviderMeta` carries env keys, default model, and priority. Higher priority wins in auto-detect (Anthropic > OpenAI > Google, with ZenMux as a compatibility fallback). Built-in adapters: Anthropic, OpenAI, Google, DeepSeek, Kimi, Minimax, AI Gateway.

**`sandbox/`** — Host-side sandbox for AI SDK bash-style tools. `HostSandbox` runs `bash -c` with a 120s timeout and reads/writes files gated by `cwd + allowedPaths`. The `@vercel/sandbox` integration slots in here when isolation is needed — same interface.

**`tools/`** — Built-in factories the AI SDK loop can use: `grep` (ripgrep), `web_fetch`, `web_search` (Brave-gated), `web_browse` (Playwright-gated). All opt-in via `LoopToolsOptions`.

**`tool-relevance.ts`** — Classifier for AI SDK `prepareStep`. Buckets tools into `always`, `contextual` (recent or errored), and `on-demand` (surfaced via a discovery tool). Keeps the per-step tool list small without hiding anything permanently.

**`utils/`** — CLI plumbing: subprocess spawn (`cli.ts`), generic CLI loop runner (`cli-loop.ts`), JSON-RPC stdio client, MCP config builders/serializers per runtime, model listing, stream parsing, Claude SDK hook helpers.

## AgentLoop interface

Every loop exports:

- `run(input: string | { system, prompt }): LoopRun` — async-iterable events plus a `.result` promise.
- `status: "idle" | "running" | "completed" | "failed" | "cancelled"`.
- `supports: readonly string[]` — capability flags: `directTools`, `prepareStep`, `usageStream`, `hooks`, `interruptible`, etc.
- `cancel(): void`.

Optional (presence signals capability — callers must feature-detect):

- `setMcpConfig(path)` — CLI loops; points to a temp JSON config file.
- `setMcpServers(serversObj)` — SDK loops that accept structured MCP specs.
- `setTools(toolset)` — AI SDK loop; direct in-process tool injection.
- `setPrepareStep(fn)` — AI SDK loop; dynamic per-step tool filtering.
- `preflight(): Promise<PreflightResult>` — CLI availability / auth check.

## LoopEvent stream

Discriminated union:

- `text` — streamed response chunk.
- `thinking` — extended-thinking / reasoning chunk.
- `tool_call_start` — `{ name, callId?, args? }`.
- `tool_call_end` — `{ name, callId?, result?, durationMs?, error? }`.
- `usage` — `{ inputTokens, outputTokens, totalTokens, contextWindow?, usedRatio?, source: "runtime" | "estimate" }`.
- `hook` — runtime hook notification (`phase`, `name`, `hookEvent`, `stdout`, `stderr`, `outcome`).
- `error` — `{ error: Error }`.
- `unknown` — passthrough for unrecognized runtime frames.

Correlation rule: `callId` is provided by AI SDK / Claude Code / Cursor; **Codex does not emit `callId`** — consumers must not assume start/end pairing there.

## Key mechanisms

**Capability-first API, feature-detect at runtime.** `supports[]` + optional-method probing is the contract between loop and caller. No abstract base class with noop defaults; if a method isn't there, the capability isn't there. Callers like `packages/agent/bridge` and the workspace runner pick a transport based on these flags.

**MCP config is pre-wired, not injected mid-run.** CLI loops receive a path/object before `run()` starts; once `run()` is in flight the tool set is frozen. Claude Code takes a servers object through SDK options; Codex transforms the JSON into TOML `-c` overrides; Cursor mutates `.cursor/mcp.json` in the spawn cwd and restores it on cleanup. SSE is explicitly rejected; stdio is the shared transport.

**Stream exhaustion drives the agentic loop.** For AI SDK, the caller must drain `fullStream` to completion — early break would abort the tool-exec cycle. For Claude Code and Codex, the SDK / RPC layer handles tool cycles; the loop adapter just maps frames. Cancellation is cooperative: `cancel()` aborts the subprocess or SDK iterator and ends the stream with `error`.

**Usage is best-effort.** AI SDK and Claude Code emit cumulative usage mid-stream. Codex emits a final `usage`. Cursor has no counter and falls back to `textLength / 4`. Consumers that need a real context ratio should prefer runtime-sourced `usage` (`source: "runtime"`) and treat `estimate` as advisory.

**Thread persistence is per-runtime.** Only Codex persists a session id (to `threadIdFile`) for continuity across daemon restarts; other runtimes reset each `run()`.

## Non-goals

- Knowing about agents, inboxes, workspaces, or who's consuming the stream.
- Mid-run tool capability changes.
- Cross-runtime normalization of `usage` or tool-call identity — consumers handle the quirks.
- Managing OAuth flows for MCP servers (rejected at config load).
