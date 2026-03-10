import { test, expect, describe } from "bun:test";
import {
  parseWorkspaceYaml,
  interpolate,
  runSetupSteps,
  loadWorkspaceYaml,
  toWorkspaceConfig,
} from "../src/config/index.ts";
import { MemoryStorage, FileStorage } from "../src/context/storage.ts";

// ── interpolate ───────────────────────────────────────────────────────────

describe("interpolate", () => {
  test("replaces simple variables", () => {
    expect(interpolate("hello ${{ name }}", { name: "world" })).toBe(
      "hello world",
    );
  });

  test("replaces dotted variables", () => {
    expect(
      interpolate("tag=${{ workspace.tag }}", { "workspace.tag": "pr-123" }),
    ).toBe("tag=pr-123");
  });

  test("preserves unresolved templates", () => {
    expect(interpolate("${{ missing }}", {})).toBe("${{ missing }}");
  });

  test("handles multiple replacements", () => {
    expect(
      interpolate("${{ a }} and ${{ b }}", { a: "foo", b: "bar" }),
    ).toBe("foo and bar");
  });

  test("handles no templates", () => {
    expect(interpolate("no templates here", { x: "y" })).toBe(
      "no templates here",
    );
  });

  test("handles whitespace variations in template syntax", () => {
    expect(interpolate("${{name}}", { name: "tight" })).toBe("tight");
    expect(interpolate("${{  name  }}", { name: "loose" })).toBe("loose");
  });
});

// ── parseWorkspaceYaml ────────────────────────────────────────────────────

describe("parseWorkspaceYaml", () => {
  test("parses minimal config", () => {
    const yaml = parseWorkspaceYaml(`
name: test
agents:
  alice:
    model: claude-sonnet-4-5
`);
    expect(yaml.name).toBe("test");
    expect(yaml.agents.alice.model).toBe("claude-sonnet-4-5");
  });

  test("parses full config with all fields", () => {
    const yaml = parseWorkspaceYaml(`
name: code-review
channels:
  - general
  - design
default_channel: general
agents:
  reviewer:
    backend: claude
    model: claude-sonnet-4-5
    system_prompt: |
      You are a code reviewer.
  coder:
    model: claude-sonnet-4-5
    system_prompt: Fix issues.
    channels:
      - design
context:
  provider: memory
setup:
  - shell: echo hello
    as: greeting
kickoff: |
  \${{ greeting }}
  @reviewer please review.
queue:
  immediate_quota: 3
smart_send_threshold: 2000
`);
    expect(yaml.name).toBe("code-review");
    expect(yaml.channels).toEqual(["general", "design"]);
    expect(yaml.default_channel).toBe("general");
    expect(Object.keys(yaml.agents)).toEqual(["reviewer", "coder"]);
    expect(yaml.agents.reviewer.backend).toBe("claude");
    expect(yaml.agents.reviewer.system_prompt).toContain("code reviewer");
    expect(yaml.agents.coder.channels).toEqual(["design"]);
    expect(yaml.context?.provider).toBe("memory");
    expect(yaml.setup).toHaveLength(1);
    expect(yaml.setup![0].shell).toBe("echo hello");
    expect(yaml.setup![0].as).toBe("greeting");
    expect(yaml.kickoff).toBeDefined();
    expect(yaml.queue?.immediate_quota).toBe(3);
    expect(yaml.smart_send_threshold).toBe(2000);
  });

  test("throws on missing name", () => {
    expect(() => parseWorkspaceYaml("agents:\n  a:\n    model: x")).toThrow(
      "'name' is required",
    );
  });

  test("throws on missing agents", () => {
    expect(() => parseWorkspaceYaml("name: test")).toThrow(
      "'agents' map is required",
    );
  });

  test("throws on non-object input", () => {
    expect(() => parseWorkspaceYaml("just a string")).toThrow(
      "expected an object",
    );
  });
});

// ── runSetupSteps ─────────────────────────────────────────────────────────

describe("runSetupSteps", () => {
  test("captures stdout into variable", async () => {
    const vars = await runSetupSteps([{ shell: "echo hello", as: "greeting" }]);
    expect(vars.greeting).toBe("hello");
  });

  test("chains variables across steps", async () => {
    const vars = await runSetupSteps([
      { shell: "echo world", as: "name" },
      { shell: 'echo "hello $name"', as: "full" },
    ]);
    // Note: shell variable $name won't resolve, but template ${{ name }} would
    // This tests that multiple steps run sequentially
    expect(vars.name).toBe("world");
    expect(vars.full).toBeDefined();
  });

  test("interpolates templates in commands", async () => {
    const vars = await runSetupSteps(
      [{ shell: "echo ${{ prefix }}-suffix", as: "result" }],
      { prefix: "hello" },
    );
    expect(vars.result).toBe("hello-suffix");
  });

  test("throws on command failure", async () => {
    await expect(
      runSetupSteps([{ shell: "exit 1" }]),
    ).rejects.toThrow("Setup step failed");
  });

  test("runs step without as (no capture)", async () => {
    const vars = await runSetupSteps([{ shell: "echo ignored" }]);
    expect(Object.keys(vars)).toEqual([]);
  });
});

// ── loadWorkspaceYaml ─────────────────────────────────────────────────────

describe("loadWorkspaceYaml", () => {
  test("loads from raw YAML content", async () => {
    const result = await loadWorkspaceYaml(
      `
name: test
agents:
  alice:
    model: claude-sonnet-4-5
kickoff: "@alice say hello"
`,
      { skipSetup: true },
    );

    expect(result.yaml.name).toBe("test");
    expect(result.kickoff).toBe("@alice say hello");
  });

  test("interpolates workspace.tag in kickoff", async () => {
    const result = await loadWorkspaceYaml(
      `
name: review
agents:
  reviewer:
    model: claude-sonnet-4-5
kickoff: "Review PR \${{ workspace.tag }}"
`,
      { tag: "pr-123", skipSetup: true },
    );

    expect(result.kickoff).toBe("Review PR pr-123");
  });

  test("interpolates workspace.name in kickoff", async () => {
    const result = await loadWorkspaceYaml(
      `
name: my-workspace
agents:
  a:
    model: x
kickoff: "Running \${{ workspace.name }}"
`,
      { skipSetup: true },
    );

    expect(result.kickoff).toBe("Running my-workspace");
  });

  test("runs setup and interpolates vars in kickoff", async () => {
    const result = await loadWorkspaceYaml(`
name: test
agents:
  checker:
    model: x
setup:
  - shell: echo "42"
    as: answer
kickoff: "The answer is \${{ answer }}"
`);

    expect(result.setupVars.answer).toBe("42");
    expect(result.kickoff).toBe("The answer is 42");
  });

  test("passes extra vars through", async () => {
    const result = await loadWorkspaceYaml(
      `
name: test
agents:
  a:
    model: x
kickoff: "env=\${{ env }}"
`,
      { vars: { env: "production" }, skipSetup: true },
    );

    expect(result.kickoff).toBe("env=production");
  });
});

// ── toWorkspaceConfig ─────────────────────────────────────────────────────

describe("toWorkspaceConfig", () => {
  test("converts to WorkspaceConfig with memory storage", async () => {
    const loaded = await loadWorkspaceYaml(
      `
name: test
agents:
  alice:
    model: x
  bob:
    model: y
channels:
  - general
  - design
default_channel: general
context:
  provider: memory
`,
      { skipSetup: true },
    );

    const config = toWorkspaceConfig(loaded);
    expect(config.name).toBe("test");
    expect(config.agents).toEqual(["alice", "bob"]);
    expect(config.channels).toEqual(["general", "design"]);
    expect(config.defaultChannel).toBe("general");
    expect(config.storage).toBeInstanceOf(MemoryStorage);
  });

  test("converts with file storage and tag", async () => {
    const loaded = await loadWorkspaceYaml(
      `
name: review
agents:
  reviewer:
    model: x
`,
      { tag: "pr-42", skipSetup: true },
    );

    const config = toWorkspaceConfig(loaded, { tag: "pr-42" });
    expect(config.name).toBe("review");
    expect(config.tag).toBe("pr-42");
    expect(config.storage).toBeInstanceOf(FileStorage);
  });

  test("converts queue config from snake_case to camelCase", async () => {
    const loaded = await loadWorkspaceYaml(
      `
name: test
agents:
  a:
    model: x
queue:
  immediate_quota: 3
  normal_quota: 6
  max_background_wait: 10000
  max_preemptions: 5
`,
      { skipSetup: true },
    );

    const config = toWorkspaceConfig(loaded);
    expect(config.queueConfig).toEqual({
      immediateQuota: 3,
      normalQuota: 6,
      maxBackgroundWait: 10000,
      maxPreemptions: 5,
    });
  });

  test("passes smartSendThreshold", async () => {
    const loaded = await loadWorkspaceYaml(
      `
name: test
agents:
  a:
    model: x
smart_send_threshold: 2000
`,
      { skipSetup: true },
    );

    const config = toWorkspaceConfig(loaded);
    expect(config.smartSendThreshold).toBe(2000);
  });
});
