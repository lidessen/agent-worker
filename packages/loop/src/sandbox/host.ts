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
import { execaCommand } from "execa";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Sandbox, CommandResult } from "bash-tool";

export interface HostSandboxOptions {
  /** Working directory for commands. */
  cwd: string;
}

export function createHostSandbox(options: HostSandboxOptions): Sandbox {
  const { cwd } = options;

  return {
    async executeCommand(command: string): Promise<CommandResult> {
      try {
        const result = await execaCommand(command, {
          cwd,
          shell: true,
          reject: false,
          timeout: 120_000,
        });
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
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
      return readFile(path, "utf-8");
    },

    async writeFiles(
      files: Array<{ path: string; content: string | Buffer }>,
    ): Promise<void> {
      for (const file of files) {
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
