import { describe, it, expect } from "vitest";
import { context, Context, createComponentAPI } from "../src/context";
import type { ComponentRuntimeState, ContextMap } from "../src/context";

describe("context", () => {
  describe("context()", () => {
    it("should create a context symbol", () => {
      const ThemeContext = context<string>();
      expect(typeof ThemeContext).toBe("symbol");
    });

    it("should use provided name for debugging", () => {
      const UserContext = context<{ name: string }>("user");
      expect(UserContext.description).toBe("user");
    });

    it("should use anonymous as default name", () => {
      const AnonContext = context<number>();
      expect(AnonContext.description).toBe("anonymous");
    });

    it("should create unique symbols", () => {
      const Context1 = context<string>();
      const Context2 = context<string>();
      expect(Context1).not.toBe(Context2);
    });
  });

  describe("Context component", () => {
    it("should be marked as context provider", () => {
      expect((Context as any).__isContextProvider).toBe(true);
    });

    it("should return a fragment with children", () => {
      const child1 = { type: "div", props: {}, children: [] };
      const child2 = { type: "span", props: {}, children: [] };

      const result = Context({
        provide: [Symbol("test"), "value"],
        children: [child1, child2],
      });

      // Context returns a Fragment
      expect(result.type).toBe(Symbol.for("semajsx.fragment"));
    });

    it("should handle single child", () => {
      const child = { type: "div", props: {}, children: [] };

      const result = Context({
        provide: [Symbol("test"), "value"],
        children: child,
      });

      expect(result.children.length).toBe(1);
    });

    it("should handle no children", () => {
      const result = Context({
        provide: [Symbol("test"), "value"],
      });

      expect(result.children).toEqual([]);
    });
  });

  describe("createComponentAPI()", () => {
    it("should create an API with inject function", () => {
      const contextMap: ContextMap = new Map();
      const api = createComponentAPI(contextMap);

      expect(typeof api.inject).toBe("function");
    });

    it("should inject value from context map", () => {
      const ThemeContext = context<string>("theme");
      const contextMap: ContextMap = new Map();
      contextMap.set(ThemeContext, "dark");

      const api = createComponentAPI(contextMap);
      const value = api.inject(ThemeContext);

      expect(value).toBe("dark");
    });

    it("should return undefined for missing context", () => {
      const ThemeContext = context<string>("theme");
      const contextMap: ContextMap = new Map();

      const api = createComponentAPI(contextMap);
      const value = api.inject(ThemeContext);

      expect(value).toBeUndefined();
    });

    it("should handle multiple contexts", () => {
      const ThemeContext = context<string>("theme");
      const UserContext = context<{ name: string }>("user");

      const contextMap: ContextMap = new Map();
      contextMap.set(ThemeContext, "light");
      contextMap.set(UserContext, { name: "Alice" });

      const api = createComponentAPI(contextMap);

      expect(api.inject(ThemeContext)).toBe("light");
      expect(api.inject(UserContext)).toEqual({ name: "Alice" });
    });

    it("should handle typed context values", () => {
      interface User {
        id: number;
        name: string;
      }

      const UserContext = context<User>("user");
      const contextMap: ContextMap = new Map();
      contextMap.set(UserContext, { id: 1, name: "Bob" });

      const api = createComponentAPI(contextMap);
      const user = api.inject(UserContext);

      expect(user?.id).toBe(1);
      expect(user?.name).toBe("Bob");
    });

    it("should expose runtime disposal state", () => {
      const contextMap: ContextMap = new Map();
      const runtimeState: ComponentRuntimeState = {
        cleanupCallbacks: [],
        disposed: false,
      };

      const api = createComponentAPI(contextMap, runtimeState);

      expect(api.isDisposed()).toBe(false);
      runtimeState.disposed = true;
      expect(api.isDisposed()).toBe(true);
    });

    it("should register cleanup callbacks while component is active", () => {
      const contextMap: ContextMap = new Map();
      const runtimeState: ComponentRuntimeState = {
        cleanupCallbacks: [],
        disposed: false,
      };
      const api = createComponentAPI(contextMap, runtimeState);
      const cleanup = () => {};

      api.onCleanup(cleanup);

      expect(runtimeState.cleanupCallbacks).toEqual([cleanup]);
    });

    it("should run cleanup immediately when component is already disposed", () => {
      const contextMap: ContextMap = new Map();
      const runtimeState: ComponentRuntimeState = {
        cleanupCallbacks: [],
        disposed: true,
      };
      const api = createComponentAPI(contextMap, runtimeState);
      let cleanedUp = false;

      api.onCleanup(() => {
        cleanedUp = true;
      });

      expect(cleanedUp).toBe(true);
      expect(runtimeState.cleanupCallbacks).toEqual([]);
    });
  });
});
