/**
 * MCP config generator for CLI agents.
 *
 * Generates config files for each CLI agent type:
 * - claude-code: stdio subprocess (--mcp-config doesn't load HTTP in -p mode)
 * - codex/cursor: HTTP URL (points to WorkspaceMcpHub's /mcp/:agentName endpoint)
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveScriptEntrypointCommand } from "@agent-worker/shared";

/**
 * Create an MCP config file for a CLI agent.
 *
 * - claude-code: stdio config (prefers bun, falls back to node+tsx)
 * - codex/cursor: HTTP config (points to WorkspaceMcpHub)
 */
export async function createWorkspaceMcpConfig(
  agentName: string,
  runtime: string,
  opts: {
    /** For HTTP mode (codex/cursor): URL of the WorkspaceMcpHub agent endpoint */
    httpUrl?: string;
    /** For stdio mode (claude-code): daemon URL for the stdio proxy */
    daemonUrl?: string;
    /** For stdio mode: daemon auth token */
    daemonToken?: string;
    /** Workspace key */
    workspaceKey?: string;
  },
): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
  const { writeFile, unlink } = await import("node:fs/promises");
  const configPath = `/tmp/workspace-mcp-${agentName}-${Date.now()}.json`;

  let config: Record<string, unknown>;

  if (runtime === "claude-code") {
    // Claude Code: stdio subprocess (--mcp-config doesn't load HTTP in -p mode)
    const entryPath = join(dirname(fileURLToPath(import.meta.url)), "stdio-entry.ts");
    const scriptCommand = resolveScriptEntrypointCommand(entryPath, [
      opts.daemonUrl ?? "",
      opts.daemonToken ?? "",
      opts.workspaceKey ?? "global",
      agentName,
    ]);
    config = {
      mcpServers: {
        workspace: {
          command: scriptCommand.command,
          args: scriptCommand.args,
        },
      },
    };
  } else {
    // Codex/Cursor: HTTP URL
    config = {
      mcpServers: {
        workspace: { type: "http", url: opts.httpUrl ?? "" },
      },
    };
  }

  await writeFile(configPath, JSON.stringify(config), "utf-8");

  return {
    configPath,
    async cleanup() {
      try {
        await unlink(configPath);
      } catch {
        /* already removed */
      }
    },
  };
}
