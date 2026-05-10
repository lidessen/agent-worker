import { defineProject } from "vitest/config";

export default defineProject({
  esbuild: {
    jsxImportSource: "@semajsx/dom",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
