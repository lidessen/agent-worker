import type {
  Instruction,
  Priority,
  QueueConfig,
  InstructionQueueInterface,
} from "@agent-worker/harness";

const PRIORITY_ORDER: Priority[] = ["immediate", "normal", "background"];

export class InstructionQueue implements InstructionQueueInterface {
  private lanes: Record<Priority, Instruction[]> = {
    immediate: [],
    normal: [],
    background: [],
  };

  /** Track consecutive dispatches per priority for bandwidth policy. */
  private consecutiveImmediate = 0;
  private consecutiveHighPriority = 0;

  private readonly immediateQuota: number;
  private readonly normalQuota: number;
  private readonly maxBackgroundWait: number;
  private readonly maxPreemptions: number;
  private readonly backgroundTtl: number;
  private readonly maxSize: number;

  constructor(config: QueueConfig = {}) {
    this.immediateQuota = config.immediateQuota ?? 4;
    this.normalQuota = config.normalQuota ?? 8;
    this.maxBackgroundWait = config.maxBackgroundWait ?? 5 * 60 * 1000;
    this.maxPreemptions = config.maxPreemptions ?? 3;
    this.backgroundTtl = config.backgroundTtl ?? 5 * 60 * 1000;
    this.maxSize = config.maxSize ?? 200;
  }

  enqueue(instruction: Instruction): void {
    if (this.size >= this.maxSize) {
      if (this.lanes.background.length > 0) {
        this.lanes.background.shift();
      } else {
        return;
      }
    }
    this.lanes[instruction.priority].push(instruction);
  }

  dequeue(agentName: string): Instruction | null {
    this.pruneExpired();
    this.promoteStarved();

    const forcedLane = this.getForcedLane();
    if (forcedLane) {
      const instruction = this.dequeueFromLane(forcedLane, agentName);
      if (instruction) {
        this.updateCounters(forcedLane);
        return instruction;
      }
    }

    for (const priority of PRIORITY_ORDER) {
      const instruction = this.dequeueFromLane(priority, agentName);
      if (instruction) {
        this.updateCounters(priority);
        return instruction;
      }
    }

    return null;
  }

  peek(agentName: string): Instruction | null {
    for (const priority of PRIORITY_ORDER) {
      const lane = this.lanes[priority];
      const instruction = lane.find((i) => i.agentName === agentName);
      if (instruction) return instruction;
    }
    return null;
  }

  shouldYield(agentName: string): boolean {
    const immediate = this.lanes.immediate.find((i) => i.agentName === agentName);
    return !!immediate;
  }

  get size(): number {
    return this.lanes.immediate.length + this.lanes.normal.length + this.lanes.background.length;
  }

  listAll(): Instruction[] {
    return [...this.lanes.immediate, ...this.lanes.normal, ...this.lanes.background];
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private dequeueFromLane(priority: Priority, agentName: string): Instruction | null {
    const lane = this.lanes[priority];
    const idx = lane.findIndex((i) => i.agentName === agentName);
    if (idx === -1) return null;
    return lane.splice(idx, 1)[0] ?? null;
  }

  private getForcedLane(): Priority | null {
    if (this.consecutiveImmediate >= this.immediateQuota && this.lanes.normal.length > 0) {
      return "normal";
    }

    if (this.consecutiveHighPriority >= this.normalQuota && this.lanes.background.length > 0) {
      return "background";
    }

    return null;
  }

  private updateCounters(dispatched: Priority): void {
    if (dispatched === "immediate") {
      this.consecutiveImmediate++;
      this.consecutiveHighPriority++;
    } else if (dispatched === "normal") {
      this.consecutiveImmediate = 0;
      this.consecutiveHighPriority++;
    } else {
      this.consecutiveImmediate = 0;
      this.consecutiveHighPriority = 0;
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    this.lanes.background = this.lanes.background.filter((instr) => {
      return now - new Date(instr.enqueuedAt).getTime() <= this.backgroundTtl;
    });
  }

  private promoteStarved(): void {
    const now = Date.now();
    const toPromote: number[] = [];

    for (let i = 0; i < this.lanes.background.length; i++) {
      const instr = this.lanes.background[i]!;
      const waitTime = now - new Date(instr.enqueuedAt).getTime();

      if (
        waitTime > this.maxBackgroundWait ||
        (instr.preemptionCount ?? 0) >= this.maxPreemptions
      ) {
        toPromote.push(i);
      }
    }

    for (let i = toPromote.length - 1; i >= 0; i--) {
      const idx = toPromote[i]!;
      const [instr] = this.lanes.background.splice(idx, 1);
      instr!.priority = "normal";
      this.lanes.normal.push(instr!);
    }
  }
}
