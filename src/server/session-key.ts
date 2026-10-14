/**
 * The key that seals open cases, made once and kept in the database — so it's
 * the same on every server and survives every deploy, with nothing to set up.
 * RAMAI_SESSION_SECRET, when set, still takes precedence.
 */
import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "./db";

let loading: Promise<void> | null = null;

/** Loaded once per server (tried again if it failed), before any request reads a case. */
export function sessionKeyReady(): Promise<void> {
  loading ??= loadSessionKey().catch((err) => {
    loading = null;
    console.error("[ramai] session key not loaded:", err instanceof Error ? err.message : err);
  });
  return loading;
}

async function loadSessionKey(): Promise<void> {
  if (process.env.RAMAI_SESSION_SECRET && process.env.RAMAI_SESSION_SECRET.length >= 32) return;
  await db.run("CREATE TABLE IF NOT EXISTS app_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL, created_at INTEGER NOT NULL)");
  // Two servers starting at once: only the first one's key is kept, and both read that one.
  await db.run("INSERT OR IGNORE INTO app_secrets (name, value, created_at) VALUES ('session', ?, ?)", randomBytes(48).toString("base64url"), Date.now());
  const row = await db.get<{ value: string }>("SELECT value FROM app_secrets WHERE name = 'session'");
  if (row?.value && row.value.length >= 32) process.env.RAMAI_SESSION_SECRET = row.value;
}
