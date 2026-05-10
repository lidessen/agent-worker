// `internals/harness/src/type/` — public surface of the HarnessType protocol.

export type {
  HarnessType,
  HarnessTypeRegistry,
  ProduceExtensionInput,
  ConsumeExtensionInput,
} from "./types.ts";

export { DEFAULT_HARNESS_TYPE_ID, defaultHarnessType } from "./default.ts";

export { createHarnessTypeRegistry } from "./registry.ts";

export {
  HandoffExtensionConsumeError,
  runProduceExtension,
  runConsumeExtension,
} from "./helpers.ts";
export type { ProduceLogger } from "./helpers.ts";
