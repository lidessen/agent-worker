import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["bar", "textarea", "sendBtn"] as const);

export const bar = rule`${c.bar} {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid ${t.chat.inputBorder};
  background: ${t.chat.toolBg};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.bar} {
    padding: 0.5rem 0.75rem;
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
}`;

export const textarea = rule`${c.textarea} {
  flex: 1;
  resize: none;
  border: 1px solid ${t.chat.inputBorder};
  border-radius: 10px;
  background: ${t.chat.inputBg};
  color: ${t.chat.inputText};
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  line-height: 1.5;
  min-height: 38px;
  max-height: 200px;
  overflow-y: auto;
  transition: border-color 0.15s ease;
}
${c.textarea}:focus {
  outline: none;
  border-color: ${t.chat.inputBorderFocus};
}
${c.textarea}::placeholder {
  color: ${t.chat.inputPlaceholder};
}
${c.textarea}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`;

export const sendBtn = rule`${c.sendBtn} {
  background: ${t.chat.sendBg};
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  height: 38px;
  transition: background 0.15s ease, opacity 0.15s ease;
}
${c.sendBtn}:hover {
  background: ${t.chat.sendBgHover};
}
${c.sendBtn}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`;
