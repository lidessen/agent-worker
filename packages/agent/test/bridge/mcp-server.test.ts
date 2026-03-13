import { test, expect, describe, afterEach } from "bun:test";
import { AgentMcpServer } from "../../src/bridge/mcp-server.ts";
import { Inbox } from "../../src/inbox.ts";
import { TodoManager } from "../../src/todo.ts";
import { InMemoryNotesStorage } from "../../src/notes.ts";
import { SendGuard } from "../../src/send.ts";
import { ReminderManager } from "../../src/reminder.ts";

function createDeps() {
  const inbox = new Inbox({}, () => {});
  const todos = new TodoManager();
  const notes = new InMemoryNotesStorage();
  const sendGuard = new SendGuard(inbox, () => {});
  const reminders = new ReminderManager();

  return { inbox, todos, notes, memory: null, sendGuard, reminders };
}

describe("AgentMcpServer", () => {
  let server: AgentMcpServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  test("constructs without error", () => {
    server = new AgentMcpServer(createDeps());
    expect(server).toBeDefined();
  });

  test("startHttp starts HTTP server and writes config", async () => {
    server = new AgentMcpServer(createDeps());
    const configPath = await server.startHttp();

    // Config file exists and has correct structure
    const config = await Bun.file(configPath).json();
    expect(config.mcpServers["agent-worker"]).toBeDefined();
    expect(config.mcpServers["agent-worker"].type).toBe("http");
    expect(config.mcpServers["agent-worker"].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);

    // Port is set
    expect(server.port).toBeGreaterThan(0);
  });

  test("HTTP server responds to requests", async () => {
    server = new AgentMcpServer(createDeps());
    await server.startHttp();

    // The MCP HTTP server should be listening
    const url = `http://127.0.0.1:${server.port}/`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.1" },
        },
      }),
    });

    expect(res.ok).toBe(true);
  });

  test("stop cleans up config file and HTTP server", async () => {
    const { existsSync } = await import("node:fs");
    server = new AgentMcpServer(createDeps());
    const configPath = await server.startHttp();

    expect(existsSync(configPath)).toBe(true);
    expect(server.port).toBeGreaterThan(0);

    await server.stop();
    expect(existsSync(configPath)).toBe(false);
    expect(server.port).toBeNull();
    server = null; // already stopped
  });
});
