import type { Turn, AssembledPrompt, ContextConfig } from "./types.ts";
import type { Inbox } from "./inbox.ts";
import type { TodoManager } from "./todo.ts";
import type { NotesStorage } from "./types.ts";
import type { MemoryManager } from "./memory.ts";
import type { ReminderManager } from "./reminder.ts";

export interface ContextSources {
  instructions: string;
  inbox: Inbox;
  todos: TodoManager;
  notes: NotesStorage;
  memory: MemoryManager | null;
  reminders: ReminderManager;
  history: Turn[];
  currentFocus: "next_message" | "next_todo" | "waiting_reminder" | "idle";
  /** Agent display name, used in the [ROLE] section. */
  name?: string;
}

function defaultTokenEstimator(text: string): number {
  return Math.ceil(text.length / 4);
}

export class ContextEngine {
  private maxTokens: number;
  private memoryBudget: number;
  private estimateTokens: (text: string) => number;

  constructor(config: ContextConfig = {}) {
    this.maxTokens = config.maxTokens ?? 8000;
    this.memoryBudget = config.memoryBudget ?? 0.2;
    this.estimateTokens = config.tokenEstimator ?? defaultTokenEstimator;
  }

  /** Assemble a prompt from all context sources using [SECTION] format. */
  async assemble(sources: ContextSources): Promise<AssembledPrompt> {
    let budget = this.maxTokens;
    const sections: string[] = [];

    // [ROLE]
    const roleName = sources.name ?? "Agent";
    if (sources.instructions) {
      sections.push(`[ROLE]\n${roleName}\n${sources.instructions}`);
    } else {
      sections.push(`[ROLE]\n${roleName}`);
    }

    // [AWARENESS]
    const awareness = this.buildAwareness(sources);
    sections.push(`[AWARENESS]\n${awareness}`);

    // [INBOX]
    const inboxPeek = sources.inbox.peek();
    sections.push(`[INBOX]\n${inboxPeek}`);

    // [TODOS]
    const todoText = sources.todos.format();
    sections.push(`[TODOS]\n${todoText}`);

    // [REMINDERS]
    const reminderText = sources.reminders.formatPending();
    if (reminderText) {
      sections.push(`[REMINDERS]\n${reminderText}`);
    }

    // [NOTES]
    const noteKeys = await sources.notes.list();
    if (noteKeys.length > 0) {
      sections.push(`[NOTES]\n${noteKeys.join(", ")}`);
    }

    const system = sections.join("\n\n");
    budget -= this.estimateTokens(system);

    // [MEMORY] — up to memoryBudget fraction of remaining
    let memoryText = "";
    if (sources.memory && budget > 0) {
      const memBudget = Math.floor(budget * this.memoryBudget);
      const query = this.extractQueryFromFocus(sources);
      memoryText = await sources.memory.formatForPrompt(query);
      if (memoryText) {
        const memTokens = this.estimateTokens(memoryText);
        if (memTokens <= memBudget) {
          budget -= memTokens;
        } else {
          memoryText = memoryText.slice(0, memBudget * 4);
          budget -= memBudget;
        }
      }
    }

    const fullSystem = memoryText ? `${system}\n\n[MEMORY]\n${memoryText}` : system;
    const totalTokens = this.estimateTokens(fullSystem);

    return {
      system: fullSystem,
      turns: [],
      tokenCount: totalTokens,
      inboxSnapshot: inboxPeek,
      todoSnapshot: todoText,
    };
  }

  /** Build the [AWARENESS] section — operational rules based on current focus. */
  private buildAwareness(sources: ContextSources): string {
    const rules: string[] = [];

    switch (sources.currentFocus) {
      case "next_message":
        rules.push("- New messages arrived — read and respond to your inbox");
        rules.push("- Prioritize unread messages");
        break;
      case "next_todo":
        rules.push("- No new messages — continue working on pending todos");
        break;
      case "waiting_reminder":
        rules.push("- Waiting for pending reminders");
        rules.push("- Continue with available work or wait");
        break;
      case "idle":
        rules.push("- Idle — no pending work");
        break;
    }

    rules.push("- Only visible content is guaranteed");
    rules.push("- Use tools to inspect and act");

    return rules.join("\n");
  }

  private extractQueryFromFocus(sources: ContextSources): string {
    // Use recent turns + todos as query for memory recall
    const parts: string[] = [];

    // Recent turn content
    const recentTurns = sources.history.slice(-3);
    for (const turn of recentTurns) {
      parts.push(turn.content.slice(0, 200));
    }

    // Pending todos
    for (const todo of sources.todos.pending) {
      parts.push(todo.text);
    }

    return parts.join(" ").slice(0, 500);
  }
}
