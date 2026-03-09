import { test, expect, describe } from "bun:test";
import { TodoManager } from "../src/todo.ts";

describe("TodoManager", () => {
  test("add creates a pending item", () => {
    const todos = new TodoManager();
    const item = todos.add("fix bug");
    expect(item.text).toBe("fix bug");
    expect(item.status).toBe("pending");
    expect(item.id).toMatch(/^todo_/);
  });

  test("complete marks item as done", () => {
    const todos = new TodoManager();
    const item = todos.add("fix bug");
    expect(todos.complete(item.id)).toBe(true);
    expect(todos.list()[0]!.status).toBe("done");
  });

  test("complete returns false for non-existent id", () => {
    const todos = new TodoManager();
    expect(todos.complete("nonexistent")).toBe(false);
  });

  test("complete returns false for already done item", () => {
    const todos = new TodoManager();
    const item = todos.add("fix bug");
    todos.complete(item.id);
    expect(todos.complete(item.id)).toBe(false);
  });

  test("clear removes all items", () => {
    const todos = new TodoManager();
    todos.add("task 1");
    todos.add("task 2");
    todos.clear();
    expect(todos.list()).toHaveLength(0);
  });

  test("pending filters only pending items", () => {
    const todos = new TodoManager();
    const a = todos.add("task 1");
    todos.add("task 2");
    todos.complete(a.id);
    expect(todos.pending).toHaveLength(1);
    expect(todos.pending[0]!.text).toBe("task 2");
  });

  test("format shows todo list", () => {
    const todos = new TodoManager();
    const a = todos.add("task 1");
    todos.add("task 2");
    todos.complete(a.id);
    const formatted = todos.format();
    expect(formatted).toContain("[x] task 1");
    expect(formatted).toContain("[ ] task 2");
  });

  test("format shows 'No todos' when empty", () => {
    const todos = new TodoManager();
    expect(todos.format()).toBe("No todos.");
  });
});
