import { test, expect, describe, beforeAll } from "bun:test";
import { ClaudeCodeLoop } from "../src/loops/claude-code.ts";
import { CodexLoop } from "../src/loops/codex.ts";
import { CursorLoop } from "../src/loops/cursor.ts";
import { collectEvents, collectEventsSafe, eventsOfType, withTimeout, hasTextOutput, hasToolCalls, getToolNames } from "./helpers/test-utils.ts";

const MOCK_CLI = new URL("./helpers/mock-cli.ts", import.meta.url).pathname;

/**
 * Creates a ClaudeCodeLoop that uses mock-cli.ts instead of the real `claude` command.
 */
function createMockClaudeLoop(scenario: string) {
  return new ClaudeCodeLoop({
    extraArgs: ["--format", "claude", "--scenario", scenario],
  });
}

function createMockCodexLoop(scenario: string) {
  return new CodexLoop({
    extraArgs: ["--format", "codex", "--scenario", scenario],
  });
}

function createMockCursorLoop(scenario: string) {
  return new CursorLoop({
    extraArgs: ["--format", "cursor", "--scenario", scenario],
  });
}

// We need to override the command. Since the loops hardcode the command,
// we'll test via runCliLoop directly with the mock.
import { runCliLoop } from "../src/utils/cli-loop.ts";
import type { CliLoopConfig } from "../src/utils/cli-loop.ts";

// Import the event mappers by re-reading the source implementations
// For testing, we use runCliLoop directly with mock-cli as the command.

function mockCliConfig(format: string, scenario: string, mapEvent: CliLoopConfig["mapEvent"], extractResult: CliLoopConfig["extractResult"]): CliLoopConfig {
  return {
    command: "bun",
    args: ["run", MOCK_CLI, "--format", format, "--scenario", scenario],
    mapEvent,
    extractResult,
  };
}

// ── Claude Code event mapper (duplicated for test isolation) ────────────────

function mapClaudeEvent(data: unknown) {
  const event = data as Record<string, unknown>;
  const type = event.type as string;

  switch (type) {
    case "assistant": {
      const message = event.message as Record<string, unknown> | undefined;
      const content = message?.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(content)) return null;
      for (const block of content) {
        if (block.type === "tool_use") {
          return { type: "tool_call_start" as const, name: block.name as string, callId: block.id as string, args: block.input as Record<string, unknown> };
        }
        if (block.type === "text") {
          return { type: "text" as const, text: block.text as string };
        }
      }
      return null;
    }
    case "tool":
      return { type: "tool_call_end" as const, name: (event.tool_name as string) ?? "unknown", callId: event.tool_call_id as string | undefined, result: event.content };
    case "result": {
      const usage = event.usage as Record<string, number> | undefined;
      if (usage) {
        return { type: "usage" as const, usage: { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0, totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) } };
      }
      if (event.result) return { type: "text" as const, text: event.result as string };
      return null;
    }
    default:
      return { type: "unknown" as const, data: event };
  }
}

function extractClaudeResult(stdout: string): string {
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]!) as Record<string, unknown>;
      if (parsed.type === "result" && typeof parsed.result === "string") return parsed.result;
    } catch { /* skip */ }
  }
  return stdout;
}

// ── Codex event mapper ──────────────────────────────────────────────────────

function mapCodexEvent(data: unknown) {
  const event = data as Record<string, unknown>;
  const type = event.type as string;
  switch (type) {
    case "message":
      if ((event.role as string) === "assistant") return { type: "text" as const, text: (event.content as string) ?? "" };
      return null;
    case "function_call":
    case "tool_call":
      return { type: "tool_call_start" as const, name: (event.name as string) ?? "unknown", args: (event.arguments as Record<string, unknown>) ?? {} };
    case "function_call_output":
    case "tool_call_output":
      return { type: "tool_call_end" as const, name: (event.name as string) ?? "unknown", result: event.output };
    default:
      return { type: "unknown" as const, data: event };
  }
}

function extractCodexResult(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (typeof parsed.output === "string") return parsed.output;
    if (typeof parsed.result === "string") return parsed.result;
  } catch { /* not JSON */ }
  return stdout;
}

// ── Cursor event mapper ─────────────────────────────────────────────────────

function mapCursorEvent(data: unknown) {
  const event = data as Record<string, unknown>;
  const type = event.type as string;
  switch (type) {
    case "assistant": {
      const message = event.message as Record<string, unknown> | undefined;
      const content = message?.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(content)) return null;
      for (const block of content) {
        if (block.type === "tool_use") return { type: "tool_call_start" as const, name: block.name as string, callId: block.id as string, args: block.input as Record<string, unknown> };
        if (block.type === "text") return { type: "text" as const, text: block.text as string };
      }
      return null;
    }
    case "result":
      if (event.result) return { type: "text" as const, text: event.result as string };
      return null;
    default:
      return { type: "unknown" as const, data: event };
  }
}

function extractCursorResult(stdout: string): string {
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]!) as Record<string, unknown>;
      if (parsed.type === "result" && typeof parsed.result === "string") return parsed.result;
    } catch { /* skip */ }
  }
  return stdout;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ClaudeCodeLoop (mock)", () => {
  test("success scenario: emits text and tool_call_start/end events", async () => {
    const run = runCliLoop(
      mockCliConfig("claude", "success", mapClaudeEvent, extractClaudeResult),
      {},
    );
    const events = await collectEvents(run);
    const result = await run.result;

    expect(hasTextOutput(events)).toBe(true);
    expect(hasToolCalls(events)).toBe(true);
    expect(getToolNames(events)).toContain("bash");
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  test("error scenario: throws and emits error", async () => {
    const run = runCliLoop(
      mockCliConfig("claude", "error", mapClaudeEvent, extractClaudeResult),
      {},
    );
    const events = await collectEventsSafe(run);

    await expect(run.result).rejects.toThrow();
    expect(events.some((e) => e.type === "error")).toBe(true);
  });

  test("tool-calls scenario: multiple tool calls", async () => {
    const run = runCliLoop(
      mockCliConfig("claude", "tool-calls", mapClaudeEvent, extractClaudeResult),
      {},
    );
    const events = await collectEvents(run);
    const result = await run.result;

    const toolStarts = eventsOfType(events, "tool_call_start");
    const toolEnds = eventsOfType(events, "tool_call_end");
    // 3 starts + 3 ends
    expect(toolStarts.length).toBe(3);
    expect(toolEnds.length).toBe(3);
    expect(getToolNames(events)).toContain("bash");
    expect(getToolNames(events)).toContain("readFile");
    expect(getToolNames(events)).toContain("writeFile");
  });

  test("cancellation via abort signal completes quickly", async () => {
    const ac = new AbortController();
    const start = Date.now();
    const run = runCliLoop(
      mockCliConfig("claude", "slow", mapClaudeEvent, extractClaudeResult),
      {},
      { abortSignal: ac.signal },
    );

    // Cancel after 100ms (mock slow scenario takes 30s without cancellation)
    setTimeout(() => ac.abort(), 100);

    await run.result;
    const elapsed = Date.now() - start;

    // Should complete well under 30s thanks to cancellation
    expect(elapsed).toBeLessThan(5000);
  });
});

describe("CodexLoop (mock)", () => {
  test("success scenario", async () => {
    const run = runCliLoop(
      mockCliConfig("codex", "success", mapCodexEvent, extractCodexResult),
      {},
    );
    const events = await collectEvents(run);
    const result = await run.result;

    expect(hasTextOutput(events)).toBe(true);
    expect(hasToolCalls(events)).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);
  });

  test("error scenario", async () => {
    const run = runCliLoop(
      mockCliConfig("codex", "error", mapCodexEvent, extractCodexResult),
      {},
    );
    await collectEventsSafe(run);
    await expect(run.result).rejects.toThrow();
  });

  test("tool-calls scenario", async () => {
    const run = runCliLoop(
      mockCliConfig("codex", "tool-calls", mapCodexEvent, extractCodexResult),
      {},
    );
    const events = await collectEvents(run);
    await run.result;

    const toolStarts = eventsOfType(events, "tool_call_start");
    const toolEnds = eventsOfType(events, "tool_call_end");
    expect(toolStarts.length).toBe(3);
    expect(toolEnds.length).toBe(3);
  });
});

describe("CursorLoop (mock)", () => {
  test("success scenario", async () => {
    const run = runCliLoop(
      mockCliConfig("cursor", "success", mapCursorEvent, extractCursorResult),
      {},
    );
    const events = await collectEvents(run);
    const result = await run.result;

    expect(hasTextOutput(events)).toBe(true);
    expect(hasToolCalls(events)).toBe(true);
  });

  test("error scenario", async () => {
    const run = runCliLoop(
      mockCliConfig("cursor", "error", mapCursorEvent, extractCursorResult),
      {},
    );
    await collectEventsSafe(run);
    await expect(run.result).rejects.toThrow();
  });

  test("tool-calls scenario", async () => {
    const run = runCliLoop(
      mockCliConfig("cursor", "tool-calls", mapCursorEvent, extractCursorResult),
      {},
    );
    const events = await collectEvents(run);
    await run.result;

    // Cursor only emits tool_call_start from assistant blocks (no separate end events in mock)
    const toolStarts = eventsOfType(events, "tool_call_start");
    expect(toolStarts.length).toBe(3);
  });
});

describe("Cross-runtime contract", () => {
  test("all runtimes produce LoopRun with result promise", async () => {
    const configs = [
      { name: "claude", config: mockCliConfig("claude", "success", mapClaudeEvent, extractClaudeResult) },
      { name: "codex", config: mockCliConfig("codex", "success", mapCodexEvent, extractCodexResult) },
      { name: "cursor", config: mockCliConfig("cursor", "success", mapCursorEvent, extractCursorResult) },
    ];

    for (const { name, config } of configs) {
      const run = runCliLoop(config, {});

      // LoopRun contract: async iterable + result promise
      expect(Symbol.asyncIterator in run).toBe(true);
      expect(run.result).toBeInstanceOf(Promise);

      const events = await collectEvents(run);
      const result = await run.result;

      // All runtimes should produce events and a valid result
      expect(events.length).toBeGreaterThan(0);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(typeof result.usage.inputTokens).toBe("number");
    }
  });
});
