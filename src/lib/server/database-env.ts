/**
 * Where the cloud database is, read from the environment — shared by the
 * database layer and the session key. Server-only; nothing here is exposed.
 */
import "server-only";

export interface RemoteDatabase {
  url: string;
  authToken?: string;
}

/**
 * Turso, when configured. Vercel's Turso integration sets TURSO_DATABASE_URL
 * and TURSO_AUTH_TOKEN; other names (a custom prefix, LIBSQL_URL…) are found
 * by their libsql:// address.
 */
/**
 * The main production database (its address isn't secret; its token is). Used when the Vercel–Turso
 * connection is removed — that connection made an empty branch per deployment, until it hit Turso's limit.
 */
const MAIN_DATABASE_URL = "libsql://database-byzantine-blanket-vercel-icfg-iy7zndploowyv07lupo4atm6.aws-ap-south-1.turso.io";

export function remoteDatabase(env: Record<string, string | undefined> = process.env): RemoteDatabase | null {
  if (!env.TURSO_DATABASE_URL && !env.LIBSQL_URL && !env.RAMAI_DB_URL && env.RAMAI_MAIN_DB_TOKEN) return { url: MAIN_DATABASE_URL, authToken: env.RAMAI_MAIN_DB_TOKEN };
  const url = env.TURSO_DATABASE_URL || env.LIBSQL_URL || env.RAMAI_DB_URL;
  if (url) return { url, authToken: env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN || env.RAMAI_DB_TOKEN };
  for (const [key, value] of Object.entries(env)) {
    if (!value?.startsWith("libsql://")) continue;
    const stem = key.replace(/_?(DATABASE_)?URL$/, "");
    const token = env[`${stem}_AUTH_TOKEN`] ?? env[`${stem}_TOKEN`] ?? Object.entries(env).find(([k, v]) => /AUTH_TOKEN$/.test(k) && v)?.[1];
    return { url: value, authToken: token };
  }
  return null;
}
