import { test, expect, describe } from "bun:test";
import {
  parseWorkspaceDef,
  resolveModel,
  interpolate,
  runSetupSteps,
  loadWorkspaceDef,
  toWorkspaceConfig,
} from "../src/config/index.ts";
import { MemoryStorage, FileStorage } from "../src/context/storage.ts";

// ── interpolate ───────────────────────────────────────────────────────────

describe("interpolate", () => {
  test("replaces simple variables", () => {
    expect(interpolate("hello ${{ name }}", { name: "world" })).toBe("hello world");
  });

  test("replaces dotted variables", () => {
    expect(interpolate("tag=${{ workspace.tag }}", { "workspace.tag": "pr-123" })).toBe(
      "tag=pr-123",
    );
  });

  test("preserves unresolved templates", () => {
    expect(interpolate("${{ missing }}", {})).toBe("${{ missing }}");
  });

  test("handles multiple replacements", () => {
    expect(interpolate("${{ a }} and ${{ b }}", { a: "foo", b: "bar" })).toBe("foo and bar");
  });

  test("handles no templates", () => {
    expect(interpolate("no templates here", { x: "y" })).toBe("no templates here");
  });

  test("handles whitespace variations in template syntax", () => {
    expect(interpolate("${{name}}", { name: "tight" })).toBe("tight");
    expect(interpolate("${{  name  }}", { name: "loose" })).toBe("loose");
  });
});

// ── resolveModel ──────────────────────────────────────────────────────────

describe("resolveModel", () => {
  test("simple string model", () => {
    const m = resolveModel("claude-sonnet-4-5");
    expect(m.id).toBe("claude-sonnet-4-5");
    expect(m.provider).toBeUndefined();
    expect(m.full).toBe("claude-sonnet-4-5");
  });

  test("provider:model string shorthand", () => {
    const m = resolveModel("anthropic:claude-sonnet-4-5");
    expect(m.id).toBe("claude-sonnet-4-5");
    expect(m.provider).toBe("anthropic");
    expect(m.full).toBe("anthropic:claude-sonnet-4-5");
  });

  test("openai provider:model", () => {
    const m = resolveModel("openai:gpt-4o");
    expect(m.id).toBe("gpt-4o");
    expect(m.provider).toBe("openai");
    expect(m.full).toBe("openai:gpt-4o");
  });

  test("object form with id only", () => {
    const m = resolveModel({ id: "claude-sonnet-4-5" });
    expect(m.id).toBe("claude-sonnet-4-5");
    expect(m.provider).toBeUndefined();
    expect(m.full).toBe("claude-sonnet-4-5");
  });

  test("object form with provider", () => {
    const m = resolveModel({ id: "claude-sonnet-4-5", provider: "anthropic" });
    expect(m.id).toBe("claude-sonnet-4-5");
    expect(m.provider).toBe("anthropic");
    expect(m.full).toBe("anthropic:claude-sonnet-4-5");
  });

  test("object form with parameters", () => {
    const m = resolveModel({
      id: "claude-sonnet-4-5",
      provider: "anthropic",
      temperature: 0.7,
      max_tokens: 4096,
    });
    expect(m.id).toBe("claude-sonnet-4-5");
    expect(m.provider).toBe("anthropic");
    expect(m.full).toBe("anthropic:claude-sonnet-4-5");
    expect(m.temperature).toBe(0.7);
    expect(m.max_tokens).toBe(4096);
  });
});

// ── parseWorkspaceDef ─────────────────────────────────────────────────────

describe("parseWorkspaceDef", () => {
  test("parses minimal config", () => {
    const def = parseWorkspaceDef(`
name: test
agents:
  alice:
    model: claude-sonnet-4-5
`);
    expect(def.name).toBe("test");
    expect(def.agents.alice!.model).toBe("claude-sonnet-4-5");
  });

  test("parses full config with all fields", () => {
    const def = parseWorkspaceDef(`
name: code-review
channels:
  - general
  - design
default_channel: general
agents:
  reviewer:
    runtime: claude-code
    model: claude-sonnet-4-5
    instructions: |
      You are a code reviewer.
  coder:
    runtime: ai-sdk
    model:
      id: claude-sonnet-4-5
      provider: anthropic
      temperature: 0.3
    instructions: Fix issues.
    channels:
      - design
storage: memory
setup:
  - shell: echo hello
    as: greeting
kickoff: |
  \${{ greeting }}
  @reviewer please review.
`);
    expect(def.name).toBe("code-review");
    expect(def.channels).toEqual(["general", "design"]);
    expect(def.default_channel).toBe("general");
    expect(Object.keys(def.agents)).toEqual(["reviewer", "coder"]);
    expect(def.agents.reviewer!.runtime).toBe("claude-code");
    expect(def.agents.reviewer!.instructions).toContain("code reviewer");
    expect(def.agents.coder!.runtime).toBe("ai-sdk");
    expect(def.agents.coder!.model).toEqual({
      id: "claude-sonnet-4-5",
      provider: "anthropic",
      temperature: 0.3,
    });
    expect(def.agents.coder!.channels).toEqual(["design"]);
    expect(def.storage).toBe("memory");
    expect(def.setup).toHaveLength(1);
    expect(def.setup![0]!.shell).toBe("echo hello");
    expect(def.setup![0]!.as).toBe("greeting");
    expect(def.kickoff).toBeDefined();
  });

  test("allows omitting name", () => {
    const def = parseWorkspaceDef("agents:\n  a:\n    model: x");
    expect(def.name).toBeUndefined();
  });

  test("throws on missing agents", () => {
    expect(() => parseWorkspaceDef("name: test")).toThrow("'agents' map is required");
  });

  test("throws on non-object input", () => {
    expect(() => parseWorkspaceDef("just a string")).toThrow("expected an object");
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
    expect(vars.name).toBe("world");
    expect(vars.full).toBeDefined();
  });

  test("interpolates templates in commands", async () => {
    const vars = await runSetupSteps([{ shell: "echo ${{ prefix }}-suffix", as: "result" }], {
      prefix: "hello",
    });
    expect(vars.result).toBe("hello-suffix");
  });

  test("throws on command failure", async () => {
    await expect(runSetupSteps([{ shell: "exit 1" }])).rejects.toThrow("Setup step failed");
  });

  test("runs step without as (no capture)", async () => {
    const vars = await runSetupSteps([{ shell: "echo ignored" }]);
    expect(Object.keys(vars)).toEqual([]);
  });
});

// ── loadWorkspaceDef ──────────────────────────────────────────────────────

describe("loadWorkspaceDef", () => {
  test("loads from raw YAML content", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  alice:
    model: claude-sonnet-4-5
kickoff: "@alice say hello"
`,
      { skipSetup: true },
    );

    expect(result.def.name).toBe("test");
    expect(result.kickoff).toBe("@alice say hello");
  });

  test("infers name from opts.name when YAML omits it", async () => {
    const result = await loadWorkspaceDef(
      `
agents:
  a:
    model: x
`,
      { name: "fallback", skipSetup: true },
    );

    expect(result.def.name).toBe("fallback");
  });

  test("throws when no name can be resolved", async () => {
    await expect(
      loadWorkspaceDef(
        `
agents:
  a:
    model: x
`,
        { skipSetup: true },
      ),
    ).rejects.toThrow("Workspace name is required");
  });

  test("resolves agents with string model", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  alice:
    runtime: claude-code
    model: sonnet
`,
      { skipSetup: true },
    );

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]!.name).toBe("alice");
    expect(result.agents[0]!.runtime).toBe("claude-code");
    expect(result.agents[0]!.model?.id).toBe("sonnet");
    expect(result.agents[0]!.model?.full).toBe("sonnet");
  });

  test("resolves agents with provider:model shorthand", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  bob:
    runtime: ai-sdk
    model: anthropic:claude-sonnet-4-5
`,
      { skipSetup: true },
    );

    expect(result.agents[0]!.model?.id).toBe("claude-sonnet-4-5");
    expect(result.agents[0]!.model?.provider).toBe("anthropic");
    expect(result.agents[0]!.model?.full).toBe("anthropic:claude-sonnet-4-5");
  });

  test("resolves agents with object model", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  coder:
    model:
      id: gpt-4o
      provider: openai
      temperature: 0.5
`,
      { skipSetup: true },
    );

    expect(result.agents[0]!.model?.id).toBe("gpt-4o");
    expect(result.agents[0]!.model?.provider).toBe("openai");
    expect(result.agents[0]!.model?.full).toBe("openai:gpt-4o");
    expect(result.agents[0]!.model?.temperature).toBe(0.5);
  });

  test("interpolates workspace.tag in kickoff", async () => {
    const result = await loadWorkspaceDef(
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
    const result = await loadWorkspaceDef(
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
    const result = await loadWorkspaceDef(`
name: test
agents:
  checker:
    model: x
setup:
  - shell: echo "42"
    as: answer
kickoff: "The answer is \${{ answer }}"
`);

    expect(result.vars.answer).toBe("42");
    expect(result.kickoff).toBe("The answer is 42");
  });

  test("passes extra vars through", async () => {
    const result = await loadWorkspaceDef(
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

// ── mounts ────────────────────────────────────────────────────────────

describe("agent mounts", () => {
  test("parses string mounts and normalizes to MountDef[]", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  alice:
    model: x
    mounts:
      - /data/shared
      - /opt/tools
`,
      { skipSetup: true },
    );

    expect(result.agents[0]!.mounts).toEqual([
      { source: "/data/shared", target: "shared" },
      { source: "/opt/tools", target: "tools" },
    ]);
  });

  test("parses object mounts with source, target, and readonly", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  bob:
    model: x
    mounts:
      - source: /data/repo
        target: project
        readonly: true
      - source: /tmp/scratch
`,
      { skipSetup: true },
    );

    expect(result.agents[0]!.mounts).toEqual([
      { source: "/data/repo", target: "project", readonly: true },
      { source: "/tmp/scratch", target: "scratch" },
    ]);
  });

  test("mixed string and object mounts", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  coder:
    model: x
    mounts:
      - /home/user/docs
      - source: /var/data
        target: mydata
`,
      { skipSetup: true },
    );

    expect(result.agents[0]!.mounts).toHaveLength(2);
    expect(result.agents[0]!.mounts![0]).toEqual({ source: "/home/user/docs", target: "docs" });
    expect(result.agents[0]!.mounts![1]).toEqual({ source: "/var/data", target: "mydata" });
  });

  test("agents without mounts have undefined mounts", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  plain:
    model: x
`,
      { skipSetup: true },
    );

    expect(result.agents[0]!.mounts).toBeUndefined();
  });
});

// ── agent role resolution ─────────────────────────────────────────────────

describe("agent role resolution", () => {
  test("defaults to worker when workspace.lead is unset", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
agents:
  alice:
    model: x
  bob:
    model: y
`,
      { skipSetup: true },
    );

    expect(result.agents.find((a) => a.name === "alice")?.role).toBe("worker");
    expect(result.agents.find((a) => a.name === "bob")?.role).toBe("worker");
  });

  test("marks the workspace.lead agent as lead", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
lead: alice
agents:
  alice:
    model: x
  bob:
    model: y
`,
      { skipSetup: true },
    );

    expect(result.agents.find((a) => a.name === "alice")?.role).toBe("lead");
    expect(result.agents.find((a) => a.name === "bob")?.role).toBe("worker");
  });

  test("explicit agent.role overrides the workspace.lead inference", async () => {
    const result = await loadWorkspaceDef(
      `
name: test
lead: alice
agents:
  alice:
    model: x
  bot:
    model: y
    role: observer
`,
      { skipSetup: true },
    );

    expect(result.agents.find((a) => a.name === "alice")?.role).toBe("lead");
    expect(result.agents.find((a) => a.name === "bot")?.role).toBe("observer");
  });
});

// ── toWorkspaceConfig ─────────────────────────────────────────────────────

describe("toWorkspaceConfig", () => {
  test("converts with memory storage", async () => {
    const resolved = await loadWorkspaceDef(
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
storage: memory
`,
      { skipSetup: true },
    );

    const config = toWorkspaceConfig(resolved);
    expect(config.name).toBe("test");
    expect(config.agents).toEqual(["alice", "bob"]);
    expect(config.channels).toEqual(["general", "design"]);
    expect(config.defaultChannel).toBe("general");
    expect(config.storage).toBeInstanceOf(MemoryStorage);
  });

  test("converts with file storage and tag", async () => {
    const resolved = await loadWorkspaceDef(
      `
name: review
agents:
  reviewer:
    model: x
`,
      { tag: "pr-42", skipSetup: true },
    );

    const config = toWorkspaceConfig(resolved, { tag: "pr-42" });
    expect(config.name).toBe("review");
    expect(config.tag).toBe("pr-42");
    expect(config.storage).toBeInstanceOf(FileStorage);
  });

  test("uses data_dir from YAML when specified", async () => {
    const resolved = await loadWorkspaceDef(
      `
name: local-project
agents:
  a:
    model: x
data_dir: /custom/data/path
`,
      { skipSetup: true },
    );

    const config = toWorkspaceConfig(resolved);
    expect(config.storageDir).toBe("/custom/data/path");
    expect(config.storage).toBeInstanceOf(FileStorage);
  });

  test("storageDir option overrides data_dir", async () => {
    const resolved = await loadWorkspaceDef(
      `
name: test
agents:
  a:
    model: x
data_dir: /yaml/path
`,
      { skipSetup: true },
    );

    const config = toWorkspaceConfig(resolved, { storageDir: "/override/path" });
    expect(config.storageDir).toBe("/override/path");
  });
});
