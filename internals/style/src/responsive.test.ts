import { describe, it, expect } from "vitest";
import { defineBreakpoints, breakpoints, media, container } from "./responsive";
import { classes } from "./classes";
import { rule, isStyleToken } from "./rule";

describe("defineBreakpoints", () => {
  it("creates breakpoint refs with correct values", () => {
    const bp = defineBreakpoints({
      sm: "640px",
      md: "768px",
      lg: "1024px",
    });

    expect(bp.sm.value).toBe("640px");
    expect(bp.md.value).toBe("768px");
    expect(bp.lg.value).toBe("1024px");
  });

  it("generates min-width media queries", () => {
    const bp = defineBreakpoints({
      md: "768px",
    });

    expect(bp.md.min).toBe("(min-width: 768px)");
  });

  it("generates max-width media queries with subtracted pixel", () => {
    const bp = defineBreakpoints({
      md: "768px",
    });

    expect(bp.md.max).toBe("(max-width: 767.98px)");
  });

  it("stringifies to min-width media query", () => {
    const bp = defineBreakpoints({
      lg: "1024px",
    });

    expect(bp.lg.toString()).toBe("(min-width: 1024px)");
    expect(`@media ${bp.lg}`).toBe("@media (min-width: 1024px)");
  });

  it("handles rem units", () => {
    const bp = defineBreakpoints({
      md: "48rem",
    });

    expect(bp.md.min).toBe("(min-width: 48rem)");
    expect(bp.md.max).toBe("(max-width: 47.98rem)");
  });

  it("handles em units", () => {
    const bp = defineBreakpoints({
      md: "48em",
    });

    expect(bp.md.min).toBe("(min-width: 48em)");
    expect(bp.md.max).toBe("(max-width: 47.98em)");
  });
});

describe("default breakpoints", () => {
  it("has all Tailwind default breakpoints", () => {
    expect(breakpoints.sm.value).toBe("640px");
    expect(breakpoints.md.value).toBe("768px");
    expect(breakpoints.lg.value).toBe("1024px");
    expect(breakpoints.xl.value).toBe("1280px");
    expect(breakpoints["2xl"].value).toBe("1536px");
  });

  it("all breakpoints have min and max queries", () => {
    const bpNames = ["sm", "md", "lg", "xl", "2xl"] as const;

    for (const name of bpNames) {
      const bp = breakpoints[name];
      expect(bp.min).toContain("min-width");
      expect(bp.max).toContain("max-width");
    }
  });
});

describe("media", () => {
  const c = classes(["root", "sidebar"]);

  it("wraps a single rule in @media block", () => {
    const token = media(breakpoints.md, rule`${c.root} { padding: 16px; }`);

    expect(isStyleToken(token)).toBe(true);
    expect(token.__cssTemplate).toContain("@media (min-width: 768px)");
    expect(token.__cssTemplate).toContain("padding: 16px");
  });

  it("wraps multiple rules in @media block", () => {
    const token = media(
      breakpoints.lg,
      rule`${c.root} { display: grid; }`,
      rule`${c.sidebar} { width: 300px; }`,
    );

    expect(token.__cssTemplate).toContain("@media (min-width: 1024px)");
    expect(token.__cssTemplate).toContain("display: grid");
    expect(token.__cssTemplate).toContain("width: 300px");
  });

  it("accepts string query directly", () => {
    const token = media("(prefers-color-scheme: dark)", rule`${c.root} { background: #1a1a2e; }`);

    expect(token.__cssTemplate).toContain("@media (prefers-color-scheme: dark)");
    expect(token.__cssTemplate).toContain("background: #1a1a2e");
  });

  it("accepts BreakpointRef object", () => {
    const token = media(breakpoints.md, rule`${c.root} { font-size: 18px; }`);

    expect(token.__cssTemplate).toContain("@media (min-width: 768px)");
  });

  it("works with max-width breakpoints", () => {
    const token = media(breakpoints.md.max, rule`${c.root} { flex-direction: column; }`);

    expect(token.__cssTemplate).toContain("@media (max-width: 767.98px)");
    expect(token.__cssTemplate).toContain("flex-direction: column");
  });

  it("token has no class name", () => {
    const token = media(breakpoints.md, rule`${c.root} { padding: 16px; }`);

    expect(token._).toBeUndefined();
    expect(token.toString()).toBe("");
  });
});

describe("container", () => {
  const c = classes(["root"]);

  it("wraps rules in @container block", () => {
    const token = container(
      "(min-width: 600px)",
      rule`${c.root} { display: grid; grid-template-columns: 1fr 1fr; }`,
    );

    expect(isStyleToken(token)).toBe(true);
    expect(token.__cssTemplate).toContain("@container (min-width: 600px)");
    expect(token.__cssTemplate).toContain("display: grid");
  });

  it("wraps multiple rules", () => {
    const c2 = classes(["sidebar"]);
    const token = container(
      "(min-width: 800px)",
      rule`${c.root} { display: grid; }`,
      rule`${c2.sidebar} { width: 250px; }`,
    );

    expect(token.__cssTemplate).toContain("@container (min-width: 800px)");
    expect(token.__cssTemplate).toContain("display: grid");
    expect(token.__cssTemplate).toContain("width: 250px");
  });

  it("token has no class name", () => {
    const token = container("(min-width: 600px)", rule`${c.root} { padding: 16px; }`);

    expect(token._).toBeUndefined();
    expect(token.toString()).toBe("");
  });
});

describe("breakpoints in rule templates", () => {
  it("breakpoints can be interpolated in template strings", () => {
    const query = `@media ${breakpoints.md} { .test { padding: 16px; } }`;
    expect(query).toBe("@media (min-width: 768px) { .test { padding: 16px; } }");
  });

  it("max breakpoints can be interpolated", () => {
    const query = `@media ${breakpoints.md.max} { .test { padding: 8px; } }`;
    expect(query).toBe("@media (max-width: 767.98px) { .test { padding: 8px; } }");
  });
});
