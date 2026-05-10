import { test, expect, describe, afterEach } from "bun:test";
import { execa } from "execa";
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Daemon } from "../src/daemon.ts";
import { AwClient } from "../src/client.ts";

const CHAT_YAML = `
name: test-ws
agents:
  alice:
    runtime: mock
    instructions: You are Alice.
  bob:
    runtime: mock
    instructions: You are Bob.
channels:
  - general
  - design
storage: memory
kickoff: "@alice Hello from kickoff"
`;

const TASK_YAML = `
name: task-ws
agents:
  alice:
    runtime: mock
    instructions: You are Alice.
channels:
  - general
storage: memory
kickoff: "@alice Finish the task"
`;

describe("Unified daemon (harness routes)", () => {
  let daemon: Daemon | null = null;
  let client: AwClient;
  let currentDataDir: string | null = null;

  async function setup() {
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { mkdirSync } = await import("node:fs");
    const dataDir = join(
      tmpdir(),
      `aw-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(dataDir, { recursive: true });
    currentDataDir = dataDir;
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();
    client = AwClient.fromInfo(info);
    return info;
  }

  afterEach(async () => {
    if (daemon) {
      await daemon.shutdown();
      daemon = null;
    }
  });

  test("creates harness and shows status", async () => {
    await setup();
    const wsInfo = await client.createHarness(CHAT_YAML);
    expect(wsInfo.name).toBe("test-ws");
    expect(wsInfo.agents).toHaveLength(2);
    expect(wsInfo.agents.sort()).toEqual(["alice", "bob"]);

    const status = await client.getHarnessStatus("test-ws");
    expect(status.name).toBe("test-ws");
    expect((status.agents as string[]).sort()).toEqual(["alice", "bob"]);
    expect(
      (status.agent_details as { name: string; runtime: string }[]).map((a) => a.name).sort(),
    ).toEqual(["alice", "bob"]);
    expect(status.channels as string[]).toContain("general");
    expect(status.channels as string[]).toContain("design");
  });

  test("sends and reads messages", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    // Send a message
    const sendResult = await client.sendToHarness("test-ws", {
      channel: "general",
      from: "user",
      content: "@alice Please review",
    });
    expect(sendResult.sent).toBe(true);

    // Read channel
    const chData = await client.readChannel("test-ws", "general");
    expect(chData.channel).toBe("general");
    // At least the kickoff message + our message
    expect(chData.messages.length).toBeGreaterThanOrEqual(2);

    const userMsg = chData.messages.find((m) => m.content.includes("Please review"));
    expect(userMsg).toBeTruthy();
    expect(userMsg!.from).toBe("user");
  });

  test("sends DM via agent field", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    await client.sendToHarness("test-ws", {
      from: "user",
      content: "Secret message for alice",
      agent: "alice",
    });

    // Check alice inbox
    const entries = await client.peekInbox("test-ws", "alice");
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  test("doc CRUD operations", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    // List docs (empty)
    const docs1 = await client.listDocs("test-ws");
    expect(docs1).toEqual([]);

    // Write a doc
    await client.writeDoc("test-ws", "spec.md", "# Spec v1");

    // Read it back
    const content = await client.readDoc("test-ws", "spec.md");
    expect(content).toBe("# Spec v1");

    // Append
    await client.appendDoc("test-ws", "spec.md", "\n## Section 2");

    const content2 = await client.readDoc("test-ws", "spec.md");
    expect(content2).toBe("# Spec v1\n## Section 2");

    // List docs (should have 1)
    const docs2 = await client.listDocs("test-ws");
    expect(docs2.map((d) => d.name)).toContain("spec.md");
  });

  test("lists channels", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const channels = await client.listChannels("test-ws");
    expect(channels).toContain("general");
    expect(channels).toContain("design");
  });

  test("listHarnessTasks surfaces the kickoff-created draft task", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    // Poll briefly since kickoff + task creation is async.
    let result = await client.listHarnessTasks("test-ws");
    for (let i = 0; i < 20 && result.tasks.length === 0; i++) {
      await Bun.sleep(50);
      result = await client.listHarnessTasks("test-ws");
    }

    expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    const first = result.tasks[0] as {
      id: string;
      status: string;
      title: string;
      sourceRefs: { kind: string }[];
    };
    expect(first.status).toBe("draft");
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.sourceRefs.some((r) => r.kind === "kickoff")).toBe(true);

    // getHarnessTask returns the task plus empty lifecycle lists at this point.
    const detailed = await client.getHarnessTask("test-ws", first.id);
    expect(detailed.task).toMatchObject({ id: first.id });
    expect(detailed.wakes).toEqual([]);
    expect(detailed.handoffs).toEqual([]);
  });

  test("listHarnessTasks accepts a status filter", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    // Wait for the kickoff task to appear.
    let drafts = await client.listHarnessTasks("test-ws", { status: "draft" });
    for (let i = 0; i < 20 && drafts.tasks.length === 0; i++) {
      await Bun.sleep(50);
      drafts = await client.listHarnessTasks("test-ws", { status: "draft" });
    }
    expect(drafts.tasks.length).toBeGreaterThanOrEqual(1);

    // No open tasks yet.
    const open = await client.listHarnessTasks("test-ws", { status: "open" });
    expect(open.tasks).toEqual([]);
  });

  test("listHarnessTasks rejects unknown status values with 400", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    // Hit the raw endpoint since the client passes through any string.
    await expect(client.listHarnessTasks("test-ws", { status: "garbage" })).rejects.toThrow();
  });

  test("create, update, and dispatch a task through HTTP POST endpoints", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const created = await client.createHarnessTask("test-ws", {
      title: "Wire auth middleware",
      goal: "Protect /api/admin with the new JWT check",
      acceptanceCriteria: "All admin endpoints return 401 without a token",
    });
    const task = created.task as { id: string; status: string; title: string };
    expect(task.status).toBe("draft");
    expect(task.title).toBe("Wire auth middleware");

    const updated = await client.updateHarnessTask("test-ws", task.id, {
      status: "open",
    });
    expect((updated.task as { status: string }).status).toBe("open");

    const dispatched = await client.dispatchHarnessTask("test-ws", task.id, {
      worker: "alice",
    });
    const taskAfter = dispatched.task as { status: string; activeWakeId?: string };
    const attempt = dispatched.wake as { id: string; agentName: string };
    expect(taskAfter.status).toBe("in_progress");
    expect(taskAfter.activeWakeId).toBe(attempt.id);
    expect(attempt.agentName).toBe("alice");

    // getHarnessTask should now show the attempt alongside the task.
    const detail = await client.getHarnessTask("test-ws", task.id);
    expect(detail.wakes).toHaveLength(1);
    const loaded = detail.wakes[0] as { id: string; status: string };
    expect(loaded.id).toBe(attempt.id);
    expect(loaded.status).toBe("running");
  });

  test("dispatching a task that already has an active attempt fails with 409", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const created = await client.createHarnessTask("test-ws", {
      title: "t",
      goal: "g",
    });
    const taskId = (created.task as { id: string }).id;
    await client.updateHarnessTask("test-ws", taskId, { status: "open" });
    await client.dispatchHarnessTask("test-ws", taskId, { worker: "alice" });

    await expect(
      client.dispatchHarnessTask("test-ws", taskId, { worker: "bob" }),
    ).rejects.toThrow();
  });

  test("createHarnessTask rejects an invalid status with 400", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    await expect(
      client.createHarnessTask("test-ws", {
        title: "t",
        goal: "g",
        status: "nope",
      }),
    ).rejects.toThrow();
  });

  test("completeHarnessTask finalizes the active attempt and records a handoff", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const created = await client.createHarnessTask("test-ws", {
      title: "Wire audit log",
      goal: "Log user-driven admin actions",
    });
    const taskId = (created.task as { id: string }).id;

    await client.updateHarnessTask("test-ws", taskId, { status: "open" });
    const dispatched = await client.dispatchHarnessTask("test-ws", taskId, {
      worker: "alice",
    });
    const attemptId = (dispatched.wake as { id: string }).id;

    const closed = await client.completeHarnessTask("test-ws", taskId, {
      summary: "Shipped audit log with tests",
    });

    const t = closed.task as { status: string; activeWakeId?: string };
    expect(t.status).toBe("completed");
    expect(t.activeWakeId).toBeUndefined();

    const attempts = closed.wakes as Array<{ id: string; status: string; endedAt?: number }>;
    const closedAttempt = attempts.find((a) => a.id === attemptId);
    expect(closedAttempt?.status).toBe("completed");
    expect(closedAttempt?.endedAt).toBeGreaterThan(0);

    const handoffs = closed.handoffs as Array<{
      kind: string;
      summary: string;
      createdBy: string;
    }>;
    const handoff = handoffs.find((h) => h.kind === "completed");
    expect(handoff).toBeDefined();
    expect(handoff?.summary).toBe("Shipped audit log with tests");
    expect(handoff?.createdBy).toBe("user");
  });

  test("abortHarnessTask cancels the active attempt and records an aborted handoff", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const created = await client.createHarnessTask("test-ws", {
      title: "Obsolete request",
      goal: "Will be canceled",
    });
    const taskId = (created.task as { id: string }).id;
    await client.updateHarnessTask("test-ws", taskId, { status: "open" });
    const dispatched = await client.dispatchHarnessTask("test-ws", taskId, {
      worker: "alice",
    });
    const attemptId = (dispatched.wake as { id: string }).id;

    const closed = await client.abortHarnessTask("test-ws", taskId, {
      reason: "Requirements changed",
    });
    expect((closed.task as { status: string }).status).toBe("aborted");

    // Assert by attempt id rather than position — ordering is not
    // guaranteed by the store interface and may differ once we have
    // multiple historical attempts per task.
    const attempts = closed.wakes as Array<{ id: string; status: string }>;
    const ours = attempts.find((a) => a.id === attemptId);
    expect(ours?.status).toBe("cancelled");

    const handoffs = closed.handoffs as Array<{
      kind: string;
      summary: string;
      closingWakeId: string;
    }>;
    const handoff = handoffs.find((h) => h.kind === "aborted");
    expect(handoff).toBeDefined();
    expect(handoff?.summary).toBe("Requirements changed");
    expect(handoff?.closingWakeId).toBe(attemptId);
  });

  test("completeHarnessTask works even without an active attempt", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const created = await client.createHarnessTask("test-ws", {
      title: "Quick note",
      goal: "Just a reminder",
    });
    const taskId = (created.task as { id: string }).id;

    // Skip dispatch entirely — directly complete a draft task.
    const closed = await client.completeHarnessTask("test-ws", taskId);
    expect((closed.task as { status: string }).status).toBe("completed");
    // No attempts means no handoff is written — that's deliberate.
    expect(closed.handoffs).toEqual([]);
  });

  test("closing an already-terminal task returns 409", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const created = await client.createHarnessTask("test-ws", {
      title: "Done",
      goal: "g",
    });
    const taskId = (created.task as { id: string }).id;
    await client.completeHarnessTask("test-ws", taskId);

    await expect(client.completeHarnessTask("test-ws", taskId)).rejects.toThrow();
  });

  test("task mutations land as task-category chronicle entries", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    const created = await client.createHarnessTask("test-ws", {
      title: "Write audit log",
      goal: "Add admin audit logging",
    });
    const taskId = (created.task as { id: string }).id;
    await client.updateHarnessTask("test-ws", taskId, { status: "open" });
    await client.dispatchHarnessTask("test-ws", taskId, { worker: "alice" });
    await client.completeHarnessTask("test-ws", taskId, {
      summary: "Shipped it",
    });

    const result = await client.readHarnessChronicle("test-ws", { category: "task" });
    const contents = result.entries.map((e) => e.content);

    // Order is newest-first from the store; pick by substring rather than
    // index so we don't couple the test to ordering semantics.
    expect(contents.some((c) => c.includes("task_create") && c.includes(taskId))).toBe(true);
    expect(
      contents.some(
        (c) => c.includes("task_update") && c.includes("draft → open") && c.includes(taskId),
      ),
    ).toBe(true);
    expect(
      contents.some(
        (c) => c.includes("task_dispatch") && c.includes("@alice") && c.includes(taskId),
      ),
    ).toBe(true);
    expect(
      contents.some(
        (c) => c.includes("task_completed") && c.includes("Shipped it") && c.includes(taskId),
      ),
    ).toBe(true);

    // Every entry we explicitly drove via HTTP should carry the user
    // author and task category. (The kickoff auto-draft that
    // managed-harness.kickoff() creates is authored by "system" and
    // is excluded here — the integration test's CHAT_YAML still fires a
    // kickoff before our explicit mutations, so we filter to just the
    // task id we created.)
    const ours = result.entries.filter((e) => e.content.includes(taskId));
    expect(ours.length).toBeGreaterThanOrEqual(4);
    for (const entry of ours) {
      expect(entry.author).toBe("user");
      expect(entry.category).toBe("task");
    }
  });

  test("task mutations emit harness.task_changed events on the harness stream", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    // Create a task and then poll for events — the bus emit should land
    // in the harness event log.
    const created = await client.createHarnessTask("test-ws", {
      title: "Stream me",
      goal: "g",
    });
    const taskId = (created.task as { id: string }).id;

    // Trigger another change so we have multiple events to find.
    await client.updateHarnessTask("test-ws", taskId, { status: "open" });

    let matches: Array<{ action?: string; taskId?: string }> = [];
    for (let i = 0; i < 20 && matches.length < 2; i++) {
      const result = await client.readHarnessEvents("test-ws", 0);
      matches = (result.entries as Array<Record<string, unknown>>)
        .filter((e) => e.type === "harness.task_changed" && e.taskId === taskId)
        .map((e) => ({
          action: e.action as string | undefined,
          taskId: e.taskId as string | undefined,
        }));
      if (matches.length < 2) await Bun.sleep(50);
    }

    const actions = matches.map((m) => m.action);
    expect(actions).toContain("created");
    expect(actions).toContain("updated");
  });

  test("reads harness events", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    // Poll until events appear (up to 2s)
    let result = await client.readHarnessEvents("test-ws", 0);
    for (let i = 0; i < 20 && result.entries.length === 0; i++) {
      await Bun.sleep(100);
      result = await client.readHarnessEvents("test-ws", 0);
    }
    // Should have harness.created, harness.kickoff events
    expect(result.entries.length).toBeGreaterThan(0);
    const types = result.entries.map((entry) => entry.type);
    expect(types).toContain("harness.created");
    expect(types).toContain("harness.kickoff");
    expect(types).not.toContain("harness.agent_prompt_ready");
    expect(types).not.toContain("harness.agent_tools");
  });

  test("shutdown via HTTP", async () => {
    await setup();
    await client.createHarness(CHAT_YAML);

    await client.stopHarness("test-ws");

    // Harness should be removed
    const harnesss = await client.listHarnesss();
    expect(harnesss.find((w) => w.name === "test-ws")).toBeUndefined();
  });

  test("stopHarness also wipes the harness-data directory on disk", async () => {
    await setup();
    const fileYaml = `
name: rm-test-ws
agents:
  alice:
    runtime: mock
    instructions: ""
channels:
  - general
storage: file
`;
    await client.createHarness(fileYaml);

    // Send a channel message — it should land in the channel
    // jsonl on disk, so we can confirm the file is populated.
    await client.sendToHarness("rm-test-ws", {
      channel: "general",
      from: "user",
      content: "hello",
    });

    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dataDir = join(currentDataDir!, "harness-data", "rm-test-ws");
    expect(existsSync(dataDir)).toBe(true);

    await client.stopHarness("rm-test-ws");

    // After rm, the entire data dir must be gone so that a
    // subsequent `create` with the same name starts clean.
    expect(existsSync(dataDir)).toBe(false);
  });

  test("recreated harness does not inherit the old channel history", async () => {
    await setup();
    const fileYaml = `
name: rm-recreate-ws
agents:
  alice:
    runtime: mock
    instructions: ""
channels:
  - general
storage: file
`;
    await client.createHarness(fileYaml);
    await client.sendToHarness("rm-recreate-ws", {
      channel: "general",
      from: "user",
      content: "old message that must not leak",
    });
    await client.stopHarness("rm-recreate-ws");

    // Recreate with the same name.
    await client.createHarness(fileYaml);
    const data = await client.readChannel("rm-recreate-ws", "general");
    const messages = (data.messages ?? []) as Array<{ content: string }>;
    expect(messages.find((m) => m.content.includes("old message"))).toBeUndefined();
  });

  test("task harness wait completes after work drains", async () => {
    await setup();
    const wsInfo = await client.createHarness(TASK_YAML, { mode: "task" });
    expect(wsInfo.mode).toBe("task");

    const result = await client.waitHarness("task-ws", "5s");
    expect(result.status).toBe("completed");
  });

  test("worktree_create attaches a worktree to the current attempt and cleanup fires on terminal status", async () => {
    // Phase-1 v3: worktrees are attempt-scoped and runtime-
    // created, not declared in YAML. Drive the full lifecycle
    // through the daemon HTTP layer:
    //   1. create a harness with a coder agent (no static
    //      worktree config — harness is git-unaware)
    //   2. open a task and dispatch it to the coder
    //   3. POST /tool-call worktree_create against the worker's
    //      active attempt → expect a real worktree on disk +
    //      branch in the source repo + entry on attempt.worktrees
    //   4. POST /tool-call wake_update status=completed →
    //      expect the worktree to be cleaned up via the
    //      `wake.terminal` event listener; branch survives.
    const scratchRepo = realpathSync(mkdtempSync(join(tmpdir(), "aw-phase1v3-repo-")));
    try {
      await execa("git", ["-C", scratchRepo, "init", "-b", "main"]);
      await execa("git", ["-C", scratchRepo, "config", "user.email", "t@e.com"]);
      await execa("git", ["-C", scratchRepo, "config", "user.name", "tester"]);
      writeFileSync(join(scratchRepo, "README.md"), "scratch\n");
      await execa("git", ["-C", scratchRepo, "add", "README.md"]);
      await execa("git", ["-C", scratchRepo, "commit", "-m", "initial"]);

      const daemonInfo = await setup();
      const yaml = `
name: phase1v3
agents:
  lead:
    runtime: mock
  coder:
    runtime: mock
channels:
  - general
storage: memory
lead: lead
`;
      await client.createHarness(yaml);

      // Helper: POST /tool-call as a given agent.
      const callTool = async (agent: string, name: string, args: Record<string, unknown>) => {
        const url = `http://${daemonInfo.host}:${daemonInfo.port}/harnesss/phase1v3/tool-call`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${daemonInfo.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agent, name, args }),
        });
        return (await res.json()) as { content?: string; error?: string };
      };

      // 1. Lead creates a task.
      const taskCreateRes = await callTool("lead", "task_create", {
        title: "Add hello.ts",
        goal: "Drop a hello.ts in the worktree",
        status: "open",
      });
      expect(taskCreateRes.content).toBeDefined();
      const taskId = (taskCreateRes.content ?? "").match(/task_[a-f0-9]+/)?.[0];
      expect(taskId).toBeDefined();

      // 2. Lead dispatches to coder. dispatch creates the
      // attempt — no worktree yet.
      const dispatchRes = await callTool("lead", "task_dispatch", {
        taskId,
        worker: "coder",
      });
      expect(dispatchRes.content).toContain("Dispatched");

      // The attempt is now active — verify before we touch worktrees.
      const tasksRes = await fetch(
        `http://${daemonInfo.host}:${daemonInfo.port}/harnesss/phase1v3/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${daemonInfo.token}` } },
      );
      const taskBody = (await tasksRes.json()) as { task: { activeWakeId?: string } };
      const attemptId = taskBody.task.activeWakeId;
      expect(attemptId).toBeDefined();

      // 3. Coder calls worktree_create. The /tool-call route
      // looks up the coder's active attempt and injects the
      // attempt-scoped tool with that id closure-bound.
      const wtCreateRes = await callTool("coder", "worktree_create", {
        name: "main",
        repo: scratchRepo,
        branch: "phase1v3/feature",
        base_branch: "main",
      });
      expect(wtCreateRes.content).toContain("worktree[main]");
      expect(wtCreateRes.error).toBeUndefined();

      // The branch must exist in the source repo.
      const { stdout: branches } = await execa("git", ["-C", scratchRepo, "branch", "--list"]);
      expect(branches).toContain("phase1v3/feature");

      // The worktree dir must be live and listed by git.
      const { stdout: wtList } = await execa("git", [
        "-C",
        scratchRepo,
        "worktree",
        "list",
        "--porcelain",
      ]);
      expect(wtList).toContain("branch refs/heads/phase1v3/feature");

      // worktree_list reflects the same state.
      const wtListRes = await callTool("coder", "worktree_list", {});
      expect(wtListRes.content).toContain("main");
      expect(wtListRes.content).toContain("phase1v3/feature");

      // Attempt-scoped uniqueness: same name twice → error.
      const dupRes = await callTool("coder", "worktree_create", {
        name: "main",
        repo: scratchRepo,
        branch: "phase1v3/other",
      });
      expect(dupRes.content ?? dupRes.error).toMatch(/already has a worktree named "main"/);

      // 4. Mark the attempt completed → terminal event →
      // worktree cleanup.
      const updateRes = await callTool("coder", "wake_update", {
        id: attemptId,
        status: "completed",
        resultSummary: "done",
      });
      expect(updateRes.content).toBeDefined();

      // Worktree gone, branch retained.
      const { stdout: wtListAfter } = await execa("git", [
        "-C",
        scratchRepo,
        "worktree",
        "list",
        "--porcelain",
      ]);
      expect(wtListAfter).not.toContain("phase1v3/feature");
      const { stdout: branchesAfter } = await execa("git", [
        "-C",
        scratchRepo,
        "branch",
        "--list",
      ]);
      expect(branchesAfter).toContain("phase1v3/feature");
    } finally {
      rmSync(scratchRepo, { recursive: true, force: true });
    }
  });

  test("multi-worktree on a single attempt: two repos, two names", async () => {
    // Verifies the "0..N worktrees per attempt" contract:
    // one attempt, two worktree_create calls against two
    // different repos, both visible on attempt.worktrees, both
    // cleaned up on terminal status.
    const repoA = realpathSync(mkdtempSync(join(tmpdir(), "aw-multi-wt-a-")));
    const repoB = realpathSync(mkdtempSync(join(tmpdir(), "aw-multi-wt-b-")));
    try {
      for (const repo of [repoA, repoB]) {
        await execa("git", ["-C", repo, "init", "-b", "main"]);
        await execa("git", ["-C", repo, "config", "user.email", "t@e.com"]);
        await execa("git", ["-C", repo, "config", "user.name", "tester"]);
        writeFileSync(join(repo, "README.md"), `${repo}\n`);
        await execa("git", ["-C", repo, "add", "README.md"]);
        await execa("git", ["-C", repo, "commit", "-m", "initial"]);
      }

      const daemonInfo = await setup();
      await client.createHarness(`
name: multi-wt
agents:
  lead: { runtime: mock }
  coder: { runtime: mock }
channels:
  - general
storage: memory
lead: lead
`);

      const callTool = async (agent: string, name: string, args: Record<string, unknown>) => {
        const url = `http://${daemonInfo.host}:${daemonInfo.port}/harnesss/multi-wt/tool-call`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${daemonInfo.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agent, name, args }),
        });
        return (await res.json()) as { content?: string; error?: string };
      };

      const create = await callTool("lead", "task_create", {
        title: "Cross-repo refactor",
        goal: "...",
        status: "open",
      });
      const taskId = (create.content ?? "").match(/task_[a-f0-9]+/)?.[0];
      expect(taskId).toBeDefined();
      await callTool("lead", "task_dispatch", { taskId, worker: "coder" });

      const taskRes = await fetch(
        `http://${daemonInfo.host}:${daemonInfo.port}/harnesss/multi-wt/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${daemonInfo.token}` } },
      );
      const taskBody = (await taskRes.json()) as { task: { activeWakeId?: string } };
      const attemptId = taskBody.task.activeWakeId!;

      // Worktree 1: primary repo
      const wt1 = await callTool("coder", "worktree_create", {
        name: "core",
        repo: repoA,
        branch: "multi-wt/core",
      });
      expect(wt1.error).toBeUndefined();

      // Worktree 2: secondary repo on same attempt
      const wt2 = await callTool("coder", "worktree_create", {
        name: "deps",
        repo: repoB,
        branch: "multi-wt/deps",
      });
      expect(wt2.error).toBeUndefined();

      // Both worktrees present on the attempt
      const list = await callTool("coder", "worktree_list", {});
      expect(list.content).toContain("core");
      expect(list.content).toContain("deps");
      expect(list.content).toContain(repoA);
      expect(list.content).toContain(repoB);

      // Terminal status cleans BOTH worktrees, both branches survive
      await callTool("coder", "wake_update", {
        id: attemptId,
        status: "completed",
        resultSummary: "done",
      });

      const { stdout: aWt } = await execa("git", ["-C", repoA, "worktree", "list", "--porcelain"]);
      const { stdout: bWt } = await execa("git", ["-C", repoB, "worktree", "list", "--porcelain"]);
      expect(aWt).not.toContain("multi-wt/core");
      expect(bWt).not.toContain("multi-wt/deps");

      const { stdout: aBranches } = await execa("git", ["-C", repoA, "branch", "--list"]);
      const { stdout: bBranches } = await execa("git", ["-C", repoB, "branch", "--list"]);
      expect(aBranches).toContain("multi-wt/core");
      expect(bBranches).toContain("multi-wt/deps");
    } finally {
      rmSync(repoA, { recursive: true, force: true });
      rmSync(repoB, { recursive: true, force: true });
    }
  });
});
