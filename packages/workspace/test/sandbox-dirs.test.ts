import { test, expect, describe } from "bun:test";
import { assemblePrompt } from "../src/loop/prompt.tsx";
import {
  workspacePromptSection,
  WORKSPACE_PROMPT_SECTIONS,
} from "../src/context/mcp/prompts.tsx";
import { createWorkspace } from "../src/factory.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import { renderPromptDocument } from "../src/loop/prompt-ui.tsx";

function renderSectionResult(
  result: Awaited<ReturnType<typeof workspacePromptSection>>,
): string | null {
  if (!result) return null;
  return renderPromptDocument(Array.isArray(result) ? result : [result]);
}

describe("Sandbox directory visibility", () => {
  test("workspacePromptSection includes both sandbox dirs", async () => {
    const workspace = await createWorkspace({
      name: "test",
      channels: ["general"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    const result = await workspacePromptSection({
      agentName: "alice",
      provider: workspace.contextProvider,
      inboxEntries: [],
      sandboxDir: "/data/agents/alice/sandbox",
      workspaceSandboxDir: "/data/sandbox",
    });

    const text = renderSectionResult(result);
    expect(text).toContain("Directories");
    expect(text).toContain("/data/agents/alice/sandbox");
    expect(text).toContain("/data/sandbox");
    expect(text).toContain("Personal sandbox");
    expect(text).toContain("Shared workspace");
  });

  test("workspacePromptSection shows (not available) when dirs are undefined", async () => {
    const workspace = await createWorkspace({
      name: "test",
      channels: ["general"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    const result = await workspacePromptSection({
      agentName: "alice",
      provider: workspace.contextProvider,
      inboxEntries: [],
    });

    const text = renderSectionResult(result);
    expect(text).toContain("(not available)");
  });

  test("assemblePrompt passes sandbox dirs through to sections", async () => {
    const workspace = await createWorkspace({
      name: "test",
      channels: ["general"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    const result = await assemblePrompt(WORKSPACE_PROMPT_SECTIONS, {
      agentName: "alice",
      provider: workspace.contextProvider,
      inboxEntries: [],
      currentInstruction: "do something",
      sandboxDir: "/home/alice/sandbox",
      workspaceSandboxDir: "/shared/workspace",
    });

    expect(result).toContain("/home/alice/sandbox");
    expect(result).toContain("/shared/workspace");
  });
});
