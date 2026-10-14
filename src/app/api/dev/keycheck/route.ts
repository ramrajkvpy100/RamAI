import { createHash } from "node:crypto";

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
  return Response.json({ from: keySource.from, secretSet: !!s, secretLen: s?.length ?? 0, remoteDb: !!remote, remoteToken: !!remote?.authToken, fp, err, region: process.env.VERCEL_REGION ?? null, deploy: (process.env.VERCEL_DEPLOYMENT_ID ?? "").slice(-6) }, { headers: { "Cache-Control": "no-store" } });
}
