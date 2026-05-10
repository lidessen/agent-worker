/** @jsxImportSource @semajsx/dom */

import type { VNode } from "@semajsx/core";

interface CalloutProps {
  type?: "info" | "warning" | "success" | "error";
  title?: string;
  children: VNode | VNode[];
}

const styles = {
  info: { bg: "#eff6ff", border: "#3b82f6", icon: "i" },
  warning: { bg: "#fffbeb", border: "#f59e0b", icon: "!" },
  success: { bg: "#f0fdf4", border: "#22c55e", icon: "v" },
  error: { bg: "#fef2f2", border: "#ef4444", icon: "x" },
};

/**
 * Callout component for highlighting important information in MDX
 */
export function Callout({ type = "info", title, children }: CalloutProps): VNode {
  const style = styles[type];

  return (
    <div
      style={{
        background: style.bg,
        borderLeft: `4px solid ${style.border}`,
        padding: "16px",
        margin: "16px 0",
        borderRadius: "4px",
      }}
    >
      {title && (
        <div
          style={{
            fontWeight: "bold",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: style.border,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
          >
            {style.icon}
          </span>
          {title}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
