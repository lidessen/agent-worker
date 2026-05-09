export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "no-non-english": (parsed) => {
          const { header } = parsed;
          // Check for non-ASCII characters (Chinese, Japanese, etc.)
          const nonAsciiRegex = /[^\x00-\x7F]/;
          if (nonAsciiRegex.test(header)) {
            return [false, "Commit message must be in English (no non-ASCII characters allowed)"];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    "no-non-english": [2, "always"],
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation changes
        "style", // Code style changes
        "refactor", // Refactoring
        "perf", // Performance improvements
        "test", // Adding or updating tests
        "chore", // Build process or tooling changes
        "revert", // Reverting changes
        "build", // Build system changes
        "ci", // CI configuration changes
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
  },
};
