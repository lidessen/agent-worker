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
 * Per-Harness, per-type runtime slot. The substrate stores whatever the
 * type's `contributeRuntime` returns under `harness.typeRuntime`,
 * opaquely; the type's own consumer-side accessor (e.g.
 * `coordinationRuntime(harness)`) narrows the type when callers need it.
 *
 * Substrate code never inspects this value — it just holds the slot
 * across the Harness lifetime so the type's lifecycle hooks can read it.
 */
export type HarnessTypeRuntime = unknown;

/**
 * Inputs to `contributeRuntime`. The type sees the Harness instance
 * itself plus the construction-time config, before lifecycle starts.
 *
 * `harness` is given as `unknown` here to keep the substrate import
 * graph free of a back-reference; concrete types cast at the call
 * boundary into the concrete `Harness` shape they expect.
 */
export interface ContributeRuntimeInput {
  harness: unknown;
  config: unknown;
}

/** Inputs to `onInit`. Includes the runtime that `contributeRuntime` returned (or `undefined` if none). */
export interface OnInitInput<R = HarnessTypeRuntime> {
  harness: unknown;
  runtime: R | undefined;
}

/** Inputs to `onShutdown`. Mirrors `OnInitInput`. */
export interface OnShutdownInput<R = HarnessTypeRuntime> {
  harness: unknown;
  runtime: R | undefined;
}

/**
 * Opaque MCP tool definition contributed by a `HarnessType`. Substrate
 * does not inspect the shape — concrete consumers (factory.ts in the
 * substrate, the MCP server) cast this to whatever shape their
 * registration code expects. Kept opaque here so the substrate's import
 * graph does not pull in the MCP SDK.
 */
export type ContributedMcpTool = unknown;

/** Inputs to `contributeMcpTools`. Mirrors `OnInitInput` plus the agent name. */
export interface ContributeMcpToolsInput<R = HarnessTypeRuntime> {
  harness: unknown;
  runtime: R | undefined;
  agentName: string;
}

/**
 * Opaque prompt section contributed by a `HarnessType`. Same rationale
 * as `ContributedMcpTool`: substrate does not inspect; concrete consumers
 * (the prompt assembly path) cast at the boundary.
 */
export type ContributedPromptSection = unknown;

/** Inputs to `contributeContextSections`. Mirrors `ContributeMcpToolsInput`. */
export interface ContributeContextSectionsInput<R = HarnessTypeRuntime> {
  harness: unknown;
  runtime: R | undefined;
  agentName: string;
}

/** Inputs to `snapshotExtension`. Mirrors lifecycle inputs plus snapshot opts. */
export interface SnapshotExtensionInput<R = HarnessTypeRuntime> {
  harness: unknown;
  runtime: R | undefined;
  opts?: {
    inboxLimit?: number;
    timelineLimit?: number;
    chronicleLimit?: number;
    queuedLimit?: number;
  };
}

/**
 * Inputs to `parseConfig`. The harness loader hands the type-specific
 * raw config (whatever was parsed from YAML/JSON minus the substrate
 * fields) and lets the type validate / project it into its own config
 * shape.
 */
export interface ParseConfigInput {
  raw: unknown;
}

/**
 * One harness-type contract. Every Harness instance has exactly one
 * registered `HarnessType` for its lifetime, fixed at construction.
 *
 * Every method is optional. The substrate calls each at the right
 * lifecycle point and tolerates absence:
 *
 * - `contributeRuntime` — called once at Harness construction; the
 *   returned value is stashed in `harness.typeRuntime` and passed back
 *   into the type's lifecycle hooks. `undefined` means the type carries
 *   no per-Harness state.
 * - `onInit` / `onShutdown` — called from `Harness.init` / `shutdown`.
 *   The type starts background work (telegram adapter, queue workers,
 *   …) on init and tears it down on shutdown. Absence means no-op.
 * - `produceExtension` — at Wake close, builds the per-type Handoff
 *   extension payload. Absence omits the extension entry (core still
 *   writes).
 * - `consumeExtension` — at next Wake start, injects extension content
 *   into the `ContextPacket`. Absence passes the packet through
 *   unchanged.
 */
export interface HarnessType<E = unknown, R = HarnessTypeRuntime> {
  /** Stable id used as the key in `Handoff.extensions` and in the registry. */
  readonly id: string;
  /** Optional human-readable label for diagnostics / UI. */
  readonly label?: string;
  /** Optional version stamped on produced extensions for evolution. */
  readonly schemaVersion?: number;

  /**
   * Build the per-Harness runtime slot. Called once at construction
   * before `init`. Returns `undefined` to indicate "no per-Harness
   * state needed". Sync only — async setup belongs in `onInit`.
   */
  contributeRuntime?(input: ContributeRuntimeInput): R | undefined;

  /**
   * Lifecycle: run after substrate `init` work has completed, before
   * the harness is considered ready. Use this to start background work
   * the type owns (telegram adapter, queue worker, …).
   */
  onInit?(input: OnInitInput<R>): Promise<void> | void;

  /**
   * Lifecycle: run before substrate `shutdown` work. Tear down whatever
   * `onInit` started.
   */
  onShutdown?(input: OnShutdownInput<R>): Promise<void> | void;

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

  /**
   * Contribute MCP tool definitions for this Harness's agents. The
   * substrate's tool factory merges substrate-only tools (resource_*,
   * task_*, wake_*) with each registered type's contributions before
   * registering with the agent's MCP server. Absence means no
   * type-contributed tools.
   */
  contributeMcpTools?(input: ContributeMcpToolsInput<R>): ContributedMcpTool[];

  /**
   * Contribute additional prompt sections to be appended after the
   * substrate's `SUBSTRATE_BASE_SECTIONS`. Coord-flavored sections
   * (`inboxSection`, `responseGuidelines`) live here. Absence means
   * the prompt uses substrate sections only.
   */
  contributeContextSections?(input: ContributeContextSectionsInput<R>): ContributedPromptSection[];

  /**
   * Build the per-type slice of `HarnessStateSnapshot.typeExtensions`.
   * Substrate emits its own slice (name/tag/harnessTypeId/documents/
   * chronicle); the type fills in its own keyed payload here.
   * Absence means no entry under this type's id.
   */
  snapshotExtension?(input: SnapshotExtensionInput<R>): Promise<unknown> | unknown;

  /**
   * Parse the type-specific portion of a `HarnessConfig` (everything
   * the substrate didn't recognize). Returns the projected shape the
   * type expects in `contributeRuntime` / `onInit`. Absence means the
   * type takes no config (or accepts the raw value as-is).
   */
  parseConfig?(input: ParseConfigInput): unknown;
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
