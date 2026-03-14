/**
 * CLI output formatting helpers.
 */

/** Format a table with aligned columns. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));

  const sep = widths.map((w) => "─".repeat(w + 2)).join("┼");
  const header = headers.map((h, i) => ` ${h.padEnd(widths[i]!)} `).join("│");
  const body = rows
    .map((row) => row.map((cell, i) => ` ${cell.padEnd(widths[i]!)} `).join("│"))
    .join("\n");

  return `${header}\n${sep}\n${body}`;
}

/** Format duration in ms to human-readable string. */
export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Print error and exit. */
export function fatal(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}
