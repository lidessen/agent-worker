import { cpSync } from "node:fs";

const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: !process.argv.includes("--watch"),
  naming: "[name].[ext]",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

cpSync("./src/index.html", "./dist/index.html");
console.log("Build complete → dist/");
