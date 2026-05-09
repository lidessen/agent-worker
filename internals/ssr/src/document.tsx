/** @jsxImportSource @semajsx/dom */

import { Fragment } from "@semajsx/core";
import type { DocumentTemplate } from "./shared/types";

/**
 * Default HTML document template
 *
 * This is a simple, production-ready HTML5 document template.
 * You can customize it by providing your own document template to the router.
 *
 * @example
 * ```tsx
 * const router = createViteRouter(routes, {
 *   document: DefaultDocument,
 *   title: "My App"  // Required if using DefaultDocument
 * });
 * ```
 */
export const DefaultDocument: DocumentTemplate = ({ children, scripts, css, title }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      {title && <title>{title}</title>}
      {css.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </head>
    <body>
      {children}
      {scripts}
    </body>
  </html>
);

/**
 * Render a document VNode to a complete HTML string
 * Prepends <!DOCTYPE html> to the rendered output
 *
 * @param documentVNode - The document VNode (should be <html> element)
 * @returns Complete HTML string with doctype
 */
export function renderDocument(documentVNode: any): string {
  // Import renderToString from render.ts
  // We can't import it directly to avoid circular dependencies
  // So we use a simple HTML renderer for the document shell

  const html = renderDocumentVNode(documentVNode);
  return `<!DOCTYPE html>\n${html}`;
}

/**
 * Simple HTML renderer for document structure
 * This handles the outer HTML/head/body structure without islands
 */
function renderDocumentVNode(vnode: any): string {
  if (vnode == null) {
    return "";
  }

  if (typeof vnode === "string" || typeof vnode === "number") {
    const str = String(vnode);
    // Check if it's already rendered HTML (starts with < or contains HTML tags)
    if (str.startsWith("<") || str.includes("</")) {
      return str;
    }
    return escapeHTML(str);
  }

  if (typeof vnode === "boolean") {
    return "";
  }

  if (Array.isArray(vnode)) {
    return vnode.map((child) => renderDocumentVNode(child)).join("");
  }

  if (typeof vnode !== "object" || !("type" in vnode)) {
    return "";
  }

  const { type, props, children } = vnode;

  // Handle dangerouslySetInnerHTML (for raw HTML injection)
  if (props?.dangerouslySetInnerHTML?.__html) {
    return props.dangerouslySetInnerHTML.__html;
  }

  // Handle Fragment (Symbol type)
  if (type === Fragment) {
    return (children || []).map((child: any) => renderDocumentVNode(child)).join("");
  }

  // Handle special VNode types
  if (typeof type === "string") {
    // Handle internal node types like #text, #signal
    if (type.startsWith("#")) {
      if (type === "#text") {
        const value = props?.nodeValue ?? "";
        // Check if it's already rendered HTML
        if (typeof value === "string" && (value.startsWith("<") || value.includes("</"))) {
          return value;
        }
        return escapeHTML(String(value));
      }
      // For #signal and other special types, render children
      return (children || []).map((child: any) => renderDocumentVNode(child)).join("");
    }
    return renderElement(type, props, children);
  }

  if (typeof type === "function") {
    const result = type(props || {});
    return renderDocumentVNode(result);
  }

  return "";
}

/**
 * Render an HTML element
 */
function renderElement(tag: string, props: any, children: any[]): string {
  const attrs = renderAttributes(props || {});

  // Self-closing tags
  const selfClosing = ["meta", "link", "br", "hr", "img", "input"];
  if (selfClosing.includes(tag)) {
    return `<${tag}${attrs} />`;
  }

  // Raw text elements: content must NOT be HTML-escaped
  const isRawText = tag === "style" || tag === "script";
  const childrenHTML = isRawText
    ? (children || []).map((child) => extractRawText(child)).join("")
    : (children || []).map((child) => renderDocumentVNode(child)).join("");

  return `<${tag}${attrs}>${childrenHTML}</${tag}>`;
}

/**
 * Extract raw text from a VNode without HTML escaping.
 * Used for <style> and <script> content.
 */
function extractRawText(vnode: any): string {
  if (vnode == null || typeof vnode === "boolean") return "";
  if (typeof vnode === "string" || typeof vnode === "number") return String(vnode);
  if (Array.isArray(vnode)) return vnode.map(extractRawText).join("");
  if (typeof vnode === "object" && "type" in vnode) {
    if (vnode.type === "#text") return String(vnode.props?.nodeValue ?? "");
    if (vnode.type === "#signal") return (vnode.children || []).map(extractRawText).join("");
    // Nested elements inside style/script (rare) - render normally
    return renderDocumentVNode(vnode);
  }
  return "";
}

/**
 * Render attributes
 */
function renderAttributes(props: Record<string, any>): string {
  const attrs: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "key" || key === "ref" || key === "dangerouslySetInnerHTML") {
      continue;
    }

    if (value == null || value === false) {
      continue;
    }

    // Boolean attributes
    if (value === true) {
      attrs.push(key);
      continue;
    }

    // Map React/JSX attribute names to HTML
    const attrName =
      key === "className"
        ? "class"
        : key === "htmlFor"
          ? "for"
          : key === "charSet"
            ? "charset"
            : key === "crossOrigin"
              ? "crossorigin"
              : key === "httpEquiv"
                ? "http-equiv"
                : key;

    attrs.push(`${attrName}="${escapeHTML(String(value))}"`);
  }

  return attrs.length > 0 ? " " + attrs.join(" ") : "";
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
