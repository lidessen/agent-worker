/** Terminal color escape codes for CLI output. */
export const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
} as const;

/** Format a timestamp (ms since epoch) as HH:MM:SS.mmm */
export function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 23);
}
