/**
 * Client resource tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setManifest,
  getManifest,
  resolveCSS,
  resolveAsset,
  clientResource,
} from "./client-resource";

describe("Client Resource", () => {
  beforeEach(() => {
    // Reset manifest before each test
    setManifest({
      css: {},
      assets: {},
    });
  });

  describe("setManifest/getManifest", () => {
    it("should set and get manifest", () => {
      const manifest = {
        css: { "src/styles.css": "/_semajsx/css/styles-abc123.css" },
        assets: { "src/icon.png": "/_semajsx/assets/icon-def456.png" },
      };

      setManifest(manifest);
      expect(getManifest()).toEqual(manifest);
    });
  });

  describe("resolveCSS", () => {
    it("should resolve CSS path from manifest", () => {
      setManifest({
        css: { "src/styles.css": "/_semajsx/css/styles-abc123.css" },
        assets: {},
      });

      expect(resolveCSS("src/styles.css")).toBe("/_semajsx/css/styles-abc123.css");
    });

    it("should strip leading slash for lookup", () => {
      setManifest({
        css: { "src/styles.css": "/_semajsx/css/styles-abc123.css" },
        assets: {},
      });

      expect(resolveCSS("/src/styles.css")).toBe("/_semajsx/css/styles-abc123.css");
    });

    it("should return original path if not in manifest", () => {
      setManifest({
        css: {},
        assets: {},
      });

      expect(resolveCSS("src/unknown.css")).toBe("src/unknown.css");
    });

    it("should return original path if no manifest", () => {
      // Clear manifest
      setManifest(null as unknown as { css: {}; assets: {} });
      expect(resolveCSS("src/styles.css")).toBe("src/styles.css");
    });
  });

  describe("resolveAsset", () => {
    it("should resolve asset path from manifest", () => {
      setManifest({
        css: {},
        assets: { "src/icon.png": "/_semajsx/assets/icon-abc123.png" },
      });

      expect(resolveAsset("src/icon.png")).toBe("/_semajsx/assets/icon-abc123.png");
    });

    it("should strip leading slash for lookup", () => {
      setManifest({
        css: {},
        assets: { "src/icon.png": "/_semajsx/assets/icon-abc123.png" },
      });

      expect(resolveAsset("/src/icon.png")).toBe("/_semajsx/assets/icon-abc123.png");
    });

    it("should return original path if not in manifest", () => {
      setManifest({
        css: {},
        assets: {},
      });

      expect(resolveAsset("src/unknown.png")).toBe("src/unknown.png");
    });
  });

  describe("clientResource", () => {
    it("should provide Style and url functions", () => {
      const { Style, url } = clientResource();

      expect(typeof Style).toBe("function");
      expect(typeof url).toBe("function");
    });

    it("should resolve asset URLs", () => {
      setManifest({
        css: {},
        assets: { "src/icon.png": "/_semajsx/assets/icon-abc123.png" },
      });

      const { url } = clientResource();
      expect(url("src/icon.png")).toBe("/_semajsx/assets/icon-abc123.png");
    });

    it("Style should return null in non-browser environment", () => {
      const { Style } = clientResource();
      expect(Style({ href: "src/styles.css" })).toBeNull();
    });
  });
});
