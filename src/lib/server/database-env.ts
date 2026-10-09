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
export function remoteDatabase(env: Record<string, string | undefined> = process.env): RemoteDatabase | null {
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
