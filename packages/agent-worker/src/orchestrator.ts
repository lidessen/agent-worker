/**
 * Orchestrator — polling loop that dequeues instructions from a workspace
 * and dispatches them to an agent loop.
 *
 * This was previously WorkspaceAgentLoop inside @agent-worker/workspace.
 * Moved here because it's orchestration logic (connecting workspace + agent),
 * not workspace infrastructure.
 */
import type {
  ContextProvider,
  InstructionQueueInterface,
  Instruction,
  InboxEntry,
  EventLog,
  Priority,
  PromptSection,
} from "@agent-worker/workspace";
import { assemblePrompt, BASE_SECTIONS, nanoid } from "@agent-worker/workspace";

export interface OrchestratorConfig {
  name: string;
  instructions?: string;
  provider: ContextProvider;
  queue: InstructionQueueInterface;
  eventLog: EventLog;
  /** Polling interval in ms. Default: 5000 */
  pollInterval?: number;
  /** Extra prompt sections (from capabilities). Appended after BASE_SECTIONS. */
  promptSections?: PromptSection[];
  /** Handler called with assembled prompt; returns when done. */
  onInstruction: (prompt: string, instruction: Instruction) => Promise<void>;
  /** Agent's personal sandbox directory. */
  sandboxDir?: string;
  /** Shared workspace sandbox directory (visible to all agents). */
  workspaceSandboxDir?: string;
  /** Whether this agent is on_demand (started only via @mention, not at startup). */
  onDemand?: boolean;
}

/**
 * Polling loop that reads from a workspace's instruction queue and
 * dispatches to an agent handler.
 *
 * Equivalent to the former WorkspaceAgentLoop, but lives in the
 * orchestration layer (agent-worker) rather than workspace.
 */
/** Default backoff for quota/rate-limit auto-pause: 5 minutes. */
const DEFAULT_QUOTA_BACKOFF_MS = 5 * 60_000;
/** Maximum backoff: 1 hour. */
const MAX_BACKOFF_MS = 60 * 60_000;
/**
 * Grace window after startup (ms). On first tick, if inbox is empty we wait
 * up to this long for an inbox entry before going idle. Fixes on_demand agents
 * that start while message routing is still in-flight (routing is fire-and-forget).
 */
const STARTUP_GRACE_MS = 300;

export class WorkspaceOrchestrator {
  private running = false;
  private paused = false;
  private failed = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeResolve: (() => void) | null = null;

  /** When set, auto-resume at this timestamp. */
  private resumeAt: number | null = null;
  /** Current backoff duration for exponential backoff on repeated failures. */
  private backoffMs = DEFAULT_QUOTA_BACKOFF_MS;
  /** Timestamp of last start() call — used for startup grace window. */
  private startedAt = 0;
  /**
   * True when wake() was called while not in sleep() (e.g. during tick()).
   * Consumed by the next sleep() call to return immediately.
   */
  private pendingWake = false;

  private readonly pollInterval: number;
  private readonly sections: PromptSection[];

  constructor(private readonly config: OrchestratorConfig) {
    this.pollInterval = config.pollInterval ?? 5000;
    const extra = config.promptSections ?? [];
    this.sections = [...BASE_SECTIONS, ...extra];
  }

  get name(): string {
    return this.config.name;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** True if this loop was stopped due to a fatal (non-recoverable) error. */
  get isFailed(): boolean {
    return this.failed;
  }

  /** Start the polling loop. Respects persisted pause state across restarts. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();

    // A new loop start defines a fresh run epoch: retry any inbox entries that
    // were seen but never acked by a previous run.
    await this.config.provider.inbox.markRunStart(this.config.name);

    // Check if this agent was paused before restart
    const allStatus = await this.config.provider.status.getAll();
    const prevStatus = allStatus.find((s) => s.name === this.config.name)?.status;
    if (prevStatus === "paused") {
      this.paused = true;
      await this.config.eventLog.log(
        this.config.name,
        "system",
        "Agent loop started (paused — was paused before restart)",
      );
    } else {
      await this.config.provider.status.set(this.config.name, "running");
      await this.config.eventLog.log(this.config.name, "system", "Agent loop started");
    }

    this.loop();
  }

  /** Pause the orchestrator — tick() becomes a no-op but polling continues. */
  async pause(): Promise<void> {
    this.paused = true;
    this.resumeAt = null;
    await this.config.provider.status.set(this.config.name, "paused");
    await this.config.eventLog.log(this.config.name, "system", "Agent loop paused");
  }

  /**
   * Pause with timed auto-resume. Uses exponential backoff on repeated calls:
   * first pause = backoffMs, second = 2x, etc. up to MAX_BACKOFF_MS.
   * Manual resume() resets the backoff.
   */
  async pauseUntil(ms?: number): Promise<void> {
    const delay = ms ?? this.backoffMs;
    this.paused = true;
    this.resumeAt = Date.now() + delay;
    // Only advance backoff when no explicit wait time was provided
    if (ms === undefined) {
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    }
    const mins = Math.round(delay / 60_000);
    await this.config.provider.status.set(this.config.name, "paused", `auto-resume in ~${mins}m`);
    await this.config.eventLog.log(
      this.config.name,
      "system",
      `Agent loop paused (auto-resume in ${mins}m)`,
    );
  }

  /** Resume the orchestrator after a pause. Resets backoff. */
  async resume(): Promise<void> {
    this.paused = false;
    this.resumeAt = null;
    this.backoffMs = DEFAULT_QUOTA_BACKOFF_MS;
    await this.config.provider.status.set(this.config.name, "running");
    await this.config.eventLog.log(this.config.name, "system", "Agent loop resumed");
    this.wake();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Stop the polling loop. */
  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.wakeResolve?.();

    await this.config.provider.status.set(this.config.name, "stopped");
    await this.config.eventLog.log(this.config.name, "system", "Agent loop stopped");
  }

  /**
   * Stop the loop due to a fatal (non-recoverable) error.
   * Sets `isFailed = true` so `checkCompletion()` can report "failed".
   */
  async fail(reason: string): Promise<void> {
    this.failed = true;
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.wakeResolve?.();

    await this.config.provider.status.set(this.config.name, "stopped", `fatal: ${reason}`);
    await this.config.eventLog.log(
      this.config.name,
      "system",
      `Agent loop failed (fatal): ${reason}`,
    );
  }

  /** Wake the loop immediately (interrupt poll wait). */
  wake(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.wakeResolve) {
      this.wakeResolve();
      this.wakeResolve = null;
    } else {
      // Called during tick() when there's no active sleep — mark pending so
      // the next sleep() returns immediately instead of losing this signal.
      this.pendingWake = true;
    }
  }

  /** Send a direct instruction (bypasses poll, synchronous). */
  async sendDirect(content: string, priority: Priority = "immediate"): Promise<void> {
    const instruction: Instruction = {
      id: nanoid(),
      agentName: this.config.name,
      messageId: "",
      channel: "",
      content,
      priority,
      enqueuedAt: new Date().toISOString(),
    };

    const prompt = await this.buildPrompt([], instruction);
    await this.config.onInstruction(prompt, instruction);
  }

  /** Enqueue an instruction with explicit priority. */
  async enqueue(content: string, priority: Priority, messageId = "", channel = ""): Promise<void> {
    const instruction: Instruction = {
      id: nanoid(),
      agentName: this.config.name,
      messageId,
      channel,
      content,
      priority,
      enqueuedAt: new Date().toISOString(),
    };
    this.config.queue.enqueue(instruction);
    this.wake();
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        await this.config.eventLog.log(this.config.name, "system", `Loop error: ${err}`);
      }

      if (!this.running) break;
      await this.sleep(this.pollInterval);
    }
  }

  private async tick(): Promise<void> {
    // Check timed auto-resume
    if (this.paused && this.resumeAt && Date.now() >= this.resumeAt) {
      // resume() already logs "Agent loop resumed"
      await this.resume();
    }
    if (this.paused) return;

    // 1. Check inbox for new messages → enqueue as instructions
    const inboxEntries = await this.config.provider.inbox.peek(this.config.name);

    for (const entry of inboxEntries) {
      await this.config.provider.inbox.markSeen(this.config.name, entry.messageId);

      const existing = this.config.queue.peek(this.config.name);
      if (existing?.messageId === entry.messageId) continue;

      // Notification-only content — agent uses channel_read to get full message.
      const preview = entry.preview.length >= 100 ? `${entry.preview}…` : entry.preview;
      const content = `@${entry.from} in #${entry.channel}: "${preview}" — use channel_read for full message`;
      const instruction: Instruction = {
        id: nanoid(),
        agentName: this.config.name,
        messageId: entry.messageId,
        channel: entry.channel,
        content,
        priority: entry.priority,
        enqueuedAt: entry.enqueuedAt,
      };
      this.config.queue.enqueue(instruction);
    }

    // 2. Dequeue and process next instruction
    const instruction = this.config.queue.dequeue(this.config.name);
    if (!instruction) {
      // Startup grace: inbox routing is fire-and-forget async, so on_demand
      // agents may arrive here before their triggering mention has been enqueued.
      // Within the grace window, wait for an inbox entry instead of going idle.
      // Only on_demand agents need this — persistent agents start at daemon launch
      // with no in-flight messages.
      const elapsed = Date.now() - this.startedAt;
      if (this.config.onDemand && elapsed < STARTUP_GRACE_MS) {
        await Promise.race([
          this.config.provider.inbox.onNewEntry(this.config.name),
          new Promise<void>((r) => setTimeout(r, STARTUP_GRACE_MS - elapsed)),
        ]);
        this.wake(); // Skip poll sleep so the next tick runs immediately
        return;
      }
      // No work to do — ensure status reflects idle (not stuck on "running")
      await this.config.provider.status.set(this.config.name, "idle");
      return;
    }

    await this.config.provider.status.set(
      this.config.name,
      "running",
      instruction.content.slice(0, 100),
    );

    // 3. Build prompt
    const currentInbox = await this.config.provider.inbox.peek(this.config.name);
    const prompt = await this.buildPrompt(currentInbox, instruction);

    // 4. Execute
    try {
      await this.config.onInstruction(prompt, instruction);

      if (instruction.messageId) {
        await this.config.provider.inbox.ack(this.config.name, instruction.messageId);
      }
    } catch (err) {
      if (instruction.messageId) {
        await this.config.provider.inbox.defer(this.config.name, instruction.messageId);
      }
      await this.config.eventLog.log(this.config.name, "system", `Instruction failed: ${err}`);
    }

    const currentStatus = this.config.provider.status.getCached(this.config.name)?.status;
    if (this.running && !this.paused && currentStatus === "running") {
      await this.config.provider.status.set(this.config.name, "idle");
    }
  }

  private async buildPrompt(
    inboxEntries: InboxEntry[],
    instruction?: Instruction,
  ): Promise<string> {
    return assemblePrompt(this.sections, {
      agentName: this.config.name,
      instructions: this.config.instructions,
      provider: this.config.provider,
      inboxEntries,
      currentInstruction: instruction?.content,
      currentPriority: instruction?.priority,
      currentMessageId: instruction?.messageId || undefined,
      currentChannel: instruction?.channel || undefined,
      sandboxDir: this.config.sandboxDir,
      workspaceSandboxDir: this.config.workspaceSandboxDir,
    });
  }

  private sleep(ms: number): Promise<void> {
    if (this.pendingWake) {
      this.pendingWake = false;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.wakeResolve = resolve;
      this.pollTimer = setTimeout(() => {
        this.wakeResolve = null;
        resolve();
      }, ms);
    });
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

/** Create a WorkspaceOrchestrator (replaces createWiredLoop). */
export function createOrchestrator(config: OrchestratorConfig): WorkspaceOrchestrator {
  return new WorkspaceOrchestrator(config);
}
