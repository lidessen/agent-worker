import { test, expect, describe } from "bun:test";
import { loadWorkspaceDef } from "../src/index.ts";

describe("Workspace YAML validation", () => {
  test("loadWorkspaceDef validates chat.yaml", async () => {
    const yaml = await Bun.file("packages/workspace/examples/chat.yaml").text();
    const resolved = await loadWorkspaceDef(yaml);
    expect(resolved.def.name).toBe("chat");
    expect(resolved.agents.length).toBeGreaterThan(0);
    expect(resolved.agents.some((a) => a.name === "alice")).toBe(true);
    expect(resolved.agents.some((a) => a.name === "bob")).toBe(true);
  });

  test("loadWorkspaceDef validates review.yaml", async () => {
    const yaml = await Bun.file("packages/workspace/examples/review.yaml").text();
    const resolved = await loadWorkspaceDef(yaml);
    expect(resolved.def.name).toBe("code-review");
    expect(resolved.agents.some((a) => a.name === "reviewer")).toBe(true);
    expect(resolved.agents.some((a) => a.name === "coder")).toBe(true);
  });

  test("loadWorkspaceDef rejects invalid YAML", async () => {
    let errored = false;
    try {
      await loadWorkspaceDef("this is not valid workspace yaml {{{");
    } catch {
      errored = true;
    }
    expect(errored).toBe(true);
  });
});
