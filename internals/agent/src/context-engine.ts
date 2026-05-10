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

export interface ContextSnapshot {
  roleName: string;
  roleInstructions: string;
  awareness: string;
  inboxSnapshot: string;
  todoSnapshot: string;
  reminderSnapshot?: string;
  noteKeys: string[];
  memoryQuery: string;
}

export interface ContextSourceProvider {
  snapshot(sources: ContextSources): Promise<ContextSnapshot>;
}

function defaultTokenEstimator(text: string): number {
  return Math.ceil(text.length / 4);
}

export class DefaultContextSourceProvider implements ContextSourceProvider {
  async snapshot(sources: ContextSources): Promise<ContextSnapshot> {
    return {
      roleName: sources.name ?? "Agent",
      roleInstructions: sources.instructions,
      awareness: this.buildAwareness(sources),
      inboxSnapshot: sources.inbox.peek(),
      todoSnapshot: sources.todos.format(),
      reminderSnapshot: sources.reminders.formatPending() || undefined,
      noteKeys: await sources.notes.list(),
      memoryQuery: this.extractQueryFromFocus(sources),
    };
  }

  /** Build the [AWARENESS] section based on current focus. */
  private buildAwareness(sources: ContextSources): string {
    const rules: string[] = [];

    switch (sources.currentFocus) {
      case "next_message":
        rules.push("- New messages arrived — read and respond to your inbox");
        rules.push("- Prioritize unread messages");
        rules.push(
          "- If the inbox preview already shows the full message, respond directly without extra tool calls",
        );
        rules.push(
          "- Do not inspect the repository or harness just to verify inbox/harness mechanics",
        );
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
    rules.push(
      "- Use tools only when visible context is insufficient or the task explicitly requires them",
    );

    return rules.join("\n");
  }

  private extractQueryFromFocus(sources: ContextSources): string {
    const parts: string[] = [];

    const recentTurns = sources.history.slice(-3);
    for (const turn of recentTurns) {
      parts.push(turn.content.slice(0, 200));
    }

    for (const todo of sources.todos.pending) {
      parts.push(todo.text);
    }

    return parts.join(" ").slice(0, 500);
  }
}

export class ContextEngine {
  private maxTokens: number;
  private memoryBudget: number;
  private estimateTokens: (text: string) => number;
  private sourceProvider: ContextSourceProvider;

  constructor(
    config: ContextConfig = {},
    sourceProvider: ContextSourceProvider = new DefaultContextSourceProvider(),
  ) {
    this.maxTokens = config.maxTokens ?? 8000;
    this.memoryBudget = config.memoryBudget ?? 0.2;
    this.estimateTokens = config.tokenEstimator ?? defaultTokenEstimator;
    this.sourceProvider = sourceProvider;
  }

  /** Assemble a prompt from all context sources using [SECTION] format. */
  async assemble(sources: ContextSources): Promise<AssembledPrompt> {
    let budget = this.maxTokens;
    const sections: string[] = [];
    const snapshot = await this.sourceProvider.snapshot(sources);

    // [ROLE]
    if (snapshot.roleInstructions) {
      sections.push(`[ROLE]\n${snapshot.roleName}\n${snapshot.roleInstructions}`);
    } else {
      sections.push(`[ROLE]\n${snapshot.roleName}`);
    }

    // [AWARENESS]
    sections.push(`[AWARENESS]\n${snapshot.awareness}`);

    // [INBOX]
    sections.push(
      `[INBOX]\nTreat this section as authoritative runtime input. Entries ending with ✓ already include the full message text. Only fetch more inbox context when an entry explicitly says it is truncated.\n${snapshot.inboxSnapshot}`,
    );

    // [TODOS]
    sections.push(`[TODOS]\n${snapshot.todoSnapshot}`);

    // [REMINDERS]
    if (snapshot.reminderSnapshot) {
      sections.push(`[REMINDERS]\n${snapshot.reminderSnapshot}`);
    }

    // [NOTES]
    if (snapshot.noteKeys.length > 0) {
      sections.push(`[NOTES]\n${snapshot.noteKeys.join(", ")}`);
    }

    const system = sections.join("\n\n");
    budget -= this.estimateTokens(system);

    // [MEMORY] — up to memoryBudget fraction of remaining
    let memoryText = "";
    if (sources.memory && budget > 0) {
      const memBudget = Math.floor(budget * this.memoryBudget);
      memoryText = await sources.memory.formatForPrompt(snapshot.memoryQuery);
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
      inboxSnapshot: snapshot.inboxSnapshot,
      todoSnapshot: snapshot.todoSnapshot,
    };
  }
}
