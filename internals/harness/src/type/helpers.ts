// Hook-invocation helpers. Every Handoff write/read site goes through
// these — no site invokes a hook directly. This is the seam where the
// asymmetric failure semantics from decision 005 + 006 are enforced:
//
//   produceExtension throws → log + swallow, return undefined; the
//     Handoff core still writes (missing extension is recoverable).
//   consumeExtension throws → rethrow as HandoffExtensionConsumeError;
//     a Wake-startup blocker — the substrate must NOT silently drop
//     extension content.

import type { ContextPacket } from "@agent-worker/agent";
import type { Handoff, HandoffExtensionPayload } from "../state/types.ts";
import {
  DEFAULT_HARNESS_TYPE_ID,
  defaultHarnessType,
} from "./default.ts";
import type {
  ConsumeExtensionInput,
  HarnessType,
  HarnessTypeRegistry,
  ProduceExtensionInput,
} from "./types.ts";

/**
 * Thrown when a `consumeExtension` hook fails. The orchestrator surfaces
 * this as a Wake-startup blocker per decision 005 ("a failed extension
 * consume must not silently drop content"). Includes the offending
 * `harnessTypeId` so the operator knows which type's hook to fix.
 */
export class HandoffExtensionConsumeError extends Error {
  readonly harnessTypeId: string;
  override readonly cause?: unknown;

  constructor(harnessTypeId: string, cause: unknown) {
    super(
      `consumeExtension failed for harness type "${harnessTypeId}": ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = "HandoffExtensionConsumeError";
    this.harnessTypeId = harnessTypeId;
    this.cause = cause;
  }
}

/** Optional logger surface; helpers only use `warn` for produce-throw cases. */
export interface ProduceLogger {
  warn(message: string, error?: unknown): void;
}

/** A console-backed default logger so callers don't have to wire one up in tests. */
const consoleLogger: ProduceLogger = {
  warn(message, error) {
    if (error !== undefined) {
      console.warn(`[harness-type] ${message}`, error);
    } else {
      console.warn(`[harness-type] ${message}`);
    }
  },
};

/**
 * Run the registered type's `produceExtension`. Returns the {id, payload}
 * pair to attach to `Handoff.extensions`, or `undefined` when nothing
 * should be attached (no hook registered, hook returned undefined, or
 * hook threw). On throw, the error is logged via `logger.warn`.
 */
export async function runProduceExtension(
  registry: HarnessTypeRegistry,
  harnessTypeId: string | undefined,
  input: ProduceExtensionInput,
  logger: ProduceLogger = consoleLogger,
): Promise<{ id: string; payload: HandoffExtensionPayload } | undefined> {
  const type = registry.resolve(harnessTypeId);
  if (!type.produceExtension) return undefined;

  try {
    const payload = await type.produceExtension(input);
    if (payload === undefined) return undefined;
    return { id: type.id, payload };
  } catch (err) {
    logger.warn(
      `produceExtension failed for harness type "${type.id}" — Handoff core still writes`,
      err,
    );
    return undefined;
  }
}

/**
 * Run the registered type's `consumeExtension` against a prior Handoff,
 * returning the (possibly modified) packet. If the prior Handoff has no
 * extension entry for the resolved type, or the type registers no hook,
 * the packet passes through unchanged.
 *
 * Hook throws rethrow as `HandoffExtensionConsumeError`.
 */
export async function runConsumeExtension(
  registry: HarnessTypeRegistry,
  priorHandoff: Handoff,
  packet: ContextPacket,
): Promise<ContextPacket> {
  const id = priorHandoff.harnessTypeId ?? DEFAULT_HARNESS_TYPE_ID;
  const type: HarnessType = registry.resolve(id);
  if (!type.consumeExtension) return packet;

  const extension = priorHandoff.extensions[type.id];
  // Treat a missing entry as "nothing to consume" but still call the hook
  // so types that contribute packet content even without a payload (e.g.
  // a type that only injects a recap section) get a chance to run.
  try {
    return await type.consumeExtension({
      extension,
      priorHandoff,
      packet,
    });
  } catch (err) {
    throw new HandoffExtensionConsumeError(type.id, err);
  }
}

// Re-export commonly imported pieces for convenience at the site of wiring.
export { DEFAULT_HARNESS_TYPE_ID, defaultHarnessType };
