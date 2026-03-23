import { test, expect, describe } from "bun:test";
import { assemblePrompt } from "../src/loop/prompt.ts";
import {
  workspacePromptSection,
  WORKSPACE_PROMPT_SECTIONS,
} from "../src/context/mcp/prompts.ts";
import { createWorkspace } from "../src/factory.ts";
import { MemoryStorage } from "../src/context/storage.ts";

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

    expect(result).toContain("### Directories");
    expect(result).toContain("/data/agents/alice/sandbox");
    expect(result).toContain("/data/sandbox");
    expect(result).toContain("Personal sandbox");
    expect(result).toContain("Shared workspace");
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

    expect(result).toContain("(not available)");
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
