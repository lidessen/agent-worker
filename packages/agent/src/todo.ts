import type { TodoItem } from "./types.ts";

let nextId = 1;

export class TodoManager {
  private items: TodoItem[] = [];

  add(text: string): TodoItem {
    const item: TodoItem = {
      id: `todo_${nextId++}`,
      text,
      status: "pending",
    };
    this.items.push(item);
    return item;
  }

  complete(id: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item || item.status === "done") return false;
    item.status = "done";
    return true;
  }

  clear(): void {
    this.items = [];
  }

  list(): readonly TodoItem[] {
    return this.items;
  }

  get pending(): readonly TodoItem[] {
    return this.items.filter((i) => i.status === "pending");
  }

  /** Format todo state for prompt injection */
  format(): string {
    if (this.items.length === 0) return "No todos.";
    return this.items
      .map((i) => `- [${i.status === "done" ? "x" : " "}] ${i.text} (${i.id})`)
      .join("\n");
  }
}
