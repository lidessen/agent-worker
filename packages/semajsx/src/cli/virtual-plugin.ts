import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

export interface PreviewPluginOptions {
  entryFile: string;
}

const VIRTUAL_ENTRY_URL = "/@semajsx-preview-entry.js";
const VIRTUAL_ENTRY_ID = "\0semajsx-preview-entry.js";
const INDEX_HTML = "/index.html";

/**
 * Vite plugin that serves a zero-config preview shell for a single component file:
 *  - GET /            → HTML with #root + <script> tag pointing at the virtual entry
 *  - GET <virtual>    → JS that imports the user's file and mounts the default export
 */
export function previewPlugin(options: PreviewPluginOptions): Plugin {
  const { entryFile } = options;

  return {
    name: "semajsx:preview",
    enforce: "pre",

    resolveId(source) {
      if (source === VIRTUAL_ENTRY_URL) return VIRTUAL_ENTRY_ID;
      return null;
    },

    load(id) {
      if (id === VIRTUAL_ENTRY_ID) {
        return generateEntry(entryFile);
      }
      return null;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (url === "/" || url === INDEX_HTML) {
          try {
            const html = await server.transformIndexHtml(url, generateHtml(entryFile));
            res.setHeader("Content-Type", "text/html");
            res.end(html);
            return;
          } catch (err) {
            return next(err);
          }
        }
        next();
      });
    },
  };
}

function generateHtml(entryFile: string): string {
  const title = escapeHtml(fileBaseName(entryFile));
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title} · semajsx preview</title>
    <style>
      html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
      #root { padding: 16px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${VIRTUAL_ENTRY_URL}"></script>
  </body>
</html>
`;
}

function generateEntry(entryFile: string): string {
  // Verify the file is readable so Vite surfaces a useful error if it's not.
  readFileSync(entryFile, "utf8");

  const specifier = JSON.stringify(toImportSpecifier(entryFile));
  const errMsg = JSON.stringify(entryFile);

  // Plain JS — uses h() directly so we don't depend on Vite's JSX transform
  // processing this virtual module.
  return `import { h } from "semajsx";
import { render } from "semajsx/dom";
import * as mod from ${specifier};

const Component = pickComponent(mod);

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
render(h(Component, null), root);

function pickComponent(m) {
  if (typeof m.default === "function") return m.default;
  const named = Object.entries(m).filter(
    ([k, v]) => k !== "default" && typeof v === "function",
  );
  if (named.length === 1) return named[0][1];
  if (named.length === 0) {
    throw new Error("No component export found in " + ${errMsg});
  }
  throw new Error(
    "Ambiguous exports in " + ${errMsg} + ": " +
      named.map(([k]) => k).join(", ") +
      ". Add a default export, or export only one component.",
  );
}
`;
}

function toImportSpecifier(absPath: string): string {
  // Vite resolves absolute paths on POSIX directly; on Windows it expects /-separated.
  return absPath.split("\\").join("/");
}

function fileBaseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
