import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";

/** Flexible class value — strings, style tokens, arrays, or falsy values for conditional classes. */
export type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

/** A typed block with a discriminator and arbitrary data payload. */
export interface Block<T extends string = string, D = unknown> {
  type: T;
  data: D;
  id?: string;
}

/** A function that renders a block's data into JSX. */
export type BlockRenderer<D = unknown> = (props: { data: D; class?: ClassValue }) => JSXNode;

/** Registry for mapping block types to their renderers. */
export interface BlockRegistry {
  register<D>(type: string, renderer: BlockRenderer<D>): void;
  get(type: string): BlockRenderer | undefined;
  has(type: string): boolean;
}
