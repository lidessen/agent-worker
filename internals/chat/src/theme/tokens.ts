/**
 * Chat-specific design tokens.
 *
 * Consumers can override any value via CSS custom properties on a parent element.
 * These extend whatever base theme the host app provides.
 */

import { defineTokens } from "@semajsx/style";
import type { TokenRefs } from "@semajsx/style";

const tokenDefinition = {
  chat: {
    // User message bubble
    userBg: "#0a84ff",
    userText: "#ffffff",

    // Assistant message
    assistantBg: "transparent",
    assistantText: "#e5e5e5",

    // Tool call card
    toolBorder: "rgba(255, 255, 255, 0.08)",
    toolBorderPending: "#0a84ff",
    toolBorderSuccess: "#30d158",
    toolBorderError: "#ff453a",
    toolBg: "#141414",

    // Thinking block
    thinkingBorder: "#ffd60a",
    thinkingBg: "#141414",
    thinkingText: "#737373",

    // Error block
    errorBorder: "#ff453a",
    errorBg: "#141414",
    errorText: "#ff453a",

    // Run divider
    runText: "#525252",
    runDivider: "rgba(255, 255, 255, 0.08)",

    // Status bar
    statusConnected: "#30d158",
    statusDisconnected: "#ff453a",
    statusText: "#525252",

    // Input
    inputBg: "#0a0a0a",
    inputBorder: "rgba(255, 255, 255, 0.08)",
    inputBorderFocus: "#0a84ff",
    inputText: "#e5e5e5",
    inputPlaceholder: "#525252",
    sendBg: "#0a84ff",
    sendBgHover: "#409cff",
  },
} as const;

export const chatTokens: TokenRefs<typeof tokenDefinition> = defineTokens(tokenDefinition);
