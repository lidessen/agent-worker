import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/signal/index.ts",
    "src/prompt/index.ts",
    "src/prompt/jsx-runtime.ts",
    "src/prompt/jsx-dev-runtime.ts",
    "src/dom/index.ts",
    "src/dom/jsx-runtime.ts",
    "src/dom/jsx-dev-runtime.ts",
    "src/terminal/index.ts",
    "src/terminal/jsx-runtime.ts",
    "src/terminal/jsx-dev-runtime.ts",
    "src/ssr/index.ts",
    "src/ssr/client.ts",
    "src/ssg/index.ts",
    "src/ssg/plugins/docs-theme.ts",
    "src/ssg/plugins/lucide.ts",
    "src/tailwind/index.ts",
    "src/style/index.ts",
    "src/style/react.ts",
    "src/style/vue.ts",
    "src/blocks/index.ts",
    "src/blocks/renderers.ts",
    "src/chat/index.ts",
    "src/icons/index.ts",
    "src/cli/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  outputOptions: {
    banner: (chunk) => (chunk.fileName === "cli/index.mjs" ? "#!/usr/bin/env node\n" : ""),
  },
  // Bundle all @semajsx/* workspace packages into the output.
  // Everything in dependencies/peerDependencies is auto-externalized by tsdown.
  noExternal: [/^@semajsx\//],
  exports: {
    devExports: "source",
    customExports(pkg) {
      pkg["./package.json"] = "./package.json";
      return pkg;
    },
  },
});
