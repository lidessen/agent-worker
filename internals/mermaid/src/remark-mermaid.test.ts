import { describe, it, expect } from "vitest";
import { remarkMermaid } from "./remark-mermaid";

function makeCodeNode(lang: string, value: string, meta?: string) {
  return { type: "code" as const, lang, value, meta: meta ?? null };
}

function makeTree(children: unknown[]) {
  return { type: "root", children };
}

describe("remarkMermaid", () => {
  const transform = remarkMermaid();

  it("transforms mermaid code blocks into Mermaid JSX elements", () => {
    const tree = makeTree([makeCodeNode("mermaid", "graph TD\n  A --> B")]);
    transform(tree);
    expect(tree.children[0]).toMatchObject({
      type: "mdxJsxFlowElement",
      name: "Mermaid",
      attributes: [{ type: "mdxJsxAttribute", name: "code", value: "graph TD\n  A --> B" }],
    });
  });

  it("leaves non-mermaid code blocks untouched", () => {
    const tree = makeTree([makeCodeNode("typescript", "const x = 1;")]);
    transform(tree);
    expect(tree.children[0]).toMatchObject({ type: "code", lang: "typescript" });
  });

  it("skips transformation when meta contains 'raw'", () => {
    const tree = makeTree([makeCodeNode("mermaid", "graph TD\n  A --> B", "raw")]);
    transform(tree);
    // Should remain as a code block, not transformed
    expect(tree.children[0]).toMatchObject({ type: "code", lang: "mermaid", meta: "raw" });
  });

  it("skips transformation when raw appears among other meta flags", () => {
    const tree = makeTree([makeCodeNode("mermaid", "graph TD\n  A --> B", "title=example raw")]);
    transform(tree);
    expect(tree.children[0]).toMatchObject({ type: "code", lang: "mermaid" });
  });

  it("transforms when meta does not contain raw", () => {
    const tree = makeTree([makeCodeNode("mermaid", "graph TD\n  A --> B", "live")]);
    transform(tree);
    expect(tree.children[0]).toMatchObject({
      type: "mdxJsxFlowElement",
      name: "Mermaid",
    });
  });

  it("handles nested structures", () => {
    const tree = makeTree([
      {
        type: "paragraph",
        children: [makeCodeNode("mermaid", "sequenceDiagram\n  A->>B: Hi")],
      },
    ]);
    transform(tree);
    const inner = (tree.children[0] as { children: unknown[] }).children[0];
    expect(inner).toMatchObject({ type: "mdxJsxFlowElement", name: "Mermaid" });
  });
});
