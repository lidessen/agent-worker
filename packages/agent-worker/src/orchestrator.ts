/**
 * Orchestrator — polling loop that dequeues instructions from a harness
 * and dispatches them to an agent loop.
 *
 * This was previously HarnessAgentLoop inside @agent-worker/harness.
 * Moved here because it's orchestration logic (connecting harness + agent),
 * not harness infrastructure.
 */
import type {
  ContextProvider,
  InstructionQueueInterface,
  Instruction,
  InboxEntry,
  EventLog,
  Priority,
  PromptSection,
  HarnessStateStore,
  AgentRole,
} from "@agent-worker/harness";
import { assemblePrompt, nanoid, soulSection } from "@agent-worker/harness";
import { COORDINATION_BASE_SECTIONS } from "@agent-worker/harness-coordination";

/**
 * Lightweight checkpoint hook shape used by the orchestrator. Intentionally
 * a subset of @agent-worker/agent's AgentLifecycleHooks so the harness's
 * buildLeadHooks can plug in without a cross-package dependency.
 */
export type OrchestratorCheckpointReason = "run_start" | "run_end";
export type OrchestratorCheckpointAction = { kind: "noop" } | { kind: "inject"; content: string };
export type OrchestratorCheckpointHook = (ctx: {
  reason: OrchestratorCheckpointReason;
  runNumber: number;
}) => Promise<OrchestratorCheckpointAction | void> | OrchestratorCheckpointAction | void;

export interface OrchestratorConfig {
  name: string;
  instructions?: string;
  provider: ContextProvider;
  queue: InstructionQueueInterface;
  eventLog: EventLog;
  /** Polling interval in ms. Default: 5000 */
  pollInterval?: number;
  /** Extra prompt sections (from capabilities). Appended after COORDINATION_BASE_SECTIONS. */
  promptSections?: PromptSection[];
  /** Handler called with assembled prompt; returns when done. */
  onInstruction: (prompt: string, instruction: Instruction) => Promise<void>;
  /** Agent's personal sandbox directory. */
  sandboxDir?: string;
  /** Shared harness sandbox directory (visible to all agents). */
  harnessSandboxDir?: string;
  /** Whether this agent is on_demand (started only via @mention, not at startup). */
  onDemand?: boolean;
  /** Kernel state store — exposed to the lead prompt section. */
  stateStore?: HarnessStateStore;
  /** Resolved role used by prompt sections (e.g. to show the task ledger to the lead). */
  role?: AgentRole;
  /** Harness name — passed into PromptContext as harnessName. */
  harnessName?: string;
  /**
   * Optional onCheckpoint hook. Fires at the start and end of each
   * instruction dispatch. Returning `{kind:"inject", content}` at run_start
   * prepends the content to the prompt; returning it at run_end pushes the
   * content onto the agent's inbox as a system message so the next run
   * picks it up.
   */
  onCheckpoint?: OrchestratorCheckpointHook;
}

/**
 * Polling loop that reads from a harness's instruction queue and
 * dispatches to an agent handler.
 *
 * Equivalent to the former HarnessAgentLoop, but lives in the
 * orchestration layer (agent-worker) rather than harness.
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

export class HarnessOrchestrator {
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
  /** Monotonic counter of instructions dispatched — used as onCheckpoint runNumber. */
  private runCounter = 0;

  constructor(private readonly config: OrchestratorConfig) {
    this.pollInterval = config.pollInterval ?? 5000;
    const extra = config.promptSections ?? [];
    this.sections = [soulSection, ...COORDINATION_BASE_SECTIONS, ...extra];
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

    // 3. Build prompt + fire run_start checkpoint hook
    const currentInbox = await this.config.provider.inbox.peek(this.config.name);
    const basePrompt = await this.buildPrompt(currentInbox, instruction);
    this.runCounter++;
    const runNumber = this.runCounter;
    const prologue = await this.fireCheckpoint("run_start", runNumber);
    const prompt = prologue ? `${prologue}\n\n${basePrompt}` : basePrompt;

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

    // 5. Fire run_end checkpoint hook — inject routes to the inbox as a
    //    system message so the next tick picks it up.
    await this.fireCheckpoint("run_end", runNumber);

    const currentStatus = this.config.provider.status.getCached(this.config.name)?.status;
    if (this.running && !this.paused && currentStatus === "running") {
      await this.config.provider.status.set(this.config.name, "idle");
    }
  }

  /**
   * Call onCheckpoint if configured and dispatch any inject action.
   * Returns the inject content when reason==="run_start" so the caller can
   * prepend it to the run's prompt. At run_end the content is pushed to the
   * inbox instead.
   *
   * Throws from the hook are swallowed and logged to the event log.
   */
  private async fireCheckpoint(
    reason: OrchestratorCheckpointReason,
    runNumber: number,
  ): Promise<string | null> {
    const hook = this.config.onCheckpoint;
    if (!hook) return null;

    let action: OrchestratorCheckpointAction | void;
    try {
      action = await hook({ reason, runNumber });
    } catch (err) {
      await this.config.eventLog.log(
        this.config.name,
        "system",
        `onCheckpoint hook threw at ${reason}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }

    if (!action || action.kind === "noop") return null;

    if (action.kind === "inject") {
      if (reason === "run_start") {
        return action.content;
      }
      // run_end: enqueue a synthetic instruction so the next tick picks it
      // up alongside any real work. Using the instruction queue (not the
      // inbox) is the correct path because the instruction queue is what
      // tick() actually drains; the inbox is only a read surface here.
      try {
        this.config.queue.enqueue({
          id: nanoid(),
          agentName: this.config.name,
          messageId: `checkpoint:${runNumber}:${Date.now()}`,
          channel: "system",
          content: action.content,
          priority: "normal",
          enqueuedAt: new Date().toISOString(),
        });
      } catch (err) {
        await this.config.eventLog.log(
          this.config.name,
          "system",
          `onCheckpoint inject enqueue failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return null;
  }

  private async buildPrompt(
    inboxEntries: InboxEntry[],
    instruction?: Instruction,
  ): Promise<string> {
    // Surface the agent's active Wake's worktrees (if any) so the
    // prompt's "Worktrees" section can render them. The runner closure
    // also reads this to pick the per-run cwd, but we re-query here so
    // the prompt and the runner see exactly the same state.
    let worktrees: import("@agent-worker/harness").Worktree[] | undefined;
    if (this.config.stateStore) {
      try {
        const active = await this.config.stateStore.findActiveWake(this.config.name);
        if (active?.worktrees && active.worktrees.length > 0) {
          worktrees = [...active.worktrees];
        }
      } catch {
        // best-effort; missing worktrees just means the prompt has no
        // Worktrees section this run.
      }
    }
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
      harnessSandboxDir: this.config.harnessSandboxDir,
      worktrees,
      stateStore: this.config.stateStore,
      role: this.config.role,
      harnessName: this.config.harnessName,
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

/** Create a HarnessOrchestrator (replaces createWiredLoop). */
export function createOrchestrator(config: OrchestratorConfig): HarnessOrchestrator {
  return new HarnessOrchestrator(config);
}
