import { describe, it, expect, beforeEach } from "vitest";
import { resetConfig } from "./config";
import {
  // Font size
  textSm,
  textBase,
  textXl,
  text5xl,
  text,
  // Font weight
  fontNormal,
  fontSemibold,
  fontBold,
  // Font family
  fontSans,
  fontMono,
  // Font style
  italic,
  notItalic,
  // Line height
  leadingTight,
  leadingNormal,
  leading6,
  leading,
  // Letter spacing
  trackingTight,
  trackingNormal,
  trackingWidest,
  tracking,
  // Text align
  textLeft,
  textCenter,
  textJustify,
  // Text decoration
  underline,
  lineThrough,
  noUnderline,
  // Text transform
  uppercase,
  lowercase,
  capitalize,
  normalCase,
  // Whitespace
  whitespaceNormal,
  whitespaceNowrap,
  whitespacePre,
  whitespacePreLine,
  // Word break
  breakNormal,
  breakWords,
  breakAll,
  // Truncate
  truncate,
  // Namespace
  typography,
} from "./typography";

describe("font size utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates textBase correctly", () => {
    expect(textBase._).toBe("text-base");
    expect(textBase.__cssTemplate).toBe(".text-base { font-size: 1rem; line-height: 1.5rem; }");
  });

  it("generates textSm correctly", () => {
    expect(textSm._).toBe("text-sm");
    expect(textSm.__cssTemplate).toBe(".text-sm { font-size: 0.875rem; line-height: 1.25rem; }");
  });

  it("generates textXl correctly", () => {
    expect(textXl._).toBe("text-xl");
    expect(textXl.__cssTemplate).toBe(".text-xl { font-size: 1.25rem; line-height: 1.75rem; }");
  });

  it("generates text5xl correctly (line-height: 1)", () => {
    expect(text5xl._).toBe("text-5xl");
    expect(text5xl.__cssTemplate).toBe(".text-5xl { font-size: 3rem; line-height: 1; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = text`20px`;
    expect(token._).toBe("text-20px");
    expect(token.__cssTemplate).toBe(".text-20px { font-size: 20px; }");
  });
});

describe("font weight utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates fontNormal correctly", () => {
    expect(fontNormal._).toBe("font-normal");
    expect(fontNormal.__cssTemplate).toBe(".font-normal { font-weight: 400; }");
  });

  it("generates fontBold correctly", () => {
    expect(fontBold._).toBe("font-bold");
    expect(fontBold.__cssTemplate).toBe(".font-bold { font-weight: 700; }");
  });

  it("generates fontSemibold correctly", () => {
    expect(fontSemibold._).toBe("font-semibold");
    expect(fontSemibold.__cssTemplate).toBe(".font-semibold { font-weight: 600; }");
  });
});

describe("font family utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates fontSans correctly", () => {
    expect(fontSans._).toBe("font-sans");
    expect(fontSans.__cssTemplate).toContain("font-family:");
    expect(fontSans.__cssTemplate).toContain("ui-sans-serif");
  });

  it("generates fontMono correctly", () => {
    expect(fontMono._).toBe("font-mono");
    expect(fontMono.__cssTemplate).toContain("ui-monospace");
  });
});

describe("font style utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates italic correctly", () => {
    expect(italic._).toBe("italic");
    expect(italic.__cssTemplate).toBe(".italic { font-style: italic; }");
  });

  it("generates notItalic correctly", () => {
    expect(notItalic._).toBe("not-italic");
    expect(notItalic.__cssTemplate).toBe(".not-italic { font-style: normal; }");
  });
});

describe("line height utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates leadingNormal correctly", () => {
    expect(leadingNormal._).toBe("leading-normal");
    expect(leadingNormal.__cssTemplate).toBe(".leading-normal { line-height: 1.5; }");
  });

  it("generates leadingTight correctly", () => {
    expect(leadingTight._).toBe("leading-tight");
    expect(leadingTight.__cssTemplate).toBe(".leading-tight { line-height: 1.25; }");
  });

  it("generates leading6 correctly", () => {
    expect(leading6._).toBe("leading-6");
    expect(leading6.__cssTemplate).toBe(".leading-6 { line-height: 1.5rem; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = leading`1.8`;
    expect(token._).toBe("leading-1_8");
    expect(token.__cssTemplate).toBe(".leading-1_8 { line-height: 1.8; }");
  });
});

describe("letter spacing utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates trackingNormal correctly", () => {
    expect(trackingNormal._).toBe("tracking-normal");
    expect(trackingNormal.__cssTemplate).toBe(".tracking-normal { letter-spacing: 0em; }");
  });

  it("generates trackingTight correctly", () => {
    expect(trackingTight._).toBe("tracking-tight");
    expect(trackingTight.__cssTemplate).toBe(".tracking-tight { letter-spacing: -0.025em; }");
  });

  it("generates trackingWidest correctly", () => {
    expect(trackingWidest._).toBe("tracking-widest");
    expect(trackingWidest.__cssTemplate).toBe(".tracking-widest { letter-spacing: 0.1em; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = tracking`0.15em`;
    expect(token._).toBe("tracking-0_15em");
    expect(token.__cssTemplate).toBe(".tracking-0_15em { letter-spacing: 0.15em; }");
  });
});

describe("text align utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates textLeft correctly", () => {
    expect(textLeft._).toBe("text-left");
    expect(textLeft.__cssTemplate).toBe(".text-left { text-align: left; }");
  });

  it("generates textCenter correctly", () => {
    expect(textCenter._).toBe("text-center");
    expect(textCenter.__cssTemplate).toBe(".text-center { text-align: center; }");
  });

  it("generates textJustify correctly", () => {
    expect(textJustify._).toBe("text-justify");
    expect(textJustify.__cssTemplate).toBe(".text-justify { text-align: justify; }");
  });
});

describe("text decoration utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates underline correctly", () => {
    expect(underline._).toBe("underline");
    expect(underline.__cssTemplate).toBe(".underline { text-decoration-line: underline; }");
  });

  it("generates noUnderline correctly", () => {
    expect(noUnderline._).toBe("no-underline");
    expect(noUnderline.__cssTemplate).toBe(".no-underline { text-decoration-line: none; }");
  });

  it("generates lineThrough correctly", () => {
    expect(lineThrough._).toBe("line-through");
    expect(lineThrough.__cssTemplate).toBe(".line-through { text-decoration-line: line-through; }");
  });
});

describe("text transform utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates uppercase correctly", () => {
    expect(uppercase._).toBe("uppercase");
    expect(uppercase.__cssTemplate).toBe(".uppercase { text-transform: uppercase; }");
  });

  it("generates lowercase correctly", () => {
    expect(lowercase._).toBe("lowercase");
  });

  it("generates capitalize correctly", () => {
    expect(capitalize._).toBe("capitalize");
  });

  it("generates normalCase correctly", () => {
    expect(normalCase._).toBe("normal-case");
    expect(normalCase.__cssTemplate).toBe(".normal-case { text-transform: none; }");
  });
});

describe("whitespace utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates whitespaceNormal correctly", () => {
    expect(whitespaceNormal._).toBe("whitespace-normal");
    expect(whitespaceNormal.__cssTemplate).toBe(".whitespace-normal { white-space: normal; }");
  });

  it("generates whitespaceNowrap correctly", () => {
    expect(whitespaceNowrap._).toBe("whitespace-nowrap");
    expect(whitespaceNowrap.__cssTemplate).toBe(".whitespace-nowrap { white-space: nowrap; }");
  });

  it("generates whitespacePre correctly", () => {
    expect(whitespacePre._).toBe("whitespace-pre");
  });

  it("generates whitespacePreLine correctly", () => {
    expect(whitespacePreLine._).toBe("whitespace-pre-line");
    expect(whitespacePreLine.__cssTemplate).toBe(".whitespace-pre-line { white-space: pre-line; }");
  });
});

describe("word break utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates breakNormal correctly", () => {
    expect(breakNormal._).toBe("break-normal");
    expect(breakNormal.__cssTemplate).toBe(".break-normal { overflow-wrap: normal; }");
  });

  it("generates breakWords correctly", () => {
    expect(breakWords._).toBe("break-words");
    expect(breakWords.__cssTemplate).toBe(".break-words { overflow-wrap: break-word; }");
  });

  it("generates breakAll correctly", () => {
    expect(breakAll._).toBe("break-all");
  });
});

describe("truncate utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates truncate correctly (combines multiple properties)", () => {
    expect(truncate._).toBe("truncate");
    expect(truncate.__cssTemplate).toBe(
      ".truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    );
  });
});

describe("typography namespace", () => {
  it("has all font size tokens", () => {
    expect(typography.textBase).toBe(textBase);
    expect(typography.textSm).toBe(textSm);
    expect(typography.textXl).toBe(textXl);
  });

  it("has all font weight tokens", () => {
    expect(typography.fontBold).toBe(fontBold);
    expect(typography.fontNormal).toBe(fontNormal);
  });

  it("has tagged templates", () => {
    expect(typography.text).toBe(text);
    expect(typography.leading).toBe(leading);
    expect(typography.tracking).toBe(tracking);
  });
});

describe("token properties", () => {
  it("has __kind property", () => {
    expect(textBase.__kind).toBe("style");
    expect(fontBold.__kind).toBe("style");
  });

  it("has toString method", () => {
    expect(textBase.toString()).toBe("text-base");
    expect(fontBold.toString()).toBe("font-bold");
  });
});
