import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "happy-dom",
    include: [
      "src/theme.test.ts",
      "src/keyframes.test.ts",
      "src/animate.test.ts",
      "src/responsive.test.ts",
    ],
  },
});
