import type {
  ContextProvider,
  InstructionQueueInterface,
  Instruction,
  InboxEntry,
  EventLog,
  Priority,
} from "../types.ts";
import { assemblePrompt, BASE_SECTIONS, type PromptSection } from "./prompt.ts";

export interface AgentLoopConfig {
  name: string;
  instructions?: string;
  provider: ContextProvider;
  queue: InstructionQueueInterface;
  eventLog: EventLog;
  /** Polling interval in ms. Default: 5000 */
  pollInterval?: number;
  /** Extra prompt sections (from capabilities). Appended after BASE_SECTIONS. */
  sections?: PromptSection[];
  /** Handler called with assembled prompt; returns when done. */
  onInstruction: (prompt: string, instruction: Instruction) => Promise<void>;
}

export class WorkspaceAgentLoop {
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeResolve: (() => void) | null = null;

  private readonly pollInterval: number;
  private readonly sections: PromptSection[];

  constructor(private readonly config: AgentLoopConfig) {
    this.pollInterval = config.pollInterval ?? 5000;
    // Base sections first (soul/instructions), then capability-injected sections.
    const extra = config.sections ?? [];
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
    // Wake any sleeping poll
    this.wakeResolve?.();

    await this.config.provider.status.set(this.config.name, "stopped");
    await this.config.eventLog.log(this.config.name, "system", "Agent loop stopped");
  }

  /** Wake the loop immediately (interrupt poll wait). */
  wake(): void {
    this.wakeResolve?.();
  }

  /** Send a direct instruction (bypasses poll, synchronous). */
  async sendDirect(content: string, priority: Priority = "immediate"): Promise<void> {
    const { nanoid } = await import("../utils.ts");
    const instruction: Instruction = {
      id: nanoid(),
      agentName: this.config.name,
      messageId: "",
      channel: "",
      content,
      priority,
      enqueuedAt: new Date().toISOString(),
    };

    const prompt = await this.buildPrompt([], content);
    await this.config.onInstruction(prompt, instruction);
  }

  /** Enqueue an instruction with explicit priority. */
  async enqueue(content: string, priority: Priority, messageId = "", channel = ""): Promise<void> {
    const { nanoid } = await import("../utils.ts");
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

      // Wait for poll interval or wake signal
      await this.sleep(this.pollInterval);
    }
  }

  private async tick(): Promise<void> {
    // 1. Check inbox for new messages → enqueue as instructions
    const inboxEntries = await this.config.provider.inbox.peek(this.config.name);

    for (const entry of inboxEntries) {
      // Resolve message content
      const msg = await this.config.provider.channels.getMessage(entry.channel, entry.messageId);
      if (!msg) continue;

      // Mark as seen
      await this.config.provider.inbox.markSeen(this.config.name, entry.messageId);

      // Create instruction from inbox entry (if not already queued)
      const existing = this.config.queue.peek(this.config.name);
      if (existing?.messageId === entry.messageId) continue;

      const { nanoid } = await import("../utils.ts");
      const instruction: Instruction = {
        id: nanoid(),
        agentName: this.config.name,
        messageId: entry.messageId,
        channel: entry.channel,
        content: msg.content,
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
    const prompt = await this.buildPrompt(currentInbox, instruction.content, instruction.priority);

    // 4. Execute
    try {
      await this.config.onInstruction(prompt, instruction);

      // 5. Ack inbox entry
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
    currentInstruction?: string,
    currentPriority?: string,
  ): Promise<string> {
    return assemblePrompt(this.sections, {
      agentName: this.config.name,
      instructions: this.config.instructions,
      provider: this.config.provider,
      inboxEntries,
      currentInstruction,
      currentPriority,
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
