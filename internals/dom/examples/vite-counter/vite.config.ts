import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      semajsx: resolve(__dirname, "../../src"),
      "@/": resolve(__dirname, "../../src/"),
    },
  },
  esbuild: {
    jsxFactory: "h",
    jsxFragment: "Fragment",
    jsxInject: `import { h, Fragment } from 'semajsx'`,
  },
});
