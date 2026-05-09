/** @jsxImportSource @semajsx/dom */
import { describe, it, expect, afterEach } from "vitest";
import { createApp } from "./app";
import { island } from "./client/island";
import { signal } from "@semajsx/signal";
import type { App } from "./shared/types";

describe("createApp", () => {
  let app: App;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("basic usage", () => {
    it("should create an app with default config", () => {
      app = createApp();
      expect(app).toBeDefined();
      expect(app.config).toBeDefined();
    });

    it("should create an app with custom config", () => {
      app = createApp({
        title: "Test App",
        root: "/custom/root",
        islands: {
          cache: false,
        },
      });

      expect(app.config.title).toBe("Test App");
      expect(app.config.root).toBe("/custom/root");
      expect(app.config.islands?.cache).toBe(false);
    });
  });

  describe("route registration", () => {
    it("should register routes via config", () => {
      const Home = () => <div>Home</div>;
      const About = () => <div>About</div>;

      app = createApp({
        routes: {
          "/": () => <Home />,
          "/about": () => <About />,
        },
      });

      expect(app).toBeDefined();
    });

    it("should register routes via route() method", () => {
      app = createApp();

      const result = app.route("/", () => <div>Home</div>).route("/about", () => <div>About</div>);

      expect(result).toBe(app); // chainable
    });

    it("should register multiple routes via routes() method", () => {
      app = createApp();

      const result = app.routes({
        "/": () => <div>Home</div>,
        "/about": () => <div>About</div>,
      });

      expect(result).toBe(app); // chainable
    });
  });

  describe("render()", () => {
    it("should render a simple route", async () => {
      app = createApp({
        routes: {
          "/": () => <div>Hello World</div>,
        },
      });

      const result = await app.render("/");

      expect(result.html).toContain("Hello World");
      expect(result.islands).toEqual([]);
    });

    it("should render with props", async () => {
      const Greeting = ({ name }: { name: string }) => <h1>Hello {name}</h1>;

      app = createApp({
        routes: {
          "/": () => <Greeting name="Test" />,
        },
      });

      const result = await app.render("/");

      expect(result.html).toContain("Hello Test");
    });

    it("should handle dynamic routes", async () => {
      const Post = ({ id }: { id: string }) => <article>Post {id}</article>;

      app = createApp({
        routes: {
          "/post/:id": ({ params }) => <Post id={params.id} />,
        },
      });

      const result = await app.render("/post/123");

      expect(result.html).toContain("Post 123");
    });

    it("should handle query parameters", async () => {
      const Search = ({ query }: { query: string }) => <div>Search: {query}</div>;

      app = createApp({
        routes: {
          "/search": ({ query }) => <Search query={query.q || ""} />,
        },
      });

      const result = await app.render("/search?q=hello");

      expect(result.html).toContain("Search: hello");
    });

    it("should throw error for unknown routes", async () => {
      app = createApp({
        routes: {
          "/": () => <div>Home</div>,
        },
      });

      await expect(app.render("/unknown")).rejects.toThrow("No route found");
    });

    it("should render with document template", async () => {
      app = createApp({
        routes: {
          "/": () => <div>Content</div>,
        },
        document: ({ children, title }) => (
          <html>
            <head>
              <title>{title}</title>
            </head>
            <body>{children}</body>
          </html>
        ),
        title: "Test Page",
      });

      const result = await app.render("/");

      expect(result.document).toContain("<!DOCTYPE html>");
      expect(result.document).toContain("Test Page");
      expect(result.document).toContain("Content");
    });
  });

  describe("islands", () => {
    it("should collect islands during render", async () => {
      const Counter = island(({ initial = 0 }: { initial?: number }) => {
        const count = signal(initial);
        return <button>{count}</button>;
      }, "file:///test/Counter.tsx");

      app = createApp({
        routes: {
          "/": () => (
            <div>
              <Counter initial={5} />
            </div>
          ),
        },
      });

      const result = await app.render("/");

      expect(result.islands).toHaveLength(1);
      expect(result.islands[0].path).toBe("file:///test/Counter.tsx");
      expect(result.islands[0].props).toEqual({ initial: 5 });
      expect(result.html).toContain("data-island-id");
    });

    it("should cache islands when enabled", async () => {
      const Counter = island(() => <button>Click</button>, "file:///test/Counter.tsx");

      app = createApp({
        routes: {
          "/": () => <Counter />,
        },
        islands: {
          cache: true,
        },
      });

      const result = await app.render("/");
      const islandId = result.islands[0].id;

      const cached = app.getIsland(islandId);
      expect(cached).toBeDefined();
      expect(cached?.path).toBe("file:///test/Counter.tsx");
    });

    it("should generate island scripts", async () => {
      const Counter = island(() => <button>Click</button>, "file:///test/Counter.tsx");

      app = createApp({
        routes: {
          "/": () => <Counter />,
        },
      });

      const result = await app.render("/");

      expect(result.scripts).toContain("/_semajsx/islands/");
      expect(result.scripts).toContain(".js");
    });
  });

  describe("getViteServer()", () => {
    it("should return null before prepare()", () => {
      app = createApp();
      expect(app.getViteServer()).toBeNull();
    });
  });
});
