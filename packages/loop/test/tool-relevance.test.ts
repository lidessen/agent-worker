import { test, expect, describe } from "bun:test";
import { ToolRelevanceEngine, type StepContext } from "../src/tool-relevance.ts";
import type { ToolSet } from "ai";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Minimal tool-like object with description — enough for the relevance engine. */
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
  agent_notes: "Persistent key-value notes storage",
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
  describe("selectActiveTools", () => {
    test("returns undefined on step 0 (all tools active)", () => {
      const engine = new ToolRelevanceEngine({ maxActiveTools: 3 });
      const result = engine.selectActiveTools(TOOLS, { stepNumber: 0, steps: [] });
      expect(result).toBeUndefined();
    });

    test("returns undefined when no filtering configured", () => {
      const engine = new ToolRelevanceEngine();
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      expect(engine.selectActiveTools(TOOLS, ctx)).toBeUndefined();
    });

    test("core tools are always included", () => {
      const engine = new ToolRelevanceEngine({
        coreTools: ["bash", "readFile"],
        maxActiveTools: 3,
      });
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "webSearch" }] })],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).toContain("bash");
      expect(result).toContain("readFile");
    });

    test("recently-used tools score high", () => {
      const engine = new ToolRelevanceEngine({
        coreTools: ["bash"],
        maxActiveTools: 4,
      });
      const ctx: StepContext = {
        stepNumber: 2,
        steps: [
          step({ toolCalls: [{ toolName: "webSearch" }, { toolName: "webFetch" }] }),
          step({ toolCalls: [{ toolName: "webSearch" }] }),
        ],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).toContain("bash"); // core
      expect(result).toContain("webSearch"); // used in both steps
      expect(result).toContain("webFetch"); // co-occurred with webSearch
    });

    test("tools with errors score for retry", () => {
      const engine = new ToolRelevanceEngine({
        coreTools: ["bash"],
        maxActiveTools: 3,
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
      expect(result).toContain("readFile"); // errored, keep for retry
    });

    test("description match scores tools mentioned in model text", () => {
      const engine = new ToolRelevanceEngine({
        maxActiveTools: 4,
      });
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [
          step({
            text: "I need to search the web for more information about this topic",
            toolCalls: [],
          }),
        ],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      expect(result).toContain("webSearch"); // description matches "search the web"
    });

    test("co-occurring tools boost each other", () => {
      const engine = new ToolRelevanceEngine({
        coreTools: [],
        maxActiveTools: 3,
      });
      const ctx: StepContext = {
        stepNumber: 2,
        steps: [
          // Step 0: webSearch + webFetch used together
          step({ toolCalls: [{ toolName: "webSearch" }, { toolName: "webFetch" }] }),
          // Step 1: only webSearch used
          step({ toolCalls: [{ toolName: "webSearch" }] }),
        ],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      // webFetch should score high due to co-occurrence with the recently-used webSearch
      expect(result).toContain("webSearch");
      expect(result).toContain("webFetch");
    });

    test("returns undefined when all tools would be selected anyway", () => {
      const engine = new ToolRelevanceEngine({
        maxActiveTools: 100, // more than total tools
      });
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }] })],
      };
      expect(engine.selectActiveTools(TOOLS, ctx)).toBeUndefined();
    });

    test("minScore filters low-relevance tools", () => {
      const engine = new ToolRelevanceEngine({
        minScore: 0.3,
      });
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "bash" }], text: "" })],
      };
      const result = engine.selectActiveTools(TOOLS, ctx)!;
      // Only bash should pass the threshold (recently used → high score)
      // Other tools with 0 score should be filtered
      expect(result).toContain("bash");
      expect(result.length).toBeLessThan(Object.keys(TOOLS).length);
    });
  });

  describe("scoreTools", () => {
    test("returns scores for all tools", () => {
      const engine = new ToolRelevanceEngine({ coreTools: ["bash"] });
      const ctx: StepContext = {
        stepNumber: 1,
        steps: [step({ toolCalls: [{ toolName: "readFile" }] })],
      };
      const scores = engine.scoreTools(TOOLS, ctx);
      expect(scores).toHaveLength(Object.keys(TOOLS).length);

      const bashScore = scores.find((s) => s.name === "bash");
      expect(bashScore?.isCore).toBe(true);
      expect(bashScore?.score).toBe(1.0);

      const readFileScore = scores.find((s) => s.name === "readFile");
      expect(readFileScore?.isCore).toBe(false);
      expect(readFileScore!.score).toBeGreaterThan(0);
    });

    test("returns zero scores on step 0", () => {
      const engine = new ToolRelevanceEngine();
      const scores = engine.scoreTools(TOOLS, { stepNumber: 0, steps: [] });
      const nonCore = scores.filter((s) => !s.isCore);
      for (const s of nonCore) {
        expect(s.score).toBe(0);
      }
    });
  });
});
