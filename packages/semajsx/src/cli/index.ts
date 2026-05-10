import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { cac } from "cac";
import { runPreview } from "./preview";

const cli = cac("semajsx");

cli
  .command("preview <file>", "Preview a component in the browser")
  .option("--port <port>", "Port to listen on", { default: 3000 })
  .option("--host <host>", "Host to bind", { default: "localhost" })
  .option("--open", "Open the browser on start", { default: true })
  .option("--no-open", "Do not open the browser")
  .example("semajsx preview ./Button.tsx")
  .action(async (file: string, options) => {
    await runPreview(file, {
      port: Number(options.port),
      host: String(options.host),
      open: options.open !== false,
    });
  });

cli
  .command("<file>", "Preview a component in the browser (default)")
  .option("--port <port>", "Port to listen on", { default: 3000 })
  .option("--host <host>", "Host to bind", { default: "localhost" })
  .option("--open", "Open the browser on start", { default: true })
  .option("--no-open", "Do not open the browser")
  .example("semajsx ./Button.tsx")
  .action(async (file: string, options) => {
    await runPreview(file, {
      port: Number(options.port),
      host: String(options.host),
      open: options.open !== false,
    });
  });

cli.help();
cli.version(getVersion());

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\x1b[31merror\x1b[0m ${message}\n`);
  process.exit(1);
}

function getVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // From dist/cli/index.mjs → ../../package.json. From src/cli/index.ts → ../../package.json.
    const pkgPath = resolve(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "";
  } catch {
    return "";
  }
}
