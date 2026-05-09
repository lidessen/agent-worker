import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetConfig, configureTailwind } from "./config";
import {
  // Flat exports - padding
  p0,
  p4,
  ppx,
  px4,
  py4,
  pt4,
  pr4,
  pb4,
  pl4,
  // Flat exports - margin
  m4,
  mx4,
  my4,
  mt4,
  mr4,
  mb4,
  ml4,
  // Flat exports - gap
  gap4,
  gapX4,
  gapY4,
  // Tagged templates
  p,
  m,
  px,
  mx,
  gap,
  // Namespace
  spacing,
} from "./spacing";

describe("flat exports - padding", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("p4 generates correct token", () => {
    expect(p4._).toBe("p-4");
    expect(p4.__cssTemplate).toBe(".p-4 { padding: 1rem; }");
  });

  it("p0 generates correct token", () => {
    expect(p0._).toBe("p-0");
    expect(p0.__cssTemplate).toBe(".p-0 { padding: 0px; }");
  });

  it("ppx generates correct token", () => {
    expect(ppx._).toBe("p-px");
    expect(ppx.__cssTemplate).toBe(".p-px { padding: 1px; }");
  });

  it("p`0.5` generates correct token for decimal (via tagged template)", () => {
    const token = p`0.5`;
    expect(token._).toBe("p-0_5");
    expect(token.__cssTemplate).toContain("padding: 0.5");
  });

  it("px4 generates correct token", () => {
    expect(px4._).toBe("px-4");
    expect(px4.__cssTemplate).toBe(".px-4 { padding-left: 1rem; padding-right: 1rem; }");
  });

  it("py4 generates correct token", () => {
    expect(py4._).toBe("py-4");
    expect(py4.__cssTemplate).toBe(".py-4 { padding-top: 1rem; padding-bottom: 1rem; }");
  });

  it("directional padding generates correct tokens", () => {
    expect(pt4._).toBe("pt-4");
    expect(pr4._).toBe("pr-4");
    expect(pb4._).toBe("pb-4");
    expect(pl4._).toBe("pl-4");
  });
});

describe("flat exports - margin", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("m4 generates correct token", () => {
    expect(m4._).toBe("m-4");
    expect(m4.__cssTemplate).toBe(".m-4 { margin: 1rem; }");
  });

  it("mx4 generates correct token", () => {
    expect(mx4._).toBe("mx-4");
    expect(mx4.__cssTemplate).toBe(".mx-4 { margin-left: 1rem; margin-right: 1rem; }");
  });

  it("my4 generates correct token", () => {
    expect(my4._).toBe("my-4");
    expect(my4.__cssTemplate).toBe(".my-4 { margin-top: 1rem; margin-bottom: 1rem; }");
  });

  it("directional margin generates correct tokens", () => {
    expect(mt4._).toBe("mt-4");
    expect(mr4._).toBe("mr-4");
    expect(mb4._).toBe("mb-4");
    expect(ml4._).toBe("ml-4");
  });
});

describe("flat exports - gap", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("gap4 generates correct token", () => {
    expect(gap4._).toBe("gap-4");
    expect(gap4.__cssTemplate).toBe(".gap-4 { gap: 1rem; }");
  });

  it("gapX4 generates correct token", () => {
    expect(gapX4._).toBe("gap-x-4");
    expect(gapX4.__cssTemplate).toBe(".gap-x-4 { column-gap: 1rem; }");
  });

  it("gapY4 generates correct token", () => {
    expect(gapY4._).toBe("gap-y-4");
    expect(gapY4.__cssTemplate).toBe(".gap-y-4 { row-gap: 1rem; }");
  });
});

describe("spacing namespace", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("spacing.p4 is same as p4", () => {
    expect(spacing.p4).toBe(p4);
    expect(spacing.p4._).toBe("p-4");
  });

  it("spacing.m4 is same as m4", () => {
    expect(spacing.m4).toBe(m4);
    expect(spacing.m4._).toBe("m-4");
  });

  it("spacing.gap4 is same as gap4", () => {
    expect(spacing.gap4).toBe(gap4);
    expect(spacing.gap4._).toBe("gap-4");
  });

  it("includes tagged templates", () => {
    expect(spacing.p).toBe(p);
    expect(spacing.m).toBe(m);
    expect(spacing.gap).toBe(gap);
  });
});

describe("arbitrary values - tagged templates", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("p`10px` generates correct token", () => {
    const token = p`10px`;
    expect(token._).toBe("p-10px");
    expect(token.__cssTemplate).toBe(".p-10px { padding: 10px; }");
  });

  it("m`auto` generates correct token", () => {
    const token = m`auto`;
    expect(token._).toBe("m-auto");
    expect(token.__cssTemplate).toBe(".m-auto { margin: auto; }");
  });

  it("px`20px` generates correct token", () => {
    const token = px`20px`;
    expect(token._).toBe("px-20px");
    expect(token.__cssTemplate).toBe(".px-20px { padding-left: 20px; padding-right: 20px; }");
  });

  it("mx`1rem` generates correct token", () => {
    const token = mx`1rem`;
    expect(token._).toBe("mx-1rem");
    expect(token.__cssTemplate).toBe(".mx-1rem { margin-left: 1rem; margin-right: 1rem; }");
  });

  it("gap`20px` generates correct token", () => {
    const token = gap`20px`;
    expect(token._).toBe("gap-20px");
    expect(token.__cssTemplate).toBe(".gap-20px { gap: 20px; }");
  });

  it("hashes complex arbitrary values", () => {
    const token = p`calc(100% - 40px)`;
    expect(token._).toMatch(/^p-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("calc(100% - 40px)");
  });
});

describe("spacing scale coverage", () => {
  it("includes all standard Tailwind spacing values (no decimals - use tagged template for those)", () => {
    // Note: Decimal values (0.5, 1.5, 2.5, 3.5) are not exported as flat tokens
    // Use tagged template instead: p`0.5`, m`1.5`, etc.
    const expectedKeys = [
      "p0",
      "ppx",
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
      "p10",
      "p11",
      "p12",
      "p14",
      "p16",
      "p20",
      "p24",
      "p28",
      "p32",
      "p36",
      "p40",
      "p44",
      "p48",
      "p52",
      "p56",
      "p60",
      "p64",
      "p72",
      "p80",
      "p96",
    ];

    for (const key of expectedKeys) {
      expect(spacing[key]).toBeDefined();
    }
  });
});

describe("prefix configuration", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  it("respects global prefix for arbitrary values", () => {
    configureTailwind({ prefix: "s-" });

    const token = p`10px`;
    expect(token._).toBe("s-p-10px");
    expect(token.__cssTemplate).toBe(".s-p-10px { padding: 10px; }");
  });
});

describe("token properties", () => {
  it("has __kind property", () => {
    expect(p4.__kind).toBe("style");
    expect(m4.__kind).toBe("style");
  });

  it("has toString method", () => {
    expect(p4.toString()).toBe("p-4");
    expect(m4.toString()).toBe("m-4");
  });
});
