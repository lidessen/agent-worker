/** @jsxImportSource @semajsx/dom */

import type { ChatEvent } from "../types";
import { TextBlock } from "./text-block";
import { ToolCallCard } from "./tool-call-card";
import { RunBlock } from "./run-block";
import { ErrorBlock } from "./error-block";
import { UserMessageBlock } from "./user-message-block";
import { ThinkingBlock } from "./thinking-block";

function isTextEvent(event: ChatEvent): boolean {
  const t = event.type;
  return t === "text" || t === "response" || (t.includes("text") && !t.includes("tool"));
}

function isToolCallEvent(event: ChatEvent): boolean {
  const t = event.type;
  return (
    t === "tool_call" ||
    t === "tool_call_start" ||
    t === "tool_call_end" ||
    t === "tool_use" ||
    t.includes("tool_call") ||
    t.includes("tool_use")
  );
}

function isRunEvent(event: ChatEvent): boolean {
  const t = event.type;
  return t === "run_start" || t === "run_end" || t.endsWith("_run_start") || t.endsWith("_run_end");
}

function isErrorEvent(event: ChatEvent): boolean {
  const t = event.type;
  return t === "error" || t.includes("error");
}

function isUserMessage(event: ChatEvent): boolean {
  return event.type === "user_message";
}

function isThinkingEvent(event: ChatEvent): boolean {
  return event.type === "thinking";
}

function isSkippedEvent(event: ChatEvent): boolean {
  const t = event.type;
  return t === "context_assembled" || t === "send" || t === "unknown";
}

/** Maps a ChatEvent to the appropriate block component. */
export function EventRenderer(props: { event: ChatEvent; class?: string }) {
  const { event } = props;

  if (isUserMessage(event)) return <UserMessageBlock event={event} />;
  if (isErrorEvent(event)) return <ErrorBlock event={event} />;
  if (isThinkingEvent(event)) return <ThinkingBlock event={event} />;
  if (isToolCallEvent(event)) return <ToolCallCard event={event} />;
  if (isRunEvent(event)) return <RunBlock event={event} />;
  if (isTextEvent(event)) return <TextBlock event={event} />;
  if (isSkippedEvent(event)) return null;
  // Fallback: treat as text if it has text/content, otherwise skip
  if (event.text || event.content) return <TextBlock event={event} />;
  return null;
}
