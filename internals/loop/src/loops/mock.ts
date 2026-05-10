/**
 * MockLoop — deterministic loop for testing. Returns a fixed response.
 */
import type { LoopRun, LoopEvent, LoopResult, LoopStatus } from "../types.ts";

export interface MockLoopOptions {
  response?: string;
  delayMs?: number;
}

export class MockLoop {
  supports = ["directTools" as const];
  private _status: LoopStatus = "idle";
  private _response: string;
  private _delayMs: number;

  constructor(opts: MockLoopOptions = {}) {
    this._response = opts.response ?? "mock response";
    this._delayMs = opts.delayMs ?? 0;
  }

  get status(): LoopStatus {
    return this._status;
  }

  run(_prompt: string): LoopRun {
    this._status = "running";
    const response = this._response;
    const delayMs = this._delayMs;
    const textEvent: LoopEvent = { type: "text", text: response };
    const loopResult: LoopResult = {
      events: [textEvent],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      durationMs: delayMs,
    };

    const resultPromise = (async () => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      this._status = "completed";
      return loopResult;
    })();

    const iter = async function* (statusSetter: () => void) {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      yield textEvent;
      statusSetter();
    };
    return {
      [Symbol.asyncIterator]: () =>
        iter(() => {
          this._status = "completed";
        }),
      result: resultPromise,
    };
  }

  cancel(): void {
    this._status = "cancelled";
  }

  setTools(): void {}
  setPrepareStep(): void {}
}
