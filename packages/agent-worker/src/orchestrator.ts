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
}

/**
 * Polling loop that reads from a workspace's instruction queue and
 * dispatches to an agent handler.
 *
 * Equivalent to the former WorkspaceAgentLoop, but lives in the
 * orchestration layer (agent-worker) rather than workspace.
 */
export class WorkspaceOrchestrator {
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeResolve: (() => void) | null = null;

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

  /** Start the polling loop. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    await this.config.provider.status.set(this.config.name, "running");
    await this.config.eventLog.log(this.config.name, "system", "Agent loop started");

    this.loop();
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

  /** Wake the loop immediately (interrupt poll wait). */
  wake(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.wakeResolve?.();
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
    // 1. Check inbox for new messages → enqueue as instructions
    const inboxEntries = await this.config.provider.inbox.peek(this.config.name);

    for (const entry of inboxEntries) {
      const msg = await this.config.provider.channels.getMessage(entry.channel, entry.messageId);
      if (!msg) continue;

      await this.config.provider.inbox.markSeen(this.config.name, entry.messageId);

      const existing = this.config.queue.peek(this.config.name);
      if (existing?.messageId === entry.messageId) continue;

      // Include sender and channel so the agent knows this is a channel
      // message, not a bare instruction. Prevents identity confusion
      // (e.g. agent seeing "@codex do X" and thinking it IS codex).
      const content = msg.to
        ? `DM from @${msg.from}: ${msg.content}`
        : `@${msg.from} in #${entry.channel}: ${msg.content}`;
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
    if (!instruction) return;

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
      await this.config.eventLog.log(this.config.name, "system", `Instruction failed: ${err}`);
    }

    await this.config.provider.status.set(this.config.name, "idle");
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
    });
  }

  private sleep(ms: number): Promise<void> {
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
