import type {
  AgentConfig,
  AgentState,
  AgentEvents,
  InboxMessage,
  Message,
  NotesStorage,
  TodoItem,
  Turn,
} from "./types.ts";
import type { EventBus } from "@agent-worker/shared";
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

  constructor(config: AgentConfig) {
    this.config = config;
    this.bus = config.bus;
    this.agentName = config.name ?? "agent";

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
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.wiring.init();
  }

  async stop(): Promise<void> {
    this.setState("stopped");
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

    const msg = this.inbox.push(message);
    this.emit("messageReceived", msg);

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

    this.processingPromise = this.coordinator
      .processLoop({
        onRunStart: (info) => {
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
        onEvent: (event) => {
          this.emit("event", event);
          // Forward loop events to bus with structured types
          if (event.type === "text") {
            this.busEmit("agent.text", { runId, text: event.text });
          } else if (event.type === "tool_call_start") {
            this.busEmit("agent.tool_call", {
              runId,
              tool: event.name,
              callId: event.callId,
              args: event.args,
            });
          } else if (event.type === "tool_call_end") {
            this.busEmit("agent.tool_result", {
              runId,
              tool: event.name,
              callId: event.callId,
              durationMs: event.durationMs,
              error: event.error,
            });
          } else if (event.type === "error") {
            this.busEmit("agent.error", {
              runId,
              error: String(event.error),
              level: "error",
            });
          }
        },
        onContextAssembled: (prompt) => this.emit("contextAssembled", prompt),
        shouldStop: () => this._state === "stopped",
      })
      .then((outcome) => {
        if (outcome === "error") this.setState("error");
        else if (this._state !== "stopped") this.setState("idle");
      })
      .catch((err) => {
        this.emit("event", { type: "error", error: err instanceof Error ? err : new Error(String(err)) });
        this.busEmit("agent.error", {
          error: String(err),
          level: "error",
        });
        this.setState("error");
      });
  }
}
