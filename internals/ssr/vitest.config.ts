import { defineProject } from "vitest/config";

export default defineProject({
  esbuild: {
    jsxImportSource: "@semajsx/dom",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [
      "src/client/**/*.test.tsx", // Browser tests excluded - run separately
    ],
  },
});
