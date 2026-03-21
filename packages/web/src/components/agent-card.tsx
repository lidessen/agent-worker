/** @jsxImportSource semajsx/dom */

import type { AgentInfo } from "../api/types.ts";
import { navigate } from "../router.ts";
import { tokens } from "../theme/tokens.ts";
import * as styles from "./agent-card.style.ts";

const stateColors: Record<string, string> = {
  idle: tokens.colors.agentIdle,
  running: tokens.colors.agentRunning,
  processing: tokens.colors.agentRunning,
  error: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
  stopped: tokens.colors.agentIdle,
};

function stateColor(state: string): string {
  return stateColors[state] ?? tokens.colors.agentIdle;
}

export function AgentCard(props: { agent: AgentInfo }) {
  const { agent } = props;

  function handleClick() {
    navigate("/agents/" + agent.name);
  }

  return (
    <div class={styles.card} role="button" tabindex="0" onclick={handleClick}>
      <span class={styles.name}>{agent.name}</span>
      <div class={styles.badge}>
        <span
          class={styles.badgeDot}
          style={`background: ${stateColor(agent.state)}`}
        />
        {agent.state}
      </div>
      <div class={styles.meta}>
        <span class={styles.metaItem}>{agent.runtime}</span>
        {agent.model ? <span class={styles.metaItem}>{agent.model}</span> : null}
      </div>
    </div>
  );
}
