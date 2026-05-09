/** @jsxImportSource @semajsx/terminal */
import { describe, test, expect, vi } from "vitest";
import { signal } from "@semajsx/signal";
import { TextInput } from "./TextInput";

describe("TextInput", () => {
  test("renders empty input with placeholder", () => {
    const value = signal("");
    const node = <TextInput value={value} placeholder="Type here..." />;
    expect(node).toBeDefined();
  });

  test("renders value with mask", () => {
    const value = signal("secret");
    const node = <TextInput value={value} mask="*" />;
    expect(node).toBeDefined();
  });

  test("renders with cursor disabled", () => {
    const value = signal("hello");
    const node = <TextInput value={value} showCursor={false} />;
    expect(node).toBeDefined();
  });

  test("renders unfocused", () => {
    const value = signal("hello");
    const node = <TextInput value={value} focus={false} />;
    expect(node).toBeDefined();
  });

  test("accepts onSubmit callback", () => {
    const value = signal("test");
    const onSubmit = vi.fn();
    const node = <TextInput value={value} onSubmit={onSubmit} />;
    expect(node).toBeDefined();
  });

  test("accepts onChange callback", () => {
    const value = signal("");
    const onChange = vi.fn();
    const node = <TextInput value={value} onChange={onChange} />;
    expect(node).toBeDefined();
  });
});
