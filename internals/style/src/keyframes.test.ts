import { describe, it, expect } from "vitest";
import { keyframes, keyframesToken, isKeyframeRef } from "./keyframes";
import { isStyleToken } from "./rule";

describe("keyframes", () => {
  it("creates a keyframe ref with generated name", () => {
    const fadeIn = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;

    expect(fadeIn.name).toMatch(/^kf-/);
    expect(fadeIn.css).toContain("@keyframes");
    expect(fadeIn.css).toContain("from { opacity: 0; }");
    expect(fadeIn.css).toContain("to { opacity: 1; }");
  });

  it("stringifies to animation name", () => {
    const spin = keyframes`
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    `;

    expect(spin.toString()).toBe(spin.name);
    expect(`animation: ${spin} 1s linear infinite`).toBe(
      `animation: ${spin.name} 1s linear infinite`,
    );
  });

  it("produces deterministic names for same content", () => {
    const a = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;
    const b = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;

    expect(a.name).toBe(b.name);
  });

  it("produces different names for different content", () => {
    const fadeIn = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;
    const fadeOut = keyframes`
      from { opacity: 1; }
      to { opacity: 0; }
    `;

    expect(fadeIn.name).not.toBe(fadeOut.name);
  });

  it("supports interpolation in keyframes body", () => {
    const startDeg = 0;
    const endDeg = 360;

    const spin = keyframes`
      from { transform: rotate(${startDeg}deg); }
      to { transform: rotate(${endDeg}deg); }
    `;

    expect(spin.css).toContain("rotate(0deg)");
    expect(spin.css).toContain("rotate(360deg)");
  });

  it("supports percentage-based keyframes", () => {
    const pulse = keyframes`
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    `;

    expect(pulse.css).toContain("0% { transform: scale(1); }");
    expect(pulse.css).toContain("50% { transform: scale(1.05); }");
    expect(pulse.css).toContain("100% { transform: scale(1); }");
  });

  it("wraps content in @keyframes block", () => {
    const fadeIn = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;

    expect(fadeIn.css).toMatch(/^@keyframes kf-\w+ \{/);
    expect(fadeIn.css).toMatch(/\}$/);
  });
});

describe("isKeyframeRef", () => {
  it("returns true for keyframe refs", () => {
    const ref = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    expect(isKeyframeRef(ref)).toBe(true);
  });

  it("returns false for non-keyframe values", () => {
    expect(isKeyframeRef(null)).toBe(false);
    expect(isKeyframeRef(undefined)).toBe(false);
    expect(isKeyframeRef("string")).toBe(false);
    expect(isKeyframeRef(42)).toBe(false);
    expect(isKeyframeRef({})).toBe(false);
  });
});

describe("keyframesToken", () => {
  it("creates a StyleToken from a KeyframeRef", () => {
    const fadeIn = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;
    const token = keyframesToken(fadeIn);

    expect(isStyleToken(token)).toBe(true);
    expect(token.__cssTemplate).toBe(fadeIn.css);
    expect(token._).toBeUndefined();
  });

  it("token stringifies to empty string", () => {
    const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    const token = keyframesToken(fadeIn);
    expect(token.toString()).toBe("");
  });
});

describe("keyframes in rule templates", () => {
  it("can be used in template string interpolation", () => {
    const spin = keyframes`
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    `;

    // Simulating what happens in rule``
    const css = `.spinner { animation: ${spin} 1s linear infinite; }`;
    expect(css).toContain(spin.name);
    expect(css).toMatch(/animation: kf-\w+ 1s linear infinite/);
  });
});
