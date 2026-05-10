/** @jsxImportSource @semajsx/dom */

import { describe, expect, it } from "vitest";
import { renderToString } from "@semajsx/ssr";
import { Icon } from "./component";
import { lucide } from "./index";

// =============================================================================
// Icon component (server-side rendering path)
// =============================================================================

describe("Icon component", () => {
  it("renders a known icon as SVG", async () => {
    const result = await renderToString(<Icon name="rocket" />);

    expect(result.html).toContain("<svg");
    expect(result.html).toContain("</svg>");
    expect(result.html).toContain('class="lucide lucide-rocket"');
  });

  it("renders SVG path children from lucide IconNode data", async () => {
    const result = await renderToString(<Icon name="rocket" />);

    expect(result.html).toContain("<path");
    // Rocket icon has 4 path elements
    const pathCount = (result.html.match(/<path/g) || []).length;
    expect(pathCount).toBe(4);
  });

  it("applies default SVG attributes", async () => {
    const result = await renderToString(<Icon name="rocket" />);

    expect(result.html).toContain('width="24"');
    expect(result.html).toContain('height="24"');
    expect(result.html).toContain('viewBox="0 0 24 24"');
    expect(result.html).toContain('fill="none"');
    expect(result.html).toContain('stroke="currentColor"');
    expect(result.html).toContain('stroke-width="2"');
    expect(result.html).toContain('stroke-linecap="round"');
    expect(result.html).toContain('stroke-linejoin="round"');
  });

  it("applies custom size", async () => {
    const result = await renderToString(<Icon name="rocket" size={20} />);

    expect(result.html).toContain('width="20"');
    expect(result.html).toContain('height="20"');
  });

  it("applies custom color", async () => {
    const result = await renderToString(<Icon name="rocket" color="#007aff" />);

    expect(result.html).toContain('stroke="#007aff"');
    expect(result.html).not.toContain('stroke="currentColor"');
  });

  it("applies custom strokeWidth", async () => {
    const result = await renderToString(<Icon name="rocket" strokeWidth={1.5} />);

    expect(result.html).toContain('stroke-width="1.5"');
  });

  it("applies custom class alongside default classes", async () => {
    const result = await renderToString(<Icon name="rocket" class="my-icon" />);

    expect(result.html).toContain('class="lucide lucide-rocket my-icon"');
  });

  it("renders fallback for unknown icon", async () => {
    const result = await renderToString(<Icon name="nonexistent-icon-xyz" />);

    expect(result.html).toContain("lucide-icon-missing");
    expect(result.html).toContain("?");
    expect(result.html).not.toContain("<svg");
  });

  it("handles kebab-case icon names", async () => {
    const result = await renderToString(<Icon name="arrow-right" />);

    expect(result.html).toContain("<svg");
    expect(result.html).toContain('class="lucide lucide-arrow-right"');
  });

  it("handles single-word icon names", async () => {
    const result = await renderToString(<Icon name="home" />);

    expect(result.html).toContain("<svg");
    expect(result.html).toContain('class="lucide lucide-home"');
  });

  it("combines all custom props", async () => {
    const result = await renderToString(
      <Icon name="rocket" size={16} color="red" strokeWidth={3} class="small" />,
    );

    expect(result.html).toContain('width="16"');
    expect(result.html).toContain('height="16"');
    expect(result.html).toContain('stroke="red"');
    expect(result.html).toContain('stroke-width="3"');
    expect(result.html).toContain('class="lucide lucide-rocket small"');
  });
});

// =============================================================================
// SSR #native VNode handling
// =============================================================================

describe("SSR #native support", () => {
  it("serializes native node with outerHTML", async () => {
    const nativeVNode = {
      type: "#native" as const,
      props: {
        __nativeNode: {
          outerHTML: '<svg class="test"><path d="M0 0"/></svg>',
        },
      },
      children: [],
    };

    const result = await renderToString(nativeVNode);

    expect(result.html).toBe('<svg class="test"><path d="M0 0"/></svg>');
  });

  it("returns empty string for native node without outerHTML", async () => {
    const nativeVNode = {
      type: "#native" as const,
      props: { __nativeNode: {} },
      children: [],
    };

    const result = await renderToString(nativeVNode);

    expect(result.html).toBe("");
  });

  it("returns empty string for native node with null element", async () => {
    const nativeVNode = {
      type: "#native" as const,
      props: { __nativeNode: null },
      children: [],
    };

    const result = await renderToString(nativeVNode);

    expect(result.html).toBe("");
  });
});

// =============================================================================
// lucide() plugin
// =============================================================================

describe("lucide() plugin", () => {
  it("returns SSGPlugin with name and config hook", () => {
    const plugin = lucide();

    expect(plugin.name).toBe("lucide");
    expect(plugin.config).toBeTypeOf("function");
  });

  it("config hook returns Icon component", () => {
    const plugin = lucide();
    const partial = plugin.config!({} as never);

    expect(partial).toBeDefined();
    expect(partial!.mdx!.components!.Icon).toBe(Icon);
  });

  it("uses original Icon when no options provided", () => {
    const plugin = lucide();
    const partial = plugin.config!({} as never);

    expect(partial!.mdx!.components!.Icon).toBe(Icon);
  });

  it("wraps Icon with custom default size", async () => {
    const plugin = lucide({ size: 16 });
    const partial = plugin.config!({} as never);
    const WrappedIcon = partial!.mdx!.components!.Icon;

    const result = await renderToString(<WrappedIcon name="rocket" />);

    expect(result.html).toContain('width="16"');
    expect(result.html).toContain('height="16"');
  });

  it("wraps Icon with custom default color", async () => {
    const plugin = lucide({ color: "#333" });
    const partial = plugin.config!({} as never);
    const WrappedIcon = partial!.mdx!.components!.Icon;

    const result = await renderToString(<WrappedIcon name="rocket" />);

    expect(result.html).toContain('stroke="#333"');
  });

  it("wraps Icon with custom default strokeWidth", async () => {
    const plugin = lucide({ strokeWidth: 1.5 });
    const partial = plugin.config!({} as never);
    const WrappedIcon = partial!.mdx!.components!.Icon;

    const result = await renderToString(<WrappedIcon name="rocket" />);

    expect(result.html).toContain('stroke-width="1.5"');
  });

  it("per-icon props override plugin defaults", async () => {
    const plugin = lucide({ size: 16, color: "#333" });
    const partial = plugin.config!({} as never);
    const WrappedIcon = partial!.mdx!.components!.Icon;

    const result = await renderToString(<WrappedIcon name="rocket" size={32} color="red" />);

    expect(result.html).toContain('width="32"');
    expect(result.html).toContain('stroke="red"');
  });
});
