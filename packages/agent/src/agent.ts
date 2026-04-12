import type {
  AgentConfig,
  AgentLifecycleHooks,
  AgentState,
  AgentEvents,
  ContextThresholds,
  InboxMessage,
  Message,
  NotesStorage,
  PressureAction,
  PressureLevel,
  TodoItem,
  Turn,
  UsageSnapshot,
} from "./types.ts";
import type { AgentRuntimeEvent, EventBus } from "@agent-worker/shared";
import { Inbox } from "./inbox.ts";
import { TodoManager } from "./todo.ts";
import { InMemoryNotesStorage } from "./notes.ts";
import { SendGuard } from "./send.ts";
import { ContextEngine } from "./context-engine.ts";
import { MemoryManager } from "./memory.ts";
import { ReminderManager } from "./reminder.ts";
import { RunCoordinator } from "./run-coordinator.ts";
import { LoopWiring } from "./bridge/wiring.ts";

type EventName = keyof AgentEvents;
type EventHandler<K extends EventName> = AgentEvents[K];

/**
 * Agent owns lifecycle (state machine, events) and subsystem creation.
 *
 * Processing loop → RunCoordinator
 * Loop capability wiring → LoopWiring
 */
export class Agent {
  private _state: AgentState = "idle";
  private readonly config: AgentConfig;
  private readonly inbox: Inbox;
  private readonly todoManager: TodoManager;
  private readonly notesStorage: NotesStorage;
  private readonly sendGuard: SendGuard;
  private readonly reminders: ReminderManager;
  private readonly coordinator: RunCoordinator;
  private readonly wiring: LoopWiring;
  private readonly bus?: EventBus;
  private readonly agentName: string;

  private listeners = new Map<EventName, Set<Function>>();
  private processingPromise: Promise<void> | null = null;
  private interruptTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingInterruptSource: "channel" | "reminder" | "todo" | null = null;
  private pendingInterruptReason: string | null = null;

  private readonly lifecycleHooks: AgentLifecycleHooks;
  private readonly contextThresholds: Required<Pick<ContextThresholds, "softRatio" | "hardRatio">> &
    ContextThresholds;
  private pendingGracefulStop = false;
  private pressureFiredThisRun = new Set<PressureLevel>();
  private currentRunNumber = 0;
  private _lastUsage: UsageSnapshot | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.bus = config.bus;
    this.agentName = config.name ?? "agent";
    this.lifecycleHooks = config.hooks ?? {};
    this.contextThresholds = {
      softRatio: 0.7,
      hardRatio: 0.9,
      ...config.contextThresholds,
    };

    // Subsystems
    this.inbox = new Inbox(config.inbox, () => this.onWake());
    this.todoManager = new TodoManager();
    this.notesStorage = config.notesStorage ?? new InMemoryNotesStorage();
    const contextEngine = new ContextEngine(config.context);
    const memoryManager = config.memory ? new MemoryManager(config.memory) : null;
    this.reminders = new ReminderManager();
    this.sendGuard = new SendGuard(this.inbox, (target, content) => {
      this.emit("send", target, content);
    });

    // Wire inbox ↔ reminders
    this.inbox.setReminders(this.reminders);
    this.inbox.setOnMessage((msg) => {
      this.emit("messageReceived", msg);
      if (this._state === "processing") {
        this.scheduleWorkspaceInterrupt(
          classifyInboxNotification(msg),
          `New workspace notification: ${msg.id}`,
        );
      }
    });
    this.todoManager.setOnChange(() => {
      if (this._state === "processing" && this.todoManager.pending.length > 0) {
        this.scheduleWorkspaceInterrupt("todo", "Todo state changed while processing");
      }
    });

    // RunCoordinator owns the processing loop and history
    this.coordinator = new RunCoordinator({
      loop: config.loop,
      inbox: this.inbox,
      todos: this.todoManager,
      notes: this.notesStorage,
      contextEngine,
      memory: memoryManager,
      reminders: this.reminders,
      instructions: config.instructions ?? "",
      maxRuns: config.maxRuns ?? 10,
      name: config.name,
    });

    // LoopWiring handles capability detection, tool injection, CLI bridge
    this.wiring = new LoopWiring({
      loop: config.loop,
      inbox: this.inbox,
      todos: this.todoManager,
      notes: this.notesStorage,
      memory: memoryManager,
      sendGuard: this.sendGuard,
      reminders: this.reminders,
      coordinator: this.coordinator,
      toolkit: config.toolkit,
      runtimeHooks: config.runtimeHooks,
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.wiring.init();
  }

  async stop(): Promise<void> {
    this.setState("stopped");
    if (this.interruptTimer) {
      clearTimeout(this.interruptTimer);
      this.interruptTimer = null;
    }
    this.config.loop.cancel();
    this.inbox.cancelDebounce();
    this.reminders.cancelAll();
    await this.wiring.stop();
    await this.config.loop.cleanup?.();
  }

  // ── Messaging ──────────────────────────────────────────────────────────

  push(message: string | Message): void {
    if (this._state === "stopped") {
      throw new Error("Agent is stopped");
    }

    this.inbox.push(message);

    if (this._state === "processing") {
      this.inbox.cancelDebounce();
    }
  }

  // ── State ──────────────────────────────────────────────────────────────

  get state(): AgentState {
    return this._state;
  }

  get inboxMessages(): readonly InboxMessage[] {
    return this.inbox.all;
  }

  get todos(): readonly TodoItem[] {
    return this.todoManager.list();
  }

  get context(): readonly Turn[] {
    return this.coordinator.history;
  }

  get notes(): NotesStorage {
    return this.notesStorage;
  }

  /** Most recent usage snapshot reported by the loop, if any. */
  get lastUsage(): UsageSnapshot | null {
    return this._lastUsage;
  }

  // ── Events ─────────────────────────────────────────────────────────────

  on<K extends EventName>(event: K, fn: EventHandler<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  off<K extends EventName>(event: K, fn: EventHandler<K>): void {
    this.listeners.get(event)?.delete(fn);
  }

  private emit<K extends EventName>(event: K, ...args: Parameters<EventHandler<K>>): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const fn of handlers) {
      (fn as Function)(...args);
    }
  }

  // ── Bus (structured events) ───────────────────────────────────────────

  /** Emit a structured event to the shared bus, if one is configured. */
  private busEmit(type: string, data?: Record<string, unknown>): void {
    this.bus?.emit({ type, source: "agent", agent: this.agentName, ...data });
  }

  private busEmitRuntimeEvent(
    event: Omit<AgentRuntimeEvent, "ts" | "type" | "source" | "agent">,
  ): void {
    this.bus?.emit({
      type: "agent.runtime_event",
      source: "agent",
      agent: this.agentName,
      ...event,
    });
  }

  // ── Context pressure ───────────────────────────────────────────────────

  private classifyPressure(usage: UsageSnapshot): PressureLevel | null {
    const { softTokens, hardTokens, softRatio, hardRatio } = this.contextThresholds;
    if (hardTokens != null && usage.totalTokens >= hardTokens) return "hard";
    if (
      hardRatio != null &&
      usage.usedRatio != null &&
      usage.usedRatio >= hardRatio &&
      usage.contextWindow != null
    ) {
      return "hard";
    }
    if (softTokens != null && usage.totalTokens >= softTokens) return "soft";
    if (
      softRatio != null &&
      usage.usedRatio != null &&
      usage.usedRatio >= softRatio &&
      usage.contextWindow != null
    ) {
      return "soft";
    }
    return null;
  }

  private async maybeFirePressure(usage: UsageSnapshot, runId: string): Promise<void> {
    const highest = this.classifyPressure(usage);
    if (!highest) return;

    // If we jumped straight to hard without firing soft yet, fire soft first so
    // hooks always see the ordered escalation path.
    const toFire: PressureLevel[] = [];
    if (!this.pressureFiredThisRun.has("soft") && (highest === "soft" || highest === "hard")) {
      toFire.push("soft");
    }
    if (highest === "hard" && !this.pressureFiredThisRun.has("hard")) {
      toFire.push("hard");
    }
    if (toFire.length === 0) return;

    for (const level of toFire) {
      this.pressureFiredThisRun.add(level);

      this.busEmit("agent.context_pressure", {
        runId,
        level,
        totalTokens: usage.totalTokens,
        contextWindow: usage.contextWindow,
        usedRatio: usage.usedRatio,
      });

      const hook = this.lifecycleHooks.onContextPressure;
      if (!hook) continue;

      let action: PressureAction;
      try {
        action = await hook({
          level,
          usage,
          runNumber: this.currentRunNumber,
        });
      } catch (err) {
        this.busEmit("agent.error", {
          runId,
          error: `onContextPressure hook threw: ${err instanceof Error ? err.message : String(err)}`,
          level: "error",
        });
        continue;
      }

      switch (action.kind) {
        case "continue":
          break;
        case "end":
          this.pendingGracefulStop = true;
          this.busEmit("agent.graceful_stop_requested", {
            runId,
            reason: "context_pressure",
            level,
            summary: action.summary,
          });
          break;
        default: {
          // Exhaustiveness guard: forces future PressureAction variants
          // (e.g. "compact") to be handled explicitly instead of silently
          // falling through as "continue".
          const _exhaustive: never = action;
          void _exhaustive;
          this.busEmit("agent.error", {
            runId,
            error: `Unhandled PressureAction kind: ${(action as { kind: string }).kind}`,
            level: "error",
          });
        }
      }
    }
  }

  // ── Internal: state machine ────────────────────────────────────────────

  private setState(state: AgentState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit("stateChange", state);
    this.busEmit("agent.state_change", { state });
  }

  private onWake(): void {
    if (this._state !== "idle") return;
    this.setState("waiting");
    this.startProcessing();
  }

  private startProcessing(): void {
    if (this._state === "stopped") return;
    this.setState("processing");

    // Generate a correlation ID for this processing cycle
    const runId = crypto.randomUUID();
    this.pendingGracefulStop = false;

    this.processingPromise = this.coordinator
      .processLoop({
        onRunStart: (info) => {
          this.currentRunNumber = info.runNumber;
          this.pressureFiredThisRun.clear();
          this.emit("runStart", info);
          this.busEmit("agent.run_start", {
            runId,
            runNumber: info.runNumber,
            trigger: info.trigger,
          });
        },
        onRunEnd: (result) => {
          this.emit("runEnd", result);
          this.busEmit("agent.run_end", {
            runId,
            tokens: result.usage.totalTokens,
            durationMs: result.durationMs,
          });
        },
        onEvent: async (event) => {
          this.emit("event", event);
          // Forward loop events to bus with structured types
          if (event.type === "text") {
            this.busEmit("agent.text", { runId, text: event.text });
          } else if (event.type === "tool_call_start") {
            this.busEmitRuntimeEvent({
              runId,
              eventKind: "tool",
              phase: "start",
              name: event.name,
              callId: event.callId,
              args: event.args,
            });
            this.busEmit("agent.tool_call", {
              runId,
              tool: event.name,
              callId: event.callId,
              args: event.args,
            });
          } else if (event.type === "tool_call_end") {
            this.busEmitRuntimeEvent({
              runId,
              eventKind: "tool",
              phase: "end",
              name: event.name,
              callId: event.callId,
              durationMs: event.durationMs,
              error: event.error,
              result: event.result,
            });
            this.busEmit("agent.tool_result", {
              runId,
              tool: event.name,
              callId: event.callId,
              durationMs: event.durationMs,
              error: event.error,
            });
          } else if (event.type === "hook") {
            this.busEmitRuntimeEvent({
              runId,
              eventKind: "hook",
              phase: event.phase,
              name: event.name,
              hookEvent: event.hookEvent,
              outcome: event.outcome,
            });
            this.busEmit("agent.hook", {
              runId,
              phase: event.phase,
              name: event.name,
              hookEvent: event.hookEvent,
              outcome: event.outcome,
            });
          } else if (event.type === "usage") {
            this.busEmitRuntimeEvent({
              runId,
              eventKind: "usage",
              inputTokens: event.inputTokens,
              outputTokens: event.outputTokens,
              totalTokens: event.totalTokens,
              contextWindow: event.contextWindow,
              usedRatio: event.usedRatio,
              usageSource: event.source,
            });
            const snapshot: UsageSnapshot = {
              inputTokens: event.inputTokens,
              outputTokens: event.outputTokens,
              totalTokens: event.totalTokens,
              contextWindow: event.contextWindow,
              usedRatio: event.usedRatio,
              source: event.source,
            };
            this._lastUsage = snapshot;
            await this.maybeFirePressure(snapshot, runId);
          } else if (event.type === "error") {
            this.busEmit("agent.error", {
              runId,
              error: String(event.error),
              level: "error",
            });
          }
        },
        onContextAssembled: (prompt) => this.emit("contextAssembled", prompt),
        shouldStop: () => this._state === "stopped" || this.pendingGracefulStop,
      })
      .then((outcome) => {
        if (outcome === "error") this.setState("error");
        else if (this._state !== "stopped") this.setState("idle");
      })
      .catch((err) => {
        this.emit("event", {
          type: "error",
          error: err instanceof Error ? err : new Error(String(err)),
        });
        this.busEmit("agent.error", {
          error: String(err),
          level: "error",
        });
        this.setState("error");
      });
  }

  private scheduleWorkspaceInterrupt(
    source: "channel" | "reminder" | "todo",
    reason: string,
  ): void {
    if (!this.config.loop.supports.includes("interruptible") || !this.config.loop.interrupt) return;
    this.pendingInterruptSource = source;
    this.pendingInterruptReason = reason;
    if (this.interruptTimer) clearTimeout(this.interruptTimer);

    this.interruptTimer = setTimeout(() => {
      this.interruptTimer = null;
      if (this._state !== "processing") return;
      const pendingSource = this.pendingInterruptSource ?? source;
      const pendingReason = this.pendingInterruptReason ?? reason;
      this.pendingInterruptSource = null;
      this.pendingInterruptReason = null;
      void this.config.loop.interrupt!(
        this.buildWorkspaceInterruptMessage(pendingSource, pendingReason),
      ).catch(() => {});
    }, 150);
  }

  private buildWorkspaceInterruptMessage(
    source: "channel" | "reminder" | "todo",
    reason: string,
  ): string {
    return [
      "[notification]",
      `source: ${source}`,
      `reason: ${reason}`,
      "workspace_attention:",
      `  unread_channel_messages: ${this.inbox.unreadCount}`,
      `  pending_todos: ${this.todoManager.pending.length}`,
      `  pending_reminders: ${this.reminders.pending.length}`,
      "guidance:",
      "  Treat this as notification-center attention.",
      "  Re-check the relevant app or channel before continuing if it changes your next action.",
    ].join("\n");
  }
}

function classifyInboxNotification(message: InboxMessage): "channel" | "reminder" {
  if (message.from === "system" && message.content.startsWith("⏰ Reminder timed out:")) {
    return "reminder";
  }
  return "channel";
}
