import { parse as parseYaml } from "yaml";
import type {
  WorkspaceYamlConfig,
  LoadedWorkspaceConfig,
  SetupStep,
} from "./types.ts";
import type { WorkspaceConfig, QueueConfig } from "../types.ts";
import { MemoryStorage, FileStorage } from "../context/storage.ts";

// ── Template interpolation ────────────────────────────────────────────────

const TEMPLATE_RE = /\$\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

/**
 * Interpolate `${{ var }}` references in a string.
 * Supports dotted paths like `${{ workspace.tag }}`.
 */
export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(TEMPLATE_RE, (match, key: string) => {
    return vars[key] ?? match; // leave unresolved templates as-is
  });
}

// ── Setup step runner ─────────────────────────────────────────────────────

/**
 * Run setup steps sequentially, collecting captured variables.
 * Each step runs a shell command; if `as` is specified, stdout is captured.
 */
export async function runSetupSteps(
  steps: SetupStep[],
  baseVars: Record<string, string> = {},
): Promise<Record<string, string>> {
  const vars = { ...baseVars };

  for (const step of steps) {
    const cmd = interpolate(step.shell, vars);
    const proc = Bun.spawn(["sh", "-c", cmd], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(
        `Setup step failed (exit ${exitCode}): ${cmd}\nstderr: ${stderr.trim()}`,
      );
    }

    if (step.as) {
      vars[step.as] = stdout.trim();
    }
  }

  return vars;
}

// ── YAML parsing ──────────────────────────────────────────────────────────

/** Parse a YAML string into WorkspaceYamlConfig. */
export function parseWorkspaceYaml(content: string): WorkspaceYamlConfig {
  const raw = parseYaml(content);

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid workspace YAML: expected an object");
  }

  if (!raw.name || typeof raw.name !== "string") {
    throw new Error("Invalid workspace YAML: 'name' is required");
  }

  if (!raw.agents || typeof raw.agents !== "object") {
    throw new Error("Invalid workspace YAML: 'agents' map is required");
  }

  return raw as WorkspaceYamlConfig;
}

// ── Full config loader ────────────────────────────────────────────────────

export interface LoadOptions {
  /** Instance tag for multi-instance isolation. */
  tag?: string;
  /** Extra template variables. */
  vars?: Record<string, string>;
  /** Skip running setup steps (useful for dry-run / validation). */
  skipSetup?: boolean;
}

/**
 * Load a workspace YAML file, run setup steps, and interpolate templates.
 * Returns the parsed config, setup variables, and the resolved kickoff message.
 */
export async function loadWorkspaceYaml(
  pathOrContent: string,
  opts: LoadOptions = {},
): Promise<LoadedWorkspaceConfig> {
  // Determine if it's a file path or raw YAML content
  let content: string;
  if (
    pathOrContent.includes("\n") ||
    pathOrContent.trimStart().startsWith("name:")
  ) {
    content = pathOrContent;
  } else {
    const file = Bun.file(pathOrContent);
    if (!(await file.exists())) {
      throw new Error(`Workspace YAML not found: ${pathOrContent}`);
    }
    content = await file.text();
  }

  const yaml = parseWorkspaceYaml(content);

  // Build template vars
  const baseVars: Record<string, string> = {
    ...opts.vars,
    "workspace.name": yaml.name,
  };
  if (opts.tag) {
    baseVars["workspace.tag"] = opts.tag;
  }

  // Run setup steps
  let setupVars: Record<string, string> = {};
  if (yaml.setup && !opts.skipSetup) {
    setupVars = await runSetupSteps(yaml.setup, baseVars);
  }

  // Merge all vars for kickoff interpolation
  const allVars = { ...baseVars, ...setupVars };

  // Interpolate kickoff
  const kickoff = yaml.kickoff ? interpolate(yaml.kickoff, allVars) : undefined;

  return { yaml, setupVars, kickoff };
}

// ── Convert to WorkspaceConfig ────────────────────────────────────────────

/**
 * Convert a loaded YAML config into a WorkspaceConfig suitable for createWorkspace().
 */
export function toWorkspaceConfig(
  loaded: LoadedWorkspaceConfig,
  opts: LoadOptions = {},
): WorkspaceConfig {
  const { yaml } = loaded;

  // Storage backend
  const providerType = yaml.context?.provider ?? "file";
  const storage =
    providerType === "memory"
      ? new MemoryStorage()
      : new FileStorage(
          yaml.context?.dir ??
            `/tmp/agent-worker-${yaml.name}${opts.tag ? `-${opts.tag}` : ""}`,
        );

  // Queue config
  let queueConfig: QueueConfig | undefined;
  if (yaml.queue) {
    queueConfig = {
      immediateQuota: yaml.queue.immediate_quota,
      normalQuota: yaml.queue.normal_quota,
      maxBackgroundWait: yaml.queue.max_background_wait,
      maxPreemptions: yaml.queue.max_preemptions,
    };
  }

  return {
    name: yaml.name,
    tag: opts.tag,
    channels: yaml.channels,
    defaultChannel: yaml.default_channel,
    agents: Object.keys(yaml.agents),
    storage,
    queueConfig,
    smartSendThreshold: yaml.smart_send_threshold,
  };
}
