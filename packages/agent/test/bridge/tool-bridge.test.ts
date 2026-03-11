import { test, expect, describe, afterEach } from "bun:test";
import { ToolBridge, type BridgeTransport } from "../../src/bridge/tool-bridge.ts";
import { Inbox } from "../../src/inbox.ts";
import { TodoManager } from "../../src/todo.ts";
import { InMemoryNotesStorage } from "../../src/notes.ts";
import { SendGuard } from "../../src/send.ts";
import { ReminderManager } from "../../src/reminder.ts";

function createBridge() {
  const inbox = new Inbox({}, () => {});
  const todos = new TodoManager();
  const notes = new InMemoryNotesStorage();
  const sendGuard = new SendGuard(inbox, () => {});
  const reminders = new ReminderManager();

  return new ToolBridge({ inbox, todos, notes, memory: null, sendGuard, reminders });
}

async function call(transport: BridgeTransport, tool: string, args: Record<string, unknown>) {
  const url =
    transport.type === "unix"
      ? `http://localhost/${tool}`
      : `http://${transport.host}:${transport.port}/${tool}`;
  const fetchOpts: any = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  };
  if (transport.type === "unix") {
    fetchOpts.unix = transport.socketPath;
  }
  const res = await fetch(url, fetchOpts);
  return res.json() as Promise<{ result?: string; error?: string }>;
}

async function rawFetch(transport: BridgeTransport, path: string, opts: RequestInit = {}) {
  const url =
    transport.type === "unix"
      ? `http://localhost${path}`
      : `http://${transport.host}:${transport.port}${path}`;
  const fetchOpts: any = { ...opts };
  if (transport.type === "unix") {
    fetchOpts.unix = transport.socketPath;
  }
  return fetch(url, fetchOpts);
}

describe("ToolBridge", () => {
  let bridge: ToolBridge;

  afterEach(async () => {
    await bridge?.stop();
  });

  test("starts and returns a transport", async () => {
    bridge = createBridge();
    const transport = await bridge.start();
    expect(transport).toBeDefined();
    expect(transport.type).toMatch(/^(unix|tcp)$/);
    expect(bridge.transport).toBe(transport);
  });

  test("agent_todo add and list through bridge", async () => {
    bridge = createBridge();
    const transport = await bridge.start();

    const addResult = await call(transport, "agent_todo", { action: "add", text: "test todo" });
    expect(addResult.result).toContain("test todo");

    const listResult = await call(transport, "agent_todo", { action: "list" });
    const todos = JSON.parse(listResult.result!);
    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe("test todo");
  });

  test("agent_notes write and read through bridge", async () => {
    bridge = createBridge();
    const transport = await bridge.start();

    await call(transport, "agent_notes", { action: "write", key: "k1", content: "value1" });

    const readResult = await call(transport, "agent_notes", { action: "read", key: "k1" });
    expect(readResult.result).toBe("value1");
  });

  test("agent_inbox peek through bridge", async () => {
    bridge = createBridge();
    const transport = await bridge.start();

    const result = await call(transport, "agent_inbox", { action: "peek" });
    expect(result.result).toBeDefined();
  });

  test("agent_send through bridge", async () => {
    bridge = createBridge();
    const transport = await bridge.start();

    const result = await call(transport, "agent_send", { target: "user", content: "hello" });
    expect(result.result).toBeDefined();
  });

  test("unknown tool returns 404", async () => {
    bridge = createBridge();
    const transport = await bridge.start();

    const res = await rawFetch(transport, "/unknown_tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  test("stop shuts down the server", async () => {
    bridge = createBridge();
    const transport = await bridge.start();

    if (transport.type === "unix") {
      const { existsSync } = await import("node:fs");
      expect(existsSync(transport.socketPath)).toBe(true);
      await bridge.stop();
      expect(existsSync(transport.socketPath)).toBe(false);
    } else {
      await bridge.stop();
    }
    expect(bridge.transport).toBeNull();
  });

  test("multiple bridges can run concurrently", async () => {
    const bridge1 = createBridge();
    const bridge2 = createBridge();

    const t1 = await bridge1.start();
    const t2 = await bridge2.start();

    // Transports should be distinct
    if (t1.type === "unix" && t2.type === "unix") {
      expect(t1.socketPath).not.toBe(t2.socketPath);
    } else if (t1.type === "tcp" && t2.type === "tcp") {
      expect(t1.port).not.toBe(t2.port);
    }

    // Both work independently
    await call(t1, "agent_todo", { action: "add", text: "from bridge 1" });
    await call(t2, "agent_todo", { action: "add", text: "from bridge 2" });

    const list1 = JSON.parse((await call(t1, "agent_todo", { action: "list" })).result!);
    const list2 = JSON.parse((await call(t2, "agent_todo", { action: "list" })).result!);

    expect(list1).toHaveLength(1);
    expect(list1[0].text).toBe("from bridge 1");
    expect(list2).toHaveLength(1);
    expect(list2[0].text).toBe("from bridge 2");

    await bridge1.stop();
    await bridge2.stop();
  });
});
