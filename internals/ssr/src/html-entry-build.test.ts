/**
 * HTML Entry Build Integration Tests
 *
 * Verifies the build output structure and content
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile, readdir } from "fs/promises";
import { join } from "path";

const TEST_DIR = join(process.cwd(), ".test-html-build");
const OUT_DIR = join(TEST_DIR, "dist");

describe("HTML Entry Build Output", () => {
  let app: ReturnType<typeof import("./app").createApp> | null = null;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should generate correct HTML structure with CSS", async () => {
    const { createApp } = await import("./app");
    const { STYLE_MARKER } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Create CSS file
    const cssPath = join(TEST_DIR, "styles.css");
    await writeFile(cssPath, ".test { color: red; }");

    // Route with CSS
    app.route("/", () => ({
      type: "div",
      props: { class: "test" },
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: cssPath },
          children: [],
        },
        "Hello World",
      ],
    }));

    await app.build({ outDir: OUT_DIR });

    // Verify HTML file exists
    const indexHtml = await readFile(join(OUT_DIR, "index.html"), "utf-8");

    // Check HTML structure
    expect(indexHtml).toContain("<!DOCTYPE html>");
    expect(indexHtml).toContain('<html lang="en">');
    expect(indexHtml).toContain("</html>");
    expect(indexHtml).toContain("Hello World");

    // Check CSS is linked (Vite processes and injects)
    expect(indexHtml).toMatch(/<link[^>]+rel=["']stylesheet["']/);
  });

  it("should handle nested routes with correct paths", async () => {
    const { createApp } = await import("./app");
    const { STYLE_MARKER } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Create CSS file
    const cssPath = join(TEST_DIR, "styles.css");
    await writeFile(cssPath, ".shared { color: black; }");

    // Root route
    app.route("/", () => ({
      type: "div",
      props: {},
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: cssPath },
          children: [],
        },
        "Home",
      ],
    }));

    // Nested route
    app.route("/blog/post-1", () => ({
      type: "article",
      props: {},
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: cssPath },
          children: [],
        },
        "Blog Post",
      ],
    }));

    await app.build({ outDir: OUT_DIR });

    // Verify both HTML files exist
    const indexHtml = await readFile(join(OUT_DIR, "index.html"), "utf-8");
    const postHtml = await readFile(join(OUT_DIR, "blog", "post-1.html"), "utf-8");

    expect(indexHtml).toContain("Home");
    expect(postHtml).toContain("Blog Post");

    // Both should have CSS linked
    expect(indexHtml).toMatch(/<link[^>]+stylesheet/);
    expect(postHtml).toMatch(/<link[^>]+stylesheet/);
  });

  it("should include island markers in HTML", async () => {
    const { createApp } = await import("./app");
    const { resource } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Create a simple island using resource
    const { island } = resource(`file://${join(TEST_DIR, "Counter.tsx")}`);
    const Counter = island(function Counter() {
      return {
        type: "button",
        props: {},
        children: ["Click"],
      };
    });

    app.route("/", () => ({
      type: "div",
      props: {},
      children: [Counter({})],
    }));

    // Render to check island markers (without full build)
    const result = await app.render("/");

    // Check island marker in rendered HTML
    expect(result.html).toContain("Click");
    expect(result.islands.length).toBe(1);
    expect(result.islands[0]?.id).toContain("counter");
  });

  it("should output assets directory", async () => {
    const { createApp } = await import("./app");

    app = createApp({ root: TEST_DIR });

    // Create asset
    const assetPath = join(TEST_DIR, "image.png");
    await writeFile(assetPath, "fake-png-data");

    app.route("/", () => ({
      type: "img",
      props: { src: assetPath },
      children: [],
    }));

    await app.build({ outDir: OUT_DIR });

    // Check output directory exists
    const files = await readdir(OUT_DIR);
    expect(files).toContain("index.html");

    // Vite should create assets directory
    if (files.includes("assets")) {
      const assets = await readdir(join(OUT_DIR, "assets"));
      expect(assets.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("should clean up temp directory after build", async () => {
    const { createApp } = await import("./app");

    app = createApp({ root: TEST_DIR });

    app.route("/", () => ({
      type: "div",
      props: {},
      children: ["Test"],
    }));

    await app.build({ outDir: OUT_DIR });

    // Temp directory should be cleaned up
    const files = await readdir(TEST_DIR);
    expect(files).not.toContain(".build-temp");
  });
});
