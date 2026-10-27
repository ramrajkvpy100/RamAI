import { z } from "zod";

import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "habits", one day: "day:2026-10-26", or "deck" (the revision deck, kept with the account). */
const DOC = /^(habits|deck|day:\d{4}-\d{2}-\d{2})$/;

/** GET /api/planner?docs=habits,day:2026-10-26,… — the planner's documents (missing ones are null). */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const docs = (new URL(req.url).searchParams.get("docs") ?? "").split(",").filter((d) => DOC.test(d)).slice(0, 70);
    if (!docs.length) return ok({ docs: {} });
    const rows = await db.all<{ doc: string; data: string }>(`SELECT doc, data FROM planner_docs WHERE user_id = ? AND doc IN (${docs.map(() => "?").join(",")})`, user.id, ...docs);
    const out: Record<string, unknown> = Object.fromEntries(docs.map((d) => [d, null]));
    for (const r of rows) {
      try { out[r.doc] = JSON.parse(r.data); } catch {}
    }
    return ok({ docs: out });
  } catch (err) {
    return handleError(err);
  }
}

const Put = z.object({ doc: z.string().regex(DOC), data: z.unknown() });

/** PUT /api/planner — save one document (at most 40 KB; the deck 600 KB). */
export async function PUT(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 120);
  if (blocked) return blocked;
  const body = await parseBody(req, Put);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const data = JSON.stringify(body.data ?? null);
    if (data.length > (body.doc === "deck" ? 600_000 : 40_000)) return apiError(400, "BAD_REQUEST", "Too long.");
    await db.run("INSERT INTO planner_docs (user_id, doc, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, doc) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at", user.id, body.doc, data, Date.now());
    return ok({ saved: true });
  } catch (err) {
    return handleError(err);
  }
}
