import { defineConfig } from "vitest/config";

/**
 * Unit test configuration - excludes browser-dependent packages
 * Use this when Playwright browsers are not available
 */
export default defineConfig({
  test: {
    projects: [
      "internals/core",
      "internals/signal",
      "internals/terminal",
      "internals/ssr",
      "internals/ssg",
      "internals/utils",
    ],
  },
});
