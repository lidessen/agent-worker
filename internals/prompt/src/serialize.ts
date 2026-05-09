/**
 * Serializer: converts a PromptNode tree into plain text
 *
 * This is the core of prompt-ui. It walks the tree and produces
 * structured text output suitable for LLM consumption.
 *
 * Supported intrinsic elements:
 *
 * <header>     - Top-level metadata (KEY value lines)
 * <section>    - Named section block ([TITLE])
 * <line>       - A single line of text
 * <item>       - A list item (- text or 1. text)
 * <field>      - A key-value field (label: value)
 * <actions>    - Action list (Actions: a | b | c)
 * <action>     - A single action (label => @act:name key=val)
 * <viewport>   - Viewport wrapper with pagination info
 * <separator>  - A separator line (---)
 * <text>       - Inline text passthrough
 * <br>         - Explicit line break
 * <indent>     - Indented block
 * <raw>        - Raw text passthrough (no processing)
 */

import type { PromptNode, PromptElement, PromptRoot } from "./types";
import { collectText } from "./operations";

/**
 * Serialize a prompt node tree to plain text
 */
export function serialize(root: PromptRoot | PromptElement): string {
  const lines: string[] = [];
  serializeChildren(root, lines, "");
  return joinLines(lines);
}

/**
 * Join lines, collapsing multiple consecutive blank lines into one
 */
function joinLines(lines: string[]): string {
  const result: string[] = [];
  let prevBlank = false;

  for (const line of lines) {
    const isBlank = line.trim() === "";
    if (isBlank && prevBlank) continue;
    result.push(line);
    prevBlank = isBlank;
  }

  // Trim trailing blank lines
  while (result.length > 0 && result[result.length - 1]?.trim() === "") {
    result.pop();
  }

  return result.join("\n");
}

/**
 * Serialize all children of a node
 */
function serializeChildren(node: PromptNode, lines: string[], indent: string): void {
  for (const child of node.children) {
    serializeNode(child, lines, indent);
  }
}

/**
 * Serialize a single node
 */
function serializeNode(node: PromptNode, lines: string[], indent: string): void {
  if (node.type === "text") {
    // Raw text nodes - add non-empty content as a line
    if (node.content.trim() !== "") {
      for (const line of node.content.split("\n")) {
        if (line.trim() !== "") {
          lines.push(indent + line);
        }
      }
    }
    return;
  }

  if (node.type === "root") {
    serializeChildren(node, lines, indent);
    return;
  }

  // Element nodes - dispatch by tagName
  const element = node;
  switch (element.tagName) {
    case "header":
      serializeHeader(element, lines, indent);
      break;
    case "section":
      serializeSection(element, lines, indent);
      break;
    case "line":
      serializeLine(element, lines, indent);
      break;
    case "item":
      serializeItem(element, lines, indent);
      break;
    case "field":
      serializeField(element, lines, indent);
      break;
    case "actions":
      serializeActions(element, lines, indent);
      break;
    case "action":
      serializeAction(element, lines, indent);
      break;
    case "viewport":
      serializeViewport(element, lines, indent);
      break;
    case "separator":
      serializeSeparator(element, lines, indent);
      break;
    case "br":
      lines.push("");
      break;
    case "indent":
      serializeIndent(element, lines, indent);
      break;
    case "raw":
      serializeRaw(element, lines, indent);
      break;
    case "text":
    default:
      // For <text> and unknown elements, just serialize children inline
      serializeChildren(element, lines, indent);
      break;
  }
}

/**
 * Serialize a <header> element
 *
 * Renders known fields (name->SCREEN, time->TIME, event->EVENT, focus->FOCUS)
 * plus any additional props as KEY VALUE lines.
 */
function serializeHeader(element: PromptElement, lines: string[], indent: string): void {
  const props = element.props;

  // Known header fields in recommended order
  const knownFields: Array<[string, string]> = [
    ["name", "SCREEN"],
    ["time", "TIME"],
    ["event", "EVENT"],
    ["focus", "FOCUS"],
  ];

  for (const [prop, label] of knownFields) {
    if (props[prop] != null && props[prop] !== "") {
      lines.push(indent + label + " " + String(props[prop]));
    }
  }

  // Custom fields (anything not in known fields, key, or children)
  const skipKeys = new Set(["key", "children", ...knownFields.map(([k]) => k)]);
  for (const [key, value] of Object.entries(props)) {
    if (skipKeys.has(key)) continue;
    if (value != null && value !== "") {
      lines.push(indent + key.toUpperCase() + " " + String(value));
    }
  }

  // Add blank line after header
  lines.push("");
}

/**
 * Serialize a <section> element
 *
 * Renders as [TITLE viewport=...] followed by indented children.
 */
function serializeSection(element: PromptElement, lines: string[], indent: string): void {
  const title = String(element.props["title"] ?? "SECTION");
  const viewport = element.props["viewport"];

  let heading = indent + "[" + title + "]";
  if (viewport != null && viewport !== "") {
    heading += " viewport=" + String(viewport);
  }

  lines.push(heading);

  // Serialize children
  serializeChildren(element, lines, indent);

  // Add blank line after section
  lines.push("");
}

/**
 * Serialize a <line> element
 *
 * Renders as a single line of collected text content.
 */
function serializeLine(element: PromptElement, lines: string[], indent: string): void {
  const prefix = element.props["prefix"] != null ? String(element.props["prefix"]) : "";
  const text = collectText(element);
  lines.push(indent + prefix + text);
}

/**
 * Serialize an <item> element
 *
 * Renders as:
 *   - text     (unordered, default marker="-")
 *   1. text    (ordered, when index is set)
 */
function serializeItem(element: PromptElement, lines: string[], indent: string): void {
  const index = element.props["index"];
  const marker = element.props["marker"] ?? "-";
  const text = collectChildLines(element, indent);

  let prefix: string;
  if (index != null) {
    prefix = String(index) + ". ";
  } else {
    prefix = String(marker) + " ";
  }

  // First line gets the marker, subsequent lines get indented
  const contentLines = text.split("\n");
  if (contentLines.length === 0) {
    lines.push(indent + prefix);
    return;
  }

  lines.push(indent + prefix + contentLines[0]);
  const continuationIndent = indent + " ".repeat(prefix.length);
  for (let i = 1; i < contentLines.length; i++) {
    if (contentLines[i]?.trim() === "") {
      lines.push("");
    } else {
      lines.push(continuationIndent + contentLines[i]);
    }
  }
}

/**
 * Serialize a <field> element
 *
 * Renders as: label: value
 * or label: {children text}
 */
function serializeField(element: PromptElement, lines: string[], indent: string): void {
  const label = String(element.props["label"] ?? "");
  const value = element.props["value"];

  if (value != null) {
    lines.push(indent + label + ": " + String(value));
  } else {
    const text = collectText(element);
    lines.push(indent + label + ": " + text);
  }
}

/**
 * Serialize an <actions> element
 *
 * If inline=true (default): Actions: action1 | action2 | action3
 * If inline=false: one action per line
 */
function serializeActions(element: PromptElement, lines: string[], indent: string): void {
  const inline = element.props["inline"] !== false; // default true
  const label = element.props["label"] != null ? String(element.props["label"]) : "Actions";

  // Collect action strings from children
  const actionStrings: string[] = [];
  for (const child of element.children) {
    if (child.type === "element" && child.tagName === "action") {
      actionStrings.push(formatAction(child));
    } else {
      const text = collectText(child).trim();
      if (text) actionStrings.push(text);
    }
  }

  if (actionStrings.length === 0) return;

  if (inline) {
    lines.push(indent + label + ": " + actionStrings.join(" | "));
  } else {
    lines.push(indent + label + ":");
    for (const action of actionStrings) {
      lines.push(indent + "- " + action);
    }
  }
}

/**
 * Format a single <action> element as a string
 */
function formatAction(element: PromptElement): string {
  const label = element.props["label"];
  const name = element.props["name"];

  if (!name) {
    return String(label ?? collectText(element));
  }

  // Build canonical action: @act:name key=value key=value
  let canonical = "@act:" + String(name);
  const skipKeys = new Set(["key", "children", "label", "name"]);
  for (const [key, value] of Object.entries(element.props)) {
    if (skipKeys.has(key)) continue;
    if (value != null) {
      canonical += " " + key + "=" + String(value);
    }
  }

  if (label) {
    return String(label) + " => " + canonical;
  }
  return canonical;
}

/**
 * Serialize an <action> element standalone (when not inside <actions>)
 */
function serializeAction(element: PromptElement, lines: string[], indent: string): void {
  lines.push(indent + formatAction(element));
}

/**
 * Serialize a <viewport> element
 *
 * Wraps children and annotates with viewport info.
 * Children are rendered normally, then pagination hints are added.
 */
function serializeViewport(element: PromptElement, lines: string[], indent: string): void {
  // Just serialize children - the viewport info is typically on the parent section
  serializeChildren(element, lines, indent);

  // Add pagination actions if scope is provided
  const scope = element.props["scope"];
  const current = element.props["current"];
  const total = element.props["total"];

  if (scope && current != null && total != null) {
    const currentStr = String(current);
    const totalStr = String(total);

    // Parse current range to determine if more pages exist
    const parts = currentStr.split("-");
    const end = parts.length > 1 ? Number(parts[1]) : Number(parts[0]);

    if (end < Number(totalStr)) {
      lines.push(indent + "more: @act:next scope=" + String(scope));
    }
  }
}

/**
 * Serialize a <separator> element
 */
function serializeSeparator(element: PromptElement, lines: string[], indent: string): void {
  const char = String(element.props["char"] ?? "---");
  lines.push(indent + char);
}

/**
 * Serialize an <indent> element
 *
 * Adds extra indentation to children
 */
function serializeIndent(element: PromptElement, lines: string[], indent: string): void {
  const size = Number(element.props["size"] ?? 2);
  const extraIndent = " ".repeat(size);
  serializeChildren(element, lines, indent + extraIndent);
}

/**
 * Serialize a <raw> element - passes text through unmodified
 */
function serializeRaw(element: PromptElement, lines: string[], indent: string): void {
  const text = collectText(element);
  for (const line of text.split("\n")) {
    lines.push(indent + line);
  }
}

/**
 * Collect child content as a single string (for multiline items)
 */
function collectChildLines(node: PromptNode, _indent: string): string {
  const parts: string[] = [];
  for (const child of node.children) {
    if (child.type === "text") {
      parts.push(child.content);
    } else if (child.type === "element") {
      if (child.tagName === "action") {
        parts.push(formatAction(child));
      } else if (child.tagName === "field") {
        const label = String(child.props["label"] ?? "");
        const value = child.props["value"] ?? collectText(child);
        parts.push(label + "=" + String(value));
      } else {
        parts.push(collectText(child));
      }
    }
  }
  return parts.join("").trim();
}
