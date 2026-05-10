// `internals/harness/src/type/` — public surface of the HarnessType protocol.

export type {
  HarnessType,
  HarnessTypeRegistry,
  HarnessTypeRuntime,
  ContributeRuntimeInput,
  OnInitInput,
  OnShutdownInput,
  ProduceExtensionInput,
  ConsumeExtensionInput,
  ContributedMcpTool,
  ContributedPromptSection,
  ContributeMcpToolsInput,
  ContributeContextSectionsInput,
  SnapshotExtensionInput,
  ParseConfigInput,
} from "./types.ts";

export { DEFAULT_HARNESS_TYPE_ID, defaultHarnessType } from "./default.ts";

export { createHarnessTypeRegistry } from "./registry.ts";

export {
  HandoffExtensionConsumeError,
  runProduceExtension,
  runConsumeExtension,
} from "./helpers.ts";
export type { ProduceLogger } from "./helpers.ts";
