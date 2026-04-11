import { test, expect, describe } from "bun:test";
import {
  ContextEngine,
  type ContextSourceProvider,
} from "../src/context-engine.ts";
import { Inbox } from "../src/inbox.ts";
import { TodoManager } from "../src/todo.ts";
import { InMemoryNotesStorage } from "../src/notes.ts";
import { MemoryManager } from "../src/memory.ts";
import { ReminderManager } from "../src/reminder.ts";

describe("ContextEngine", () => {
  function createSources(overrides: Record<string, unknown> = {}) {
    return {
      instructions: "You are a test agent.",
      inbox: new Inbox({}, () => {}),
      todos: new TodoManager(),
      notes: new InMemoryNotesStorage(),
      memory: null,
      reminders: new ReminderManager(),
      history: [],
      currentFocus: "idle" as const,
      ...overrides,
    };
  }

  test("assemble includes system instructions", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources());
    expect(result.system).toContain("You are a test agent.");
  });

  test("assemble includes inbox peek", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const inbox = new Inbox({}, () => {});
    inbox.push("test message");
    const result = await engine.assemble(createSources({ inbox }));
    expect(result.system).toContain("Inbox");
  });

  test("assemble includes todo state", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const todos = new TodoManager();
    todos.add("fix the bug");
    const result = await engine.assemble(createSources({ todos }));
    expect(result.system).toContain("fix the bug");
  });

  test("assemble includes note keys", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const notes = new InMemoryNotesStorage();
    await notes.write("architecture", "some notes");
    const result = await engine.assemble(createSources({ notes }));
    expect(result.system).toContain("architecture");
  });

  test("assemble shows awareness for next_message", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources({ currentFocus: "next_message" }));
    expect(result.system).toContain("[AWARENESS]");
    expect(result.system).toContain("New messages arrived");
  });

  test("assemble shows awareness for next_todo", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources({ currentFocus: "next_todo" }));
    expect(result.system).toContain("[AWARENESS]");
    expect(result.system).toContain("pending todos");
  });

  test("assemble returns empty turns (history no longer injected into prompt)", async () => {
    const engine = new ContextEngine({ maxTokens: 200 });
    const history = Array.from({ length: 100 }, (_, i) => ({
      role: "user" as const,
      content: `Message number ${i} with some padding text to make it longer`,
    }));
    const result = await engine.assemble(createSources({ history }));
    expect(result.turns).toHaveLength(0);
  });

  test("tokenCount is computed", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources());
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  test("assemble shows awareness for waiting_reminder", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources({ currentFocus: "waiting_reminder" }));
    expect(result.system).toContain("Waiting for pending reminders");
  });

  test("assemble shows idle awareness for idle", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources({ currentFocus: "idle" }));
    expect(result.system).toContain("[AWARENESS]");
    expect(result.system).toContain("Idle");
  });

  test("assemble includes memory when provided", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const memory = new MemoryManager({});
    await memory.storageBackend.add({
      text: "User prefers dark mode",
      source: "test",
      timestamp: Date.now(),
    });

    const result = await engine.assemble(
      createSources({ memory, history: [{ role: "user", content: "dark mode" }] }),
    );
    expect(result.system).toContain("dark mode");
    expect(result.system).toContain("[MEMORY]");
  });

  test("assemble uses custom token estimator", async () => {
    let estimatorCalled = false;
    const engine = new ContextEngine({
      maxTokens: 8000,
      tokenEstimator: (text) => {
        estimatorCalled = true;
        return text.length;
      },
    });
    await engine.assemble(createSources());
    expect(estimatorCalled).toBe(true);
  });

  test("assemble includes pending reminders", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const reminders = new ReminderManager();
    reminders.add("build_check", { description: "Wait for CI" });
    const result = await engine.assemble(createSources({ reminders }));
    expect(result.system).toContain("build_check");
    expect(result.system).toContain("Wait for CI");
    reminders.cancelAll();
  });

  test("assemble truncates memory when it exceeds budget", async () => {
    const engine = new ContextEngine({ maxTokens: 300, memoryBudget: 0.1 });
    const memory = new MemoryManager({});
    const longText = "x".repeat(5000);
    await memory.storageBackend.add({
      text: longText,
      source: "test",
      timestamp: Date.now(),
    });

    const result = await engine.assemble(
      createSources({ memory, history: [{ role: "user", content: "x" }] }),
    );
    // Memory should be truncated, not the full 5000 chars
    expect(result.system.length).toBeLessThan(5000);
  });

  test("assemble uses [SECTION] format", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources());
    expect(result.system).toContain("[ROLE]");
    expect(result.system).toContain("[AWARENESS]");
    expect(result.system).toContain("[INBOX]");
    expect(result.system).toContain("[TODOS]");
  });

  test("assemble can use a custom context source provider", async () => {
    const provider: ContextSourceProvider = {
      async snapshot() {
        return {
          roleName: "Planner",
          roleInstructions: "Use workspace state first.",
          awareness: "- Prefer explicit state slices",
          inboxSnapshot: "Inbox replaced",
          todoSnapshot: "Todo replaced",
          reminderSnapshot: "Reminder replaced",
          noteKeys: ["design.md"],
          memoryQuery: "workspace state",
        };
      },
    };
    const engine = new ContextEngine({ maxTokens: 8000 }, provider);
    const result = await engine.assemble(createSources());

    expect(result.system).toContain("Planner");
    expect(result.system).toContain("Inbox replaced");
    expect(result.system).toContain("Todo replaced");
    expect(result.system).toContain("Reminder replaced");
    expect(result.system).toContain("design.md");
  });
});
