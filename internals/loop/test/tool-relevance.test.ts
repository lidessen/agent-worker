import { test, expect, describe } from "bun:test";
import { ToolRelevanceEngine, type StepContext } from "../src/tool-relevance.ts";
import type { ToolSet } from "ai";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTools(defs: Record<string, string>): ToolSet {
  const tools: Record<string, { description: string }> = {};
  for (const [name, desc] of Object.entries(defs)) {
    tools[name] = { description: desc };
  }
  return tools as unknown as ToolSet;
}

const TOOLS = makeTools({
  bash: "Execute shell commands in a sandboxed environment",
  readFile: "Read file contents from the filesystem",
  writeFile: "Write content to a file on the filesystem",
  webSearch: "Search the web for information",
  webFetch: "Fetch content from a URL",
  agent_todo: "Manage your working memory todos",
  agent_inbox: "Interact with the message inbox",
  databaseQuery: "Run SQL queries against the database",
  deployService: "Deploy a service to production",
});

function step(overrides: Partial<StepContext["steps"][0]> = {}): StepContext["steps"][0] {
  return {
    text: "",
    toolCalls: [],
    toolResults: [],
    finishReason: "tool-calls",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ToolRelevanceEngine", () => {
  describe("classify", () => {
    test("classifies tools by tier", () => {
      const engine = new ToolRelevanceEngine({
        tiers: {
          bash: "always",
          readFile: "always",
          databaseQuery: "on-demand",
          deployService: "on-demand",
        },
      });
      const result = engine.classify(TOOLS);
      expect(result.always).toEqual(["bash", "readFile"]);
      expect(result.onDemand).toEqual(["databaseQuery", "deployService"]);
      expect(result.contextual).toContain("webSearch");
      expect(result.contextual).not.toContain("bash");
      expect(result.contextual).not.toContain("databaseQuery");
    });

    test("defaults all tools to contextual when no tiers configured", () => {
      const engine = new ToolRelevanceEngine();
      const result = engine.classify(TOOLS);
      expect(result.always).toEqual([]);
      expect(result.onDemand).toEqual([]);
      expect(result.contextual).toHaveLength(Object.keys(TOOLS).length);
    });
  });

  describe("selectActiveTools", () => {
    test("returns undefined when no tiers configured", () => {
      const engine = new ToolRelevanceEngine();
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      expect(engine.selectActiveTools(TOOLS, ctx)).toBeUndefined();
    });

    test("step 0 includes always + contextual, excludes on-demand", () => {
      const engine = new ToolRelevanceEngine({
        tiers: { bash: "always", deployService: "on-demand" },
      });
      const result = engine.selectActiveTools(TOOLS, { stepNumber: 0, steps: [] })!;
      expect(result).toContain("bash");
      expect(result).toContain("webSearch"); // contextual
      expect(result).not.toContain("deployService"); // on-demand
    });

    test("step 0 includes _activate_tool when on-demand tools exist", () => {
      const engine = new ToolRelevanceEngine({
        tiers: { bash: "always", deployService: "on-demand" },
      });
      const toolsWithDiscovery = {
        ...TOOLS,
        _activate_tool: { description: "Discover and activate on-demand tools" },
      } as unknown as ToolSet;
      const result = engine.selectActiveTools(toolsWithDiscovery, { stepNumber: 0, steps: [] })!;
      expect(result).toContain("_activate_tool");
      expect(result).not.toContain("deployService");
    });

    test("always-tier tools are always included", () => {
      const engine = new ToolRelevanceEngine({
        tiers: { bash: "always", readFile: "always", deployService: "on-demand" },
      });
      const ctx: StepContext = {
        stepNumber: 3,
        steps: [
          step({ toolCalls: [{ toolName: "webSearch" }] }),
          step({ toolCalls: [{ toolName: "webSearch" }] }),
          step({ toolCalls: [{ toolName: "webSearch" }] }),
        ],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).toContain("bash");
      expect(result).toContain("readFile");
    });

    test("contextual tools included when recently used", () => {
      const engine = new ToolRelevanceEngine({
        tiers: { bash: "always", deployService: "on-demand" },
      });
      const ctx: StepContext = {
        stepNumber: 2,
        steps: [
          step({ toolCalls: [{ toolName: "webSearch" }, { toolName: "webFetch" }] }),
          step({ toolCalls: [{ toolName: "webSearch" }] }),
        ],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).toContain("webSearch"); // recently used
      expect(result).toContain("webFetch"); // recently used
    });

    test("contextual tools included when errored for retry", () => {
      const engine = new ToolRelevanceEngine({
        tiers: { bash: "always", deployService: "on-demand" },
      });
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [
          step({
            toolCalls: [{ toolName: "readFile" }],
            toolResults: [{ toolName: "readFile", result: "Error: file not found" }],
          }),
        ],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).toContain("readFile");
    });

    test("all contextual tools included when none were recently used", () => {
      const engine = new ToolRelevanceEngine({
        tiers: { bash: "always", deployService: "on-demand" },
      });
      // Model only produced text, no tool calls → don't starve it
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ text: "Let me think about this...", toolCalls: [] })],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      // All contextual tools should be present
      expect(result).toContain("webSearch");
      expect(result).toContain("readFile");
      expect(result).toContain("agent_todo");
      // But still no on-demand
      expect(result).not.toContain("deployService");
    });
  });

  describe("on-demand tools", () => {
    test("on-demand tools excluded until activated", () => {
      const engine = new ToolRelevanceEngine({
        tiers: {
          bash: "always",
          databaseQuery: "on-demand",
          deployService: "on-demand",
        },
      });
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).not.toContain("databaseQuery");
      expect(result).not.toContain("deployService");
    });

    test("activated on-demand tools appear in selection", () => {
      const engine = new ToolRelevanceEngine({
        tiers: {
          bash: "always",
          databaseQuery: "on-demand",
          deployService: "on-demand",
        },
      });
      engine.activateOnDemand("databaseQuery");

      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).toContain("databaseQuery");
      expect(result).not.toContain("deployService");
    });

    test("resetActivations clears activated on-demand tools", () => {
      const engine = new ToolRelevanceEngine({
        tiers: { databaseQuery: "on-demand", deployService: "on-demand" },
      });
      engine.activateOnDemand("databaseQuery");
      engine.resetActivations();

      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      // No on-demand tiers active, and all non-on-demand are contextual
      // with recent use → should not contain deactivated on-demand
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).not.toContain("databaseQuery");
    });

    test("getOnDemandCatalog returns names and descriptions", () => {
      const engine = new ToolRelevanceEngine({
        tiers: {
          bash: "always",
          databaseQuery: "on-demand",
          deployService: "on-demand",
        },
      });
      const catalog = engine.getOnDemandCatalog(TOOLS);
      expect(catalog).toHaveLength(2);
      expect(catalog.map((t) => t.name)).toEqual(["databaseQuery", "deployService"]);
      expect(catalog[0]!.description).toBe("Run SQL queries against the database");
    });
  });

  describe("returns undefined when no filtering occurs", () => {
    test("no on-demand and no always → no filtering", () => {
      const engine = new ToolRelevanceEngine();
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      expect(engine.selectActiveTools(TOOLS, ctx)).toBeUndefined();
    });

    test("all tools would be included → returns undefined", () => {
      // Only 1 on-demand tool, rest are always/contextual, all activated
      const smallTools = makeTools({ bash: "shell", rare: "rare tool" });
      const engine = new ToolRelevanceEngine({
        tiers: { bash: "always", rare: "on-demand" },
      });
      engine.activateOnDemand("rare");
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      expect(engine.selectActiveTools(smallTools, ctx)).toBeUndefined();
    });
  });
});
