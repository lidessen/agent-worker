import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createHarness } from "../src/factory.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import { HarnessMcpHub } from "../src/mcp-server.ts";
import { HarnessClient } from "@agent-worker/agent";
import type { Harness } from "../src/harness.ts";

describe("HarnessMcpHub + HarnessClient", () => {
  let harness: Harness;
  let server: HarnessMcpHub;

  beforeEach(async () => {
    harness = await createHarness({
      name: "test",
      channels: ["general", "design"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });
    server = new HarnessMcpHub(harness);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    await harness.shutdown();
  });

  test("server starts and reports health", async () => {
    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toContain("127.0.0.1");

    const res = await fetch(`${server.url}/health`);
    const data = (await res.json()) as { status: string; harness: string };
    expect(data.status).toBe("ok");
    expect(data.harness).toBe("test");
  });

  test("agent connects and lists tools", async () => {
    const client = new HarnessClient({
      agentName: "bob",
      harnessUrl: server.url!,
    });

    await client.connect();
    const { tools } = await client.listTools();

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("channel_send");
    expect(toolNames).toContain("channel_read");
    expect(toolNames).toContain("channel_list");
    expect(toolNames).toContain("my_inbox");
    expect(toolNames).toContain("my_inbox_ack");
    expect(toolNames).toContain("my_status_set");
    expect(toolNames).toContain("team_members");
    expect(toolNames).toContain("team_doc_read");
    expect(toolNames).toContain("resource_create");

    await client.disconnect();
  });

  test("agent auto-registers on connect", async () => {
    const client = new HarnessClient({
      agentName: "newcomer",
      harnessUrl: server.url!,
    });

    await client.connect();
    // Listing tools triggers auto-registration
    await client.listTools();

    expect(server.connectedAgents()).toContain("newcomer");

    // Should appear in team members
    const members = await client.callTool("team_members");
    expect(members).toContain("newcomer");

    await client.disconnect();
  });

  test("channel_send and channel_read via MCP", async () => {
    const client = new HarnessClient({
      agentName: "bob",
      harnessUrl: server.url!,
    });
    await client.connect();

    // Send a message
    const sendResult = await client.callTool("channel_send", {
      channel: "general",
      content: "Hello from MCP!",
    });
    expect(sendResult).toContain("Sent message");

    // Read messages
    const readResult = await client.callTool("channel_read", {
      channel: "general",
    });
    expect(readResult).toContain("Hello from MCP!");

    await client.disconnect();
  });

  test("inbox tools work via MCP", async () => {
    // Bob must be registered before alice sends the mention,
    // so the harness routes the message to bob's inbox.
    await harness.registerAgent("bob", ["general"]);

    // Alice sends a message mentioning bob
    await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hey @bob, check this out",
    });

    const client = new HarnessClient({
      agentName: "bob",
      harnessUrl: server.url!,
    });
    await client.connect();

    // Check inbox
    const inbox = await client.callTool("my_inbox");
    expect(inbox).toContain("Hey @bob");

    await client.disconnect();
  });

  test("two agents collaborate via MCP", async () => {
    const alice = new HarnessClient({
      agentName: "alice",
      harnessUrl: server.url!,
    });
    const bob = new HarnessClient({
      agentName: "bob",
      harnessUrl: server.url!,
    });

    await alice.connect();
    await bob.connect();

    // Alice sends
    await alice.callTool("channel_send", {
      channel: "general",
      content: "Design ready for review @bob",
    });

    // Bob reads
    const messages = await bob.callTool("channel_read", {
      channel: "general",
    });
    expect(messages).toContain("Design ready for review");

    // Bob checks inbox
    const inbox = await bob.callTool("my_inbox");
    expect(inbox).toContain("Design ready for review");

    await alice.disconnect();
    await bob.disconnect();
  });

  test("team docs via MCP", async () => {
    const client = new HarnessClient({
      agentName: "alice",
      harnessUrl: server.url!,
    });
    await client.connect();

    // Create doc
    await client.callTool("team_doc_create", {
      name: "plan",
      content: "Step 1: Design",
    });

    // List docs
    const list = await client.callTool("team_doc_list");
    expect(list).toContain("plan");

    // Read doc
    const doc = await client.callTool("team_doc_read", { name: "plan" });
    expect(doc).toContain("Step 1: Design");

    // Append to doc
    await client.callTool("team_doc_append", {
      name: "plan",
      content: "\nStep 2: Build",
    });

    const updated = await client.callTool("team_doc_read", { name: "plan" });
    expect(updated).toContain("Step 2: Build");

    await client.disconnect();
  });

  test("resources via MCP", async () => {
    const client = new HarnessClient({
      agentName: "alice",
      harnessUrl: server.url!,
    });
    await client.connect();

    // Create a large resource
    const content = "A".repeat(2000);
    const createResult = await client.callTool("resource_create", { content });
    expect(createResult).toContain("Created resource");

    // Extract resource ID
    const match = createResult.match(/resource\s+(\S+)/);
    expect(match).not.toBeNull();
    const resourceId = match![1];

    // Read it back
    const readResult = await client.callTool("resource_read", { id: resourceId });
    expect(readResult).toBe(content);

    await client.disconnect();
  });

  test("status set via MCP", async () => {
    const client = new HarnessClient({
      agentName: "alice",
      harnessUrl: server.url!,
    });
    await client.connect();

    await client.callTool("my_status_set", {
      status: "running",
      task: "designing login page",
    });

    const members = await client.callTool("team_members");
    expect(members).toContain("running");
    expect(members).toContain("designing login page");

    await client.disconnect();
  });

  test("agentUrl returns correct URL", () => {
    const url = server.agentUrl("designer");
    expect(url).toBe(`http://127.0.0.1:${server.port}/mcp/designer`);
  });

  test("debugUrl returns correct URL", () => {
    expect(server.debugUrl).toBe(`http://127.0.0.1:${server.port}/mcp/$supervisor`);
  });
});

// ── Debug tools ──────────────────────────────────────────────────────────────

describe("HarnessMcpHub debug tools", () => {
  let harness: Harness;
  let server: HarnessMcpHub;
  let debug: HarnessClient;

  beforeEach(async () => {
    harness = await createHarness({
      name: "debug-test",
      channels: ["general"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });
    server = new HarnessMcpHub(harness);
    await server.start();
    debug = new HarnessClient({ agentName: "$supervisor", harnessUrl: server.url! });
    await debug.connect();
  });

  afterEach(async () => {
    await debug.disconnect();
    await server.stop();
    await harness.shutdown();
  });

  test("debug client lists both debug and agent tools", async () => {
    const { tools } = await debug.listTools();
    const names = tools.map((t) => t.name);
    // Debug-only tools
    expect(names).toContain("agents");
    expect(names).toContain("agent_activity");
    expect(names).toContain("activity_detail");
    expect(names).toContain("events");
    expect(names).toContain("queue");
    expect(names).toContain("harness_info");
    expect(names).toContain("inbox_peek");
    // Agent collaboration tools (debug is a superset)
    expect(names).toContain("channel_send");
    expect(names).toContain("channel_read");
    expect(names).toContain("my_inbox");
    expect(names).toContain("team_members");
  });

  test("agents tool shows registered agents", async () => {
    const result = await debug.callTool("agents");
    expect(result).toContain("alice");
    expect(result).toContain("bob");
    expect(result).toContain("idle");
  });

  test("agent_activity returns timeline events", async () => {
    // Generate some activity
    await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hello world",
    });
    await harness.eventLog.log("alice", "system", "Test event");

    const result = await debug.callTool("agent_activity", { agent: "alice" });
    expect(result).toContain("Test event");
  });

  test("events tool filters by agent", async () => {
    await harness.eventLog.log("alice", "system", "Alice event");
    await harness.eventLog.log("bob", "system", "Bob event");

    const aliceEvents = await debug.callTool("events", { agent: "alice" });
    expect(aliceEvents).toContain("Alice event");
    expect(aliceEvents).not.toContain("Bob event");

    const allEvents = await debug.callTool("events");
    expect(allEvents).toContain("Alice event");
    expect(allEvents).toContain("Bob event");
  });

  test("queue tool shows empty queue", async () => {
    const result = await debug.callTool("queue");
    expect(result).toContain("empty");
  });

  test("queue tool shows pending instructions", async () => {
    harness.instructionQueue.enqueue({
      id: "test-1",
      agentName: "alice",
      messageId: "",
      channel: "",
      content: "Do something important",
      priority: "normal",
      enqueuedAt: new Date().toISOString(),
    });

    const result = await debug.callTool("queue");
    expect(result).toContain("1 pending");
    expect(result).toContain("Do something important");
    expect(result).toContain("normal");
  });

  test("activity_detail without storageDir returns unavailable", async () => {
    const result = await debug.callTool("activity_detail", {
      agent: "alice",
      run_id: "nonexistent",
    });
    expect(result).toContain("storageDir not configured");
  });

  test("harness_info shows harness configuration", async () => {
    const result = await debug.callTool("harness_info");
    expect(result).toContain("debug-test");
    expect(result).toContain("general");
    expect(result).toContain("alice");
    expect(result).toContain("bob");
    expect(result).toContain("in-memory");
  });

  test("inbox_peek shows agent inbox", async () => {
    // Register bob so inbox routing works
    await harness.registerAgent("bob", ["general"]);
    // Send a message mentioning bob
    await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hey @bob, check this",
    });

    const result = await debug.callTool("inbox_peek", { agent: "bob" });
    expect(result).toContain("Hey @bob");
    expect(result).toContain("alice");
  });

  test("inbox_peek shows empty for agent with no messages", async () => {
    const result = await debug.callTool("inbox_peek", { agent: "alice" });
    expect(result).toContain("empty");
  });

  test("agents tool shows channel subscriptions", async () => {
    const result = await debug.callTool("agents");
    expect(result).toContain("general");
  });

  test("queue groups by priority", async () => {
    harness.instructionQueue.enqueue({
      id: "i1",
      agentName: "alice",
      messageId: "",
      channel: "",
      content: "Urgent task",
      priority: "immediate",
      enqueuedAt: new Date().toISOString(),
    });
    harness.instructionQueue.enqueue({
      id: "i2",
      agentName: "bob",
      messageId: "",
      channel: "",
      content: "Normal task",
      priority: "normal",
      enqueuedAt: new Date().toISOString(),
    });

    const result = await debug.callTool("queue");
    expect(result).toContain("2 pending");
    expect(result).toContain("[immediate]");
    expect(result).toContain("[normal]");
    expect(result).toContain("Urgent task");
    expect(result).toContain("Normal task");
  });
});
