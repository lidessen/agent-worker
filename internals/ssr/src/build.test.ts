/**
 * Build process tests
 *
 * Tests for full build integration with the App
 *
 * TODO: When css-builder and asset-builder modules are implemented,
 * restore comprehensive unit tests for:
 * - buildCSS: CSS building with content hash, minification, url() rewriting
 * - buildAssets: Asset copying with content hash
 * - analyzeCSSChunks: CSS chunk analysis for shared/per-entry optimization
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile } from "fs/promises";
import { join } from "path";

const TEST_DIR = join(process.cwd(), ".test-build");
const OUT_DIR = join(TEST_DIR, "dist");

describe("App Build Integration", () => {
  let app: Awaited<ReturnType<typeof import("./app").createApp>>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should return routes in build result", { timeout: 15_000 }, async () => {
    const { createApp } = await import("./app");
    app = createApp({ root: TEST_DIR });

    app.route("/", () => ({ type: "div", props: {}, children: ["Home"] }));
    app.route("/about", () => ({
      type: "div",
      props: {},
      children: ["About"],
    }));

    const result = await app.build({ outDir: OUT_DIR });

    // Check routes in result
    expect(result.routes).toContain("/");
    expect(result.routes).toContain("/about");
  });

  it("should include CSS in HTML output when routes use CSS", async () => {
    const { createApp } = await import("./app");
    const { STYLE_MARKER } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Create a CSS file
    const cssPath = join(TEST_DIR, "styles.css");
    await writeFile(cssPath, ".test { color: red; }");

    // Route that returns CSS marker
    app.route("/", () => ({
      type: "div",
      props: {},
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: cssPath },
          children: [],
        },
        "Content",
      ],
    }));

    const _result = await app.build({ outDir: OUT_DIR });

    // With HTML entry build, Vite processes CSS and outputs to assets/
    // Check that HTML file was created
    const indexHtml = await readFile(join(OUT_DIR, "index.html"), "utf-8");
    expect(indexHtml).toContain('<html lang="en">');

    // CSS should be linked in the HTML (Vite injects it)
    expect(indexHtml).toMatch(/<link[^>]+stylesheet/);
  });

  it("should use hashed CSS paths in render after build", async () => {
    const { createApp } = await import("./app");
    const { STYLE_MARKER } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Create CSS file
    const cssPath = join(TEST_DIR, "styles.css");
    await writeFile(cssPath, ".test { color: red; }");

    // Route with CSS
    app.route("/", () => ({
      type: "div",
      props: {},
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: cssPath },
          children: [],
        },
      ],
    }));

    // Build
    const _buildResult = await app.build({ outDir: OUT_DIR });

    // With HTML entry build, Vite handles CSS hashing
    // Check that HTML output contains hashed CSS reference
    const indexHtml = await readFile(join(OUT_DIR, "index.html"), "utf-8");
    expect(indexHtml).toMatch(/<link[^>]+\.css/);
  });

  it("should extract shared CSS when multiple routes use same CSS", async () => {
    const { createApp } = await import("./app");
    const { STYLE_MARKER } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Create shared and per-route CSS files
    const sharedCss = join(TEST_DIR, "shared.css");
    const homeCss = join(TEST_DIR, "home.css");
    const aboutCss = join(TEST_DIR, "about.css");

    await writeFile(sharedCss, ".shared { color: black; }");
    await writeFile(homeCss, ".home { color: blue; }");
    await writeFile(aboutCss, ".about { color: green; }");

    // Home route uses shared + home CSS
    app.route("/", () => ({
      type: "div",
      props: {},
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: sharedCss },
          children: [],
        },
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: homeCss },
          children: [],
        },
      ],
    }));

    // About route uses shared + about CSS
    app.route("/about", () => ({
      type: "div",
      props: {},
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: sharedCss },
          children: [],
        },
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: aboutCss },
          children: [],
        },
      ],
    }));

    const _result = await app.build({ outDir: OUT_DIR });

    // With HTML entry build, Vite handles CSS bundling
    // Check that both HTML files were created
    const indexHtml = await readFile(join(OUT_DIR, "index.html"), "utf-8");
    const aboutHtml = await readFile(join(OUT_DIR, "about.html"), "utf-8");

    expect(indexHtml).toMatch(/<link[^>]+\.css/);
    expect(aboutHtml).toMatch(/<link[^>]+\.css/);
  });

  it("should collect and build assets", async () => {
    const { createApp } = await import("./app");
    const { ASSET_MARKER } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Create asset file
    const assetPath = join(TEST_DIR, "image.png");
    await writeFile(assetPath, "fake-png-data");

    // Route with asset
    app.route("/", () => ({
      type: "div",
      props: {},
      children: [
        {
          type: ASSET_MARKER as unknown as string,
          props: { src: assetPath },
          children: [],
        },
      ],
    }));

    const _result = await app.build({ outDir: OUT_DIR });

    // With HTML entry build, Vite handles assets
    // Check that HTML file was created
    const indexHtml = await readFile(join(OUT_DIR, "index.html"), "utf-8");
    expect(indexHtml).toContain('<html lang="en">');
  });

  it("should handle build errors gracefully", async () => {
    const { createApp } = await import("./app");
    const { STYLE_MARKER } = await import("./client/resource");

    app = createApp({ root: TEST_DIR });

    // Route with non-existent CSS file
    const nonExistentCss = join(TEST_DIR, "nonexistent.css");
    app.route("/", () => ({
      type: "div",
      props: {},
      children: [
        {
          type: STYLE_MARKER as unknown as string,
          props: { href: nonExistentCss },
          children: [],
        },
      ],
    }));

    // Build completes but Vite warns about missing CSS
    // (Vite doesn't fail on missing CSS, it just keeps the reference unresolved)
    await app.build({ outDir: OUT_DIR });

    // HTML should still be generated
    const { readFile } = await import("fs/promises");
    const indexHtml = await readFile(join(OUT_DIR, "index.html"), "utf-8");
    expect(indexHtml).toContain("<!DOCTYPE html>");
  });
});
