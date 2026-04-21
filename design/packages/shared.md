# packages/shared — Design

> Cross-cutting plumbing: one in-process event bus, JSONL helpers, CLI formatting, and script runtime detection. Zero domain knowledge — shared imports this; it imports nothing from siblings.

See [../DESIGN.md](../DESIGN.md) for how shared fits the system.

## Modules

**`event-bus.ts`** — Synchronous pub/sub. `EventBus` exposes `emit(event)`, `on(listener)`, `off(listener)`, `subscribe(filter?)` (returns `AsyncIterable<BusEvent>`), `clear()`, and `size`. Dispatch is **synchronous and in-call order**; a throwing listener is caught so it doesn't starve the rest. `BusEvent` is a flexible envelope (`ts`, `type`, `source`, `level`, `runId?`, `agent?`, `workspace?`, plus arbitrary payload). Exports `BaseBusEvent`, `AgentRuntimeEvent` (tool/hook/usage-shaped), typed union `KnownBusEvent`, and `EventFilter`. A process-level singleton `bus` is exported for consumers that don't need isolation.

**`jsonl.ts`** — Three functions, no state.
- `readFrom(path, cursor): Promise<{ data, nextCursor }>` — reads from a byte offset.
- `parseJsonl<T>(data): T[]` — splits on newline, JSON-parses each.
- `appendJsonl(path, entry): void` — synchronous `appendFileSync`, atomic at the OS line level. Concurrent readers may see a partial trailing line and should tolerate that.

**`cli-colors.ts`** — `c` object with ANSI codes (`reset`, `dim`, `bold`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `red`) and `fmtTime(ts)` returning `HH:MM:SS.mmm`.

**`script-runtime.ts`** — Detects whether `bun` is on PATH; falls back to `node-tsx`. `getPreferredScriptRuntime()` (cached) and `resolveScriptEntrypointCommand(entryPath, args)` return a `[command, args]` tuple. Used by anything that needs to spawn TypeScript entry points portably.

**`index.ts`** — Re-exports everything above.

## Key mechanisms

**Single process-global bus.** There is one `bus` singleton; no fan-in/fan-out across workers. Synchronous dispatch is a deliberate choice — it preserves causality (emit → all listeners ran before the next line) and makes reentrancy bugs easy to see in a stack trace. Consumers that need async behavior wrap listeners themselves.

**Swallow listener errors.** `on` handlers that throw are caught and dropped. Rationale: one misbehaving subscriber must never prevent the JSONL event log from receiving events or block an in-flight loop.

**Emitters don't know consumers.** The bus is the only cross-package channel. `DaemonEventLog` and UI streamers subscribe; domain code emits. This is why JSONL on disk is the durable contract and the bus is just a dispatch aid.

## Non-goals

- Async or queued delivery (use `subscribe()`'s `AsyncIterable` if you want backpressure).
- Cross-process transport — the bus is in-process only. Durable events are on disk via JSONL.
- Ordering across multiple writers to the same JSONL file (single-writer assumption holds project-wide).
- Anything domain-specific — event shapes are defined by the emitting package.
