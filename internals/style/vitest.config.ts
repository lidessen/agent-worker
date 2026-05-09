import { defineProject } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineProject({
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "vue"],
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    // Run most tests in browser, but exclude css-validation which needs Node
    include: ["src/**/*.test.ts"],
    exclude: ["src/css-validation.test.ts"],
  },
});
