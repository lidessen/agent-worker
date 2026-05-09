/**
 * MCP config generator for config-file MCP agents.
 *
 * Config-file MCP runtimes use the same stdio subprocess path.
 * We previously routed codex/cursor through
 * the `StreamableHTTPServerTransport` on the WorkspaceMcpHub, but
 * codex's app-server deadlocks mid-tool-call on that transport:
 * the tool runs, the workspace side-effect happens, but codex
 * never emits `item/completed` for the call because the SSE-
 * based HTTP transport never returns a terminal response it
 * recognises. Config-file clients therefore use the stdio proxy.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveScriptEntrypointCommand } from "@agent-worker/shared";
import type { McpServerDef } from "../../config/types.ts";

/**
 * Create an MCP config file for a runtime that needs one.
 *
 * The workspace MCP server uses the stdio path (prefers bun, falls
 * back to node+tsx). `httpUrl` is accepted for backward compatibility
 * but ignored.
 */
export async function createWorkspaceMcpConfig(
  agentName: string,
  runtime: string,
  opts: {
    /** @deprecated HTTP MCP transport is no longer used — ignored. */
    httpUrl?: string;
    /** Daemon URL for the stdio proxy. */
    daemonUrl?: string;
    /** Daemon auth token. */
    daemonToken?: string;
    /** Workspace key. */
    workspaceKey?: string;
    /** Additional external MCP servers to merge into the config. */
    extraServers?: Record<string, McpServerDef>;
  },
): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
  // `runtime` is accepted for future per-runtime tweaks but
  // currently all CLI runtimes take the same stdio path.
  void runtime;
  const { writeFile, unlink } = await import("node:fs/promises");
  const configPath = `/tmp/workspace-mcp-${agentName}-${Date.now()}.json`;

  // Single stdio subprocess path for every CLI runtime.
  const entryPath = join(dirname(fileURLToPath(import.meta.url)), "stdio-entry.ts");
  const scriptCommand = resolveScriptEntrypointCommand(entryPath, [
    opts.daemonUrl ?? "",
    opts.daemonToken ?? "",
    opts.workspaceKey ?? "global",
    agentName,
  ]);
  const config: Record<string, unknown> = {
    mcpServers: {
      ...opts.extraServers,
      workspace: {
        command: scriptCommand.command,
        args: scriptCommand.args,
      },
    },
  };

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
