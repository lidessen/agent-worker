import type {
  Turn,
  AssembledPrompt,
  ContextConfig,
  TodoItem,
  MemoryEntry,
} from "./types.ts";
import type { Inbox } from "./inbox.ts";
import type { TodoManager } from "./todo.ts";
import type { NotesStorage } from "./types.ts";
import type { MemoryManager } from "./memory.ts";

export interface ContextSources {
  instructions: string;
  inbox: Inbox;
  todos: TodoManager;
  notes: NotesStorage;
  memory: MemoryManager | null;
  history: Turn[];
  currentFocus: "next_message" | "next_todo" | "idle";
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

  /** Assemble a prompt from all context sources */
  async assemble(sources: ContextSources): Promise<AssembledPrompt> {
    let budget = this.maxTokens;

    // 1. System instructions (always full)
    const systemParts: string[] = [];
    if (sources.instructions) {
      systemParts.push(sources.instructions);
    }

    // 2. Inbox peek
    const inboxPeek = sources.inbox.peek();
    systemParts.push(inboxPeek);

    // 3. Current focus
    const focusText = this.formatFocus(sources);
    if (focusText) {
      systemParts.push(focusText);
    }

    // 4. Todo state
    const todoText = sources.todos.format();
    systemParts.push(`📋 Todos:\n${todoText}`);

    // 5. Note keys
    const noteKeys = await sources.notes.list();
    if (noteKeys.length > 0) {
      systemParts.push(`📝 Notes: ${noteKeys.join(", ")}`);
    }

    const system = systemParts.join("\n\n");
    budget -= this.estimateTokens(system);

    // 6. Memory (up to memoryBudget fraction of remaining)
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
          // Truncate memory to fit
          memoryText = memoryText.slice(0, memBudget * 4);
          budget -= memBudget;
        }
      }
    }

    // 7. Conversation history (fills remaining budget, most recent first)
    const turns: Turn[] = [];
    let historyTokens = 0;
    for (let i = sources.history.length - 1; i >= 0 && budget > 0; i--) {
      const turn = sources.history[i]!;
      const tokens = this.estimateTokens(turn.content);
      if (historyTokens + tokens > budget) break;
      turns.unshift(turn);
      historyTokens += tokens;
      budget -= tokens;
    }

    // Build final system with memory
    const fullSystem = memoryText
      ? `${system}\n\n${memoryText}`
      : system;

    const totalTokens = this.estimateTokens(fullSystem) + historyTokens;

    return {
      system: fullSystem,
      turns,
      tokenCount: totalTokens,
    };
  }

  private formatFocus(sources: ContextSources): string | null {
    switch (sources.currentFocus) {
      case "next_message":
        return "🎯 Focus: New messages arrived — review your inbox.";
      case "next_todo":
        return "🎯 Focus: Continue working on your pending todos.";
      case "idle":
        return null;
    }
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
