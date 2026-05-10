export type {
  AgentRole,
  HarnessDef,
  ConnectionDef,
  AgentDef,
  McpServerDef,
  ModelSpec,
  ModelDef,
  SetupStep,
  ResolvedHarness,
  ResolvedAgent,
  ResolvedModel,
  PolicyDef,
} from "./types.ts";

export {
  loadHarnessDef,
  parseHarnessDef,
  toHarnessConfig,
  resolveModel,
  resolveConnections,
  saveConnection,
  interpolate,
  runSetupSteps,
} from "./loader.ts";

export type { LoadOptions, ToHarnessConfigOptions, RuntimeResolver } from "./loader.ts";

export { loadSecrets, saveSecrets, setSecret, deleteSecret, getSecretsPath } from "./secrets.ts";

// resolve-runtime moved to @agent-worker/agent-worker (orchestration concern)
