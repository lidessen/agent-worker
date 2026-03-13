import type { RunnerKind, RunnerConfig } from "./types.ts";
import { execa } from "execa";

/**
 * AgentRunner — abstraction for where/how an agent's loop executes.
 *
 * "host"    — run directly in the daemon process (default)
 * "sandbox" — run in an isolated container/subprocess (future)
 */
export interface AgentRunner {
  readonly kind: RunnerKind;
  /** Execute a command or function within the runner's environment. */
  exec(command: string, opts?: { cwd?: string; timeout?: number }): Promise<ExecResult>;
  /** Dispose of runner resources. */
  dispose(): Promise<void>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Host runner — executes directly on the host machine.
 */
export class HostRunner implements AgentRunner {
  readonly kind = "host" as const;
  private cwd: string;

  constructor(config?: { cwd?: string }) {
    this.cwd = config?.cwd ?? process.cwd();
  }

  async exec(command: string, opts?: { cwd?: string; timeout?: number }): Promise<ExecResult> {
    const result = await execa("sh", ["-c", command], {
      cwd: opts?.cwd ?? this.cwd,
      reject: false,
      timeout: opts?.timeout,
    });

    return {
      exitCode: result.exitCode ?? 1,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async dispose(): Promise<void> {
    // Nothing to clean up for host runner
  }
}

/**
 * Sandbox runner — placeholder for future container/isolate-based execution.
 */
export class SandboxRunner implements AgentRunner {
  readonly kind = "sandbox" as const;

  constructor(_config?: Record<string, unknown>) {
    // Future: Docker/Firecracker/V8 isolate config
  }

  async exec(_command: string, _opts?: { cwd?: string; timeout?: number }): Promise<ExecResult> {
    throw new Error("Sandbox runner is not yet implemented");
  }

  async dispose(): Promise<void> {
    // Future: tear down sandbox
  }
}

/** Create a runner from config. */
export function createRunner(config?: RunnerConfig): AgentRunner {
  const kind = config?.kind ?? "host";
  switch (kind) {
    case "host":
      return new HostRunner({ cwd: config?.cwd });
    case "sandbox":
      return new SandboxRunner(config?.sandbox);
    default:
      throw new Error(`Unknown runner kind: ${kind}`);
  }
}
