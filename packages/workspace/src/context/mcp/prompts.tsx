/** @jsxImportSource semajsx/prompt */

import type { PromptSection } from "../../loop/prompt.tsx";
import type { Message } from "../../types.ts";
import type { Task, TaskStatus } from "../../state/index.ts";

/** Max chars per message before truncation. */
const MSG_PREVIEW_LIMIT = 300;
/** Number of recent messages to include per channel. */
const RECENT_MSG_LIMIT = 20;

/**
 * Workspace prompt section — injected alongside workspace MCP tools.
 * Tells the agent who it is, where it is, and how to use workspace tools.
 */
export const workspacePromptSection: PromptSection = async (ctx) => {
  const members = await ctx.provider.status.getAll();
  const teammates = members.filter((m) => m.name !== ctx.agentName);
  const channels = ctx.provider.channels.listChannels();
  const isLead = ctx.role === "lead" || ctx.provider.lead === ctx.agentName;
  const isWorker = ctx.role === "worker";
  const ledgerAvailable = Boolean(ctx.stateStore);
  return (
    <section title="Workspace">
      <raw>
        {`You are **@${ctx.agentName}** in a collaborative workspace with channels, teammates, and shared documents.`}
      </raw>
      <br />
      {isLead && (
        <>
          <line>You are the workspace lead</line>
          <item>
            You are responsible for responding to user messages, even if they don&apos;t @ you
            directly.
          </item>
          <item>
            Unmentioned messages from users (e.g. telegram) are routed to you at normal priority.
          </item>
          <item>You have access to debug tools and can see all channels.</item>
          <item>Coordinate the team, review work, and report back to the user.</item>
          <br />
          {ledgerAvailable && (
            <>
              <line>Task ledger workflow</line>
              <item>
                Use `task_create` to capture a new work item (default status: draft). If a new user
                request arrives, create a draft task for it before doing anything else.
              </item>
              <item>
                Use `task_update status=open` to confirm a draft, then `task_dispatch worker=@name`
                to hand it to a worker. Dispatch creates the Attempt, advances the task to
                in_progress, and enqueues the assignment on the worker&apos;s queue.
              </item>
              <item>
                Use `task_list` to see active work. The Task Ledger section below shows the same
                view rendered at prompt assembly time.
              </item>
              <item>
                When a worker reports back via handoff, review the handoff, decide the next step,
                and update the task status (`task_update status=completed` for acceptance,
                `status=blocked` to wait, `status=failed` to abort).
              </item>
              <br />
            </>
          )}
        </>
      )}
      {isWorker && ledgerAvailable && (
        <>
          <line>You are a task-scoped worker</line>
          <item>
            When you receive a dispatch instruction, it already carries a task id and attempt id.
            Start work immediately — don&apos;t create your own Attempt unless you are acting
            without a dispatch.
          </item>
          <item>
            Record structured progress with `handoff_create kind=progress` during long work,
            `kind=blocked` when stuck, and `kind=completed` at the end.
          </item>
          <item>
            Register concrete outputs (files, commits, URLs) with `artifact_create` so the lead can
            review and mark the task complete.
          </item>
          <item>
            Call `attempt_update status=completed` (or `failed` / `cancelled`) when you finish so
            the lead knows the attempt is terminal.
          </item>
          <br />
        </>
      )}
      <line>Key mechanics</line>
      <item>
        `channel_send` posts to channels. Plain text output is your private thinking -- only you see
        it.
      </item>
      <item>`@name` in messages notifies that teammate.</item>
      <item>
        Messages over 1200 chars: use `resource_create` first, then send a summary with the resource
        ID.
      </item>
      <item>`channel_read` shows full conversation history beyond what&apos;s shown below.</item>
      <br />
      <line>Directories</line>
      <field label="Personal sandbox" value={`\`${ctx.sandboxDir ?? "(not available)"}\``} />
      <field
        label="Shared workspace"
        value={`\`${ctx.workspaceSandboxDir ?? "(not available)"}\``}
      />
      <br />
      <line>Channels</line>
      {channels.length > 0 ? (
        channels.map((channel) => <item key={channel}>{`#${channel}`}</item>)
      ) : (
        <item>(none)</item>
      )}
      {teammates.length > 0 && (
        <>
          <br />
          <line>Teammates</line>
          {teammates.map((teammate) => (
            <item key={teammate.name}>{`@${teammate.name}: ${teammate.status}`}</item>
          ))}
        </>
      )}
    </section>
  );
};

/**
 * Unified conversation section — shows recent channel messages with the
 * current instruction highlighted in-context using a `→` marker.
 *
 * Replaces the old separate "Current Task" + "Recent Messages" sections.
 * The agent sees the full conversation flow and knows exactly which message
 * it's responding to.
 */
export const conversationSection: PromptSection = async (ctx) => {
  const channels = ctx.provider.channels.listChannels();
  if (channels.length === 0 && !ctx.currentInstruction) return null;

  let instructionInTimeline = false;
  const channelSections = await Promise.all(
    channels.map(async (ch) => {
      const allMsgs = await ctx.provider.channels.read(ch);
      if (allMsgs.length === 0) return null;

      const total = allMsgs.length;
      const recent = allMsgs.slice(-RECENT_MSG_LIMIT);
      const omitted = total - recent.length;
      let foundCurrent = false;
      const messageBlocks = recent.map((m) => {
        const isCurrent = ctx.currentMessageId === m.id;
        if (isCurrent) foundCurrent = true;
        const marker = isCurrent ? "→ " : "  ";
        const formatted = formatMessage(m);
        return formatted
          .split("\n")
          .map((line, i) => (i === 0 ? `${marker}${line}` : `  ${line}`))
          .join("\n");
      });

      let header = `#${ch}:`;
      if (omitted > 0) {
        header += ` (${omitted} earlier -- use \`channel_read\` with higher \`limit\` to see more)`;
      }
      if (foundCurrent) instructionInTimeline = true;
      return (
        <>
          <line key={`header.${ch}`}>{header}</line>
          <indent key={`messages.${ch}`}>
            {messageBlocks.map((block, index) => (
              <raw key={`message.${ch}.${index}`}>{block}</raw>
            ))}
          </indent>
        </>
      );
    }),
  );

  const visibleChannels = channelSections.filter((section) => section !== null);

  return (
    <section title="Conversation">
      {!instructionInTimeline && ctx.currentInstruction && (
        <>
          <raw>{`**Respond to:** ${ctx.currentInstruction}`}</raw>
          <br />
        </>
      )}
      {visibleChannels.map((section, index) => (
        <>
          {section}
          {index < visibleChannels.length - 1 && <br />}
        </>
      ))}
    </section>
  );
};

/** Shared documents available in the workspace. */
export const docsPromptSection: PromptSection = async (ctx) => {
  const docs = await ctx.provider.documents.list();
  if (docs.length === 0) return null;
  return (
    <section title="Shared Documents">
      <line>{`Available: ${docs.join(", ")}`}</line>
    </section>
  );
};

/**
 * Task ledger section — shown to the lead only. Lists draft/open/in_progress
 * tasks so the lead can reason about what's pending without re-parsing
 * channel history. Workers are intentionally excluded; they get their task
 * context through attempt assignment, not through a global ledger dump.
 */
export const taskLedgerSection: PromptSection = async (ctx) => {
  if (ctx.role !== "lead") return null;
  if (!ctx.stateStore) return null;

  const ACTIVE_STATUSES: TaskStatus[] = ["draft", "open", "in_progress", "blocked"];
  const tasks = await ctx.stateStore.listTasks({ status: ACTIVE_STATUSES });
  if (tasks.length === 0) return null;

  const groups = groupTasksByStatus(tasks);

  return (
    <section title={`Task Ledger (${tasks.length} active)`}>
      <line>
        Use `task_create` / `task_update` / `task_list` / `task_get` to manage entries. Advance a
        confirmed draft with `task_update status=open` and close with `task_update
        status=completed`.
      </line>
      <br />
      {groups.map(([status, list], groupIndex) => (
        <>
          <line key={`header.${status}`}>{`${status} (${list.length})`}</line>
          {list.map((task) => (
            <item key={`task.${task.id}`}>{formatLedgerEntry(task)}</item>
          ))}
          {groupIndex < groups.length - 1 && <br key={`break.${status}`} />}
        </>
      ))}
    </section>
  );
};

function groupTasksByStatus(tasks: readonly Task[]): Array<[TaskStatus, Task[]]> {
  const order: TaskStatus[] = ["draft", "open", "in_progress", "blocked"];
  const map = new Map<TaskStatus, Task[]>();
  for (const status of order) map.set(status, []);
  for (const task of tasks) {
    if (map.has(task.status)) map.get(task.status)!.push(task);
  }
  return order
    .map((status) => [status, map.get(status) ?? []] as [TaskStatus, Task[]])
    .filter(([, list]) => list.length > 0);
}

function formatLedgerEntry(task: Task): string {
  const parts = [`[${task.id}] ${task.title}`];
  if (task.ownerLeadId) parts.push(`owner=${task.ownerLeadId}`);
  if (task.activeAttemptId) parts.push(`active=${task.activeAttemptId}`);
  return parts.join(" — ");
}

/** All workspace prompt sections, in order. */
export const WORKSPACE_PROMPT_SECTIONS: PromptSection[] = [
  workspacePromptSection,
  taskLedgerSection,
  conversationSection,
  docsPromptSection,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMessage(m: Message): string {
  const time = m.timestamp.split("T")[1]?.slice(0, 5) ?? "";
  let content = m.content;
  if (content.length > MSG_PREVIEW_LIMIT) {
    content = content.slice(0, MSG_PREVIEW_LIMIT) + "...";
  }
  const header = `<msg:${m.id}> [${time}] @${m.from}`;
  if (content.includes("\n") || content.length > 80) {
    const body = content
      .split("\n")
      .map((l) => (l ? `  ${l}` : ""))
      .join("\n");
    return `${header}\n${body}`;
  }
  return `${header}: ${content}`;
}
