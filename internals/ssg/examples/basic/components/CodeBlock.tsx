/** @jsxImportSource @semajsx/dom */

import type { VNode } from "@semajsx/core";

interface CodeBlockProps {
  language?: string;
  title?: string;
  children: string;
}

/**
 * CodeBlock component for displaying code with syntax highlighting style
 */
export function CodeBlock({ language = "text", title, children }: CodeBlockProps): VNode {
  return (
    <div
      style={{
        margin: "16px 0",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #e5e7eb",
      }}
    >
      {title && (
        <div
          style={{
            background: "#f3f4f6",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: "500",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          {title}
          {language && (
            <span
              style={{
                float: "right",
                color: "#6b7280",
                fontSize: "12px",
              }}
            >
              {language}
            </span>
          )}
        </div>
      )}
      <pre
        style={{
          margin: 0,
          padding: "16px",
          background: "#1f2937",
          color: "#f9fafb",
          overflow: "auto",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}
