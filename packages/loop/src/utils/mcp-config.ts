import { readFileSync } from "node:fs";

export interface AgentMcpServerConfig {
  type?: string;
  command?: string;
  args?: string[];
  url?: string;
}

export interface AgentMcpConfigFile {
  mcpServers?: Record<string, AgentMcpServerConfig>;
}

export function readAgentMcpConfig(configPath: string): Record<string, AgentMcpServerConfig> {
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as AgentMcpConfigFile;
  return config.mcpServers ?? {};
}

/** Quote a TOML key if it contains characters outside bare-key range (A-Za-z0-9_-). */
function quoteTomlKey(key: string): string {
  if (/^[A-Za-z0-9_-]+$/.test(key)) return key;
  return `"${escapeToml(key)}"`;
}

/** Escape a string for use inside a TOML basic string (double-quoted). */
function escapeToml(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

export function buildCodexMcpOverrides(configPath: string): string[] {
  const servers = readAgentMcpConfig(configPath);
  const flags: string[] = [];

  for (const [name, server] of Object.entries(servers)) {
    const key = quoteTomlKey(name);

    if (server.url || server.type === "http") {
      flags.push("-c", `mcp_servers.${key}.type="http"`);
      flags.push("-c", `mcp_servers.${key}.url="${escapeToml(server.url!)}"`);
    } else if (server.command) {
      flags.push("-c", `mcp_servers.${key}.type="stdio"`);
      flags.push("-c", `mcp_servers.${key}.command="${escapeToml(server.command)}"`);
      if (server.args?.length) {
        const tomlArray = "[" + server.args.map((a) => `"${escapeToml(a)}"`).join(", ") + "]";
        flags.push("-c", `mcp_servers.${key}.args=${tomlArray}`);
      }
    }
  }

  return flags;
}

export function buildClaudeMcpServers(
  configPath: string,
): Record<string, AgentMcpServerConfig> | undefined {
  const servers = readAgentMcpConfig(configPath);
  return Object.keys(servers).length > 0 ? servers : undefined;
}
