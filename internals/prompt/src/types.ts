/**
 * Node types for Prompt UI tree
 *
 * The tree is a lightweight structure that gets serialized to plain text.
 * No layout engine, no ANSI - just structured text output for LLM agents.
 */

/**
 * Prompt node type discriminator
 */
export type PromptNodeType = "element" | "text" | "root";

/**
 * Base interface for all prompt nodes
 */
export interface PromptNodeBase {
  type: PromptNodeType;
  parent: PromptNode | null;
  children: PromptNode[];
}

/**
 * Element node - represents a structural element (header, section, item, etc.)
 */
export interface PromptElement extends PromptNodeBase {
  type: "element";
  tagName: string;
  props: Record<string, unknown>;
}

/**
 * Text node - represents raw text content
 */
export interface PromptText extends PromptNodeBase {
  type: "text";
  content: string;
}

/**
 * Root node - the top-level container
 */
export interface PromptRoot extends PromptNodeBase {
  type: "root";
}

/**
 * Union type for all prompt nodes
 */
export type PromptNode = PromptElement | PromptText | PromptRoot;
