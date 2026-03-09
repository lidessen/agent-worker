import { test, expect, describe } from "bun:test";
import { ContextEngine } from "../src/context-engine.ts";
import { Inbox } from "../src/inbox.ts";
import { TodoManager } from "../src/todo.ts";
import { InMemoryNotesStorage } from "../src/notes.ts";
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

  test("assemble shows focus for next_message", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(
      createSources({ currentFocus: "next_message" }),
    );
    expect(result.system).toContain("New messages arrived");
  });

  test("assemble shows focus for next_todo", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(
      createSources({ currentFocus: "next_todo" }),
    );
    expect(result.system).toContain("pending todos");
  });

  test("assemble trims conversation history to budget", async () => {
    const engine = new ContextEngine({ maxTokens: 200 });
    const history = Array.from({ length: 100 }, (_, i) => ({
      role: "user" as const,
      content: `Message number ${i} with some padding text to make it longer`,
    }));
    const result = await engine.assemble(createSources({ history }));
    // Should include fewer turns than all 100
    expect(result.turns.length).toBeLessThan(100);
    expect(result.turns.length).toBeGreaterThan(0);
    // Should include the most recent turns
    expect(result.turns[result.turns.length - 1]!.content).toContain("99");
  });

  test("tokenCount is computed", async () => {
    const engine = new ContextEngine({ maxTokens: 8000 });
    const result = await engine.assemble(createSources());
    expect(result.tokenCount).toBeGreaterThan(0);
  });
});
