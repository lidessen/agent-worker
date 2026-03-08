/**
 * Line-buffered JSON stream parser for CLI runtimes.
 * CLI tools output one JSON object per line (JSON Lines / NDJSON).
 */
export interface StreamParser<T = unknown> {
  push(chunk: string): void;
  flush(): void;
}

export function createStreamParser<T = unknown>(
  onJSON: (data: T) => void,
  onError?: (line: string, err: Error) => void,
): StreamParser<T> {
  let buffer = "";

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split("\n");
      // keep incomplete last line in buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          onJSON(JSON.parse(trimmed) as T);
        } catch (err) {
          onError?.(trimmed, err as Error);
        }
      }
    },

    flush() {
      const trimmed = buffer.trim();
      buffer = "";
      if (!trimmed) return;
      try {
        onJSON(JSON.parse(trimmed) as T);
      } catch (err) {
        onError?.(trimmed, err as Error);
      }
    },
  };
}
