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
    const proc = Bun.spawn([command, versionFlag], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return { available: false, error: `${command} exited with ${exitCode}` };
    }
    const stdout = await new Response(proc.stdout).text();
    const version = stdout.trim().split("\n")[0];
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
    const proc = Bun.spawn([command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
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
export async function spawnCli(
  options: SpawnCliOptions,
): Promise<SpawnCliResult> {
  const {
    command,
    args,
    cwd,
    signal,
    idleTimeout = 60_000,
    onStdout,
    onStderr,
  } = options;

  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
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

  // Read stdout
  const readStdout = (async () => {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stdoutBuf += text;
      resetIdle();
      onStdout?.(text);
    }
  })();

  // Read stderr
  const readStderr = (async () => {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stderrBuf += text;
      resetIdle();
      onStderr?.(text);
    }
  })();

  await Promise.all([readStdout, readStderr]);
  const exitCode = await proc.exited;

  if (idleTimer) clearTimeout(idleTimer);
  signal?.removeEventListener("abort", onAbort);

  return { stdout: stdoutBuf, stderr: stderrBuf, exitCode };
}
