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
  const on = (target: Target): Omit<Db, "batch"> => ({
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
    exec: (script) => batch(script.split(";").map((sql) => ({ sql: sql.trim() })).filter((s) => s.sql)),
    async transaction(fn) {
      const t = await client.transaction("write");
      try {
        const out = await fn({
          ...on(t),
          async batch(list) {
            for (const s of list) await t.execute({ sql: s.sql, args: s.args ?? [] });
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

async function open(): Promise<Backend> {
  const remote = remoteDatabase();
  const b = remote ? await tursoBackend(remote.url, remote.authToken) : await fileBackend();
  await b.exec(SCHEMA);
  await migrate(b);
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
  const startColumns = (await b.all<{ name: string }>("PRAGMA table_info(case_starts)")).map((c) => c.name);
  if (!startColumns.includes("tutorial")) add.push("ALTER TABLE case_starts ADD COLUMN tutorial INTEGER NOT NULL DEFAULT 0");
  if (add.length) await b.batch(add.map((sql) => ({ sql })));
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
