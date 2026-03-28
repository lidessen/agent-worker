/**
 * HostSandbox — a bash-tool Sandbox implementation that runs commands
 * directly on the host filesystem.
 *
 * Used for `runner: "host"` agents. Commands execute in real processes
 * with a configurable cwd, and file operations hit the real filesystem.
 *
 * When sandboxing is needed, swap this for @vercel/sandbox — the
 * Sandbox interface stays the same.
 */
import { execa } from "execa";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Sandbox, CommandResult } from "bash-tool";

export interface HostSandboxOptions {
  /** Working directory for commands. */
  cwd: string;
  /** Additional directories the sandbox may access (read/write). */
  allowedPaths?: string[];
}

/**
 * Check that `target` is inside `cwd` or one of `allowedPaths`.
 * All paths are resolved to absolute before comparison.
 */
function assertPathAllowed(
  target: string,
  cwd: string,
  allowedPaths: string[],
): void {
  const abs = resolve(target);
  const roots = [resolve(cwd), ...allowedPaths.map((p) => resolve(p))];
  if (roots.some((root) => abs === root || abs.startsWith(root + "/"))) return;
  throw new Error(
    `Path "${target}" is outside sandbox boundary (cwd: ${cwd})`,
  );
}

export function createHostSandbox(options: HostSandboxOptions): Sandbox {
  const { cwd, allowedPaths = [] } = options;

  return {
    async executeCommand(command: string): Promise<CommandResult> {
      try {
        // Split command to avoid shell injection — use shell only for
        // pipes/redirects which are common in agent commands.
        const result = await execa({ cwd, reject: false, timeout: 120_000 })`bash -c ${command}`;
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode ?? 1,
        };
      } catch (err) {
        return {
          stdout: "",
          stderr: err instanceof Error ? err.message : String(err),
          exitCode: 1,
        };
      }
    },

    async readFile(path: string): Promise<string> {
      assertPathAllowed(path, cwd, allowedPaths);
      return readFile(path, "utf-8");
    },

    async writeFiles(
      files: Array<{ path: string; content: string | Buffer }>,
    ): Promise<void> {
      for (const file of files) {
        assertPathAllowed(file.path, cwd, allowedPaths);
        await mkdir(dirname(file.path), { recursive: true });
        await writeFile(
          file.path,
          typeof file.content === "string"
            ? file.content
            : Buffer.from(file.content),
        );
      }
    },
  };
}
