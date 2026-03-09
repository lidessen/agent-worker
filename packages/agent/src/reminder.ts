import type { ReminderResult } from "./types.ts";

export interface ReminderEntry {
  id: string;
  label: string;
  description?: string;
  promise: Promise<ReminderResult>;
  resolve: (result: ReminderResult) => void;
  status: "pending" | "fired";
  timeoutTimer?: ReturnType<typeof setTimeout>;
  createdAt: number;
}

let nextReminderId = 1;

/**
 * Manages async reminders that prevent the agent from going idle.
 *
 * A reminder is a pending async notification with optional timeout.
 * While reminders are pending, the processing loop waits instead of
 * returning "idle". When a reminder fires (event or timeout), the
 * loop resumes and the notification is injected into context.
 *
 * This is a general-purpose mechanism — inbox wait, background tool
 * completion, scheduled checks, etc. all use the same system.
 */
export class ReminderManager {
  private reminders = new Map<string, ReminderEntry>();
  private firedQueue: ReminderResult[] = [];

  /**
   * Register a new reminder. Returns immediately with the reminder ID.
   * The reminder stays pending until fired or timed out.
   */
  add(label: string, opts?: { timeoutMs?: number; description?: string }): { id: string } {
    const id = `reminder_${nextReminderId++}`;
    let resolveRef!: (result: ReminderResult) => void;
    const promise = new Promise<ReminderResult>((resolve) => {
      resolveRef = resolve;
    });

    const entry: ReminderEntry = {
      id,
      label,
      description: opts?.description,
      promise,
      resolve: resolveRef,
      status: "pending",
      createdAt: Date.now(),
    };

    if (opts?.timeoutMs !== undefined) {
      entry.timeoutTimer = setTimeout(() => {
        this.fire(id, "timeout");
      }, opts.timeoutMs);
    }

    this.reminders.set(id, entry);
    return { id };
  }

  /** Fire a reminder by ID. Returns false if not found or already fired. */
  fire(id: string, reason: "completed" | "timeout", message?: string): boolean {
    const r = this.reminders.get(id);
    if (!r || r.status !== "pending") return false;

    r.status = "fired";
    if (r.timeoutTimer) clearTimeout(r.timeoutTimer);

    const result: ReminderResult = {
      id: r.id,
      label: r.label,
      reason,
      message,
    };
    this.firedQueue.push(result);
    r.resolve(result);
    return true;
  }

  /** Fire all pending reminders matching a label. */
  fireByLabel(label: string, reason: "completed" | "timeout", message?: string): void {
    for (const r of this.reminders.values()) {
      if (r.label === label && r.status === "pending") {
        this.fire(r.id, reason, message);
      }
    }
  }

  /** Whether there are pending (unfired) reminders. */
  get hasPending(): boolean {
    for (const r of this.reminders.values()) {
      if (r.status === "pending") return true;
    }
    return false;
  }

  /** All pending reminders. */
  get pending(): readonly ReminderEntry[] {
    return [...this.reminders.values()].filter((r) => r.status === "pending");
  }

  /**
   * Wait for ANY pending reminder to fire.
   * Used by the processing loop when the agent has nothing else to do.
   */
  async waitForNext(): Promise<ReminderResult> {
    const pending = this.pending;
    if (pending.length === 0) throw new Error("No pending reminders");
    return Promise.race(pending.map((r) => r.promise));
  }

  /** Drain fired reminder results (consume once). */
  drainFired(): ReminderResult[] {
    const results = this.firedQueue.slice();
    this.firedQueue = [];
    return results;
  }

  /** Format pending reminders for context injection. */
  formatPending(): string {
    const pending = this.pending;
    if (pending.length === 0) return "";

    const lines = pending.map((r) => {
      const desc = r.description ? ` — ${r.description}` : "";
      const elapsed = Math.round((Date.now() - r.createdAt) / 1000);
      return `• [${r.id}] ${r.label}${desc} (${elapsed}s ago)`;
    });
    return `⏳ Pending reminders (${pending.length}):\n${lines.join("\n")}`;
  }

  /** Cancel all pending reminders and clean up timers. */
  cancelAll(): void {
    for (const r of this.reminders.values()) {
      if (r.timeoutTimer) clearTimeout(r.timeoutTimer);
    }
    this.reminders.clear();
    this.firedQueue = [];
  }

  /** Remove fired entries to free memory. */
  cleanup(): void {
    for (const [id, r] of this.reminders) {
      if (r.status === "fired") this.reminders.delete(id);
    }
  }
}
