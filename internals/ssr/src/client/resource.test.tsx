/** @jsxImportSource @semajsx/dom */

import { describe, expect, it } from "vitest";
import { renderToString } from "../render";
import { resource } from "./resource";

describe("resource()", () => {
  it("should resolve relative CSS paths", async () => {
    const { Style } = resource("file:///home/user/project/src/pages/Home.tsx");

    const app = (
      <div>
        <Style href="./Home.css" />
        <h1>Hello</h1>
      </div>
    );

    const result = await renderToString(app);

    expect(result.css).toContain("/home/user/project/src/pages/Home.css");
    expect(result.html).toContain("<h1>Hello</h1>");
    expect(result.html).not.toContain("Style"); // Style should not render
  });

  it("should resolve parent directory paths", async () => {
    const { Style } = resource("file:///home/user/project/src/pages/deep/Page.tsx");

    const app = (
      <>
        <Style href="../shared.css" />
        <Style href="../../global.css" />
        <div>Content</div>
      </>
    );

    const result = await renderToString(app);

    expect(result.css).toContain("/home/user/project/src/pages/shared.css");
    expect(result.css).toContain("/home/user/project/src/global.css");
  });

  it("should preserve absolute paths", async () => {
    const { Style } = resource("file:///home/user/project/src/pages/Home.tsx");

    const app = (
      <div>
        <Style href="/styles/global.css" />
      </div>
    );

    const result = await renderToString(app);

    expect(result.css).toContain("/styles/global.css");
  });

  it("should collect assets", async () => {
    const { Asset, url } = resource("file:///home/user/project/src/pages/Home.tsx");

    const app = (
      <div>
        <Asset src="./hero.png" />
        <img src={url("./logo.svg")} alt="Logo" />
      </div>
    );

    const result = await renderToString(app);

    expect(result.assets).toContain("/home/user/project/src/pages/hero.png");
    expect(result.html).toContain('src="/home/user/project/src/pages/logo.svg"');
  });

  it("should create islands with resolved module path", async () => {
    const { island, Style } = resource("file:///home/user/project/src/islands/Counter.tsx");

    const Counter = island(function Counter({ initial = 0 }) {
      return (
        <>
          <Style href="./Counter.css" />
          <button>{initial}</button>
        </>
      );
    });

    const app = <Counter initial={5} />;

    const result = await renderToString(app, {
      transformIslandScript: (ctx) => `<script src="${ctx.basePath}/${ctx.id}.js"></script>`,
    });

    expect(result.islands).toHaveLength(1);
    expect(result.islands[0]?.path).toBe("file:///home/user/project/src/islands/Counter.tsx");
    expect(result.css).toContain("/home/user/project/src/islands/Counter.css");
    expect(result.html).toContain("<button>");
  });

  it("should handle Link with different rel types", async () => {
    const { Link } = resource("file:///home/user/project/src/pages/Home.tsx");

    const app = (
      <div>
        <Link href="./styles.css" rel="stylesheet" />
        <Link href="./fonts.css" rel="preload" as="style" />
      </div>
    );

    const result = await renderToString(app);

    // Only stylesheet links should be collected as CSS
    expect(result.css).toContain("/home/user/project/src/pages/styles.css");
    expect(result.css).not.toContain("fonts.css"); // preload is not a stylesheet
  });

  it("should deduplicate CSS paths", async () => {
    const { Style } = resource("file:///home/user/project/src/pages/Home.tsx");

    const app = (
      <div>
        <Style href="./common.css" />
        <Style href="./common.css" />
        <Style href="./page.css" />
      </div>
    );

    const result = await renderToString(app);

    // Should only have 2 unique CSS files
    expect(result.css).toHaveLength(2);
    expect(result.css).toContain("/home/user/project/src/pages/common.css");
    expect(result.css).toContain("/home/user/project/src/pages/page.css");
  });

  it("should work with nested components", async () => {
    const { Style } = resource("file:///home/user/project/src/pages/Home.tsx");

    function Header() {
      return (
        <>
          <Style href="./header.css" />
          <header>Header</header>
        </>
      );
    }

    function Footer() {
      return (
        <>
          <Style href="./footer.css" />
          <footer>Footer</footer>
        </>
      );
    }

    const app = (
      <div>
        <Style href="./page.css" />
        <Header />
        <main>Content</main>
        <Footer />
      </div>
    );

    const result = await renderToString(app);

    expect(result.css).toHaveLength(3);
    expect(result.css).toContain("/home/user/project/src/pages/page.css");
    expect(result.css).toContain("/home/user/project/src/pages/header.css");
    expect(result.css).toContain("/home/user/project/src/pages/footer.css");
  });
});
