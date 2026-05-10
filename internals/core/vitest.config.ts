import { defineProject } from "vitest/config";

export default defineProject({
  esbuild: {
    jsxImportSource: "@semajsx/core",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
