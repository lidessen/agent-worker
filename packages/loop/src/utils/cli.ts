import { execa } from "execa";

export interface CliCheckResult {
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * Check if a CLI tool is available by running `command --version`.
 */
export async function checkCliAvailability(
  command: string,
  versionFlag = "--version",
): Promise<CliCheckResult> {
  try {
    const result = await execa(command, [versionFlag], { reject: false });
    if (result.exitCode !== 0) {
      return { available: false, error: `${command} exited with ${result.exitCode}` };
    }
    const version = result.stdout.trim().split("\n")[0];
    return { available: true, version };
  } catch (err) {
    return {
      available: false,
      error: `${command} not found: ${(err as Error).message}`,
    };
  }
}

/**
 * Run a CLI command and capture stdout/stderr.
 */
export async function runCliCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execa(command, args, { reject: false });
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: result.exitCode ?? -1,
    };
  } catch (err) {
    return { stdout: "", stderr: (err as Error).message, exitCode: -1 };
  }
}

// ── Claude Code auth ────────────────────────────────────────────────────────

export async function checkClaudeCodeAuth(): Promise<{
  authenticated: boolean;
  email?: string;
  error?: string;
}> {
  const result = await runCliCommand("claude", ["auth", "status"]);
  if (result.exitCode !== 0) {
    return { authenticated: false, error: result.stderr || "auth check failed" };
  }
  try {
    const data = JSON.parse(result.stdout) as Record<string, unknown>;
    if (data.loggedIn) {
      return { authenticated: true, email: data.email as string | undefined };
    }
    return { authenticated: false, error: "Not logged in" };
  } catch {
    return { authenticated: false, error: "Failed to parse auth status" };
  }
}

// ── Codex auth ──────────────────────────────────────────────────────────────

export async function checkCodexAuth(): Promise<{
  authenticated: boolean;
  method?: string;
  error?: string;
}> {
  // Check env var first
  if (process.env.OPENAI_API_KEY) {
    return { authenticated: true, method: "OPENAI_API_KEY" };
  }
  // Check codex login status (codex outputs status to stderr)
  const result = await runCliCommand("codex", ["login", "status"]);
  const output = result.stdout || result.stderr;
  if (result.exitCode === 0 && output) {
    const lower = output.toLowerCase();
    if (lower.includes("logged in") || lower.includes("authenticated")) {
      return { authenticated: true, method: output };
    }
  }
  return { authenticated: false, error: output || "Not logged in and OPENAI_API_KEY not set" };
}

// ── Spawn ───────────────────────────────────────────────────────────────────

export interface SpawnCliOptions {
  command: string;
  args: string[];
  cwd?: string;
  /** Extra environment variables merged into process.env */
  env?: Record<string, string>;
  signal?: AbortSignal;
  idleTimeout?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface SpawnCliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn a CLI process with idle timeout and streaming output.
 */
export async function spawnCli(options: SpawnCliOptions): Promise<SpawnCliResult> {
  const {
    command,
    args,
    cwd,
    env: extraEnv,
    signal,
    idleTimeout = 60_000,
    onStdout,
    onStderr,
  } = options;

  // Strip CLAUDECODE so CLI loops (claude, codex, cursor) inherit
  // the host's login state instead of being blocked as nested sessions.
  // Use extendEnv: false to prevent execa from re-merging process.env
  // (which would restore the deleted CLAUDECODE key).
  const env = { ...process.env, ...extraEnv };
  delete env.CLAUDECODE;

  const proc = execa(command, args, {
    cwd,
    env,
    extendEnv: false,
    reject: false,
    stdin: "ignore",
  });

  let stdoutBuf = "";
  let stderrBuf = "";
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      proc.kill("SIGTERM");
    }, idleTimeout);
  };

  // Handle abort signal
  const onAbort = () => proc.kill("SIGTERM");
  signal?.addEventListener("abort", onAbort, { once: true });

  resetIdle();

  // Read stdout stream
  const readStdout = (async () => {
    if (!proc.stdout) return;
    for await (const chunk of proc.stdout) {
      const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      stdoutBuf += text;
      resetIdle();
      onStdout?.(text);
    }
  })();

  // Read stderr stream
  const readStderr = (async () => {
    if (!proc.stderr) return;
    for await (const chunk of proc.stderr) {
      const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      stderrBuf += text;
      resetIdle();
      onStderr?.(text);
    }
  })();

  await Promise.all([readStdout, readStderr]);
  const result = await proc;

  if (idleTimer) clearTimeout(idleTimer);
  signal?.removeEventListener("abort", onAbort);

  return { stdout: stdoutBuf, stderr: stderrBuf, exitCode: result.exitCode ?? -1 };
}
