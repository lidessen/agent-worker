/**
 * web_browse tool — thin wrapper around Vercel's `agent-browser` CLI.
 *
 * Delegates all browser interaction to `agent-browser` commands.
 * The CLI manages its own headless Chromium daemon, element refs (@e1, @e2),
 * and accessibility snapshots — much more token-efficient than raw HTML.
 *
 * Typical workflow:
 *   1. open https://example.com
 *   2. snapshot -i           → get interactive element refs
 *   3. click @e2 / fill @e3 "text" / etc.
 *   4. close
 */
import { tool } from "ai";
import { z } from "zod";
import { execa } from "execa";

export function createWebBrowseTool() {
  return tool({
    description:
      "Browse the web using a headless browser (agent-browser CLI). " +
      "Pass any agent-browser command string. The browser session persists across calls.\n" +
      "Workflow: open <url> → snapshot -i (interactive refs) → interact → close.\n" +
      "Commands: open, snapshot, click, fill, type, press, hover, scroll, " +
      "get text/html/url, screenshot, wait, back, forward, reload, eval, close.",
    inputSchema: z.object({
      command: z
        .string()
        .describe(
          'agent-browser command, e.g. "open https://example.com", ' +
            '"snapshot -i", "click @e1", "fill @e2 hello", "get text @e3", "close"',
        ),
    }),
    execute: async (args) => {
      try {
        // Split the command string into args for safe execution (no shell injection).
        // Uses array form of execa to avoid shell interpretation of user input.
        const cmdArgs = splitArgs(args.command);
        const result = await execa("agent-browser", cmdArgs, {
          timeout: 60_000,
          reject: false,
          stdin: "ignore",
          // Ensure node_modules/.bin is on PATH so agent-browser resolves
          env: {
            ...process.env,
            PATH: `${process.env.PATH}:./node_modules/.bin`,
          },
        });

        if (result.exitCode !== 0) {
          const errMsg = result.stderr || result.stdout || result.message || "Unknown error";
          if (errMsg.includes("not found") || errMsg.includes("ENOENT")) {
            return "Error: agent-browser not installed. Run: bun add agent-browser && bunx agent-browser install";
          }
          if (errMsg.includes("Chrome not found")) {
            return "Error: Chrome not found. Run: bunx agent-browser install";
          }
          return `Error (exit ${result.exitCode}): ${errMsg}`;
        }

        const output = result.stdout;
        if (output.length > 15_000) {
          return output.slice(0, 15_000) + "\n\n... [truncated]";
        }
        return output || "(no output)";
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT") || msg.includes("not found")) {
          return "Error: agent-browser not installed. Run: bun add agent-browser && bunx agent-browser install";
        }
        return `Error: ${msg}`;
      }
    },
  });
}

/**
 * Split a command string into an array of arguments, respecting quoted strings.
 * Handles single and double quotes. Does NOT interpret shell operators (&&, |, ;, etc.).
 */
function splitArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) args.push(current);
  return args;
}

/** No-op — browser lifecycle is managed by agent-browser daemon. */
export async function closeBrowser(): Promise<void> {}
