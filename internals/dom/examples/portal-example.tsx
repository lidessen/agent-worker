/**
 * Example demonstrating portal usage in SemaJSX
 *
 * Run with: bun --conditions=development --port=0 examples/portal-example.tsx
 */

/** @jsxImportSource @semajsx/dom */

import { computed, signal } from "@semajsx/signal";
import { createPortal, render } from "@semajsx/dom";

// Example 1: Basic Modal using Portal
function Modal(props: { isOpen: boolean; onClose: () => void; children: any }) {
  if (!props.isOpen) return null;

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "1000",
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "8px",
          minWidth: "300px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e: Event) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>,
    modalRoot,
  );
}

function ModalExample() {
  const isOpen = signal(false);

  return (
    <div>
      <h2>Example 1: Modal with Portal</h2>
      <button onClick={() => (isOpen.value = true)}>Open Modal</button>

      <Modal isOpen={isOpen.value} onClose={() => (isOpen.value = false)}>
        <h3>Modal Title</h3>
        <p>This modal is rendered using a portal!</p>
        <p>It appears outside the normal DOM hierarchy.</p>
        <button onClick={() => (isOpen.value = false)}>Close Modal</button>
      </Modal>
    </div>
  );
}

// Example 2: Tooltip using Portal
function Tooltip(props: { text: string; x: number; y: number }) {
  const tooltipRoot = document.getElementById("tooltip-root");
  if (!tooltipRoot) return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        left: `${props.x}px`,
        top: `${props.y}px`,
        backgroundColor: "black",
        color: "white",
        padding: "5px 10px",
        borderRadius: "4px",
        fontSize: "14px",
        pointerEvents: "none",
        zIndex: "9999",
      }}
    >
      {props.text}
    </div>,
    tooltipRoot,
  );
}

function TooltipExample() {
  const showTooltip = signal(false);
  const tooltipX = signal(0);
  const tooltipY = signal(0);

  const handleMouseEnter = (e: MouseEvent) => {
    showTooltip.value = true;
    tooltipX.value = e.clientX + 10;
    tooltipY.value = e.clientY + 10;
  };

  const handleMouseLeave = () => {
    showTooltip.value = false;
  };

  return (
    <div>
      <h2>Example 2: Tooltip with Portal</h2>
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ padding: "10px 20px" }}
      >
        Hover me for tooltip
      </button>

      {showTooltip.value && (
        <Tooltip text="This is a tooltip!" x={tooltipX.value} y={tooltipY.value} />
      )}
    </div>
  );
}

// Example 3: Notification System
function Notification(props: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  const notificationRoot = document.getElementById("notification-root");
  if (!notificationRoot) return null;

  const colors = {
    success: "#4CAF50",
    error: "#f44336",
    info: "#2196F3",
  };

  return createPortal(
    <div
      style={{
        backgroundColor: colors[props.type],
        color: "white",
        padding: "15px 20px",
        marginBottom: "10px",
        borderRadius: "4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        minWidth: "300px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      }}
    >
      <span>{props.message}</span>
      <button
        onClick={props.onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "white",
          fontSize: "20px",
          cursor: "pointer",
          marginLeft: "15px",
        }}
      >
        ×
      </button>
    </div>,
    notificationRoot,
  );
}

function NotificationExample() {
  const notifications = signal<
    Array<{ id: number; message: string; type: "success" | "error" | "info" }>
  >([]);
  let nextId = 0;

  const addNotification = (message: string, type: "success" | "error" | "info") => {
    const id = nextId++;
    notifications.value = [...notifications.value, { id, message, type }];

    // Auto-remove after 3 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 3000);
  };

  const removeNotification = (id: number) => {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  };

  const notificationsList = computed(notifications, (notifications) => {
    return notifications.map((notif) => (
      <Notification
        key={notif.id}
        message={notif.message}
        type={notif.type}
        onClose={() => removeNotification(notif.id)}
      />
    ));
  });

  return (
    <div>
      <h2>Example 3: Notification System</h2>
      <button onClick={() => addNotification("Success!", "success")}>Show Success</button>
      <button onClick={() => addNotification("Error occurred!", "error")}>Show Error</button>
      <button onClick={() => addNotification("Info message", "info")}>Show Info</button>

      {notificationsList}
    </div>
  );
}

// Main App
function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>SemaJSX Portal Examples</h1>
      <ModalExample />
      <hr />
      <TooltipExample />
      <hr />
      <NotificationExample />
    </div>
  );
}

// Render to DOM
const root = document.getElementById("app");
if (root) {
  render(<App />, root);
}

// For Bun server
export default {
  port: 3000,
  fetch() {
    return new Response(
      `<!DOCTYPE html>
<html>
  <head>
    <title>SemaJSX Portal Examples</title>
    <style>
      body { margin: 0; padding: 0; }
      button { margin: 5px; padding: 8px 16px; cursor: pointer; }
      hr { margin: 30px 0; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <div id="modal-root"></div>
    <div id="tooltip-root"></div>
    <div id="notification-root" style="
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
    "></div>
    <script type="module" src="${import.meta.url}"></script>
  </body>
</html>`,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  },
};
