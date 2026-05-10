/**
 * Tests for virtual modules plugin
 */

import { describe, it, expect } from "vitest";
import { resolve, normalize } from "path";
import { virtualModules } from "./virtual-modules";

describe("Virtual Modules Plugin", () => {
  it("should resolve absolute paths", () => {
    const modules = {
      "/home/user/test/index.html": "<html>test</html>",
    };

    const plugin = virtualModules(modules);

    // Test resolveId
    const resolveId = plugin.resolveId as (id: string) => string | null;
    const result = resolveId("/home/user/test/index.html");

    expect(result).toBe(normalize("/home/user/test/index.html"));
  });

  it("should resolve bare specifiers against viteRoot", () => {
    const cwd = process.cwd();
    const absolutePath = resolve(cwd, "test/index.html");

    const modules = {
      [absolutePath]: "<html>test</html>",
    };

    const plugin = virtualModules(modules);
    const resolveId = plugin.resolveId as (id: string) => string | null;

    // Bare specifiers (no /, ./, or ../ prefix) should resolve against viteRoot
    // This is different from relative paths like ./test/index.html which
    // require an importer context to resolve properly
    const result = resolveId("test/index.html");

    expect(result).toBe(normalize(absolutePath));
  });

  it("should handle paths with different cwd", () => {
    // Simulate what happens in build()
    const rootDir = "/Users/test/examples/basic";
    const htmlFileName = "index.html";
    const absoluteHtmlPath = resolve(rootDir, htmlFileName);

    console.log("absoluteHtmlPath:", absoluteHtmlPath);

    const modules = {
      [absoluteHtmlPath]: "<html>test</html>",
    };

    const plugin = virtualModules(modules);
    const resolveId = plugin.resolveId as (id: string) => string | null;

    // Should resolve the absolute path
    const result = resolveId(absoluteHtmlPath);
    expect(result).toBe(normalize(absoluteHtmlPath));
  });

  it("should load content for resolved modules", () => {
    const modules = {
      "/home/user/test/index.html": "<html>content</html>",
    };

    const plugin = virtualModules(modules);
    const load = plugin.load as (id: string) => string | null;

    const content = load("/home/user/test/index.html");
    expect(content).toBe("<html>content</html>");
  });

  it("should trace actual build flow", () => {
    // This simulates what build() does
    const rootDir = process.cwd(); // In user's case this might be examples/basic
    const path = "/";
    const htmlFileName = path === "/" ? "index.html" : `${path.replace(/^\//, "")}.html`;
    const absoluteHtmlPath = resolve(rootDir, htmlFileName);

    console.log("rootDir:", rootDir);
    console.log("htmlFileName:", htmlFileName);
    console.log("absoluteHtmlPath:", absoluteHtmlPath);

    const modules: Record<string, string> = {};
    const htmlInputs: Record<string, string> = {};

    modules[absoluteHtmlPath] = "<html>test</html>";
    htmlInputs[htmlFileName.replace(".html", "")] = absoluteHtmlPath;

    console.log("modules keys:", Object.keys(modules));
    console.log("htmlInputs:", htmlInputs);

    // Verify the input value is absolute
    expect(htmlInputs["index"].startsWith("/")).toBe(true);

    const plugin = virtualModules(modules);
    const resolveId = plugin.resolveId as (id: string) => string | null;

    // Rollup will try to resolve the input value
    const result = resolveId(htmlInputs["index"]);
    expect(result).toBe(normalize(absoluteHtmlPath));
  });

  it("should handle relative rootDir scenario", () => {
    // What if rootDir is relative?
    const rootDir = "examples/basic"; // Relative path!
    const htmlFileName = "index.html";
    const absoluteHtmlPath = resolve(rootDir, htmlFileName);

    console.log("relative rootDir case:");
    console.log("rootDir:", rootDir);
    console.log("absoluteHtmlPath:", absoluteHtmlPath);
    console.log("is absolute:", absoluteHtmlPath.startsWith("/"));

    // resolve() should make it absolute based on cwd
    expect(absoluteHtmlPath.startsWith("/")).toBe(true);
  });

  it("should simulate actual build with relative config.root", () => {
    // Simulates: createApp({ root: "examples/basic" })
    const configRoot = "examples/basic";

    // The fix: always resolve to absolute
    const rootDir = configRoot ? resolve(configRoot) : process.cwd();

    console.log("config.root:", configRoot);
    console.log("resolved rootDir:", rootDir);

    const htmlFileName = "index.html";
    const absoluteHtmlPath = resolve(rootDir, htmlFileName);

    console.log("absoluteHtmlPath:", absoluteHtmlPath);

    // Both should be absolute
    expect(rootDir.startsWith("/")).toBe(true);
    expect(absoluteHtmlPath.startsWith("/")).toBe(true);

    // Create modules and verify plugin can resolve
    const modules = {
      [absoluteHtmlPath]: "<html>test</html>",
    };

    const plugin = virtualModules(modules);
    const resolveId = plugin.resolveId as (id: string) => string | null;

    const result = resolveId(absoluteHtmlPath);
    expect(result).toBe(normalize(absoluteHtmlPath));
  });
});
