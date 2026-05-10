import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { previewPlugin } from "./virtual-plugin";

export interface PreviewOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

export async function runPreview(
  file: string,
  options: PreviewOptions = {},
): Promise<ViteDevServer> {
  const { port = 3000, host = "localhost", open: shouldOpen = true } = options;

  const absFile = isAbsolute(file) ? file : resolve(process.cwd(), file);
  if (!existsSync(absFile) || !statSync(absFile).isFile()) {
    throw new Error(`File not found: ${file}`);
  }

  const resolveFromCli = createRequireFromCli();

  const server = await createServer({
    configFile: false,
    root: dirname(absFile),
    server: { port, host, strictPort: false },
    appType: "custom",
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "semajsx/dom",
    },
    optimizeDeps: {
      exclude: ["semajsx", "@semajsx/core", "@semajsx/dom", "@semajsx/signal"],
    },
    plugins: [semajsxResolverPlugin(resolveFromCli), previewPlugin({ entryFile: absFile })],
  });

  await server.listen();

  const resolvedPort = server.config.server.port ?? port;
  const url = `http://${host}:${resolvedPort}/`;
  process.stdout.write(`\n  semajsx preview: \x1b[36m${url}\x1b[0m\n\n`);

  if (shouldOpen) {
    openBrowser(url);
  }

  return server;
}

function createRequireFromCli(): (specifier: string) => string {
  // Use createRequire anchored at the CLI's own file so bare `semajsx` specifiers
  // resolve to this package regardless of the user's cwd.
  const here = fileURLToPath(import.meta.url);
  const req = createRequire(here);
  return (specifier) => req.resolve(specifier);
}

function semajsxResolverPlugin(resolver: (s: string) => string) {
  return {
    name: "semajsx:cli-resolver",
    enforce: "pre" as const,
    resolveId(source: string) {
      if (source === "semajsx" || source.startsWith("semajsx/")) {
        try {
          return resolver(source);
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

function openBrowser(url: string): void {
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else if (platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // Best-effort; URL is already printed.
  }
}
