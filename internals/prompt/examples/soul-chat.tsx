/** @jsxImportSource @semajsx/prompt */

/**
 * Soul Chat Agent - Reactive prompt with multiple channels, memories, and focus
 *
 * Demonstrates:
 * - Multiple signal-driven data sources (channels, messages, memories, focus)
 * - Each component for reactive list rendering
 * - Window component for paginated message feed
 * - Tool actions for the agent to switch channels, filter, and navigate
 * - Reactive re-rendering when any signal changes
 *
 * Run: bun run examples/soul-chat.tsx
 */

import { signal, computed } from "@semajsx/signal";
import { render } from "@semajsx/prompt";
import { Screen, Section, ActionBar, Each, Window } from "@semajsx/prompt";
import type { Signal, ReadableSignal } from "@semajsx/signal";
import type { JSXNode } from "@semajsx/core";

// ─── Data Types ──────────────────────────────────────────────

interface Message {
  id: string;
  from: string;
  text: string;
  time: string;
  unread: boolean;
}

interface Channel {
  id: string;
  name: string;
  topic: string;
  messages: Message[];
}

interface Memory {
  key: string;
  content: string;
  relevance: number; // 0-1
}

type FilterMode = "all" | "unread" | "mentions";

// ─── State ───────────────────────────────────────────────────

const channels: Signal<Channel[]> = signal([
  {
    id: "ch-general",
    name: "#general",
    topic: "Team coordination",
    messages: [
      { id: "m1", from: "Alice", text: "Morning everyone!", time: "09:01", unread: false },
      { id: "m2", from: "Bob", text: "Hey! Ready for standup?", time: "09:02", unread: false },
      { id: "m3", from: "Alice", text: "Yes, give me 5 min", time: "09:03", unread: false },
      {
        id: "m4",
        from: "Carol",
        text: "The deploy pipeline is green",
        time: "09:15",
        unread: false,
      },
      { id: "m5", from: "Bob", text: "Nice! Let's ship v2.3 today", time: "09:16", unread: false },
      {
        id: "m6",
        from: "Alice",
        text: "@soul Can you summarize the open issues?",
        time: "09:20",
        unread: true,
      },
      {
        id: "m7",
        from: "Carol",
        text: "Also check the perf regression in #backend",
        time: "09:21",
        unread: true,
      },
      {
        id: "m8",
        from: "Dave",
        text: "FYI: customer reported slow dashboard load",
        time: "09:25",
        unread: true,
      },
      { id: "m9", from: "Alice", text: "Priority on that ^", time: "09:26", unread: true },
      {
        id: "m10",
        from: "Bob",
        text: "@soul What's the status of the cache fix?",
        time: "09:30",
        unread: true,
      },
    ],
  },
  {
    id: "ch-backend",
    name: "#backend",
    topic: "Backend engineering",
    messages: [
      {
        id: "b1",
        from: "Carol",
        text: "Found the perf regression - it's the new ORM query",
        time: "08:45",
        unread: false,
      },
      { id: "b2", from: "Dave", text: "Which endpoint?", time: "08:46", unread: false },
      {
        id: "b3",
        from: "Carol",
        text: "/api/dashboard/stats - N+1 query",
        time: "08:47",
        unread: false,
      },
      {
        id: "b4",
        from: "Dave",
        text: "I'll look at adding eager loading",
        time: "08:50",
        unread: false,
      },
      {
        id: "b5",
        from: "Carol",
        text: "PR #421 has the fix, needs review",
        time: "09:10",
        unread: true,
      },
      { id: "b6", from: "Dave", text: "Reviewing now", time: "09:12", unread: true },
      {
        id: "b7",
        from: "Carol",
        text: "@soul Can you check if PR #421 introduces any breaking changes?",
        time: "09:22",
        unread: true,
      },
    ],
  },
  {
    id: "ch-incidents",
    name: "#incidents",
    topic: "Active incidents and alerts",
    messages: [
      {
        id: "i1",
        from: "AlertBot",
        text: "WARN: p95 latency > 500ms on /api/dashboard/stats",
        time: "08:30",
        unread: false,
      },
      {
        id: "i2",
        from: "Carol",
        text: "Investigating - likely related to new deploy",
        time: "08:35",
        unread: false,
      },
      {
        id: "i3",
        from: "AlertBot",
        text: "INFO: latency stabilized after rollback of query optimizer",
        time: "09:15",
        unread: true,
      },
      {
        id: "i4",
        from: "Dave",
        text: "Root cause identified: N+1 in dashboard stats",
        time: "09:18",
        unread: true,
      },
    ],
  },
]);

const focusChannel: Signal<string> = signal("ch-general");
const filterMode: Signal<FilterMode> = signal("all");
const scrollOffset: Signal<number> = signal(0);

const memories: Signal<Memory[]> = signal([
  {
    key: "team-context",
    content: "Team is preparing v2.3 release. Deploy pipeline uses GitHub Actions.",
    relevance: 0.9,
  },
  {
    key: "perf-issue",
    content: "Dashboard stats endpoint has N+1 query regression since last deploy.",
    relevance: 0.95,
  },
  {
    key: "alice-pref",
    content: "Alice prefers concise summaries. Is the team lead.",
    relevance: 0.7,
  },
  {
    key: "cache-fix",
    content: "Cache invalidation fix is in PR #418, merged but not yet deployed.",
    relevance: 0.85,
  },
  { key: "bob-role", content: "Bob is the release manager for v2.3.", relevance: 0.6 },
]);

// ─── Derived State ───────────────────────────────────────────

const filteredMessages: ReadableSignal<Message[]> = computed(
  [channels, focusChannel, filterMode],
  (chs, focusId, mode) => {
    const ch = chs.find((c) => c.id === focusId);
    if (!ch) return [];
    switch (mode) {
      case "unread":
        return ch.messages.filter((m) => m.unread);
      case "mentions":
        return ch.messages.filter((m) => m.text.includes("@soul"));
      default:
        return ch.messages;
    }
  },
);

const channelSummaries: ReadableSignal<string[]> = computed(channels, (chs) =>
  chs.map((ch) => {
    const unread = ch.messages.filter((m) => m.unread).length;
    const badge = unread > 0 ? ` (${unread} unread)` : "";
    return `${ch.name}${badge} - ${ch.topic}`;
  }),
);

const relevantMemories: ReadableSignal<Memory[]> = computed(memories, (mems) =>
  [...mems].sort((a, b) => b.relevance - a.relevance).slice(0, 3),
);

// ─── Components ──────────────────────────────────────────────

function ChannelList(): JSXNode {
  return (
    <Section title="CHANNELS">
      <Each of={channelSummaries} render={(s, i) => <item key={i}>{s}</item>} />
    </Section>
  );
}

function MessageFeed(): JSXNode {
  return (
    <Window
      title="MESSAGES"
      of={filteredMessages}
      size={10}
      offset={scrollOffset}
      header={
        <line>
          Filter: {filterMode} | Channel: {computed(focusChannel, (id) => id)}
        </line>
      }
      render={(msg) => (
        <line key={msg.id}>
          [{msg.time}] {msg.from}: {msg.text}
          {msg.unread ? " *NEW*" : ""}
        </line>
      )}
    />
  );
}

function MemoryPanel(): JSXNode {
  return (
    <Section title="RELEVANT MEMORIES">
      <Each
        of={relevantMemories}
        render={(m) => (
          <item key={m.key}>
            [{m.key}] (relevance={m.relevance}) {m.content}
          </item>
        )}
      />
    </Section>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

function SoulChatScreen(): JSXNode {
  return (
    <Screen name="Soul Chat Agent" time="2026-03-12 09:31:00" focus={focusChannel}>
      <Section title="ROLE">
        <line>You are Soul, a team assistant embedded in the chat workspace.</line>
        <line>Monitor channels, summarize threads, answer questions, and take actions.</line>
      </Section>

      <Section title="AWARENESS">
        <item>You can see the last messages in the focused channel</item>
        <item>Messages marked *NEW* are unread - prioritize these</item>
        <item>Use filters to narrow down relevant messages</item>
        <item>Switch channels to get full context before answering</item>
      </Section>

      <ChannelList />
      <MessageFeed />
      <MemoryPanel />

      <Section title="TOOLS">
        <ActionBar
          label="Channel Tools"
          actions={[
            { label: "Switch to #general", name: "switch_channel", channel: "ch-general" },
            { label: "Switch to #backend", name: "switch_channel", channel: "ch-backend" },
            { label: "Switch to #incidents", name: "switch_channel", channel: "ch-incidents" },
          ]}
        />
        <br />
        <ActionBar
          label="Filters"
          actions={[
            { label: "Show All", name: "set_filter", mode: "all" },
            { label: "Unread Only", name: "set_filter", mode: "unread" },
            { label: "Mentions Only", name: "set_filter", mode: "mentions" },
          ]}
        />
        <br />
        <ActionBar
          label="Navigate"
          actions={[
            { label: "Scroll Up", name: "scroll", direction: "up", amount: "10" },
            { label: "Scroll Down", name: "scroll", direction: "down", amount: "10" },
            { label: "Mark Read", name: "mark_read", channel: "current" },
            { label: "Reply", name: "reply", channel: "current" },
          ]}
        />
      </Section>
    </Screen>
  );
}

// ─── Run ─────────────────────────────────────────────────────

const result = render(<SoulChatScreen />);

console.log("=== Initial Render ===\n");
console.log(result.toString());

// Subscribe to updates
result.subscribe((text) => {
  console.log("\n=== Updated Render ===\n");
  console.log(text);
});

// Simulate tool calls that an LLM agent would make:

// 1) Agent switches to unread filter
console.log("\n--- Tool call: set_filter mode=unread ---");
filterMode.value = "unread";
await new Promise((r) => setTimeout(r, 10));

// 2) Agent switches to #backend channel
console.log("\n--- Tool call: switch_channel channel=ch-backend ---");
focusChannel.value = "ch-backend";
await new Promise((r) => setTimeout(r, 10));

// 3) Agent switches to mentions filter
console.log("\n--- Tool call: set_filter mode=mentions ---");
filterMode.value = "mentions";
await new Promise((r) => setTimeout(r, 10));

// 4) New message arrives in #backend
console.log("\n--- Event: new message in #backend ---");
const currentChannels = channels.value;
const backend = currentChannels.find((c) => c.id === "ch-backend");
if (backend) {
  backend.messages.push({
    id: "b8",
    from: "Carol",
    text: "@soul PR #421 is approved, please confirm no breaking changes",
    time: "09:33",
    unread: true,
  });
  channels.value = [...currentChannels];
}
await new Promise((r) => setTimeout(r, 10));

// 5) Agent switches back to all messages
console.log("\n--- Tool call: set_filter mode=all ---");
filterMode.value = "all";
await new Promise((r) => setTimeout(r, 10));

// 6) Memory update - new context learned
console.log("\n--- Memory update: new context ---");
memories.value = [
  ...memories.value,
  {
    key: "pr-421",
    content:
      "PR #421 fixes N+1 query in dashboard stats. Approved by Dave. No breaking changes detected.",
    relevance: 0.98,
  },
];
await new Promise((r) => setTimeout(r, 10));

// Clean up
result.unmount();
console.log("\n--- Unmounted ---");
