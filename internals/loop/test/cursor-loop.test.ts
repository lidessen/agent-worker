import { afterEach, describe, expect, mock, test } from "bun:test";
import type { SDKMessage } from "@cursor/sdk";
import type { LoopEvent } from "../src/types.ts";

async function importCursorLoop() {
  return import(`../src/loops/cursor.ts?test=${Date.now()}-${Math.random()}`);
}

function streamMessages(messages: SDKMessage[]) {
  return async function* () {
    for (const message of messages) yield message;
  };
}

describe("CursorLoop", () => {
  afterEach(() => {
    mock.restore();
  });

  test("maps SDK assistant, thinking, and tool messages", async () => {
    const { mapCursorMessage } = await importCursorLoop();

    expect(
      mapCursorMessage({
        type: "assistant",
        agent_id: "agent_1",
        run_id: "run_1",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "hello" },
            {
              type: "tool_use",
              id: "call_1",
              name: "workspace.channel_read",
              input: { channel: "dev" },
            },
          ],
        },
      }),
    ).toEqual([
      { type: "text", text: "hello" },
      {
        type: "tool_call_start",
        name: "workspace.channel_read",
        callId: "call_1",
        args: { channel: "dev" },
      },
    ]);

    expect(
      mapCursorMessage({
        type: "thinking",
        agent_id: "agent_1",
        run_id: "run_1",
        text: "considering",
      }),
    ).toEqual([{ type: "thinking", text: "considering" }]);

    expect(
      mapCursorMessage({
        type: "tool_call",
        agent_id: "agent_1",
        run_id: "run_1",
        call_id: "call_1",
        name: "workspace.channel_read",
        status: "completed",
        result: "ok",
      }),
    ).toEqual([
      {
        type: "tool_call_end",
        name: "workspace.channel_read",
        callId: "call_1",
        result: "ok",
        error: undefined,
      },
    ]);
  });

  test("builds Cursor SDK options with local cwd array and MCP servers", async () => {
    const { buildCursorAgentOptions } = await importCursorLoop();

    const opts = buildCursorAgentOptions(
      {
        model: "composer-2",
        cwd: "/repo",
        allowedPaths: ["/shared"],
        apiKey: "key_123",
        settingSources: ["project"],
      },
      {
        workspace: {
          command: "bun",
          args: ["run", "mcp.ts"],
          env: { DAEMON_URL: "http://127.0.0.1:7420" },
        },
        sentry: {
          type: "http",
          url: "https://mcp.sentry.dev/mcp",
          headers: { "x-test": "1" },
        },
      },
    );

    expect(opts).toEqual({
      apiKey: "key_123",
      model: { id: "composer-2" },
      local: {
        cwd: ["/repo", "/shared"],
        settingSources: ["project"],
      },
      mcpServers: {
        workspace: {
          type: "stdio",
          command: "bun",
          args: ["run", "mcp.ts"],
          env: { DAEMON_URL: "http://127.0.0.1:7420" },
        },
        sentry: {
          type: "http",
          url: "https://mcp.sentry.dev/mcp",
          headers: { "x-test": "1" },
        },
      },
    });
  });

  test("streams SDK messages through the LoopRun contract", async () => {
    const send = mock(async () => ({
      id: "run_1",
      agentId: "agent_1",
      status: "finished",
      supports: () => true,
      unsupportedReason: () => undefined,
      stream: streamMessages([
        {
          type: "assistant",
          agent_id: "agent_1",
          run_id: "run_1",
          message: { role: "assistant", content: [{ type: "text", text: "done" }] },
        },
      ]),
      wait: async () => ({ id: "run_1", status: "finished" }),
      cancel: mock(async () => {}),
      conversation: async () => [],
      onDidChangeStatus: () => () => {},
    }));
    const close = mock(() => {});
    const create = mock(async () => ({
      agentId: "agent_1",
      model: { id: "composer-2" },
      send,
      close,
      reload: async () => {},
      [Symbol.asyncDispose]: async () => {},
      listArtifacts: async () => [],
      downloadArtifact: async () => new Uint8Array(),
    }));

    mock.module("@cursor/sdk", () => ({
      Agent: { create },
      Cursor: { me: mock(async () => ({})) },
    }));

    const { CursorLoop } = await importCursorLoop();
    const loop = new CursorLoop({
      cwd: "/repo",
      apiKey: "key_123",
    });
    loop.setMcpServers({
      workspace: { command: "bun", args: ["run", "mcp.ts"] },
    });

    const run = loop.run({ system: "system", prompt: "prompt" });
    const events: LoopEvent[] = [];
    for await (const event of run) events.push(event);
    const result = await run.result;

    expect(create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("system\n\nprompt", {
      mcpServers: {
        workspace: { type: "stdio", command: "bun", args: ["run", "mcp.ts"] },
      },
    });
    expect(events).toContainEqual({ type: "text", text: "done" });
    expect(events.find((event) => event.type === "usage")).toMatchObject({
      type: "usage",
      source: "estimate",
    });
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(loop.status).toBe("completed");
  });

  test("preflight validates Cursor API key presence without network by default", async () => {
    const { CursorLoop } = await importCursorLoop();

    const previousApiKey = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;
    try {
      await expect(new CursorLoop().preflight()).resolves.toEqual({
        ok: false,
        error: "Cursor SDK requires CURSOR_API_KEY or runtime env.CURSOR_API_KEY.",
      });
      await expect(new CursorLoop({ apiKey: "key_123" }).preflight()).resolves.toEqual({
        ok: true,
      });
    } finally {
      if (previousApiKey) process.env.CURSOR_API_KEY = previousApiKey;
    }
  });
});
