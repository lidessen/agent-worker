import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  id: number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

export interface JsonRpcNotification {
  method: string;
  params?: unknown;
}

export interface JsonRpcStdioClientOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  stderr?: (data: string) => void;
}

export class JsonRpcStdioClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
    }
  >();
  private stdoutBuf = "";
  private closed = false;
  private onNotification: ((message: JsonRpcNotification) => void) | null = null;

  constructor(private options: JsonRpcStdioClientOptions) {}

  start(onNotification: (message: JsonRpcNotification) => void): void {
    if (this.proc) return;
    this.onNotification = onNotification;

    const env = { ...process.env, ...this.options.env };
    delete env.CLAUDECODE;

    this.proc = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stderr.setEncoding("utf8");

    this.proc.stdout.on("data", (chunk: string) => {
      this.stdoutBuf += chunk;
      let newline = this.stdoutBuf.indexOf("\n");
      while (newline >= 0) {
        const line = this.stdoutBuf.slice(0, newline).trim();
        this.stdoutBuf = this.stdoutBuf.slice(newline + 1);
        if (line) this.handleMessage(line);
        newline = this.stdoutBuf.indexOf("\n");
      }
    });

    this.proc.stderr.on("data", (chunk: string) => {
      this.options.stderr?.(chunk);
    });

    this.proc.on("error", (err) => {
      this.rejectAll(err instanceof Error ? err : new Error(String(err)));
    });

    this.proc.on("exit", (code, signal) => {
      const reason =
        code === 0
          ? new Error("JSON-RPC process exited")
          : new Error(
              `JSON-RPC process exited with code ${code ?? "null"} signal ${signal ?? "null"}`,
            );
      this.rejectAll(reason);
    });
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.proc || this.closed) {
      throw new Error("JSON-RPC client is not running");
    }

    const id = this.nextId++;
    const payload: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

    const result = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });

    this.proc.stdin.write(JSON.stringify(payload) + "\n");
    return result;
  }

  async notify(method: string, params?: unknown): Promise<void> {
    if (!this.proc || this.closed) {
      throw new Error("JSON-RPC client is not running");
    }
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
    this.rejectAll(new Error("JSON-RPC client closed"));
  }

  private handleMessage(line: string): void {
    let parsed: JsonRpcResponse | JsonRpcNotification;
    try {
      parsed = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;
    } catch {
      return;
    }

    if ("id" in parsed) {
      const pending = this.pending.get(parsed.id);
      if (!pending) return;
      this.pending.delete(parsed.id);
      if (parsed.error) {
        pending.reject(
          new Error(parsed.error.message ?? `JSON-RPC error ${parsed.error.code ?? ""}`),
        );
      } else {
        pending.resolve(parsed.result);
      }
      return;
    }

    if ("method" in parsed) {
      this.onNotification?.(parsed);
    }
  }

  private rejectAll(err: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(err);
    }
    this.pending.clear();
  }
}
