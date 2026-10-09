/**
 * Database — SQLite via Node's built-in `node:sqlite` (no native dependencies).
 *
 * Suits a single server or container with a persistent volume. For serverless
 * or multi-instance deployments, port these few tables to Postgres; every query
 * lives in `src/server/*` and uses plain SQL.
 */
import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at INTEGER,
  patient_lang TEXT NOT NULL DEFAULT 'en',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  email_verified_at INTEGER,
  league_tier INTEGER NOT NULL DEFAULT 0,
  is_guest INTEGER NOT NULL DEFAULT 0,
  country TEXT NOT NULL DEFAULT 'IN'
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  case_ref TEXT NOT NULL,
  case_number INTEGER NOT NULL,
  specialty TEXT NOT NULL,
  track TEXT NOT NULL,
  level TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  verdict TEXT,
  rescued INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS results_user ON results(user_id, created_at);
CREATE INDEX IF NOT EXISTS results_time ON results(created_at);
CREATE TABLE IF NOT EXISTS case_starts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  tutorial INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS case_starts_user ON case_starts(user_id, created_at);
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens(user_id, purpose, created_at);
CREATE TABLE IF NOT EXISTS league_members (
  week INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  cohort INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  final_rank INTEGER,
  outcome TEXT,
  PRIMARY KEY (week, user_id)
);
CREATE INDEX IF NOT EXISTS league_cohort ON league_members(week, tier, cohort);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  amount INTEGER NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

const globalForDb = globalThis as unknown as { __ramaiDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (globalForDb.__ramaiDb) return globalForDb.__ramaiDb;
  const file = process.env.RAMAI_DB_PATH || path.join(process.cwd(), "data", "ramai.db");
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  db.exec(SCHEMA);
  migrate(db);
  globalForDb.__ramaiDb = db;
  return db;
}

/** Additive migrations for databases created by earlier versions. */
function migrate(db: DatabaseSync) {
  const columns = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
  if (!columns.includes("patient_lang")) db.exec("ALTER TABLE users ADD COLUMN patient_lang TEXT NOT NULL DEFAULT 'en'");
  if (!columns.includes("email_verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at INTEGER");
    // Accounts created before email verification existed are grandfathered in.
    db.exec("UPDATE users SET email_verified_at = created_at WHERE is_demo = 0");
  }
  if (!columns.includes("league_tier")) db.exec("ALTER TABLE users ADD COLUMN league_tier INTEGER NOT NULL DEFAULT 0");
  if (!columns.includes("is_guest")) db.exec("ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
  if (!columns.includes("country")) db.exec("ALTER TABLE users ADD COLUMN country TEXT NOT NULL DEFAULT 'IN'");
  const startColumns = (db.prepare("PRAGMA table_info(case_starts)").all() as { name: string }[]).map((c) => c.name);
  if (!startColumns.includes("tutorial")) db.exec("ALTER TABLE case_starts ADD COLUMN tutorial INTEGER NOT NULL DEFAULT 0");
}

/** Runs `fn` in a transaction. */
export function tx<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn(db);
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
