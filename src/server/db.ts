/**
 * Database — SQLite in two places, one set of queries.
 *
 *   TURSO_DATABASE_URL set  →  Turso, SQLite in the cloud over HTTPS. For
 *                              serverless hosts like Vercel, whose disks don't
 *                              keep files between requests.
 *   otherwise               →  a local file (RAMAI_DB_PATH, default
 *                              ./data/ramai.db) through Node's built-in
 *                              `node:sqlite` — development and single servers.
 *
 * Every query is async so both behave the same. `tx()` runs a function in a
 * write transaction; queries made inside it through `db` join it.
 */
import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { StatementSync } from "node:sqlite";

import type { Client } from "@libsql/client/http";

import { ConfigError } from "@/engine/session";
import { remoteDatabase } from "@/lib/server/database-env";

export type Value = string | number | bigint | null;

export interface Db {
  all<T>(sql: string, ...args: Value[]): Promise<T[]>;
  get<T>(sql: string, ...args: Value[]): Promise<T | undefined>;
  run(sql: string, ...args: Value[]): Promise<{ changes: number; lastId: number }>;
  /** Several writes at once, all or nothing — one round trip to the cloud. */
  batch(statements: { sql: string; args?: Value[] }[]): Promise<void>;
  /** Several reads at once — one round trip to the cloud. Each statement's rows, in order. */
  readMany(statements: { sql: string; args?: Value[] }[]): Promise<Record<string, unknown>[][]>;
}

interface Backend extends Db {
  exec(script: string): Promise<void>;
  transaction<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

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
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments_archive (
  order_id TEXT PRIMARY KEY,
  payment_id TEXT,
  amount INTEGER NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  archived_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  seen_at INTEGER NOT NULL,
  last_sent_day TEXT,
  failures INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
-- What the AI made for one case while it was played: its pictures and teaching notes. Kept for 30 days.
CREATE TABLE IF NOT EXISTS case_ai (
  session_id TEXT NOT NULL,
  key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, key)
);
CREATE INDEX IF NOT EXISTS case_ai_user ON case_ai(user_id);

-- Suggestions from guests and visitors without an account (accounts' suggestions live in Supabase).
CREATE TABLE IF NOT EXISTS open_suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  page TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  reply TEXT,
  replied_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS open_suggestions_created ON open_suggestions(created_at);
CREATE INDEX IF NOT EXISTS open_suggestions_user ON open_suggestions(user_id, created_at);

-- The community: posts, replies, likes and reports.
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  share_id TEXT,
  spoiler INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_feed ON posts(hidden, last_activity_at);
CREATE INDEX IF NOT EXISTS posts_topic ON posts(topic, hidden, last_activity_at);
CREATE INDEX IF NOT EXISTS posts_user ON posts(user_id, created_at);
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS replies_post ON replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS replies_user ON replies(user_id, created_at);
-- target: "p:<post id>" or "r:<reply id>"
CREATE TABLE IF NOT EXISTS likes (
  target TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (target, user_id)
);
CREATE INDEX IF NOT EXISTS likes_user ON likes(user_id);
CREATE TABLE IF NOT EXISTS reports (
  target TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (target, user_id)
);

-- Practice questions answered after cases (the first answer to each counts), for progress and the report.
CREATE TABLE IF NOT EXISTS mcq_answers (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  q INTEGER NOT NULL,
  topic TEXT NOT NULL,
  correct INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, session_id, q)
);
CREATE INDEX IF NOT EXISTS mcq_answers_user ON mcq_answers(user_id, created_at);

-- The personal report, written by AI from a doctor's cases — rewritten when there are new ones.
CREATE TABLE IF NOT EXISTS progress_reports (
  user_id TEXT PRIMARY KEY,
  cases INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Patients invented ahead of time, so the next case starts at once.
CREATE TABLE IF NOT EXISTS case_pool (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pool_key TEXT NOT NULL,
  src TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS case_pool_user ON case_pool(user_id, pool_key, created_at);

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

export { remoteDatabase };

/* -------------------------------------------------------------------------- */
/* A local file                                                                */
/* -------------------------------------------------------------------------- */

async function fileBackend(): Promise<Backend> {
  if (process.env.VERCEL) {
    throw new ConfigError("No database: Vercel can't keep a database file. Connect Turso (Vercel → Storage) so TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set, then redeploy.");
  }
  const { DatabaseSync } = await import("node:sqlite");
  const file = process.env.RAMAI_DB_PATH || path.join(process.cwd(), "data", "ramai.db");
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  const statements = new Map<string, StatementSync>();
  const stmt = (sql: string) => {
    let s = statements.get(sql);
    if (!s) statements.set(sql, (s = sqlite.prepare(sql)));
    return s;
  };
  const direct: Db = {
    async all<T>(sql: string, ...args: Value[]) {
      return stmt(sql).all(...args) as T[];
    },
    async get<T>(sql: string, ...args: Value[]) {
      return stmt(sql).get(...args) as T | undefined;
    },
    async run(sql: string, ...args: Value[]) {
      const r = stmt(sql).run(...args);
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
    },
    async batch(list) {
      for (const s of list) stmt(s.sql).run(...(s.args ?? []));
    },
    async readMany(list) {
      return list.map((s) => stmt(s.sql).all(...(s.args ?? [])) as Record<string, unknown>[]);
    },
  };
  const atomically = async <T>(fn: () => Promise<T>) => {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const out = await fn();
      sqlite.exec("COMMIT");
      return out;
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  };
  // One connection: a transaction keeps it until it ends, and other queries wait their turn.
  let queue: Promise<unknown> = Promise.resolve();
  const turn = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    all: (sql, ...args) => turn(() => direct.all(sql, ...args)),
    get: (sql, ...args) => turn(() => direct.get(sql, ...args)),
    run: (sql, ...args) => turn(() => direct.run(sql, ...args)),
    batch: (list) => turn(() => atomically(() => direct.batch(list))),
    readMany: (list) => turn(() => direct.readMany(list)),
    exec: (script) => turn(async () => sqlite.exec(script)),
    transaction: (fn) => turn(() => atomically(() => fn(direct))),
  };
}

/* -------------------------------------------------------------------------- */
/* Turso                                                                       */
/* -------------------------------------------------------------------------- */

async function tursoBackend(url: string, authToken?: string): Promise<Backend> {
  const { createClient } = await import("@libsql/client/http");
  // Plain HTTPS requests: no sockets to keep open between serverless invocations.
  return clientBackend(createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken }));
}

function clientBackend(client: Client): Backend {
  type Target = Pick<Client, "execute">;
  const rows = (rs: { columns: string[]; rows: ArrayLike<unknown>[] }) => rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])));
  const on = (target: Target): Omit<Db, "batch" | "readMany"> => ({
    async all<T>(sql: string, ...args: Value[]) {
      return rows(await target.execute({ sql, args })) as T[];
    },
    async get<T>(sql: string, ...args: Value[]) {
      return rows(await target.execute({ sql, args }))[0] as T | undefined;
    },
    async run(sql: string, ...args: Value[]) {
      const rs = await target.execute({ sql, args });
      return { changes: rs.rowsAffected, lastId: Number(rs.lastInsertRowid ?? 0) };
    },
  });
  const batch = async (list: { sql: string; args?: Value[] }[]) => {
    if (list.length) await client.batch(list.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "write");
  };
  return {
    ...on(client),
    batch,
    async readMany(list) {
      if (!list.length) return [];
      return (await client.batch(list.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "read")).map(rows);
    },
    // Comments go first: a semicolon inside one must never split a statement.
    exec: (script) => batch(script.replace(/--[^\n]*/g, "").split(";").map((sql) => ({ sql: sql.trim() })).filter((s) => s.sql)),
    async transaction(fn) {
      const t = await client.transaction("write");
      try {
        const out = await fn({
          ...on(t),
          async batch(list) {
            for (const s of list) await t.execute({ sql: s.sql, args: s.args ?? [] });
          },
          async readMany(list) {
            const out: Record<string, unknown>[][] = [];
            for (const s of list) out.push(rows(await t.execute({ sql: s.sql, args: s.args ?? [] })));
            return out;
          },
        });
        await t.commit();
        return out;
      } catch (err) {
        await t.rollback().catch(() => undefined);
        throw err;
      } finally {
        t.close();
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Opening, migrating, querying                                                */
/* -------------------------------------------------------------------------- */

const g = globalThis as unknown as { __ramaiDb?: Promise<Backend> };

function backend(): Promise<Backend> {
  return (g.__ramaiDb ??= open().catch((err) => {
    g.__ramaiDb = undefined;
    throw err;
  }));
}

/**
 * Bump whenever SCHEMA or migrate() changes. A server starting against a
 * database already at this version (or newer) skips the setup: one quick read
 * instead of a dozen round trips to the cloud on every cold start.
 */
const SCHEMA_VERSION = 14;

async function open(): Promise<Backend> {
  const remote = remoteDatabase();
  const b = remote ? await tursoBackend(remote.url, remote.authToken) : await fileBackend();
  const at = await b.get<{ value: number }>("SELECT value FROM meta WHERE key = 'schema'").catch(() => undefined);
  if (at && at.value >= SCHEMA_VERSION) return b;
  await b.exec(SCHEMA);
  await migrate(b);
  await b.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)");
  // Never lowers it: an older server still running during a deploy leaves the newer version in place.
  await b.run("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value)", SCHEMA_VERSION);
  return b;
}

/** Additive migrations for databases created by earlier versions. */
async function migrate(b: Backend) {
  const columns = (await b.all<{ name: string }>("PRAGMA table_info(users)")).map((c) => c.name);
  const add: string[] = [];
  if (!columns.includes("patient_lang")) add.push("ALTER TABLE users ADD COLUMN patient_lang TEXT NOT NULL DEFAULT 'en'");
  if (!columns.includes("email_verified_at")) {
    add.push("ALTER TABLE users ADD COLUMN email_verified_at INTEGER");
    // Accounts created before email verification existed are grandfathered in.
    add.push("UPDATE users SET email_verified_at = created_at WHERE is_demo = 0");
  }
  if (!columns.includes("league_tier")) add.push("ALTER TABLE users ADD COLUMN league_tier INTEGER NOT NULL DEFAULT 0");
  if (!columns.includes("is_guest")) add.push("ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
  if (!columns.includes("country")) add.push("ALTER TABLE users ADD COLUMN country TEXT NOT NULL DEFAULT 'IN'");
  // Proof of consent: when the terms and privacy policy were accepted, and which version.
  if (!columns.includes("terms_accepted_at")) add.push("ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER");
  if (!columns.includes("terms_version")) add.push("ALTER TABLE users ADD COLUMN terms_version TEXT");
  const paymentColumns = (await b.all<{ name: string }>("PRAGMA table_info(payments)")).map((c) => c.name);
  // When the buyer asked for Pro to start at once (giving up a statutory cancellation period, where one applies).
  if (!paymentColumns.includes("waiver_at")) add.push("ALTER TABLE payments ADD COLUMN waiver_at INTEGER");
  // Pro is charged in the country's currency: rupees, dollars or pounds (amounts in paise, cents or pence).
  if (!paymentColumns.includes("currency")) add.push("ALTER TABLE payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR'");
  const archiveColumns = (await b.all<{ name: string }>("PRAGMA table_info(payments_archive)")).map((c) => c.name);
  if (!archiveColumns.includes("currency")) add.push("ALTER TABLE payments_archive ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR'");
  const startColumns = (await b.all<{ name: string }>("PRAGMA table_info(case_starts)")).map((c) => c.name);
  if (!startColumns.includes("tutorial")) add.push("ALTER TABLE case_starts ADD COLUMN tutorial INTEGER NOT NULL DEFAULT 0");
  // The daily case: which day a start or a ranked result belongs to, and how long it took.
  if (!startColumns.includes("daily_key")) add.push("ALTER TABLE case_starts ADD COLUMN daily_key TEXT");
  const resultColumns = (await b.all<{ name: string }>("PRAGMA table_info(results)")).map((c) => c.name);
  if (!resultColumns.includes("daily_key")) add.push("ALTER TABLE results ADD COLUMN daily_key TEXT");
  if (!resultColumns.includes("elapsed_min")) add.push("ALTER TABLE results ADD COLUMN elapsed_min INTEGER");
  if (!resultColumns.includes("grid")) add.push("ALTER TABLE results ADD COLUMN grid TEXT");
  // What the case showed about each skill — marks per category, why marks were lost, what was missed and done well — for progress and the report.
  if (!resultColumns.includes("detail")) add.push("ALTER TABLE results ADD COLUMN detail TEXT");
  // Sign-in moved to Supabase Auth: profiles link to their Supabase user.
  if (!columns.includes("auth_id")) add.push("ALTER TABLE users ADD COLUMN auth_id TEXT");
  // The doctor's own specialty, asked once: NULL = not asked yet, 'mixed' = every specialty.
  if (!columns.includes("specialty")) add.push("ALTER TABLE users ADD COLUMN specialty TEXT");
  if (add.length) await b.batch(add.map((sql) => ({ sql })));
  await b.exec("CREATE INDEX IF NOT EXISTS results_daily ON results(daily_key, score); CREATE INDEX IF NOT EXISTS case_starts_daily ON case_starts(user_id, daily_key)");
  await b.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id ON users(auth_id) WHERE auth_id IS NOT NULL");
  // Supabase keeps passwords now: RamAI's old password hashes and their sign-in sessions are gone for good.
  // (Guests still use RamAI's own session cookie — they have no password.)
  await b.batch([
    { sql: "UPDATE users SET password_hash = '!supabase' WHERE password_hash LIKE 'scrypt$%'" },
    { sql: "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE is_guest = 0)" },
    { sql: "DELETE FROM auth_tokens" },
  ]);
}

const inTx = new AsyncLocalStorage<Db>();

/** Queries — inside `tx()` they join its transaction. */
export const db: Db = {
  async all<T>(sql: string, ...args: Value[]) {
    return (inTx.getStore() ?? (await backend())).all<T>(sql, ...args);
  },
  async get<T>(sql: string, ...args: Value[]) {
    return (inTx.getStore() ?? (await backend())).get<T>(sql, ...args);
  },
  async run(sql: string, ...args: Value[]) {
    return (inTx.getStore() ?? (await backend())).run(sql, ...args);
  },
  async batch(list) {
    return (inTx.getStore() ?? (await backend())).batch(list);
  },
  async readMany(list) {
    return (inTx.getStore() ?? (await backend())).readMany(list);
  },
};

/** Runs `fn` in a write transaction (or joins the one already open). */
export async function tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const open = inTx.getStore();
  if (open) return fn(open);
  return (await backend()).transaction((t) => inTx.run(t, () => fn(t)));
}

/** Tests: runs the cloud adapter over any libSQL client (a local file stands in for Turso). */
export async function useClientForTests(client: Client) {
  const b = clientBackend(client);
  await b.exec(SCHEMA);
  await migrate(b);
  g.__ramaiDb = Promise.resolve(b);
}

/** A constraint violation, e.g. a username taken a moment ago by a parallel sign-up. */
export const isUniqueViolation = (err: unknown) => err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
