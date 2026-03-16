/**
 * grep tool — search file contents using ripgrep.
 */
import { tool } from "ai";
import { z } from "zod";
import { execa } from "execa";

export function createGrepTool(opts: { cwd?: string } = {}) {
  return tool({
    description:
      "Search file contents using ripgrep. Returns matching lines with file paths and line numbers.",
    inputSchema: z.object({
      pattern: z.string().describe("Regex pattern to search for"),
      path: z
        .string()
        .optional()
        .describe("File or directory to search in (defaults to cwd)"),
      glob: z
        .string()
        .optional()
        .describe('Glob filter for files (e.g. "*.ts", "**/*.json")'),
      max_results: z
        .number()
        .optional()
        .describe("Max number of matching lines to return (default: 50)"),
      context: z
        .number()
        .optional()
        .describe("Number of context lines around each match"),
      case_insensitive: z
        .boolean()
        .optional()
        .describe("Case-insensitive search"),
      fixed_strings: z
        .boolean()
        .optional()
        .describe("Treat pattern as a literal string, not a regex"),
    }),
    execute: async (args) => {
      const rgArgs: string[] = ["--line-number", "--no-heading", "--color=never"];

      if (args.case_insensitive) rgArgs.push("--ignore-case");
      if (args.fixed_strings) rgArgs.push("--fixed-strings");
      if (args.glob) rgArgs.push("--glob", args.glob);
      if (args.context) rgArgs.push("--context", String(args.context));

      const maxResults = args.max_results ?? 50;
      rgArgs.push("--max-count", String(maxResults));

      rgArgs.push("--", args.pattern);
      if (args.path) rgArgs.push(args.path);

      try {
        const result = await execa("rg", rgArgs, {
          cwd: opts.cwd ?? process.cwd(),
          timeout: 30_000,
          reject: false,
        });

        // rg exit code 1 = no matches, 2+ = error
        if (result.exitCode === 1) {
          return "No matches found.";
        }
        if (result.exitCode && result.exitCode >= 2) {
          return `Error: ${result.stderr || result.stdout}`;
        }

        const lines = result.stdout.split("\n");
        if (lines.length > maxResults) {
          return (
            lines.slice(0, maxResults).join("\n") +
            `\n\n... truncated (${lines.length} total lines, showing ${maxResults})`
          );
        }
        return result.stdout || "No matches found.";
      } catch (err) {
        return `Error running ripgrep: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
