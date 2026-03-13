import { test, expect, describe } from "bun:test";
import { AgentMcpServer } from "../../src/bridge/mcp-server.ts";
import { Inbox } from "../../src/inbox.ts";
import { TodoManager } from "../../src/todo.ts";
import { InMemoryNotesStorage } from "../../src/notes.ts";
import { SendGuard } from "../../src/send.ts";
import { ReminderManager } from "../../src/reminder.ts";
import type { BridgeTransport } from "../../src/bridge/tool-bridge.ts";

function createDeps() {
  const inbox = new Inbox({}, () => {});
  const todos = new TodoManager();
  const notes = new InMemoryNotesStorage();
  const sendGuard = new SendGuard(inbox, () => {});
  const reminders = new ReminderManager();

  return { inbox, todos, notes, memory: null, sendGuard, reminders };
}

const DUMMY_UNIX: BridgeTransport = { type: "unix", socketPath: "/tmp/test-bridge.sock" };
const DUMMY_TCP: BridgeTransport = { type: "tcp", host: "127.0.0.1", port: 12345 };

describe("AgentMcpServer", () => {
  test("constructs without error", () => {
    const server = new AgentMcpServer(createDeps());
    expect(server).toBeDefined();
  });

  test("startAndWriteConfig creates proxy entry script and config (unix)", async () => {
    const server = new AgentMcpServer(createDeps());
    const configPath = await server.startAndWriteConfig(DUMMY_UNIX, false);

    const configFile = Bun.file(configPath);
    expect(await configFile.exists()).toBe(true);

    const config = await configFile.json();
    expect(config.mcpServers["agent-worker"]).toBeDefined();
    expect(config.mcpServers["agent-worker"].command).toBe("npx");
    expect(config.mcpServers["agent-worker"].args).toHaveLength(2);

    const entryPath = config.mcpServers["agent-worker"].args[1];
    const content = await Bun.file(entryPath).text();

    // All 4 core tools present (no memory when hasMemory=false)
    expect(content).toContain("agent_inbox");
    expect(content).toContain("agent_send");
    expect(content).toContain("agent_todo");
    expect(content).toContain("agent_notes");
    expect(content).not.toContain("agent_memory");

    // Uses Unix socket bridge proxy
    expect(content).toContain("callBridge");
    expect(content).toContain("BRIDGE_SOCKET");
    expect(content).toContain(DUMMY_UNIX.socketPath);
    expect(content).toContain("socketPath");
    expect(content).not.toContain("const todos:");
    expect(content).not.toContain("new Map");

    await server.stop();
  });

  test("startAndWriteConfig creates TCP proxy entry script", async () => {
    const server = new AgentMcpServer(createDeps());
    const configPath = await server.startAndWriteConfig(DUMMY_TCP, false);

    const config = await Bun.file(configPath).json();
    const entryPath = config.mcpServers["agent-worker"].args[1];
    const content = await Bun.file(entryPath).text();

    expect(content).toContain("callBridge");
    expect(content).toContain("BRIDGE_URL");
    expect(content).toContain(`${DUMMY_TCP.host}:${DUMMY_TCP.port}`);
    expect(content).not.toContain("BRIDGE_SOCKET");

    await server.stop();
  });

  test("includes memory tool when hasMemory is true", async () => {
    const server = new AgentMcpServer(createDeps());
    const configPath = await server.startAndWriteConfig(DUMMY_UNIX, true);

    const config = await Bun.file(configPath).json();
    const entryPath = config.mcpServers["agent-worker"].args[1];
    const content = await Bun.file(entryPath).text();

    expect(content).toContain("agent_memory");

    await server.stop();
  });

  test("includeBuiltins=false generates minimal script with no tools", async () => {
    const server = new AgentMcpServer(createDeps());
    const configPath = await server.startAndWriteConfig(DUMMY_UNIX, false, false);

    const config = await Bun.file(configPath).json();
    const entryPath = config.mcpServers["agent-worker"].args[1];
    const content = await Bun.file(entryPath).text();

    // Minimal script: MCP server with no tools
    expect(content).toContain("McpServer");
    expect(content).toContain("StdioServerTransport");
    expect(content).not.toContain("agent_inbox");
    expect(content).not.toContain("agent_send");
    expect(content).not.toContain("agent_todo");
    expect(content).not.toContain("agent_notes");
    expect(content).not.toContain("callBridge");

    await server.stop();
  });

  test("stop cleans up temp files", async () => {
    const { existsSync } = await import("node:fs");
    const server = new AgentMcpServer(createDeps());
    const configPath = await server.startAndWriteConfig(DUMMY_UNIX, false);

    expect(existsSync(configPath)).toBe(true);

    await server.stop();
    expect(existsSync(configPath)).toBe(false);
  });

  test("entry script is syntactically valid (with builtins)", async () => {
    const server = new AgentMcpServer(createDeps());
    const configPath = await server.startAndWriteConfig(DUMMY_UNIX, true);

    const config = await Bun.file(configPath).json();
    const entryPath = config.mcpServers["agent-worker"].args[1];

    const content = await Bun.file(entryPath).text();
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    const result = transpiler.transformSync(content);
    expect(result.length).toBeGreaterThan(0);

    await server.stop();
  });

  test("entry script is syntactically valid (without builtins)", async () => {
    const server = new AgentMcpServer(createDeps());
    const configPath = await server.startAndWriteConfig(DUMMY_UNIX, false, false);

    const config = await Bun.file(configPath).json();
    const entryPath = config.mcpServers["agent-worker"].args[1];

    const content = await Bun.file(entryPath).text();
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    const result = transpiler.transformSync(content);
    expect(result.length).toBeGreaterThan(0);

    await server.stop();
  });
});
