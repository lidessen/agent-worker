import type { ClaudeHooks } from "@agent-worker/loop";
import type { Inbox } from "../inbox.ts";
import type { TodoManager } from "../todo.ts";
import type { ReminderManager } from "../reminder.ts";

export function createDefaultClaudeHooks(args: {
  inbox: Inbox;
  todos: TodoManager;
  reminders: ReminderManager;
}): ClaudeHooks {
  return {
    Notification: [
      {
        hooks: [
          async () => ({
            hookSpecificOutput: {
              hookEventName: "Notification",
              additionalContext: formatWorkspaceAttention(args),
            },
          }),
        ],
      },
    ],
    PreCompact: [
      {
        hooks: [
          async () => ({
            systemMessage:
              "Preserve the current workspace state during compaction.\n" +
              formatWorkspaceAttention(args),
          }),
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          async () => ({
            systemMessage: formatStopReminder(args),
          }),
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: "*agent_send*",
        hooks: [
          async () => ({
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              additionalContext:
                "Before sending, re-check whether the workspace has newer notifications to read first.\n" +
                formatWorkspaceAttention(args),
            },
          }),
        ],
      },
    ],
  };
}

function formatWorkspaceAttention(args: {
  inbox: Inbox;
  todos: TodoManager;
  reminders: ReminderManager;
}): string {
  const lines = [
    "Workspace attention summary:",
    `- unread channel messages: ${args.inbox.unreadCount}`,
    `- pending todos: ${args.todos.pending.length}`,
    `- pending reminders: ${args.reminders.pending.length}`,
    "Treat notifications as pointers to apps or channels you may need to inspect, not as the full source of truth.",
  ];

  const pendingTodos = args.todos.pending.slice(0, 5);
  if (pendingTodos.length > 0) {
    lines.push(
      "Pending todo highlights: " +
        pendingTodos.map((todo) => `${todo.id}:${todo.text}`).join(" | "),
    );
  }

  return lines.join("\n");
}

function formatStopReminder(args: {
  inbox: Inbox;
  todos: TodoManager;
  reminders: ReminderManager;
}): string {
  const hasAttention =
    args.inbox.unreadCount > 0 || args.todos.pending.length > 0 || args.reminders.pending.length > 0;

  if (!hasAttention) {
    return "If you are done, stop normally. If not, explicitly state the next action before ending.";
  }

  return (
    "Before stopping, check whether the workspace still has pending attention items.\n" +
    formatWorkspaceAttention(args)
  );
}

export function mergeClaudeHooks(base: ClaudeHooks, extra?: Record<string, unknown>): ClaudeHooks {
  const merged: ClaudeHooks = { ...base };
  const extraHooks = (extra ?? {}) as ClaudeHooks;

  for (const [event, matchers] of Object.entries(extraHooks)) {
    const existing = merged[event as keyof ClaudeHooks] ?? [];
    merged[event as keyof ClaudeHooks] = [...existing, ...(matchers ?? [])] as never;
  }

  return merged;
}
