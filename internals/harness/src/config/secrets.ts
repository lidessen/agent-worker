/**
 * Secrets store — a simple KV file at ~/.agent-worker/secrets.json.
 *
 * Used for storing tokens and credentials that can be referenced
 * in harness YAML via `${{ secrets.KEY }}` template syntax.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const SECRETS_FILE = join(homedir(), ".agent-worker", "secrets.json");

/** Load all secrets from disk. Returns empty object if file doesn't exist. */
export async function loadSecrets(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(SECRETS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Save all secrets to disk (full overwrite). */
export async function saveSecrets(secrets: Record<string, string>): Promise<void> {
  await mkdir(join(homedir(), ".agent-worker"), { recursive: true });
  await writeFile(SECRETS_FILE, JSON.stringify(secrets, null, 2) + "\n", { mode: 0o600 });
}

/** Set a single secret (read-modify-write). */
export async function setSecret(key: string, value: string): Promise<void> {
  const secrets = await loadSecrets();
  secrets[key] = value;
  await saveSecrets(secrets);
}

/** Delete a single secret. Returns true if it existed. */
export async function deleteSecret(key: string): Promise<boolean> {
  const secrets = await loadSecrets();
  if (!(key in secrets)) return false;
  delete secrets[key];
  await saveSecrets(secrets);
  return true;
}

/** Get the path to the secrets file (for display purposes). */
export function getSecretsPath(): string {
  return SECRETS_FILE;
}
