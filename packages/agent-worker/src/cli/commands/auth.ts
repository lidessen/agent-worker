/**
 * aw auth — Manage LLM provider API keys.
 *
 * Subcommands:
 *   <provider>   Save API key (anthropic, openai, deepseek).
 *   status       Show which providers are authenticated.
 *   rm <name>    Remove a saved API key.
 */

import { createInterface } from "node:readline/promises";
import { fatal, wantsHelp } from "../output.ts";

// ── Provider definitions ────────────────────────────────────────────────────

interface ProviderInfo {
  envVar: string;
  label: string;
  hint: string;
}

const PROVIDERS: Record<string, ProviderInfo> = {
  anthropic: {
    envVar: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    hint: "console.anthropic.com",
  },
  openai: {
    envVar: "OPENAI_API_KEY",
    label: "OpenAI",
    hint: "platform.openai.com",
  },
  google: {
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    label: "Google",
    hint: "aistudio.google.com",
  },
  deepseek: {
    envVar: "DEEPSEEK_API_KEY",
    label: "DeepSeek",
    hint: "platform.deepseek.com",
  },
  "kimi-code": {
    envVar: "KIMI_CODE_API_KEY",
    label: "Kimi Code",
    hint: "kimi.com/code",
  },
  minimax: {
    envVar: "MINIMAX_API_KEY",
    label: "MiniMax",
    hint: "platform.minimax.chat",
  },
  "ai-gateway": {
    envVar: "AI_GATEWAY_API_KEY",
    label: "Vercel AI Gateway",
    hint: "vercel.com/ai-gateway",
  },
  zenmux: {
    envVar: "ZENMUX_API_KEY",
    label: "ZenMux",
    hint: "zenmux.ai",
  },
};

function maskKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function auth(args: string[]): Promise<void> {
  const sub = args[0];

  if (!wantsHelp(args)) {
    if (sub === "status") return authStatus();
    if (sub === "rm") return authRm(args[1]);
    if (sub && sub in PROVIDERS) return authProvider(sub);
  }

  console.log(`Usage: aw auth <command>

Commands:
  anthropic    Save Anthropic API key
  openai       Save OpenAI API key
  google       Save Google API key
  deepseek     Save DeepSeek API key
  kimi-code    Save Kimi Code API key
  minimax      Save MiniMax API key
  ai-gateway   Save Vercel AI Gateway API key
  zenmux       Save ZenMux API key
  status       Show which providers are authenticated
  rm <name>    Remove a saved API key

Keys are saved to ~/.agent-worker/secrets.json and also resolved
from environment variables (e.g. ANTHROPIC_API_KEY in .env or shell).
`);
  if (sub && !wantsHelp(args)) {
    console.error(`Unknown provider: ${sub}`);
    process.exit(1);
  }
}

// ── Provider auth ───────────────────────────────────────────────────────────

async function authProvider(name: string): Promise<void> {
  const provider = PROVIDERS[name]!;
  const { loadSecrets, setSecret } = await import("@agent-worker/workspace");
  const secrets = await loadSecrets();
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    // Check existing: secrets → env
    const existing = secrets[provider.envVar] ?? process.env[provider.envVar];
    if (existing) {
      console.log(`\n  ${provider.label} already authenticated: ${maskKey(existing)}`);
      const source = secrets[provider.envVar] ? "secrets" : "env";
      console.log(`  Source: ${source}`);

      const answer = await rl.question("\n  Overwrite? [y/N] ");
      if (answer.trim().toLowerCase() !== "y") {
        console.log("  Kept existing key.");
        return;
      }
      console.log();
    }

    const apiKey = (await rl.question(`  API key (from ${provider.hint}): `)).trim();
    if (!apiKey) {
      fatal("API key is required.");
    }

    await setSecret(provider.envVar, apiKey);
    console.log(`\n  ${provider.label} authenticated: ${maskKey(apiKey)}`);
  } finally {
    rl.close();
  }
}

// ── Status ──────────────────────────────────────────────────────────────────

async function authStatus(): Promise<void> {
  const { loadSecrets } = await import("@agent-worker/workspace");
  const secrets = await loadSecrets();
  let hasAny = false;

  console.log();
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    const fromSecrets = secrets[provider.envVar];
    const fromEnv = process.env[provider.envVar];
    const key = fromSecrets ?? fromEnv;

    if (key) {
      hasAny = true;
      const source = fromSecrets ? "secrets" : "env";
      console.log(`  ${name.padEnd(12)} ${maskKey(key)}  (${source})`);
    } else {
      console.log(`  ${name.padEnd(12)} —`);
    }
  }
  console.log();

  if (!hasAny) {
    console.log("  Run 'aw auth anthropic' to get started.\n");
  }
}

// ── Remove ──────────────────────────────────────────────────────────────────

async function authRm(name?: string): Promise<void> {
  if (!name) {
    fatal("Usage: aw auth rm <provider>");
  }
  const provider = PROVIDERS[name];
  if (!provider) {
    fatal(`Unknown provider: ${name}. Available: ${Object.keys(PROVIDERS).join(", ")}`);
  }

  const { deleteSecret } = await import("@agent-worker/workspace");
  const removed = await deleteSecret(provider.envVar);

  if (removed) {
    console.log(`Removed ${provider.label} API key from secrets.`);
  } else if (process.env[provider.envVar]) {
    console.log(`No saved key found, but ${provider.envVar} is set in environment.`);
    console.log(`Remove it from your .env or shell profile to fully disconnect.`);
  } else {
    console.log(`No ${provider.label} API key found.`);
  }
}
