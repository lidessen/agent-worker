// Binding inventory for C2 (slice 4).
//
// Walks every managed Harness's resolved agent config, classifies
// each binding (agent → runtime + model) as closed / open / unknown,
// and records whether an OSS fallback is configured. A "binding"
// here is one (harness, agent-name) pair — a single closed-source
// model used by N agents counts as N bindings, since each agent is
// independently reachable / unreachable.
//
// `OSS fallback configured` reads convention: today no formal
// `fallback` field exists in config. The metric counts a binding as
// "covered" when it is itself an open-source binding (closed-source
// bindings are by definition uncovered until the config schema gains
// a fallback slot). This honest minimum-viable computation is the
// pragmatic implementation chosen in decision 004.

import type { Harness } from "@agent-worker/harness";
import type { HarnessRegistry } from "../harness-registry.ts";

export type BindingSource = "closed" | "open" | "unknown";

export interface BindingEntry {
  harness: string;
  agent: string;
  runtime: string;
  model: string;
  provider?: string;
  source: BindingSource;
  ossFallbackConfigured: boolean;
}

const CLOSED_RUNTIMES = new Set(["claude-code", "codex"]);
const CLOSED_PROVIDERS = new Set(["anthropic", "openai", "google"]);
const OPEN_PROVIDERS = new Set([
  "deepseek",
  "moonshot",
  "kimi",
  "kimi-code",
  "qwen",
  "alibaba",
  "zhipu",
  "glm",
  "ollama",
  "groq",
  "minimax",
]);

export function classifyRuntime(runtime: string, provider?: string): BindingSource {
  if (CLOSED_RUNTIMES.has(runtime)) return "closed";
  if (runtime === "ai-sdk") {
    if (!provider) return "unknown";
    if (CLOSED_PROVIDERS.has(provider)) return "closed";
    if (OPEN_PROVIDERS.has(provider)) return "open";
    return "unknown";
  }
  if (runtime === "cursor") return "unknown"; // depends on user's cursor config
  if (runtime === "mock") return "unknown";
  return "unknown";
}

interface HarnessLike {
  name: string;
  resolved?: {
    agents: Array<{
      name: string;
      runtime?: string;
      model?: { full: string; provider?: string };
    }>;
  };
}

export function buildInventory(registry: HarnessRegistry): BindingEntry[] {
  const inventory: BindingEntry[] = [];
  for (const managed of registry.iterManaged()) {
    // ManagedHarness has both `harness: Harness` and `resolved`.
    // Read the resolved.agents; skip if absent.
    const m = managed as unknown as { harness: Harness; resolved?: HarnessLike["resolved"] };
    const harnessName = m.harness?.name ?? "?";
    const agents = m.resolved?.agents ?? [];
    for (const agent of agents) {
      const runtime = agent.runtime ?? "unknown";
      const provider = agent.model?.provider;
      const model = agent.model?.full ?? "?";
      const source = classifyRuntime(runtime, provider);
      inventory.push({
        harness: harnessName,
        agent: agent.name,
        runtime,
        model,
        provider,
        source,
        ossFallbackConfigured: source === "open",
      });
    }
  }
  return inventory;
}
