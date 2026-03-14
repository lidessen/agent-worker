import type { LoopEvent, LoopResult } from "@agent-worker/loop";
import type {
  AgentLoop,
  NotesStorage,
  Turn,
  RunInfo,
  AssembledPrompt,
  PrepareStepResult,
} from "./types.ts";
import type { Inbox } from "./inbox.ts";
import type { TodoManager } from "./todo.ts";
import type { ContextEngine } from "./context-engine.ts";
import type { MemoryManager } from "./memory.ts";
import type { ReminderManager } from "./reminder.ts";

export interface RunCoordinatorDeps {
  loop: AgentLoop;
  inbox: Inbox;
  todos: TodoManager;
  notes: NotesStorage;
  contextEngine: ContextEngine;
  memory: MemoryManager | null;
  reminders: ReminderManager;
  instructions: string;
  maxRuns: number;
  /** Agent display name for the [ROLE] section. */
  name?: string;
}

export interface ProcessingCallbacks {
  onRunStart?: (info: RunInfo) => void;
  onRunEnd?: (result: LoopResult) => void;
  onEvent?: (event: LoopEvent) => void;
  onContextAssembled?: (prompt: AssembledPrompt) => void;
  /** Return true to abort the loop (e.g. agent stopped). */
  shouldStop?: () => boolean;
}

/**
 * Owns the main processing loop: shouldContinue → assemble → run → persist → extract.
 *
 * Agent delegates here for all run-level logic. Agent keeps lifecycle (state machine,
 * event bus, subsystem wiring). RunCoordinator keeps orchestration (what to run next,
 * how to build the prompt, where to store results).
 */
export class RunCoordinator {
  readonly history: Turn[] = [];

  constructor(private deps: RunCoordinatorDeps) {}

  // ── Decision ────────────────────────────────────────────────────────────

  shouldContinue(): "next_message" | "next_todo" | "waiting_reminder" | "idle" {
    if (this.deps.inbox.unread.length > 0) return "next_message";
    if (this.deps.todos.pending.length > 0) return "next_todo";
    if (this.deps.reminders.hasPending) return "waiting_reminder";
    return "idle";
  }

  // ── Notification ─────────────────────────────────────────────────────

  /** Build a short notification signal that tells the agent why it was woken. */
  buildNotification(trigger: "next_message" | "next_todo"): string {
    if (trigger === "next_message") {
      return "[notification] New messages in inbox.";
    }
    return "[notification] Pending todos require attention.";
  }

  // ── Single run ──────────────────────────────────────────────────────────

  async executeRun(
    trigger: "next_message" | "next_todo",
    onEvent?: (event: LoopEvent) => void,
  ): Promise<{ loopResult: LoopResult; assembled: AssembledPrompt }> {
    const notification = this.buildNotification(trigger);

    const assembled = await this.deps.contextEngine.assemble({
      instructions: this.deps.instructions,
      inbox: this.deps.inbox,
      todos: this.deps.todos,
      notes: this.deps.notes,
      memory: this.deps.memory,
      reminders: this.deps.reminders,
      history: this.history,
      currentFocus: trigger,
      name: this.deps.name,
    });

    // Pass structured input: system (dashboard) + prompt (notification)
    const run = this.deps.loop.run({
      system: assembled.system,
      prompt: notification,
    });

    for await (const event of run) {
      onEvent?.(event);
    }

    const loopResult = await run.result;

    // Persist content snapshot + notification to history (for memory extraction).
    // The notification alone is generic, but memory recall needs real content.
    const EMPTY_SNAPSHOTS = new Set(["📥 Inbox: empty", "No todos."]);
    const snapshot = trigger === "next_message" ? assembled.inboxSnapshot : assembled.todoSnapshot;
    const historyContent =
      snapshot && !EMPTY_SNAPSHOTS.has(snapshot) ? `${notification}\n\n${snapshot}` : notification;
    this.history.push({ role: "user", content: historyContent });

    const assistantText = loopResult.events
      .filter((e): e is Extract<typeof e, { type: "text" }> => e.type === "text")
      .map((e) => e.text)
      .join("");

    if (assistantText) {
      this.history.push({ role: "assistant", content: assistantText });
    }

    return { loopResult, assembled };
  }

  // ── Main loop ───────────────────────────────────────────────────────────

  /**
   * Run the full processing loop until idle or error.
   *
   * Dual-cap system:
   * - runCount resets when switching from todos to new messages
   * - totalRuns (hardCap) prevents infinite loops
   *
   * Reminder-aware: when nothing else to do but reminders are pending,
   * the loop awaits the next reminder instead of returning "idle".
   * Fired reminders inject a notification message into the inbox,
   * which naturally triggers the next run.
   */
  async processLoop(callbacks: ProcessingCallbacks): Promise<"idle" | "error"> {
    let runCount = 0;
    let totalRuns = 0;
    const hardCap = this.deps.maxRuns * 3;

    while (true) {
      if (callbacks.shouldStop?.()) return "idle";

      const decision = this.shouldContinue();
      if (decision === "idle") return "idle";
      if (totalRuns >= hardCap) return "idle";

      // ── Reminder wait: block here instead of going idle ──────────
      if (decision === "waiting_reminder") {
        const result = await this.deps.reminders.waitForNext();
        this.deps.reminders.cleanup();

        // Timeout reminders inject a notification into inbox so the
        // agent sees them on the next run. Completed reminders (e.g.
        // inbox_wait fired by a new message) don't need extra
        // notification — the triggering event is already visible.
        if (result.reason === "timeout") {
          const safeLabel = result.label
            .replace(/[\r\n]+/g, " ")
            .replace(/[\u201c\u201d""]/g, "'")
            .trim();
          const safeMsg = result.message
            ?.replace(/[\r\n]+/g, " ")
            .replace(/[\u201c\u201d""]/g, "'")
            .trim();
          this.deps.inbox.push({
            content: `⏰ Reminder timed out: [${result.id}] "${safeLabel}"${safeMsg ? ` — ${safeMsg}` : ""}`,
            from: "system",
          });
        }
        // Re-check after reminder fires
        continue;
      }

      if (runCount >= this.deps.maxRuns) {
        if (decision === "next_message") {
          // Unread messages remain — reset counter so they aren't stranded
          runCount = 0;
          continue;
        }
        // Only todos remain — go idle
        return "idle";
      }

      runCount++;
      totalRuns++;

      callbacks.onRunStart?.({ runNumber: runCount, trigger: decision });

      try {
        const { loopResult, assembled } = await this.executeRun(decision, callbacks.onEvent);

        callbacks.onContextAssembled?.(assembled);
        callbacks.onRunEnd?.(loopResult);

        // Memory extraction at checkpoint
        if (this.deps.memory?.shouldExtract("checkpoint")) {
          await this.deps.memory.extract(this.history.slice(-5), `run_${runCount}`);
        }
      } catch {
        return "error";
      }
    }
  }

  // ── Step-level context (AI SDK prepareStep) ─────────────────────────────

  async assembleForStep(opts: {
    steps: unknown[];
    stepNumber: number;
    model: unknown;
    messages: unknown[];
    experimental_context: unknown;
  }): Promise<PrepareStepResult> {
    if (opts.stepNumber === 0) return {}; // First step uses initial prompt

    const assembled = await this.deps.contextEngine.assemble({
      instructions: this.deps.instructions,
      inbox: this.deps.inbox,
      todos: this.deps.todos,
      notes: this.deps.notes,
      memory: this.deps.memory,
      reminders: this.deps.reminders,
      history: this.history,
      currentFocus: this.shouldContinue(),
      name: this.deps.name,
    });

    return { system: assembled.system };
  }
}
