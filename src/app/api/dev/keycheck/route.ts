import { createHash } from "node:crypto";
import { db } from "@/server/db";

import { deriveSecret } from "@/engine/session";
import { remoteDatabase } from "@/lib/server/database-env";
import { keySource, sessionKeyReady } from "@/server/session-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Temporary: whether the case-sealing key is the same across deploys. Facts and a fingerprint only — never a secret. */
export async function GET() {
  await sessionKeyReady();
  const s = process.env.RAMAI_SESSION_SECRET;
  let fp = "error";
  let err = "";
  try {
    fp = createHash("sha256").update(deriveSecret("fingerprint")).digest("hex").slice(0, 10);
  } catch (e) {
    err = e instanceof Error ? e.name : "?";
  }
  const remote = remoteDatabase();
  const row = await db.get<{ n: number; at: number }>("SELECT count(*) AS n, min(created_at) AS at FROM app_secrets").catch(() => undefined);
  const users = await db.get<{ n: number; first: number }>("SELECT count(*) AS n, min(created_at) AS first FROM users").catch(() => undefined);
  return Response.json({ from: keySource.from, secretSet: !!s, secretLen: s?.length ?? 0, remoteDb: !!remote, remoteToken: !!remote?.authToken, fp, err, dbVars: Object.keys(process.env).filter((k) => /TURSO|LIBSQL|RAMAI_DB|DATABASE|_URL$|AUTH_TOKEN/.test(k)).sort(), libsqlVars: Object.entries(process.env).filter(([, v]) => v?.startsWith("libsql://")).map(([k]) => k), dbHost: createHash("sha256").update(remote?.url ?? "").digest("hex").slice(0, 8), secrets: row, users, region: process.env.VERCEL_REGION ?? null, deploy: (process.env.VERCEL_DEPLOYMENT_ID ?? "").slice(-6) }, { headers: { "Cache-Control": "no-store" } });
}
