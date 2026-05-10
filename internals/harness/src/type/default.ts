// Default no-op `HarnessType`. Registered at process startup so every
// Handoff write/read site can resolve *some* type even before any
// concrete type (coordination, coding, etc.) is plugged in.
//
// Slice 1 ships only this one. Slice 2 adds
// `MultiAgentCoordinationHarnessType` alongside, when channels/inbox
// extract out of the substrate.

import type { HarnessType } from "./types.ts";

/** Stable id used when no harness type id is otherwise present. */
export const DEFAULT_HARNESS_TYPE_ID = "default" as const;

/**
 * No-op default. Both hooks are absent — `produceExtension` returning
 * "absent" means the Handoff's `extensions` map gets no entry under
 * this id; `consumeExtension` absent means the next Wake's packet
 * passes through unchanged. Observable behavior is identical to the
 * pre-006 codebase.
 */
export const defaultHarnessType: HarnessType = {
  id: DEFAULT_HARNESS_TYPE_ID,
  label: "default (no-op)",
};
