export type {
  WorkspaceDef,
  AgentDef,
  SetupStep,
  ResolvedWorkspace,
} from "./types.ts";

export {
  loadWorkspaceDef,
  parseWorkspaceDef,
  toWorkspaceConfig,
  interpolate,
  runSetupSteps,
} from "./loader.ts";

export type { LoadOptions } from "./loader.ts";
