import { test, expect, describe } from "bun:test";
import { loadHarnessDef } from "../src/index.ts";

describe("Harness YAML validation", () => {
  test("loadHarnessDef validates chat.yaml", async () => {
    const yaml = await Bun.file("internals/harness/examples/chat.yaml").text();
    const resolved = await loadHarnessDef(yaml);
    expect(resolved.def.name).toBe("chat");
    expect(resolved.agents.length).toBeGreaterThan(0);
    expect(resolved.agents.some((a) => a.name === "alice")).toBe(true);
    expect(resolved.agents.some((a) => a.name === "bob")).toBe(true);
  });

  test("loadHarnessDef validates review.yaml", async () => {
    const yaml = await Bun.file("internals/harness/examples/review.yaml").text();
    const resolved = await loadHarnessDef(yaml);
    expect(resolved.def.name).toBe("code-review");
    expect(resolved.agents.some((a) => a.name === "reviewer")).toBe(true);
    expect(resolved.agents.some((a) => a.name === "coder")).toBe(true);
  });

  test("loadHarnessDef rejects invalid YAML", async () => {
    let errored = false;
    try {
      await loadHarnessDef("this is not valid harness yaml {{{");
    } catch {
      errored = true;
    }
    expect(errored).toBe(true);
  });
});
