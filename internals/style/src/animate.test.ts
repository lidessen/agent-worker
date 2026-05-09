import { describe, it, expect } from "vitest";
import { isStyleToken } from "./rule";
import { isKeyframeRef } from "./keyframes";
import {
  fadeInKf,
  fadeOutKf,
  slideUpKf,
  slideDownKf,
  slideLeftKf,
  slideRightKf,
  scaleInKf,
  scaleOutKf,
  spinKf,
  pingKf,
  pulseKf,
  bounceKf,
  fadeIn,
  fadeOut,
  slideUp,
  slideDown,
  slideLeft,
  slideRight,
  scaleIn,
  scaleOut,
  spin,
  ping,
  pulse,
  bounce,
} from "./animate";

describe("keyframe definitions", () => {
  it("all keyframe refs are valid KeyframeRef objects", () => {
    const kfs = [
      fadeInKf,
      fadeOutKf,
      slideUpKf,
      slideDownKf,
      slideLeftKf,
      slideRightKf,
      scaleInKf,
      scaleOutKf,
      spinKf,
      pingKf,
      pulseKf,
      bounceKf,
    ];

    for (const kf of kfs) {
      expect(isKeyframeRef(kf)).toBe(true);
      expect(kf.name).toMatch(/^kf-/);
      expect(kf.css).toContain("@keyframes");
    }
  });

  it("fadeInKf has correct content", () => {
    expect(fadeInKf.css).toContain("opacity: 0");
    expect(fadeInKf.css).toContain("opacity: 1");
  });

  it("fadeOutKf has correct content", () => {
    expect(fadeOutKf.css).toContain("opacity: 1");
    expect(fadeOutKf.css).toContain("opacity: 0");
  });

  it("slideUpKf has correct content", () => {
    expect(slideUpKf.css).toContain("translateY(10px)");
    expect(slideUpKf.css).toContain("translateY(0)");
  });

  it("slideDownKf has correct content", () => {
    expect(slideDownKf.css).toContain("translateY(-10px)");
    expect(slideDownKf.css).toContain("translateY(0)");
  });

  it("spinKf has correct content", () => {
    expect(spinKf.css).toContain("rotate(0deg)");
    expect(spinKf.css).toContain("rotate(360deg)");
  });

  it("bounceKf has correct content", () => {
    expect(bounceKf.css).toContain("translateY(-25%)");
    expect(bounceKf.css).toContain("translateY(0)");
  });

  it("all keyframe names are unique", () => {
    const kfs = [
      fadeInKf,
      fadeOutKf,
      slideUpKf,
      slideDownKf,
      slideLeftKf,
      slideRightKf,
      scaleInKf,
      scaleOutKf,
      spinKf,
      pingKf,
      pulseKf,
      bounceKf,
    ];
    const names = kfs.map((kf) => kf.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe("animation tokens", () => {
  it("all animation tokens are valid StyleTokens", () => {
    const anims = [
      fadeIn,
      fadeOut,
      slideUp,
      slideDown,
      slideLeft,
      slideRight,
      scaleIn,
      scaleOut,
      spin,
      ping,
      pulse,
      bounce,
    ];

    for (const anim of anims) {
      expect(isStyleToken(anim)).toBe(true);
    }
  });

  it("animation tokens contain keyframes CSS", () => {
    expect(fadeIn.__cssTemplate).toContain("@keyframes");
    expect(slideUp.__cssTemplate).toContain("@keyframes");
    expect(spin.__cssTemplate).toContain("@keyframes");
  });

  it("animation tokens contain animation property", () => {
    expect(fadeIn.__cssTemplate).toContain("animation:");
    expect(fadeOut.__cssTemplate).toContain("animation:");
    expect(slideUp.__cssTemplate).toContain("animation:");
    expect(spin.__cssTemplate).toContain("animation:");
  });

  it("fadeIn includes ease-out timing", () => {
    expect(fadeIn.__cssTemplate).toContain("ease-out");
  });

  it("fadeOut includes ease-in timing", () => {
    expect(fadeOut.__cssTemplate).toContain("ease-in");
  });

  it("spin includes infinite and linear", () => {
    expect(spin.__cssTemplate).toContain("linear");
    expect(spin.__cssTemplate).toContain("infinite");
  });

  it("pulse includes infinite", () => {
    expect(pulse.__cssTemplate).toContain("infinite");
  });

  it("bounce includes infinite", () => {
    expect(bounce.__cssTemplate).toContain("infinite");
  });
});
