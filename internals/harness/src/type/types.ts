// ── HarnessType protocol — substrate-side types ─────────────────────────
//
// Per design/decisions/006-harness-as-agent-environment.md and
// design/packages/harness.md: a `Harness` instance is the universal
// substrate plus exactly one `HarnessType` plugged in at construction.
// The type contributes per-type stores / projections / MCP tools (slice
// 2) and the Handoff hooks `produceExtension` / `consumeExtension`
// (this slice).
//
// The substrate never inspects extension payloads — it delegates to the
// registered type via the helpers in ./helpers.ts. Failure semantics
// (per decision 005 + 006) are codified at the helper layer, not at the
// hook implementation, so every site fails the same way.

import type { Wake, HandoffDraft, Handoff } from "../state/types.ts";
import type { HarnessEvent } from "../types.ts";
import type { ContextPacket } from "@agent-worker/agent";

/**
 * Inputs to `produceExtension`. The hook builds a per-type extension
 * payload from the closing Wake's events and (eventually) work log.
 *
 * `workLog` is reserved — it stays `undefined` until the work-log slice
 * lands. Hooks should be written to handle that case gracefully today.
 */
export interface ProduceExtensionInput {
  /** The Wake that's closing, in its terminal state. */
  wake: Wake;
  /** Events emitted within this Wake (filtered to per-Wake scope by the caller). */
  events: HarnessEvent[];
  /** Reserved; populated when the work-log slice lands. Currently always undefined. */
  workLog?: unknown;
  /** Runtime-emitted draft of the Handoff generic core. */
  draft: HandoffDraft;
}

/**
 * Inputs to `consumeExtension`. The hook injects extension content into
 * the next Wake's `ContextPacket`.
 */
export interface ConsumeExtensionInput<E = unknown> {
  /** Extension payload from the prior Handoff, or `undefined` if none. */
  extension: E | undefined;
  /** The prior Handoff itself — useful when the hook wants the core too. */
  priorHandoff: Handoff;
  /** Packet being built for the next Wake. The hook returns a (possibly modified) copy. */
  packet: ContextPacket;
}

/**
 * One harness-type contract. Every Harness instance has exactly one
 * registered `HarnessType` for its lifetime, fixed at construction.
 *
 * Both hooks are optional:
 * - if `produceExtension` is absent, the Handoff's per-type extension entry
 *   is omitted (the core still writes).
 * - if `consumeExtension` is absent, the next Wake's packet passes
 *   through unchanged.
 */
export interface HarnessType<E = unknown> {
  /** Stable id used as the key in `Handoff.extensions` and in the registry. */
  readonly id: string;
  /** Optional human-readable label for diagnostics / UI. */
  readonly label?: string;
  /** Optional version stamped on produced extensions for evolution. */
  readonly schemaVersion?: number;

  /**
   * Build the per-type extension payload at Wake close.
   * May return undefined to skip writing an extension entry.
   * Throws are caught by the helper, logged, and treated as "no extension".
   */
  produceExtension?(
    input: ProduceExtensionInput,
  ): Promise<E | undefined> | E | undefined;

  /**
   * Inject extension content into the next Wake's ContextPacket.
   * Must return the (possibly modified) packet.
   * Throws are rethrown by the helper as `HandoffExtensionConsumeError` —
   * a Wake-startup blocker per decision 005.
   */
  consumeExtension?(
    input: ConsumeExtensionInput<E>,
  ): Promise<ContextPacket> | ContextPacket;
}

/**
 * In-memory map of `HarnessType`s keyed by id, process-scoped. The daemon
 * creates one of these at startup, registers the default no-op type, and
 * passes it through to every `Harness` instance via construction.
 */
export interface HarnessTypeRegistry {
  /** Register a type. Replaces any existing type with the same id (last write wins). */
  register(type: HarnessType): void;
  /** Look up by id. Returns `undefined` if not registered. */
  get(id: string): HarnessType | undefined;
  /**
   * Look up by id, falling back to the default type when not registered or
   * when `id` is undefined. Always returns *some* type; never undefined.
   */
  resolve(id: string | undefined): HarnessType;
  /** Snapshot of currently registered types, in registration order. */
  list(): HarnessType[];
}
