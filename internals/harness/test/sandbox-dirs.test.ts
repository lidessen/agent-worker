import { test, expect, describe } from "bun:test";
import { assemblePrompt } from "../src/loop/prompt.tsx";
import { harnessPromptSection, HARNESS_PROMPT_SECTIONS } from "../src/context/mcp/prompts.tsx";
import { createHarness } from "../src/factory.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import { renderPromptDocument } from "../src/loop/prompt-ui.tsx";
import type { PromptSectionNode } from "../src/loop/prompt-ui.tsx";

function renderSectionResult(
  result: PromptSectionNode | PromptSectionNode[] | null,
): string | null {
  if (!result) return null;
  return renderPromptDocument(Array.isArray(result) ? result : [result]);
}

describe("Sandbox directory visibility", () => {
  test("harnessPromptSection includes both sandbox dirs", async () => {
    const harness = await createHarness({
      name: "test",
      channels: ["general"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    const result = await harnessPromptSection({
      agentName: "alice",
      provider: harness.contextProvider,
      inboxEntries: [],
      sandboxDir: "/data/agents/alice/sandbox",
      harnessSandboxDir: "/data/sandbox",
    });

    const text = renderSectionResult(result);
    expect(text).toContain("Directories");
    expect(text).toContain("/data/agents/alice/sandbox");
    expect(text).toContain("/data/sandbox");
    expect(text).toContain("Personal sandbox");
    expect(text).toContain("Shared harness");
  });

  test("harnessPromptSection shows (not available) when dirs are undefined", async () => {
    const harness = await createHarness({
      name: "test",
      channels: ["general"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    const result = await harnessPromptSection({
      agentName: "alice",
      provider: harness.contextProvider,
      inboxEntries: [],
    });

    const text = renderSectionResult(result);
    expect(text).toContain("(not available)");
  });

  test("assemblePrompt passes sandbox dirs through to sections", async () => {
    const harness = await createHarness({
      name: "test",
      channels: ["general"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    const result = await assemblePrompt(HARNESS_PROMPT_SECTIONS, {
      agentName: "alice",
      provider: harness.contextProvider,
      inboxEntries: [],
      currentInstruction: "do something",
      sandboxDir: "/home/alice/sandbox",
      harnessSandboxDir: "/shared/harness",
    });

    expect(result).toContain("/home/alice/sandbox");
    expect(result).toContain("/shared/harness");
  });
});
