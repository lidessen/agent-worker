import { describe, expect, test } from "bun:test";
import {
  getPreferredScriptRuntime,
  resolveScriptEntrypointCommand,
} from "./script-runtime.ts";

describe("script runtime helpers", () => {
  test("resolves an entrypoint command for the active runtime", () => {
    const entryPath = "/tmp/worker-entry.ts";
    const args = ["http://localhost:7420", "token", "ws", "agent"];
    const runtime = getPreferredScriptRuntime();
    const command = resolveScriptEntrypointCommand(entryPath, args);

    expect(command.runtime).toBe(runtime);

    if (runtime === "bun") {
      expect(command.command).toBe("bun");
      expect(command.args).toEqual([entryPath, ...args]);
      return;
    }

    expect(command.command).toBe(process.execPath);
    expect(command.args).toEqual(["--import", "tsx", entryPath, ...args]);
  });
});
