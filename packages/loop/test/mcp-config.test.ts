import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildClaudeMcpServers, buildCodexMcpOverrides } from "../src/utils/mcp-config.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

async function writeConfig(config: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aw-mcp-config-"));
  tempDirs.push(dir);
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify(config), "utf-8");
  return path;
}

describe("MCP config helpers", () => {
  test("buildClaudeMcpServers preserves remote headers", async () => {
    const configPath = await writeConfig({
      mcpServers: {
        sentry: {
          type: "http",
          url: "https://mcp.sentry.dev/mcp",
          headers: { "X-Test": "1" },
        },
      },
    });

    expect(buildClaudeMcpServers(configPath)).toEqual({
      sentry: {
        type: "http",
        url: "https://mcp.sentry.dev/mcp",
        headers: { "X-Test": "1" },
      },
    });
  });

  test("rejects MCP OAuth metadata", async () => {
    const configPath = await writeConfig({
      mcpServers: {
        figma: {
          type: "http",
          url: "https://mcp.figma.com/mcp",
          oauth: { clientId: "client-123" },
        },
      },
    });

    expect(() => buildClaudeMcpServers(configPath)).toThrow("Remote MCP OAuth is not supported");
    expect(() => buildCodexMcpOverrides(configPath)).toThrow(
      'Remote MCP OAuth is not supported for server "figma"',
    );
  });

  test("buildCodexMcpOverrides serializes bearer token env var and stdio env", async () => {
    const configPath = await writeConfig({
      mcpServers: {
        remote: {
          type: "http",
          url: "https://example.com/mcp",
          bearerTokenEnvVar: "EXAMPLE_TOKEN",
        },
        local: {
          command: "bun",
          args: ["run", "server.ts"],
          env: {
            FOO: "bar",
          },
        },
      },
    });

    const overrides = buildCodexMcpOverrides(configPath);

    expect(overrides).toContain("-c");
    expect(overrides).toEqual(
      expect.arrayContaining([
        'mcp_servers.remote.type="http"',
        'mcp_servers.remote.url="https://example.com/mcp"',
        'mcp_servers.remote.bearer_token_env_var="EXAMPLE_TOKEN"',
        'mcp_servers.local.type="stdio"',
        'mcp_servers.local.command="bun"',
        'mcp_servers.local.args=["run", "server.ts"]',
        'mcp_servers.local.env={FOO="bar"}',
      ]),
    );
  });

  test("buildCodexMcpOverrides rejects SSE servers", async () => {
    const configPath = await writeConfig({
      mcpServers: {
        legacy: {
          type: "sse",
          url: "https://example.com/sse",
        },
      },
    });

    expect(() => buildCodexMcpOverrides(configPath)).toThrow("does not support SSE transport");
  });
});
