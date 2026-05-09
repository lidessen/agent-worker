/** @jsxImportSource @semajsx/terminal */

import { describe, it, expect, beforeEach } from "vitest";
import { Logger, createLogger } from "@semajsx/logger";
import { Writable } from "stream";

/**
 * Mock writable stream for capturing output
 */
class MockStream extends Writable {
  output: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _write(chunk: unknown, encoding: string, callback: () => void): void {
    this.output.push(String(chunk));
    callback();
  }

  clear(): void {
    this.output = [];
  }

  getOutput(): string {
    return this.output.join("");
  }
}

describe("Logger", () => {
  let mockStream: MockStream;

  beforeEach(() => {
    mockStream = new MockStream();
  });

  describe("Basic Logging", () => {
    it("should create logger with default options", () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it("should log debug messages", () => {
      const logger = new Logger({ stream: mockStream as any });
      logger.debug("test message");

      const output = mockStream.getOutput();
      expect(output).toContain("DEBUG");
      expect(output).toContain("test message");
    });

    it("should log info messages", () => {
      const logger = new Logger({ stream: mockStream as any });
      logger.info("info message");

      const output = mockStream.getOutput();
      expect(output).toContain("INFO");
      expect(output).toContain("info message");
    });

    it("should log success messages", () => {
      const logger = new Logger({ stream: mockStream as any });
      logger.success("success message");

      const output = mockStream.getOutput();
      expect(output).toContain("SUCCESS");
      expect(output).toContain("success message");
    });

    it("should log warning messages", () => {
      const logger = new Logger({ stream: mockStream as any });
      logger.warn("warning message");

      const output = mockStream.getOutput();
      expect(output).toContain("WARN");
      expect(output).toContain("warning message");
    });

    it("should log error messages", () => {
      const logger = new Logger({ stream: mockStream as any });
      logger.error("error message");

      const output = mockStream.getOutput();
      expect(output).toContain("ERROR");
      expect(output).toContain("error message");
    });
  });

  describe("Level Filtering", () => {
    it("should filter logs based on minLevel", () => {
      const logger = new Logger({
        stream: mockStream as any,
        minLevel: "warn",
      });

      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      const output = mockStream.getOutput();
      expect(output).not.toContain("debug");
      expect(output).not.toContain("info");
      expect(output).toContain("warn");
      expect(output).toContain("error");
    });

    it("should show all logs with debug minLevel", () => {
      const logger = new Logger({
        stream: mockStream as any,
        minLevel: "debug",
      });

      logger.debug("debug");
      logger.info("info");

      const output = mockStream.getOutput();
      expect(output).toContain("debug");
      expect(output).toContain("info");
    });
  });

  describe("Configuration", () => {
    it("should hide timestamps when disabled", () => {
      const logger = new Logger({
        stream: mockStream as any,
        timestamp: false,
      });

      logger.info("test");

      const output = mockStream.getOutput();
      // Check that there's no timestamp pattern like [HH:MM:SS AM/PM]
      // Note: ANSI codes may contain [ so we check for timestamp-specific pattern
      expect(output).not.toMatch(/\[\d+:\d+:\d+\s*(AM|PM)?\]/);
    });

    it("should use custom timestamp format", () => {
      const logger = new Logger({
        stream: mockStream as any,
        timestampFormat: () => "CUSTOM_TIME",
      });

      logger.info("test");

      const output = mockStream.getOutput();
      expect(output).toContain("CUSTOM_TIME");
    });

    it("should hide log level when disabled", () => {
      const logger = new Logger({
        stream: mockStream as any,
        showLevel: false,
      });

      logger.info("test");

      const output = mockStream.getOutput();
      expect(output).not.toContain("INFO");
    });

    it("should use custom prefix", () => {
      const logger = new Logger({
        stream: mockStream as any,
        prefix: "TEST_PREFIX",
      });

      logger.info("message");

      const output = mockStream.getOutput();
      expect(output).toContain("TEST_PREFIX");
    });
  });

  describe("Chainability", () => {
    it("should allow chaining log methods", () => {
      const logger = new Logger({ stream: mockStream as any });

      const result = logger.info("first").debug("second").success("third");

      expect(result).toBe(logger);

      const output = mockStream.getOutput();
      expect(output).toContain("first");
      expect(output).toContain("second");
      expect(output).toContain("third");
    });
  });

  describe("Child Loggers", () => {
    it("should create child logger with prefix", () => {
      const parent = new Logger({
        stream: mockStream as any,
        prefix: "PARENT",
      });

      const child = parent.child("CHILD");
      child.info("message");

      const output = mockStream.getOutput();
      expect(output).toContain("PARENT:CHILD");
    });

    it("should create child from logger without prefix", () => {
      const parent = new Logger({
        stream: mockStream as any,
      });

      const child = parent.child("MODULE");
      child.info("message");

      const output = mockStream.getOutput();
      expect(output).toContain("MODULE");
      // Check that MODULE appears without a parent prefix (no "SOMETHING:MODULE" pattern)
      // Note: timestamp contains : so we check for specific prefix pattern
      expect(output).not.toMatch(/\w+:MODULE/);
    });
  });

  describe("Tags", () => {
    it("should add tags to logs", () => {
      const logger = new Logger({ stream: mockStream as any });
      const tagged = logger.withTags("tag1", "tag2");

      tagged.info("message");

      const output = mockStream.getOutput();
      expect(output).toContain("#tag1");
      expect(output).toContain("#tag2");
    });

    it("should create new logger instance with tags", () => {
      const logger = new Logger({ stream: mockStream as any });
      const tagged = logger.withTags("tag");

      expect(tagged).not.toBe(logger);

      logger.info("without tags");
      mockStream.clear();

      tagged.info("with tags");
      const output = mockStream.getOutput();
      expect(output).toContain("#tag");
    });
  });

  describe("Structured Data", () => {
    it("should log objects as JSON", () => {
      const logger = new Logger({ stream: mockStream as any });

      logger.info({ key: "value", number: 42 });

      const output = mockStream.getOutput();
      expect(output).toContain("key");
      expect(output).toContain("value");
      expect(output).toContain("42");
    });

    it("should handle multiple arguments", () => {
      const logger = new Logger({ stream: mockStream as any });

      logger.info("message", { arg1: 1 }, { arg2: 2 });

      const output = mockStream.getOutput();
      expect(output).toContain("message");
      expect(output).toContain("arg1");
      expect(output).toContain("arg2");
    });
  });

  describe("Timers", () => {
    it("should measure time", async () => {
      const logger = new Logger({ stream: mockStream as any });

      const timer = logger.time("Test Timer");
      await new Promise((resolve) => setTimeout(resolve, 50));
      timer.end();

      const output = mockStream.getOutput();
      expect(output).toContain("Test Timer");
      expect(output).toContain("ms");
    });

    it("should get elapsed time", async () => {
      const logger = new Logger({ stream: mockStream as any });

      const timer = logger.time("Test");
      await new Promise((resolve) => setTimeout(resolve, 50));
      const elapsed = timer.elapsed();

      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(100);
    });

    it("should measure async function", async () => {
      const logger = new Logger({ stream: mockStream as any });

      const result = await logger.measure("Test", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "result";
      });

      expect(result).toBe("result");

      const output = mockStream.getOutput();
      expect(output).toContain("Test");
      expect(output).toContain("completed");
    });

    it("should handle errors in measured functions", async () => {
      const logger = new Logger({ stream: mockStream as any });

      await expect(
        logger.measure("Test", async () => {
          throw new Error("test error");
        }),
      ).rejects.toThrow("test error");

      const output = mockStream.getOutput();
      expect(output).toContain("failed");
    });
  });

  describe("Utility Methods", () => {
    it("should log blank line", () => {
      const logger = new Logger({ stream: mockStream as any });

      logger.info("before");
      mockStream.clear();
      logger.blank();

      const output = mockStream.getOutput();
      // Should produce some output (ANSI codes etc)
      expect(output.length).toBeGreaterThan(0);
    });

    it("should log separator", () => {
      const logger = new Logger({ stream: mockStream as any });

      logger.separator("─", "gray");

      const output = mockStream.getOutput();
      expect(output).toContain("─");
    });
  });

  describe("Factory Function", () => {
    it("should create logger with createLogger", () => {
      const logger = createLogger({
        stream: mockStream as any,
        prefix: "FACTORY",
      });

      logger.info("test");

      const output = mockStream.getOutput();
      expect(output).toContain("FACTORY");
    });
  });

  describe("JSX Content", () => {
    it("should handle JSX content", () => {
      const logger = new Logger({ stream: mockStream as any });

      logger.jsx(
        <box>
          <text>Custom content</text>
        </box>,
      );

      const output = mockStream.getOutput();
      expect(output).toContain("Custom content");
    });

    it("should handle JSX in log methods", () => {
      const logger = new Logger({ stream: mockStream as any });

      logger.info(
        <text bold color="green">
          Styled text
        </text>,
      );

      const output = mockStream.getOutput();
      expect(output).toContain("Styled text");
    });
  });
});
