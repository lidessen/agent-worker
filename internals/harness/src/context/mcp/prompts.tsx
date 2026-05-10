/** @jsxImportSource semajsx/prompt */

import type { PromptSection } from "../../loop/prompt.tsx";
import type { Message } from "../../types.ts";
import type { Task, TaskStatus } from "../../state/index.ts";

/** Max chars per message before truncation. */
const MSG_PREVIEW_LIMIT = 300;
/** Number of recent messages to include per channel. */
const RECENT_MSG_LIMIT = 20;

/**
 * Harness prompt section — injected alongside harness MCP tools.
 * Tells the agent who it is, where it is, and how to use harness tools.
 */
export const harnessPromptSection: PromptSection = async (ctx) => {
  const members = await ctx.provider.status.getAll();
  const teammates = members.filter((m) => m.name !== ctx.agentName);
  const channels = ctx.provider.channels.listChannels();
  const isLead = ctx.role === "lead" || ctx.provider.lead === ctx.agentName;
  const isWorker = ctx.role === "worker";
  const ledgerAvailable = Boolean(ctx.stateStore);
  return (
    <section title="Harness">
      <raw>
        {`You are **@${ctx.agentName}** in a collaborative harness with channels, teammates, and shared documents.`}
      </raw>
      <br />
      {isLead && (
        <>
          <line>You are the harness lead</line>
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
              <line>Task ledger workflow (harness-led hierarchical mode)</line>
              <item>
                Every user request MUST go through the task ledger before any real work. Do not
                reply with implementation directly — create or reuse a task, dispatch it to a
                worker, and let the worker do the work.
              </item>
              <item>
                **Check the Task Ledger section below first.** If an incoming request already has a
                matching `draft` task (e.g. auto-created by kickoff or a prior intake), DO NOT call
                `task_create` again — you will duplicate it. Instead call `task_update status=open`
                on the existing id, then `task_dispatch`.
              </item>
              <item>
                If there is no matching draft, call `task_create` with `title` and `goal`. The
                default status is `draft`; follow up with `task_update status=open` once you have
                confirmed the scope.
              </item>
              <item>
                Call `task_dispatch taskId=... worker=@name` to hand the open task to a
                worker-capable teammate (see the Teammates list below). Dispatch creates the Wake,
                advances the task to `in_progress`, and enqueues the assignment on the
                worker&apos;s queue. Only dispatch to agents shown in the Teammates list.
              </item>
              <item>
                After dispatching, acknowledge the user in one short sentence via `channel_send`
                (e.g. "收到，已派给 @worker 跟进 [task_id]") so they see the handoff without needing
                to poll.
              </item>
              <item>
                When a worker reports back via handoff (shown in ledger deltas between your runs),
                review it and update the task status — `task_update status=completed` for
                acceptance, `status=blocked` to wait for external input, `status=failed` to abort,
                `task_update status=open` + `task_dispatch` to re-assign to a different worker.
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
            You only work on a task when you have received an explicit dispatch instruction. A
            dispatch arrives as a message on the synthetic `dispatch` channel with body `You have
            been assigned task [task_id] by @lead ... Wake id: wake_xxx`. That is the only trigger
            for you to do real work.
          </item>
          <item>
            **Do NOT adopt an active Wake just because `task_list` / `task_get` shows one.** An
            active Wake may belong to a different worker that the lead dispatched in parallel.
            Before doing any work, call `wake_get` on the active Wake id and verify `agentName
            === you`. If it does not match, call `no_action` with reason "active Wake belongs to a
            different worker" and stop.
          </item>
          <item>
            When you receive a dispatch instruction, it already carries a task id and a Wake id.
            Start work immediately — do NOT call `wake_create` when acting on a dispatch; use the
            ids from the instruction body.
          </item>
          <item>
            When you finish, call `wake_update` with `id=&lt;wake id from the dispatch&gt;` and the
            terminal status (`completed` | `failed` | `cancelled` | `handed_off`). Never call
            `wake_create` to "close" a Wake.
          </item>
          <item>
            Record structured progress with `handoff_create kind=progress` during long work,
            `kind=blocked` when stuck, and `kind=completed` at the end.
          </item>
          <item>
            Register concrete outputs (files, commits, URLs, large blobs) with `resource_create`,
            then list those Resource ids in `handoff_create`'s `resources` field so the lead can
            review them and mark the task complete.
          </item>
          <item>
            **After the terminal `wake_update` call, send ONE short `channel_send` to the default
            channel** telling the lead you&apos;re done (e.g. "完成 task_xxx，详见 handoff
            hnd_yyy"). This is the only way the lead wakes up to review — without it your work sits
            in the ledger unseen.
          </item>
          <item>
            **Do NOT send intermediate acknowledgment messages to the channel** (e.g. "收到，开始
            实现"). Those wake the lead mid-work for no reason — the lead starts verifying against
            files that don&apos;t exist yet and wastes a run. Keep all your thinking in plain text
            and only call `channel_send` once, after the terminal `wake_update`.
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
        label="Shared harness"
        value={`\`${ctx.harnessSandboxDir ?? "(not available)"}\``}
      />
      {ctx.worktrees && ctx.worktrees.length > 0 && (
        <>
          <br />
          <line>Worktrees (current Wake)</line>
          {ctx.worktrees.map((wt) => (
            <field
              key={`wt.${wt.name}`}
              label={`worktree[${wt.name}]`}
              value={`\`${wt.path}\` (branch \`${wt.branch}\` from \`${wt.baseBranch}\`)`}
            />
          ))}
          <item>
            Your loop cwd is the {ctx.worktrees.length === 1 ? "single" : "`main`"} worktree
            above. Use `cd` for the others, or pass absolute paths.
          </item>
        </>
      )}
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

/** Shared documents available in the harness. */
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
 * context through Wake assignment, not through a global ledger dump.
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
  if (task.activeWakeId) parts.push(`active=${task.activeWakeId}`);
  return parts.join(" — ");
}

/** All harness prompt sections, in order. */
export const HARNESS_PROMPT_SECTIONS: PromptSection[] = [
  harnessPromptSection,
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
